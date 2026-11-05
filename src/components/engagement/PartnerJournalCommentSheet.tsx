/**
 * 153 QUEST — 파트너 챔피언 일기 댓글 시트.
 *
 * 코너맨 또는 세컨드 응원 파트너의 일기 1건을 열어 댓글을 보고/달 수 있다.
 * 답글 (2026-11-05 대표님 "내가 댓글 남기면 답글 못 남겨?" → 「진행하자」):
 *   · 댓글 · 답글마다 '답글 달기' → 입력칸 위에 누구에게 다는지 표시
 *   · 한 단계만 — 답글에 단 답글도 같은 댓글 밑에 들여쓰기로(받은 사람이 다르면 @이름)
 *   · 받은 사람에게 「○○님이 답글을 남겼어요」 알림(서버 트리거)
 *   · 답글이 달린 댓글을 지우면 답글도 함께 지워진다 — 먼저 묻는다
 *
 * 보호 원칙:
 *   · 공식 1~40 / 공식 XP / wallet 변경 0
 *   · grant_gems 직접 호출 0 — 댓글은 보상 없음
 *   · ChatAssistant / 새 AI 챗박스 미사용
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  useAddJournalComment,
  useAddJournalReply,
  useDeleteJournalComment,
  useJournalComments,
} from "@/hooks/useChampionJournalPartner";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type {
  JournalCommentRow,
  PartnerJournalFeedRow,
} from "@/services/championJournalPartnerService";

interface Props {
  open: boolean;
  entry: PartnerJournalFeedRow | null;
  onClose: () => void;
}

const MIN_LEN = 1;
const MAX_LEN = 500;

function relationLabel(rel: PartnerJournalFeedRow["relation"]): string {
  return rel === "cornerman" ? "🤝 운동 짝꿍" : rel === "second" ? "📣 응원 동료" : "";
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

interface CommentItemProps {
  c: JournalCommentRow;
  isReply?: boolean;
  /** 받은 사람이 맨 위 댓글 주인과 다를 때만 — @이름 */
  mention?: string | null;
  onReply: (c: JournalCommentRow) => void;
  onDelete: (c: JournalCommentRow) => void;
}

function CommentItem({ c, isReply, mention, onReply, onDelete }: CommentItemProps) {
  return (
    <div
      className={
        isReply
          ? "rounded-card bg-muted/40 px-3 pt-2 pb-0.5"
          : "rounded-card border border-border bg-card px-3 pt-2.5 pb-0.5"
      }
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-micro font-bold text-foreground">
          {c.is_mine ? "나" : c.commenter_name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-label text-muted-foreground">{formatTime(c.created_at)}</p>
          {c.is_mine && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              aria-label={isReply ? "답글 삭제" : "댓글 삭제"}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-label leading-relaxed text-foreground">
        {mention && <span className="mr-1 font-bold text-primary">@{mention}</span>}
        {c.content}
      </p>
      <button
        type="button"
        onClick={() => onReply(c)}
        className="-ml-2 inline-flex h-9 items-center rounded-pill px-2 text-label font-bold text-muted-foreground active:scale-95"
      >
        답글 달기
      </button>
    </div>
  );
}

const PartnerJournalCommentSheet = ({ open, entry, onClose }: Props) => {
  const entryId = entry?.id ?? null;
  const { data: comments, isLoading } = useJournalComments(entryId, open);
  const addComment = useAddJournalComment(entryId);
  const addReply = useAddJournalReply(entryId);
  const deleteComment = useDeleteJournalComment(entryId);
  useModalDismiss(open, onClose);

  const [draft, setDraft] = useState("");
  // 답글 다는 중 — id 는 누른 댓글(서버가 맨 위 댓글 밑으로 붙인다)
  const [replyTo, setReplyTo] = useState<{ id: string; label: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = draft.trim();
  const canSubmit =
    !!entry &&
    trimmed.length >= MIN_LEN &&
    trimmed.length <= MAX_LEN &&
    !addComment.isPending &&
    !addReply.isPending;

  // 다른 글을 열면 답글 표시를 지운다
  useEffect(() => {
    setReplyTo(null);
  }, [entryId]);

  // 답글을 달려던 댓글이 지워졌으면 답글 표시도 지운다
  useEffect(() => {
    if (replyTo && comments && !comments.some((c) => c.id === replyTo.id)) setReplyTo(null);
  }, [comments, replyTo]);

  // 맨 위 댓글 + 그 밑 답글 (서버가 시간 순으로 준다)
  const threads = useMemo(() => {
    const list = comments ?? [];
    const ids = new Set(list.map((c) => c.id));
    const byParent = new Map<string, JournalCommentRow[]>();
    const tops: JournalCommentRow[] = [];
    for (const c of list) {
      if (c.parent_id && ids.has(c.parent_id)) {
        const arr = byParent.get(c.parent_id) ?? [];
        arr.push(c);
        byParent.set(c.parent_id, arr);
      } else {
        tops.push(c);
      }
    }
    return tops.map((top) => ({ top, replies: byParent.get(top.id) ?? [] }));
  }, [comments]);

  const startReply = (c: JournalCommentRow) => {
    setReplyTo({
      id: c.id,
      label: c.is_mine
        ? c.parent_id
          ? "내 답글에 답글"
          : "내 댓글에 답글"
        : `${c.commenter_name}님에게 답글`,
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      if (replyTo) {
        await addReply.mutateAsync({ commentId: replyTo.id, content: trimmed });
        setReplyTo(null);
      } else {
        await addComment.mutateAsync(trimmed);
      }
      setDraft("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "댓글 저장 중 문제가 발생했습니다.";
      toast.error(msg);
    }
  };

  const handleDelete = async (c: JournalCommentRow) => {
    const replyCount = (comments ?? []).filter((x) => x.parent_id === c.id).length;
    if (
      replyCount > 0 &&
      !window.confirm(`이 댓글을 지우면 답글 ${replyCount}개도 함께 지워져요. 지울까요?`)
    ) {
      return;
    }
    try {
      await deleteComment.mutateAsync(c.id);
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
            aria-label="한 줄 댓글"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-label font-bold text-primary">
                    {relationLabel(entry.relation) ? `${relationLabel(entry.relation)} · ` : ""}{entry.display_name}
                  </p>
                  <h2 className="mt-0.5 text-body font-bold text-foreground">
                    오늘 운동 한 줄
                  </h2>
                  <p className="mt-0.5 text-label text-muted-foreground">
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
                <p className="text-label font-bold text-primary">
                  {entry.prompt}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-label leading-relaxed text-foreground">
                  {entry.content}
                </p>
                {entry.mood && (
                  <p className="mt-2 inline-block rounded-pill bg-muted px-2 py-0.5 text-micro font-medium text-muted-foreground">
                    {entry.mood}
                  </p>
                )}
              </div>

              {/* 댓글 목록 */}
              <div className="mt-4">
                <p className="mb-2 text-micro font-bold text-foreground">
                  댓글 {comments?.length ?? 0}
                </p>
                {isLoading ? (
                  <p className="text-label text-muted-foreground">불러오는 중…</p>
                ) : (comments ?? []).length === 0 ? (
                  <p className="rounded-card border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-micro text-muted-foreground">
                    아직 댓글이 없습니다. 첫 응원의 한마디를 남겨보세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {threads.map(({ top, replies }) => (
                      <div key={top.id}>
                        <CommentItem c={top} onReply={startReply} onDelete={handleDelete} />
                        {replies.length > 0 && (
                          <div className="ml-4 mt-1.5 space-y-1.5 border-l-2 border-primary/15 pl-3">
                            {replies.map((r) => (
                              <CommentItem
                                key={r.id}
                                c={r}
                                isReply
                                mention={
                                  r.reply_to_user_id &&
                                  r.reply_to_user_id !== top.commenter_user_id &&
                                  r.reply_to_user_id !== r.commenter_user_id
                                    ? r.reply_to_name
                                    : null
                                }
                                onReply={startReply}
                                onDelete={handleDelete}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-label leading-relaxed text-muted-foreground">
                ※ 댓글은 보상이 없어요. 공식 레벨업과 무관해요.
              </p>
            </div>

            {/* 댓글 입력 */}
            <div className="border-t border-border bg-card px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-pill bg-primary/10 pl-3">
                  <p className="min-w-0 truncate text-label font-bold text-primary">
                    {replyTo.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    aria-label="답글 그만두기"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) =>
                    setDraft(e.target.value.slice(0, MAX_LEN + 50))
                  }
                  placeholder={replyTo ? "답글을 남겨 주세요…" : "응원의 한마디…"}
                  rows={1}
                  className="flex-1 resize-none rounded-card border border-border bg-card px-3 py-2 text-label text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  aria-label={replyTo ? "답글 보내기" : "댓글 보내기"}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                    canSubmit
                      ? "bg-primary text-primary-foreground active:scale-95"
                      : "cursor-not-allowed bg-primary/40 text-primary-foreground opacity-60"
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-label text-muted-foreground">
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
