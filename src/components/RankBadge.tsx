import type { Enums } from "@/integrations/supabase/types";
import { RANK_LABELS, RANK_ICONS, formatRank } from "@/lib/rankLabels";

interface RankBadgeProps {
  rank: Enums<"rank_name">;
  level: number;
  /** inline = 이름 앞에 붙이는 아주 작은 표식 (인스타 인증 배지 느낌) */
  size?: "inline" | "sm" | "lg";
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

  // 이름 앞 인라인 표식 — 글줄을 밀지 않게 아주 작게, 아이콘만.
  // 자세한 내용은 title(길게 눌러 보기)로만 노출해 화면을 어지럽히지 않는다.
  if (size === "inline") {
    const title = isMaster ? "MASTER 40" : formatRank(rank, level);
    return (
      <span
        title={title}
        aria-label={title}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border align-middle text-[9px] leading-none ${
          isMaster ? "border-reward bg-reward/20" : rankColors[rank]
        }`}
      >
        {isMaster ? "👑" : RANK_ICONS[rank]}
      </span>
    );
  }

  if (isMaster) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 border-reward bg-gradient-to-r from-reward/20 to-primary/20 shadow-elev-1 ${isLg ? "px-4 py-1.5" : ""}`}>
        <span className={isLg ? "text-lg" : "text-sm"}>👑</span>
        <span className={`font-bold bg-gradient-to-r from-reward to-primary bg-clip-text text-transparent ${isLg ? "text-base" : "text-xs"}`}>
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
