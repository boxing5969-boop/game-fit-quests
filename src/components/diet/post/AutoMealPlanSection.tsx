import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNutritionProfile } from "@/hooks/useDietNutrition";
import {
  computeNutritionTarget,
  type ActivityLevel,
  type Sex,
} from "@/lib/diet/nutritionEngine";
import type { DietNutritionProfileRow } from "@/services/dietNutritionService";
import MyMealPlan from "./MyMealPlan";
import NutritionScienceCard from "./NutritionScienceCard";
import NutritionOnboardingCard from "./NutritionOnboardingCard";

interface AutoMealPlanSectionProps {
  mode: "maintenance" | "fat_loss";
  preferPatterns?: string[];
}

/**
 * 유지/연장 홈에 끼워넣는 자동 식단 섹션.
 *
 * 분기:
 *   1. 프로필 조회 로딩 → 스켈레톤
 *   2. 프로필 없음 / 필수 누락 → NutritionOnboardingCard
 *   3. 정상 → ActiveBody 로 위임 (훅 규칙 유지)
 */
export const AutoMealPlanSection = ({ mode, preferPatterns }: AutoMealPlanSectionProps) => {
  const query = useNutritionProfile();

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 text-center text-[12px] text-muted-foreground">
        영양 프로필 불러오는 중...
      </section>
    );
  }

  const payload = query.data && query.data.success ? query.data : null;

  if (!payload || !payload.has_profile || !payload.profile) {
    return <NutritionOnboardingCard mode={mode} onDone={() => query.refetch()} />;
  }

  const { profile, age } = payload;

  // 필수 필드 누락 시 다시 입력 유도
  if (!profile.sex || !profile.height_cm || !profile.weight_kg || !age) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-[12px] leading-relaxed text-foreground">
          <p className="font-bold">프로필 정보가 부족해요</p>
          <p className="mt-0.5 text-muted-foreground">
            키·체중·성별·생년월일 중 하나가 비어 있어 칼로리를 계산할 수 없어요. 아래에서 채워주세요.
          </p>
          {!age && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              생년월일은 내정보 페이지에서 수정할 수 있어요.
            </p>
          )}
        </div>
        <NutritionOnboardingCard mode={mode} onDone={() => query.refetch()} />
      </div>
    );
  }

  return (
    <ActiveBody
      profile={profile}
      age={age}
      mode={mode}
      preferPatterns={preferPatterns}
      onRefresh={() => query.refetch()}
    />
  );
};

interface ActiveBodyProps {
  profile: DietNutritionProfileRow;
  age: number;
  mode: "maintenance" | "fat_loss";
  preferPatterns?: string[];
  onRefresh: () => void;
}

/** 프로필이 완전한 경우의 본문 — 훅을 안전하게 사용 */
const ActiveBody = ({ profile, age, mode, preferPatterns, onRefresh }: ActiveBodyProps) => {
  const [editMode, setEditMode] = useState(false);

  const target = useMemo(
    () =>
      computeNutritionTarget({
        sex: profile.sex as Sex,
        ageYears: age,
        heightCm: profile.height_cm!,
        weightKg: profile.weight_kg!,
        activity: profile.activity_level as ActivityLevel,
        mode,
      }),
    [profile, age, mode],
  );

  if (editMode) {
    return (
      <NutritionOnboardingCard
        mode={mode}
        initial={{
          sex: profile.sex as Sex | null,
          heightCm: profile.height_cm,
          weightKg: profile.weight_kg,
          targetWeightKg: profile.target_weight_kg,
          activityLevel: profile.activity_level as ActivityLevel | null,
          mealsPerDay: (profile.meals_per_day as 2 | 3 | 4 | null) ?? null,
          dietaryRestrictions: profile.dietary_restrictions,
        }}
        onDone={() => {
          setEditMode(false);
          onRefresh();
        }}
        onCancel={() => setEditMode(false)}
      />
    );
  }

  return (
    <section className="space-y-3">
      <MyMealPlan
        target={target}
        mealsPerDay={(profile.meals_per_day as 2 | 3 | 4) ?? 3}
        dietaryRestrictions={profile.dietary_restrictions}
        dislikedIngredients={profile.disliked_ingredients}
        preferPatterns={preferPatterns}
        mode={mode}
      />
      <NutritionScienceCard
        target={target}
        weightKg={profile.weight_kg!}
        sex={profile.sex as Sex}
        mode={mode}
      />
      <Button
        variant="outline"
        onClick={() => setEditMode(true)}
        className="h-9 w-full rounded-xl text-[12px]"
      >
        <Pencil className="mr-1 h-3 w-3" />
        프로필 수정 (키·체중·활동수준 등)
      </Button>
    </section>
  );
};

export default AutoMealPlanSection;
