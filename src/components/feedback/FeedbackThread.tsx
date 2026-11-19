/**
 * 💬 오류 신고 댓글 — 신고 하나 아래에서 운영진 ↔ 신고한 회원 (2026-11-11 대표님 「오류신고에 댓글 남길수있게해줘」 · 2026-11-19 올림).
 *
 *   · 읽기   get_app_feedback_thread — 신고한 회원 · 운영진만. 회원이 열면 '읽음'(새 답글 표시가 꺼진다)
 *   · 쓰기   add_app_feedback_comment — 운영진이 쓰면 회원에게, 회원이 쓰면 대표님 · 처리한 운영진에게 알림
 *   · 지우기 remove_app_feedback_comment — 쓴 사람 또는 운영진 · 두 번 눌러서(줄은 서버에 남고 목록에서 빠진다)
 *   · 받은 신고함(운영진)과 내 신고(회원)가 같이 쓴다. 다른 회원에게는 보이지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  APP_FEEDBACK_INBOX_KEY,
  FEEDBACK_COMMENT_MAX,
  MY_APP_FEEDBACK_KEY,
  appFeedbackThreadKey,
  commentErrorText,
  feedbackWhenText,
} from "@/lib/appFeedback";

export interface FeedbackComment {
  id: string;
  body: string;
  created_at: string;
  is_staff: boolean;
  mine: boolean;
  author_name: string;
  author_avatar: string | null;
}

// 새 함수들은 생성 타입(types.ts)보다 새것이라 느슨한 클라이언트로 부른다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const Face = ({ src, name, staff }: { src: string | null; name: string; staff: boolean }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken)
    return <img src={src} alt="" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border/60" />;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label font-bold",
        staff ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
};

interface Props {
  feedbackId: string;
  /** 보는 사람 — 운영진(받은 신고함) · 회원(내 신고). 입력칸 안내와 이름 표시만 다르다 */
  viewer: "staff" | "member";
}

const FeedbackThread = ({ feedbackId, viewer }: Props) => {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  // 지우기는 두 번 눌러서 — 처음 누르면 3초 동안 '한 번 더 누르면 지워요'
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const thread = useQuery({
    queryKey: appFeedbackThreadKey(feedbackId),
    staleTime: 15_000,
    queryFn: async (): Promise<FeedbackComment[]> => {
      const { data, error } = await db.rpc("get_app_feedback_thread", { p_feedback: feedbackId });
      if (error) throw error;
      const list = (data ?? {}).comments;
      return Array.isArray(list) ? (list as FeedbackComment[]) : [];
    },
  });

  // 회원이 열면 서버가 '읽음'으로 남긴다 → 내 신고 목록의 '새 답글' 숫자를 다시 읽는다 (처음 한 번)
  const markedRead = useRef(false);
  useEffect(() => {
    if (viewer !== "member" || markedRead.current || !thread.isSuccess) return;
    markedRead.current = true;
    void qc.invalidateQueries({ queryKey: MY_APP_FEEDBACK_KEY });
  }, [viewer, thread.isSuccess, qc]);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: appFeedbackThreadKey(feedbackId) });
    void qc.invalidateQueries({ queryKey: APP_FEEDBACK_INBOX_KEY });
    void qc.invalidateQueries({ queryKey: MY_APP_FEEDBACK_KEY });
  };

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await db.rpc("add_app_feedback_comment", { p_feedback: feedbackId, p_body: body });
      if (error) throw error;
      const r = (data ?? {}) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(r.error || "failed");
    },
    onSuccess: () => {
      setText("");
      toast.success(viewer === "staff" ? "답글을 남겼어요 · 회원님께 알림이 가요" : "댓글을 남겼어요 · 운영진에게 전달됐어요");
      refreshAll();
    },
    onError: (e: unknown) => toast.error(commentErrorText((e as { message?: string } | null)?.message)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("remove_app_feedback_comment", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      setArmed(null);
      toast("댓글을 지웠어요");
      refreshAll();
    },
    onError: () => toast.error("지우지 못했어요 · 잠시 후 다시 눌러 주세요"),
  });

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  };

  const comments = thread.data ?? [];

  return (
    <div className="mt-3 rounded-2xl bg-secondary/50 p-3">
      {thread.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-3 text-label text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 댓글을 불러오는 중…
        </div>
      ) : thread.isError ? (
        <button type="button" onClick={() => thread.refetch()} className="w-full py-2 text-center text-label font-bold text-muted-foreground">
          댓글을 불러오지 못했어요 · 다시 시도
        </button>
      ) : comments.length === 0 ? (
        <p className="py-1 text-center text-label text-muted-foreground">
          {viewer === "staff" ? "아직 댓글이 없어요 · 회원님께 물어볼 것이나 처리 소식을 남겨 보세요" : "아직 댓글이 없어요"}
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const who = c.mine ? "나" : c.author_name;
            const canRemove = c.mine || viewer === "staff";
            const sure = armed === c.id;
            return (
              <li key={c.id} className="flex gap-2">
                <Face src={c.author_avatar} name={c.author_name} staff={c.is_staff} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-label font-bold text-foreground">{who}</span>
                    {c.is_staff && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-micro font-bold text-primary">운영진</span>}
                    <span className="ml-auto shrink-0 text-label tabular-nums text-muted-foreground">{feedbackWhenText(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line break-words text-body leading-relaxed text-foreground">{c.body}</p>
                  {canRemove && (
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => (sure ? remove.mutate(c.id) : setArmed(c.id))}
                      className={cn(
                        "mt-1 inline-flex min-h-[32px] items-center gap-1 text-label font-semibold active:opacity-60 disabled:opacity-50",
                        sure ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {sure ? "한 번 더 누르면 지워요" : "지우기"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={FEEDBACK_COMMENT_MAX}
          placeholder={viewer === "staff" ? "회원님께 답글 남기기 (회원님께 알림이 가요)" : "운영진에게 더 알려 줄 내용을 남겨 주세요"}
          aria-label="댓글"
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || send.isPending}
          aria-label="댓글 보내기"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95 disabled:opacity-40"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

export default FeedbackThread;
