// 📅 calendar-ics 순수 로직 — Deno(Edge Function)와 vitest(src/lib/calendarIcs.test.ts)가 같이 쓴다.
//   (2026-11-13 운동 달력 2-2단계 — 대표님 「다음」 · 보고서 「내 휴대폰 캘린더에 약속 넣기」:
//    앱 알림을 안 켠 회원에게도 휴대폰 캘린더가 약속한 날을 알려 준다 · 휴대폰 캘린더 위젯에 약속이 보인다)
//
//   주소 인자만으로 매주 반복 일정 하나(.ics)를 만든다 — DB 를 읽지 않고, 사람을 알아볼 값도 받지 않는다.
//     w = 요일(0=일 … 6=토, 쉼표) · d = 첫 날(YYYY-MM-DD, 그 요일이 아니면 다음 약속 요일로) · s = 시간대(없으면 하루 종일)
//     r = 알림 시각(eve = 전날 저녁 8시 · 07:00 · 08:30 · 12:00 · 17:00, 없으면 08:30) · b = 지점 짧은 이름(정해 둔 것만)
//   지어낸 글이 들어가지 않게 제목 · 장소 · 설명은 모두 여기서 정한 글만 쓴다(b 는 정해 둔 지점 이름표에 있을 때만).
//   시간대 → 시각 · 알림 시각 · 지점 이름은 화면(src/lib/promise153.ts) · DB(promise_tick · calendar_notice)와 같은 말.

export const SLOT_HOUR: Readonly<Record<string, number>> = { dawn: 6, morning: 7, noon: 12, afternoon: 15, evening: 19, night: 21 };
export const SLOT_LABEL: Readonly<Record<string, string>> = {
  dawn: "새벽",
  morning: "아침",
  noon: "점심",
  afternoon: "오후",
  evening: "저녁",
  night: "밤",
};
export const REMINDS: readonly string[] = ["eve", "07:00", "08:30", "12:00", "17:00"];
/** '전날 저녁' 알림 = 전날 이 시각 (DB calendar_notice.promise_eve 기본값과 같다) */
export const EVE_HOUR = 20;
/** 지점 짧은 이름 → 장소 (지점이 늘면 한 줄) */
export const BRANCHES: Readonly<Record<string, string>> = {
  선릉역점: "153복싱짐 선릉역점",
  잠실점: "153복싱짐 잠실점",
  역삼점: "153복싱짐 역삼점",
  칠금점: "153복싱짐 칠금점",
  종로점: "153복싱짐 종로점",
};
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface IcsInput {
  weekdays: number[];
  slot: string | null;
  start: string;
  remind: string;
  branch: string | null;
}

const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const dayDiff = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

/** start 부터 약속 요일인 첫 날 (RRULE 은 DTSTART 를 늘 첫 번째로 넣어서 — 요일이 다르면 하루가 더 생긴다) */
export function firstMatching(start: string, weekdays: readonly number[]): string {
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (weekdays.includes(weekday(d))) return d;
  }
  return start;
}

/** 주소 인자 읽기 — 틀리면 { error } (화면에 보일 한국어) */
export function parseIcsQuery(q: URLSearchParams, today: string): IcsInput | { error: string } {
  const raw = (q.get("w") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (raw.length === 0 || raw.some((x) => !/^[0-6]$/.test(x))) return { error: "요일을 다시 골라 주세요" };
  const weekdays = [...new Set(raw.map(Number))].sort((a, b) => a - b);
  const s = q.get("s");
  const slot = s && Object.prototype.hasOwnProperty.call(SLOT_HOUR, s) ? s : null;
  const r = q.get("r");
  const remind = r && REMINDS.includes(r) ? r : "08:30";
  const b = q.get("b");
  const branch = b && Object.prototype.hasOwnProperty.call(BRANCHES, b) ? BRANCHES[b] : null;
  // 첫 날 — 어제 ~ 2주 뒤 안이 아니면 오늘부터
  const d = q.get("d");
  const base = d && YMD.test(d) && dayDiff(today, d) >= -1 && dayDiff(today, d) <= 14 ? d : today;
  return { weekdays, slot, start: firstMatching(base, weekdays), remind, branch };
}

/** 'YYYY-MM-DD' (+ 시) → '20261117' · '20261117T190000' */
const icsDate = (day: string) => day.replace(/-/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

/** 분 → 알림 TRIGGER ('-PT10H30M' · 'PT8H30M' · '-PT4H' · 'PT0M') */
export function durationOf(min: number): string {
  if (min === 0) return "PT0M";
  const sign = min < 0 ? "-" : "";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}`;
}

/** 알림 시각 → 일정 시작에서 몇 분 (시각 있는 일정이 알림보다 30분 안쪽 · 뒤에 있으면 1시간 전) */
export function alarmOffset(input: Pick<IcsInput, "slot" | "remind">): number {
  const startMin = input.slot ? SLOT_HOUR[input.slot] * 60 : 0;
  let alarmMin: number;
  if (input.remind === "eve") alarmMin = (EVE_HOUR - 24) * 60;
  else {
    const [h, m] = input.remind.split(":").map(Number);
    alarmMin = h * 60 + m;
  }
  const off = alarmMin - startMin;
  return input.slot && off > -30 ? -60 : off;
}

/** 글 칸 이스케이프 (RFC 5545 3.3.11) */
export const escapeText = (s: string): string => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const enc = new TextEncoder();
/** 75 바이트마다 접기 (한글이 쪼개지지 않게 글자 단위로) */
export function foldLine(line: string): string {
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 앞에 빈칸 1바이트
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** 매주 반복 운동 약속 .ics (CRLF) — stamp = 만든 시각 'YYYYMMDDTHHMMSSZ' */
export function buildPromiseIcs(input: IcsInput, stamp: string): string {
  const slotLabel = input.slot ? SLOT_LABEL[input.slot] : null;
  const days = input.weekdays.map((d) => BYDAY[d]).join(",");
  const uid = `153-promise-${input.weekdays.join("")}-${input.slot ?? "day"}-${icsDate(input.start)}@myboxer153.com`;
  const timed = input.slot != null;
  const h = timed ? SLOT_HOUR[input.slot as string] : 0;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//153 Boxing Gym//MyBoxer153//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    ...(timed
      ? [`DTSTART;TZID=Asia/Seoul:${icsDate(input.start)}T${pad(h)}0000`, `DTEND;TZID=Asia/Seoul:${icsDate(input.start)}T${pad(h + 1)}0000`]
      : [`DTSTART;VALUE=DATE:${icsDate(input.start)}`, `DTEND;VALUE=DATE:${icsDate(addDays(input.start, 1))}`]),
    `RRULE:FREQ=WEEKLY;BYDAY=${days}`,
    `SUMMARY:${escapeText(`153 운동 약속${slotLabel ? ` · ${slotLabel}` : ""}`)}`,
    ...(input.branch ? [`LOCATION:${escapeText(input.branch)}`] : []),
    `DESCRIPTION:${escapeText("약속한 날 체육관에 오면 그날이 약속 지킨 날이에요.\n약속은 마이복서153 운동 달력에서 고칠 수 있어요.")}`,
    "URL:https://myboxer153.com/home",
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(input.remind === "eve" ? "내일은 운동 약속한 날이에요" : "오늘은 운동 약속한 날이에요")}`,
    `TRIGGER:${durationOf(alarmOffset(input))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** 지금 → 'YYYYMMDDTHHMMSSZ' */
export const icsStamp = (d: Date): string => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** 지금 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (d: Date): string => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
