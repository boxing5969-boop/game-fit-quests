// Retention Banner — shows re-engagement messages based on activity
import { useRetention } from "@/hooks/useRetention";
import { useNavigate } from "react-router-dom";

const STATE_STYLE: Record<string, { border: string; bg: string; emoji: string }> = {
  active: { border: "border-primary/20", bg: "bg-primary/5", emoji: "💬" },
  slight_drop: { border: "border-status-pending/20", bg: "bg-status-pending/5", emoji: "👋" },
  at_risk: { border: "border-accent/30", bg: "bg-accent/5", emoji: "🔔" },
  coach_attention: { border: "border-destructive/20", bg: "bg-destructive/5", emoji: "⚠️" },
};

const RetentionBanner = () => {
  const retention = useRetention();
  const navigate = useNavigate();
  const style = STATE_STYLE[retention.state] || STATE_STYLE.active;

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
