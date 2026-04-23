/**
 * 153 다이어트 · 영양 계산 엔진 (순수 함수).
 *
 * 21일 이후 개인 식단을 자동 생성하기 위한 과학적 기초:
 *   1. BMR — Mifflin-St Jeor 공식 (1990, 현재 임상에서 가장 권장되는 식)
 *   2. TDEE = BMR × activity factor
 *   3. 칼로리 타겟:
 *        · maintenance : TDEE 그대로
 *        · fat_loss    : TDEE − 300~500 kcal (주당 ~0.3~0.5kg 감량)
 *          단, 하한 = BMR × 1.1 (너무 공격적 제한 금지)
 *   4. 매크로 분배:
 *        · 단백질  1.6~2.2 g/kg (감량기 근손실 방지)
 *        · 지방    총 kcal의 25% (호르몬 유지 최소선)
 *        · 탄수화물 나머지
 *
 * 참고 문헌:
 *   · Mifflin et al. Am J Clin Nutr 1990
 *   · ISSN Position Stand: Protein and Exercise (JISSN 2017)
 *   · Hall et al. Quantification of the effect of energy imbalance on bodyweight
 *     (Lancet 2011) — 건강한 감량 폭 -300~500 kcal 근거.
 *
 * 모든 함수는 순수 (side-effect 없음). 테스트 단순.
 */

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type CalorieMode = "maintenance" | "fat_loss";

export interface NutritionInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  mode: CalorieMode;
  /** 감량 폭 kcal (기본 400). 하한 300, 상한 500 으로 clamp. */
  deficitKcal?: number;
}

export interface NutritionTarget {
  bmr: number;
  tdee: number;
  kcalTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** kcal 결정 근거 한 줄. UI에 사용. */
  kcalReason: string;
  /** 매크로 결정 근거 한 줄. */
  macroReason: string;
}

/** 활동 계수. Harris-Benedict 전통적 값. */
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // 하루 거의 앉아있음
  light: 1.375,        // 주 1~3회 가벼운 운동
  moderate: 1.55,      // 주 3~5회 운동
  active: 1.725,       // 주 6~7회 고강도
  very_active: 1.9,    // 1일 2회 훈련 또는 육체노동
};

export const ACTIVITY_LABEL_KO: Record<ActivityLevel, string> = {
  sedentary: "거의 앉아서 생활 (운동 0~1회/주)",
  light: "가벼운 활동 (운동 1~3회/주)",
  moderate: "보통 활동 (운동 3~5회/주)",
  active: "활발한 활동 (운동 6~7회/주)",
  very_active: "매우 활발 (1일 2회 훈련·육체노동)",
};

/** Mifflin-St Jeor BMR. */
export function calcBMR(input: Pick<NutritionInput, "sex" | "ageYears" | "heightCm" | "weightKg">): number {
  const { sex, ageYears, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const offset = sex === "male" ? 5 : -161;
  return Math.round(base + offset);
}

export function calcTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTOR[activity]);
}

/** 안전한 감량 칼로리 — BMR × 1.1 하한 + 요청 deficit clamp. */
export function calcKcalTarget(
  tdee: number,
  bmr: number,
  mode: CalorieMode,
  deficitKcal = 400,
): { kcal: number; reason: string } {
  if (mode === "maintenance") {
    return {
      kcal: tdee,
      reason: `유지 모드는 하루 총 에너지(TDEE) ${tdee} kcal 를 그대로 목표로 합니다.`,
    };
  }
  // fat_loss
  const clampedDeficit = Math.max(300, Math.min(500, deficitKcal));
  const naive = tdee - clampedDeficit;
  const hardFloor = Math.round(bmr * 1.1);
  if (naive < hardFloor) {
    return {
      kcal: hardFloor,
      reason: `건강 하한(BMR×1.1 = ${hardFloor} kcal) 보호. -${clampedDeficit} 공격은 과감량 위험이 있어 완화 적용.`,
    };
  }
  return {
    kcal: naive,
    reason: `TDEE ${tdee} 에서 -${clampedDeficit} kcal. 주당 약 ${((clampedDeficit * 7) / 7700).toFixed(1)} kg 감량 페이스 — 근손실·요요 위험이 낮은 구간.`,
  };
}

/**
 * 매크로 분배.
 *   단백질 우선 확보(1.8 g/kg) → 지방 25% → 탄수 나머지.
 */
export function calcMacros(
  kcalTarget: number,
  weightKg: number,
  mode: CalorieMode,
): { proteinG: number; fatG: number; carbsG: number; reason: string } {
  const proteinPerKg = mode === "fat_loss" ? 1.8 : 1.6;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;

  const fatKcalRatio = 0.25;
  const fatKcal = Math.round(kcalTarget * fatKcalRatio);
  const fatG = Math.round(fatKcal / 9);

  const carbsKcal = Math.max(0, kcalTarget - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  const reason =
    mode === "fat_loss"
      ? `감량기는 근손실 방지를 위해 단백질 ${proteinPerKg}g/kg 우선. 지방 25% 는 호르몬 유지 최소선, 나머지는 탄수화물.`
      : `유지기는 단백질 ${proteinPerKg}g/kg + 지방 25% + 탄수 균형. 주말 유연식을 흡수할 수 있는 폭입니다.`;

  return { proteinG, fatG, carbsG, reason };
}

/** 전체 타겟 묶음 — UI 에서 가장 자주 호출. */
export function computeNutritionTarget(input: NutritionInput): NutritionTarget {
  const bmr = calcBMR(input);
  const tdee = calcTDEE(bmr, input.activity);
  const { kcal, reason: kcalReason } = calcKcalTarget(tdee, bmr, input.mode, input.deficitKcal);
  const { proteinG, fatG, carbsG, reason: macroReason } = calcMacros(
    kcal,
    input.weightKg,
    input.mode,
  );
  return {
    bmr,
    tdee,
    kcalTarget: kcal,
    proteinG,
    fatG,
    carbsG,
    kcalReason,
    macroReason,
  };
}

// ──────────────────────────────────────────────────────────────────
// 끼니별 분배 — 아침·점심·저녁·간식 (식사 수에 따라 자동 조정)
// ──────────────────────────────────────────────────────────────────
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealSlotTarget {
  slot: MealSlot;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** 끼니 수·패턴별 비중 — 2끼일 때 아침 스킵 패턴. */
export function splitTargetsBySlot(
  target: NutritionTarget,
  mealsPerDay: 2 | 3 | 4 = 3,
): MealSlotTarget[] {
  // 비중 선택
  let ratios: Partial<Record<MealSlot, number>>;
  if (mealsPerDay === 2) {
    ratios = { lunch: 0.45, dinner: 0.40, snack: 0.15 };
  } else if (mealsPerDay === 4) {
    ratios = { breakfast: 0.22, lunch: 0.32, dinner: 0.28, snack: 0.18 };
  } else {
    ratios = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
  }

  const slots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
  return slots
    .filter((s) => ratios[s] !== undefined)
    .map((slot) => {
      const r = ratios[slot]!;
      return {
        slot,
        kcal: Math.round(target.kcalTarget * r),
        proteinG: Math.round(target.proteinG * r),
        fatG: Math.round(target.fatG * r),
        carbsG: Math.round(target.carbsG * r),
      };
    });
}

export const MEAL_SLOT_LABEL_KO: Record<MealSlot, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};
