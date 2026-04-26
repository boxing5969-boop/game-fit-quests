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
  filterMenus,
  type MealItem,
} from "@/data/nutrition/mealLibrary";
import {
  evaluateFiveNutrients,
  splitTargetsBySlot,
  type DailyNutrientSum,
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
    fiberG: number;
  };
  coverage: {
    kcalRatio: number;      // totals.kcal / target.kcal
    proteinRatio: number;
  };
  nutrients: DailyNutrientSum;
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
  // jitter 폭을 충분히 키워 reroll 시 1순위가 자주 바뀌도록 — 결정성은 mulberry32
  // 시드로 유지되므로 같은 시드면 같은 결과, 시드가 바뀌면 결과도 분명히 변경.
  const scored = pool.map((m) => {
    const kcalDiff = Math.abs(m.kcal - opts.target.kcal);
    const kcalScore = 300 - Math.min(kcalDiff, 300); // 0~300
    const proteinScore = m.proteinG >= opts.target.proteinG * 0.8 ? 120 : 0;
    const patternScore =
      (m.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length * 60;
    const jitter = opts.rng() * 180; // 0~180 — 좁은 풀에서도 1순위 재배치 유도
    return { m, score: kcalScore + proteinScore + patternScore + jitter };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].m;
}

/** 하루 최소 1개 프로바이오틱 메뉴 보장. */
function ensureDailyProbiotic(
  picks: MealPlanPick[],
  excludeTags: string[],
  excludeIngredients: string[],
): MealPlanPick[] {
  if (picks.some((p) => p.item?.hasProbiotic)) return picks;

  const swapOrder: MealSlot[] = ["snack", "breakfast", "lunch", "dinner"];
  const used = new Set(picks.filter((p) => p.item).map((p) => p.item!.code));

  for (const slot of swapOrder) {
    const idx = picks.findIndex((p) => p.slot === slot);
    if (idx < 0) continue;
    const currentCode = picks[idx].item?.code;
    if (currentCode) used.delete(currentCode);

    const probioticOnly = filterMenus({
      slot: picks[idx].slot,
      excludeTags,
      excludeIngredients,
      requireProbiotic: true,
    }).filter((m) => !used.has(m.code));

    if (probioticOnly.length > 0) {
      picks[idx] = { ...picks[idx], item: probioticOnly[0] };
      return picks;
    }
    if (currentCode) used.add(currentCode);
  }
  return picks;
}

/**
 * 영양소 부족 자동 보강 — 단백질 최우선, 그 다음 섬유질·다양성.
 *
 * 원칙:
 *   1. 단백질 ≥ 95% 보장 (최우선): iteratively 가장 낮은 단백질 끼니를 고단백 메뉴로 교체.
 *      필요 시 아침·간식 모두 쉐이크 계열 허용 (회원 정책).
 *   2. 단백질 충족 후 섬유질 < 80%면 non-쉐이크 슬롯을 고섬유로 교체 (단, 단백질 손해 없이)
 *   3. 비타민/무기질 다양성 부족 시 non-쉐이크 슬롯을 다양성 높은 메뉴로 교체 (단, 단백질 손해 없이)
 *
 * 간식 슬롯이 없는 2끼 식단이면 가장 여유 있는 끼니부터 교체.
 */

const PROTEIN_TARGET_RATIO = 0.95; // 95% 이상 충족 보장

/** 단백질 95% 보장 — 최대 4회 반복 교체. 쉐이크를 여러 끼니에 허용. */
function guaranteeProtein(
  picks: MealPlanPick[],
  target: NutritionTarget,
  excludeTags: string[],
  excludeIngredients: string[],
): MealPlanPick[] {
  const MAX_ITERATIONS = 4;
  const requiredProtein = target.proteinG * PROTEIN_TARGET_RATIO;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const agg = aggregateNutrients(picks);
    if (agg.nutrients.proteinG >= requiredProtein) return picks;

    // 현재 가장 단백질 낮은 슬롯 찾기 (이미 쉐이크인 슬롯은 제외 — 더 올리기 어려움)
    let lowestIdx = -1;
    let lowestProtein = Infinity;
    picks.forEach((p, i) => {
      if (!p.item) return;
      // 쉐이크 계열이고 단백질 30g+ 인 슬롯은 건들지 않음 (이미 충분히 고단백)
      if (p.item.tags.includes("쉐이크") && p.item.proteinG >= 30) return;
      if (p.item.proteinG < lowestProtein) {
        lowestProtein = p.item.proteinG;
        lowestIdx = i;
      }
    });
    if (lowestIdx < 0) return picks;

    const used = new Set(
      picks.filter((p, i) => p.item && i !== lowestIdx).map((p) => p.item!.code),
    );

    // 후보: 쉐이크 + 고단백(≥25g) 메뉴 우선. slot 일치.
    const candidates = filterMenus({
      slot: picks[lowestIdx].slot,
      excludeTags,
      excludeIngredients,
    })
      .filter((m) => !used.has(m.code) && m.proteinG > lowestProtein)
      .sort((a, b) => b.proteinG - a.proteinG);

    if (candidates.length === 0) return picks;
    picks[lowestIdx] = { ...picks[lowestIdx], item: candidates[0] };
  }
  return picks;
}

/** 섬유질·다양성 보강 — 단백질을 손해 보지 않는 선에서만. */
function fillNutrientGaps(
  picks: MealPlanPick[],
  target: NutritionTarget,
  excludeTags: string[],
  excludeIngredients: string[],
): MealPlanPick[] {
  // 우선 단백질 보장 pass
  picks = guaranteeProtein(picks, target, excludeTags, excludeIngredients);

  const supplementOrder: MealSlot[] = ["snack", "breakfast", "dinner", "lunch"];
  const findSoftSlot = () => {
    // 쉐이크·고단백 슬롯은 건드리지 않음 (단백질 손해 방지)
    for (const s of supplementOrder) {
      const idx = picks.findIndex((p) => p.slot === s);
      if (idx < 0) continue;
      const item = picks[idx].item;
      if (item?.tags.includes("쉐이크")) continue;
      if (item && item.proteinG >= target.proteinG * 0.25) continue; // 끼니별 ~25% 이상 단백질 기여면 보존
      return idx;
    }
    // 전부 고단백이면 가장 첫 슬롯 반환 (교체 후 guaranteeProtein 이 다시 돌아옴)
    for (const s of supplementOrder) {
      const idx = picks.findIndex((p) => p.slot === s);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // 섬유질 보강 (단백질 손해 없는 경우만)
  const afterP = aggregateNutrients(picks);
  const statusP = evaluateFiveNutrients(afterP.nutrients, target);
  if (statusP.fiber.g < statusP.fiber.target * 0.8) {
    const idx = findSoftSlot();
    if (idx >= 0) {
      const currentP = picks[idx].item?.proteinG ?? 0;
      const used = new Set(
        picks.filter((p, i) => p.item && i !== idx).map((p) => p.item!.code),
      );
      const highFiber = filterMenus({
        slot: picks[idx].slot,
        excludeTags,
        excludeIngredients,
      })
        .filter(
          (m) => !used.has(m.code) && m.fiberG >= 5 && m.proteinG >= currentP - 3,
        )
        .sort((a, b) => b.fiberG - a.fiberG);
      if (highFiber.length > 0) {
        picks[idx] = { ...picks[idx], item: highFiber[0] };
      }
    }
  }

  // 비타민·무기질 다양성 (단백질 손해 없는 경우만)
  const afterFib = aggregateNutrients(picks);
  const statusFib = evaluateFiveNutrients(afterFib.nutrients, target);
  if (
    statusFib.vitamins.count < statusFib.vitamins.target ||
    statusFib.minerals.count < statusFib.minerals.target
  ) {
    const idx = findSoftSlot();
    if (idx >= 0) {
      const currentP = picks[idx].item?.proteinG ?? 0;
      const used = new Set(
        picks.filter((p, i) => p.item && i !== idx).map((p) => p.item!.code),
      );
      const diverse = filterMenus({
        slot: picks[idx].slot,
        excludeTags,
        excludeIngredients,
      })
        .filter(
          (m) =>
            !used.has(m.code) &&
            m.keyVitamins.length + m.keyMinerals.length >= 5 &&
            m.proteinG >= currentP - 3,
        )
        .sort(
          (a, b) =>
            b.keyVitamins.length + b.keyMinerals.length -
            (a.keyVitamins.length + a.keyMinerals.length),
        );
      if (diverse.length > 0) {
        picks[idx] = { ...picks[idx], item: diverse[0] };
      }
    }
  }

  // 단백질이 다시 떨어졌을 수 있으니 마지막으로 보장 pass
  picks = guaranteeProtein(picks, target, excludeTags, excludeIngredients);

  return picks;
}

function aggregateNutrients(picks: MealPlanPick[]): {
  totals: MealPlanResult["totals"];
  nutrients: DailyNutrientSum;
} {
  const totals = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 };
  const vitSet = new Set<string>();
  const minSet = new Set<string>();
  let probioticCount = 0;

  for (const p of picks) {
    if (!p.item) continue;
    totals.kcal += p.item.kcal;
    totals.proteinG += p.item.proteinG;
    totals.fatG += p.item.fatG;
    totals.carbsG += p.item.carbsG;
    totals.fiberG += p.item.fiberG;
    p.item.keyVitamins.forEach((v) => vitSet.add(v));
    p.item.keyMinerals.forEach((m) => minSet.add(m));
    if (p.item.hasProbiotic) probioticCount++;
  }

  return {
    totals,
    nutrients: {
      proteinG: totals.proteinG,
      fatG: totals.fatG,
      carbsG: totals.carbsG,
      fiberG: totals.fiberG,
      vitamins: Array.from(vitSet),
      minerals: Array.from(minSet),
      probioticCount,
    },
  };
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
  let picks: MealPlanPick[] = slotTargets.map((t) => {
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

  // 하루 프로바이오틱 최소 1회 보장
  picks = ensureDailyProbiotic(picks, excludeTags, excludeIngredients);

  // 영양소 부족 자동 보강 — 단백질·섬유질·비타민·무기질 다양성
  picks = fillNutrientGaps(picks, input.target, excludeTags, excludeIngredients);

  const { totals, nutrients } = aggregateNutrients(picks);

  return {
    picks,
    totals,
    nutrients,
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

  // 최종 합산 + 5대 영양소
  const { totals, nutrients } = aggregateNutrients(picks);

  return {
    picks,
    totals,
    nutrients,
    coverage: {
      kcalRatio: input.target.kcalTarget > 0 ? totals.kcal / input.target.kcalTarget : 0,
      proteinRatio:
        input.target.proteinG > 0 ? totals.proteinG / input.target.proteinG : 0,
    },
    seed,
  };
}

