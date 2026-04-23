import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";

import { useDietProgress } from "@/hooks/useDietEnrollment";
import { useRecentLogs } from "@/hooks/useDietDailyLog";
import { DIET_STAGES } from "@/data/dietProgramData";
import type { Database } from "@/integrations/supabase/types";

import DietTrackBadge from "@/components/diet/DietTrackBadge";
import DietTimelineStrip from "@/components/diet/DietTimelineStrip";
import HabitScoreCard from "@/components/diet/HabitScoreCard";
import MilestoneProgressStrip from "@/components/diet/MilestoneProgressStrip";

type LogStatus = Database["public"]["Enums"]["diet_log_status"];

/**
 * /diet/progress — 21일 타임라인 + 주간 체크인 요약.
 *
 * 체중 그래프는 의도적으로 제공하지 않는다 (절대 규칙 9).
 * 모든 시각화는 승인된 일수·스트릭·습관 점수에만 기반.
 */
const DietProgressPage = () => {
  const navigate = useNavigate();
  const progressQuery = useDietProgress();
  const payload = progressQuery.data;
  const hasActive =
    payload && "success" in payload && payload.success && payload.has_active;
  const enrollment = hasActive ? payload.enrollment! : null;
  const snapshot = hasActive ? payload.snapshot : null;

  const recentLogsQuery = useRecentLogs(enrollment?.id, 21);

  const statusByDay = useMemo(() => {
    const map: Partial<Record<number, LogStatus>> = {};
    (recentLogsQuery.data ?? []).forEach((row) => {
      map[row.day_number] = row.status;
    });
    return map;
  }, [recentLogsQuery.data]);

  const weekSummaries = useMemo(() => {
    if (!recentLogsQuery.data) return [];
    return [1, 2, 3].map((weekIdx) => {
      const days: number[] = [];
      for (let d = (weekIdx - 1) * 7 + 1; d <= weekIdx * 7; d++) days.push(d);
      const rows = recentLogsQuery.data.filter((r) =>
        days.includes(r.day_number),
      );
      const approved = rows.filter((r) => r.status === "approved").length;
      const pending = rows.filter((r) => r.status === "pending").length;
      const rejected = rows.filter((r) => r.status === "rejected").length;
      return { weekIdx, approved, pending, rejected, total: 7 };
    });
  }, [recentLogsQuery.data]);

  return (
    <AppPage
      header={
        <PageHeader
          title="진행 현황"
          subtitle="21일 타임라인과 주간 요약"
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
        {!hasActive || !enrollment ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            아직 진행 중인 프로그램이 없어요.
          </div>
        ) : (
          <>
            {/* 헤더 요약 */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    {DIET_STAGES.find((s) => s.id === enrollment.current_stage)
                      ?.label ?? ""}
                  </p>
                  <h2 className="mt-0.5 text-display-sm text-foreground leading-tight">
                    Day {enrollment.current_day} / 21
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    시작 {enrollment.start_date}
                  </p>
                </div>
                <DietTrackBadge track={enrollment.track} />
              </div>
            </div>

            {/* 습관 점수 + 연속 */}
            <HabitScoreCard
              habitScore={snapshot?.habit_score ?? 0}
              approvedDays={snapshot?.approved_days_total ?? 0}
              streak={snapshot?.current_streak ?? 0}
            />

            {/* 타임라인 21일 */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <DietTimelineStrip
                currentDay={enrollment.current_day}
                statusByDay={statusByDay}
              />
              <Legend />
            </section>

            {/* 주간 체크인 요약 */}
            <section className="space-y-2">
              <h3 className="text-[13px] font-bold text-foreground">주간 체크인</h3>
              <div className="grid grid-cols-1 gap-2">
                {weekSummaries.map((w) => (
                  <WeekCard
                    key={w.weekIdx}
                    weekIdx={w.weekIdx}
                    approved={w.approved}
                    pending={w.pending}
                    rejected={w.rejected}
                    total={w.total}
                  />
                ))}
              </div>
            </section>

            {/* 배지 진행 */}
            <MilestoneProgressStrip
              approvedDays={snapshot?.approved_days_total ?? 0}
              milestone7Reached={snapshot?.milestone_7_reached ?? false}
              milestone14Reached={snapshot?.milestone_14_reached ?? false}
              milestone21Reached={snapshot?.milestone_21_reached ?? false}
            />

            {/* 비공개 안내 */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              체중 숫자는 저장하지 않고 랭킹에도 쓰지 않습니다. 개인 기록으로 남기고 싶다면 오삼 코치님의 한마디 또는 회고 메모를 활용하세요.
            </div>
          </>
        )}
      </div>
    </AppPage>
  );
};

const Legend = () => (
  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
    <LegendDot tone="approved" label="기록" />
    <LegendDot tone="empty" label="미기록" />
  </div>
);

const LegendDot = ({
  tone,
  label,
}: {
  tone: "approved" | "pending" | "rejected" | "empty";
  label: string;
}) => {
  const cls = {
    approved: "bg-gradient-to-br from-primary to-reward",
    pending: "border border-primary/50 bg-primary/5",
    rejected: "border border-destructive bg-destructive/10",
    empty: "border border-border bg-muted",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${cls}`} />
      {label}
    </span>
  );
};

const WeekCard = ({
  weekIdx,
  approved,
  pending,
  rejected,
  total,
}: {
  weekIdx: number;
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}) => {
  const stage = DIET_STAGES[weekIdx - 1];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-wider text-primary">
            WEEK {weekIdx} · {stage?.label ?? ""}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Day {stage?.dayRange[0]}~{stage?.dayRange[1]} · {stage?.tagline}
          </p>
        </div>
        <p className="number-font text-[14px] font-extrabold text-foreground">
          {approved} <span className="text-[11px] text-muted-foreground">/ {total}</span>
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10.5px]">
        <StatPill label="기록" value={approved} tone="primary" />
        <StatPill label="미기록" value={Math.max(0, total - approved - pending - rejected)} tone="neutral" />
      </div>
    </div>
  );
};

const StatPill = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "neutral" | "danger";
}) => {
  const cls = {
    primary: "border-primary/40 bg-primary/10 text-primary",
    neutral: "border-border bg-muted/40 text-muted-foreground",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
  }[tone];
  return (
    <span
      className={`flex items-center justify-between rounded-lg border px-2 py-1 font-bold ${cls}`}
    >
      <span>{label}</span>
      <span className="number-font">{value}</span>
    </span>
  );
};

export default DietProgressPage;
