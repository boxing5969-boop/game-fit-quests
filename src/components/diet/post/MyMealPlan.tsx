import { useMemo, useState } from "react";
import {
  Flame,
  RefreshCw,
  UtensilsCrossed,
  Replace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MEAL_SLOT_LABEL_KO,
  type NutritionTarget,
  type MealSlot,
} from "@/lib/diet/nutritionEngine";
import {
  generateMealPlan,
  swapMealWithAutoAdjust,
  type MealPlanResult,
} from "@/lib/diet/mealPlanEngine";
import type { MealItem } from "@/data/nutrition/mealLibrary";
import MealSwapDialog from "./MealSwapDialog";

interface MyMealPlanProps {
  target: NutritionTarget;
  mealsPerDay?: 2 | 3 | 4;
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  preferPatterns?: string[];       // 연장 프로그램의 pattern_tags
  mode: "maintenance" | "fat_loss";
}

/**
 * 오늘의 식단 표시 + 끼니 교체 (외식/자유식 스왑).
 *
 * 끼니 카드:
 *   · 메뉴 이름 + 칼로리·매크로
 *   · 준비 팁
 *   · "교체" 버튼 → MealSwapDialog
 *
 * 하단:
 *   · 다시 뽑기 (seed 증가)
 *   · 총합 vs 타겟 비율 표시
 */
export const MyMealPlan = ({
  target,
  mealsPerDay = 3,
  dietaryRestrictions,
  dislikedIngredients,
  preferPatterns,
  mode,
}: MyMealPlanProps) => {
  const [seed, setSeed] = useState<number>(() =>
    Math.floor(Math.random() * 1000),
  );
  const [swapSlot, setSwapSlot] = useState<MealSlot | null>(null);
  const [overridePlan, setOverridePlan] = useState<MealPlanResult | null>(null);

  const generated = useMemo<MealPlanResult>(
    () =>
      generateMealPlan({
        target,
        mealsPerDay,
        dietaryRestrictions,
        dislikedIngredients,
        preferPatterns,
        seed,
      }),
    [target, mealsPerDay, dietaryRestrictions, dislikedIngredients, preferPatterns, seed],
  );

  const plan = overridePlan ?? generated;

  const kcalPct = Math.round(plan.coverage.kcalRatio * 100);
  const proteinPct = Math.round(plan.coverage.proteinRatio * 100);

  const handleReroll = () => {
    setOverridePlan(null);
    setSeed(seed + 1);
  };

  const handleSwapConfirm = (slot: MealSlot, item: MealItem) => {
    const next = swapMealWithAutoAdjust({
      plan,
      target,
      slotToSwap: slot,
      replacement: item,
      dietaryRestrictions,
      dislikedIngredients,
      seed,
    });
    setOverridePlan(next);
    setSwapSlot(null);
  };

  return (
    <section className="space-y-3">
      {/* 요약 헤더 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {mode === "maintenance" ? "MAINTENANCE MEAL PLAN" : "FAT LOSS MEAL PLAN"}
            </p>
            <p className="mt-0.5 text-[14px] font-extrabold text-foreground">오늘의 식단</p>
          </div>
          <Button
            variant="outline"
            onClick={handleReroll}
            className="h-8 rounded-lg px-3 text-[11.5px]"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            다시 뽑기
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <Stat label="목표" value={`${target.kcalTarget} kcal`} tone="target" />
          <Stat label="총합" value={`${plan.totals.kcal}`} tone="primary" />
          <Stat label="단백질" value={`${plan.totals.proteinG}/${target.proteinG}g`} tone="neutral" />
          <Stat label="커버리지" value={`${kcalPct}%`} tone="neutral" />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {proteinPct >= 85
            ? `단백질 ${proteinPct}% 확보. 감량기 근보존·포만감 OK.`
            : `단백질 ${proteinPct}% — 간식을 그릭요거트·삶은 달걀로 보강하면 좋아요.`}
        </p>
      </div>

      {/* 끼니 카드 */}
      <div className="space-y-2">
        {plan.picks.map((p) => {
          const hasItem = !!p.item;
          return (
            <div
              key={p.slot}
              className={cn(
                "rounded-2xl border bg-card p-3",
                hasItem ? "border-border" : "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    hasItem ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      {MEAL_SLOT_LABEL_KO[p.slot]}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      · 목표 {p.target.kcal} kcal
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] font-extrabold leading-snug text-foreground">
                    {p.item?.name ?? "조건에 맞는 메뉴를 찾지 못했어요"}
                  </p>
                  {p.item && (
                    <>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {p.item.note}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px]">
                        <Chip icon={<Flame className="h-3 w-3" />} label={`${p.item.kcal} kcal`} />
                        <Chip label={`단백질 ${p.item.proteinG}g`} />
                        <Chip label={`탄수 ${p.item.carbsG}g`} />
                        <Chip label={`지방 ${p.item.fatG}g`} />
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSwapSlot(p.slot)}
                  aria-label={`${MEAL_SLOT_LABEL_KO[p.slot]} 교체`}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground active:scale-95"
                >
                  <Replace className="inline h-3 w-3" /> 교체
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground">
        외식/자유식 끼니는 "교체"로 바꾸면 다음 끼니가 자동으로 가벼운 복귀 메뉴로 재선택됩니다.
      </p>

      {swapSlot && (
        <MealSwapDialog
          slot={swapSlot}
          current={plan.picks.find((p) => p.slot === swapSlot)?.item ?? null}
          dietaryRestrictions={dietaryRestrictions}
          dislikedIngredients={dislikedIngredients}
          onClose={() => setSwapSlot(null)}
          onPick={(item) => handleSwapConfirm(swapSlot, item)}
        />
      )}
    </section>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "target" | "primary" | "neutral";
}) => (
  <div
    className={cn(
      "rounded-lg border p-2 text-center",
      tone === "primary"
        ? "border-primary/30 bg-primary/5"
        : tone === "target"
          ? "border-emerald-400/30 bg-emerald-400/5"
          : "border-border bg-background",
    )}
  >
    <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-0.5 number-font text-[12.5px] font-extrabold text-foreground">{value}</p>
  </div>
);

const Chip = ({ icon, label }: { icon?: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
    {icon}
    {label}
  </span>
);

export default MyMealPlan;
