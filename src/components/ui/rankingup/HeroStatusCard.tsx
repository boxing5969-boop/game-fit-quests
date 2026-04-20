import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { XPBar } from "./XPBar";

interface HeroStatusCardProps {
  /** Character artwork / avatar / sprite slot. */
  character?: ReactNode;
  leagueName: string;
  leagueIcon?: ReactNode;
  level: number;
  totalXp: number;
  /** Total XP needed to reach the next level. */
  xpToNext: number;
  streakDays?: number;
  /** Shown under streak — e.g. "🔥 10일 연속 출석" fallback if streakDays omitted. */
  streakLabel?: string;
  /** Extra action slot, renders top-right corner of the card. */
  action?: ReactNode;
  className?: string;
}

/**
 * Hero card: large character on a dark gradient stage, with league /
 * level badge, XP progress to next level, and an optional streak chip.
 */
export const HeroStatusCard = ({
  character,
  leagueName,
  leagueIcon,
  level,
  totalXp,
  xpToNext,
  streakDays,
  streakLabel,
  action,
  className,
}: HeroStatusCardProps) => {
  const streakText =
    streakLabel ??
    (streakDays && streakDays > 0 ? `${streakDays}일 연속 출석 중` : null);

  return (
    <section className={cn("hero-card", className)}>
      {/* Ambient glow backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {action && (
        <div className="absolute right-4 top-4 z-10">{action}</div>
      )}

      <div className="relative flex flex-col items-center text-center">
        {/* Character / artwork slot */}
        {character && (
          <div className="mb-4 flex h-40 w-40 items-center justify-center">
            {character}
          </div>
        )}

        {/* League + level badge */}
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-background/60 px-3.5 py-1 backdrop-blur">
          {leagueIcon && (
            <span className="flex items-center text-base">{leagueIcon}</span>
          )}
          <span className="text-body-sm font-bold text-foreground">
            {leagueName} · Lv.
            <span className="number-font">{level}</span>
          </span>
        </div>

        {/* Streak chip */}
        {streakText && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-reward/15 px-3 py-1">
            <Flame className="h-3.5 w-3.5 text-reward" />
            <span className="text-caption font-bold text-reward">
              {streakText}
            </span>
          </div>
        )}

        {/* XP progress to next level — spec: primary gradient for XP */}
        <div className="mt-5 w-full">
          <XPBar
            current={totalXp}
            max={xpToNext}
            variant="primary"
            size="md"
            label="다음 승급까지"
            showNumbers
          />
        </div>
      </div>
    </section>
  );
};

export default HeroStatusCard;
