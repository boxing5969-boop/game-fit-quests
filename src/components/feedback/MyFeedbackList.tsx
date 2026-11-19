/**
 * 📮 내 신고 — 회원이 보낸 오류 신고 · 처리 상태 · 운영진 답글 (2026-11-11 대표님 「오류신고에 댓글 남길수있게해줘」 · 2026-11-19 올림).
 *
 *   · 데이터: get_my_app_feedback (최근 50개 · 새 답글 수). 댓글은 FeedbackThread.
 *   · 알림 바로 가기 /feedback?mine=1&id=<신고> — 그 신고의 댓글을 펼치고 화면 가운데로.
 *   · 예전엔 신고를 보내면 다시 볼 곳이 없었다.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import FeedbackThread from "@/components/feedback/FeedbackThread";
import {
  FEEDBACK_CATEGORY_CLS,
  MEMBER_STATUS_LABEL,
  MY_APP_FEEDBACK_KEY,
  feedbackWhenText,
  myThreadButtonText,
  type FeedbackStatus,
} from "@/lib/appFeedback";

export interface MyFeedbackItem {
  id: string;
  category: string;
  content: string;
  status: FeedbackStatus;
  created_at: string;
  handled_at: string | null;
  comment_count: number;
  unread: number;
  last_comment_at: string | null;
}

export interface MyFeedbackData {
  unread: number;
  items: MyFeedbackItem[];
}

export function useMyAppFeedback(enabled: boolean) {
  return useQuery({
    queryKey: MY_APP_FEEDBACK_KEY,
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<MyFeedbackData> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_my_app_feedback", { p_limit: 50 });
      if (error) throw error;
      const d = (data ?? {}) as Partial<MyFeedbackData>;
      return { unread: Number(d.unread) || 0, items: Array.isArray(d.items) ? d.items : [] };
    },
  });
}

const STATUS_CLS: Record<FeedbackStatus, string> = {
  new: "bg-secondary text-muted-foreground",
  seen: "bg-status-pending/15 text-status-pending",
  fixed: "bg-status-complete/15 text-status-complete",
};

const MyFeedbackList = ({ focusId, onWrite }: { focusId?: string | null; onWrite: () => void }) => {
  const q = useMyAppFeedback(true);
  const [open, setOpen] = useState<Set<string>>(() => new Set(focusId ? [focusId] : []));

  // 알림으로 다른 신고를 열면(주소만 바뀜) 그 신고도 펼친다
  const scrolled = useRef(false);
  const lastFocus = useRef(focusId);
  useEffect(() => {
    if (lastFocus.current === focusId) return;
    lastFocus.current = focusId;
    scrolled.current = false;
    if (focusId) setOpen((s) => new Set(s).add(focusId));
  }, [focusId]);
  const focusRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!focusId || scrolled.current || !focusRef.current) return;
    scrolled.current = true;
    focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, q.data]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (q.isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-body text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 내 신고를 불러오는 중…
      </div>
    );
  if (q.isError)
    return (
      <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
        <p className="text-body font-bold text-foreground">내 신고를 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
        >
          <RotateCcw className="h-4 w-4" /> 다시 시도
        </button>
      </div>
    );

  const items = q.data?.items ?? [];
  if (items.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
        <p className="text-body font-bold text-foreground">아직 보낸 신고가 없어요</p>
        <p className="mt-1 text-label text-muted-foreground">안 되는 부분을 보내 주시면 여기서 처리 상황과 답글을 볼 수 있어요</p>
        <button
          type="button"
          onClick={onWrite}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-body font-bold text-primary-foreground active:scale-95"
        >
          신고 보내기
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {items.map((it) => {
          const focused = it.id === focusId;
          const isOpen = open.has(it.id);
          return (
            <li
              key={it.id}
              ref={focused ? focusRef : undefined}
              className={cn("rounded-2xl bg-card p-4 shadow-elev-1 ring-1", focused ? "ring-2 ring-primary" : "ring-border/60")}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-micro font-bold", FEEDBACK_CATEGORY_CLS[it.category] ?? "bg-secondary text-foreground")}>
                  {it.category}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-micro font-bold", STATUS_CLS[it.status] ?? STATUS_CLS.new)}>
                  {MEMBER_STATUS_LABEL[it.status] ?? MEMBER_STATUS_LABEL.new}
                </span>
                <span className="ml-auto shrink-0 text-label tabular-nums text-muted-foreground">{feedbackWhenText(it.created_at)}</span>
              </div>

              <p className="mt-3 whitespace-pre-line break-words text-body leading-relaxed text-foreground">{it.content}</p>

              <button
                type="button"
                onClick={() => toggle(it.id)}
                aria-expanded={isOpen}
                className={cn(
                  "mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-label font-bold active:scale-95",
                  it.unread > 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                )}
              >
                <MessageCircle className="h-4 w-4" />
                {myThreadButtonText(it)}
              </button>

              {isOpen && <FeedbackThread feedbackId={it.id} viewer="member" />}
            </li>
          );
        })}
      </ul>
      <p className="px-1 pt-1 text-center text-label leading-relaxed text-muted-foreground">
        내 신고와 댓글은 나와 운영진만 볼 수 있어요. 답글이 오면 알림으로 알려 드려요.
      </p>
    </div>
  );
};

export default MyFeedbackList;
