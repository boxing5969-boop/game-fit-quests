import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import AppFeedbackInbox, { useAppFeedbackInbox } from "@/components/feedback/AppFeedbackInbox";

// ── 오류/불편 신고 (2026-10-11 대표님: "앱 오류나 안되는 부분 보내는 기능") ──
// 보낸 내용은 public.app_feedback 에 저장되고, DB 트리거가 대표님(super_admin)에게
// 알림(기존 알림·푸시 파이프라인)을 보낸다. 진입점: 전체 메뉴 + 내정보.
// 2026-10-18 대표님: "회원님들이 보낸 신고 자세히 볼 수 있게 · 알림에서도 클릭하면 바로" → 본사(super_admin·admin)에게
// '받은 신고' 탭(components/feedback/AppFeedbackInbox). 알림 바로 가기 = /feedback?inbox=1&id=<신고>.

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
  // 역할은 늦게 올 수 있어 탭은 주소로 정하고, 받은 신고는 본사일 때만 그린다
  const [tab, setTab] = useState<"inbox" | "send">(() => (inboxParam || focusId ? "inbox" : "send"));
  // 이 화면이 열려 있을 때 알림을 누르면 주소(?inbox=1&id=새 신고)만 바뀌고 화면은 새로 열리지 않는다 → 주소를 따라 받은 신고 탭으로 (2026-10-19)
  useEffect(() => {
    if (inboxParam || focusId) setTab("inbox");
  }, [inboxParam, focusId]);
  const showInbox = isHq && tab === "inbox";
  const inboxCounts = useAppFeedbackInbox(isHq).data?.counts;
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("오류");
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
      {isHq && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="오류 신고">
          {(
            [
              ["inbox", "받은 신고"],
              ["send", "신고 보내기"],
            ] as const
          ).map(([key, label]) => (
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
              {key === "inbox" && !!inboxCounts?.new && (
                <span className="min-w-[20px] rounded-full bg-destructive px-1.5 text-micro font-bold leading-5 text-white tabular-nums">
                  {inboxCounts.new}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {showInbox ? (
        <AppFeedbackInbox focusId={focusId} />
      ) : done ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="text-display">🥊</span>
          <p className="text-heading font-bold text-foreground">접수됐습니다!</p>
          <p className="text-body text-muted-foreground">
            대표님에게 바로 전달됐어요.
            <br />
            소중한 의견 감사합니다.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-pill bg-primary px-6 py-3 text-body font-bold text-primary-foreground active:scale-95"
          >
            돌아가기
          </button>
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
            보내주신 내용은 운영진만 볼 수 있어요.
          </p>
        </div>
      )}
    </AppPage>
  );
};

export default FeedbackPage;
