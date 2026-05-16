import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  Flame,
  Infinity as InfinityIcon,
  Layers,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Utensils,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useAuth } from "@/contexts/AuthContext";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import { useDietPreferences } from "@/hooks/useDietPreferences";
import {
  DIET_PATTERNS,
  FOOD_BUCKETS,
  STAGE_SAMPLES,
  flattenPatternToMealMap,
  getYouthSafeBuckets,
  type DietPattern,
  type DietPatternId,
  type FoodBucket,
  type FoodTier,
  type StageSample,
} from "@/data/diet/mealPlan";
import type { DietPreferences } from "@/lib/diet/preferences";
import type { DietTrack } from "@/lib/dietTrack";
import { cn } from "@/lib/utils";

type SlotId = "breakfast" | "lunch" | "dinner" | "snack";

const SLOT_LABEL: Record<SlotId, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

/**
 * /diet/meal-plan — 21일 식단 가이드 + 대표 패턴 3종 + DIY 구성 빌더.
 *
 * 구성
 *   1. 4-단계 음식 버킷 (무제한/적정량/줄이기/21일 피하기)
 *   2. 대표 패턴 3종 (심플·보통·정석) — 비교 + 상세 + "내 식단에 적용"
 *   3. DIY 식단 구성 — 각 끼니 슬롯별 음식 선택·저장 (DB: diet_preferences)
 *   4. 스테이지별 샘플 식단 (기존)
 */
const DietMealPlanPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const progressQuery = useDietProgress();
  const { data: prefs, update: updatePrefs, isUpdating } = useDietPreferences();

  const track: DietTrack | null = useMemo(() => {
    const p = progressQuery.data;
    if (p && "success" in p && p.success && p.has_active) {
      return p.enrollment?.track ?? null;
    }
    return null;
  }, [progressQuery.data]);
  const isYouth = track === "youth_habit";

  const buckets = useMemo(
    () => (isYouth ? getYouthSafeBuckets() : [...FOOD_BUCKETS]),
    [isYouth],
  );

  const featureEnabled = !!profile?.diet_program_enabled;

  // DIY composer local state (hydrated from prefs.custom_meal_plan)
  const [diyPlan, setDiyPlan] = useState({
    breakfast: [] as string[],
    lunch: [] as string[],
    dinner: [] as string[],
    snack: [] as string[],
  });
  useEffect(() => {
    setDiyPlan({
      breakfast: [...prefs.custom_meal_plan.breakfast],
      lunch: [...prefs.custom_meal_plan.lunch],
      dinner: [...prefs.custom_meal_plan.dinner],
      snack: [...prefs.custom_meal_plan.snack],
    });
  }, [prefs.custom_meal_plan]);

  const [pickerOpenSlot, setPickerOpenSlot] = useState<SlotId | null>(null);

  const applyPattern = (pattern: DietPattern) => {
    const mapped = flattenPatternToMealMap(pattern);
    setDiyPlan(mapped);
    toast.success(`'${pattern.title}' 패턴을 내 식단에 적용했어요. 저장 버튼을 눌러주세요.`);
  };

  const clearDiy = () => {
    setDiyPlan({ breakfast: [], lunch: [], dinner: [], snack: [] });
  };

  const saveDiy = async () => {
    const next: DietPreferences = { ...prefs, custom_meal_plan: diyPlan };
    try {
      updatePrefs(next);
      toast.success("내 식단이 저장됐어요");
    } catch {
      toast.error("저장 실패 — 잠시 후 다시 시도해 주세요");
    }
  };

  const toggleFoodInSlot = (slot: SlotId, name: string) => {
    setDiyPlan((prev) => {
      const has = prev[slot].includes(name);
      return {
        ...prev,
        [slot]: has ? prev[slot].filter((x) => x !== name) : [...prev[slot], name],
      };
    });
  };

  const removeFoodFromSlot = (slot: SlotId, name: string) => {
    setDiyPlan((prev) => ({
      ...prev,
      [slot]: prev[slot].filter((x) => x !== name),
    }));
  };

  const totalSelected =
    diyPlan.breakfast.length +
    diyPlan.lunch.length +
    diyPlan.dinner.length +
    diyPlan.snack.length;

  return (
    <AppPage
      header={
        <PageHeader
          title="21일 식단"
          subtitle="음식 분류 · 3 패턴 · 내 식단 만들기"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div data-tour="diet-page-meal-plan" className="space-y-5 pt-2">
        {!featureEnabled ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            153 다이어트 프로그램이 아직 활성화되지 않았어요.
          </div>
        ) : (
          <>
            {/* 안내 */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                MEAL GUIDE · 21 DAYS
              </p>
              <h2 className="mt-1 text-[17px] font-extrabold text-foreground leading-tight">
                선택지가 많을수록 오래갑니다
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                무제한·적정량·줄이기·피하기 4가지 분류. 3가지 대표 패턴 중 하나를 고르거나,
                내 라이프스타일에 맞춰 직접 식단을 짜보세요.
              </p>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━ 대표 식단 패턴 ━━━━━━━━━━━━━━━━━━ */}
            <section className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  3 PRESET PATTERNS
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
                  심플 · 보통 · 정석
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  라이프스타일에 맞는 패턴을 고르세요. '내 식단에 적용' 을 누르면 아래 빌더에 자동으로 채워집니다.
                </p>
              </div>
              <div className="space-y-2.5">
                {DIET_PATTERNS.map((p) => (
                  <PatternCard
                    key={p.id}
                    pattern={p}
                    onApply={() => applyPattern(p)}
                    isYouth={isYouth}
                  />
                ))}
              </div>
            </section>

            {/* ━━━━━━━━━━━━━━━━━━ DIY 식단 빌더 ━━━━━━━━━━━━━━━━━━ */}
            <section className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  BUILD YOUR PLAN
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
                  내 식단 만들기
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  끼니별로 음식을 직접 골라 저장하면 설정에 남습니다. 언제든 수정 가능.
                </p>
              </div>

              <div className="space-y-2">
                {(["breakfast", "lunch", "dinner", "snack"] as SlotId[]).map(
                  (slot) => (
                    <SlotCard
                      key={slot}
                      slot={slot}
                      items={diyPlan[slot]}
                      onAdd={() => setPickerOpenSlot(slot)}
                      onRemove={(name) => removeFoodFromSlot(slot, name)}
                    />
                  ),
                )}
              </div>

              {/* 저장/초기화 액션 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearDiy}
                  disabled={totalSelected === 0 || isUpdating}
                  className="h-11 rounded-2xl px-4"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  초기화
                </Button>
                <Button
                  onClick={saveDiy}
                  disabled={isUpdating}
                  className={cn(
                    "ml-auto h-11 flex-1 rounded-2xl font-bold tracking-wide",
                    "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
                    "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
                  )}
                >
                  <Save className="mr-1 h-4 w-4" />
                  {isUpdating ? "저장 중..." : "내 식단 저장"}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                저장된 식단은 어떤 기기에서든 그대로 불러와져요.
              </p>
            </section>

            {/* ━━━━━━━━━━━━━━━━━━ 음식 분류 4단계 ━━━━━━━━━━━━━━━━━━ */}
            <section className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  FOOD CATEGORIES
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
                  음식 4단계 분류
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  양보다 선택이 먼저. '손바닥·한 줌' 같은 직관 단위로 접근하세요.
                </p>
              </div>
              <div className="space-y-3">
                {buckets.map((b) => (
                  <BucketCard key={b.tier} bucket={b} isYouth={isYouth} />
                ))}
              </div>
            </section>

            {/* ━━━━━━━━━━━━━━━━━━ 스테이지별 샘플 ━━━━━━━━━━━━━━━━━━ */}
            <section className="space-y-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  STAGE SAMPLES
                </p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
                  스테이지별 하루 샘플
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  정답 아니라 참고용. 본인 식사 패턴에 맞춰 가볍게 변형해 보세요.
                </p>
              </div>
              <div className="space-y-2.5">
                {STAGE_SAMPLES.map((s) => (
                  <SampleCard key={s.stage} sample={s} />
                ))}
              </div>
            </section>

            {/* 청소년 주의 */}
            {isYouth && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                청소년 트랙은 '단식·식사 거르기·쉐이크 대체' 를 권하지 않습니다.
                잘 먹고, 잘 자고, 잘 움직이는 쪽으로 중심을 두세요.
              </div>
            )}
          </>
        )}
      </div>

      {/* 음식 선택 Picker (슬롯 선택 후 오픈) */}
      {pickerOpenSlot && (
        <FoodPickerModal
          slot={pickerOpenSlot}
          selected={diyPlan[pickerOpenSlot]}
          buckets={buckets}
          onToggle={(name) => toggleFoodInSlot(pickerOpenSlot, name)}
          onClose={() => setPickerOpenSlot(null)}
        />
      )}
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// Pattern card (presets)
// ──────────────────────────────────────────────────────────────────
const PATTERN_ICON: Record<DietPatternId, typeof Zap> = {
  simple: Zap,
  moderate: Layers,
  classic: Sparkles,
};

const PatternCard = ({
  pattern,
  onApply,
  isYouth,
}: {
  pattern: DietPattern;
  onApply: () => void;
  isYouth: boolean;
}) => {
  const Icon = PATTERN_ICON[pattern.id];
  const youthBlock = isYouth && !pattern.youthRecommended;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        youthBlock
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/25 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            youthBlock
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/15 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-foreground">
            {pattern.title}
          </p>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {pattern.subtitle}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <SmallMeta label="준비" value={pattern.prepTime} />
        <SmallMeta label="추천" value={pattern.bestFor} />
      </div>
      <p className="mt-2 flex items-start gap-1 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
        <span>{pattern.caveat}</span>
      </p>

      {/* 끼니 미리보기 */}
      <ul className="mt-3 space-y-1.5">
        {pattern.meals.map((m) => (
          <li
            key={m.slot}
            className="rounded-lg border border-border bg-background/60 px-2.5 py-1.5"
          >
            <p className="text-[10.5px] font-black uppercase tracking-wider text-primary">
              {m.label}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground">
              {m.items.join(" · ")}
            </p>
            {m.note && (
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                {m.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Tips */}
      <ul className="mt-2 space-y-0.5">
        {pattern.tips.map((t) => (
          <li
            key={t}
            className="pl-3 -indent-3 text-[10.5px] leading-relaxed text-muted-foreground"
          >
            <span className="mr-1 text-primary">·</span>
            {t}
          </li>
        ))}
      </ul>

      <Button
        onClick={onApply}
        disabled={youthBlock}
        className={cn(
          "mt-3 h-10 w-full rounded-xl font-bold",
          "bg-primary text-primary-foreground",
          youthBlock && "opacity-60",
        )}
      >
        {youthBlock ? "청소년 트랙 비권장" : `'${pattern.title}' 내 식단에 적용`}
      </Button>
    </div>
  );
};

const SmallMeta = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-background/60 px-2 py-1.5">
    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="text-[11px] font-bold text-foreground leading-tight">{value}</p>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Slot card (DIY composer per slot)
// ──────────────────────────────────────────────────────────────────
const SlotCard = ({
  slot,
  items,
  onAdd,
  onRemove,
}: {
  slot: SlotId;
  items: string[];
  onAdd: () => void;
  onRemove: (name: string) => void;
}) => (
  <div className="rounded-2xl border border-border bg-card p-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Utensils className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13px] font-extrabold text-foreground">
          {SLOT_LABEL[slot]}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {items.length}개
        </span>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/15"
      >
        <Plus className="h-3 w-3" />
        추가
      </button>
    </div>

    {items.length === 0 ? (
      <p className="mt-2 rounded-lg bg-muted/30 p-3 text-center text-[11.5px] text-muted-foreground">
        '추가' 를 눌러 음식을 선택하세요
      </p>
    ) : (
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((name) => (
          <li
            key={name}
            className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary"
          >
            {name}
            <button
              type="button"
              onClick={() => onRemove(name)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/15"
              aria-label={`${name} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Food picker modal (multi-select from all buckets)
// ──────────────────────────────────────────────────────────────────
const FoodPickerModal = ({
  slot,
  selected,
  buckets,
  onToggle,
  onClose,
}: {
  slot: SlotId;
  selected: string[];
  buckets: FoodBucket[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) => {
  // 무제한·적정량만 picker 에 노출. '줄이기/피하기' 는 구성에 넣지 않도록 유도.
  const pickableBuckets = buckets.filter(
    (b) => b.tier === "unlimited" || b.tier === "portioned",
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl bg-card p-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 -mx-4 -mt-4 mb-3 flex items-center justify-between border-b border-border bg-card px-4 py-3 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              ADD TO
            </p>
            <p className="text-[14px] font-extrabold text-foreground">
              {SLOT_LABEL[slot]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted p-2 active:scale-95"
            aria-label="닫기"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {pickableBuckets.map((b) => (
            <PickableBucket
              key={b.tier}
              bucket={b}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t border-border bg-card px-4 py-3">
          <Button onClick={onClose} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground font-bold">
            완료
          </Button>
        </div>
      </div>
    </div>
  );
};

const PickableBucket = ({
  bucket,
  selected,
  onToggle,
}: {
  bucket: FoodBucket;
  selected: string[];
  onToggle: (name: string) => void;
}) => (
  <div>
    <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-primary">
      {bucket.label}
    </p>
    <ul className="space-y-1">
      {bucket.items.map((f) => {
        const isOn = selected.includes(f.name);
        return (
          <li key={f.name}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-colors",
                isOn
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Checkbox
                checked={isOn}
                onCheckedChange={() => onToggle(f.name)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[12.5px] font-bold",
                    isOn ? "text-primary" : "text-foreground",
                  )}
                >
                  {f.name}
                </p>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  {f.hint}
                </p>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Bucket card (기존 음식 분류 전시)
// ──────────────────────────────────────────────────────────────────
const BucketCard = ({
  bucket,
  isYouth,
}: {
  bucket: FoodBucket;
  isYouth: boolean;
}) => {
  const { Icon, tone } = resolveBucketStyle(bucket.tier, isYouth);
  return (
    <div className={cn("rounded-2xl border p-4", tone.wrapper)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone.iconBg,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className={cn("text-[13.5px] font-extrabold", tone.title)}>
            {bucket.label}
          </p>
          <p className="text-[11px] text-muted-foreground">{bucket.summary}</p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1">
        {bucket.items.map((f) => (
          <li
            key={f.name}
            className="flex items-start justify-between gap-3 rounded-lg bg-background/60 px-2.5 py-1.5"
          >
            <span className="text-[12.5px] font-bold text-foreground">
              {f.name}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground text-right">
              {f.hint}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function resolveBucketStyle(tier: FoodTier, isYouth: boolean) {
  if (tier === "unlimited") {
    return {
      Icon: InfinityIcon,
      tone: {
        wrapper: "border-primary/30 bg-primary/5",
        iconBg: "bg-primary/15 text-primary",
        title: "text-primary",
      },
    };
  }
  if (tier === "portioned") {
    return {
      Icon: Sparkles,
      tone: {
        wrapper: "border-accent/25 bg-accent/5",
        iconBg: "bg-accent/15 text-accent",
        title: "text-accent",
      },
    };
  }
  if (tier === "reduce") {
    return {
      Icon: Flame,
      tone: {
        wrapper: "border-reward/30 bg-reward/10",
        iconBg: "bg-reward/20 text-reward-foreground",
        title: "text-reward-foreground",
      },
    };
  }
  return {
    Icon: isYouth ? ShieldAlert : XCircle,
    tone: {
      wrapper: "border-destructive/30 bg-destructive/10",
      iconBg: "bg-destructive/15 text-destructive",
      title: "text-destructive",
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// Stage sample card
// ──────────────────────────────────────────────────────────────────
const SampleCard = ({ sample }: { sample: StageSample }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Utensils className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[10.5px] font-black uppercase tracking-wider text-primary">
          {sample.range}
        </p>
        <p className="text-[13.5px] font-extrabold text-foreground leading-tight">
          {sample.title}
        </p>
      </div>
    </div>
    <p className="mt-2 flex items-start gap-1 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-foreground">
      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
      <span>
        <b>포커스</b> — {sample.focus}
      </span>
    </p>
    <ul className="mt-3 space-y-2">
      {sample.meals.map((m) => (
        <li
          key={m.slot}
          className="rounded-xl border border-border bg-background/50 p-2.5"
        >
          <p className="text-[11.5px] font-black uppercase tracking-wider text-primary">
            {m.slot}
          </p>
          <ul className="mt-1 space-y-0.5">
            {m.items.map((it) => (
              <li
                key={it}
                className="pl-3 -indent-3 text-[12.5px] leading-relaxed text-foreground"
              >
                <span className="mr-1 text-primary">·</span>
                {it}
              </li>
            ))}
          </ul>
          {m.note && (
            <p className="mt-1 text-[11px] text-muted-foreground">{m.note}</p>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export default DietMealPlanPage;
