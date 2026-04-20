import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasterTrackBadgeProps {
  /** overall_level 41~99 (preferred) OR masterLevel 1~59 */
  overallLevel?: number;
  masterLevel?: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Compact pill shown on HomePage / MyPage / RankUpPage next to the
 * classic rank badge. Gold gradient for the master track identity;
 * Lv99 (grand champion) gets an extra rainbow halo pulse.
 */
export const MasterTrackBadge = ({
  overallLevel,
  masterLevel,
  size = "md",
  className,
}: MasterTrackBadgeProps) => {
  const displayLevel =
    overallLevel ?? (masterLevel !== undefined ? 40 + masterLevel : null);
  if (displayLevel == null) return null;

  const isGrand = displayLevel >= 99;
  const sizeCls =
    size === "sm"
      ? "h-6 px-2 text-[10px] gap-1"
      : "h-7 px-2.5 text-[11px] gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold leading-none",
        "bg-gradient-to-r from-[hsl(42_92%_52%)] via-[hsl(36_96%_58%)] to-[hsl(24_94%_52%)] text-[hsl(30_60%_14%)]",
        "shadow-[0_0_10px_rgba(246,196,83,0.4)]",
        isGrand && "animate-[aura-holo_4s_linear_infinite]",
        sizeCls,
        className,
      )}
      aria-label={`MASTER Lv.${displayLevel}`}
    >
      <Crown className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>MASTER</span>
      <span className="number-font">Lv.{displayLevel}</span>
    </span>
  );
};

export default MasterTrackBadge;
