import { Check, Crown, Lock, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

import { MasterRewardStack } from "./MasterRewardStack";
import type { MasterLevelDefinition } from "@/data/masterTierData";

export type MasterLevelState = "locked" | "upcoming" | "current" | "completed";

interface MasterLevelCardProps {
  def: MasterLevelDefinition;
  state: MasterLevelState;
  onClick?: () => void;
  className?: string;
}

/**
 * Single-level card for the Master Track map.
 *
 * Three visual variants keyed on `def.isBoss` + Lv99:
 *   - Lv99 (grand champion): gold gradient + rainbow accent, always
 *     celebratory even when upcoming.
 *   - Other boss (10/20/30/40/50): red/gold accent, Swords icon,
 *     larger row and prominent boss badge.
 *   - Normal: slim row, muted accent, bullet icon.
 *
 * State tints (locked/upcoming/current/completed) stack on top of the
 * variant so the user always reads (a) is this a boss? (b) am I here?
 */
export const MasterLevelCard = ({
  def,
  state,
  onClick,
  className,
}: MasterLevelCardProps) => {
  const isGrand = def.masterLevel === 59;
  const isBoss = def.isBoss;
  const isCurrent = state === "current";
  const isCompleted = state === "completed";
  const isLocked = state === "locked";

  const Icon = isGrand ? Trophy : isBoss ? Swords : Crown;

  return (
    <article
      className={cn(
        "relative rounded-2xl border transition-all",
        // Variant base
        isGrand &&
          "border-reward/50 bg-gradient-to-br from-[hsl(42_92%_18%)] via-[hsl(36_96%_14%)] to-[hsl(24_94%_12%)] shadow-[0_0_24px_rgba(246,196,83,0.25)]",
        isBoss && !isGrand &&
          "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card shadow-glow-soft",
        !isBoss &&
          "border-border bg-card",
        // State overlay
        isCompleted && "opacity-75",
        isLocked && "opacity-60",
        isCurrent && !isGrand && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isCurrent && isGrand && "ring-2 ring-reward ring-offset-2 ring-offset-background",
        onClick && "cursor-pointer active:scale-[0.99]",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          isBoss ? "p-4" : "px-4 py-3",
        )}
      >
        {/* Level chip */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl font-bold",
            isBoss ? "h-12 w-12 text-sm" : "h-10 w-10 text-[13px]",
            isGrand &&
              "bg-gradient-to-br from-[hsl(42_100%_58%)] to-[hsl(24_100%_48%)] text-[hsl(30_60%_12%)]",
            isBoss && !isGrand && "bg-primary/15 text-primary",
            !isBoss && "bg-muted text-foreground/70",
          )}
        >
          <span className="number-font leading-none">{def.overallLevel}</span>
        </div>

        {/* Title + reward chips */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon
              className={cn(
                "shrink-0",
                isGrand ? "h-4 w-4 text-reward" :
                isBoss ? "h-3.5 w-3.5 text-primary" :
                "h-3 w-3 text-muted-foreground",
              )}
            />
            <h3
              className={cn(
                "truncate font-bold",
                isGrand ? "text-[15px] text-reward" :
                isBoss ? "text-sm text-foreground" :
                "text-[13px] text-foreground/85",
              )}
            >
              {def.title}
            </h3>
            {isBoss && (
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                  isGrand ? "bg-reward text-[hsl(30_60%_12%)]" : "bg-primary text-primary-foreground",
                )}
              >
                {isGrand ? "GRAND" : "BOSS"}
              </span>
            )}
          </div>
          {isBoss && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {def.description}
            </p>
          )}
          <div className="mt-1.5">
            <MasterRewardStack def={def} dim={isLocked} />
          </div>
        </div>

        {/* State indicator */}
        <div className="shrink-0">
          {isCompleted ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-background">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : isLocked ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Lock className="h-3 w-3" />
            </span>
          ) : isCurrent ? (
            <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold leading-none text-primary-foreground">
              NOW
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default MasterLevelCard;
