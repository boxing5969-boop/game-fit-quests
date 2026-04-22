import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Brain,
  Calendar,
  ChevronLeft,
  LineChart,
  Salad,
  Sparkles,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import { useTodayDailyLog } from "@/hooks/useDietDailyLog";
import {
  DIET_STAGES,
  DIET_TRACK_LABEL,
} from "@/data/dietProgramData";
import type { DailyHabitsPayload } from "@/services/dietService";
import { computeHabitScore, getDailyPlan } from "@/lib/diet/ruleEngine";
import type { DietTrack } from "@/lib/dietTrack";

import DietTrackBadge from "@/components/diet/DietTrackBadge";
import DailyMissionList from "@/components/diet/DailyMissionList";
import HabitScoreCard from "@/components/diet/HabitScoreCard";
import MilestoneProgressStrip from "@/components/diet/MilestoneProgressStrip";
import CoachCornerCard from "@/components/diet/CoachCornerCard";
import DietReminderBanner from "@/components/diet/DietReminderBanner";
import DietCompletionModal from "@/components/diet/DietCompletionModal";
import { useDietPreferences } from "@/hooks/useDietPreferences";
import { useDietAnalytics } from "@/hooks/useDietAnalytics";
import {
  DIET_DROP_OFF_FLAG_KEY,
  DIET_EVENT_TYPES,
} from "@/lib/diet/analytics";
import { useState } from "react";
import { cn } from "@/lib/utils";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * /diet — 153 프로그램 홈.
 *
 * 렌더 모드 (순서대로 확인)
 *   1. feature flag OFF → 곧 공개 플레이스홀더
 *   2. 로딩 → 스켈레톤 텍스트
 *   3. active enrollment 없음 → 온보딩 CTA
 *   4. active → 전체 홈 (Day/Stage + 오늘 미션 + 점수 + 배지 + 코치 한마디 + CTA 모음)
 */
const DietHubPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const progressQuery = useDietProgress();

  const featureEnabled = !!profile?.diet_program_enabled;

  if (!featureEnabled) {
    return (
      <HubShell onBack={() => navigate(-1)}>
        <ComingSoon />
      </HubShell>
    );
  }

  if (progressQuery.isLoading) {
    return (
      <HubShell onBack={() => navigate(-1)}>
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12px] text-muted-foreground">
          불러오는 중...
        </div>
      </HubShell>
    );
  }

  const payload = progressQuery.data;
  const hasActive =
    payload && "success" in payload && payload.success && payload.has_active;

  if (!hasActive) {
    return (
      <HubShell onBack={() => navigate(-1)}>
        <OnboardingCTA onStart={() => navigate("/diet/onboarding")} />
      </HubShell>
    );
  }

  return (
    <HubShell onBack={() => navigate(-1)}>
      <ActiveHome
        enrollmentId={payload.enrollment!.id}
        track={payload.enrollment!.track}
        currentDay={payload.enrollment!.current_day}
        stageLabel={stageLabel(payload.enrollment!.current_stage)}
        startDate={payload.enrollment!.start_date}
        approvedDays={payload.snapshot?.approved_days_total ?? 0}
        currentStreak={payload.snapshot?.current_streak ?? 0}
        bestStreak={payload.snapshot?.best_streak ?? 0}
        pendingDays={payload.pending_days ?? 0}
        milestone7={payload.snapshot?.milestone_7_reached ?? false}
        milestone14={payload.snapshot?.milestone_14_reached ?? false}
        milestone21={payload.snapshot?.milestone_21_reached ?? false}
        lastLogDate={payload.snapshot?.last_log_date ?? null}
        enrollmentStatus={payload.enrollment!.status}
      />
    </HubShell>
  );
};

// ──────────────────────────────────────────────────────────────────
// Shell + placeholder
// ──────────────────────────────────────────────────────────────────
const HubShell = ({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) => (
  <AppPage
    header={
      <PageHeader
        title="153 다이어트"
        subtitle="21일 습관 리셋 프로그램"
        leftAction={
          <button
            type="button"
            onClick={onBack}
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
    <div className="space-y-4 pt-2">{children}</div>
  </AppPage>
);

const ComingSoon = () => (
  <div
    className={cn(
      "rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center",
    )}
  >
    <Sparkles className="mx-auto h-6 w-6 text-primary" />
    <p className="mt-2 text-[14px] font-bold text-foreground">곧 공개됩니다</p>
    <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
      153 다이어트 프로그램이 지점별 순차 공개됩니다. 관장님 또는 담당 코치에게 문의해 주세요.
    </p>
  </div>
);

const OnboardingCTA = ({ onStart }: { onStart: () => void }) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
        153 DIET · 21 DAYS
      </p>
      <h2 className="mt-1 text-display-sm text-foreground leading-tight">
        체지방을 제거하는 몸 습관 만들기
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        체중 숫자가 아니라 식사 리듬·출석·회복 습관에 집중합니다. 복싱짐 출석과 AI 코치님의 피드백이 함께 갑니다.
      </p>
    </div>
    <ul className="space-y-1.5">
      {[
        "매일 5개 습관 체크 + 식단 사진",
        "AI 코치님의 맞춤 피드백 + 배지 보상",
        "21일 후 유지 플랜 선택형",
      ].map((t) => (
        <li
          key={t}
          className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] text-foreground"
        >
          <span className="mt-0.5 text-primary">·</span>
          {t}
        </li>
      ))}
    </ul>
    <Button
      onClick={onStart}
      className={cn(
        "h-12 w-full rounded-2xl font-bold tracking-wide",
        "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
        "hover:from-primary/95 hover:to-primary/80",
        "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
      )}
    >
      3분 온보딩 시작하기
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Active home
// ──────────────────────────────────────────────────────────────────
interface ActiveHomeProps {
  enrollmentId: string;
  track: DietTrack;
  currentDay: number;
  stageLabel: string;
  startDate: string;
  approvedDays: number;
  currentStreak: number;
  bestStreak: number;
  pendingDays: number;
  milestone7: boolean;
  milestone14: boolean;
  milestone21: boolean;
  lastLogDate: string | null;
  enrollmentStatus: string;
}

const COMPLETION_SHOWN_KEY = "diet_completion_shown_v1";

const ActiveHome = (p: ActiveHomeProps) => {
  const navigate = useNavigate();
  const logDate = todayIso();
  const todayLogQuery = useTodayDailyLog(p.enrollmentId, logDate);
  const logRow = todayLogQuery.data ?? null;
  const { data: prefs } = useDietPreferences();
  const { logEvent } = useDietAnalytics();

  const todayPlan = useMemo(
    () => getDailyPlan(p.track, p.currentDay),
    [p.track, p.currentDay],
  );

  const habitScore = useMemo(() => {
    const responses: DailyHabitsPayload = {
      protein_first: logRow?.protein_first ?? null,
      veggies_natural: logRow?.veggies_natural ?? null,
      sugary_drink_avoided: logRow?.sugary_drink_avoided ?? null,
      late_night_snack_avoided: logRow?.late_night_snack_avoided ?? null,
      gym_attended: logRow?.gym_attended ?? null,
    };
    return computeHabitScore(responses);
  }, [logRow]);

  const coachNoteQuery = useLatestCoachNote(p.enrollmentId);

  // 완주 축하 모달 — enrollment.status === 'completed' && 아직 안 봤을 때 1회만
  const [showCompletion, setShowCompletion] = useState(false);
  useEffect(() => {
    if (p.enrollmentStatus !== "completed") return;
    try {
      const key = `${COMPLETION_SHOWN_KEY}_${p.enrollmentId}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, new Date().toISOString());
      setShowCompletion(true);
    } catch {
      // localStorage 실패해도 모달은 skip — UX 영향 없음
    }
  }, [p.enrollmentStatus, p.enrollmentId]);

  // drop-off 이벤트 — 세션당 1회만 (sessionStorage 플래그)
  useEffect(() => {
    if (!p.lastLogDate) return;
    if (logRow) return; // 오늘 기록 있으면 drop-off 아님
    try {
      const last = new Date(`${p.lastLogDate}T00:00:00`);
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const gap = Math.floor(
        (todayMid.getTime() - last.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (gap < 3) return;
      const flagKey = `${DIET_DROP_OFF_FLAG_KEY}_${p.enrollmentId}`;
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, "1");
      void logEvent(DIET_EVENT_TYPES.DROP_OFF_MARKED, {
        enrollment_id: p.enrollmentId,
        gap_days: gap,
      });
    } catch {
      // 분석은 best-effort — 실패 무시
    }
  }, [p.lastLogDate, p.enrollmentId, logRow, logEvent]);

  const checkinState = logRow?.status ?? null;

  return (
    <div className="space-y-4">
      {/* 스마트 리마인더 배너 — drop-off → rejected → 시간대 순 */}
      <DietReminderBanner
        todayStatus={logRow?.status ?? null}
        lastLogDate={p.lastLogDate}
        prefs={prefs}
        onGo={() => navigate("/diet/tracker")}
      />

      {/* Hero: Day + Stage + track */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              {p.stageLabel}
            </p>
            <h2 className="mt-0.5 text-display-sm text-foreground leading-tight">
              Day {p.currentDay} <span className="text-muted-foreground text-[18px]">/ 21</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {DIET_TRACK_LABEL[p.track]} · 시작 {p.startDate}
            </p>
          </div>
          <DietTrackBadge track={p.track} />
        </div>
        {/* CTA 오늘 체크인 */}
        <CheckinCta
          state={checkinState}
          onGo={() => navigate("/diet/tracker")}
        />
      </div>

      {/* 점수 */}
      <HabitScoreCard
        habitScore={habitScore}
        approvedDays={p.approvedDays}
        streak={p.currentStreak}
      />

      {/* 오늘의 핵심 미션 (요약 3개) */}
      <Section
        title="오늘의 미션"
        action={
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-[12px] font-bold text-primary"
            onClick={() => navigate("/diet/tracker")}
          >
            체크하러 가기
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Button>
        }
      >
        <DailyMissionList missions={todayPlan.missions} limit={5} />
      </Section>

      {/* 배지 진행 */}
      <MilestoneProgressStrip
        approvedDays={p.approvedDays}
        milestone7Reached={p.milestone7}
        milestone14Reached={p.milestone14}
        milestone21Reached={p.milestone21}
      />

      {/* 코치 한마디 */}
      <CoachCornerCard
        latestNoteText={coachNoteQuery.data?.note_text ?? null}
        createdAt={coachNoteQuery.data?.created_at ?? null}
      />

      {/* 하위 페이지 네비게이션 — 과학·식단 탭 추가로 5 grid 구성 */}
      <div className="grid grid-cols-2 gap-2">
        <NavTile
          icon={<Brain className="h-4 w-4" />}
          label="왜 153 다이어트?"
          hint="과학·원리 설명"
          onClick={() => navigate("/diet/value")}
        />
        <NavTile
          icon={<Salad className="h-4 w-4" />}
          label="21일 식단"
          hint="무제한·적정량·피하기"
          onClick={() => navigate("/diet/meal-plan")}
        />
        <NavTile
          icon={<LineChart className="h-4 w-4" />}
          label="진행 현황"
          hint="21일 타임라인"
          onClick={() => navigate("/diet/progress")}
        />
        <NavTile
          icon={<UtensilsCrossed className="h-4 w-4" />}
          label="음식 가이드"
          hint="권장·줄이기·팁"
          onClick={() => navigate("/diet/food")}
        />
        <NavTile
          icon={<Trophy className="h-4 w-4" />}
          label="습관 랭킹"
          hint="지점 완주율"
          onClick={() => navigate("/diet/ranking")}
          className="col-span-2"
        />
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        현재 검토 대기: <strong className="text-foreground">{p.pendingDays}</strong>일
      </p>

      {/* 21일 완주 축하 모달 — 1회성 */}
      <DietCompletionModal
        open={showCompletion}
        approvedDays={p.approvedDays}
        bestStreak={p.bestStreak}
        onClose={() => setShowCompletion(false)}
        onChoosePlan={() => navigate("/settings")}
      />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// 체크인 CTA
// ──────────────────────────────────────────────────────────────────
const CheckinCta = ({
  state,
  onGo,
}: {
  state: string | null;
  onGo: () => void;
}) => {
  const { label, tone } = ctaCopy(state);
  return (
    <button
      type="button"
      onClick={onGo}
      className={cn(
        "mt-4 flex w-full items-center justify-between rounded-2xl px-4 py-3",
        "text-left transition-all active:scale-[0.99]",
        "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
        "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
      )}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
          {tone}
        </p>
        <p className="text-[15px] font-black">{label}</p>
      </div>
      <ArrowRight className="h-5 w-5" />
    </button>
  );
};

function ctaCopy(state: string | null) {
  if (state === "approved")
    return { tone: "오늘의 기록", label: "승인 완료 — 내일도 이어서" };
  if (state === "pending")
    return { tone: "검토 대기 중", label: "기록 수정하러 가기" };
  if (state === "revision_requested")
    return { tone: "수정 요청됨", label: "다시 한 번 정리해보기" };
  if (state === "rejected")
    return { tone: "오늘 다시 기록", label: "한 끼부터 다시 시작" };
  return { tone: "오늘의 체크인", label: "체크인 시작" };
}

// ──────────────────────────────────────────────────────────────────
// 유틸 / 보조 컴포넌트
// ──────────────────────────────────────────────────────────────────
const Section = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-[13px] font-bold text-foreground">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const NavTile = ({
  icon,
  label,
  hint,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 active:scale-[0.99]",
      className,
    )}
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </span>
    <p className="mt-2 text-[13px] font-bold text-foreground">{label}</p>
    <p className="text-[11px] text-muted-foreground">{hint}</p>
  </button>
);

function stageLabel(stageId: string): string {
  return DIET_STAGES.find((s) => s.id === stageId)?.label ?? "";
}

/** 가장 최근 코치 노트(visibility='member_visible')를 단순 조회 — 소량이라 RLS 로 충분 */
function useLatestCoachNote(enrollmentId: string) {
  return useQuery({
    queryKey: ["diet", "latestCoachNote", enrollmentId],
    enabled: !!enrollmentId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diet_coach_notes")
        .select("note_text, created_at")
        .eq("enrollment_id", enrollmentId)
        .eq("visibility", "member_visible")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
  });
}

// 사용하지 않는 아이콘 import 방지용 참조
void Calendar;

export default DietHubPage;
