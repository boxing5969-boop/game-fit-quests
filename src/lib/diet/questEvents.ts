/**
 * 153 다이어트 — 퀘스트 이벤트(diet_quest_events) 순수 로직.
 *
 * 책임:
 *   1. 완료 시점(Date) → timing_grade(perfect/good/late) 판정
 *   2. severity + grade → base_score / timing_bonus / total_score 계산
 *   3. 미션 ↔ 데이터컬럼 매핑 helper (linkedHabitColumn → questEvent meta)
 *
 * 보호 함수와 분리:
 *   - scoreEngine.ts(컬럼 점수)는 절대 건들지 않고, 본 모듈은 "이벤트당" 점수만 다룸.
 *   - 둘은 독립적으로 동작 — 일자별 총점은 scoreEngine 가, 시계열 누적은 본 모듈이 담당.
 *
 * 순수 함수만 노출 — Supabase·React 의존 없음.
 */

import type {
  DietMissionSeverity,
  DietMissionTemplate,
} from "@/data/diet/missionTemplates";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type TimingGrade = "perfect" | "good" | "late";

export type QuestSourceKind =
  | "habit"
  | "photo"
  | "manual"
  | "comeback"
  | "system";

export interface QuestScoreBreakdown {
  base: number;
  bonus: number;
  total: number;
}

// ──────────────────────────────────────────────────────────────────
// 임계값 — 운영 중 조정 가능
// ──────────────────────────────────────────────────────────────────

/**
 * 타이밍 등급 컷오프(시 단위, 24시간).
 *   · 18시 전 완료 → perfect
 *   · 22시 전 완료 → good
 *   · 22시 이후    → late
 *
 * 특정 미션이 시간대에 민감하면(예: 야식 멈춤) 호출부에서 별도 grade 강제 가능.
 */
export const QUEST_TIMING_CUTOFF = Object.freeze({
  perfectBeforeHour: 18,
  goodBeforeHour: 22,
});

/** 미션 severity 별 기본 점수 — core 가 optional 의 2배. */
export const QUEST_BASE_SCORE: Readonly<Record<DietMissionSeverity, number>> =
  Object.freeze({
    core: 10,
    optional: 5,
  });

/** 타이밍 보너스 — perfect 가장 큼, late 0. */
export const QUEST_TIMING_BONUS: Readonly<Record<TimingGrade, number>> =
  Object.freeze({
    perfect: 5,
    good: 2,
    late: 0,
  });

// ──────────────────────────────────────────────────────────────────
// Pure functions
// ──────────────────────────────────────────────────────────────────

/**
 * 완료 시점의 시간대를 보고 등급 판정.
 *   하루 내 완료한 미션은 perfect/good 안에 들어가도록 컷오프 설정.
 *   다음날 새벽 완료(0~5시)도 late 처리.
 */
export function gradeTiming(at: Date = new Date()): TimingGrade {
  const h = at.getHours();
  if (h >= 0 && h < 5) return "late"; // 자정 넘긴 늦밤 회복
  if (h < QUEST_TIMING_CUTOFF.perfectBeforeHour) return "perfect";
  if (h < QUEST_TIMING_CUTOFF.goodBeforeHour) return "good";
  return "late";
}

/** severity + grade → 점수 분해. DB 저장 시 base_score / timing_bonus / total_score 컬럼에 그대로 매핑. */
export function computeQuestScore(
  severity: DietMissionSeverity,
  grade: TimingGrade,
): QuestScoreBreakdown {
  const base = QUEST_BASE_SCORE[severity];
  const bonus = QUEST_TIMING_BONUS[grade];
  return {
    base,
    bonus,
    total: base + bonus,
  };
}

/**
 * "이번 저장에서 새로 체크된 미션" 추출.
 *   prev / next 두 응답을 비교해 false|null → true 로 변경된 컬럼만 골라냄.
 *   waterMlThreshold 미션도 prev<thr → next>=thr 전환을 새 완료로 인정.
 *
 * 반환: emit 해야 할 (mission, mealSlot?) 페어 목록.
 */
export interface HabitDiffInput {
  prev: {
    protein_first?: boolean | null;
    veggies_natural?: boolean | null;
    sugary_drink_avoided?: boolean | null;
    late_night_snack_avoided?: boolean | null;
    gym_attended?: boolean | null;
    water_ml?: number | null;
  } | null;
  next: {
    protein_first?: boolean | null;
    veggies_natural?: boolean | null;
    sugary_drink_avoided?: boolean | null;
    late_night_snack_avoided?: boolean | null;
    gym_attended?: boolean | null;
    water_ml?: number | null;
  };
  missions: readonly DietMissionTemplate[];
}

export interface HabitDiffEntry {
  mission: DietMissionTemplate;
}

export function diffHabitsForEmission(input: HabitDiffInput): HabitDiffEntry[] {
  const out: HabitDiffEntry[] = [];
  const prev = input.prev ?? {};
  const next = input.next;

  const habitColumns = [
    "protein_first",
    "veggies_natural",
    "sugary_drink_avoided",
    "late_night_snack_avoided",
    "gym_attended",
  ] as const;

  for (const col of habitColumns) {
    const wasTrue = prev[col] === true;
    const isTrue = next[col] === true;
    if (wasTrue || !isTrue) continue; // 새로 체크된 것만
    for (const m of input.missions) {
      if (m.linkedHabitColumn === col) {
        out.push({ mission: m });
      }
    }
  }

  // 물 임계 — water_ml 이 threshold 도달
  const prevWater = prev.water_ml ?? 0;
  const nextWater = next.water_ml ?? 0;
  for (const m of input.missions) {
    if (m.waterMlThreshold === undefined) continue;
    if (prevWater >= m.waterMlThreshold) continue; // 이미 달성
    if (nextWater < m.waterMlThreshold) continue; // 아직 미달
    out.push({ mission: m });
  }

  return out;
}
