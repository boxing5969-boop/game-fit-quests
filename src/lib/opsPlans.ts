/**
 * 153운영본부 · 「일정」 탭 — 팀원(코치님)이 스스로 넣는 일정 · 대표님 · 지점장 팀 일정판
 *   (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리할 수 있는 기능 · 내가 팀원들의 스케줄을 한눈에")
 *
 *   서버(ops_plans_week · DB 20261102135002_ops_team_plans.sql)는 자료만 준다 — 반복 펼치기 · 「근무」 탭 시간표 겹치기 ·
 *   하루 정리 · 화면 글은 이 파일 한 곳.
 *   · 일정 = 수업 · PT · 업무 · 외부 · 휴무 · 개인. 매주 반복(요일 · 언제까지 · 이 날만 빼기) · 하루 종일 · 여러 날(한 번 하는 일정)
 *   · 「근무」 탭 시간표(ops_shift_rules)는 '근무 시간'으로, 승인된 쉰 날은 그 지점 시간표 대신 '쉰 날'로 함께 그린다
 *   · 일정은 근무 시간 · 급여와 따로다 — 쉰 날 인정 · 대타 · 연장은 「근무」 탭
 */
import { OPS_WEEKDAY, hmToMin, weekdayOf } from "@/lib/opsWork";
import {
  RECUR_COUNT_MAX,
  countUntil,
  firstOccurrence,
  isRecurring,
  monthModeOf,
  monthModes,
  monthRule,
  occursOnRule,
  recurDates,
  ruleLabel,
  ruleOf,
  ruleText,
  shiftRule,
  type MonthMode,
  type RecurFreq,
  type RecurRule,
} from "@/lib/opsRecur";

export type PlanKind = "class" | "pt" | "work" | "out" | "off" | "personal";

/** 넣기 화면의 순서 */
export const PLAN_KINDS: readonly PlanKind[] = ["class", "pt", "work", "out", "off", "personal"];

export const PLAN_KIND_META: Record<PlanKind, { label: string; hint: string; dot: string; chip: string }> = {
  class: { label: "수업", hint: "예) 저녁반 수업", dot: "bg-primary", chip: "bg-primary/10 text-primary" },
  pt: {
    label: "PT",
    hint: "예) PT 회원 이름",
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  },
  // '근무 시간'(「근무」 탭 시간표)과 헷갈리지 않게 '업무' — 상담 · 오픈 · 마감처럼 시간표 밖 일
  work: {
    label: "업무",
    hint: "예) 상담 · 오픈 · 마감",
    dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  },
  out: {
    label: "외부",
    hint: "예) 대회 인솔 · 교육 · 촬영",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  },
  off: {
    label: "휴무",
    hint: "예) 연차 · 가족 행사",
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  },
  personal: {
    label: "개인",
    hint: "예) 병원 · 학교",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200",
  },
};

/** 「근무」 탭 시간표 · 쉰 날 */
export const SHIFT_META = { label: "근무 시간", dot: "bg-foreground/30", chip: "bg-secondary text-foreground" } as const;
export const SHIFT_OFF_META = { label: "쉰 날", dot: PLAN_KIND_META.off.dot, chip: PLAN_KIND_META.off.chip } as const;

export interface PlanMember {
  /** 앱 계정이면 user_id, 앱 계정 없는 근무자 카드는 'staff:<id>' */
  key: string;
  user_id: string | null;
  name: string;
  title: string;
  me: boolean;
  /** 앱 계정이 없는 근무자 — 시간표만 (관리자 화면) */
  no_app?: boolean;
}

export interface OpsPlan {
  id: string;
  user_id: string;
  branch: string;
  kind: PlanKind;
  /** 남의 '시간만 보이기' 개인 일정이면 null */
  title: string | null;
  memo: string | null;
  masked: boolean;
  private: boolean;
  start_on: string;
  end_on: string;
  /** 0 = 일요일 … 6 = 토요일 · 비면 반복 없음 */
  repeat_weekdays: number[];
  until_on: string | null;
  skip_dates: string[];
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  mine: boolean;
  updated_at?: string;
  /** 3-2 — 반복 규칙(비면 repeat_weekdays 로 매주 · 둘 다 비면 한 번) · 색 · 장소 · 알림(내 것만) · 묶음 */
  rrule?: string | null;
  color?: string | null;
  location?: string | null;
  reminders?: number[];
  series_id?: string | null;
}

export interface PlanBirthday {
  date: string;
  user_id: string;
  name: string;
}

export interface PlanShift {
  key: string;
  branch: string;
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_to: string | null;
  staff_start: string | null;
  staff_end: string | null;
}

export interface PlanOff {
  key: string;
  branch: string;
  date: string;
}

export interface PlanRecent {
  id: string;
  user_id: string;
  branch: string;
  kind: PlanKind;
  title: string | null;
  action: "new" | "edit" | "removed";
  at: string;
  start_on: string;
  end_on: string;
  repeat_weekdays: number[];
  rrule?: string | null;
  until_on?: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface PlansWeek {
  branch: string;
  branches: Array<{ branch: string; manage: boolean; mine: boolean }>;
  /** 팀 전체를 보는가 — 대표님 · 그 지점 관리자 */
  manage: boolean;
  hq: boolean;
  me: string;
  /** 그 주 월요일 */
  from: string;
  to: string;
  today: string;
  now_hm: string;
  members: PlanMember[];
  plans: OpsPlan[];
  shifts: PlanShift[];
  offs: PlanOff[];
  recent: PlanRecent[];
  /** 3-2 — 아침 8시 브리핑 (없으면 켬) */
  prefs?: { brief_on: boolean };
  /** 3-2 — 그 지점 회원 생일(「오늘 만날 회원」과 같은 범위 · 62일 넘는 범위는 비어 있음) */
  birthdays?: PlanBirthday[];
}

// ───────────────────────── 날짜 ─────────────────────────
export const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** 그 주 월요일 (일요일은 앞 주) */
export const mondayOf = (date: string): string => addDays(date, -((weekdayOf(date) + 6) % 7));

export const weekDates = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

const md = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return { m, d };
};

/** "11월 3일 (화)" */
export const planDay = (date: string): string => {
  const { m, d } = md(date);
  return `${m}월 ${d}일 (${OPS_WEEKDAY[weekdayOf(date)]})`;
};

/** "11월 2일 – 8일" · 달이 바뀌면 "10월 27일 – 11월 2일" */
export const weekRangeLabel = (monday: string): string => {
  const a = md(monday);
  const b = md(addDays(monday, 6));
  return a.m === b.m ? `${a.m}월 ${a.d}일 – ${b.d}일` : `${a.m}월 ${a.d}일 – ${b.m}월 ${b.d}일`;
};

/** 한 번 하는 일정의 날짜 — 하루면 "11월 3일 (화)", 여러 날이면 "11월 10일 – 14일" */
export const spanLabel = (start: string, end: string): string => {
  if (start === end) return planDay(start);
  const a = md(start);
  const b = md(end);
  return a.m === b.m ? `${a.m}월 ${a.d}일 – ${b.d}일` : `${a.m}월 ${a.d}일 – ${b.m}월 ${b.d}일`;
};

/** 월요일부터: 월 화 수 목 금 토 일 */
export const WEEK_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

/** "매주 화 · 목" · "매주 평일" · "매일" (+ " · 12월 31일까지") */
export const repeatLabel = (days: readonly number[], until?: string | null): string => {
  const set = new Set(days);
  let base: string;
  if (set.size === 7) base = "매일";
  else if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) base = "매주 평일";
  else base = `매주 ${WEEK_MON_FIRST.filter((d) => set.has(d)).map((d) => OPS_WEEKDAY[d]).join(" · ")}`;
  if (until) {
    const { m, d } = md(until);
    base += ` · ${m}월 ${d}일까지`;
  }
  return base;
};

export const timeLabel = (allDay: boolean, start: string | null, end: string | null): string =>
  allDay || !start || !end ? "하루 종일" : `${start}~${end}`;

// ───────────────────────── 일정 펼치기 (3-2 — 반복은 src/lib/opsRecur.ts 한 곳) ─────────────────────────
/** 반복 일정인가 — rrule 이 있거나 예전 매주 요일이 있으면 */
export const isRepeat = (p: Pick<OpsPlan, "repeat_weekdays"> & { rrule?: string | null }): boolean => isRecurring(p);

/** 그날 이 일정이 있나 (매일 · 매주 · 매월 · 매년 · 간격 · 횟수 · 끝 · 빼는 날) */
export const occursOn = (
  p: Pick<OpsPlan, "start_on" | "end_on" | "repeat_weekdays" | "until_on" | "skip_dates"> & { rrule?: string | null },
  date: string,
): boolean => occursOnRule(p, date);

/** 반복 한 줄 — "매월 셋째 화요일 · 10번" · "2주마다 월 · 12월 31일까지" (예전 매주는 "매주 화 · 목") */
export const planRepeatLabel = (p: Pick<OpsPlan, "start_on" | "repeat_weekdays" | "until_on"> & { rrule?: string | null }): string => {
  const rule = ruleOf(p);
  return rule ? ruleLabel(rule, p.start_on, p.until_on) : "";
};

/** 일정이 어떻게 잡혔는지 한 줄 — "매주 화 · 목" · "11월 10일 – 14일" */
export const planWhenLabel = (p: Pick<OpsPlan, "start_on" | "end_on" | "repeat_weekdays" | "until_on"> & { rrule?: string | null }): string =>
  isRepeat(p) ? planRepeatLabel(p) : spanLabel(p.start_on, p.end_on);

export type DayItem =
  | {
      type: "plan";
      id: string;
      date: string;
      kind: PlanKind;
      allDay: boolean;
      start: string | null;
      end: string | null;
      branch: string;
      plan: OpsPlan;
    }
  | { type: "shift"; id: string; date: string; allDay: false; start: string; end: string; branch: string }
  | { type: "shiftOff"; id: string; date: string; allDay: true; start: null; end: null; branch: string };

/** 그날 그 사람에게 걸리는 「근무」 탭 시간표 */
export const shiftsOn = (shifts: readonly PlanShift[], key: string, date: string): PlanShift[] => {
  const wd = weekdayOf(date);
  return shifts.filter(
    (s) =>
      s.key === key &&
      s.weekday === wd &&
      s.valid_from <= date &&
      (!s.valid_to || s.valid_to >= date) &&
      (!s.staff_start || s.staff_start <= date) &&
      (!s.staff_end || s.staff_end >= date),
  );
};

const isOffItem = (i: DayItem) => i.type === "shiftOff" || (i.type === "plan" && i.kind === "off");

/** 하루 종일(휴무 먼저) → 시작 시각 → 근무 시간 먼저 */
const compareItems = (a: DayItem, b: DayItem): number => {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay && b.allDay && isOffItem(a) !== isOffItem(b)) return isOffItem(a) ? -1 : 1;
  const sa = a.allDay ? 0 : hmToMin(a.start ?? "00:00");
  const sb = b.allDay ? 0 : hmToMin(b.start ?? "00:00");
  if (sa !== sb) return sa - sb;
  if (a.type !== b.type) return a.type === "plan" ? 1 : -1;
  return a.id.localeCompare(b.id);
};

/** 한 사람의 하루 — 시간표(승인된 쉰 날이면 그 지점 시간표 대신 '쉰 날') + 일정 */
export const dayItems = (
  week: Pick<PlansWeek, "plans" | "shifts" | "offs">,
  member: Pick<PlanMember, "key" | "user_id">,
  date: string,
): DayItem[] => {
  const items: DayItem[] = [];
  const offBranches = new Set(week.offs.filter((o) => o.key === member.key && o.date === date).map((o) => o.branch));
  for (const b of offBranches) items.push({ type: "shiftOff", id: `off:${b}:${date}`, date, allDay: true, start: null, end: null, branch: b });
  for (const s of shiftsOn(week.shifts, member.key, date)) {
    if (offBranches.has(s.branch)) continue;
    items.push({ type: "shift", id: `shift:${s.branch}:${s.start_time}`, date, allDay: false, start: s.start_time, end: s.end_time, branch: s.branch });
  }
  if (member.user_id) {
    for (const p of week.plans) {
      if (p.user_id !== member.user_id || !occursOn(p, date)) continue;
      items.push({
        type: "plan",
        id: p.id,
        date,
        kind: p.kind,
        allDay: p.all_day,
        start: p.all_day ? null : p.start_time,
        end: p.all_day ? null : p.end_time,
        branch: p.branch,
        plan: p,
      });
    }
  }
  return items.sort(compareItems);
};

export const itemLabel = (i: DayItem): string =>
  i.type === "shift" ? SHIFT_META.label : i.type === "shiftOff" ? SHIFT_OFF_META.label : PLAN_KIND_META[i.kind].label;

export const itemChip = (i: DayItem): string =>
  i.type === "shift" ? SHIFT_META.chip : i.type === "shiftOff" ? SHIFT_OFF_META.chip : PLAN_KIND_META[i.kind].chip;

export const itemDot = (i: DayItem): string =>
  i.type === "shift" ? SHIFT_META.dot : i.type === "shiftOff" ? SHIFT_OFF_META.dot : PLAN_KIND_META[i.kind].dot;

/** 일정판 칸 하나 — 점(막대) 3개까지 + 넘는 수 */
export const cellDots = (items: readonly DayItem[], max = 3): { dots: string[]; more: number } => ({
  dots: items.slice(0, max).map(itemDot),
  more: Math.max(0, items.length - max),
});

export interface DaySummary {
  /** 근무 시간이 있거나 업무 · 수업 · PT 일정이 있고 쉬지 않는 분 */
  working: number;
  off: number;
  out: number;
}

/** 그날 팀 한 줄 — 근무 n · 휴무 n · 외부 n */
export const daySummary = (
  week: Pick<PlansWeek, "plans" | "shifts" | "offs">,
  members: readonly Pick<PlanMember, "key" | "user_id">[],
  date: string,
): DaySummary => {
  const s: DaySummary = { working: 0, off: 0, out: 0 };
  for (const m of members) {
    const items = dayItems(week, m, date);
    const off = items.some(isOffItem);
    if (off) s.off += 1;
    if (items.some((i) => i.type === "plan" && i.kind === "out")) s.out += 1;
    if (!off && items.some((i) => i.type === "shift" || (i.type === "plan" && (i.kind === "work" || i.kind === "class" || i.kind === "pt"))))
      s.working += 1;
  }
  return s;
};

export const summaryLabel = (s: DaySummary): string =>
  [s.working ? `근무 ${s.working}명` : "", s.off ? `휴무 ${s.off}명` : "", s.out ? `외부 ${s.out}명` : ""].filter(Boolean).join(" · ");

// ───────────────────────── 넣기 · 고치기 ─────────────────────────
/** 3-2 — 색 12가지 (비면 종류 색) · 구글 캘린더 이름을 우리말로 + 153 민트 */
export const PLAN_COLORS = [
  { key: "tomato", label: "토마토", hex: "#D50000" },
  { key: "flamingo", label: "플라밍고", hex: "#E67C73" },
  { key: "tangerine", label: "귤", hex: "#F4511E" },
  { key: "banana", label: "바나나", hex: "#F6BF26" },
  { key: "sage", label: "세이지", hex: "#33B679" },
  { key: "basil", label: "바질", hex: "#0B8043" },
  { key: "peacock", label: "공작", hex: "#039BE5" },
  { key: "blueberry", label: "블루베리", hex: "#3F51B5" },
  { key: "lavender", label: "라벤더", hex: "#7986CB" },
  { key: "grape", label: "포도", hex: "#8E24AA" },
  { key: "graphite", label: "흑연", hex: "#616161" },
  { key: "mint", label: "153 민트", hex: "#29C39C" },
] as const;
export type PlanColor = (typeof PLAN_COLORS)[number]["key"];

/** 고른 색의 hex (없거나 모르는 이름이면 null = 종류 색) */
export const planColorHex = (color: string | null | undefined): string | null => PLAN_COLORS.find((c) => c.key === color)?.hex ?? null;

/** 3-2 — 알림 (시각 일정만 · 4개까지) · 코치님 기본 10분 전 (결정 6) */
export const REMINDER_OPTIONS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: "정시" },
  { min: 5, label: "5분 전" },
  { min: 10, label: "10분 전" },
  { min: 15, label: "15분 전" },
  { min: 30, label: "30분 전" },
  { min: 60, label: "1시간 전" },
  { min: 120, label: "2시간 전" },
  { min: 1440, label: "하루 전" },
];
export const REMINDER_DEFAULT: readonly number[] = [10];
export const REMINDER_MAX = 4;
export const reminderLabel = (min: number): string => REMINDER_OPTIONS.find((o) => o.min === min)?.label ?? `${min}분 전`;

/** 반복 고르기 — 간격 칩 (그 밖의 간격은 가져온 일정에서만 — 그대로 둔다) */
export const INTERVAL_CHOICES: Record<RecurFreq, readonly number[]> = { DAILY: [1, 2, 3], WEEKLY: [1, 2, 3, 4], MONTHLY: [1, 2, 3, 6], YEARLY: [1, 2] };
export const intervalLabel = (freq: RecurFreq, n: number): string =>
  freq === "DAILY" ? (n === 1 ? "매일" : `${n}일마다`)
    : freq === "WEEKLY" ? (n === 1 ? "매주" : `${n}주마다`)
      : freq === "MONTHLY" ? (n === 1 ? "매월" : `${n}개월마다`)
        : n === 1 ? "매년" : `${n}년마다`;

export type EndMode = "never" | "until" | "count";
/** 고치기 범위 — 이 일정만 · 이후 모두 · 전체 */
export type PlanScope = "one" | "following" | "all";

export interface PlanDraft {
  id?: string;
  branch: string;
  kind: PlanKind;
  title: string;
  memo: string;
  start_on: string;
  /** 한 번 하는 일정의 끝나는 날 — 비면 하루 */
  end_on: string;
  repeat: boolean;
  freq: RecurFreq;
  interval: number;
  /** 매주 반복 요일 */
  repeat_weekdays: number[];
  /** 매월 반복 모양 (시작 날로 고르는 것 — 13일 · 둘째 금요일 · 마지막 금요일 · 말일) */
  monthMode: MonthMode;
  endMode: EndMode;
  /** 반복이 끝나는 날 (endMode until) */
  until_on: string;
  /** 반복 횟수 (endMode count) */
  count: number;
  all_day: boolean;
  start_time: string;
  end_time: string;
  private: boolean;
  color: string | null;
  location: string;
  reminders: number[];
}

export const PLAN_TITLE_MAX = 40;
export const PLAN_MEMO_MAX = 300;
export const PLAN_LOCATION_MAX = 80;

export const newDraft = (
  branch: string,
  date: string,
  kind: PlanKind = "class",
  time?: { start: string; end: string },
): PlanDraft => ({
  branch,
  kind,
  title: "",
  memo: "",
  start_on: date,
  end_on: "",
  repeat: false,
  freq: "WEEKLY",
  interval: 1,
  repeat_weekdays: [weekdayOf(date)],
  monthMode: "day",
  endMode: "never",
  until_on: "",
  count: 10,
  all_day: kind === "off" && !time,
  start_time: time?.start ?? "19:00",
  end_time: time?.end ?? "20:00",
  private: false,
  color: null,
  location: "",
  reminders: [...REMINDER_DEFAULT],
});

export const draftFromPlan = (p: OpsPlan): PlanDraft => {
  const rule = ruleOf(p);
  return {
    id: p.id,
    branch: p.branch,
    kind: p.kind,
    title: p.title ?? "",
    memo: p.memo ?? "",
    start_on: p.start_on,
    end_on: !rule && p.end_on !== p.start_on ? p.end_on : "",
    repeat: !!rule,
    freq: rule?.freq ?? "WEEKLY",
    interval: rule?.interval ?? 1,
    repeat_weekdays: rule?.freq === "WEEKLY" ? [...rule.byDay] : [weekdayOf(p.start_on)],
    monthMode: rule?.freq === "MONTHLY" ? monthModeOf(rule) : "day",
    endMode: rule?.count != null ? "count" : p.until_on ? "until" : "never",
    until_on: rule?.count != null ? "" : (p.until_on ?? ""),
    count: rule?.count ?? 10,
    all_day: p.all_day,
    start_time: p.start_time ?? "19:00",
    end_time: p.end_time ?? "20:00",
    private: p.private,
    color: p.color ?? null,
    location: p.location ?? "",
    reminders: p.all_day ? [] : [...(p.reminders ?? [])],
  };
};

/** 시트에서 범위를 바꿀 때 — 이 일정만 = 그날 · 한 번 / 이후 모두 = 그날부터(횟수는 끝나는 날로) / 전체 = 원래 시작 */
export const draftForScope = (d: PlanDraft, plan: OpsPlan, scope: PlanScope, occurrence: string | null): PlanDraft => {
  const base = draftFromPlan(plan);
  const keep = { ...d, repeat: base.repeat, freq: base.freq, interval: base.interval, repeat_weekdays: base.repeat_weekdays, monthMode: base.monthMode };
  if (scope === "one" && occurrence) return { ...keep, start_on: occurrence, end_on: "" };
  if (scope === "following" && occurrence)
    return { ...keep, start_on: occurrence, endMode: base.endMode === "count" ? (plan.until_on ? "until" : "never") : base.endMode, until_on: plan.until_on ?? "", count: base.count };
  return { ...keep, start_on: plan.start_on, endMode: base.endMode, until_on: base.until_on, count: base.count };
};

/** 시트의 반복 → 규칙 (한 번이면 null) */
export const draftRule = (d: PlanDraft): RecurRule | null => {
  if (!d.repeat) return null;
  const m = d.freq === "MONTHLY" ? monthRule(d.monthMode, d.start_on) : { nth: null, nthWd: null, monthDay: null };
  return {
    freq: d.freq,
    interval: d.interval,
    byDay: d.freq === "WEEKLY" ? [...new Set(d.repeat_weekdays)].sort((a, b) => a - b) : [],
    ...m,
    count: d.endMode === "count" ? d.count : null,
  };
};

/** 서버(ops_plan_save)와 같은 검사 — 통과하면 null. oneOff = '이 일정만'(반복 칸을 보지 않음) */
export const draftError = (d: PlanDraft, today: string, oneOff?: boolean | string | null): string | null => {
  if (!d.start_on) return "날짜를 골라 주세요";
  if (d.start_on < addDays(today, -62) || d.start_on > addDays(today, 400)) return "날짜를 다시 골라 주세요";
  if (d.title.trim().length > PLAN_TITLE_MAX) return `제목은 ${PLAN_TITLE_MAX}자까지예요`;
  if (d.memo.trim().length > PLAN_MEMO_MAX) return `메모는 ${PLAN_MEMO_MAX}자까지예요`;
  if (d.location.trim().length > PLAN_LOCATION_MAX) return `장소는 ${PLAN_LOCATION_MAX}자까지예요`;
  if (d.repeat && !oneOff) {
    if (d.freq === "WEEKLY" && d.repeat_weekdays.length === 0) return "반복할 요일을 골라 주세요";
    const rule = draftRule(d) as RecurRule;
    const first = firstOccurrence(rule, d.start_on);
    if (!first) return "이 반복으로는 잡히는 날이 없어요";
    if (d.endMode === "until") {
      if (!d.until_on) return "반복이 끝나는 날을 골라 주세요";
      if (d.until_on < first) return "반복이 끝나는 날이 시작보다 빨라요";
    }
    if (d.endMode === "count") {
      if (!Number.isInteger(d.count) || d.count < 1 || d.count > RECUR_COUNT_MAX) return `횟수는 1 ~ ${RECUR_COUNT_MAX}번이에요`;
      if (!countUntil(rule, first)) return "반복 횟수를 줄여 주세요 — 10년 안에서 반복해요";
    }
  } else if (d.end_on) {
    if (d.end_on < d.start_on) return "끝나는 날이 시작보다 빨라요";
    if (d.end_on > addDays(d.start_on, 62)) return "여러 날 일정은 두 달까지예요";
  }
  if (!d.all_day) {
    if (!d.start_time || !d.end_time) return "시작 · 끝 시각을 골라 주세요";
    if (hmToMin(d.end_time) <= hmToMin(d.start_time)) return "끝 시각이 시작보다 늦어야 해요";
    if (d.reminders.length > REMINDER_MAX || d.reminders.some((m) => !REMINDER_OPTIONS.some((o) => o.min === m))) return "알림을 다시 골라 주세요";
  }
  return null;
};

/**
 * ops_plan_save 에 보낼 값.
 *   scope = 고칠 때 범위(이 일정만 · 이후 모두 · 전체), occurrence = 반복 일정을 그날에서 열었으면 그날.
 *   예전 함수(onlyDate 문자열)로 불러도 그대로 — 그날 하나만 바꾸기.
 */
export const draftPayload = (d: PlanDraft, scopeOrOnly?: PlanScope | string | null, occurrence?: string | null): Record<string, unknown> => {
  const isScope = scopeOrOnly === "one" || scopeOrOnly === "following" || scopeOrOnly === "all";
  const scope: PlanScope = isScope ? (scopeOrOnly as PlanScope) : scopeOrOnly ? "one" : "all";
  const occ = isScope ? (occurrence ?? null) : (scopeOrOnly ?? null);
  const oneOff = !!d.id && scope === "one" && !!occ;
  const rule = oneOff ? null : draftRule(d);
  return {
    ...(d.id ? { id: d.id } : {}),
    ...(d.id && scope !== "all" && occ ? { only_date: occ, scope } : d.id ? { scope: "all" } : {}),
    branch: d.branch,
    kind: d.kind,
    title: d.title.trim(),
    memo: d.memo.trim(),
    start_on: d.start_on,
    end_on: rule ? d.start_on : d.end_on || d.start_on,
    rrule: rule ? ruleText(rule) : null,
    repeat_weekdays: rule && rule.freq === "WEEKLY" ? rule.byDay : [],
    until_on: rule && d.endMode === "until" ? d.until_on || null : null,
    all_day: d.all_day,
    start_time: d.all_day ? null : d.start_time,
    end_time: d.all_day ? null : d.end_time,
    private: d.kind === "personal" && d.private,
    color: d.color,
    location: d.location.trim(),
    reminders: d.all_day ? [] : [...new Set(d.reminders)].sort((a, b) => a - b),
  };
};

/**
 * 끌어 옮긴 반복 일정 「이후 모두」 — 새 반복의 넣기 칸 + 나누는 날(서버 only_date — 그 전날까지가 원래 반복)
 *   앞당기면 놓은 날에서, 미루면 끈 날에서 나눈다(그사이 회차가 두 번 보이거나 빠지지 않게).
 *   규칙은 shiftRule(매주 = 끈 요일만 새 요일로 · 매월 = 새 날 기준 · 매일 · 매년 = 새 시작 날 기준).
 *   매주를 같은 주 안에서 미루면 새 반복은 끈 날부터 — 그사이 다른 요일 회차가 남는다(서버가 첫 회차로 당긴다).
 */
export const moveFollowing = (plan: OpsPlan, from: string, to: string, start: string, end: string): { draft: PlanDraft; split: string } => {
  const split = to < from ? to : from;
  let d = draftForScope(draftFromPlan(plan), plan, "following", split);
  let startOn = to;
  const rule = draftRule(d);
  if (rule && to !== from) {
    const sh = shiftRule(rule, from, to);
    d = { ...d, repeat_weekdays: sh.freq === "WEEKLY" ? sh.byDay : d.repeat_weekdays, monthMode: sh.freq === "MONTHLY" ? monthModeOf(sh) : d.monthMode };
    if (sh.freq === "WEEKLY" && to > from && mondayOf(to) === mondayOf(from)) startOn = from;
  }
  return { draft: { ...d, start_on: startOn, start_time: start, end_time: end }, split };
};

/** 「이후 모두」를 고르면 될 모양 한 줄 — "매주 화 · 금 · 19:00~20:00" */
export const moveFollowingLabel = (d: PlanDraft): string | null => {
  const rule = draftRule(d);
  if (!rule) return null;
  const first = firstOccurrence(rule, d.start_on) ?? d.start_on;
  return `${ruleLabel(rule, first, d.endMode === "until" ? d.until_on || null : null)} · ${timeLabel(d.all_day, d.start_time, d.end_time)}`;
};

/** 시트 미리 보기 — 반복이면 앞으로 잡히는 날 n개 */
export const draftPreview = (d: PlanDraft, n = 3): string[] => {
  const rule = draftRule(d);
  if (!rule) return [];
  const first = firstOccurrence(rule, d.start_on);
  if (!first) return [];
  const until = d.endMode === "until" ? d.until_on || null : d.endMode === "count" ? countUntil(rule, first) : null;
  const src = { start_on: first, end_on: first, rrule: ruleText(rule), repeat_weekdays: rule.byDay, until_on: until, skip_dates: [] };
  return recurDates(src, first, addDays(first, 3653)).slice(0, n);
};

/** 매월 반복 고를 수 있는 모양 (시작 날로) */
export const draftMonthModes = (d: PlanDraft): MonthMode[] => monthModes(d.start_on);

// ───────────────────────── 최근 바뀐 일정 ─────────────────────────
export const RECENT_ACTION: Record<PlanRecent["action"], string> = { new: "새로 넣음", edit: "고침", removed: "지움" };

/** "방금" · "12분 전" · "3시간 전" · "2일 전" */
export const agoLabel = (iso: string, now: Date = new Date()): string => {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

/** 최근 바뀐 일정 한 줄 — "휴무 · 연차 · 11월 6일 – 7일 · 하루 종일" */
export const recentLine = (r: PlanRecent): string =>
  [
    PLAN_KIND_META[r.kind].label + (r.title ? ` ${r.title}` : ""),
    r.rrule || r.repeat_weekdays.length
      ? planRepeatLabel({ start_on: r.start_on, repeat_weekdays: r.repeat_weekdays, until_on: r.until_on ?? null, rrule: r.rrule })
      : spanLabel(r.start_on, r.end_on),
    timeLabel(r.all_day, r.start_time, r.end_time),
  ].join(" · ");

// ───────────────────────── 한 달 달력 (2026-11-12 대표님 「운동 달력처럼 운영탭에 스케줄관리도 달력처럼」) ─────────────────────────
//   서버는 그대로 한 주씩(ops_plans_week) — 달력에 보이는 주(4~6주)를 받아 mergeWeeks 로 합친다(주 보기와 같은 캐시).

/** 달력에 보이는 주의 월요일들 — 그 달 1일이 든 주부터 말일이 든 주까지 (4~6개) */
export const monthMondays = (ym: string): string[] => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return [];
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const out: string[] = [];
  for (let d = mondayOf(`${ym}-01`); d <= last; d = addDays(d, 7)) out.push(d);
  return out;
};

/** "11월" · 올해가 아니면 "2027년 1월" */
export const planMonthLabel = (ym: string, today: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return ym.slice(0, 4) === today.slice(0, 4) ? `${m}월` : `${y}년 ${m}월`;
};

/** 여러 주를 하나로 — 반복 일정 · 시간표는 주마다 같은 줄이 오므로 하나만, 사람은 처음 나온 순서 그대로 */
export const mergeWeeks = (weeks: readonly PlansWeek[]): PlansWeek | null => {
  if (weeks.length === 0) return null;
  const sorted = [...weeks].sort((a, b) => a.from.localeCompare(b.from));
  const uniq = <T>(rows: T[], key: (r: T) => string): T[] => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = key(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  return {
    ...sorted[0],
    to: sorted[sorted.length - 1].to,
    members: uniq(sorted.flatMap((w) => w.members), (m) => m.key),
    plans: uniq(sorted.flatMap((w) => w.plans), (p) => p.id),
    shifts: uniq(sorted.flatMap((w) => w.shifts), (s) => [s.key, s.branch, s.weekday, s.start_time, s.end_time, s.valid_from].join("|")),
    offs: uniq(sorted.flatMap((w) => w.offs), (o) => `${o.key}|${o.branch}|${o.date}`),
    birthdays: uniq(sorted.flatMap((w) => w.birthdays ?? []), (b) => `${b.date}|${b.user_id}`),
  };
};

/** 달력 칸 표시 — 휴무(승인된 쉰 날 포함) → 외부 → 수업 → PT → 업무 → 개인 → 근무 시간 */
export type MarkKey = PlanKind | "shift";
export const MARK_ORDER: readonly MarkKey[] = ["off", "out", "class", "pt", "work", "personal", "shift"];
export const MARK_META: Record<MarkKey, { label: string; dot: string }> = {
  off: { label: PLAN_KIND_META.off.label, dot: PLAN_KIND_META.off.dot },
  out: { label: PLAN_KIND_META.out.label, dot: PLAN_KIND_META.out.dot },
  class: { label: PLAN_KIND_META.class.label, dot: PLAN_KIND_META.class.dot },
  pt: { label: PLAN_KIND_META.pt.label, dot: PLAN_KIND_META.pt.dot },
  work: { label: PLAN_KIND_META.work.label, dot: PLAN_KIND_META.work.dot },
  personal: { label: PLAN_KIND_META.personal.label, dot: PLAN_KIND_META.personal.dot },
  shift: { label: SHIFT_META.label, dot: SHIFT_META.dot },
};

const markOf = (i: DayItem): MarkKey => (i.type === "shift" ? "shift" : i.type === "shiftOff" ? "off" : i.kind);

export interface DayMark {
  key: MarkKey;
  label: string;
  dot: string;
  /** 그 표시가 있는 사람 수 (내 달력은 1) */
  people: number;
}

/**
 * 하루 칸 표시 — 사람마다 그날 일정(dayItems)을 받아 종류마다 몇 분인지.
 * 근무 시간은 withShift 일 때만 — 팀 달력은 평일마다 있어 뺀다(내 달력은 '일하는 날'이라 넣는다).
 */
export const dayMarks = (perMember: readonly (readonly DayItem[])[], withShift: boolean): DayMark[] => {
  const count = new Map<MarkKey, number>();
  for (const items of perMember) {
    for (const k of new Set(items.map(markOf))) {
      if (k === "shift" && !withShift) continue;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return MARK_ORDER.filter((k) => count.has(k)).map((k) => ({ key: k, ...MARK_META[k], people: count.get(k) ?? 0 }));
};

/** 달력 칸 읽어 주기 · 팀 — "휴무 1명 · 외부 1명", 내 달력 — "근무 시간 · 수업" */
export const marksLine = (marks: readonly DayMark[], team: boolean): string =>
  marks.map((m) => (team ? `${m.label} ${m.people}명` : m.label)).join(" · ");

/** 그 달(앞뒤 달 칸 빼고)에 한 번이라도 나온 표시만 — 색 이름표는 쓰인 것만 그린다 */
export const presentMarks = (byDay: ReadonlyMap<string, readonly DayMark[]>, ym: string): MarkKey[] => {
  const seen = new Set<MarkKey>();
  for (const [day, marks] of byDay) if (day.startsWith(`${ym}-`)) for (const m of marks) seen.add(m.key);
  return MARK_ORDER.filter((k) => seen.has(k));
};

// ───────────────────────── 내 일정 보기 (3-2 — 일 · 3일 · 주 · 월 · 목록 · 연간) ─────────────────────────
export type MineView = "day" | "3day" | "week" | "month" | "list" | "year";
export const PLAN_AGENDA_DAYS = 60;

/** 보기마다 받을 범위 — 팀 주간 = 한 주 · 팀/내 달력 = 달력에 보이는 주 · 일/3일/주 = 그 날들 · 목록 = 60일 · 연간 = 한 해 */
export const planRange = (
  mode: "team" | "mine",
  period: "week" | "month",
  view: MineView,
  day: string,
  ym: string,
): { from: string; to: string } => {
  const monthGrid = () => {
    const mons = monthMondays(ym);
    return { from: mons[0], to: addDays(mons[mons.length - 1], 6) };
  };
  if (mode === "team") return period === "week" ? { from: mondayOf(day), to: addDays(mondayOf(day), 6) } : monthGrid();
  switch (view) {
    case "day":
      return { from: day, to: day };
    case "3day":
      return { from: day, to: addDays(day, 2) };
    case "week":
      return { from: mondayOf(day), to: addDays(mondayOf(day), 6) };
    case "list":
      return { from: day, to: addDays(day, PLAN_AGENDA_DAYS - 1) };
    case "year":
      return { from: `${day.slice(0, 4)}-01-01`, to: `${day.slice(0, 4)}-12-31` };
    default:
      return monthGrid();
  }
};

/** 앞으로 n일 — 'D-3' · 오늘 'D-day' (지난 날이면 null) */
export const ddayLabel = (date: string, today: string): string | null => {
  const n = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (n < 0) return null;
  return n === 0 ? "D-day" : `D-${n}`;
};
