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
  getMealPoolByMode,
  type MealItem,
  type MealPlanMode,
} from "@/data/nutrition/mealLibrary";
import {
  evaluateFiveNutrients,
  splitTargetsBySlot,
  type DailyNutrientSum,
  type MealSlot,
  type MealSlotTarget,
  type NutritionTarget,
} from "./nutritionEngine";

/** 식단 모드 — mealLibrary 의 MealPlanMode 와 동일. UI/엔진 단일 출처. */
export type PlanMode = MealPlanMode;

export interface MealPlanInput {
  target: NutritionTarget;
  mealsPerDay?: 2 | 3 | 4;
  dietaryRestrictions?: string[];  // vegan, vegetarian, halal 등
  dislikedIngredients?: string[];
  preferPatterns?: string[];       // pattern_tags
  /** 임의성 시드. "다시 뽑기" 시 큰 폭 변경. */
  seed?: number;
  /** 직전 plan 의 메뉴 코드 — 가급적 회피해서 매번 새 조합 보장. */
  excludeCodes?: readonly string[];
  /** 식단 스타일. 기본은 "random". */
  planMode?: PlanMode;
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
  /** 모드 한정 — getMealPoolByMode 결과 code 집합. 비어 있으면 전체 허용. */
  modePoolCodes?: Set<string>;
  /** 모드별 보너스 점수: 태그 매칭 / 이름 키워드 매칭. */
  bonusTags?: string[];
  bonusNameKeywords?: string[];
}): MealItem | null {
  const basePool = filterMenus({
    slot: opts.slot,
    excludeTags: opts.excludeTags,
    excludeIngredients: opts.excludeIngredients,
    preferPatterns: opts.preferPatterns,
  }).filter((m) => !opts.excludeCodes.has(m.code));

  // 모드 한정 — getMealPoolByMode 결과 안에 있는 코드만. 풀 비면 호출부에서 fallback.
  const pool =
    opts.modePoolCodes && opts.modePoolCodes.size > 0
      ? basePool.filter((m) => opts.modePoolCodes!.has(m.code))
      : basePool;

  if (pool.length === 0) return null;

  // 순수 무작위 선택 — 풀(슬롯+모드+회피) 안에서 균등 확률.
  // 점수 기반 정렬을 폐기한 이유: 결정 점수(kcal 근접·단백질 임계·이름 키워드)가
  // 풀을 6~8개로 좁혀 reroll 시 같은 슬롯이 같은 후보 안에서만 회귀했음.
  // 칼로리/단백질 정밀 추적이 필요하면 회원이 직접 "교체" 버튼으로 조정 가능.
  const idx = Math.floor(opts.rng() * pool.length);
  return pool[idx];
}

/** modePoolCodes 가 지정되어 있으면 풀을 모드 풀에 한정. 비어있으면 전체. 모드 풀에 매칭 0이면 fallback 으로 전체 허용. */
function applyModePool<T extends { code: string }>(
  pool: T[],
  modePoolCodes: Set<string>,
): T[] {
  if (modePoolCodes.size === 0) return pool;
  const filtered = pool.filter((m) => modePoolCodes.has(m.code));
  return filtered.length > 0 ? filtered : pool;
}

/** 하루 최소 1개 프로바이오틱 메뉴 보장. rng + avoidPrev 적용으로 reroll 시 후보 변화. */
function ensureDailyProbiotic(
  picks: MealPlanPick[],
  excludeTags: string[],
  excludeIngredients: string[],
  rng: () => number,
  avoidPrev: Set<string>,
  modePoolCodes: Set<string>,
): MealPlanPick[] {
  if (picks.some((p) => p.item?.hasProbiotic)) return picks;

  const swapOrder: MealSlot[] = ["snack", "breakfast", "lunch", "dinner"];
  const used = new Set(picks.filter((p) => p.item).map((p) => p.item!.code));

  for (const slot of swapOrder) {
    const idx = picks.findIndex((p) => p.slot === slot);
    if (idx < 0) continue;
    const currentCode = picks[idx].item?.code;
    if (currentCode) used.delete(currentCode);

    const probioticBase = applyModePool(
      filterMenus({
        slot: picks[idx].slot,
        excludeTags,
        excludeIngredients,
        requireProbiotic: true,
      }).filter((m) => !used.has(m.code)),
      modePoolCodes,
    );
    // 1차: avoidPrev 까지 회피. 2차: 풀이 비면 회피 풀어서 보장.
    const fresh = probioticBase.filter((m) => !avoidPrev.has(m.code));
    const candidatePool = fresh.length > 0 ? fresh : probioticBase;
    if (candidatePool.length > 0) {
      // 상위 N 중 무작위 — 같은 probiotic 메뉴 고정 방지
      const topN = Math.min(8, candidatePool.length);
      const pickIdx = Math.floor(rng() * topN);
      // candidatePool 은 이미 random 순서가 아니므로 한 번 셔플한 뒤 picks
      const shuffled = candidatePool
        .map((m) => ({ m, r: rng() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.m);
      picks[idx] = { ...picks[idx], item: shuffled[pickIdx] };
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

/** 단백질 95% 보장 — 최대 4회 반복 교체. 쉐이크를 여러 끼니에 허용.
 *  rng + avoidPrev 로 reroll 시마다 다른 후보가 뽑히도록 하되, 단백질 충족은 유지. */
function guaranteeProtein(
  picks: MealPlanPick[],
  target: NutritionTarget,
  excludeTags: string[],
  excludeIngredients: string[],
  rng: () => number,
  avoidPrev: Set<string>,
  modePoolCodes: Set<string>,
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

    // 후보: 슬롯 일치 + 단백질 더 높은 메뉴 + 모드 풀.
    // 1차로 avoidPrev 회피 + 단백질 상위권에서 jitter, 풀이 너무 좁으면 fallback.
    const baseCandidates = applyModePool(
      filterMenus({
        slot: picks[lowestIdx].slot,
        excludeTags,
        excludeIngredients,
      }).filter((m) => !used.has(m.code) && m.proteinG > lowestProtein),
      modePoolCodes,
    );
    const fresh = baseCandidates.filter((m) => !avoidPrev.has(m.code));
    // 단백질 상위 8개 중 무작위 1개 — 매 reroll 마다 다른 후보로 단백질 보강.
    const topByProtein = (fresh.length >= 4 ? fresh : baseCandidates)
      .slice()
      .sort((a, b) => b.proteinG - a.proteinG)
      .slice(0, 8);

    if (topByProtein.length === 0) return picks;
    const pickIdx = Math.floor(rng() * topByProtein.length);
    picks[lowestIdx] = { ...picks[lowestIdx], item: topByProtein[pickIdx] };
  }
  return picks;
}

/** 섬유질·다양성 보강 — 단백질을 손해 보지 않는 선에서만.
 *  rng + avoidPrev 로 reroll 시마다 다른 보강 후보가 뽑히도록. */
function fillNutrientGaps(
  picks: MealPlanPick[],
  target: NutritionTarget,
  excludeTags: string[],
  excludeIngredients: string[],
  rng: () => number,
  avoidPrev: Set<string>,
  modePoolCodes: Set<string>,
): MealPlanPick[] {
  // 우선 단백질 보장 pass
  picks = guaranteeProtein(picks, target, excludeTags, excludeIngredients, rng, avoidPrev, modePoolCodes);

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
      const fiberBase = applyModePool(
        filterMenus({
          slot: picks[idx].slot,
          excludeTags,
          excludeIngredients,
        }).filter(
          (m) => !used.has(m.code) && m.fiberG >= 5 && m.proteinG >= currentP - 3,
        ),
        modePoolCodes,
      );
      const fresh = fiberBase.filter((m) => !avoidPrev.has(m.code));
      // 섬유 상위 8개 안에서 jitter
      const topByFiber = (fresh.length >= 4 ? fresh : fiberBase)
        .slice()
        .sort((a, b) => b.fiberG - a.fiberG)
        .slice(0, 8);
      if (topByFiber.length > 0) {
        const pickIdx = Math.floor(rng() * topByFiber.length);
        picks[idx] = { ...picks[idx], item: topByFiber[pickIdx] };
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
      const diverseBase = applyModePool(
        filterMenus({
          slot: picks[idx].slot,
          excludeTags,
          excludeIngredients,
        }).filter(
          (m) =>
            !used.has(m.code) &&
            m.keyVitamins.length + m.keyMinerals.length >= 5 &&
            m.proteinG >= currentP - 3,
        ),
        modePoolCodes,
      );
      const fresh2 = diverseBase.filter((m) => !avoidPrev.has(m.code));
      // 다양성 상위 8개 안에서 jitter
      const topByDiverse = (fresh2.length >= 4 ? fresh2 : diverseBase)
        .slice()
        .sort(
          (a, b) =>
            b.keyVitamins.length + b.keyMinerals.length -
            (a.keyVitamins.length + a.keyMinerals.length),
        )
        .slice(0, 8);
      if (topByDiverse.length > 0) {
        const pickIdx = Math.floor(rng() * topByDiverse.length);
        picks[idx] = { ...picks[idx], item: topByDiverse[pickIdx] };
      }
    }
  }

  // 단백질이 다시 떨어졌을 수 있으니 마지막으로 보장 pass
  picks = guaranteeProtein(picks, target, excludeTags, excludeIngredients, rng, avoidPrev, modePoolCodes);

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

/** 모드별 보너스(태그/이름) — 풀 자체는 getMealPoolByMode 가 강제. */
function modeBonusFor(mode: PlanMode, slot: MealSlot): {
  bonusTags?: string[];
  bonusNameKeywords?: string[];
} {
  if (mode === "home_korean") {
    if (slot === "lunch" || slot === "dinner") {
      return {
        bonusTags: ["고단백", "한식"],
        bonusNameKeywords: ["닭가슴살", "닭가슴", "두부"],
      };
    }
    return {
      bonusTags: ["한식", "간편"],
      bonusNameKeywords: ["달걀", "두부", "닭가슴살"],
    };
  }
  if (mode === "office_quick") {
    return {
      bonusTags: ["편의점", "쉐이크", "고단백"],
      bonusNameKeywords: ["쉐이크", "삼각김밥", "닭가슴살"],
    };
  }
  return {};
}

/** 단백질이 95% 이하면 식전 쉐이크 슬롯을 추가해 단백질 보강.
 *  반환: pre_shake 슬롯이 picks 의 가장 앞에 추가된 새 picks. */
function prependPreMealShake(
  picks: MealPlanPick[],
  target: NutritionTarget,
  excludeIngredients: string[],
  rng: () => number,
  avoidPrev: Set<string>,
): MealPlanPick[] {
  const totalProtein = picks.reduce(
    (sum, p) => sum + (p.item?.proteinG ?? 0),
    0,
  );
  if (totalProtein >= target.proteinG * PROTEIN_TARGET_RATIO) return picks;

  // 쉐이크 풀에서 1개 선택 — 시드/회피 적용
  const used = new Set(picks.filter((p) => p.item).map((p) => p.item!.code));
  const shakePool = filterMenus({ slot: "snack", excludeIngredients })
    .filter((m) => m.tags.includes("쉐이크"))
    .filter((m) => !used.has(m.code));
  const fresh = shakePool.filter((m) => !avoidPrev.has(m.code));
  const candidates = (fresh.length >= 2 ? fresh : shakePool)
    .map((m) => ({ m, score: m.proteinG * 2 + rng() * 200 }))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) return picks;

  const shake = candidates[0].m;
  // 식전 쉐이크 — snack 슬롯 형태이지만 가장 앞에 두어 "식전 단백질" 의미 전달.
  const preShakePick: MealPlanPick = {
    slot: "snack",
    target: { slot: "snack", kcal: shake.kcal, proteinG: shake.proteinG },
    item: shake,
  };
  return [preShakePick, ...picks];
}

export function generateMealPlan(input: MealPlanInput): MealPlanResult {
  const seed = input.seed ?? Math.floor(Math.random() * 1000);
  const rng = mulberry32(seed);
  const planMode: PlanMode = input.planMode ?? "random";

  const slotTargets = splitTargetsBySlot(input.target, input.mealsPerDay ?? 3);
  const excludeTags = restrictionsToExcludeTags(input.dietaryRestrictions);
  const excludeIngredients = restrictionsToExcludeIngredients(
    input.dietaryRestrictions,
    input.dislikedIngredients,
  );

  // reroll 시 직전 picks 회피 — 가능하면 새 메뉴로 채워 매 클릭마다 변화 보장.
  // 후보 부족(필터 후 모두 직전 코드와 동일) 시 자동으로 폴백 — 빈 카드 방지.
  const avoidPrev = new Set<string>(input.excludeCodes ?? []);
  const used = new Set<string>();

  // 모드 풀 — getMealPoolByMode 단일 출처. random 이면 size 0 으로 전체 허용.
  const modePool = getMealPoolByMode(planMode);
  const modePoolCodes =
    planMode === "random"
      ? new Set<string>()
      : new Set(modePool.map((m) => m.code));

  let picks: MealPlanPick[] = slotTargets.map((t) => {
    const modeBonus = modeBonusFor(planMode, t.slot);
    // 1차 — 직전 코드 + 이번 plan 에서 이미 쓴 코드 회피 + 모드 풀 한정
    const exclude1 = new Set<string>([...avoidPrev, ...used]);
    let item = pickOneMeal({
      slot: t.slot,
      target: t,
      excludeCodes: exclude1,
      excludeTags,
      excludeIngredients,
      preferPatterns: input.preferPatterns,
      rng,
      modePoolCodes,
      ...modeBonus,
    });
    // 2차 — 모드 풀 안에서 직전 회피만 풀어 시도
    if (!item) {
      item = pickOneMeal({
        slot: t.slot,
        target: t,
        excludeCodes: used,
        excludeTags,
        excludeIngredients,
        preferPatterns: input.preferPatterns,
        rng,
        modePoolCodes,
        ...modeBonus,
      });
    }
    // 3차 — 모드 풀까지 풀어 빈 카드 방지 (모드 풀에 슬롯 일치 메뉴가 0인 극단 케이스만 도달)
    if (!item && (!modePoolCodes.size || !modePool.some((m) => m.slots.includes(t.slot)))) {
      item = pickOneMeal({
        slot: t.slot,
        target: t,
        excludeCodes: used,
        excludeTags,
        excludeIngredients,
        preferPatterns: input.preferPatterns,
        rng,
      });
    }
    if (item) used.add(item.code);
    return { slot: t.slot, target: t, item };
  });

  // 후처리 비활성화 — 회원의 핵심 요구는 "매 reroll 마다 모든 슬롯 변경".
  // ensureDailyProbiotic / guaranteeProtein / fillNutrientGaps 는 슬롯을 교체하면서
  // 결정적 후보 8개로 좁혀 reroll 다양성을 깨고 있었음. 영양 보강은 회원이 "교체"
  // 버튼으로 수동 조정하거나 단백질 부족 시 식전 쉐이크만 추가.
  if (planMode === "home_korean" || planMode === "office_quick") {
    picks = prependPreMealShake(picks, input.target, excludeIngredients, rng, avoidPrev);
  }

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

