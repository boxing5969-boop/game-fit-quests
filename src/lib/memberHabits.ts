/**
 * ✅ 캘린더 3-4단계 — 회원 습관 · 마감 있는 할 일 (2026-11-14 대표님 「진행」 · 「캘린더 3단계 보고서」 3-4)
 *   나만의 체크(2-1)에 '주 n번' · 이번 주 채운 수 · 지금 이어 가는 주 · 가장 길게 이어 간 주 + 마감 있는 할 일.
 *   · 회원 감정 설계(CLAUDE.md): 채운 것 · 이어 간 것 · 다음 한 걸음만 말한다. 달성률 % · 놓친 날 · 독촉은 없다 —
 *     회원 화면 글에 쓰지 않는 낱말(MEMBER_BANNED)은 시험(memberHabits.test.ts)이 이 파일의 글을 모두 돌려 본다.
 *   · 마감이 지난 할 일은 '다음에 해도 돼요' 칸으로 — 날짜를 다시 정하면 위로 올라간다.
 *   · 서버 = get_my_habits · set_my_check_goal · set_my_todo · set_my_todo_done · remove_my_todo · get_my_calendar 'todos'
 *     (20261114005029_calendar_stage34.sql). 주 계산은 서버와 같은 식(weekGoalOf · streakWeeks — 시험이 서버 시험과 같은 경우를 본다).
 *   자료는 services/calendarCheckService.ts, 화면은 components/attendance/CheckItemsSheet.tsx · CalendarChecks.tsx.
 */
import { weekdayOfYmd, weekdaysLabel } from "@/lib/promise153";

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const WEEK_GOAL_MAX = 6;
export const TODO_TITLE_MAX = 30;
export const TODO_OPEN_MAX = 10;
/** 끝낸 할 일은 이만큼 보이고 저절로 정리 */
export const TODO_DONE_DAYS = 7;
/** 회원 화면 글에 쓰지 않는 낱말 (회원 감정 설계 · 3-4 끝 기준) */
export const MEMBER_BANNED = ["못", "빠진", "밀린", "실패"] as const;

export const LATER_TITLE = "다음에 해도 돼요";
export const LATER_HINT = "날짜를 다시 정하면 위로 올라가요";
export const TODO_EMPTY = "마감이 있는 일을 적어 두면 달력에 보여요";
export const TODO_EXAMPLES: readonly string[] = ["수강권 연장 상담", "운동복 챙기기", "153 PB 도전 신청"];

// ───────────────────────── 서버 값 ─────────────────────────
export interface HabitItem {
  id: string;
  label: string;
  target: number | null;
  unit: string | null;
  weekdays: number[] | null;
  weekGoal: number | null;
  /** 한 주 목표 — 주 n번, 없으면 고른 요일 수(매일 = 7) */
  goal: number;
  createdOn: string;
  /** 이번 주 — 채운 수 · 이번 주 목표(만든 주는 남은 날만큼) */
  week: { done: number; goal: number };
  nowWeeks: number;
  bestWeeks: number;
}

export interface MemberTodo {
  id: string;
  title: string;
  dueOn: string;
  doneOn: string | null;
  createdOn: string;
}

export interface Habits {
  on: boolean;
  today: string | null;
  monday: string | null;
  items: HabitItem[];
  todos: MemberTodo[];
}

export const HABITS_OFF: Habits = { on: false, today: null, monday: null, items: [], todos: [] };

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ymd = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const int = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? Math.trunc(x) : null;
};

export function normalizeTodo(raw: unknown): MemberTodo | null {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  const dueOn = ymd(r?.due_on);
  if (!r || !id || !title || !dueOn) return null;
  return { id, title, dueOn, doneOn: ymd(r.done_on), createdOn: ymd(r.created_on) ?? dueOn };
}

export function normalizeHabits(raw: unknown): Habits {
  const r = obj(raw);
  if (!r || r.on !== true) return HABITS_OFF;
  const items = (Array.isArray(r.items) ? r.items : [])
    .map((x): HabitItem | null => {
      const o = obj(x);
      const id = str(o?.id);
      const label = str(o?.label);
      const createdOn = ymd(o?.created_on);
      if (!o || !id || !label || !createdOn) return null;
      const days = Array.isArray(o.weekdays)
        ? [...new Set(o.weekdays.map(int).filter((d): d is number => d != null && d >= 0 && d <= 6))].sort((a, b) => a - b)
        : null;
      const wg = int(o.week_goal);
      const week = obj(o.week);
      return {
        id,
        label,
        target: int(o.target),
        unit: str(o.unit),
        weekdays: days && days.length > 0 && days.length < 7 ? days : null,
        weekGoal: wg != null && wg >= 1 && wg <= WEEK_GOAL_MAX ? wg : null,
        goal: Math.max(0, int(o.goal) ?? 0),
        createdOn,
        week: { done: Math.max(0, int(week?.done) ?? 0), goal: Math.max(0, int(week?.goal) ?? 0) },
        nowWeeks: Math.max(0, int(o.now_weeks) ?? 0),
        bestWeeks: Math.max(0, int(o.best_weeks) ?? 0),
      };
    })
    .filter((x): x is HabitItem => !!x);
  const todos = (Array.isArray(r.todos) ? r.todos : []).map(normalizeTodo).filter((t): t is MemberTodo => !!t);
  return { on: true, today: ymd(r.today), monday: ymd(r.monday), items, todos };
}

// ───────────────────────── 날짜 ─────────────────────────
export const addDaysYmd = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
/** 그 날이 든 주의 월요일 (한국 시각 날짜 그대로) */
export const mondayOfYmd = (day: string): string => addDaysYmd(day, -((weekdayOfYmd(day) + 6) % 7));
const WD = ["일", "월", "화", "수", "목", "금", "토"] as const;
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// ───────────────────────── 주 계산 (서버 get_my_habits 와 같은 식) ─────────────────────────
/** 한 주 목표 — 주 n번, 없으면 고른 요일 수(매일 = 7) */
export const fullGoalOf = (i: { weekdays: readonly number[] | null; weekGoal: number | null }): number =>
  i.weekGoal ?? (i.weekdays ? i.weekdays.length : 7);

/** 그 주 목표 — least(한 주 목표, 그 주에 체크할 수 있는 날: 만든 날부터 · 고른 요일만 · 아직 안 온 날 포함) */
export function weekGoalOf(i: { weekdays: readonly number[] | null; weekGoal: number | null; createdOn: string }, monday: string): number {
  let avail = 0;
  for (let k = 0; k < 7; k++) {
    const d = addDaysYmd(monday, k);
    if (d < i.createdOn) continue;
    if (i.weekdays && !i.weekdays.includes(weekdayOfYmd(d))) continue;
    avail += 1;
  }
  return Math.min(fullGoalOf(i), avail);
}

/**
 * 이어 가는 주 · 가장 길게 이어 간 주 — mets = 만든 주부터 이번 주까지 (마지막 = 이번 주).
 * 지난 주는 못 채우면 0 부터 다시 · 이번 주는 채웠으면 더하고, 아직이면 지난주까지로 본다(끝나지 않은 주).
 */
export function streakWeeks(mets: readonly boolean[]): { now: number; best: number } {
  let run = 0;
  let best = 0;
  let now = 0;
  mets.forEach((met, idx) => {
    const thisWeek = idx === mets.length - 1;
    if (thisWeek) {
      if (met) run += 1;
      now = run;
    } else if (met) {
      run += 1;
    } else {
      run = 0;
    }
    best = Math.max(best, run);
  });
  return { now, best };
}

/** 달력 자료(get_my_calendar days)로 그 주 채운 수 — 그날 카드의 '주 n번' 칩 */
export function weekDoneOf(itemId: string, days: ReadonlyMap<string, { done: readonly string[] }>, monday: string, today: string): number {
  let n = 0;
  for (let k = 0; k < 7; k++) {
    const d = addDaysYmd(monday, k);
    if (d > today) break;
    if (days.get(d)?.done.includes(itemId)) n += 1;
  }
  return n;
}

// ───────────────────────── 글 ─────────────────────────
/** 언제 체크하나 — '주 3번' · '매주 월 · 수 · 금' · '매일' */
export const scheduleLabel = (i: { weekdays: readonly number[] | null; weekGoal: number | null }): string =>
  i.weekGoal ? `주 ${i.weekGoal}번 · 아무 날이나` : i.weekdays ? `매주 ${weekdaysLabel(i.weekdays)}` : "매일";

/** 이번 주 한 줄 — '이번 주 2/3번' · 채우면 '이번 주 채웠어요' (목표가 0 인 주는 말 없음) */
export function weekLine(week: { done: number; goal: number }): string | null {
  if (week.goal <= 0) return null;
  return week.done >= week.goal ? "이번 주 채웠어요" : `이번 주 ${week.done}/${week.goal}번`;
}

/** 이어 간 주 — 2주부터만 말한다(1주는 이번 주 한 줄이 이미 말한다) · 화면은 조각마다 줄바꿈하지 않게 */
export function streakParts(nowWeeks: number, bestWeeks: number): string[] {
  if (nowWeeks >= 2) return bestWeeks > nowWeeks ? [`${nowWeeks}주째 이어 가요`, `가장 길게 ${bestWeeks}주`] : [`${nowWeeks}주째 이어 가요`];
  if (bestWeeks >= 2) return [`가장 길게 ${bestWeeks}주 이어 갔어요`];
  return [];
}

/** 이어 간 주 한 줄 — '3주째 이어 가요 · 가장 길게 5주' (없으면 null) */
export function streakLine(nowWeeks: number, bestWeeks: number): string | null {
  const parts = streakParts(nowWeeks, bestWeeks);
  return parts.length ? parts.join(" · ") : null;
}

/** 그날 카드 '주 n번' 칩 — '줄넘기 10분 · 2/3' · 채우면 '· 이번 주 채움' */
export const flexChipLabel = (label: string, done: number, goal: number): string =>
  goal <= 0 ? label : done >= goal ? `${label} · 이번 주 채움` : `${label} · ${done}/${goal}`;

/** 주 n번 고르기 칸 글 */
export const weekGoalHint = (n: number): string =>
  n <= 1 ? "일주일에 한 번, 편한 날 체크해요" : `일주일에 ${n}번, 편한 날 체크해요`;

// ───────────────────────── 마감 있는 할 일 ─────────────────────────
/** 마감 한 줄 — '오늘까지' · '내일까지' · '11/18(수)까지' (지난 마감도 날짜만 — 묶음이 말한다) */
export function todoDueLabel(dueOn: string, today: string): string {
  if (dueOn === today) return "오늘까지";
  if (dueOn === addDaysYmd(today, 1)) return "내일까지";
  return `${md(dueOn)}(${WD[weekdayOfYmd(dueOn)]})까지`;
}

/** 앞으로(마감 빠른 순) · 다음에 해도 돼요(지난 마감) · 끝냈어요(7일 안) */
export function todoGroups(todos: readonly MemberTodo[], today: string): { upcoming: MemberTodo[]; later: MemberTodo[]; done: MemberTodo[] } {
  const upcoming: MemberTodo[] = [];
  const later: MemberTodo[] = [];
  const done: MemberTodo[] = [];
  for (const t of todos) {
    if (t.doneOn) done.push(t);
    else if (t.dueOn < today) later.push(t);
    else upcoming.push(t);
  }
  const byDue = (a: MemberTodo, b: MemberTodo) => a.dueOn.localeCompare(b.dueOn) || a.createdOn.localeCompare(b.createdOn);
  return { upcoming: upcoming.sort(byDue), later: later.sort(byDue), done: done.sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? "")) };
}

/** 마감 빨리 고르기 — 오늘 · 내일 · 이번 주 일요일(오늘이 토 · 일이면 다음 주 일요일) */
export function todoQuickDues(today: string): Array<{ key: string; label: string; date: string }> {
  const wd = weekdayOfYmd(today);
  const toSun = wd === 0 ? 7 : 7 - wd;
  const sun = addDaysYmd(today, wd === 6 ? 8 : toSun);
  const out = [
    { key: "today", label: "오늘", date: today },
    { key: "tomorrow", label: "내일", date: addDaysYmd(today, 1) },
  ];
  if (sun !== addDaysYmd(today, 1)) out.push({ key: "sun", label: wd === 6 || wd === 0 ? "다음 주 일요일" : "이번 주 일요일", date: sun });
  return out;
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** 서버(set_my_todo)와 같은 검사 — 통과하면 null. 고칠 때 마감일을 그대로 두면 지난 날이어도 된다 */
export function todoError(title: string, due: string | null, today: string, oldDue?: string | null): string | null {
  const t = tidy(title);
  if (!t) return "할 일을 적어 주세요";
  if ([...t].length > TODO_TITLE_MAX) return "할 일은 30자 안으로 적어 주세요";
  if (!due) return "마감일을 골라 주세요";
  const changed = oldDue === undefined || oldDue === null || due !== oldDue;
  if (changed && (due < today || due > addDaysYmd(today, 365))) return "마감일은 오늘부터 1년 안으로 골라 주세요";
  return null;
}

export const todoPayload = (title: string, due: string, id?: string | null) => ({ p_id: id ?? null, p_title: tidy(title), p_due: due });

/** 할 때마다 바로 보이게 — 끝냈어요 · 되돌리기 */
export function applyTodoDone(h: Habits, id: string, done: boolean, today: string): Habits {
  return { ...h, todos: h.todos.map((t) => (t.id === id ? { ...t, doneOn: done ? (t.doneOn ?? today) : null } : t)) };
}

/** 그날 카드 — 오늘이 마감인 할 일 (get_my_calendar 'todos') */
export interface CalTodo {
  id: string;
  title: string;
  dueOn: string;
  done: boolean;
}
export function normalizeCalTodos(raw: unknown): CalTodo[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x): CalTodo | null => {
      const o = obj(x);
      const id = str(o?.id);
      const title = str(o?.title);
      const dueOn = ymd(o?.due_on);
      return o && id && title && dueOn ? { id, title, dueOn, done: o.done === true } : null;
    })
    .filter((t): t is CalTodo => !!t);
}
export const todosOn = (todos: readonly CalTodo[], day: string): CalTodo[] => todos.filter((t) => t.dueOn === day);
