import { Sparkles, ShieldAlert, Flame } from "lucide-react";
import { DIET_TRACK_LABEL } from "@/data/dietProgramData";
import type { DietTrack } from "@/lib/dietTrack";
import { cn } from "@/lib/utils";

interface DietTrackBadgeProps {
  track: DietTrack | null;
  className?: string;
}

const TRACK_TONE: Record<DietTrack, string> = {
  adult_standard: "bg-primary/10 border-primary/30 text-primary",
  adult_advanced_hidden: "bg-accent/10 border-accent/30 text-accent",
  youth_habit: "bg-reward/15 border-reward/40 text-reward-foreground",
};

const TRACK_ICON: Record<DietTrack, typeof Sparkles> = {
  adult_standard: Flame,
  adult_advanced_hidden: ShieldAlert,
  youth_habit: Sparkles,
};

/**
 * 트랙 라벨 뱃지. track === null 이면 "결정 중" 표시.
 */
export const DietTrackBadge = ({ track, className }: DietTrackBadgeProps) => {
  if (!track) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
          "border-muted bg-muted text-muted-foreground",
          className,
        )}
      >
        트랙 결정 중
      </span>
    );
  }
  const Icon = TRACK_ICON[track];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        TRACK_TONE[track],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {DIET_TRACK_LABEL[track]}
    </span>
  );
};

export default DietTrackBadge;
