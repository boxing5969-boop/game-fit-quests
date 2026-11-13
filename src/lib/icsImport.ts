/**
 * 📅 캘린더 3-1단계 — 휴대폰 캘린더 가져오기(.ics) (2026-11-13 대표님 「추천대로 3-1부터」 · 「캘린더 3단계 보고서」)
 *
 *   153운영본부 「일정」 탭 맨 아래 '휴대폰 캘린더 가져오기' — 구글 · 네이버 · 아웃룩에서 내보낸 .ics 파일을
 *   브라우저 안에서 읽어 미리 보여 주고, 고른 종류(업무 · 개인 · 외부)로 '내 일정'에 넣는다(ops_plan_save 그대로).
 *   파일은 서버로 보내지 않는다 — 일정 한 줄씩 기존 저장 함수로만.
 *     · 시각은 한국 시간으로 (UTC · 다른 나라 시간대는 바꿔서, 시간대 없는 시각은 한국 시간으로 본다)
 *     · 매주 반복(매일 포함) = 「일정」 탭 반복 그대로(요일 · 언제까지 · 이 날만 빼기) — 매월 · 격주 같은 반복은 첫 번만
 *     · 자정을 넘는 일정은 23:59까지 · 하루 넘게 이어지는 시각 일정은 하루 종일 여러 날로
 *     · 지난 일정 · 취소된 일정 · 1년 넘게 먼 일정은 빼고, 같은 일정은 한 번만, 한 번에 200개까지
 *   검사는 서버(ops_plan_save)와 같은 기준 — 제목 40자 · 여러 날 두 달 · 시작 날짜는 오늘 −62일 ~ +400일.
 *   순수 함수만 (시험 icsImport.test.ts).
 */
import { PLAN_TITLE_MAX } from "@/lib/opsPlans";

/** 한 번에 넣는 수 */
export const ICS_IMPORT_MAX = 200;
/** 파일 크기 상한 */
export const ICS_FILE_MAX_BYTES = 2 * 1024 * 1024;
/** 읽을 VEVENT 상한 (큰 파일에서 멈추지 않게) */
const PARSE_MAX = 5000;

export interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

export interface IcsVevent {
  props: IcsProp[];
}

/** 「일정」 탭 '내 일정' 한 줄로 바꾼 것 (종류 · 지점은 넣을 때 고른다) */
export interface IcsPlanItem {
  /** 같은 파일을 두 번 넣지 않게 — UID + 시작 */
  key: string;
  title: string;
  start_on: string;
  end_on: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  repeat_weekdays: number[];
  until_on: string | null;
  /** 반복에서 빼는 날 (오늘부터 · 넣은 뒤 ops_plan_skip) */
  skip_dates: string[];
  /** 바꿔서 넣은 것 한 줄 — '첫 번만' · '23:59까지' · '하루 종일로' */
  note: string | null;
}

export interface IcsImportSummary {
  items: IcsPlanItem[];
  /** 빼는 것 — 지난 · 취소 · 너무 먼 · 같은 · 이미 넣은 · 200개 넘음 · 읽을 수 없음 */
  skipped: { past: number; canceled: number; far: number; dup: number; done: number; over: number; bad: number };
  total: number;
}

// ───────────────────────── 날짜 도움 ─────────────────────────
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
const pad = (n: number) => String(n).padStart(2, "0");
const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ───────────────────────── 파일 읽기 ─────────────────────────
/** 글 칸 되돌리기 (RFC 5545 3.3.11) */
export const unescapeText = (s: string): string =>
  s.replace(/\\([\\;,nN])/g, (_m, c: string) => (c === "n" || c === "N" ? "\n" : c));

/** 줄 펴기(접힌 줄 잇기) → 속성 줄들 */
export function unfoldLines(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((l) => l.length > 0);
}

/** 'DTSTART;TZID=Asia/Seoul:20261117T190000' → { name, params, value } */
export function parseProp(line: string): IcsProp | null {
  let i = 0;
  let inQuote = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts: string[] = [];
  let cur = "";
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ";" && !inQuote) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  const name = (parts.shift() ?? "").toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

/** .ics 글 → VEVENT 들 (VALARM 같은 안쪽 칸은 건너뛴다) */
export function parseIcs(text: string): IcsVevent[] {
  const out: IcsVevent[] = [];
  let cur: IcsVevent | null = null;
  let depth = 0; // VEVENT 안쪽 칸 (VALARM 등)
  for (const line of unfoldLines(text)) {
    const p = parseProp(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      const v = p.value.trim().toUpperCase();
      if (v === "VEVENT" && !cur) {
        cur = { props: [] };
        depth = 0;
      } else if (cur) depth++;
      continue;
    }
    if (p.name === "END") {
      const v = p.value.trim().toUpperCase();
      if (cur && v === "VEVENT" && depth === 0) {
        out.push(cur);
        cur = null;
        if (out.length >= PARSE_MAX) break;
      } else if (cur && depth > 0) depth--;
      continue;
    }
    if (cur && depth === 0) cur.props.push(p);
  }
  return out;
}

// ───────────────────────── 시각 → 한국 시간 ─────────────────────────
const KST_ZONES = new Set(["asia/seoul", "korea standard time", "kst", "rok", "asia/pyongyang"]);

/** 그 시간대의 그 시각이 UTC 로 몇 분 앞서나 (Intl — 모르는 이름이면 null) */
function zoneOffsetMin(tz: string, utcMs: number): number | null {
  try {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
    return Math.round((asUtc - utcMs) / 60_000);
  } catch {
    return null;
  }
}

export interface KstStamp {
  day: string;
  /** 'HH:MM' — 하루 종일이면 null */
  hm: string | null;
}

/** DTSTART · DTEND · EXDATE 값 하나 → 한국 날짜 · 시각 (틀리면 null) */
export function toKst(value: string, params: Record<string, string>): KstStamp | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || params.VALUE?.toUpperCase() === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`;
    return Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? null : { day, hm: null };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 24 || mi > 59) return null;
  const localMs = Date.UTC(y, mo - 1, d, h, mi);
  let utcMs: number;
  if (m[7]) utcMs = localMs;
  else {
    const tz = (params.TZID ?? "").trim();
    if (!tz || KST_ZONES.has(tz.toLowerCase())) utcMs = localMs - 9 * 3600_000;
    else {
      // 그 시간대 시각 → UTC (서머타임 경계는 한 번 더 맞춤)
      const off1 = zoneOffsetMin(tz, localMs);
      if (off1 == null) utcMs = localMs - 9 * 3600_000; // 모르는 이름 = 한국 시간으로
      else {
        const guess = localMs - off1 * 60_000;
        const off2 = zoneOffsetMin(tz, guess) ?? off1;
        utcMs = localMs - off2 * 60_000;
      }
    }
  }
  const k = new Date(utcMs + 9 * 3600_000);
  return { day: k.toISOString().slice(0, 10), hm: `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}` };
}

/** 'PT1H30M' · 'P1D' · '-PT15M' → 분 (틀리면 null) */
export function durationMin(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(v.trim());
  if (!m || v.trim() === "P" || /T$/i.test(v.trim())) return null;
  const [, sign, w, d, h, mi] = m;
  const total = (Number(w ?? 0) * 7 + Number(d ?? 0)) * 1440 + Number(h ?? 0) * 60 + Number(mi ?? 0);
  return sign === "-" ? -total : total;
}

const hmMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const minHm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** 제목 — 줄바꿈 · 겹친 빈칸을 펴고 40자까지 (넘으면 39자 + …) */
export function clipTitle(s: string): string {
  const t = [...s.replace(/\s+/g, " ").trim()];
  return t.length > PLAN_TITLE_MAX ? `${t.slice(0, PLAN_TITLE_MAX - 1).join("")}…` : t.join("");
}

/** 매주 반복 첫 날부터 count 번째 일정 날 */
function weeklyNth(first: string, weekdays: readonly number[], count: number): string {
  let seen = 0;
  let d = first;
  for (let i = 0; i < 366 * 5; i++) {
    if (weekdays.includes(weekdayOf(d))) {
      seen++;
      if (seen >= count) return d;
    }
    d = addDays(d, 1);
  }
  return d;
}

const firstOn = (start: string, weekdays: readonly number[]): string => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (weekdays.includes(weekdayOf(d))) return d;
  }
  return start;
};

// ───────────────────────── VEVENT → 내 일정 한 줄 ─────────────────────────
type Built = { item: IcsPlanItem } | { skip: keyof IcsImportSummary["skipped"] };

/** VEVENT 하나 → 내 일정 한 줄 (today = 한국 오늘) */
export function veventToItem(ev: IcsVevent, today: string): Built {
  const get = (n: string) => ev.props.find((p) => p.name === n) ?? null;
  if ((get("STATUS")?.value ?? "").trim().toUpperCase() === "CANCELLED") return { skip: "canceled" };
  if (get("RECURRENCE-ID")) return { skip: "dup" }; // 반복의 바뀐 하루 — 반복 본체만 넣는다
  const ds = get("DTSTART");
  const start = ds ? toKst(ds.value, ds.params) : null;
  if (!start) return { skip: "bad" };
  const de = get("DTEND");
  let end = de ? toKst(de.value, de.params) : null;
  const notes: string[] = [];

  // 끝 — DTEND 가 없으면 DURATION, 그것도 없으면 하루 종일 = 그날 · 시각 = 1시간
  let allDay = start.hm == null;
  let startOn = start.day;
  let endOn = start.day;
  let st: string | null = start.hm;
  let et: string | null = null;
  if (allDay) {
    if (end && end.hm == null && end.day > start.day) endOn = addDays(end.day, -1);
    else if (!end) {
      const dur = durationMin(get("DURATION")?.value ?? "");
      if (dur && dur >= 1440) endOn = addDays(start.day, Math.ceil(dur / 1440) - 1);
    }
  } else {
    const sMin = hmMin(st as string);
    if (!end) {
      const dur = durationMin(get("DURATION")?.value ?? "") ?? 60;
      const eAbs = sMin + Math.max(dur, 1);
      end = { day: addDays(start.day, Math.floor(eAbs / 1440)), hm: minHm(eAbs % 1440) };
    } else if (end.hm == null) end = { day: end.day, hm: "00:00" };
    const span = dayDiff(start.day, end.day) * 1440 + hmMin(end.hm as string) - sMin;
    if (span <= 0) et = minHm(Math.min(sMin + 60, 1439));
    else if (end.day === start.day) et = end.hm;
    else if (span < 1440) {
      // 자정을 넘는 일정 — 23:59 까지 (끝이 딱 자정이면 그대로 23:59)
      et = "23:59";
      if (end.hm !== "00:00") notes.push("자정을 넘는 일정은 23:59까지");
    } else {
      // 하루 넘게 이어지는 시각 일정 = 하루 종일 여러 날
      allDay = true;
      st = null;
      endOn = end.hm === "00:00" ? addDays(end.day, -1) : end.day;
      notes.push("하루 넘는 일정은 하루 종일로");
    }
    if (st && et && hmMin(et) <= hmMin(st)) et = minHm(Math.min(hmMin(st) + 60, 1439));
    if (st && et && hmMin(et) <= hmMin(st)) return { skip: "bad" }; // 23:59 시작
  }

  // 반복 — 매주 · 매일만
  let weekdays: number[] = [];
  let until: string | null = null;
  const rr = get("RRULE");
  if (rr) {
    const rule = Object.fromEntries(
      rr.value
        .split(";")
        .map((kv) => kv.split("="))
        .filter((x) => x.length === 2)
        .map(([k, v]) => [k.toUpperCase(), v]),
    ) as Record<string, string>;
    const freq = (rule.FREQ ?? "").toUpperCase();
    const interval = Number(rule.INTERVAL ?? "1");
    const byday = (rule.BYDAY ?? "")
      .split(",")
      .map((x) => x.trim().toUpperCase().replace(/^[+-]?\d+/, ""))
      .filter((x) => x in BYDAY)
      .map((x) => BYDAY[x]);
    if ((freq === "WEEKLY" || freq === "DAILY") && interval === 1 && !rule.BYMONTH && !rule.BYMONTHDAY && !rule.BYSETPOS) {
      weekdays = byday.length ? [...new Set(byday)].sort((a, b) => a - b) : freq === "DAILY" ? [0, 1, 2, 3, 4, 5, 6] : [weekdayOf(startOn)];
      if (rule.UNTIL) {
        const u = toKst(rule.UNTIL, rule.UNTIL.length === 8 ? { VALUE: "DATE" } : {});
        // 끝 시각이 그날 일정 시작보다 이르면 그날 일정은 없다 (예: UNTIL = 그날 00:00)
        until = u ? (u.hm && st && !allDay && u.hm < st ? addDays(u.day, -1) : u.day) : null;
      } else if (rule.COUNT && Number(rule.COUNT) > 0) until = weeklyNth(firstOn(startOn, weekdays), weekdays, Number(rule.COUNT));
    } else notes.push("이 반복(매월 · 격주 등)은 첫 번만");
  }
  const repeat = weekdays.length > 0;
  if (repeat && endOn > startOn) {
    // 여러 날 반복 일정은 첫날 하루로 (「일정」 탭 반복은 하루짜리)
    endOn = startOn;
    notes.push("여러 날 반복은 하루씩");
  }

  // 언제를 넣나 — 지난 · 너무 먼 일정 빼기 · 반복은 오늘부터
  if (repeat) {
    if (until && until < today) return { skip: "past" };
    if (startOn < today) startOn = firstOn(today, weekdays);
    if (until && until < startOn) return { skip: "past" };
    endOn = startOn;
  } else {
    if (endOn < today) return { skip: "past" };
    if (startOn < today) startOn = today; // 이어지는 일정 = 오늘부터
  }
  if (startOn > addDays(today, 365)) return { skip: "far" };
  if (!repeat && endOn > addDays(startOn, 62)) {
    endOn = addDays(startOn, 62);
    notes.push("두 달까지만");
  }

  // 이 날만 빼기 — 반복 · 오늘부터 · 그 요일만
  const skip: string[] = [];
  if (repeat) {
    for (const p of ev.props.filter((x) => x.name === "EXDATE")) {
      for (const v of p.value.split(",")) {
        const k = toKst(v, p.params);
        if (k && k.day >= startOn && (!until || k.day <= until) && weekdays.includes(weekdayOf(k.day))) skip.push(k.day);
      }
    }
  }

  const summary = get("SUMMARY");
  const uid = (get("UID")?.value ?? "").trim();
  const item: IcsPlanItem = {
    key: `${uid || "x"}|${ds!.value.trim()}`,
    title: clipTitle(summary ? unescapeText(summary.value) : ""),
    start_on: startOn,
    end_on: endOn,
    all_day: allDay,
    start_time: allDay ? null : st,
    end_time: allDay ? null : et,
    repeat_weekdays: weekdays,
    until_on: repeat ? until : null,
    skip_dates: [...new Set(skip)].sort().slice(0, 30),
    note: notes.length ? notes.join(" · ") : null,
  };
  return { item };
}

/** 같은 일정인지 (제목 · 날짜 · 시각 · 반복) */
export const itemSig = (i: Pick<IcsPlanItem, "title" | "start_on" | "end_on" | "start_time" | "end_time" | "repeat_weekdays">): string =>
  [i.title, i.start_on, i.end_on, i.start_time ?? "", i.end_time ?? "", i.repeat_weekdays.join("")].join("|");

/**
 * 파일 글 → 넣을 것 · 뺄 것.
 * done = 이 기기에서 전에 넣은 key · existing = 이미 있는 내 일정의 itemSig (둘 다 '이미 넣은'으로 뺀다)
 */
export function planIcsImport(text: string, today: string, done: ReadonlySet<string> = new Set(), existing: ReadonlySet<string> = new Set()): IcsImportSummary {
  const events = parseIcs(text);
  const skipped = { past: 0, canceled: 0, far: 0, dup: 0, done: 0, over: 0, bad: 0 };
  const seen = new Set<string>();
  const items: IcsPlanItem[] = [];
  const built = events.map((ev) => veventToItem(ev, today));
  // 전에 넣은 일정과 같은 일정(다른 UID 로 한 번 더 들어 있는 것)도 '이미 넣은'으로 — 파일 순서와 상관없이
  const doneSigs = new Set(built.flatMap((b) => ("item" in b && done.has(b.item.key) ? [itemSig(b.item)] : [])));
  for (const b of built) {
    if ("skip" in b) {
      skipped[b.skip]++;
      continue;
    }
    const sig = itemSig(b.item);
    if (done.has(b.item.key) || existing.has(sig) || doneSigs.has(sig)) {
      skipped.done++;
      continue;
    }
    if (seen.has(sig) || seen.has(b.item.key)) {
      skipped.dup++;
      continue;
    }
    seen.add(sig);
    seen.add(b.item.key);
    items.push(b.item);
  }
  items.sort((a, b) => (a.start_on === b.start_on ? (a.start_time ?? "").localeCompare(b.start_time ?? "") : a.start_on.localeCompare(b.start_on)));
  if (items.length > ICS_IMPORT_MAX) {
    skipped.over = items.length - ICS_IMPORT_MAX;
    items.length = ICS_IMPORT_MAX;
  }
  return { items, skipped, total: events.length };
}

/** 뺀 것 한 줄 — '지난 일정 12 · 이미 넣은 3은 빼요' (없으면 null) */
export function skippedLine(s: IcsImportSummary["skipped"]): string | null {
  const parts = [
    s.done ? `이미 넣은 ${s.done}` : "",
    s.past ? `지난 일정 ${s.past}` : "",
    s.dup ? `같은 일정 ${s.dup}` : "",
    s.canceled ? `취소된 ${s.canceled}` : "",
    s.far ? `1년 넘게 먼 ${s.far}` : "",
    s.bad ? `읽을 수 없는 ${s.bad}` : "",
    s.over ? `200개 넘는 ${s.over}` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}개는 빼요` : null;
}

/** ops_plan_save 에 보낼 값 */
export function itemPayload(
  i: IcsPlanItem,
  o: { branch: string; kind: "work" | "personal" | "out" | "off"; private: boolean },
): Record<string, unknown> {
  const repeat = i.repeat_weekdays.length > 0;
  return {
    branch: o.branch,
    kind: o.kind,
    title: i.title,
    memo: "",
    start_on: i.start_on,
    end_on: repeat ? i.start_on : i.end_on,
    repeat_weekdays: repeat ? i.repeat_weekdays : [],
    until_on: repeat ? i.until_on : null,
    all_day: o.kind === "off" ? true : i.all_day,
    start_time: o.kind === "off" || i.all_day ? null : i.start_time,
    end_time: o.kind === "off" || i.all_day ? null : i.end_time,
    private: o.kind === "personal" && o.private,
  };
}

/** 미리 보기 한 줄 — '11/17(화) 19:00–20:00' · '매주 화 · 목 19:00–20:00' · '11/20(목) – 11/22 하루 종일' */
export function itemWhen(i: IcsPlanItem): string {
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${WD[weekdayOf(d)]})`;
  const time = i.all_day ? "하루 종일" : `${i.start_time}–${i.end_time}`;
  if (i.repeat_weekdays.length) {
    const days = i.repeat_weekdays.length === 7 ? "매일" : `매주 ${i.repeat_weekdays.map((d) => WD[d]).join(" · ")}`;
    return `${days} ${time}${i.until_on ? ` · ${md(i.until_on)}까지` : ""}`;
  }
  return i.end_on > i.start_on ? `${md(i.start_on)} – ${md(i.end_on)} ${time}` : `${md(i.start_on)} ${time}`;
}
