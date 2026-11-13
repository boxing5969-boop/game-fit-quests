// 📅 calendar-feed 순수 로직 — Deno(Edge Function)와 vitest(src/lib/calendarFeed.test.ts)가 같이 쓴다.
//   (2026-11-13 캘린더 3-1단계 · 대표님 「추천대로 3-1부터」 — 「캘린더 3단계 보고서」 구독 주소)
//
//   DB(calendar_feed_data · calendar_feed_branch)가 준 일정 자료 → 구독용 .ics (RFC 5545 · CRLF · 75바이트 접기).
//   휴대폰(아이폰) · 구글 캘린더가 몇 시간마다 다시 읽어 153 일정이 저절로 바뀐다 — 한 방향(거기서 고쳐도 153에는 안 옴).
//     · 매주 반복 = RRULE WEEKLY(첫 날은 그 요일로 · 언제까지 = UNTIL) · 이 날만 빼기 = EXDATE
//     · 여러 날 시각 일정 = 날마다 같은 시각(DAILY COUNT — 앱 「일정」 탭과 같은 뜻) · 하루 종일 = DATE
//     · 운동 약속 = 2-2 calendar-ics 와 같은 시각 · 제목 · 알림(VALARM — 약속 알림을 끈 회원은 없음)
//   제목 · 장소는 DB 가 정한 글(사람 이름 없음 — PT = 'PT 수업' · 개인 일정 = '개인 일정'), 설명 · 링크는 여기서 정한 글만.
//   주소 읽기(토큰 · 지점 코드)도 여기 — index.ts 는 DB 를 부르고 답만 한다.
import { REMINDS, SLOT_HOUR, SLOT_LABEL, alarmOffset, durationOf, escapeText, firstMatching, foldLine } from "../calendar-ics/ics.ts";

export type FeedKind = "staff" | "member" | "branch";

export interface FeedPromise {
  weekdays: number[];
  slot: string | null;
  remind: string;
  notify: boolean;
}

export interface FeedEvent {
  uid: string;
  title: string;
  /** 'YYYY-MM-DD' — 반복이면 시작(그 요일이 아니면 다음 그 요일부터) */
  day: string;
  end_day: string;
  /** 'HH:MM' — 없으면 하루 종일 */
  start: string | null;
  end: string | null;
  /** 0=일 … 6=토 — 매주 반복 */
  weekly: number[] | null;
  until: string | null;
  exdates: string[];
  busy: boolean;
  location: string | null;
  url: string | null;
  updated: string | null;
  promise: FeedPromise | null;
}

export interface FeedData {
  kind: FeedKind;
  name: string;
  events: FeedEvent[];
}

/** 주소 → 토큰(사람 주소) 또는 지점 코드(공개 주소) */
export type FeedTarget = { token: string } | { branch: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-4]):([0-5]\d)(:\d{2})?$/;
const TOKEN = /^[0-9a-f]{64}$/;
const CODE = /^[a-z0-9-]{2,40}$/;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const APP = "https://myboxer153.com";
/** 여러 날 시각 일정 · EXDATE 상한 (서버 검사와 같은 두 달 · 넉넉한 빼기 수) */
const MAX_DAILY = 62;
const MAX_EXDATES = 400;
const TITLE_MAX = 120;

const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekdayOf = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const dayDiff = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};
const validDay = (v: unknown): v is string => typeof v === "string" && YMD.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const icsDate = (day: string) => day.replace(/-/g, "");
const pad = (n: number) => String(n).padStart(2, "0");
/** 'HH:MM' → 분 (24:00 = 1440) · 틀리면 null */
const minOf = (hm: string | null): number | null => {
  if (!hm) return null;
  const m = HM.exec(hm);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v > 1440 ? null : v;
};
/** 날짜 + 분(0 ~ 2880) → 'YYYYMMDDTHHMMSS' (24:00 은 다음 날 00:00) */
const localAt = (day: string, min: number): string => {
  const d = addDays(day, Math.floor(min / 1440));
  const r = ((min % 1440) + 1440) % 1440;
  return `${icsDate(d)}T${pad(Math.floor(r / 60))}${pad(r % 60)}00`;
};
const weekdaysOf = (v: unknown): number[] | null => {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => a - b);
  return out.length ? out : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** DB 자료 → FeedData (틀린 일정은 버린다 · 모양이 아니면 null) */
export function normalizeFeedData(raw: unknown): FeedData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind: FeedKind = o.kind === "staff" || o.kind === "branch" ? o.kind : "member";
  const events: FeedEvent[] = [];
  for (const x of Array.isArray(o.events) ? o.events : []) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    const uid = typeof e.uid === "string" ? e.uid.replace(/[^A-Za-z0-9-]/g, "").slice(0, 120) : "";
    if (!uid || !validDay(e.day)) continue;
    const p = e.promise && typeof e.promise === "object" ? (e.promise as Record<string, unknown>) : null;
    const pw = p ? weekdaysOf(p.weekdays) : null;
    if (p && !pw) continue; // 요일 없는 약속은 그리지 않는다
    const start = typeof e.start === "string" && minOf(e.start) != null && minOf(e.start)! < 1440 ? e.start.slice(0, 5) : null;
    events.push({
      uid,
      title: (str(e.title) ?? "153 일정").replace(/\s+/g, " ").slice(0, TITLE_MAX),
      day: e.day,
      end_day: validDay(e.end_day) && e.end_day >= e.day ? e.end_day : e.day,
      start,
      end: start && typeof e.end === "string" && minOf(e.end) != null ? e.end.slice(0, 5) : null,
      weekly: weekdaysOf(e.weekly),
      until: validDay(e.until) ? e.until : null,
      exdates: Array.isArray(e.exdates) ? e.exdates.filter(validDay) : [],
      busy: e.busy === true,
      location: str(e.location)?.slice(0, 120) ?? null,
      url: typeof e.url === "string" && /^https:\/\/[^\s"<>\\]+$/.test(e.url) ? e.url.slice(0, 500) : null,
      updated: typeof e.updated === "string" && !Number.isNaN(Date.parse(e.updated)) ? e.updated : null,
      promise: pw
        ? {
            weekdays: pw,
            slot: typeof p!.slot === "string" && Object.prototype.hasOwnProperty.call(SLOT_HOUR, p!.slot) ? (p!.slot as string) : null,
            remind: typeof p!.remind === "string" && REMINDS.includes(p!.remind) ? (p!.remind as string) : "08:30",
            notify: p!.notify !== false,
          }
        : null,
    });
  }
  return { kind, name: (str(o.name) ?? "153 일정").slice(0, 60), events };
}

/** 끊긴 주소 · 없는 주소 · 권한이 없어진 사람 — 일정 없는 달력 (그 캘린더에서도 지난 일정이 사라진다) */
export const emptyFeed = (): FeedData => ({ kind: "member", name: "153 일정", events: [] });

/** 받은 파일 이름 (영문 — 휴대폰 파일 이름이 깨지지 않게) */
export const feedFileName = (kind: FeedKind): string => (kind === "staff" ? "153-ops.ics" : kind === "branch" ? "153-branch.ics" : "153-calendar.ics");

/** 주소 읽기 — …/calendar-feed/<토큰>.ics · …/calendar-feed/branch/<코드>.ics · ?t= · ?b= */
export function parseFeedPath(pathname: string, search: URLSearchParams): FeedTarget | null {
  const segs = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const last = (segs[segs.length - 1] ?? "").replace(/\.ics$/i, "").toLowerCase();
  if (segs[segs.length - 2] === "branch" && CODE.test(last)) return { branch: last };
  if (TOKEN.test(last)) return { token: last };
  const t = (search.get("t") ?? "").toLowerCase();
  if (TOKEN.test(t)) return { token: t };
  const b = (search.get("b") ?? "").toLowerCase();
  if (CODE.test(b)) return { branch: b };
  return null;
}

/** 일정 설명 한 줄 · 앱 링크 — 일정 종류(uid 앞머리)와 주소 종류로 (여기서 정한 글만) */
export function feedNote(e: Pick<FeedEvent, "uid" | "day" | "url">, kind: FeedKind): { note: string; link: string } {
  const head = e.uid.split("-")[0];
  if (head === "plan") return { note: "153운영본부 「일정」에서 고칠 수 있어요", link: `${APP}/office?tab=plan` };
  if (head === "shift") return { note: "근무 시간표 · 쉰 날 · 대타는 153운영본부 「근무」 탭에서", link: `${APP}/office?tab=work` };
  if (head === "meeting")
    return { note: e.url ? `지점 회의 · 회의 링크\n${e.url}` : "지점 회의 · 153운영본부 사무실", link: e.url ?? `${APP}/office` };
  if (head === "promise") return { note: "약속한 날 체육관에 오면 그날이 약속 지킨 날이에요.\n약속은 마이복서153 운동 달력에서 고칠 수 있어요.", link: `${APP}/home` };
  if (head === "dday") return { note: "마이복서153 운동 달력", link: `${APP}/home?cal=${e.day}` };
  // 153 일정
  if (kind === "staff") return { note: "153 일정 · 회원님 운동 달력에도 보여요", link: `${APP}/office?tab=plan` };
  if (kind === "branch") return { note: "153복싱짐 일정 · 마이복서153", link: APP };
  return { note: "153 일정 · 마이복서153 운동 달력", link: `${APP}/home?cal=${e.day}` };
}

/** ISO 시각 → 'YYYYMMDDTHHMMSSZ' */
const utcStamp = (iso: string): string => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** 반복 일정의 EXDATE 날짜 — 실제로 일정이 있는 날만 (첫 날 이후 · 언제까지 안 · 그 요일) */
function exdatesFor(dates: readonly string[], first: string, until: string | null, weekdays: readonly number[]): string[] {
  return [...new Set(dates)]
    .filter((d) => d >= first && (!until || d <= until) && weekdays.includes(weekdayOf(d)))
    .sort()
    .slice(0, MAX_EXDATES);
}

/** 일정 하나 → VEVENT 줄들 (그릴 수 없으면 []) */
export function eventLines(e: FeedEvent, kind: FeedKind, stamp: string): string[] {
  const p = e.promise;
  const weekly = p ? p.weekdays : e.weekly;
  const first = weekly ? firstMatching(e.day, weekly) : e.day;
  if (weekly && e.until && first > e.until) return []; // 반복이 끝난 일정
  const { note, link } = feedNote(e, kind);

  // 시각 — 약속은 시간대(새벽 6시 … 밤 9시, 1시간), 그 밖은 'HH:MM'
  let startMin: number | null;
  let endMin: number | null = null;
  if (p) startMin = p.slot ? SLOT_HOUR[p.slot] * 60 : null;
  else startMin = minOf(e.start);
  if (startMin != null) {
    if (p) endMin = startMin + 60;
    else {
      const em = minOf(e.end);
      endMin = em == null || em === startMin ? startMin + 60 : em < startMin ? em + 1440 : em;
    }
  }
  const timed = startMin != null && endMin != null;

  const lines: string[] = ["BEGIN:VEVENT", `UID:${e.uid}@myboxer153.com`, `DTSTAMP:${stamp}`];
  if (e.updated) lines.push(`LAST-MODIFIED:${utcStamp(e.updated)}`);

  if (timed) {
    const sm = startMin as number;
    const em = endMin as number;
    lines.push(`DTSTART;TZID=Asia/Seoul:${localAt(first, sm)}`, `DTEND;TZID=Asia/Seoul:${localAt(first, em)}`);
    if (weekly) {
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${weekly.map((d) => BYDAY[d]).join(",")}${e.until ? `;UNTIL=${icsDate(e.until)}T145959Z` : ""}`);
      const ex = exdatesFor(e.exdates, first, e.until, weekly);
      if (ex.length) lines.push(`EXDATE;TZID=Asia/Seoul:${ex.map((d) => localAt(d, sm)).join(",")}`);
    } else if (e.end_day > e.day) {
      // 여러 날 시각 일정 = 날마다 같은 시각
      lines.push(`RRULE:FREQ=DAILY;COUNT=${Math.min(MAX_DAILY, dayDiff(e.day, e.end_day) + 1)}`);
    }
  } else {
    const endDay = weekly ? first : e.end_day;
    lines.push(`DTSTART;VALUE=DATE:${icsDate(first)}`, `DTEND;VALUE=DATE:${icsDate(addDays(endDay, 1))}`);
    if (weekly) {
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${weekly.map((d) => BYDAY[d]).join(",")}${e.until ? `;UNTIL=${icsDate(e.until)}` : ""}`);
      const ex = exdatesFor(e.exdates, first, e.until, weekly);
      if (ex.length) lines.push(`EXDATE;VALUE=DATE:${ex.map(icsDate).join(",")}`);
    }
  }

  const title = p ? `153 운동 약속${p.slot ? ` · ${SLOT_LABEL[p.slot]}` : ""}` : e.title;
  lines.push(`SUMMARY:${escapeText(title)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  lines.push(`DESCRIPTION:${escapeText(note)}`, `URL:${link}`, `TRANSP:${e.busy ? "OPAQUE" : "TRANSPARENT"}`);
  if (p && p.notify) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(p.remind === "eve" ? "내일은 운동 약속한 날이에요" : "오늘은 운동 약속한 날이에요")}`,
      `TRIGGER:${durationOf(alarmOffset({ slot: p.slot, remind: p.remind }))}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

/** 구독용 .ics 전체 (CRLF) — stamp = 만든 시각 'YYYYMMDDTHHMMSSZ' */
export function buildFeedIcs(data: FeedData, stamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//153 Boxing Gym//MyBoxer153 Feed//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(data.name)}`,
    `X-WR-CALDESC:${escapeText("마이복서153 · 153복싱짐")}`,
    "X-WR-TIMEZONE:Asia/Seoul",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const seen = new Set<string>();
  for (const e of data.events) {
    if (seen.has(e.uid)) continue; // 같은 UID 는 한 번만 (캘린더 앱이 겹친 일정을 거부하지 않게)
    seen.add(e.uid);
    lines.push(...eventLines(e, data.kind, stamp));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
