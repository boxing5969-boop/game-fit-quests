/**
 * 153 다이어트 — 점수 엔진.
 *
 * ──────────────────────────────────────────────────────────────────
 * 철학
 * ──────────────────────────────────────────────────────────────────
 *   • 체중 감소량 경쟁 금지. 모든 점수는 "얼마나 잘 지켰나" 기준.
 *   • 단일 일자 0~100점, 주간 평균 0~100, 21일 누적 완주율 0~100.
 *   • 결측치는 감점 아닌 "0점 취급" — 벌점 금지, 회복 가능성 유지.
 *
 * ──────────────────────────────────────────────────────────────────
 * 일간 점수 구성 (총 100)
 * ──────────────────────────────────────────────────────────────────
 *   • 출석 30점 — gym_attended=true 시 full
 *   • 사진 인증 30점 — photosCount >= 1 이면 full
 *   • 수치 20점 — water/sleep/step 3항목 각 ≈6.67점 (달성 임계값 충족)
 *   • 주간 체크인 20점 — 해당 주의 weekly_review 존재 시 full
 *
 * 임계값 (기본 — 청소년/성인 동일. 향후 트랙별 조정 가능):
 *   water_ml  >= 1500
 *   sleep_hrs >= 6.5
 *   step      >= 6000
 */

import type { DailyHabitsPayload } from "@/services/dietService";

// ──────────────────────────────────────────────────────────────────
// Weights
// ──────────────────────────────────────────────────────────────────
export const DIET_SCORE_WEIGHTS = Object.freeze({
  attendance: 30,
  photoProof: 30,
  metrics: 20,
  weeklyReview: 20,
});

export const DIET_METRIC_THRESHOLDS = Object.freeze({
  waterMl: 1500,
  sleepHours: 6.5,
  stepCount: 6000,
});

const METRIC_PER_ITEM = DIET_SCORE_WEIGHTS.metrics / 3; // ≈6.67

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface DietDailyScoreInput {
  /** 체육관 출석 (수동 체크 또는 자동 연결) */
  gymAttended: boolean | null;
  /** 업로드된 식단 사진 개수 */
  photosCount: number;
  /** 물 섭취 ml — null 허용 (미기록) */
  waterMl: number | null;
  /** 수면 시간 — null 허용 */
  sleepHours: number | null;
  /** 걸음 수 — null 허용 */
  stepCount: number | null;
  /** 이 날이 속한 주의 weekly_review 존재 여부 */
  hasWeeklyReview: boolean;
}

export interface DietDailyScoreBreakdown {
  attendance: number;
  photoProof: number;
  metrics: number;
  weeklyReview: number;
  total: number; // 0~100
  metricsHits: number; // 0~3 (어느 임계값을 달성했는지)
}

// ──────────────────────────────────────────────────────────────────
// Daily score
// ──────────────────────────────────────────────────────────────────

export function computeDietDailyScore(
  input: DietDailyScoreInput,
): DietDailyScoreBreakdown {
  const attendance =
    input.gymAttended === true ? DIET_SCORE_WEIGHTS.attendance : 0;
  const photoProof =
    input.photosCount >= 1 ? DIET_SCORE_WEIGHTS.photoProof : 0;

  let metricsHits = 0;
  if ((input.waterMl ?? 0) >= DIET_METRIC_THRESHOLDS.waterMl) metricsHits += 1;
  if ((input.sleepHours ?? 0) >= DIET_METRIC_THRESHOLDS.sleepHours)
    metricsHits += 1;
  if ((input.stepCount ?? 0) >= DIET_METRIC_THRESHOLDS.stepCount)
    metricsHits += 1;
  const metrics = Math.round(metricsHits * METRIC_PER_ITEM);

  const weeklyReview = input.hasWeeklyReview
    ? DIET_SCORE_WEIGHTS.weeklyReview
    : 0;

  const total = Math.min(
    100,
    attendance + photoProof + metrics + weeklyReview,
  );

  return {
    attendance,
    photoProof,
    metrics,
    weeklyReview,
    total,
    metricsHits,
  };
}

/** DB log row 와 photosCount·weekly 참조를 받아 daily 점수 계산 */
export function scoreFromLogRow(
  log: {
    gym_attended: boolean | null;
    water_ml: number | null;
    sleep_hours: number | null;
    step_count: number | null;
  },
  photosCount: number,
  hasWeeklyReview: boolean,
): DietDailyScoreBreakdown {
  return computeDietDailyScore({
    gymAttended: log.gym_attended,
    photosCount,
    waterMl: log.water_ml,
    sleepHours: log.sleep_hours,
    stepCount: log.step_count,
    hasWeeklyReview,
  });
}

// ──────────────────────────────────────────────────────────────────
// Weekly / 21-day
// ──────────────────────────────────────────────────────────────────

/**
 * 주간 점수 = 해당 주 7일의 daily score 평균. 기록이 없는 날은 0 점으로 채움.
 * 주의: dailyScores 배열 길이는 7 이어야 함. 7보다 짧으면 나머지를 0 으로 취급.
 */
export function computeDietWeeklyScore(dailyScores: number[]): number {
  const filled = [...dailyScores];
  while (filled.length < 7) filled.push(0);
  const sum = filled.slice(0, 7).reduce((a, b) => a + b, 0);
  return Math.round(sum / 7);
}

/**
 * 21일 누적 수행률 — 승인된 일수 / 21.
 * ranking 용 — score 평균이 아니라 "승인된 일수" 기반 (코치 승인이 게이트).
 */
export function compute21DayCompletionRate(approvedDays: number): number {
  return Math.max(0, Math.min(100, Math.round((approvedDays / 21) * 100)));
}

/**
 * 미션 완료율 — "linkedHabitColumn 으로 매핑된 habit 이 체크된 비율".
 * 미션 템플릿과 log 응답을 받아 0~100 반환. 링크 없는 미션은 분모에서 제외.
 */
export function computeMissionCompletionRate(
  missions: ReadonlyArray<{
    linkedHabitColumn?:
      | "protein_first"
      | "veggies_natural"
      | "sugary_drink_avoided"
      | "late_night_snack_avoided"
      | "gym_attended";
  }>,
  responses: DailyHabitsPayload,
): number {
  const linked = missions.filter((m) => !!m.linkedHabitColumn);
  if (linked.length === 0) return 0;
  const hits = linked.reduce((acc, m) => {
    const key = m.linkedHabitColumn!;
    return acc + (responses[key] === true ? 1 : 0);
  }, 0);
  return Math.round((hits / linked.length) * 100);
}

// ──────────────────────────────────────────────────────────────────
// Missing value helper — "이 날이 공란인가"
// ──────────────────────────────────────────────────────────────────
export function isLogEmpty(
  log: {
    gym_attended?: boolean | null;
    water_ml?: number | null;
    sleep_hours?: number | null;
    step_count?: number | null;
    protein_first?: boolean | null;
    veggies_natural?: boolean | null;
    sugary_drink_avoided?: boolean | null;
    late_night_snack_avoided?: boolean | null;
    memo?: string | null;
  } | null,
): boolean {
  if (!log) return true;
  const checkFields = [
    log.gym_attended,
    log.protein_first,
    log.veggies_natural,
    log.sugary_drink_avoided,
    log.late_night_snack_avoided,
  ];
  const hasAnyCheck = checkFields.some((v) => v === true || v === false);
  const hasAnyNumber = [log.water_ml, log.sleep_hours, log.step_count].some(
    (v) => typeof v === "number",
  );
  const hasMemo = typeof log.memo === "string" && log.memo.trim().length > 0;
  return !(hasAnyCheck || hasAnyNumber || hasMemo);
}
