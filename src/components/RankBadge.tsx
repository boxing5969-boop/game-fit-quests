import type { Enums } from "@/integrations/supabase/types";
import { RANK_LABELS, RANK_ICONS, formatRank } from "@/lib/rankLabels";

interface RankBadgeProps {
  rank: Enums<"rank_name">;
  level: number;
  size?: "sm" | "lg";
  isMaster?: boolean;
}

const rankColors: Record<string, string> = {
  white: "bg-rank-white/15 border-rank-white/30 text-foreground",
  blue: "bg-rank-blue/15 border-rank-blue/30 text-rank-blue",
  red: "bg-rank-red/15 border-rank-red/30 text-rank-red",
  black: "bg-rank-black/15 border-rank-black/30 text-foreground",
};

const RankBadge = ({ rank, level, size = "sm", isMaster }: RankBadgeProps) => {
  const isLg = size === "lg";

  if (isMaster) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 border-accent bg-gradient-to-r from-accent/20 to-primary/20 shadow-sm ${isLg ? "px-4 py-1.5" : ""}`}>
        <span className={isLg ? "text-lg" : "text-sm"}>👑</span>
        <span className={`font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent ${isLg ? "text-base" : "text-xs"}`}>
          마스터
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${rankColors[rank]}`}>
      <span className={isLg ? "text-lg" : "text-sm"}>{RANK_ICONS[rank]}</span>
      <span className={`font-bold ${isLg ? "text-base" : "text-xs"}`}>
        {formatRank(rank, level)}
      </span>
    </div>
  );
};

export default RankBadge;
