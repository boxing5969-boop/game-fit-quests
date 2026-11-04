/**
 * 📈 153 코치 기준 · 4주 성장 (2026-11-05 대표님 「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
 *   화면 규칙 한 곳 — 주차 · 주제 · 점수 · 가장 약한 기준. 숫자는 서버(coach_growth_me)가 주고 여기서는 모양만 정한다.
 *   DB: supabase/migrations/20261105005333_coach_std_growth.sql
 *   점수: 했어요 1 · 조금 0.5 · 못 했어요 0 의 평균 (서버 _coach_rates_* 와 같은 식)
 */

export type Mark = "y" | "s" | "n";
export type Marks = Partial<Record<string, Mark>>;

export interface CoachStd {
  no: number;
  title: string;
  why: string;
  how: string;
  say: string;
  check_q: string;
}

export interface RateCell {
  rate: number;
  n: number;
}
export type Rates = Record<string, RateCell>;

export type PlanStatus = "active" | "done" | "stopped";
export type PlanDecision = "keep" | "extend" | "talk";

export interface GrowthPlan {
  id: string;
  start_on: string;
  weeks: number;
  status: PlanStatus;
  week_no: number;
  decision?: PlanDecision | null;
  decision_note?: string | null;
  decided_at?: string | null;
}

export interface StaffDisplay {
  user_id: string;
  name: string;
  title: string;
  avatar_url: string | null;
}

export interface Observation {
  id: string;
  class_on: string;
  class_hour: number | null;
  marks: Marks;
  good1: string;
  good2: string | null;
  fix1: string;
  fix_no: number | null;
  seen_at: string | null;
  created_at: string;
  observer: StaffDisplay | null;
}

export interface GrowthPerson {
  person: StaffDisplay | null;
  plan: GrowthPlan | null;
  self: Rates;
  obs: Rates;
  checks_total: number;
  checks_week: number;
  obs_total: number;
  obs_week: number;
  last_obs_at: string | null;
  unseen: number;
  first_marks: Marks | null;
  last_marks: Marks | null;
  observations?: Observation[];
}

export interface CoachGrowthMe {
  staff: boolean;
  hq?: boolean;
  can_direct?: boolean;
  branch?: string;
  ai_polish?: boolean;
  standards?: CoachStd[];
  me?: GrowthPerson;
  board?: GrowthPerson[] | null;
}

export const MARKS: Mark[] = ["y", "s", "n"];
export const MARK_LABEL: Record<Mark, string> = { y: "했어요", s: "조금", n: "못 했어요" };
export const MARK_SCORE: Record<Mark, number> = { y: 1, s: 0.5, n: 0 };

export const DECISION_LABEL: Record<PlanDecision, string> = {
  keep: "함께 키워요",
  extend: "2주 더 봐요",
  talk: "따로 이야기해요",
};

export interface WeekPlan {
  week: number;
  theme: string;
  focus: number[];
  todo: string[];
}

/** 4주 과정 — 주마다 주제 하나 · 집중할 기준 · 할 일. 5주차부터(2주 더)는 가장 약한 한 가지 */
export const GROWTH_WEEKS: WeekPlan[] = [
  { week: 1, theme: "이름과 인사", focus: [1, 2], todo: ["대표님(지점장님) 수업 한 번 보기", "수업마다 1분 점검", "관찰 피드백 1번 받기"] },
  { week: 2, theme: "칭찬과 첫 방문", focus: [3, 4], todo: ["처음 온 회원과 다음 방문 날 정하기", "수업마다 1분 점검", "관찰 피드백 1번 받기"] },
  { week: 3, theme: "다음 목표", focus: [5], todo: ["레벨업이 가까운 회원 3명에게 남은 것 알려 주기", "수업마다 1분 점검", "관찰 피드백 1번 받기"] },
  { week: 4, theme: "다섯 가지 모두", focus: [1, 2, 3, 4, 5], todo: ["다섯 가지를 한 수업에 모두", "관찰 피드백 2번 받기", "4주 돌아보기"] },
];

export const EXTRA_THEME = "가장 약한 한 가지";

/** 그 주의 계획 — weekNo 1부터. 0(시작 전)이면 1주차를 미리 보여 준다. 5주차부터는 weakest 하나에 집중 */
export function weekPlan(weekNo: number, weakest: number | null): WeekPlan {
  const w = Math.max(1, Math.floor(weekNo || 1));
  if (w <= GROWTH_WEEKS.length) return GROWTH_WEEKS[w - 1];
  const focus = weakest ? [weakest] : [1];
  return { week: w, theme: EXTRA_THEME, focus, todo: ["그 한 가지를 수업마다 먼저", "수업마다 1분 점검", "관찰 피드백 1번 받기"] };
}

export type PlanPhase = "none" | "before" | "running" | "review" | "done";

/** none 과정 없음 · before 시작 전 · running 진행 중 · review 기간이 끝나 돌아보기 차례 · done 끝남 */
export function planPhase(plan: GrowthPlan | null | undefined): PlanPhase {
  if (!plan) return "none";
  if (plan.status !== "active") return "done";
  if ((plan.week_no ?? 0) <= 0) return "before";
  if (plan.week_no > plan.weeks) return "review";
  return "running";
}

/** 점검표 몇 장의 평균 — 없으면 null */
export function rateOfMarks(marks: Array<Mark | undefined | null>): number | null {
  const ok = marks.filter((m): m is Mark => m === "y" || m === "s" || m === "n");
  if (ok.length === 0) return null;
  return ok.reduce((sum, m) => sum + MARK_SCORE[m], 0) / ok.length;
}

export const pct = (rate: number | null | undefined): number | null =>
  rate == null || !Number.isFinite(rate) ? null : Math.round(Math.max(0, Math.min(1, rate)) * 100);

/** 가장 약한 기준 — 점수가 가장 낮은 것(같으면 번호가 앞선 것). 기록이 minN 개 아래인 기준은 뺀다 */
export function weakestStd(rates: Rates | null | undefined, stds: number[], minN = 1): number | null {
  let best: { no: number; rate: number } | null = null;
  for (const no of stds) {
    const cell = rates?.[String(no)];
    if (!cell || cell.n < minN) continue;
    if (!best || cell.rate < best.rate - 1e-9) best = { no, rate: cell.rate };
  }
  return best?.no ?? null;
}

/** 가장 잘하는 기준 — 점수가 가장 높은 것(같으면 번호가 앞선 것) */
export function strongestStd(rates: Rates | null | undefined, stds: number[], minN = 1): number | null {
  let best: { no: number; rate: number } | null = null;
  for (const no of stds) {
    const cell = rates?.[String(no)];
    if (!cell || cell.n < minN) continue;
    if (!best || cell.rate > best.rate + 1e-9) best = { no, rate: cell.rate };
  }
  return best?.no ?? null;
}

/** 관찰 첫 장 → 마지막 장 — 그 기준이 좋아졌나 */
export function markTrend(first: Marks | null | undefined, last: Marks | null | undefined, no: number): "up" | "down" | "same" | null {
  const a = first?.[String(no)];
  const b = last?.[String(no)];
  if (!a || !b || first === last) return null;
  const d = MARK_SCORE[b] - MARK_SCORE[a];
  if (d > 0) return "up";
  if (d < 0) return "down";
  return "same";
}

/** 바꿀 것의 기준 — 점검표에서 가장 낮은 칸(못 했어요 → 조금), 같으면 번호가 앞선 것. 모두 '했어요'거나 비었으면 null */
export function defaultFixNo(marks: Marks, stds: number[]): number | null {
  let best: { no: number; score: number } | null = null;
  for (const no of stds) {
    const m = marks[String(no)];
    if (!m || m === "y") continue;
    const score = MARK_SCORE[m];
    if (!best || score < best.score) best = { no, score };
  }
  return best?.no ?? null;
}

/** 점검표 한 칸 누르기 — 같은 칸을 다시 누르면 지운다 */
export function toggleMark(marks: Marks, no: number, m: Mark): Marks {
  const key = String(no);
  const next: Marks = { ...marks };
  if (next[key] === m) delete next[key];
  else next[key] = m;
  return next;
}

export const markedCount = (marks: Marks | null | undefined): number =>
  Object.values(marks ?? {}).filter((m) => m === "y" || m === "s" || m === "n").length;

/** '이번 주 관찰이 없는 코치님' — 진행 중인 과정이 있고 이번 주 관찰이 0 */
export function needsObservation(people: GrowthPerson[]): GrowthPerson[] {
  return people.filter((p) => planPhase(p.plan) === "running" && (p.obs_week ?? 0) === 0);
}

/** 이야기 말투 한 줄 (이렇게 말해요 — 줄마다 한 문장) */
export const sayLines = (say: string | null | undefined): string[] =>
  (say ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 날짜 'M/D' · 수업 시각 'H시' */
export function shortDay(d: string | null | undefined): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return "";
  return `${Number(m[2])}/${Number(m[3])}`;
}
