import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Flag,
  HeartHandshake,
  Lock,
  ShieldCheck,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDietProgress } from "@/hooks/useDietEnrollment";
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
  const progressQuery = useDietProgress();

  const payload =
    progressQuery.data && "success" in progressQuery.data && progressQuery.data.success
      ? progressQuery.data
      : null;
  const enrollment = payload?.enrollment;
  const snapshot = payload?.snapshot;
  const status = enrollment?.status;

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

        {progressQuery.isLoading ? (
          <Placeholder>불러오는 중...</Placeholder>
        ) : !enrollment ? (
          <NotEnrolledCTA onStart={() => navigate("/diet/onboarding")} />
        ) : status === "completed" ? (
          <PostProgramRouter
            enrollmentId={enrollment.id}
            recentAdherence7d={snapshot?.habit_score ?? null}
          />
        ) : (
          <LockedLanding
            currentDay={enrollment.current_day}
            onGuide={() => navigate("/diet/after-21")}
            onHome={() => navigate("/diet")}
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
}: {
  currentDay: number;
  onGuide: () => void;
  onHome: () => void;
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
        유지·연장 프로그램은 21일 완주 후 자동으로 활성화됩니다.
        지금은 오늘의 체크인에 집중해 주세요. 21일 이후에 어떻게 진행되는지
        미리 보려면 아래 가이드를 확인할 수 있어요.
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
