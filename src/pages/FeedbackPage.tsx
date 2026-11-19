import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import AppFeedbackInbox, { useAppFeedbackInbox } from "@/components/feedback/AppFeedbackInbox";
import MyFeedbackList, { useMyAppFeedback } from "@/components/feedback/MyFeedbackList";
import { MY_APP_FEEDBACK_KEY, feedbackTabFromParams, type FeedbackTab } from "@/lib/appFeedback";

// ── 오류/불편 신고 (2026-10-11 대표님: "앱 오류나 안되는 부분 보내는 기능") ──
// 보낸 내용은 public.app_feedback 에 저장되고, DB 트리거가 대표님(super_admin)에게
// 알림(기존 알림·푸시 파이프라인)을 보낸다. 진입점: 전체 메뉴 + 내정보.
// 2026-10-18 대표님: "회원님들이 보낸 신고 자세히 볼 수 있게 · 알림에서도 클릭하면 바로" → 본사(super_admin·admin)에게
// '받은 신고' 탭(components/feedback/AppFeedbackInbox). 알림 바로 가기 = /feedback?inbox=1&id=<신고>.
// 2026-11-11 대표님 「오류신고에 댓글 남길수있게해줘」(2026-11-19 올림) → 신고마다 댓글(운영진 ↔ 신고한 회원) + 모두에게 '내 신고' 탭
// (components/feedback/MyFeedbackList · 처리 상태 · 새 답글). 회원 알림 바로 가기 = /feedback?mine=1&id=<신고>.

const CATEGORIES = ["오류", "불편", "제안"] as const;

const PLACEHOLDER =
  "어떤 화면에서, 무엇을 눌렀을 때, 어떻게 안 되는지 적어주세요.\n예) 내정보에서 프로필 사진을 바꾸려는데 업로드가 안 돼요.";

const FeedbackPage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isHq = role === "super_admin" || role === "admin";
  const [params] = useSearchParams();
  const focusId = params.get("id");
  const inboxParam = params.get("inbox") === "1";
  const mineParam = params.get("mine") === "1";
  // 역할은 늦게 올 수 있어 탭은 주소로 정하고, 받은 신고는 본사일 때만 그린다
  const [tab, setTab] = useState<FeedbackTab>(() => feedbackTabFromParams({ mine: mineParam, inbox: inboxParam, id: focusId }));
  // 이 화면이 열려 있을 때 알림을 누르면 주소(?inbox=1&id= · ?mine=1&id=)만 바뀌고 화면은 새로 열리지 않는다 → 주소를 따라 탭을 옮긴다 (2026-10-19)
  useEffect(() => {
    if (mineParam || inboxParam || focusId) setTab(feedbackTabFromParams({ mine: mineParam, inbox: inboxParam, id: focusId }));
  }, [mineParam, inboxParam, focusId]);
  const showInbox = isHq && tab === "inbox";
  const showMine = tab === "mine";
  const inboxCounts = useAppFeedbackInbox(isHq).data?.counts;
  const myUnread = useMyAppFeedback(!!user).data?.unread ?? 0;
  const qc = useQueryClient();
  const tabs: [FeedbackTab, string][] = isHq
    ? [
        ["inbox", "받은 신고"],
        ["send", "신고 보내기"],
        ["mine", "내 신고"],
      ]
    : [
        ["send", "신고 보내기"],
        ["mine", "내 신고"],
      ];
  // ?cat=제안 — 공지사항 「앱 업데이트」 맨 아래 '이런 기능이 있으면 좋겠어요'에서 (2026-11-15)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(() => {
    const c = params.get("cat");
    return (CATEGORIES as readonly string[]).includes(c ?? "") ? (c as (typeof CATEGORIES)[number]) : "오류";
  });
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    const text = content.trim();
    if (text.length < 2) {
      toast.error("내용을 조금만 더 적어주세요");
      return;
    }
    setSending(true);
    try {
      // app_feedback 은 생성 타입(types.ts)에 아직 없어 from 캐스팅으로 넣는다.
      const { error } = await (supabase as any).from("app_feedback").insert({
        user_id: user.id,
        category,
        content: text,
        page_path: null,
        device_info: navigator.userAgent.slice(0, 300),
      });
      if (error) throw error;
      setDone(true);
      void qc.invalidateQueries({ queryKey: MY_APP_FEEDBACK_KEY });
    } catch (err: any) {
      toast.error("전송 실패: " + (err?.message ?? "잠시 후 다시 시도해주세요"));
    } finally {
      setSending(false);
    }
  };

  return (
    <AppPage
      header={
        <PageHeader
          sticky
          title="오류 신고"
          leftAction={
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-secondary-foreground" />
            </button>
          }
        />
      }
    >
      <div
        className={cn("mb-4 grid gap-1 rounded-2xl bg-secondary p-1", tabs.length === 3 ? "grid-cols-3" : "grid-cols-2")}
        role="tablist"
        aria-label="오류 신고"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-label font-bold transition-colors",
              tab === key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
            {key === "inbox" && !!(inboxCounts?.new || inboxCounts?.waiting) && (
              <span className="min-w-[20px] rounded-full bg-destructive px-1.5 text-micro font-bold leading-5 text-white tabular-nums">
                {(inboxCounts?.new ?? 0) + (inboxCounts?.waiting ?? 0)}
              </span>
            )}
            {key === "mine" && myUnread > 0 && (
              <span className="min-w-[20px] rounded-full bg-destructive px-1.5 text-micro font-bold leading-5 text-white tabular-nums">
                {myUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {showInbox ? (
        <AppFeedbackInbox focusId={focusId} />
      ) : showMine ? (
        <MyFeedbackList focusId={mineParam ? focusId : null} onWrite={() => setTab("send")} />
      ) : done ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="text-display">🥊</span>
          <p className="text-heading font-bold text-foreground">접수됐습니다!</p>
          <p className="text-body text-muted-foreground">
            대표님에게 바로 전달됐어요.
            <br />
            답글이 오면 알림으로 알려 드려요.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setContent("");
                setTab("mine");
              }}
              className="rounded-pill bg-primary px-6 py-3 text-body font-bold text-primary-foreground active:scale-95"
            >
              내 신고 보기
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-pill bg-secondary px-6 py-3 text-body font-bold text-secondary-foreground active:scale-95"
            >
              돌아가기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 종류 선택 */}
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "flex-1 rounded-pill border py-2.5 text-body font-bold transition-colors",
                  category === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            maxLength={2000}
            className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || content.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-body font-extrabold text-primary-foreground shadow-elev-1 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "보내는 중…" : "대표님에게 보내기"}
          </button>

          <p className="px-1 text-center text-label leading-relaxed text-muted-foreground">
            보내주신 내용은 운영진만 볼 수 있어요. 처리 상황과 답글은 '내 신고'에서 볼 수 있어요.
          </p>
        </div>
      )}
    </AppPage>
  );
};

export default FeedbackPage;
