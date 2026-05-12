/**
 * 153 QUEST — 파트너 챔피언 일기 댓글 시트.
 *
 * 코너맨 또는 세컨드 응원 파트너의 일기 1건을 열어 댓글을 보고/달 수 있다.
 *
 * 보호 원칙:
 *   · 공식 1~40 / 공식 XP / wallet 변경 0
 *   · grant_gems 직접 호출 0 — 댓글은 보상 없음
 *   · ChatAssistant / 새 AI 챗박스 미사용
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  useAddJournalComment,
  useDeleteJournalComment,
  useJournalComments,
} from "@/hooks/useChampionJournalPartner";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type { PartnerJournalFeedRow } from "@/services/championJournalPartnerService";

interface Props {
  open: boolean;
  entry: PartnerJournalFeedRow | null;
  onClose: () => void;
}

const MIN_LEN = 1;
const MAX_LEN = 500;

function relationLabel(rel: PartnerJournalFeedRow["relation"]): string {
  return rel === "cornerman" ? "🤝 코너맨" : "📣 세컨드";
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

const PartnerJournalCommentSheet = ({ open, entry, onClose }: Props) => {
  const entryId = entry?.id ?? null;
  const { data: comments, isLoading } = useJournalComments(entryId, open);
  const addComment = useAddJournalComment(entryId);
  const deleteComment = useDeleteJournalComment(entryId);
  useModalDismiss(open, onClose);

  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const canSubmit =
    !!entry && trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN && !addComment.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await addComment.mutateAsync(trimmed);
      setDraft("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "댓글 저장 중 문제가 발생했습니다.";
      toast.error(msg);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "댓글 삭제 중 문제가 발생했습니다.";
      toast.error(msg);
    }
  };

  return (
    <AnimatePresence>
      {open && entry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="파트너 일기 댓글"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    {relationLabel(entry.relation)} · {entry.display_name}
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    파트너의 한 줄
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {formatTime(entry.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 일기 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                  {entry.prompt}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                  {entry.content}
                </p>
                {entry.mood && (
                  <p className="mt-2 inline-block rounded-pill bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                    {entry.mood}
                  </p>
                )}
              </div>

              {/* 댓글 목록 */}
              <div className="mt-4">
                <p className="mb-2 text-[11.5px] font-bold text-foreground">
                  댓글 {comments?.length ?? 0}
                </p>
                {isLoading ? (
                  <p className="text-[11px] text-muted-foreground">불러오는 중…</p>
                ) : (comments ?? []).length === 0 ? (
                  <p className="rounded-card border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-[11px] text-muted-foreground">
                    아직 댓글이 없습니다. 첫 응원의 한마디를 남겨보세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(comments ?? []).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-card border border-border bg-card px-3 py-2.5"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-[10.5px] font-bold text-foreground">
                            {c.is_mine ? "나" : c.commenter_name}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground">
                              {formatTime(c.created_at)}
                            </p>
                            {c.is_mine && (
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                aria-label="댓글 삭제"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                ※ 댓글은 보상이 없으며 공식 1~40 레벨업과 무관합니다.
              </p>
            </div>

            {/* 댓글 입력 */}
            <div className="border-t border-border bg-card px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setDraft(e.target.value.slice(0, MAX_LEN + 50))
                  }
                  placeholder="응원의 한마디…"
                  rows={1}
                  className="flex-1 resize-none rounded-card border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  aria-label="댓글 보내기"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                    canSubmit
                      ? "bg-primary text-primary-foreground active:scale-95"
                      : "cursor-not-allowed bg-primary/40 text-primary-foreground opacity-60"
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {trimmed.length} / {MAX_LEN}자
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PartnerJournalCommentSheet;
