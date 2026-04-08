import type { RankName } from "@/lib/mockData";
import { RANK_LABELS, RANK_ICONS } from "@/lib/mockData";

interface RankBadgeProps {
  rank: RankName;
  level: number;
  size?: "sm" | "lg";
}

const rankBg: Record<RankName, string> = {
  white: "bg-rank-white/20 border-rank-white/40",
  blue: "bg-rank-blue/20 border-rank-blue/40",
  red: "bg-rank-red/20 border-rank-red/40",
  black: "bg-rank-black/20 border-rank-black/40",
};

const RankBadge = ({ rank, level, size = "sm" }: RankBadgeProps) => {
  const isLg = size === "lg";

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${rankBg[rank]}`}>
      <span className={isLg ? "text-lg" : "text-sm"}>{RANK_ICONS[rank]}</span>
      <span className={`font-display font-bold ${isLg ? "text-base" : "text-xs"}`}>
        {RANK_LABELS[rank]} Lv.{level}
      </span>
    </div>
  );
};

export default RankBadge;
