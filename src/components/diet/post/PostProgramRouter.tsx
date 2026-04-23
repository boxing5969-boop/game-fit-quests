import { useEffect } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useEnsurePostProgramPlan,
  usePostProgramPlan,
} from "@/hooks/useDietPostProgram";
import CompletionReportCard from "./CompletionReportCard";
import NextStepChooser from "./NextStepChooser";
import MaintenanceHome from "./MaintenanceHome";
import ExtendHome from "./ExtendHome";

interface PostProgramRouterProps {
  enrollmentId: string;
  /** 최근 7일 수행률 — recommendEngine 에 주입. null 허용. */
  recentAdherence7d: number | null;
}

/**
 * 21일 완주(enrollment.status = 'completed') 회원의 홈 라우팅.
 *
 * 상태 플로우:
 *   1. 최초 진입 → ensure_post_program_plan 호출해 plan 레코드 보장
 *   2. plan.selected_path === 'pending' → 리포트 + 다음 단계 선택 UI
 *   3. 'maintenance' → MaintenanceHome
 *   4. 'extend' → ExtendHome
 */
export const PostProgramRouter = ({
  enrollmentId,
  recentAdherence7d,
}: PostProgramRouterProps) => {
  const planQuery = usePostProgramPlan();
  const ensure = useEnsurePostProgramPlan();

  // plan 없으면 1회 ensure — mount 시 1번만
  useEffect(() => {
    if (planQuery.isLoading) return;
    if (!planQuery.data || !planQuery.data.success) return;
    if (planQuery.data.has_plan) return;
    if (ensure.isPending || ensure.isSuccess) return;
    ensure.mutate(enrollmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planQuery.data, enrollmentId]);

  if (planQuery.isLoading || ensure.isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12px] text-muted-foreground">
        21일 리포트 불러오는 중...
      </div>
    );
  }

  const payload =
    planQuery.data && planQuery.data.success ? planQuery.data : null;

  if (!payload?.has_plan || !payload.plan) {
    // ensure 실패 혹은 마이그레이션 미반영 — graceful 폴백
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-[12.5px] leading-relaxed text-muted-foreground">
        <p className="font-bold text-foreground">
          21일 리포트를 준비 중입니다
        </p>
        <p>
          관리자가 서버 업데이트를 반영하면 이 화면이 리포트와 다음 단계 선택으로 바뀝니다.
          그 전까지는 기존 21일 기록을 그대로 유지할 수 있어요.
        </p>
        <Button
          variant="outline"
          onClick={() => planQuery.refetch()}
          className="h-9 rounded-xl text-[12px]"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          다시 확인
        </Button>
      </div>
    );
  }

  const { plan } = payload;
  const checkins = payload.checkins ?? [];

  if (plan.selected_path === "pending") {
    return (
      <div className="space-y-4">
        <CompletionReportCard summary={plan.completion_summary} />
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <ChevronDown className="h-3.5 w-3.5" />
          NEXT STEP
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
        <NextStepChooser
          plan={plan}
          recentAdherence7d={recentAdherence7d}
        />
      </div>
    );
  }

  if (plan.selected_path === "maintenance") {
    return <MaintenanceHome plan={plan} checkins={checkins} />;
  }

  return <ExtendHome plan={plan} checkins={checkins} />;
};

export default PostProgramRouter;
