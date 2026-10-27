import type { Enums } from "@/integrations/supabase/types";
import { RANK_LABELS, formatRank, toGlobalLevel } from "@/lib/rankLabels";
import LeagueBadge from "@/components/badges/LeagueBadge";
import NameBadge from "@/components/badges/NameBadge";

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
      isMaster ? (
        <span
          title={title}
          aria-label={title}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-reward bg-reward/20 align-middle text-micro leading-none"
        >
          👑
        </span>
      ) : (
        // 2026-10-15: 이름 옆 = 리그 버튼 (NameBadge) — 방패는 리그·레벨 줄에
        <NameBadge league={rank} className="inline-block h-4 w-4 align-middle" title={title} />
      )
    );
  }

  if (isMaster) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 border-reward bg-gradient-to-r from-reward/20 to-primary/20 shadow-elev-1 ${isLg ? "px-4 py-1.5" : ""}`}>
        <span className={isLg ? "text-heading" : "text-body"}>👑</span>
        <span className={`font-bold bg-gradient-to-r from-reward to-primary bg-clip-text text-transparent ${isLg ? "text-body" : "text-label"}`}>
          마스터
        </span>
      </div>
    );
  }

  return (
    // 한 줄로 — 글씨를 크게 해도 '레벨 7'의 숫자만 다음 줄로 꺾이지 않게 (2026-10-28 리디자인)
    <div className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 ${rankColors[rank]}`}>
      <LeagueBadge league={rank} className={`shrink-0 ${isLg ? "h-6 w-6" : "h-4 w-4"}`} />
      {/* '리그'는 옆 방패가 말한다 — '화이트 · 레벨 7'로 짧게 (화면 읽기 도구에는 전체 이름) */}
      <span className={`truncate whitespace-nowrap font-bold ${isLg ? "text-body" : "text-label"}`} aria-label={formatRank(rank, level)}>
        {RANK_LABELS[rank] ?? rank} · 레벨 {toGlobalLevel(rank, level)}
      </span>
    </div>
  );
};

export default RankBadge;
