import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChefHat, ChevronLeft } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import AutoMealPlanSection from "@/components/diet/post/AutoMealPlanSection";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import { usePostProgramPlan } from "@/hooks/useDietPostProgram";

/**
 * /diet/auto-meals — 자동 식단 전용 페이지.
 *
 * 진입 경로: /diet 허브 타일 "자동 식단"
 * 내용: NutritionOnboardingCard → MyMealPlan → NutritionScienceCard (기존 Section 재사용)
 *
 * 모드 결정:
 *   - 유지 경로 선택 상태 → maintenance
 *   - 그 외 (진행 중 · 연장 · 미선택) → fat_loss
 */
const DietAutoMealsPage = () => {
  const navigate = useNavigate();
  const progressQuery = useDietProgress();
  const planQuery = usePostProgramPlan();

  // 모드 결정 — 유지 경로만 maintenance, 나머지는 fat_loss
  const mode: "maintenance" | "fat_loss" = useMemo(() => {
    const plan = planQuery.data && planQuery.data.success ? planQuery.data.plan : null;
    if (plan?.selected_path === "maintenance") return "maintenance";
    return "fat_loss";
  }, [planQuery.data]);

  // 연장 경로의 약점 패턴 반영
  const preferPatterns = useMemo(() => {
    const plan = planQuery.data && planQuery.data.success ? planQuery.data.plan : null;
    if (plan?.selected_path === "extend") return plan.pattern_tags ?? [];
    return undefined;
  }, [planQuery.data]);

  const hasActive =
    progressQuery.data &&
    "success" in progressQuery.data &&
    progressQuery.data.success &&
    progressQuery.data.has_active;

  return (
    <AppPage
      header={
        <PageHeader
          title="자동 식단"
          subtitle="BMR·TDEE 기반 맞춤 하루 메뉴"
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
      <div className="space-y-4 pt-2">
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 p-1.5">
              <ChefHat className="h-4 w-4 text-primary" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              {mode === "maintenance" ? "MAINTENANCE" : "FAT LOSS"} · MEAL PLAN
            </p>
          </div>
          <h2 className="mt-1 text-display-sm leading-tight text-foreground">
            오늘의 맞춤 식단
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            신체 정보로 하루 칼로리·단백질을 계산하고, 30+ 메뉴에서 끼니별로
            자동 조합합니다. 외식 있는 날은 [교체] 로 다음 끼니를 가볍게.
          </p>
        </section>

        {!hasActive && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-[12px] leading-relaxed text-foreground">
            <p className="font-bold">먼저 21일 프로그램을 시작해 주세요</p>
            <p className="mt-0.5 text-muted-foreground">
              자동 식단은 프로그램 등록 후 매일 새로 제안됩니다.
              아래 입력으로 미리보기는 가능해요.
            </p>
          </div>
        )}

        <AutoMealPlanSection mode={mode} preferPatterns={preferPatterns} />
      </div>
    </AppPage>
  );
};

export default DietAutoMealsPage;
