import type { ReactNode } from "react";
import { Lock, CheckCircle2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type MissionStatus = "locked" | "active" | "completed";

interface MissionCardProps {
  title: string;
  subtitle?: string;
  reward?: string;
  status: MissionStatus;
  ctaText?: string;
  onClick?: () => void;
  /** Motivational copy shown on locked state (e.g. "체크인 후 미션 오픈"). */
  lockedHint?: string;
  /** Extra visual slot (thumbnail / emoji). */
  media?: ReactNode;
  className?: string;
}

const STATE_STYLES: Record<MissionStatus, string> = {
  locked: "border-border bg-card/60 opacity-80",
  active:
    "border-primary/30 bg-card shadow-glow-soft hover:shadow-glow-primary",
  completed: "border-status-complete/30 bg-card",
};

const STATE_LABEL: Record<MissionStatus, string> = {
  locked: "잠김",
  active: "도전 가능",
  completed: "완료",
};

const STATE_LABEL_COLOR: Record<MissionStatus, string> = {
  locked: "text-status-locked",
  active: "text-primary",
  completed: "text-status-complete",
};

export const MissionCard = ({
  title,
  subtitle,
  reward,
  status,
  ctaText,
  onClick,
  lockedHint,
  media,
  className,
}: MissionCardProps) => {
  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const StatusIcon = isCompleted ? CheckCircle2 : isLocked ? Lock : Play;

  return (
    <article
      className={cn(
        "rounded-card border p-4 transition-all",
        STATE_STYLES[status],
        className,
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3 min-w-0">
          {media && <div className="flex shrink-0 items-center">{media}</div>}
          <div className="min-w-0 flex-1">
            <h3 className="text-body-lg truncate font-bold text-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="text-caption mt-0.5 text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <span
          className={cn(
            "badge-pill shrink-0 bg-current/10",
            STATE_LABEL_COLOR[status],
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {STATE_LABEL[status]}
        </span>
      </header>

      {/* Locked hint — motivational instead of "unavailable" */}
      {isLocked && lockedHint && (
        <p className="mb-3 text-caption text-muted-foreground">{lockedHint}</p>
      )}

      {/* Reward + CTA row */}
      <div className="flex items-center justify-between gap-3">
        {reward ? (
          <span className="text-caption font-bold text-reward">{reward}</span>
        ) : (
          <span />
        )}
        {ctaText && (
          <button
            type="button"
            onClick={onClick}
            disabled={isLocked}
            className={cn(
              "rounded-xl px-4 py-2 text-caption font-bold transition-all active:scale-[0.97]",
              isLocked
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : isCompleted
                  ? "bg-status-complete/15 text-status-complete"
                  : "bg-primary text-primary-foreground shadow-glow-soft hover:shadow-glow-primary",
            )}
          >
            {ctaText}
          </button>
        )}
      </div>
    </article>
  );
};

export default MissionCard;
