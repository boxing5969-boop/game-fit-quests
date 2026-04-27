import { useState } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ActivityLevel,
  Sex,
} from "@/lib/diet/nutritionEngine";
import { ACTIVITY_LABEL_KO } from "@/lib/diet/nutritionEngine";
import { useUpsertNutritionProfile } from "@/hooks/useDietNutrition";

interface NutritionOnboardingCardProps {
  mode: "maintenance" | "fat_loss";
  onDone?: () => void;
  /** 편집 모드용 초기값. 미지정 시 신규 입력 모드. */
  initial?: {
    sex?: Sex | null;
    heightCm?: number | null;
    weightKg?: number | null;
    targetWeightKg?: number | null;
    activityLevel?: ActivityLevel | null;
    mealsPerDay?: 2 | 3 | 4 | null;
    dietaryRestrictions?: string[] | null;
  };
  onCancel?: () => void;
}

/**
 * 자동 식단 생성에 필요한 개인 영양 프로필 입력 카드.
 * 필수: sex, height, weight, activity. 선택: target_weight, 식이 제한.
 *
 * 첫 진입 시 한 번만 표시되고, 저장되면 MyMealPlan 이 대신 렌더된다.
 * initial prop 으로 기존값 prefill 시 "프로필 수정" 모드.
 */
export const NutritionOnboardingCard = ({
  mode,
  onDone,
  initial,
  onCancel,
}: NutritionOnboardingCardProps) => {
  const save = useUpsertNutritionProfile();
  const isEdit = !!initial;

  const [sex, setSex] = useState<Sex>(initial?.sex ?? "male");
  const [height, setHeight] = useState<string>(
    initial?.heightCm != null ? String(initial.heightCm) : "",
  );
  const [weight, setWeight] = useState<string>(
    initial?.weightKg != null ? String(initial.weightKg) : "",
  );
  const [targetWeight, setTargetWeight] = useState<string>(
    initial?.targetWeightKg != null ? String(initial.targetWeightKg) : "",
  );
  const [activity, setActivity] = useState<ActivityLevel>(
    initial?.activityLevel ?? "light",
  );
  const [mealsPerDay, setMealsPerDay] = useState<2 | 3 | 4>(
    initial?.mealsPerDay ?? 3,
  );
  const [restrictions, setRestrictions] = useState<Set<string>>(
    new Set(initial?.dietaryRestrictions ?? []),
  );

  const toggleRestriction = (r: string) => {
    setRestrictions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const canSubmit = !!height && !!weight && Number(height) > 0 && Number(weight) > 0;

  const handleSubmit = async () => {
    const res = await save.mutateAsync({
      sex,
      heightCm: Number(height),
      weightKg: Number(weight),
      targetWeightKg: targetWeight ? Number(targetWeight) : null,
      activityLevel: activity,
      dietaryRestrictions: Array.from(restrictions),
      mealsPerDay,
    });
    if (res.success) onDone?.();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-card p-5">
      <div>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            AUTO MEAL PLAN · 자동 식단
          </p>
        </div>
        <h3 className="mt-1 text-[17px] font-extrabold leading-tight text-foreground">
          {isEdit
            ? "프로필 수정"
            : mode === "maintenance"
              ? "유지 모드 자동 식단 설정"
              : "연장 프로그램 자동 식단 설정"}
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          하루 칼로리·단백질 목표를 계산해 매일 식단을 자동으로 제안해요.
          극단적 제한 금지 · 체중 경쟁 금지 — 공개 랭킹과 분리됩니다.
        </p>
      </div>

      {/* 성별 */}
      <div>
        <p className="text-[11px] font-bold text-muted-foreground">성별</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {(["male", "female"] as Sex[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSex(s)}
              className={cn(
                "rounded-lg border px-3 py-2 text-[12.5px] font-bold transition-all active:scale-95",
                sex === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              {s === "male" ? "남성" : "여성"}
            </button>
          ))}
        </div>
      </div>

      {/* 키/몸무게/목표 */}
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="키 (cm)" value={height} onChange={setHeight} placeholder="예: 172" />
        <LabeledInput label="현재 체중 (kg)" value={weight} onChange={setWeight} placeholder="예: 68.5" />
        <LabeledInput
          label="목표 체중 (kg, 선택)"
          value={targetWeight}
          onChange={setTargetWeight}
          placeholder="예: 64"
        />
        <div>
          <p className="text-[11px] font-bold text-muted-foreground">하루 식사 수</p>
          <div className="mt-1.5 flex gap-1">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMealsPerDay(n)}
                className={cn(
                  "flex-1 rounded-lg border py-1.5 text-[12px] font-bold active:scale-95",
                  mealsPerDay === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {n}끼
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 활동 수준 */}
      <div>
        <p className="text-[11px] font-bold text-muted-foreground">활동 수준</p>
        <div className="mt-1.5 space-y-1">
          {(Object.keys(ACTIVITY_LABEL_KO) as ActivityLevel[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActivity(a)}
              className={cn(
                "flex w-full items-center rounded-lg border px-3 py-2 text-left text-[12px] font-bold transition-all active:scale-95",
                activity === a
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              {ACTIVITY_LABEL_KO[a]}
            </button>
          ))}
        </div>
      </div>

      {/* 식이 제한 */}
      <div>
        <p className="text-[11px] font-bold text-muted-foreground">식이 제한 (선택)</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            ["vegetarian", "채식"],
            ["vegan", "비건"],
            ["no_dairy", "유제품 제외"],
            ["no_seafood", "해산물 제외"],
            ["halal", "할랄"],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleRestriction(code)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95",
                restrictions.has(code)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {isEdit && onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={save.isPending}
            className="h-11 flex-1 rounded-xl font-bold"
          >
            취소
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || save.isPending}
          className={cn(
            "h-11 flex-[2] rounded-xl font-bold",
            "bg-primary text-primary-foreground disabled:opacity-60",
          )}
        >
          {save.isPending ? "저장 중..." : isEdit ? "변경사항 저장" : "식단 생성 시작"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
      {save.isError && (
        <p className="text-center text-[11px] text-destructive">
          저장에 실패했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground">
        입력 정보는 본인과 담당 코치만 볼 수 있어요. 공개 랭킹에 반영되지 않습니다.
      </p>
    </section>
  );
};

const LabeledInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <label className="block">
    <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      placeholder={placeholder}
      className="number-font mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  </label>
);

export default NutritionOnboardingCard;
