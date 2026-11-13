/**
 * 📅 캘린더 3-2단계 — 반복 규칙 한 곳 (2026-11-13 대표님 「3-2 시작」 · 「캘린더 3단계 보고서」)
 *
 *   153운영본부 「일정」의 반복 = RFC 5545 RRULE 의 좁힌 모양. 서버 `_ops_rrule_parse` · `_ops_recur_on` ·
 *   `_ops_recur_first` · `_ops_recur_until`(DB 20261113145845_calendar_stage32.sql)와 **같은 결과**를 낸다 —
 *   같은 경우 40개를 src/lib/opsRecur.cases.json(기대값 = python dateutil)으로 vitest 와 로컬 SQL 에서 함께 본다.
 *
 *   받는 것: FREQ = DAILY · WEEKLY · MONTHLY · YEARLY / INTERVAL / BYDAY(매주 = 요일들 · 매월 = 1MO ~ 5MO · -1FR 하나) /
 *            BYMONTHDAY(매월 — 1 ~ 31 · -1 = 말일 하나) / COUNT(1 ~ 200) / UNTIL(날짜) / WKST=MO. 그 밖은 거절.
 *   뜻(RFC · dateutil 과 같음): 주는 월요일 시작 · 간격은 처음 날이 든 주 · 달 · 해부터 센다 · 없는 날(2/30 · 5번째 요일이
 *            없는 달 · 평년 2/29)은 건너뛴다 · COUNT 는 빼는 날(EXDATE)을 빼기 전에 센다.
 *   저장: 규칙 글은 UNTIL 없이(`ruleText`) — 끝나는 날은 ops_plans.until_on(COUNT 면 서버가 마지막 날을 계산해 넣는다) ·
 *         시작 날은 규칙에 맞는 첫날로 당겨 저장(`firstOccurrence`) — 휴대폰 캘린더(RFC)와 어긋나지 않게.
 *   예전 일정(rrule 없이 repeat_weekdays 만) = 매주 그 요일들(`ruleOf`).
 */

export type RecurFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurRule {
  freq: RecurFreq;
  interval: number;
  /** 매주 — 요일들(0 = 일 … 6 = 토) */
  byDay: number[];
  /** 매월 n번째 요일 — 1 ~ 5 · -1(마지막) */
  nth: number | null;
  nthWd: number | null;
  /** 매월 그 날 — 1 ~ 31 · -1(말일) */
  monthDay: number | null;
  count: number | null;
}

export interface ParsedRule {
  rule: RecurRule;
  /** UNTIL 이 있었으면 그 날(한국 날짜) */
  until: string | null;
}

/** 간격 상한 · 횟수 상한 · 계산 범위(첫날부터 10년) — 서버와 같은 값 */
export const RECUR_INTERVAL_MAX: Record<RecurFreq, number> = { DAILY: 30, WEEKLY: 12, MONTHLY: 12, YEARLY: 5 };
export const RECUR_COUNT_MAX = 200;
export const RECUR_SCAN_DAYS = 3653;

export const RRULE_ERROR = "반복 규칙을 다시 골라 주세요";

const WD_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
/** 월요일부터 — 규칙 글 · 화면 순서 */
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

// ───────────────────────── 날짜 (한국 날짜 'YYYY-MM-DD' 글자 그대로 — 시간대 없음) ─────────────────────────
const ms = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const rAddDays = (d: string, n: number): string => iso(ms(d) + n * 86_400_000);
const diffDays = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000);
const wdOf = (d: string) => new Date(ms(d)).getUTCDay();
const mondayOf = (d: string) => rAddDays(d, -((wdOf(d) + 6) % 7));
const ymIndex = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const dayOf = (d: string) => Number(d.slice(8, 10));
const lastDayOf = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate();
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(ms(v));

// ───────────────────────── 읽기 ─────────────────────────
/** 규칙 글 → 규칙 · UNTIL. 받지 않는 모양이면 null (서버도 같은 경우에 RRULE_ERROR) */
export function parseRrule(text: string | null | undefined): ParsedRule | null {
  if (typeof text !== "string") return null;
  let s = text.trim().toUpperCase();
  if (s.startsWith("RRULE:")) s = s.slice(6);
  if (!s) return null;
  const parts = new Map<string, string>();
  for (const seg of s.split(";")) {
    if (!seg) continue;
    const m = /^([A-Z]+)=([^=;]+)$/.exec(seg);
    if (!m || parts.has(m[1])) return null;
    parts.set(m[1], m[2]);
  }
  for (const k of parts.keys()) if (!["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "COUNT", "UNTIL", "WKST"].includes(k)) return null;
  const freq = parts.get("FREQ") as RecurFreq | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  if (parts.has("WKST") && parts.get("WKST") !== "MO") return null;

  let interval = 1;
  if (parts.has("INTERVAL")) {
    const v = parts.get("INTERVAL") as string;
    if (!/^\d{1,3}$/.test(v)) return null;
    interval = Number(v);
    if (interval < 1 || interval > RECUR_INTERVAL_MAX[freq]) return null;
  }

  const rule: RecurRule = { freq, interval, byDay: [], nth: null, nthWd: null, monthDay: null, count: null };

  if (parts.has("BYDAY")) {
    const toks = (parts.get("BYDAY") as string).split(",");
    if (freq === "WEEKLY") {
      const days = new Set<number>();
      for (const t of toks) {
        const i = WD_CODES.indexOf(t as (typeof WD_CODES)[number]);
        if (i < 0 || days.has(i)) return null;
        days.add(i);
      }
      rule.byDay = [...days].sort((a, b) => a - b);
    } else if (freq === "MONTHLY") {
      if (toks.length !== 1) return null;
      const m = /^([+-]?\d)(MO|TU|WE|TH|FR|SA|SU)$/.exec(toks[0]);
      if (!m) return null;
      const n = Number(m[1]);
      if (!(n === -1 || (n >= 1 && n <= 5))) return null;
      rule.nth = n;
      rule.nthWd = WD_CODES.indexOf(m[2] as (typeof WD_CODES)[number]);
    } else return null;
  }

  if (parts.has("BYMONTHDAY")) {
    if (freq !== "MONTHLY" || rule.nth != null) return null;
    const v = parts.get("BYMONTHDAY") as string;
    if (!/^-?\d{1,2}$/.test(v)) return null;
    const n = Number(v);
    if (!(n === -1 || (n >= 1 && n <= 31))) return null;
    rule.monthDay = n;
  }

  if (parts.has("COUNT")) {
    const v = parts.get("COUNT") as string;
    if (!/^\d{1,3}$/.test(v)) return null;
    const n = Number(v);
    if (n < 1 || n > RECUR_COUNT_MAX) return null;
    rule.count = n;
  }

  let until: string | null = null;
  if (parts.has("UNTIL")) {
    if (rule.count != null) return null;
    const v = parts.get("UNTIL") as string;
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
    if (!m) return null;
    let day = `${m[1]}-${m[2]}-${m[3]}`;
    if (!isDay(day) || iso(ms(day)) !== day) return null;
    // UTC 시각이면 한국 날짜로 (UNTIL=20261231T145959Z = 12/31 23:59:59 한국)
    if (m[7] && Number(m[4]) * 60 + Number(m[5]) >= 15 * 60) day = rAddDays(day, 1);
    until = day;
  }
  return { rule, until };
}

/** 빈 칸을 시작 날로 채운다 — 매주 요일 없음 = 시작 요일 · 매월 날 없음 = 시작 날 */
export function fillRule(rule: RecurRule, start: string): RecurRule {
  if (rule.freq === "WEEKLY" && rule.byDay.length === 0) return { ...rule, byDay: [wdOf(start)] };
  if (rule.freq === "MONTHLY" && rule.nth == null && rule.monthDay == null) return { ...rule, monthDay: dayOf(start) };
  return rule;
}

/** 저장하는 규칙 글 (UNTIL 없이) — FREQ · INTERVAL · BYDAY|BYMONTHDAY · COUNT 순서. 서버 `_ops_rrule_text` 와 같은 글 */
export function ruleText(rule: RecurRule): string {
  const out = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) out.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "WEEKLY" && rule.byDay.length) out.push(`BYDAY=${MON_FIRST.filter((d) => rule.byDay.includes(d)).map((d) => WD_CODES[d]).join(",")}`);
  if (rule.freq === "MONTHLY" && rule.nth != null && rule.nthWd != null) out.push(`BYDAY=${rule.nth}${WD_CODES[rule.nthWd]}`);
  if (rule.freq === "MONTHLY" && rule.monthDay != null) out.push(`BYMONTHDAY=${rule.monthDay}`);
  if (rule.count != null) out.push(`COUNT=${rule.count}`);
  return out.join(";");
}

/** COUNT 를 뺀 규칙 글 — 휴대폰 캘린더에는 UNTIL(계산해 둔 마지막 날)로 내보낸다 */
export const ruleTextNoCount = (rule: RecurRule): string => ruleText({ ...rule, count: null });

export interface RecurSource {
  start_on: string;
  end_on: string;
  rrule?: string | null;
  repeat_weekdays: readonly number[];
  until_on: string | null;
  skip_dates: readonly string[];
}

/** 일정의 규칙 — rrule 이 있으면 그것, 없으면 예전 매주 요일들, 둘 다 없으면 한 번 하는 일정(null) */
export function ruleOf(p: Pick<RecurSource, "rrule" | "repeat_weekdays" | "start_on">): RecurRule | null {
  const parsed = p.rrule ? parseRrule(p.rrule) : null;
  if (parsed) return fillRule(parsed.rule, p.start_on);
  if (p.repeat_weekdays.length) return { freq: "WEEKLY", interval: 1, byDay: [...new Set(p.repeat_weekdays)].sort((a, b) => a - b), nth: null, nthWd: null, monthDay: null, count: null };
  return null;
}

// ───────────────────────── 펼치기 ─────────────────────────
/** 그날이 규칙 모양에 맞나 — 끝 · 빼는 날 · 횟수는 보지 않는다. anchor = 간격을 세기 시작하는 날(시작 날) */
export function matchesRule(rule: RecurRule, anchor: string, date: string): boolean {
  if (date < anchor) return false;
  switch (rule.freq) {
    case "DAILY":
      return diffDays(anchor, date) % rule.interval === 0;
    case "WEEKLY":
      return rule.byDay.includes(wdOf(date)) && (diffDays(mondayOf(anchor), mondayOf(date)) / 7) % rule.interval === 0;
    case "MONTHLY": {
      if ((ymIndex(date) - ymIndex(anchor)) % rule.interval !== 0) return false;
      const day = dayOf(date);
      if (rule.monthDay != null) return day === (rule.monthDay === -1 ? lastDayOf(date) : rule.monthDay);
      if (rule.nth == null || rule.nthWd == null || wdOf(date) !== rule.nthWd) return false;
      return rule.nth === -1 ? day > lastDayOf(date) - 7 : Math.ceil(day / 7) === rule.nth;
    }
    case "YEARLY":
      return (
        (Number(date.slice(0, 4)) - Number(anchor.slice(0, 4))) % rule.interval === 0 &&
        date.slice(5, 7) === anchor.slice(5, 7) &&
        dayOf(date) === dayOf(anchor)
      );
  }
}

/** 시작 날부터 규칙에 맞는 첫날 (10년 안에 없으면 null) — 저장할 때 시작 날을 이 날로 당긴다 */
export function firstOccurrence(rule: RecurRule, start: string): string | null {
  for (let i = 0; i <= RECUR_SCAN_DAYS; i++) {
    const d = rAddDays(start, i);
    if (matchesRule(rule, start, d)) return d;
  }
  return null;
}

/** COUNT 번째 날 (첫날부터 · 빼는 날 세기 전) — 10년 안에 다 못 채우면 null */
export function countUntil(rule: RecurRule, first: string): string | null {
  if (rule.count == null) return null;
  let n = 0;
  for (let i = 0; i <= RECUR_SCAN_DAYS; i++) {
    const d = rAddDays(first, i);
    if (matchesRule(rule, first, d) && ++n === rule.count) return d;
  }
  return null;
}

export const isRecurring = (p: Pick<RecurSource, "rrule" | "repeat_weekdays">): boolean => !!p.rrule || p.repeat_weekdays.length > 0;

/**
 * 그날 이 일정이 있나 — 한 번 하는 일정은 시작 ~ 끝, 반복은 규칙 모양 + 끝(until_on) + 빼는 날.
 * COUNT 는 서버가 계산해 둔 until_on 으로 본다(그래서 O(1) — 한 해 보기에서도 가볍게).
 * 저장 전 시트 미리 보기처럼 until_on 이 비어 있으면 그 자리에서 계산한다.
 */
export function occursOnRule(p: RecurSource, date: string): boolean {
  const rule = ruleOf(p);
  if (!rule) return date >= p.start_on && date <= p.end_on;
  if (date < p.start_on) return false;
  const until = p.until_on ?? (rule.count != null ? countUntil(rule, p.start_on) : null);
  if (until && date > until) return false;
  if (p.skip_dates.includes(date)) return false;
  return matchesRule(rule, p.start_on, date);
}

/** from ~ to 안의 날들 (오름차순) — 규칙은 한 번만 읽는다(한 해 보기에서도 가볍게) */
export function recurDates(p: RecurSource, from: string, to: string): string[] {
  const out: string[] = [];
  const rule = ruleOf(p);
  if (!rule) {
    for (let d = from > p.start_on ? from : p.start_on; d <= to && d <= p.end_on; d = rAddDays(d, 1)) out.push(d);
    return out;
  }
  const until = p.until_on ?? (rule.count != null ? countUntil(rule, p.start_on) : null);
  const end = until && until < to ? until : to;
  const skip = new Set(p.skip_dates);
  for (let d = from > p.start_on ? from : p.start_on; d <= end; d = rAddDays(d, 1)) {
    if (!skip.has(d) && matchesRule(rule, p.start_on, d)) out.push(d);
  }
  return out;
}

/** 다음 날 (그날 포함 · 1년 안) — 검색 · 목록의 '다음' */
export function nextOccurrence(p: RecurSource, from: string): string | null {
  const a = from > p.start_on ? from : p.start_on;
  for (let i = 0; i <= 366; i++) {
    const d = rAddDays(a, i);
    if (occursOnRule(p, d)) return d;
    if (!isRecurring(p) && d > p.end_on) return null;
  }
  return null;
}

// ───────────────────────── 화면 글 ─────────────────────────
const WD_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const ORD_KO: Record<number, string> = { 1: "첫째", 2: "둘째", 3: "셋째", 4: "넷째", 5: "다섯째", [-1]: "마지막" };

const mdKo = (d: string) => `${Number(d.slice(5, 7))}월 ${dayOf(d)}일`;

/** 요일들 — "화 · 목" · "평일" · "주말" · 7개면 "매일 요일" */
const daysKo = (days: readonly number[]): string => {
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "평일";
  if (set.size === 2 && set.has(0) && set.has(6)) return "주말";
  return MON_FIRST.filter((d) => set.has(d)).map((d) => WD_KO[d]).join(" · ");
};

/** 규칙 한 줄 — "매일" · "3일마다" · "매주 화 · 목" · "2주마다 월" · "매월 15일" · "매월 셋째 화요일" · "매월 말일" · "매년 11월 13일" */
export function ruleBaseLabel(rule: RecurRule, start: string): string {
  const n = rule.interval;
  switch (rule.freq) {
    case "DAILY":
      return n === 1 ? "매일" : `${n}일마다`;
    case "WEEKLY": {
      if (n === 1 && new Set(rule.byDay).size === 7) return "매일";
      return `${n === 1 ? "매주" : `${n}주마다`} ${daysKo(rule.byDay)}`;
    }
    case "MONTHLY": {
      const head = n === 1 ? "매월" : `${n}개월마다`;
      if (rule.monthDay === -1) return `${head} 말일`;
      if (rule.monthDay != null) return `${head} ${rule.monthDay}일`;
      if (rule.nth != null && rule.nthWd != null) return `${head} ${ORD_KO[rule.nth]} ${WD_KO[rule.nthWd]}요일`;
      return `${head} ${dayOf(start)}일`;
    }
    case "YEARLY":
      return `${n === 1 ? "매년" : `${n}년마다`} ${mdKo(start)}`;
  }
}

/** 규칙 + 끝 — "매주 화 · 목 · 12월 31일까지" · "매월 첫째 월요일 · 10번" */
export function ruleLabel(rule: RecurRule, start: string, until?: string | null): string {
  const base = ruleBaseLabel(rule, start);
  if (rule.count != null) return `${base} · ${rule.count}번`;
  if (until) return `${base} · ${mdKo(until)}까지`;
  return base;
}

/** 매월 반복 고르기 — 시작 날로 고를 수 있는 모양들 (구글 캘린더처럼) */
export type MonthMode = "day" | "nth" | "lastWd" | "lastDay";

export function monthModes(start: string): MonthMode[] {
  if (!isDay(start)) return ["day"];
  const day = dayOf(start);
  const last = lastDayOf(start);
  const out: MonthMode[] = ["day"];
  if (Math.ceil(day / 7) <= 4) out.push("nth");
  if (day > last - 7) out.push("lastWd");
  if (day === last) out.push("lastDay");
  return out;
}

/** 매월 모양 → 규칙 칸 */
export function monthRule(mode: MonthMode, start: string): Pick<RecurRule, "nth" | "nthWd" | "monthDay"> {
  const day = dayOf(start);
  switch (mode) {
    case "nth":
      return { nth: Math.min(Math.ceil(day / 7), 5), nthWd: wdOf(start), monthDay: null };
    case "lastWd":
      return { nth: -1, nthWd: wdOf(start), monthDay: null };
    case "lastDay":
      return { nth: null, nthWd: null, monthDay: -1 };
    default:
      return { nth: null, nthWd: null, monthDay: day };
  }
}

export function monthModeOf(rule: RecurRule): MonthMode {
  if (rule.monthDay === -1) return "lastDay";
  if (rule.nth === -1) return "lastWd";
  if (rule.nth != null) return "nth";
  return "day";
}

export const monthModeLabel = (mode: MonthMode, start: string): string =>
  ruleBaseLabel({ freq: "MONTHLY", interval: 1, byDay: [], count: null, ...monthRule(mode, start) }, start);

/**
 * 반복 일정을 다른 날로 끌어 '이후 모두'로 옮길 때 — 규칙도 그 날에 맞춘다
 *   매주 = 끈 그 요일만 새 요일로(화 · 목의 목요일을 금요일로 → 화 · 금 / 이미 있는 요일로 끌면 합쳐짐 → 화) ·
 *   매월 n번째 요일 = 새 날의 n번째(마지막이면 마지막) · 매월 날 = 새 날(말일은 새 날이 말일일 때만 말일) ·
 *   매일 · 매년 = 그대로(새 시작 날이 기준). 화면은 놓기 전에 바뀔 규칙을 보여 준다(PlanScopeAsk).
 */
export function shiftRule(rule: RecurRule, from: string, to: string): RecurRule {
  const delta = diffDays(from, to);
  if (delta === 0) return rule;
  switch (rule.freq) {
    case "WEEKLY": {
      const fromWd = wdOf(from);
      const toWd = wdOf(to);
      if (fromWd === toWd) return rule;
      const days = new Set(rule.byDay.filter((d) => d !== fromWd));
      days.add(toWd);
      return { ...rule, byDay: [...days].sort((a, b) => a - b) };
    }
    case "MONTHLY": {
      const day = dayOf(to);
      const last = lastDayOf(to);
      if (rule.monthDay != null) return { ...rule, monthDay: rule.monthDay === -1 && day === last ? -1 : day };
      const n = Math.ceil(day / 7);
      return { ...rule, nth: rule.nth === -1 && day > last - 7 ? -1 : n >= 5 ? -1 : n, nthWd: wdOf(to) };
    }
    default:
      return rule;
  }
}
