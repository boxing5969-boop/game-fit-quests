import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Flag,
  HeartHandshake,
  Lock,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import { useEarlyStartPostProgram } from "@/hooks/useDietPostProgram";
import PostProgramRouter from "@/components/diet/post/PostProgramRouter";

/**
 * /diet/post-program — 21일 이후 유지/연장 프로그램 전용 진입점.
 *
 * 상태별 렌더:
 *   1. enrollment.status === 'completed' → PostProgramRouter (실제 유지/연장 홈)
 *   2. 진행 중 → "21일 완주 후 자동 활성화" landing + 가이드 링크
 *   3. 미등록 → 온보딩 CTA
 */
const DietPostProgramPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const progressQuery = useDietProgress();
  const earlyStart = useEarlyStartPostProgram();
  // "지금 시작" 클릭 후 서버 응답 받기 전까지 PostProgramRouter 즉시 노출용 hint.
  // 서버 mutation 성공하면 useDietProgress 도 자동 갱신되어 status 가 completed 로 바뀜.
  const [earlyStarted, setEarlyStarted] = useState(false);

  const payload =
    progressQuery.data && "success" in progressQuery.data && progressQuery.data.success
      ? progressQuery.data
      : null;
  const activeEnrollment = payload?.enrollment;
  const snapshot = payload?.snapshot;

  // Fallback — get_diet_progress 는 active/not_started/paused 만 조회.
  // status 가 'completed' 또는 'dropped' 면 위 RPC 가 enrollment 못 찾으니, 본인 enrollment
  // 를 직접 조회해 사후 프로그램 분기에서 사용. RLS 가 본인 데이터 SELECT 허용.
  const anyEnrollmentQuery = useQuery({
    queryKey: ["diet", "post-program-page-enrollment", user?.id],
    enabled: !!user?.id && !activeEnrollment, // active 잡혔으면 fallback 불필요
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diet_program_enrollments")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 우선순위: get_diet_progress 의 enrollment → 없으면 직접 조회 fallback
  const enrollment = activeEnrollment ?? anyEnrollmentQuery.data ?? null;
  const status = enrollment?.status;
  const isPostProgramReady = status === "completed" || earlyStarted;

  const handleEarlyStart = async () => {
    if (!enrollment) return;
    try {
      const r = await earlyStart.mutateAsync(enrollment.id);
      if (r.success) {
        toast.success(
          "🚀 21일 이후 프로그램이 활성화됐어요. 두 갈래 중에서 골라봐요.",
        );
        setEarlyStarted(true);
      } else {
        const msg = (r as { error?: string }).error ?? "조기 시작 실패";
        toast.error(`조기 시작 실패: ${msg}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "네트워크 오류";
      toast.error(`조기 시작 실패: ${msg}`);
    }
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="유지·연장 프로그램"
          subtitle="21일 이후 두 갈래 경로"
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
        {/* Hero */}
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            POST-21 · 유지 / 연장
          </p>
          <h2 className="mt-1 text-display-sm leading-tight text-foreground">
            21일 이후, 내 몸에 맞는 다음 단계
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            완주 후 자동으로 활성화되는 두 갈래 — 유지 컨설팅 모드 또는 건강리셋 연장.
            진행 중이라면 미리보기만 가능합니다.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <PathPreview
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="good"
              title="유지 모드"
              subtitle="요요 방지 · 유연식 대응"
            />
            <PathPreview
              icon={<HeartHandshake className="h-4 w-4" />}
              tone="focus"
              title="건강리셋 연장"
              subtitle="14/21일 감량 사이클"
            />
          </div>
        </section>

        {progressQuery.isLoading || anyEnrollmentQuery.isLoading ? (
          <Placeholder>불러오는 중...</Placeholder>
        ) : !enrollment ? (
          <NotEnrolledCTA onStart={() => navigate("/diet/onboarding")} />
        ) : isPostProgramReady ? (
          <PostProgramRouter
            enrollmentId={enrollment.id}
            recentAdherence7d={snapshot?.habit_score ?? null}
          />
        ) : (
          <LockedLanding
            currentDay={enrollment.current_day}
            onGuide={() => navigate("/diet/after-21")}
            onHome={() => navigate("/diet")}
            onEarlyStart={handleEarlyStart}
            earlyStartPending={earlyStart.isPending}
          />
        )}
      </div>
    </AppPage>
  );
};

// ───────────────────────────────────────────────────────────────────────
const PathPreview = ({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tone: "good" | "focus";
  title: string;
  subtitle: string;
}) => (
  <div
    className={cn(
      "rounded-xl border p-3",
      tone === "good"
        ? "border-emerald-400/30 bg-emerald-400/5"
        : "border-primary/25 bg-primary/5",
    )}
  >
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg",
        tone === "good"
          ? "bg-emerald-400/15 text-emerald-500"
          : "bg-primary/10 text-primary",
      )}
    >
      {icon}
    </span>
    <p className="mt-1.5 text-[12.5px] font-extrabold text-foreground">{title}</p>
    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
      {subtitle}
    </p>
  </div>
);

const NotEnrolledCTA = ({ onStart }: { onStart: () => void }) => (
  <section className="rounded-2xl border border-border bg-card p-5 text-center">
    <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
    <p className="mt-2 text-[13px] font-bold text-foreground">
      아직 21일 프로그램에 등록되지 않았어요
    </p>
    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
      먼저 21일 프로그램을 시작하면 이곳에서 완주 후 다음 단계를 선택할 수 있어요.
    </p>
    <Button onClick={onStart} className="mt-3 h-10 w-full rounded-xl">
      3분 온보딩 시작
    </Button>
  </section>
);

const LockedLanding = ({
  currentDay,
  onGuide,
  onHome,
  onEarlyStart,
  earlyStartPending,
}: {
  currentDay: number;
  onGuide: () => void;
  onHome: () => void;
  onEarlyStart: () => void;
  earlyStartPending: boolean;
}) => (
  <section className="space-y-3">
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-primary" />
        <p className="text-[12px] font-extrabold text-foreground">
          Day {currentDay} / 21 진행 중
        </p>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        21일 자가 기록을 마치면 자동으로 활성화돼요. 다만 21일을 다 채우지 않고
        <strong className="text-foreground"> 유지·연장 프로그램부터 바로 시작</strong>
        하고 싶다면 아래 "지금 시작하기" 로 즉시 진입할 수 있어요.
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, (currentDay / 21) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[11px] font-bold text-muted-foreground">
        {Math.max(0, 21 - currentDay)}일 남음
      </p>
    </div>

    {/* 추가: 21일 안 채우고 조기 시작 CTA */}
    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-emerald-600" />
        <p className="text-[12px] font-extrabold text-emerald-700">
          지금 바로 21일 이후 프로그램 시작
        </p>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-foreground">
        21일을 다 채우지 않고도 유지·연장 프로그램으로 즉시 진입할 수 있어요.
        지금까지의 기록은 그대로 유지되며, 다음 단계 두 갈래에서 한 가지를
        고르고 데드라인·목표를 설정합니다.
      </p>
      <Button
        onClick={onEarlyStart}
        disabled={earlyStartPending}
        className={cn(
          "mt-3 h-10 w-full rounded-xl font-bold",
          "bg-emerald-500 text-white hover:bg-emerald-500/90 disabled:opacity-60",
        )}
      >
        {earlyStartPending ? "활성화 중..." : "지금 시작하기"}
      </Button>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={onGuide} className="h-11 rounded-xl">
        21일 이후 가이드
      </Button>
      <Button onClick={onHome} className="h-11 rounded-xl">
        오늘 체크인 하러
      </Button>
    </div>
  </section>
);

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card p-5 text-center text-[12px] text-muted-foreground">
    {children}
  </section>
);

export default DietPostProgramPage;
