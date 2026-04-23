/**
 * 153 다이어트 · 하루 식단 자동 생성 엔진.
 *
 * 입력: NutritionTarget · 식단 패턴 · 제한(채식/알레르기/불호)
 * 출력: 끼니별 메뉴 선택 + 총 영양 합산 + 오차율
 *
 * 전략:
 *   1. 끼니별 타겟 kcal/단백질을 splitTargetsBySlot 으로 할당
 *   2. 각 끼니에서 필터링된 메뉴 중 "kcal 근접 + 단백질 충족 + 패턴 적합" 1개 선택
 *   3. 주간 다양성은 seed 기반 rotation — 같은 메뉴 연속 금지
 *   4. 간식 슬롯은 선택적 — 총 kcal 대비 부족/초과 보정
 *
 * 결정성: 같은 seed + 같은 입력이면 같은 결과. "다시 뽑기" 는 seed 만 바꿈.
 */

import {
  MEAL_LIBRARY,
  filterMenus,
  type MealItem,
} from "@/data/nutrition/mealLibrary";
import {
  splitTargetsBySlot,
  type MealSlot,
  type MealSlotTarget,
  type NutritionTarget,
} from "./nutritionEngine";

export interface MealPlanInput {
  target: NutritionTarget;
  mealsPerDay?: 2 | 3 | 4;
  dietaryRestrictions?: string[];  // vegan, vegetarian, halal 등
  dislikedIngredients?: string[];
  preferPatterns?: string[];       // pattern_tags
  /** 임의성 시드 (0~999). "다시 뽑기" 시 증가. */
  seed?: number;
}

export interface MealPlanPick {
  slot: MealSlot;
  target: MealSlotTarget;
  item: MealItem | null;
}

export interface MealPlanResult {
  picks: MealPlanPick[];
  totals: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
  coverage: {
    kcalRatio: number;      // totals.kcal / target.kcal
    proteinRatio: number;
  };
  seed: number;
}

/** 제한으로 태그 블랙리스트 변환. */
function restrictionsToExcludeTags(
  restrictions: string[] = [],
): string[] {
  const excl: string[] = [];
  if (restrictions.includes("vegan")) {
    excl.push("유제품");
  }
  // 채식은 고기를 이름으로 제외 — 태그 부족. ingredient 필터로 보강.
  return excl;
}

function restrictionsToExcludeIngredients(
  restrictions: string[] = [],
  disliked: string[] = [],
): string[] {
  const base = [...disliked];
  if (restrictions.includes("vegan") || restrictions.includes("vegetarian")) {
    base.push("닭", "소", "돼지", "생선", "연어", "참치", "새우", "고등어", "삼치", "동태");
  }
  if (restrictions.includes("no_dairy")) {
    base.push("요거트", "우유", "치즈");
  }
  if (restrictions.includes("no_seafood")) {
    base.push("생선", "연어", "참치", "새우", "고등어", "삼치", "동태");
  }
  return base;
}

/** 매우 단순한 seeded PRNG (Mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 끼니 1개 선택. 점수 = 칼로리 근접 + 단백질 충족 + 패턴 적합.
 * 같은 끼니에서 이전 선택과 겹치지 않도록 excludeCodes 제외.
 */
function pickOneMeal(opts: {
  slot: MealSlot;
  target: MealSlotTarget;
  excludeCodes: Set<string>;
  excludeTags: string[];
  excludeIngredients: string[];
  preferPatterns?: string[];
  rng: () => number;
}): MealItem | null {
  const pool = filterMenus({
    slot: opts.slot,
    excludeTags: opts.excludeTags,
    excludeIngredients: opts.excludeIngredients,
    preferPatterns: opts.preferPatterns,
  }).filter((m) => !opts.excludeCodes.has(m.code));

  if (pool.length === 0) return null;

  // 스코어: kcal 근접(-) + 단백질 충족(+) + 패턴 매칭(+) + 난수 타이브레이커
  const scored = pool.map((m) => {
    const kcalDiff = Math.abs(m.kcal - opts.target.kcal);
    const kcalScore = 300 - Math.min(kcalDiff, 300); // 0~300
    const proteinScore = m.proteinG >= opts.target.proteinG * 0.8 ? 120 : 0;
    const patternScore =
      (m.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length * 60;
    const jitter = opts.rng() * 40; // 난수 타이브레이커 (너무 강하지 않게)
    return { m, score: kcalScore + proteinScore + patternScore + jitter };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].m;
}

export function generateMealPlan(input: MealPlanInput): MealPlanResult {
  const seed = input.seed ?? Math.floor(Math.random() * 1000);
  const rng = mulberry32(seed);

  const slotTargets = splitTargetsBySlot(input.target, input.mealsPerDay ?? 3);
  const excludeTags = restrictionsToExcludeTags(input.dietaryRestrictions);
  const excludeIngredients = restrictionsToExcludeIngredients(
    input.dietaryRestrictions,
    input.dislikedIngredients,
  );

  const used = new Set<string>();
  const picks: MealPlanPick[] = slotTargets.map((t) => {
    const item = pickOneMeal({
      slot: t.slot,
      target: t,
      excludeCodes: used,
      excludeTags,
      excludeIngredients,
      preferPatterns: input.preferPatterns,
      rng,
    });
    if (item) used.add(item.code);
    return { slot: t.slot, target: t, item };
  });

  const totals = picks.reduce(
    (acc, p) => {
      if (!p.item) return acc;
      acc.kcal += p.item.kcal;
      acc.proteinG += p.item.proteinG;
      acc.fatG += p.item.fatG;
      acc.carbsG += p.item.carbsG;
      return acc;
    },
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );

  return {
    picks,
    totals,
    coverage: {
      kcalRatio: input.target.kcalTarget > 0 ? totals.kcal / input.target.kcalTarget : 0,
      proteinRatio:
        input.target.proteinG > 0 ? totals.proteinG / input.target.proteinG : 0,
    },
    seed,
  };
}

/** 외식/자유식 swap — 지정 슬롯을 교체 + 다음 끼니는 "복귀" 톤(저탄수·고단백)으로 재선택.
 *  원래 NutritionTarget 은 그대로 유지 — 끼니별 target 은 이미 slotTargets 에 내장.
 */
export interface SwapInput {
  plan: MealPlanResult;
  target: NutritionTarget;
  slotToSwap: MealSlot;
  replacement: MealItem;
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  seed?: number;
}

export function swapMealWithAutoAdjust(input: SwapInput): MealPlanResult {
  const seed = input.seed ?? Math.floor(Math.random() * 1000);
  const rng = mulberry32(seed);

  // 해당 슬롯 교체
  const picks = input.plan.picks.map((p) =>
    p.slot === input.slotToSwap ? { ...p, item: input.replacement } : p,
  );

  // 다음 슬롯 찾기 → "복귀" 톤으로 재선택 (late_binge 패턴 = 저녁 가볍게)
  const idx = picks.findIndex((p) => p.slot === input.slotToSwap);
  const nextIdx = idx >= 0 && idx + 1 < picks.length ? idx + 1 : -1;

  if (nextIdx >= 0) {
    const used = new Set(
      picks
        .filter((p, i) => p.item && i !== nextIdx)
        .map((p) => p.item!.code),
    );
    const replacementNext = pickOneMeal({
      slot: picks[nextIdx].slot,
      target: picks[nextIdx].target,
      excludeCodes: used,
      excludeTags: restrictionsToExcludeTags(input.dietaryRestrictions),
      excludeIngredients: restrictionsToExcludeIngredients(
        input.dietaryRestrictions,
        input.dislikedIngredients,
      ),
      preferPatterns: ["late_binge"], // "다음 끼니는 가볍게" 톤
      rng,
    });
    if (replacementNext) {
      picks[nextIdx] = { ...picks[nextIdx], item: replacementNext };
    }
  }

  // 최종 합산
  const totals = picks.reduce(
    (acc, p) => {
      if (!p.item) return acc;
      acc.kcal += p.item.kcal;
      acc.proteinG += p.item.proteinG;
      acc.fatG += p.item.fatG;
      acc.carbsG += p.item.carbsG;
      return acc;
    },
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );

  return {
    picks,
    totals,
    coverage: {
      kcalRatio: input.target.kcalTarget > 0 ? totals.kcal / input.target.kcalTarget : 0,
      proteinRatio:
        input.target.proteinG > 0 ? totals.proteinG / input.target.proteinG : 0,
    },
    seed,
  };
}

// 참조 무시 경고 방지
void MEAL_LIBRARY;
