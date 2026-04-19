import { Play, Lock, Clock, CheckCircle2, Star } from "lucide-react";
import ExerciseWhyCard from "@/components/ExerciseWhyCard";

interface MissionCardProps {
  title: string;
  posterUrl?: string | null;
  difficulty: number;
  xpReward: number;
  status: "locked" | "active" | "pending" | "complete";
  onWatch?: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  adminMode?: boolean;
  purposeSummary?: string;
  purposeTags?: string[];
}

const statusConfig = {
  locked: { label: "잠김", icon: Lock, color: "text-status-locked" },
  active: { label: "진행중", icon: Star, color: "text-status-active" },
  pending: { label: "승인대기", icon: Clock, color: "text-status-pending" },
  complete: { label: "완료", icon: CheckCircle2, color: "text-status-complete" },
};

const MissionCard = ({
  title,
  posterUrl,
  difficulty,
  xpReward,
  status,
  onWatch,
  onSubmit,
  isSubmitting,
  adminMode,
  purposeSummary,
  purposeTags,
}: MissionCardProps) => {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  const isLocked = status === "locked";

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card transition-all ${
        status === "complete"
          ? "border-status-complete/30 shadow-elev-1"
          : status === "pending"
          ? "border-status-pending/20 shadow-elev-1"
          : status === "active"
          ? "border-primary/30 shadow-glow-soft hover:shadow-glow-primary"
          : "border-border opacity-60 shadow-elev-1"
      }`}
    >
      {/* Thumbnail */}
      <button
        onClick={isLocked ? undefined : onWatch}
        disabled={isLocked}
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: "16/9" }}
      >
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-reward/10">
            <span className="text-4xl">🥊</span>
          </div>
        )}
        {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
              <Play className="ml-0.5 h-7 w-7 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
        )}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </button>

      {/* Info */}
      <div className="p-3.5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground leading-snug">{title}</h3>
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} bg-current/10`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 w-3 rounded-full ${
                  i < difficulty ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-primary">+{xpReward} XP</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={isLocked ? undefined : onWatch}
            disabled={isLocked}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> 미션 보기
          </button>
          {(status === "active" || (adminMode && status !== "complete")) && onSubmit && (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                adminMode
                  ? "bg-reward text-reward-foreground shadow-glow-reward"
                  : "bg-primary text-primary-foreground shadow-glow-soft hover:shadow-glow-primary"
              }`}
            >
              {isSubmitting ? "..." : adminMode ? "⚡ 즉시 클리어" : "완료 요청"}
            </button>
          )}
        </div>

        {/* "왜 하나요?" component */}
        {purposeSummary && purposeTags && purposeTags.length > 0 && (
          <ExerciseWhyCard purposeSummary={purposeSummary} purposeTags={purposeTags} />
        )}
      </div>
    </div>
  );
};

export default MissionCard;
