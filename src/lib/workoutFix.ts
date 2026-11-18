/**
 * ⏱ 운동 시간 고치기 — 화면 계산 한 곳 (2026-11-19 선릉역점 회원 제안 → 대표님 「이거진행」)
 *   「깜박잊고 운동종료를 안눌렀는데 12시 지나니까 자동반영이되었어요 · 운동한시간을 수정할수있었으면좋겠어요」
 *
 * 규칙은 서버(get_my_workout_fix · fix_my_workout_end — 20261119020109_workout_fix_end.sql)에 있다:
 *   오늘 · 어제 그날 첫 출석 중 운동 끝 기록이 없는 날(기본 66분) · 67 ~ 180분 · 지난 시각까지 · 한 번만 · 어제 것은 오늘 밤 12시까지.
 * 여기는 서버 값을 읽고(믿지 않고 다듬기) · 고를 칸(10분 단위)과 글만 만든다. XP · 승급 숫자는 계산하지 않는다(서버 값만).
 * 시험: workoutFix.test.ts
 */
import { durationLabel as formatMinutes } from "@/lib/attendanceHistory";

export interface WorkoutFixItem {
  /** 그날(한국) 'YYYY-MM-DD' */
  day: string;
  today: boolean;
  /** 입장 시각(ISO) — 얼굴 인식 · QR 첫 출석 */
  startedAt: string;
  /** 끝 기록이 없을 때 치는 시간(66분) */
  defaultMinutes: number;
  /** 고를 수 있는 가장 짧은 시간(67분) */
  minMinutes: number;
  /** 고를 수 있는 가장 긴 시간 — 180분 또는 입장부터 지금까지 */
  maxMinutes: number;
  /** 고칠 수 있는 끝(ISO) — 그다음 날 밤 12시 */
  until: string | null;
}

/** 고를 칸 간격(분) */
export const FIX_STEP_MINUTES = 10;
/** 오늘 기록 — 입장부터 이만큼 지나면 '운동 종료' 대신 '끝난 시각 고르기' (지금 누르면 180분 상한 · 4시간 넘으면 기본) */
export const FIX_TODAY_AFTER_MINUTES = 180;

const num = (v: unknown, fb: number): number => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? Math.round(x) : fb;
};
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const iso = (v: unknown): string | null =>
  typeof v === "string" && Number.isFinite(new Date(v).getTime()) ? v : null;

/** 서버 값 → 고칠 기록 목록 (모양이 틀린 줄은 뺀다 · 최근 날 먼저) */
export function parseWorkoutFix(raw: unknown): WorkoutFixItem[] {
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return [];
  const out: WorkoutFixItem[] = [];
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const day = ymd(r.day);
    const startedAt = iso(r.started_at);
    if (!day || !startedAt) continue;
    const defaultMinutes = num(r.default_minutes, 66);
    const minMinutes = Math.max(defaultMinutes + 1, num(r.min_minutes, defaultMinutes + 1));
    const maxMinutes = Math.min(180, num(r.max_minutes, 0));
    out.push({ day, today: r.today === true, startedAt, defaultMinutes, minMinutes, maxMinutes, until: iso(r.until) });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}

/** 고를 칸 — 10분 단위(70 · 80 … 180) 중 고를 수 있는 것. 고를 게 없으면 빈 목록 */
export function fixChoices(item: Pick<WorkoutFixItem, "minMinutes" | "maxMinutes">, step = FIX_STEP_MINUTES): number[] {
  const lo = Math.ceil(item.minMinutes / step) * step;
  const hi = Math.min(180, item.maxMinutes);
  const out: number[] = [];
  for (let m = lo; m <= hi; m += step) out.push(m);
  return out;
}

/** 고칠 수 있는 기록인가 — 고를 칸이 하나라도 있고, 고칠 수 있는 끝이 지나지 않음 */
export const fixable = (item: WorkoutFixItem, now = Date.now()): boolean =>
  fixChoices(item).length > 0 && (!item.until || new Date(item.until).getTime() > now);

/** 홈 안내 줄에 띄울 기록 — 어제 기록(오늘 기록은 '내 운동' 머리의 '끝난 시각 고르기'가 맡는다) */
export const yesterdayFix = (items: WorkoutFixItem[], now = Date.now()): WorkoutFixItem | null =>
  items.find((i) => !i.today && fixable(i, now)) ?? null;

/** 오늘 기록 — 입장부터 3시간이 지났는데 끝 기록이 없을 때만 */
export const todayFix = (items: WorkoutFixItem[], elapsedMinutes: number | null | undefined, now = Date.now()): WorkoutFixItem | null =>
  (elapsedMinutes ?? 0) > FIX_TODAY_AFTER_MINUTES ? items.find((i) => i.today && fixable(i, now)) ?? null : null;

/** ISO → 'HH:mm' (한국 시각) */
export const kstHm = (isoText: string): string => {
  const t = new Date(isoText).getTime();
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + 9 * 3600_000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

/** 입장 + 분 → 끝 시각 'HH:mm' (한국 시각) */
export const fixEndLabel = (startedAt: string, minutes: number): string =>
  kstHm(new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString());

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
/** 'YYYY-MM-DD' → '11월 18일(화)' */
export const fixDayLabel = (day: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay();
  return `${Number(m[2])}월 ${Number(m[3])}일(${WEEKDAY[dow]})`;
};

/** '어제' · '오늘' */
export const fixDayWord = (item: Pick<WorkoutFixItem, "today">): string => (item.today ? "오늘" : "어제");

/** 언제까지 — 어제 기록 = '오늘 밤 12시까지' · 오늘 기록 = '내일 밤 12시까지' */
export const fixUntilText = (item: Pick<WorkoutFixItem, "today">): string => (item.today ? "내일 밤 12시까지" : "오늘 밤 12시까지");

/** 홈 안내 줄 글 */
export const fixNoticeTitle = (item: WorkoutFixItem): string =>
  `${fixDayWord(item)} 운동이 기본 ${formatMinutes(item.defaultMinutes)}으로 기록됐어요`;
export const fixNoticeSub = (item: WorkoutFixItem): string =>
  `운동 종료를 깜빡했다면 ${fixUntilText(item)} 고칠 수 있어요`;

/** 다 고친 뒤 알림 글 */
export const fixDoneText = (item: Pick<WorkoutFixItem, "today">, minutes: number, xp: number): string =>
  `${fixDayWord(item)} 운동 ${formatMinutes(minutes)}으로 기록했어요${xp > 0 ? ` · XP +${xp}` : ""} 🥊`;
