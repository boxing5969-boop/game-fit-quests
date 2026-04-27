/**
 * 153 다이어트 — 퀘스트 타이밍 등급 + 점수 엔진 (Asia/Seoul 기준).
 *
 * 책임:
 *   1. 슬롯(아침/점심/저녁/물/운동) + 완료시각 → timing grade 판정
 *   2. 미션 속성(핵심·선택·복귀·전체완료) → 점수 분해 (base + bonus + total)
 *
 * 보호 함수와 분리:
 *   - questEvents.ts(보편 컷오프 18시·22시)와 별개로, 본 모듈은 슬롯별 정밀 컷오프.
 *   - 점수 공식도 본 모듈은 "complete bonus(+20)"·"comeback(+8)" 옵션 포함 → 회원 동기 강화.
 *
 * 순수 함수만 노출. 시간대는 한국 표준시(Asia/Seoul, UTC+9) 고정.
 */

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type TimingGrade = "perfect" | "good" | "late";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * 슬롯 키 — 식사 슬롯에 더해 "물·운동" 도 같은 grade 시스템에서 다룸.
 *   · water  : 수분 섭취 권장 시간대
 *   · workout: 운동(체육관 출석·셀프 트레이닝)
 */
export type QuestSlotKey = MealSlot | "water" | "workout";

// ──────────────────────────────────────────────────────────────────
// 시간대 컷오프 (Asia/Seoul, 24시간 분 단위)
//   · perfect: 시작분 이상 ~ goodFromMin 미만
//   · good   : goodFromMin 이상 ~ lateFromMin 미만
//   · late   : 그 외 (시작 전·lateFromMin 이후)
//
// 단위: hours*60 + minutes (예: 09:30 → 570)
// ──────────────────────────────────────────────────────────────────

interface SlotCutoff {
  /** perfect 시작 (포함) — 그 이전은 "이른 새벽 / 직전" 으로 late 처리 */
  perfectFromMin: number;
  /** perfect 끝 = good 시작 */
  goodFromMin: number;
  /** good 끝 = late 시작 */
  lateFromMin: number;
}

const t = (h: number, m: number): number => h * 60 + m;

const SLOT_CUTOFFS: Readonly<Record<QuestSlotKey, SlotCutoff>> = Object.freeze({
  // 아침: perfect 05:00~09:30 / good 09:31~11:00 / 이후 late
  breakfast: {
    perfectFromMin: t(5, 0),
    goodFromMin: t(9, 31),
    lateFromMin: t(11, 1),
  },
  // 점심: perfect 11:00~14:00 / good 14:01~15:30 / 이후 late
  lunch: {
    perfectFromMin: t(11, 0),
    goodFromMin: t(14, 1),
    lateFromMin: t(15, 31),
  },
  // 저녁: perfect 17:00~20:30 / good 20:31~22:00 / 이후 late
  dinner: {
    perfectFromMin: t(17, 0),
    goodFromMin: t(20, 31),
    lateFromMin: t(22, 1),
  },
  // 간식: 식사 전후 어디든 — perfect 10:00~22:00, good 22:01~24:00, 이후 late
  snack: {
    perfectFromMin: t(10, 0),
    goodFromMin: t(22, 1),
    lateFromMin: t(24, 0), // 24:00 == 다음 0시 → 이후 모두 late
  },
  // 물: perfect 06:00~12:00 / good 12:01~18:00 / 이후 late
  water: {
    perfectFromMin: t(6, 0),
    goodFromMin: t(12, 1),
    lateFromMin: t(18, 1),
  },
  // 운동: perfect ~18:00 / good 18:01~22:00 / 이후 late (이른 시각도 perfect 인정)
  workout: {
    perfectFromMin: t(0, 0),
    goodFromMin: t(18, 1),
    lateFromMin: t(22, 1),
  },
});

// ──────────────────────────────────────────────────────────────────
// Asia/Seoul 시간 추출
//   브라우저 로케일 무관하게 KST 기준 분(hours*60+minutes)을 반환.
// ──────────────────────────────────────────────────────────────────

function toSeoulMinutes(at: Date): number {
  // Intl 로 한국 시간의 시·분 추출 — 시스템 timezone 에 의존 안 함.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // hour12:false 인데 일부 환경에서 "24" 가 나올 수 있음 → 0 으로 정규화
  const hh = h === 24 ? 0 : h;
  return hh * 60 + m;
}

// ──────────────────────────────────────────────────────────────────
// gradeTimingBySlot — 슬롯별 등급 판정
// ──────────────────────────────────────────────────────────────────

/**
 * 슬롯 + 완료시각 → timing grade.
 *   기본 시각은 now(). 완료시각이 perfect 구간 시작 전이면 late 로 판정 (식사 슬롯 한정).
 */
export function gradeTimingBySlot(
  slot: QuestSlotKey,
  at: Date = new Date(),
): TimingGrade {
  const minutes = toSeoulMinutes(at);
  const cut = SLOT_CUTOFFS[slot];
  if (minutes < cut.perfectFromMin) {
    // 워크아웃은 새벽도 perfect (perfectFromMin=0). 그 외 슬롯은 시작 전 → late.
    return "late";
  }
  if (minutes < cut.goodFromMin) return "perfect";
  if (minutes < cut.lateFromMin) return "good";
  return "late";
}

// ──────────────────────────────────────────────────────────────────
// 점수 가중치
// ──────────────────────────────────────────────────────────────────

export const QUEST_BASE_SCORE = Object.freeze({
  core: 10,
  optional: 6,
});

export const QUEST_TIMING_BONUS: Readonly<Record<TimingGrade, number>> =
  Object.freeze({
    perfect: 5,
    good: 3,
    late: 0,
  });

/** 하루 전체 미션 완료 시 추가 보너스 — 호출부에서 allDone=true 로 가산. */
export const QUEST_ALL_DONE_BONUS = 20;

/** 복귀 미션(7일 이상 결손 후 재개) 가산 — 호출부에서 isComeback=true 로 가산. */
export const QUEST_COMEBACK_BONUS = 8;

// ──────────────────────────────────────────────────────────────────
// calcQuestScore — 점수 분해
// ──────────────────────────────────────────────────────────────────

export interface QuestScoreParams {
  /** 핵심 미션이면 true (severity === "core"). */
  isCore: boolean;
  /** 슬롯별 timing grade — gradeTimingBySlot() 또는 외부 산출값. */
  timingGrade: TimingGrade;
  /** 복귀 미션(7일+ 결손 후 첫 완료) 보너스 가산. */
  isComeback?: boolean;
  /** 오늘의 모든 미션을 완료했을 때 호출부에서 한 번만 true 로 전달. */
  allDone?: boolean;
}

export interface QuestScoreBreakdown {
  baseScore: number;
  timingBonus: number;
  /** baseScore + timingBonus + (allDone? +20) + (isComeback? +8). */
  total: number;
}

export function calcQuestScore(
  params: QuestScoreParams,
): QuestScoreBreakdown {
  const baseScore = params.isCore
    ? QUEST_BASE_SCORE.core
    : QUEST_BASE_SCORE.optional;
  const timingBonus = QUEST_TIMING_BONUS[params.timingGrade];
  let total = baseScore + timingBonus;
  if (params.allDone) total += QUEST_ALL_DONE_BONUS;
  if (params.isComeback) total += QUEST_COMEBACK_BONUS;
  return { baseScore, timingBonus, total };
}
