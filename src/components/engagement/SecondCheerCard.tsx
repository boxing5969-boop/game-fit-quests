/**
 * 153 QUEST — 세컨드 응원: 후보 회원 1줄 카드.
 *
 * 표시 컬럼: display_name / branch_name / current_rank / current_level.
 * 민감정보(phone/email/birth_date) 미사용.
 */

import { ChevronRight } from "lucide-react";
import { RANK_LABELS } from "@/data/sharedConstants";
import type { SecondCheerCandidate } from "@/services/boxingEngagementService";

const RANK_TONE: Record<string, string> = {
  white: "bg-zinc-200 text-zinc-800",
  blue: "bg-blue-500/15 text-blue-600",
  red: "bg-red-500/15 text-red-600",
  black: "bg-zinc-800 text-zinc-100",
};

export interface SecondCheerCardProps {
  candidate: SecondCheerCandidate;
  onSelect: (c: SecondCheerCandidate) => void;
}

const SecondCheerCard = ({ candidate, onSelect }: SecondCheerCardProps) => {
  const rank = candidate.current_rank ?? "";
  const rankLabel = RANK_LABELS[rank as keyof typeof RANK_LABELS];
  const tone = RANK_TONE[rank] ?? "bg-secondary text-secondary-foreground";

  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 text-left transition-all active:scale-[0.99] hover:border-primary/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-muted text-base">
        🥊
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground">
          {candidate.display_name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {rankLabel && candidate.current_level != null ? (
            <span className={`badge-pill text-[9.5px] ${tone}`}>
              {rankLabel} · Lv.{candidate.current_level}
            </span>
          ) : null}
          <span className="truncate text-[10.5px] text-muted-foreground">
            {candidate.branch_name}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default SecondCheerCard;
