/**
 * 📮 오류 신고 — 화면들이 같이 쓰는 키 · 이름 · 판단 (2026-11-19 댓글 · 내 신고를 넣으며 한 곳으로).
 *   · 받은 신고함(운영진) = components/feedback/AppFeedbackInbox · 내 신고(회원) = components/feedback/MyFeedbackList
 *   · 댓글 = components/feedback/FeedbackThread · DB = supabase/migrations/20261119110848_app_feedback_comments.sql
 */

export const APP_FEEDBACK_INBOX_KEY = ["app-feedback-inbox"] as const;
export const MY_APP_FEEDBACK_KEY = ["app-feedback-mine"] as const;
export const appFeedbackThreadKey = (id: string) => ["app-feedback-thread", id] as const;

export type FeedbackStatus = "new" | "seen" | "fixed";

/** 댓글 한 개 최대 글자 (DB check 와 같다) */
export const FEEDBACK_COMMENT_MAX = 1000;

/** 회원에게 보이는 처리 상태 — 운영진 말('새 신고' · '확인함')이 아니라 회원 입장의 말 */
export const MEMBER_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "접수됨",
  seen: "확인 중",
  fixed: "고쳤어요",
};

export const FEEDBACK_CATEGORY_CLS: Record<string, string> = {
  오류: "bg-destructive/10 text-destructive",
  불편: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  제안: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

export const feedbackWhenText = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** 첫 화면 탭 — 주소로 정한다 (알림 바로 가기: 운영진 ?inbox=1&id= · 회원 ?mine=1&id=) */
export type FeedbackTab = "inbox" | "send" | "mine";
export function feedbackTabFromParams(p: { mine: boolean; inbox: boolean; id: string | null }): FeedbackTab {
  if (p.mine) return "mine";
  if (p.inbox || p.id) return "inbox";
  return "send";
}

/** 받은 신고함 — 마지막 댓글이 회원 것이면 '회원 답글' (운영진이 답할 차례) */
export const waitingForStaff = (it: { last_comment_staff?: boolean | null }) => it.last_comment_staff === false;

/** 내 신고 줄의 댓글 단추 글 */
export function myThreadButtonText(it: { unread?: number | null; comment_count?: number | null }): string {
  const unread = Number(it.unread) || 0;
  const n = Number(it.comment_count) || 0;
  if (unread > 0) return `새 답글 ${unread}`;
  if (n > 0) return `댓글 ${n}`;
  return "댓글 남기기";
}

/** 댓글 쓰기 실패 이유 → 안내 문구 */
export function commentErrorText(code: string | null | undefined): string {
  if (code === "too_many") return "오늘은 댓글을 충분히 남기셨어요. 내일 다시 남겨 주세요";
  if (code === "empty") return "내용을 적어 주세요";
  return "댓글을 남기지 못했어요 · 잠시 후 다시 눌러 주세요";
}
