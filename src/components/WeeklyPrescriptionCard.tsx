// Weekly Prescription Card — shows weekly training recommendation
import { useWeeklyPrescription } from "@/hooks/useWeeklyPrescription";
import { Calendar, Target, Clock } from "lucide-react";

const PLAN_STYLE: Record<string, { bg: string; text: string; emoji: string }> = {
  "라이트": { bg: "bg-status-complete/10", text: "text-status-complete", emoji: "🌿" },
  "기본": { bg: "bg-primary/10", text: "text-primary", emoji: "💪" },
  "빠른 경로": { bg: "bg-accent/10", text: "text-accent-foreground", emoji: "⚡" },
};

const WeeklyPrescriptionCard = () => {
  const { prescription, weeklyStats } = useWeeklyPrescription();
  const style = PLAN_STYLE[prescription.planType] || PLAN_STYLE["기본"];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">📋 이번 주 추천</span>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}>
          {style.emoji} {prescription.planType}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <Target className="mx-auto h-3.5 w-3.5 text-primary" />
          <p className="mt-0.5 text-sm font-bold text-foreground">{weeklyStats.sessions}/{prescription.targetSessions}</p>
          <p className="text-[9px] text-muted-foreground">세션</p>
        </div>
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <Clock className="mx-auto h-3.5 w-3.5 text-primary" />
          <p className="mt-0.5 text-sm font-bold text-foreground">{weeklyStats.minutes}/{prescription.targetMinutes}</p>
          <p className="text-[9px] text-muted-foreground">분</p>
        </div>
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <span className="text-sm">🏠</span>
          <p className="mt-0.5 text-sm font-bold text-foreground">{prescription.targetHomeMissions}</p>
          <p className="text-[9px] text-muted-foreground">홈미션</p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {prescription.focusAreas.map(area => (
          <span key={area} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{area}</span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{prescription.motivationCopy}</p>
    </div>
  );
};

export default WeeklyPrescriptionCard;
