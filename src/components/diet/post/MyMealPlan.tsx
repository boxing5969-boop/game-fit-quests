import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Pencil,
  RefreshCw,
  UtensilsCrossed,
  Replace,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MEAL_SLOT_LABEL_KO,
  evaluateFiveNutrients,
  type NutritionTarget,
  type MealSlot,
} from "@/lib/diet/nutritionEngine";
import {
  generateMealPlan,
  swapMealWithAutoAdjust,
  type MealPlanResult,
  type PlanMode,
} from "@/lib/diet/mealPlanEngine";
import type { MealItem } from "@/data/nutrition/mealLibrary";
import MealSwapDialog from "./MealSwapDialog";
import CustomMealDialog from "./CustomMealDialog";

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
    Math.floor(Math.random() * 1_000_000),
  );
  const [planMode, setPlanMode] = useState<PlanMode>("random");
  const [swapSlot, setSwapSlot] = useState<MealSlot | null>(null);
  const [customSlot, setCustomSlot] = useState<MealSlot | null>(null);
  const [overridePlan, setOverridePlan] = useState<MealPlanResult | null>(null);
  // 최근 선택된 메뉴 ID(=code) 추적용 ref. 슬라이딩 윈도우(15개) 로 빠른 회귀 방지.
  // useRef 라 갱신해도 리렌더가 발생하지 않음 — generateMealPlan 의 입력은 seed 변경으로 트리거.
  const recentMealIds = useRef<string[]>([]);
  const RECENT_LIMIT = 15;

  const generated = useMemo<MealPlanResult>(
    () =>
      generateMealPlan({
        target,
        mealsPerDay,
        dietaryRestrictions,
        dislikedIngredients,
        preferPatterns,
        seed,
        excludeCodes: recentMealIds.current,
        planMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, mealsPerDay, dietaryRestrictions, dislikedIngredients, preferPatterns, seed, planMode],
  );

  const plan = overridePlan ?? generated;

  const kcalPct = Math.round(plan.coverage.kcalRatio * 100);
  const proteinPct = Math.round(plan.coverage.proteinRatio * 100);
  const fiveNutrients = useMemo(
    () => evaluateFiveNutrients(plan.nutrients, target),
    [plan, target],
  );

  const handleModeChange = (next: PlanMode) => {
    if (next === planMode) return;
    setPlanMode(next);
    setOverridePlan(null);
    recentMealIds.current = []; // 모드 전환 — 회피 큐 리셋
    setSeed(Math.floor(Math.random() * 1_000_000) + (Date.now() % 1_000));
  };

  const handleReroll = () => {
    // 새 plan 강제:
    //   1) 직전 picks 의 모든 코드를 ref 슬라이딩 윈도우(15개)에 추가
    //   2) 시드 큰 폭 점프 → useMemo 재실행 → generateMealPlan 이 ref.current 회피 풀 사용
    //   3) override(swap 결과) 해제
    //   4) planMode 는 그대로 유지 — reroll 이 모드를 바꾸지 않음
    const prevCodes = plan.picks
      .map((p) => p.item?.code)
      .filter((c): c is string => !!c);
    recentMealIds.current = [
      ...recentMealIds.current.filter((c) => !prevCodes.includes(c)),
      ...prevCodes,
    ].slice(-RECENT_LIMIT);
    setOverridePlan(null);
    setSeed((prev) => {
      let next = Math.floor(Math.random() * 1_000_000) + (Date.now() % 1_000);
      if (next === prev) next += 137;
      return next;
    });
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

  const handleCustomSave = (slot: MealSlot, item: MealItem) => {
    // 직접 입력 — 해당 슬롯 교체. 총합·영양은 swap 로직 재사용으로 자동 재합산.
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
    setCustomSlot(null);
  };

  return (
    <section className="space-y-3">
      {/* 식단 모드 탭 — 3가지 랜덤 식단 스타일 선택 */}
      <div className="rounded-2xl border border-border bg-card p-2">
        <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          식단 스타일
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <ModeTab
            active={planMode === "random"}
            label="자동 랜덤"
            sub="전체 라이브러리"
            onClick={() => handleModeChange("random")}
          />
          <ModeTab
            active={planMode === "home_korean"}
            label="가정집 한식"
            sub="닭가슴살·두부 보강"
            onClick={() => handleModeChange("home_korean")}
          />
          <ModeTab
            active={planMode === "office_quick"}
            label="업무용 초간단"
            sub="편의점·쉐이크"
            onClick={() => handleModeChange("office_quick")}
          />
        </div>
        <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-muted-foreground">
          {planMode === "home_korean"
            ? "가정에서 한식 위주로. 단백질 부족 시 식전 쉐이크로 보강합니다."
            : planMode === "office_quick"
              ? "편의점 + 쉐이크로 즉시 해결. 단백질 부족 시 쉐이크 1회 추가."
              : "전체 라이브러리에서 자동 조합. 다양성 최대."}
        </p>
      </div>

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

      {/* 5대 영양소 체크리스트 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              5대 영양소 + 프로바이오틱
            </p>
            <p className="mt-0.5 text-[13px] font-extrabold text-foreground">
              하루 영양소 커버
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
              fiveNutrients.allGreen
                ? "bg-emerald-400/15 text-emerald-500"
                : "bg-amber-400/15 text-amber-600",
            )}
          >
            {fiveNutrients.allGreen ? "ALL GREEN" : "보강 필요"}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          <NutRow
            label="단백질"
            status={fiveNutrients.protein >= 0.85 ? "ok" : "low"}
            detail={`${plan.totals.proteinG}/${target.proteinG}g`}
          />
          <NutRow
            label="지방"
            status={
              fiveNutrients.fat >= 0.7 && fiveNutrients.fat <= 1.2 ? "ok" : "low"
            }
            detail={`${plan.totals.fatG}/${target.fatG}g`}
          />
          <NutRow
            label="탄수화물"
            status={
              fiveNutrients.carbs >= 0.7 && fiveNutrients.carbs <= 1.2 ? "ok" : "low"
            }
            detail={`${plan.totals.carbsG}/${target.carbsG}g`}
          />
          <NutRow
            label="비타민 (다양성)"
            status={
              fiveNutrients.vitamins.count >= fiveNutrients.vitamins.target
                ? "ok"
                : "low"
            }
            detail={`${fiveNutrients.vitamins.list.join("·") || "—"} (${fiveNutrients.vitamins.count}/${fiveNutrients.vitamins.target}종)`}
          />
          <NutRow
            label="무기질 (다양성)"
            status={
              fiveNutrients.minerals.count >= fiveNutrients.minerals.target
                ? "ok"
                : "low"
            }
            detail={`${fiveNutrients.minerals.list.join("·") || "—"} (${fiveNutrients.minerals.count}/${fiveNutrients.minerals.target}종)`}
          />
          <NutRow
            label="섬유질"
            status={fiveNutrients.fiber.g >= fiveNutrients.fiber.target * 0.8 ? "ok" : "low"}
            detail={`${fiveNutrients.fiber.g}/${fiveNutrients.fiber.target}g`}
          />
          <NutRow
            label="프로바이오틱스"
            status={
              fiveNutrients.probiotic.count >= fiveNutrients.probiotic.target
                ? "ok"
                : "low"
            }
            detail={`${fiveNutrients.probiotic.count}회 (요거트·김치·된장 등)`}
          />
        </ul>
        {!fiveNutrients.allGreen && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            부족한 항목은 간식 "교체" 로 그릭요거트·사우어크라우트·견과류를 추가해 보세요.
          </p>
        )}
      </div>

      {/* 끼니 카드 */}
      <div className="space-y-2">
        {plan.picks.map((p, idx) => {
          const hasItem = !!p.item;
          // 식전 쉐이크 — 같은 plan 안에 snack 이 2개 이상이고 첫 번째가 쉐이크면 식전 보강 슬롯
          const isPreShake =
            idx === 0 &&
            p.slot === "snack" &&
            !!p.item?.tags.includes("쉐이크") &&
            plan.picks.filter((q) => q.slot === "snack").length > 1;
          const slotLabel = isPreShake
            ? "식전 단백질 (쉐이크)"
            : MEAL_SLOT_LABEL_KO[p.slot];
          return (
            <div
              key={`${p.slot}-${idx}`}
              className={cn(
                "rounded-2xl border bg-card p-3",
                hasItem ? "border-border" : "border-primary/30 bg-primary/5",
                isPreShake && "border-primary/50 bg-primary/5",
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
                      {slotLabel}
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
                {!isPreShake && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setSwapSlot(p.slot)}
                      aria-label={`${MEAL_SLOT_LABEL_KO[p.slot]} 교체`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground active:scale-95"
                    >
                      <Replace className="inline h-3 w-3" /> 교체
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomSlot(p.slot)}
                      aria-label={`${MEAL_SLOT_LABEL_KO[p.slot]} 직접 입력`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground active:scale-95"
                    >
                      <Pencil className="inline h-3 w-3" /> 직접 입력
                    </button>
                  </div>
                )}
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
      {customSlot && (
        <CustomMealDialog
          slot={customSlot}
          onClose={() => setCustomSlot(null)}
          onSave={(item) => handleCustomSave(customSlot, item)}
        />
      )}
    </section>
  );
};

const ModeTab = ({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "rounded-xl border px-2 py-2 text-left transition-colors active:scale-[0.98]",
      active
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border bg-background text-muted-foreground hover:text-foreground",
    )}
  >
    <p className="text-[11.5px] font-extrabold leading-tight">{label}</p>
    <p className="mt-0.5 text-[10px] leading-tight">{sub}</p>
  </button>
);

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

const NutRow = ({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ok" | "low";
  detail: string;
}) => (
  <li
    className={cn(
      "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11.5px]",
      status === "ok"
        ? "border-emerald-400/25 bg-emerald-400/5"
        : "border-amber-400/25 bg-amber-400/5",
    )}
  >
    <div className="flex items-center gap-1.5">
      {status === "ok" ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <AlertCircle className="h-3 w-3 text-amber-600" />
      )}
      <span className="font-bold text-foreground">{label}</span>
    </div>
    <span className="text-[10.5px] text-muted-foreground">{detail}</span>
  </li>
);

export default MyMealPlan;
