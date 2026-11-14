/**
 * 📅 캘린더 3-5단계 — 회원 '내 일정 · 기념일' (2026-11-14 대표님 「진행하자」 · 「캘린더 3단계 보고서」 3-5
 *   https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK — 네이버처럼, 153식으로)
 *
 *   서버 = member_calendar_events · set_my_cal_event · remove_my_cal_event · search_my_calendar · set_my_calendar_view ·
 *   get_my_calendar 의 mine · birthday · league · view (DB 20261114101236_calendar_stage35.sql). 읽기 · 계산 · 글 · 검사는 여기 한 곳 —
 *   검사 말은 서버와 같다(시험 memberEvents.test.ts · 서버 시험 test35 와 같은 경우).
 *   · 내 일정 = 이름 30자 · 하루 종일 / 시각 · 여러 날(한 달까지) · 반복(3-2 운영본부와 같은 규칙 — lib/opsRecur) · 알림 2개 ·
 *     색 8 · 장소 60자 · 메모 200자 · '이날은 쉬어요'(그날 약속 알림 · 저녁 체크 알림이 안 가고 복귀 보너스의 놓친 약속으로 세지 않는다 ·
 *     그날 체크에서 체육관을 뺀다 — 휴관일과 같은 곳).
 *   · 기념일 = 매년 · 하루 종일 · 양력(FREQ=YEARLY) 또는 음력(앱이 lib/lunar 로 계산한 양력 날들 occ_dates — 이 파일은 음력 표를
 *     부르지 않는다: 홈 첫 화면 묶음을 키우지 않으려고 계산은 누를 때 받는 내 일정 시트가 한다).
 *   · 감정 설계(CLAUDE.md 「회원 감정 설계 기준」): 일정은 '기대'를 만드는 칸 — 지난 일정 · 안 한 일정을 따로 세거나 말하지 않는다.
 */
import {
  RECUR_COUNT_MAX,
  countUntil,
  fillRule,
  firstOccurrence,
  monthModeOf,
  monthRule,
  occursOnRule,
  parseRrule,
  recurDates,
  ruleBaseLabel,
  ruleLabel,
  ruleText,
  type MonthMode,
  type RecurFreq,
  type RecurRule,
  type RecurSource,
} from "@/lib/opsRecur";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;
const ms = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const addDays = (d: string, n: number) => new Date(ms(d) + n * DAY_MS).toISOString().slice(0, 10);
const isDay = (v: unknown): v is string => typeof v === "string" && YMD.test(v) && !Number.isNaN(ms(v));
const wdOf = (d: string) => new Date(ms(d)).getUTCDay();
const WD = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** "11/15(일)" */
export const mdwShort = (d: string): string => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${WD[wdOf(d)]})`;

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const MY_TITLE_MAX = 30;
export const MY_LOCATION_MAX = 60;
export const MY_MEMO_MAX = 200;
export const MY_REMINDER_MAX = 2;
/** 여러 날 일정 — 시작부터 30일 뒤까지 */
export const MY_SPAN_MAX = 30;
/** 앞으로 잡힌 일정 한도 */
export const MY_FUTURE_MAX = 200;
/** 날짜 범위 — 두 달 전부터 1년(400일) 안 */
export const MY_PAST_DAYS = 62;
export const MY_AHEAD_DAYS = 400;

export type MyEventKind = "plan" | "anniv";
export type MyScope = "one" | "following" | "all";

export const MY_COLORS = [
  { key: "tomato", label: "토마토", hex: "#D50000" },
  { key: "tangerine", label: "귤", hex: "#F4511E" },
  { key: "banana", label: "바나나", hex: "#F6BF26" },
  { key: "basil", label: "바질", hex: "#0B8043" },
  { key: "peacock", label: "공작", hex: "#039BE5" },
  { key: "blueberry", label: "블루베리", hex: "#3F51B5" },
  { key: "grape", label: "포도", hex: "#8E24AA" },
  { key: "graphite", label: "흑연", hex: "#616161" },
] as const;
export type MyEventColor = (typeof MY_COLORS)[number]["key"];
const COLOR_KEYS = new Set<string>(MY_COLORS.map((c) => c.key));
/** 색을 안 고르면 — 일정 = 블루베리 · 기념일 = 귤 */
export const myEventHex = (e: { color: string | null; kind: MyEventKind }): string =>
  MY_COLORS.find((c) => c.key === e.color)?.hex ?? (e.kind === "anniv" ? "#F4511E" : "#3F51B5");

/** 알림 — 하루 종일 · 기념일 = 그날 · 전날 · 일주일 전 아침 9시 / 시각 일정 = 시작 n분 전 */
export const ALLDAY_REMINDERS = [0, 1440, 10080] as const;
export const TIMED_REMINDERS = [0, 10, 30, 60, 120, 1440] as const;
export function reminderLabel(min: number, allDay: boolean): string {
  if (allDay) return min === 0 ? "그날 아침 9시" : min === 1440 ? "전날 아침 9시" : min === 10080 ? "일주일 전 아침 9시" : `${min}분 전`;
  if (min === 0) return "시작할 때";
  if (min === 60) return "1시간 전";
  if (min === 120) return "2시간 전";
  if (min === 1440) return "하루 전";
  return `${min}분 전`;
}

// ───────────────────────── 서버 값 ─────────────────────────
export interface MyLunar {
  m: number;
  d: number;
  leap: boolean;
}

export interface MyEvent {
  id: string;
  kind: MyEventKind;
  title: string;
  startOn: string;
  endOn: string;
  allDay: boolean;
  /** "HH:MM" · 하루 종일이면 null */
  startTime: string | null;
  endTime: string | null;
  rrule: string | null;
  untilOn: string | null;
  skipDates: string[];
  lunar: MyLunar | null;
  /** 음력 기념일 — 앱이 계산해 둔 양력 날들 */
  occDates: string[];
  reminders: number[];
  color: MyEventColor | null;
  location: string | null;
  memo: string | null;
  /** 이날은 쉬어요 */
  rest: boolean;
  seriesId: string | null;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? Math.trunc(x) : null;
};
const days = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.map((x) => str(x)?.slice(0, 10)).filter(isDay))].sort() : []);
const hm = (v: unknown): string | null => {
  const s = str(v)?.slice(0, 5) ?? null;
  return s && HM.test(s) ? s : null;
};

export function normalizeMyEvent(raw: unknown): MyEvent | null {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  const startOn = str(r?.start_on)?.slice(0, 10) ?? null;
  if (!r || !id || !title || !isDay(startOn)) return null;
  const endRaw = str(r.end_on)?.slice(0, 10) ?? null;
  const lunarRaw = obj(r.lunar);
  const lm = int(lunarRaw?.m);
  const ld = int(lunarRaw?.d);
  const st = hm(r.start_time);
  const et = hm(r.end_time);
  const timed = r.all_day === false && !!st && !!et;
  const color = str(r.color);
  return {
    id,
    kind: r.kind === "anniv" ? "anniv" : "plan",
    title,
    startOn,
    endOn: isDay(endRaw) && endRaw >= startOn ? endRaw : startOn,
    allDay: !timed,
    startTime: timed ? st : null,
    endTime: timed ? et : null,
    rrule: str(r.rrule),
    untilOn: isDay(str(r.until_on)?.slice(0, 10)) ? (str(r.until_on) as string).slice(0, 10) : null,
    skipDates: days(r.skip_dates),
    lunar: lm != null && ld != null && lm >= 1 && lm <= 12 && ld >= 1 && ld <= 30 ? { m: lm, d: ld, leap: lunarRaw?.leap === true } : null,
    occDates: days(r.occ_dates),
    reminders: Array.isArray(r.reminders)
      ? [...new Set(r.reminders.map(int).filter((x): x is number => x != null && x >= 0))].sort((a, b) => a - b)
      : [],
    color: color && COLOR_KEYS.has(color) ? (color as MyEventColor) : null,
    location: str(r.location),
    memo: str(r.memo),
    rest: r.rest === true && r.kind !== "anniv",
    seriesId: str(r.series_id),
  };
}

export const normalizeMyEvents = (raw: unknown): MyEvent[] =>
  (Array.isArray(raw) ? raw : []).map(normalizeMyEvent).filter((x): x is MyEvent => !!x);

// ───────────────────────── 펼치기 ─────────────────────────
const recurSource = (e: MyEvent): RecurSource => ({
  start_on: e.startOn,
  end_on: e.endOn,
  rrule: e.rrule,
  repeat_weekdays: [],
  until_on: e.untilOn,
  skip_dates: e.skipDates,
});

/** 그날 이 일정이 있나 — 서버 _my_cal_on 과 같은 식(음력 = occ_dates · 한 번 = 시작 ~ 끝 · 반복 = 3-2 규칙) */
export function myEventOn(e: MyEvent, day: string): boolean {
  if (!isDay(day)) return false;
  if (e.occDates.length > 0) return e.occDates.includes(day) && !e.skipDates.includes(day);
  return occursOnRule(recurSource(e), day);
}

export const isRepeating = (e: MyEvent): boolean => !!e.rrule || e.occDates.length > 0;

/** from ~ to 안의 날들 (오름차순) */
export function myEventDates(e: MyEvent, from: string, to: string): string[] {
  if (e.occDates.length > 0) return e.occDates.filter((d) => d >= from && d <= to && !e.skipDates.includes(d));
  return recurDates(recurSource(e), from, to);
}

/** 그날의 내 일정 — 하루 종일 먼저, 그다음 시각 순 */
export function myEventsOn(events: readonly MyEvent[], day: string): MyEvent[] {
  return events
    .filter((e) => myEventOn(e, day))
    .sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title));
}

/** '이날은 쉬어요' 날들 — 보이는 날짜 안 (서버 _cal_rest_on 과 같은 식: 일정만 · 기념일은 아님) */
export function restDaySet(events: readonly MyEvent[], visible: readonly string[]): Set<string> {
  const out = new Set<string>();
  const rest = events.filter((e) => e.rest && e.kind === "plan");
  if (rest.length === 0) return out;
  for (const d of visible) if (rest.some((e) => myEventOn(e, d))) out.add(d);
  return out;
}

// ───────────────────────── 글 ─────────────────────────
/** "하루 종일" · "19:00~21:30" */
export const myTimeLabel = (e: Pick<MyEvent, "allDay" | "startTime" | "endTime">): string =>
  e.allDay || !e.startTime || !e.endTime ? "하루 종일" : `${e.startTime}~${e.endTime}`;

/** "음력 3월 15일" · "음력 윤6월 1일" (lib/lunar lunarLabel 과 같은 글 — 음력 표를 부르지 않으려고 여기도) */
export const lunarText = (l: MyLunar): string => `음력 ${l.leap ? "윤" : ""}${l.m}월 ${l.d}일`;

/** 반복 한 줄 — "매주 월 · 수 · 12월 31일까지" · "매년 5월 20일" · "음력 3월 15일 · 매년" · 한 번이면 null */
export function myRepeatLabel(e: MyEvent): string | null {
  if (e.kind === "anniv") return e.lunar ? `${lunarText(e.lunar)} · 매년` : `매년 ${Number(e.startOn.slice(5, 7))}월 ${Number(e.startOn.slice(8, 10))}일`;
  const parsed = e.rrule ? parseRrule(e.rrule) : null;
  if (!parsed) return null;
  const rule = fillRule(parsed.rule, e.startOn);
  return ruleLabel(rule, e.startOn, rule.count != null ? null : e.untilOn);
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 여러 날 일정 — "11/15 ~ 11/17" · 하루면 null */
export const mySpanLabel = (e: Pick<MyEvent, "startOn" | "endOn" | "rrule" | "occDates">): string | null =>
  !e.rrule && e.occDates.length === 0 && e.endOn > e.startOn ? `${md(e.startOn)} ~ ${md(e.endOn)}` : null;

/** 그날 카드 · 목록 한 줄의 작은 글 — "19:00~21:30 · 강남역 · 매주 월" · 기념일은 "매년 12월 5일" · "음력 10월 8일 · 매년"
 *  (쉬어요는 화면이 따로 이름표로) */
export function mySubLine(e: MyEvent): string {
  if (e.kind === "anniv") return myRepeatLabel(e) ?? "";
  return [mySpanLabel(e) ?? myTimeLabel(e), e.location, myRepeatShort(e)].filter((x): x is string => !!x).join(" · ");
}

/** 반복 짧게 — "매주 월 · 수" (끝 날 없이) */
export function myRepeatShort(e: MyEvent): string | null {
  const parsed = e.rrule ? parseRrule(e.rrule) : null;
  return parsed ? ruleBaseLabel(fillRule(parsed.rule, e.startOn), e.startOn) : null;
}

export const REST_LABEL = "이날은 쉬어요";

// ───────────────────────── 넣기 · 고치기 ─────────────────────────
export type EndMode = "never" | "until" | "count";

export interface MyEventDraft {
  id: string | null;
  kind: MyEventKind;
  title: string;
  /** 일정 = 시작 날 · 양력 기념일 = 그 날(처음 날이어도 된다 — 매년) */
  startOn: string;
  /** 여러 날 일정의 끝 날 (같거나 비우면 하루) */
  endOn: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  repeat: boolean;
  freq: RecurFreq;
  interval: number;
  weekdays: number[];
  monthMode: MonthMode;
  endMode: EndMode;
  untilOn: string;
  count: number;
  /** 기념일 — 양력 · 음력 */
  calendar: "solar" | "lunar";
  lunarM: number;
  lunarD: number;
  lunarLeap: boolean;
  reminders: number[];
  color: MyEventColor | null;
  location: string;
  memo: string;
  rest: boolean;
}

/** 새 일정 — 고른 날 · 시각 일정이면 30분 전 알림 · 기념일이면 그날 아침 9시 */
export function emptyMyEventDraft(day: string, kind: MyEventKind = "plan"): MyEventDraft {
  return {
    id: null,
    kind,
    title: "",
    startOn: day,
    endOn: day,
    allDay: true,
    startTime: "19:00",
    endTime: "20:00",
    repeat: false,
    freq: "WEEKLY",
    interval: 1,
    weekdays: isDay(day) ? [wdOf(day)] : [],
    monthMode: "day",
    endMode: "never",
    untilOn: "",
    count: 10,
    calendar: "solar",
    lunarM: 1,
    lunarD: 1,
    lunarLeap: false,
    reminders: kind === "anniv" ? [0] : [],
    color: null,
    location: "",
    memo: "",
    rest: false,
  };
}

export function draftFromMyEvent(e: MyEvent): MyEventDraft {
  const parsed = e.kind === "plan" && e.rrule ? parseRrule(e.rrule) : null;
  const rule = parsed ? fillRule(parsed.rule, e.startOn) : null;
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    startOn: e.startOn,
    endOn: e.endOn,
    allDay: e.kind === "anniv" ? true : e.allDay,
    startTime: e.startTime ?? "19:00",
    endTime: e.endTime ?? "20:00",
    repeat: !!rule,
    freq: rule?.freq ?? "WEEKLY",
    interval: rule?.interval ?? 1,
    weekdays: rule?.freq === "WEEKLY" ? [...rule.byDay] : [wdOf(e.startOn)],
    monthMode: rule?.freq === "MONTHLY" ? monthModeOf(rule) : "day",
    endMode: rule?.count != null ? "count" : e.untilOn ? "until" : "never",
    untilOn: rule?.count != null ? "" : (e.untilOn ?? ""),
    count: rule?.count ?? 10,
    calendar: e.lunar ? "lunar" : "solar",
    lunarM: e.lunar?.m ?? 1,
    lunarD: e.lunar?.d ?? 1,
    lunarLeap: !!e.lunar?.leap,
    reminders: [...e.reminders],
    color: e.color,
    location: e.location ?? "",
    memo: e.memo ?? "",
    rest: e.rest,
  };
}

/** 반복 일정을 그날에서 고칠 때 — 이 날만 = 그날 · 한 번 / 이후 모두 = 그날부터(횟수는 끝나는 날로) / 전체 = 원래 시작 (3-2 와 같은 결) */
export function draftForScope(d: MyEventDraft, e: MyEvent, scope: MyScope, occurrence: string | null): MyEventDraft {
  const base = draftFromMyEvent(e);
  const keep = { ...d, repeat: base.repeat, freq: base.freq, interval: base.interval, weekdays: base.weekdays, monthMode: base.monthMode };
  if (scope === "one" && occurrence) return { ...keep, startOn: occurrence, endOn: occurrence };
  if (scope === "following" && occurrence)
    return { ...keep, startOn: occurrence, endOn: occurrence, endMode: base.endMode === "count" ? (e.untilOn ? "until" : "never") : base.endMode, untilOn: e.untilOn ?? "", count: base.count };
  return { ...keep, startOn: e.startOn, endOn: e.endOn, endMode: base.endMode, untilOn: base.untilOn, count: base.count };
}

/** 시트의 반복 → 규칙 (한 번 · 기념일이면 null) */
export function myDraftRule(d: MyEventDraft): RecurRule | null {
  if (d.kind !== "plan" || !d.repeat) return null;
  const m = d.freq === "MONTHLY" ? monthRule(d.monthMode, d.startOn) : { nth: null, nthWd: null, monthDay: null };
  return {
    freq: d.freq,
    interval: d.interval,
    byDay: d.freq === "WEEKLY" ? [...new Set(d.weekdays)].sort((a, b) => a - b) : [],
    ...m,
    count: d.endMode === "count" ? d.count : null,
  };
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const len = (s: string) => [...s].length;

export interface MyDraftOptions {
  scope?: MyScope;
  /** 반복 일정을 그날에서 열었으면 그날 */
  occurrence?: string | null;
  /** 음력 기념일 — 시트가 lib/lunar 로 계산한 양력 날들 */
  occDates?: readonly string[];
}

const isOneOff = (d: MyEventDraft, o: MyDraftOptions) => !!d.id && o.scope === "one" && !!o.occurrence;

/** 서버(set_my_cal_event)와 같은 검사 — 통과하면 null */
export function myEventDraftError(d: MyEventDraft, today: string, o: MyDraftOptions = {}): string | null {
  const title = tidy(d.title);
  if (!title) return "이름을 적어 주세요";
  if (len(title) > MY_TITLE_MAX) return "이름은 30자 안으로 적어 주세요";
  const lunar = d.kind === "anniv" && d.calendar === "lunar";
  if (!lunar && !isDay(d.startOn)) return "날짜를 골라 주세요";
  if (len(tidy(d.location)) > MY_LOCATION_MAX) return "장소는 60자 안으로 적어 주세요";
  if (len(d.memo.trim()) > MY_MEMO_MAX) return "메모는 200자 안으로 적어 주세요";
  if (d.color && !COLOR_KEYS.has(d.color)) return "색을 다시 골라 주세요";
  if (d.kind === "anniv") {
    if (lunar) {
      const okMd = Number.isInteger(d.lunarM) && d.lunarM >= 1 && d.lunarM <= 12 && Number.isInteger(d.lunarD) && d.lunarD >= 1 && d.lunarD <= 30;
      const occ = o.occDates ?? [];
      if (!okMd || occ.length === 0 || occ.length > 12) return "음력 날짜를 다시 골라 주세요";
    } else if (d.startOn < "1900-01-01" || d.startOn > addDays(today, MY_AHEAD_DAYS)) {
      return "날짜를 다시 골라 주세요";
    }
  } else {
    if (d.startOn < addDays(today, -MY_PAST_DAYS) || d.startOn > addDays(today, MY_AHEAD_DAYS)) return "날짜는 두 달 전부터 1년 안으로 골라 주세요";
    const rule = isOneOff(d, o) ? null : myDraftRule(d);
    if (rule) {
      if (rule.freq === "WEEKLY" && rule.byDay.length === 0) return "반복할 요일을 골라 주세요";
      const first = firstOccurrence(rule, d.startOn);
      if (!first) return "이 반복으로는 잡히는 날이 없어요";
      if (d.endMode === "count") {
        if (!Number.isInteger(d.count) || d.count < 1 || d.count > RECUR_COUNT_MAX) return `횟수는 1 ~ ${RECUR_COUNT_MAX}번이에요`;
        if (!countUntil(rule, first)) return "반복 횟수를 줄여 주세요 — 10년 안에서 반복해요";
      }
      if (d.endMode === "until") {
        if (!isDay(d.untilOn)) return "반복이 끝나는 날을 골라 주세요";
        if (d.untilOn < first) return "반복이 끝나는 날이 시작보다 빨라요";
      }
    } else {
      const end = isDay(d.endOn) ? d.endOn : d.startOn;
      if (end < d.startOn) return "끝나는 날이 시작보다 빨라요";
      if (end > addDays(d.startOn, MY_SPAN_MAX)) return "여러 날 일정은 한 달까지예요";
    }
    if (!d.allDay && (!HM.test(d.startTime) || !HM.test(d.endTime) || d.endTime <= d.startTime)) return "시작 · 끝 시각을 확인해 주세요";
  }
  const rem = [...new Set(d.reminders)];
  if (rem.length > MY_REMINDER_MAX) return "알림은 2개까지예요";
  const allDay = d.kind === "anniv" || d.allDay;
  const allowed: readonly number[] = allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;
  if (rem.some((m) => !allowed.includes(m))) return "알림을 다시 골라 주세요";
  return null;
}

/** set_my_cal_event 에 보낼 값 (p jsonb) */
export function myEventPayload(d: MyEventDraft, o: MyDraftOptions = {}): Record<string, unknown> {
  const scope: MyScope = d.id && o.occurrence && o.scope && o.scope !== "all" && d.kind === "plan" ? o.scope : "all";
  const base: Record<string, unknown> = {
    ...(d.id ? { id: d.id } : {}),
    ...(d.id ? (scope !== "all" ? { scope, only_date: o.occurrence } : { scope: "all" }) : {}),
    kind: d.kind,
    title: tidy(d.title),
    color: d.color,
    location: tidy(d.location),
    memo: d.memo.trim(),
  };
  if (d.kind === "anniv") {
    const reminders = [...new Set(d.reminders)].sort((a, b) => a - b);
    if (d.calendar === "lunar") {
      const occ = [...(o.occDates ?? [])].sort();
      return { ...base, start_on: occ[0] ?? d.startOn, all_day: true, lunar: { m: d.lunarM, d: d.lunarD, leap: d.lunarLeap }, occ_dates: occ, reminders, rest: false };
    }
    return { ...base, start_on: d.startOn, all_day: true, reminders, rest: false };
  }
  const rule = scope === "one" ? null : myDraftRule(d);
  const end = !rule && isDay(d.endOn) && d.endOn > d.startOn ? d.endOn : d.startOn;
  return {
    ...base,
    start_on: d.startOn,
    end_on: end,
    all_day: d.allDay,
    start_time: d.allDay ? null : d.startTime,
    end_time: d.allDay ? null : d.endTime,
    rrule: rule ? ruleText(rule) : null,
    until_on: rule && d.endMode === "until" ? d.untilOn || null : null,
    reminders: [...new Set(d.reminders)].sort((a, b) => a - b),
    rest: d.rest,
  };
}

/** 시트 미리 보기 — 반복이면 앞으로 잡히는 날 n개 */
export function myDraftPreview(d: MyEventDraft, n = 3): string[] {
  const rule = myDraftRule(d);
  if (!rule) return [];
  const first = firstOccurrence(rule, d.startOn);
  if (!first) return [];
  const until = d.endMode === "until" ? d.untilOn || null : d.endMode === "count" ? countUntil(rule, first) : null;
  const src: RecurSource = { start_on: first, end_on: first, rrule: ruleText(rule), repeat_weekdays: [], until_on: until, skip_dates: [] };
  return recurDates(src, first, addDays(first, 3653)).slice(0, n);
}

// ───────────────────────── 검색 ─────────────────────────
export const SEARCH_MAX = 30;

export interface CalSearchLine {
  id: string;
  day: string;
  content: string;
  mood: string | null;
  photoUrl: string | null;
}

export interface CalSearch {
  on: boolean;
  q: string;
  events: MyEvent[];
  lines: CalSearchLine[];
}

export const SEARCH_OFF: CalSearch = { on: false, q: "", events: [], lines: [] };

export function normalizeCalSearch(raw: unknown): CalSearch {
  const r = obj(raw);
  if (!r || r.on !== true) return SEARCH_OFF;
  const lines: CalSearchLine[] = [];
  for (const x of Array.isArray(r.lines) ? r.lines : []) {
    const l = obj(x);
    const id = str(l?.id);
    const day = str(l?.day)?.slice(0, 10) ?? null;
    const content = str(l?.content);
    if (!l || !id || !isDay(day) || !content) continue;
    lines.push({ id, day, content, mood: str(l.mood), photoUrl: str(l.photo_url) });
  }
  return { on: true, q: str(r.q) ?? "", events: normalizeMyEvents(r.events), lines };
}

/** 서버(search_my_calendar)와 같은 검사 */
export function searchError(q: string): string | null {
  const t = tidy(q);
  if (!t) return "찾을 말을 적어 주세요";
  if (len(t) > SEARCH_MAX) return "찾을 말은 30자 안으로 적어 주세요";
  return null;
}

/** 찾은 일정의 날 — 오늘부터 다음 날, 없으면 마지막으로 있던 날 (검색 결과 한 줄 · 누르면 그 달로) */
export function myEventNextDay(e: MyEvent, today: string): string {
  const ahead = myEventDates(e, today, addDays(today, 400))[0];
  if (ahead) return ahead;
  const back = myEventDates(e, addDays(today, -400), addDays(today, -1));
  return back[back.length - 1] ?? e.startOn;
}

// ───────────────────────── 보기 — 캘린더 켜고 끄기 · 리그 테마 ─────────────────────────
export type CalLayer = "mine" | "153" | "holiday" | "marks";
export const CAL_LAYERS: ReadonlyArray<{ key: CalLayer; label: string; hint: string }> = [
  { key: "mine", label: "내 일정 · 기념일", hint: "내가 넣은 일정 · 생일" },
  { key: "153", label: "153 일정 · 같이 운동", hint: "휴관 · 이벤트 · 대회 · 저요 한 모집" },
  { key: "holiday", label: "공휴일", hint: "빨간 날 · 이름" },
  { key: "marks", label: "운동 표시", hint: "금색 별 · 기분 스티커 · 그날 한 일 · 코치 한마디" },
];
const LAYER_KEYS = new Set<string>(CAL_LAYERS.map((l) => l.key));

export interface CalView {
  off: CalLayer[];
  theme: "league" | null;
}

export const CAL_VIEW_DEFAULT: CalView = { off: [], theme: null };

export function normalizeCalView(raw: unknown): CalView {
  const r = obj(raw);
  if (!r) return CAL_VIEW_DEFAULT;
  const off = Array.isArray(r.cals_off) ? [...new Set(r.cals_off.map(str).filter((x): x is CalLayer => !!x && LAYER_KEYS.has(x)))].sort() : [];
  return { off, theme: r.theme === "league" ? "league" : null };
}

export const layerOn = (view: CalView, key: CalLayer): boolean => !view.off.includes(key);

export const toggleLayer = (view: CalView, key: CalLayer): CalView => ({
  ...view,
  off: layerOn(view, key) ? [...view.off, key].sort() : view.off.filter((k) => k !== key),
});

/** 리그 테마 도장 색 — 흰 글씨가 4.5:1 넘게 읽히는 색 (pbBoard 리그 색을 조금 짙게) */
export const LEAGUE_STAMP: Record<string, { hex: string; label: string }> = {
  white: { hex: "#6B7780", label: "화이트" },
  blue: { hex: "#2F6FB8", label: "블루" },
  red: { hex: "#C8461F", label: "레드" },
  black: { hex: "#2B3438", label: "블랙" },
};

export const leagueStampOf = (league: string | null | undefined, view: CalView): { hex: string; label: string } | null =>
  view.theme === "league" && league ? (LEAGUE_STAMP[league] ?? null) : null;

// ───────────────────────── 내 생일 도장 ─────────────────────────
/** 생일(MM-DD)이 그날인가 — 2/29 생일은 평년엔 2/28 */
export function birthdayOn(mmdd: string | null | undefined, day: string): boolean {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd) || !isDay(day)) return false;
  if (mmdd === "02-29") {
    const y = Number(day.slice(0, 4));
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return day.slice(5) === (leap ? "02-29" : "02-28");
  }
  return day.slice(5) === mmdd;
}

export const BIRTHDAY_TODAY = "생일 축하해요";
export const BIRTHDAY_LINE = "내 생일";
