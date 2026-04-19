import { useWeeklyStats } from "@/hooks/useWeeklyStats";
import { getActivityZone } from "@/data/dashboardMockData";
import { useNavigate } from "react-router-dom";
import { Activity, Dumbbell, Flame, Timer, BookOpen } from "lucide-react";

const WeeklyDashboard = () => {
  const metrics = useWeeklyStats();
  const navigate = useNavigate();
  const zone = getActivityZone(metrics.activityMinutes);
  const progress = Math.min((metrics.activityMinutes / 150) * 100, 100);

  return (
    <div className="space-y-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        📊 주간 대시보드
      </h2>

      {/* Activity ring */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">주간 활동</span>
          </div>
          <span className={`text-xs font-bold ${zone.color}`}>{zone.label}</span>
        </div>
        {/* Progress bar */}
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-reward transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{metrics.activityMinutes}분 / 150분 목표</span>
          <span>{zone.description}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Strength days */}
        <div className="rounded-xl border border-border bg-card p-3 text-center shadow-elev-1">
          <Dumbbell className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="text-lg font-bold text-foreground">{metrics.strengthDays}/2</p>
          <p className="text-[10px] text-muted-foreground">근력운동</p>
        </div>
        {/* Intensity */}
        <div className="rounded-xl border border-border bg-card p-3 text-center shadow-elev-1">
          <Flame className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="text-lg font-bold text-foreground">RPE {metrics.averageRpe}</p>
          <p className="text-[10px] text-muted-foreground">평균 강도</p>
        </div>
        {/* High intensity */}
        <div className="rounded-xl border border-border bg-card p-3 text-center shadow-elev-1">
          <Timer className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="text-lg font-bold text-foreground">{metrics.highIntensitySessions}회</p>
          <p className="text-[10px] text-muted-foreground">고강도 세션</p>
        </div>
      </div>

      {/* Sedentary reminder */}
      <div className="rounded-xl bg-reward/10 p-3 text-center">
        <p className="text-xs text-foreground font-medium">🪑 오래 앉아 있었다면 3분 움직이기</p>
        <p className="text-[10px] text-muted-foreground">짧은 움직임도 누적됩니다</p>
      </div>

      {/* Balance counter (conditional) */}
      {(metrics.isOver65 || metrics.hasBalanceFlag) && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">⚖️ 균형 훈련</span>
            <span className="text-sm font-bold text-primary">{metrics.balanceSessions}/3</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">이번 주 균형 훈련 횟수</p>
        </div>
      )}

      {/* Guide quick action */}
      <button
        onClick={() => navigate("/guide")}
        className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 transition-all active:scale-[0.98]"
      >
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="text-sm font-bold text-primary">가이드 다시 보기</span>
      </button>

      <p className="text-center text-[10px] text-muted-foreground/50">
        WHO·CDC·ACSM 권고안을 참고해 설계됨
      </p>
    </div>
  );
};

export default WeeklyDashboard;
