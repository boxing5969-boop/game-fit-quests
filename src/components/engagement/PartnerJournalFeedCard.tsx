/**
 * 153 QUEST — 파트너 챔피언 일기 피드.
 *
 * 코너맨 (active 페어) + 세컨드 응원 파트너 (양방향 30일 cheer) 의 일기를
 * 시간순으로 보여주고, 클릭하면 PartnerJournalCommentSheet 가 열린다.
 *
 * 보호 원칙: 공식 1~40 / 공식 XP / wallet 변경 0건.
 */

import { useState } from "react";
import { BookOpen, MessageCircle } from "lucide-react";

import { usePartnerJournalFeed } from "@/hooks/useChampionJournalPartner";
import type { PartnerJournalFeedRow } from "@/services/championJournalPartnerService";

import PartnerJournalCommentSheet from "./PartnerJournalCommentSheet";

function relationLabel(rel: PartnerJournalFeedRow["relation"]): string {
  return rel === "cornerman" ? "코너맨" : "세컨드";
}

function relationStyle(rel: PartnerJournalFeedRow["relation"]): string {
  return rel === "cornerman"
    ? "bg-primary/15 text-primary"
    : "bg-emerald-500/15 text-emerald-400";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

const PartnerJournalFeedCard = () => {
  const { data: feed, isLoading } = usePartnerJournalFeed(10);
  const [openEntry, setOpenEntry] = useState<PartnerJournalFeedRow | null>(
    null,
  );

  const rows = feed ?? [];

  return (
    <>
      <section
        className="surface-card border border-border bg-card"
        aria-label="파트너 챔피언 일기"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-primary/15 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                파트너 일기
              </p>
              <h3 className="mt-0.5 text-display-sm">
                코너맨 · 세컨드의 한 줄
              </h3>
            </div>
          </div>
          <span className="badge-pill bg-muted text-muted-foreground">
            {rows.length}건
          </span>
        </div>

        {isLoading ? (
          <p className="text-[11.5px] text-muted-foreground">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-muted/30 px-3.5 py-4 text-center">
            <p className="text-[12px] font-bold text-foreground">
              아직 볼 수 있는 파트너의 일기가 없습니다
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              코너맨을 맺거나 세컨드 응원을 주고받으면
              <br />
              서로의 챔피언 일기를 열람하고 댓글로 응원할 수 있어요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setOpenEntry(e)}
                className="flex w-full flex-col gap-1.5 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[9.5px] font-black ${relationStyle(e.relation)}`}
                    >
                      {relationLabel(e.relation)}
                    </span>
                    <p className="truncate text-[12px] font-bold text-foreground">
                      {e.display_name}
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] text-muted-foreground">
                    {formatTime(e.created_at)}
                  </p>
                </div>
                <p className="line-clamp-1 text-[11px] font-bold text-primary">
                  {e.prompt}
                </p>
                <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground">
                  {e.content}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-[10.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {e.comment_count}
                  </span>
                  {e.mood && <span className="truncate">{e.mood}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          ※ 파트너 = 코너맨 active 페어 또는 최근 30일 양방향 세컨드 응원.
          공식 1~40 레벨업과 무관합니다.
        </p>
      </section>

      <PartnerJournalCommentSheet
        open={!!openEntry}
        entry={openEntry}
        onClose={() => setOpenEntry(null)}
      />
    </>
  );
};

export default PartnerJournalFeedCard;
