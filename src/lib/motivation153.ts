/**
 * 🥊 동기부여 1단계 — 첫 4주 스타터 · 이른 출석 축하 (2026-11-12 대표님 「추천대로」 · 선릉역점만 먼저)
 *   보고서 https://claude.ai/artifact/6sAvidMfhyLhFERCK5jXFw — 선릉역점 신규: 첫 4주에 8번 이상 온 회원은 3개월째 77%,
 *   1~3번은 23%가 남았다(3.3배). 지금 출석 축하는 50번마다라 주 2회 회원도 첫 축하가 6개월 뒤 → 5 · 10 · 20 · 30번째에.
 *
 *   숫자 · 보상은 서버가 정본이다 (supabase/migrations/20261112160924_motivation_stage1.sql):
 *     · get_my_motivation() — 켠 지점 회원이 아니면 {on:false}. 첫 4주(첫 출석일 ~ +27일) 안 출석 · 다음 이른 축하 · 안 본 축하
 *     · motivation_tick() — 5분마다 이른 축하(보상 없이 편지) · 첫 4주 8번 달성(마일리지 starter_mileage, 지금 3,000점)을 남긴다
 *     · 켠 지점 · 숫자 = app_settings 'motivation_pilot' (끄기 = branches 빈 배열 → 화면도 조용)
 *   이 파일은 서버 응답을 안전하게 읽고(normalizeMotivation), 홈 카드 · 축하 막대 · 편지 문구를 만든다.
 */
import type { LetterContent } from "@/lib/welcomeLetters";

/** 서버 기본값과 같다 — 서버가 다른 값을 보내면 서버 값을 쓴다 */
export const STARTER_DAYS = 28;
export const STARTER_GOAL = 8;
export const EARLY_STEPS = [5, 10, 20, 30] as const;
/** 이른 축하가 끝나면 다음은 50번째(기존 출석 축하) */
export const FIRST_FIFTY = 50;

export interface StarterInfo {
  days: number;
  goal: number;
  /** 다 채우면 드리는 마일리지(설정 값) */
  mileage: number;
  /** 첫 출석일부터 days 일 안에 온 날 수 */
  count: number;
  /** 아직 첫 4주 안인가 */
  active: boolean;
  /** 마지막 날 'YYYY-MM-DD' */
  endsOn: string | null;
  /** 달성을 서버가 남긴 시각(마일리지를 드린 때) */
  doneAt: string | null;
  doneMileage: number;
}

export interface EarlyInfo {
  steps: number[];
  /** 다음 이른 축하(5 · 10 · 20 · 30) — 다 지나면 null(→ 기존 50번마다) */
  next: number | null;
  /** 바로 앞 단계(처음이면 0) */
  prev: number | null;
}

export interface MotivationUnseen {
  starter: boolean;
  /** 안 본 이른 축하 중 가장 큰 단계 */
  early: number | null;
  mileage: number;
}

export interface Motivation {
  on: boolean;
  today: string | null;
  total: number;
  firstDay: string | null;
  starter: StarterInfo;
  early: EarlyInfo;
  unseen: MotivationUnseen | null;
}

export const MOTIVATION_OFF: Motivation = {
  on: false,
  today: null,
  total: 0,
  firstDay: null,
  starter: { days: STARTER_DAYS, goal: STARTER_GOAL, mileage: 0, count: 0, active: false, endsOn: null, doneAt: null, doneMileage: 0 },
  early: { steps: [...EARLY_STEPS], next: null, prev: null },
  unseen: null,
};

const int = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : d;
};
const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
};
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** 서버 JSON → 화면용 (빠지거나 이상한 값은 꺼진 것으로) */
export function normalizeMotivation(raw: unknown): Motivation {
  const r = obj(raw);
  if (r.on !== true) return MOTIVATION_OFF;
  const s = obj(r.starter);
  const e = obj(r.early);
  const u = r.unseen && typeof r.unseen === "object" ? obj(r.unseen) : null;
  const steps = (Array.isArray(e.steps) ? e.steps : [...EARLY_STEPS])
    .map((x) => int(x))
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const unseen: MotivationUnseen | null =
    u && (u.starter === true || intOrNull(u.early) !== null)
      ? { starter: u.starter === true, early: intOrNull(u.early), mileage: int(u.mileage) }
      : null;
  return {
    on: true,
    today: day(r.today),
    total: int(r.total),
    firstDay: day(r.first_day),
    starter: {
      days: int(s.days, STARTER_DAYS) || STARTER_DAYS,
      goal: int(s.goal, STARTER_GOAL) || STARTER_GOAL,
      mileage: int(s.mileage),
      count: int(s.count),
      active: s.active === true,
      endsOn: day(s.ends_on),
      doneAt: str(s.done_at),
      doneMileage: int(s.done_mileage),
    },
    early: { steps, next: intOrNull(e.next), prev: intOrNull(e.prev) },
    unseen,
  };
}

/** 'YYYY-MM-DD' 두 날 사이 날 수 (b − a) */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const n = (v: number) => v.toLocaleString("ko-KR");

export interface StarterView {
  /** 첫 4주 안이라 홈 카드에 그린다 */
  show: boolean;
  done: boolean;
  count: number;
  goal: number;
  /** 오늘을 넣어 남은 날 */
  daysLeft: number;
  /** 다 채우면 · 채워서 받은 마일리지 */
  mileage: number;
  /** 서버가 달성을 남겼다(마일리지를 드림) */
  rewarded: boolean;
  /** 카드 아래 한 줄 */
  hint: string;
}

/** 홈 '운동 달력' 카드 위 첫 4주 칸 — 숫자는 서버 그대로, 글만 여기서 */
export function starterView(m: Motivation | null | undefined, today: string): StarterView {
  const s = m?.starter ?? MOTIVATION_OFF.starter;
  const goal = Math.max(1, s.goal);
  const count = Math.min(s.count, goal);
  const daysLeft = s.endsOn ? Math.max(0, daysBetween(today, s.endsOn) + 1) : 0;
  const show = !!m?.on && s.active && daysLeft > 0;
  const done = s.count >= goal;
  const rewarded = !!s.doneAt;
  const mileage = rewarded ? s.doneMileage : s.mileage;
  const remaining = goal - count;
  let hint: string;
  if (done) {
    hint = mileage > 0 ? (rewarded ? `마일리지 +${n(mileage)}점을 드렸어요` : `마일리지 +${n(mileage)}점이 곧 들어와요`) : "153이 습관이 되기 시작했어요";
  } else if (remaining > daysLeft) {
    hint = "오늘 한 번이 다음 축하를 당겨요";
  } else if (mileage > 0) {
    hint = `${n(remaining)}번 더 오면 마일리지 +${n(mileage)}점`;
  } else {
    hint = `${n(remaining)}번 더 오면 첫 4주 달성이에요`;
  }
  return { show, done, count, goal, daysLeft, mileage, rewarded, hint };
}

export interface CelebrationTarget {
  next: number;
  prev: number;
  /** 이른 축하(보상 없이 편지)인가 */
  early: boolean;
}

/**
 * 다음 출석 축하 — 켠 지점 회원은 5 · 10 · 20 · 30번째가 먼저, 지나면 기존 50번마다.
 *   stats = get_my_attendance_stats 의 total · next · step (없으면 total 로 셈)
 */
export function nextCelebration(
  total: number,
  m: Motivation | null | undefined,
  fifty: { next?: number; step?: number } = {},
): CelebrationTarget {
  const t = Math.max(0, Math.floor(total));
  if (m?.on && m.early.next !== null && m.early.next > t) {
    return { next: m.early.next, prev: Math.min(m.early.prev ?? 0, t), early: true };
  }
  const step = Math.max(1, Math.floor(fifty.step ?? FIRST_FIFTY));
  const next = fifty.next && fifty.next > t ? fifty.next : (Math.floor(t / step) + 1) * step;
  return { next, prev: next - step, early: false };
}

/** 남은 횟수 · 막대 비율(0~1) */
export function celebrationProgress(total: number, target: CelebrationTarget) {
  const t = Math.max(0, Math.floor(total));
  const span = Math.max(1, target.next - target.prev);
  const done = Math.min(span, Math.max(0, t - target.prev));
  return { left: Math.max(0, target.next - t), ratio: done / span, span, done };
}

/** 이른 축하 다음 단계 (마지막 이른 축하 뒤 = 50) */
export function nextEarlyStep(m: number, steps: readonly number[] = EARLY_STEPS): number {
  return [...steps].sort((a, b) => a - b).find((s) => s > m) ?? FIRST_FIFTY;
}

const who = (name: string) => (name || "").trim() || "복서";

/** 이른 출석 축하 편지 — 5 · 10 · 20 · 30번째 (선물 없이 마음만) */
export function earlyLetter(name: string, milestone: number, steps: readonly number[] = EARLY_STEPS): LetterContent {
  const w = who(name);
  const m = Math.max(1, Math.floor(milestone));
  const next = nextEarlyStep(m, steps);
  const opener =
    m <= 5
      ? `첫 ${n(m)}번을 채웠어요.\n시작이 반이라는 말, ${w}님이 보여 줬어요.`
      : m <= 10
        ? `두 자리 숫자의 출석.\n이제 153이 ${w}님의 일정이 됐어요.`
        : m <= 20
          ? `${n(m)}번.\n몸이 먼저 체육관을 기억하기 시작했어요.`
          : `${n(m)}번.\n이제 운동은 ${w}님의 생활이에요.`;
  return {
    eyebrow: `${n(m)} Days at 153`,
    title: `출석 ${n(m)}번째를 채운\n${w}님께`,
    body: `${opener}

바쁜 날도, 쉬고 싶은 날도 있었을 텐데
${w}님은 결국 와서 글러브를 꼈어요.

복싱은 재능보다
'다시 오는 힘'이 만드는 운동이에요.

다음 ${n(next)}번째에서 또 축하할게요.`,
    sign: "— 153 일동",
    cta: "다음 라운드도 함께 🥊",
  };
}

/** 첫 4주 8번 달성 편지 */
export function starterLetter(name: string, goal = STARTER_GOAL, mileage = 0): LetterContent {
  const w = who(name);
  return {
    eyebrow: "First 4 Weeks at 153",
    title: `첫 4주에 ${n(goal)}번을 채운\n${w}님께`,
    body: `처음 4주는 몸도 마음도 가장 낯선 때예요.
그 4주 동안 ${w}님은 ${n(goal)}번이나 체육관에 왔어요.

이만큼 온 분들은 대부분 몇 달 뒤에도
153에서 계속 운동하고 있어요.
${w}님에게도 운동이 습관이 되기 시작했다는 뜻이에요.
${mileage > 0 ? `\n작은 선물을 담았어요.\n마일리지 +${n(mileage)}점\n` : ""}
이제 주 2번, 지금처럼만 와 주세요.
다음 축하도 준비해 둘게요.`,
    sign: "— 153 일동",
    cta: "다음 라운드도 함께 🥊",
  };
}

/** 안 본 축하 → 편지 한 통 (첫 4주 달성이 먼저) */
export function motivationLetter(name: string, m: Motivation): LetterContent | null {
  const u = m.unseen;
  if (!u) return null;
  if (u.starter) return starterLetter(name, m.starter.goal, m.starter.doneMileage || u.mileage);
  if (u.early) return earlyLetter(name, u.early, m.early.steps.length ? m.early.steps : EARLY_STEPS);
  return null;
}

export interface StarterWatchRow {
  userId: string;
  name: string;
  realName: string | null;
  avatarUrl: string | null;
  firstDay: string;
  /** 첫 출석일 = 1일째 */
  day: number;
  count: number;
  lastDay: string | null;
  /** 지금쯤 와 있으면 좋은 횟수(주 2번 속도) */
  expected: number;
  done: boolean;
}

export interface StarterWatchlist {
  on: boolean;
  branch: string | null;
  goal: number;
  days: number;
  today: string | null;
  rows: StarterWatchRow[];
}

/** 코치 화면 '첫 4주 신규' — 서버 get_starter_watchlist */
export function normalizeWatchlist(raw: unknown): StarterWatchlist {
  const r = obj(raw);
  const rows = (Array.isArray(r.rows) ? r.rows : [])
    .map((x) => obj(x))
    .map((x) => ({
      userId: str(x.user_id) ?? "",
      name: str(x.name) ?? "회원",
      realName: str(x.real_name),
      avatarUrl: str(x.avatar_url),
      firstDay: day(x.first_day) ?? "",
      day: int(x.day, 1) || 1,
      count: int(x.count),
      lastDay: day(x.last_day),
      expected: int(x.expected),
      done: x.done === true,
    }))
    .filter((x) => x.userId && x.firstDay);
  return {
    on: r.on === true,
    branch: str(r.branch),
    goal: int(r.goal, STARTER_GOAL) || STARTER_GOAL,
    days: int(r.days, STARTER_DAYS) || STARTER_DAYS,
    today: day(r.today),
    rows,
  };
}

/** 주 2번 속도보다 뒤처졌나 (달성한 회원은 아님) */
export const isBehind = (row: StarterWatchRow, goal = STARTER_GOAL): boolean => !row.done && row.count < goal && row.count < row.expected;

/** 마지막 출석이 며칠 전인가 — '오늘' · '어제' · 'N일 전' */
export function lastVisitLabel(lastDay: string | null, today: string): string {
  if (!lastDay) return "";
  const d = daysBetween(lastDay, today);
  if (d <= 0) return "오늘 왔어요";
  if (d === 1) return "어제 왔어요";
  return `${n(d)}일 전에 왔어요`;
}
