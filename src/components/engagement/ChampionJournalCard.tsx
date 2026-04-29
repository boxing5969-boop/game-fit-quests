/**
 * 153 QUEST — 챔피언 일기: 최근 일기 한 장 카드.
 */

import type { ChampionJournalEntryRow } from "@/services/boxingEngagementService";

export interface ChampionJournalCardProps {
  entry: ChampionJournalEntryRow;
}

function formatKstShort(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  return `${m}/${day}`;
}

const ChampionJournalCard = ({ entry }: ChampionJournalCardProps) => {
  return (
    <article className="rounded-card border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-primary">
          {formatKstShort(entry.created_at)} · {entry.prompt}
        </p>
        {entry.mood && (
          <span className="badge-pill bg-secondary text-secondary-foreground text-[9.5px]">
            {entry.mood}
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
        {entry.content}
      </p>
    </article>
  );
};

export default ChampionJournalCard;
