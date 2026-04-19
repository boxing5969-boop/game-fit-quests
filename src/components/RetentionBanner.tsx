// Retention Banner — shows re-engagement messages based on activity
// Restart Routine banner only shows for 5+ days inactive
import { useRetention } from "@/hooks/useRetention";
import { useNavigate } from "react-router-dom";

const STATE_STYLE: Record<string, { border: string; bg: string; emoji: string }> = {
  active: { border: "border-primary/20", bg: "bg-primary/5", emoji: "💬" },
  slight_drop: { border: "border-status-pending/20", bg: "bg-status-pending/5", emoji: "👋" },
  at_risk: { border: "border-reward/30", bg: "bg-reward/5", emoji: "🔔" },
  coach_attention: { border: "border-destructive/20", bg: "bg-destructive/5", emoji: "⚠️" },
};

const RetentionBanner = () => {
  const retention = useRetention();
  const navigate = useNavigate();
  const style = STATE_STYLE[retention.state] || STATE_STYLE.active;

  // Restart routine: stronger visual when 14+ days
  if (retention.showRestartRoutine && retention.restartEmphasis === "strong") {
    return (
      <div className="rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-5">
        <p className="mb-1 text-xs font-bold text-destructive">🔥 리스타트 루틴</p>
        <p className="text-sm font-medium text-foreground">
          오랜만에 다시 시작하는 회원을 위한 가벼운 복귀 루틴
        </p>
        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{retention.message}</p>
        <button
          onClick={() => navigate("/missions")}
          className="mt-3 w-full rounded-xl bg-destructive/90 px-4 py-2.5 text-sm font-bold text-destructive-foreground transition-all active:scale-95"
        >
          가볍게 다시 시작하기
        </button>
      </div>
    );
  }

  // Normal restart routine banner (5~13 days)
  if (retention.showRestartRoutine) {
    return (
      <div className="rounded-2xl border border-reward/30 bg-reward/5 p-4">
        <p className="mb-1 text-xs font-bold text-reward-foreground">🔄 리스타트 루틴</p>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{retention.message}</p>
        <button
          onClick={() => navigate("/missions")}
          className="mt-2 rounded-full bg-reward/10 px-3 py-1.5 text-xs font-bold text-reward-foreground transition-all active:scale-95"
        >
          가볍게 다시 시작하기
        </button>
      </div>
    );
  }

  // Regular retention banner (active / slight_drop without restart)
  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-4`}>
      <p className="mb-1 text-xs font-bold text-primary">{style.emoji} 오늘의 한마디</p>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{retention.message}</p>
      {retention.actionLabel && (
        <button
          onClick={() => navigate("/missions")}
          className="mt-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all active:scale-95"
        >
          {retention.actionLabel}
        </button>
      )}
    </div>
  );
};

export default RetentionBanner;
