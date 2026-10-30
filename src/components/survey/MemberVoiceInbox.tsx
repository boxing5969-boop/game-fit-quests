/**
 * 📋 받은 설문·고객의 소리 — 본사 전용 (2026-10-18 대표님: "설문조사랑 앱 오류 신고 … 회원님들이 보낸 것 자세히 볼 수 있게").
 *
 *   · 데이터: Edge Function member-voice-inbox — 일일경영리포트(153OS)의 만족도 조사 응답 · 고객의 소리를 서버에서 읽어 온다 (최근 6개월).
 *   · 읽기 전용. 처리 상태 바꾸기·경품 추첨은 경영리포트에서. 연락처는 가운데를 가려서 보여 준다.
 *   · 주소: /survey?inbox=1 (고객의 소리부터: &tab=voice)
 *   · 2026-10-30 대표님 "만족도 조사에도 답변을 달 수 있도록 · 쓴 사람이 확인할 수 있게" — 만족도 조사 카드마다 '답변 달기'.
 *     앱에서 낸 설문이면 보낸 회원에게만 알림 · 설문 화면 '내가 보낸 만족도 조사'에 보인다(여기서는 계속 익명).
 *     QR · 예전 설문은 보낸 사람을 몰라 답변은 저장만 된다. (memberSurveyService — survey_replies)
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, MessageCircleReply, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getSurveyReplies, replySurveyResponse, type SurveyReplyInfo } from "@/services/memberSurveyService";

export interface SurveyInboxAnswer {
  q: string;
  type: string;
  text: string | null;
  score: number | null;
  max: number | null;
}
export interface SurveyInboxItem {
  id: string;
  at: string;
  branch: string | null;
  title: string;
  anonymous: boolean;
  who: string | null;
  avg: number | null;
  answers: SurveyInboxAnswer[];
}
export interface VoiceInboxItem {
  id: string;
  at: string;
  branch: string | null;
  category: string;
  rating: number | null;
  content: string;
  coach: string | null;
  draw: boolean;
  who: string | null;
  phone: string | null;
  status: string;
}
export interface MemberVoiceInboxData {
  surveys: SurveyInboxItem[];
  voices: VoiceInboxItem[];
}

export function useMemberVoiceInbox(enabled: boolean) {
  return useQuery({
    queryKey: ["member-voice-inbox"],
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<MemberVoiceInboxData> => {
      const { data, error } = await supabase.functions.invoke("member-voice-inbox", { body: {} });
      if (error) throw error;
      const d = (data ?? {}) as Partial<MemberVoiceInboxData>;
      return { surveys: Array.isArray(d.surveys) ? d.surveys : [], voices: Array.isArray(d.voices) ? d.voices : [] };
    },
  });
}

const VOICE_CATEGORY: Record<string, { label: string; cls: string }> = {
  coach_praise: { label: "코치 칭찬", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  improvement: { label: "개선 제안", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  complaint: { label: "불편·건의", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  free: { label: "자유 한마디", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
};
const VOICE_STATUS: Record<string, string> = { new: "새 의견", in_progress: "처리 중", resolved: "처리 완료", closed: "닫힘" };

const shortBranch = (b: string | null) => (b ? b.replace(/^153복싱짐\s*/, "") : null);
const whenText = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

const Stars = ({ value, max = 5 }: { value: number; max?: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value}점 / ${max}점`}>
    {Array.from({ length: max }, (_, i) => (
      <Star
        key={i}
        className={cn("h-3.5 w-3.5", i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        strokeWidth={1.8}
      />
    ))}
  </span>
);

const AnswerValue = ({ a }: { a: SurveyInboxAnswer }) => {
  if (a.type === "rating" && typeof a.score === "number") {
    const max = a.max ?? 5;
    return max <= 5 ? (
      <span className="flex items-center gap-1.5">
        <Stars value={a.score} max={max} />
        <span className="text-label font-bold tabular-nums text-foreground">{a.score}</span>
      </span>
    ) : (
      <span className="text-label font-bold tabular-nums text-foreground">
        {a.score} / {max}
      </span>
    );
  }
  const t = (a.text ?? "").trim();
  return t ? (
    <span className="whitespace-pre-line break-words text-label leading-relaxed text-foreground">{t}</span>
  ) : (
    <span className="text-label text-muted-foreground">답 없음</span>
  );
};

/** 만족도 조사 한 건의 답변 — 쓰기 · 고치기 · 지우기(빈 칸으로 저장) */
const ReplyBox = ({ id, info }: { id: string; info: SurveyReplyInfo | undefined }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(info?.reply ?? "");
  const [busy, setBusy] = useState(false);
  const fromApp = !!info?.from_app;

  const save = async () => {
    setBusy(true);
    try {
      const r = await replySurveyResponse(id, text);
      toast.success(r.deleted ? "답변을 지웠어요" : r.delivered ? "답변을 보냈어요 — 회원에게 알림이 갔어요" : "답변을 저장했어요");
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["survey-replies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "답변을 저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const who = fromApp ? "앱에서 보낸 설문 · 답변은 보낸 회원만 봐요" : "QR · 예전 설문 · 보낸 사람을 몰라 저장만 돼요";

  if (editing) {
    return (
      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder="회원님께 드릴 답변을 적어 주세요"
          className="w-full resize-none rounded-xl border border-border bg-background p-3 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
        <p className="text-micro text-muted-foreground">{who}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setText(info?.reply ?? "");
            }}
            className="h-10 flex-1 rounded-xl bg-secondary text-label font-bold text-foreground active:scale-[0.98]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || (!text.trim() && !info?.reply)}
            className="h-10 flex-[2] rounded-xl bg-primary text-label font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "저장 중…" : !text.trim() && info?.reply ? "답변 지우기" : fromApp ? "답변 보내기" : "답변 저장"}
          </button>
        </div>
      </div>
    );
  }

  if (info?.reply) {
    return (
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="rounded-xl bg-primary/5 px-3 py-2.5">
          <p className="flex items-center gap-1 text-micro font-bold text-primary">
            <MessageCircleReply className="h-3.5 w-3.5" /> 운영진 답변
            {fromApp && (
              <span className="ml-auto font-medium text-muted-foreground">{info.read_at ? "회원이 읽었어요" : "아직 안 읽었어요"}</span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-label leading-relaxed text-foreground">{info.reply}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setText(info.reply ?? "");
            setEditing(true);
          }}
          className="mt-2 text-label font-bold text-primary"
        >
          답변 고치기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
      <span className="min-w-0 text-micro text-muted-foreground">{who}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-primary/40 px-3 text-label font-bold text-primary active:scale-95"
      >
        <MessageCircleReply className="h-4 w-4" /> 답변 달기
      </button>
    </div>
  );
};

type Tab = "surveys" | "voices";

const MemberVoiceInbox = ({ initialTab = "surveys" }: { initialTab?: Tab }) => {
  const inbox = useMemberVoiceInbox(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const surveys = useMemo(() => inbox.data?.surveys ?? [], [inbox.data?.surveys]);
  const voices = inbox.data?.voices ?? [];
  const surveyIds = useMemo(() => surveys.map((x) => x.id), [surveys]);
  const replies = useQuery({
    queryKey: ["survey-replies", surveyIds],
    enabled: surveyIds.length > 0,
    staleTime: 30_000,
    queryFn: () => getSurveyReplies(surveyIds),
  });
  const avgAll = useMemo(() => {
    const xs = surveys.map((s) => s.avg).filter((n): n is number => typeof n === "number");
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  }, [surveys]);

  if (inbox.isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-body text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 경영리포트에서 불러오는 중…
      </div>
    );
  if (inbox.isError)
    return (
      <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
        <p className="text-label font-bold text-foreground">받은 응답을 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">경영리포트 연결이 잠시 안 될 수 있어요</p>
        <button
          type="button"
          onClick={() => inbox.refetch()}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
        >
          <RotateCcw className="h-4 w-4" /> 다시 시도
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="받은 응답 종류">
        {(
          [
            ["surveys", "만족도 조사", surveys.length],
            ["voices", "고객의 소리", voices.length],
          ] as const
        ).map(([key, label, n]) => (
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
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {tab === "surveys" ? (
        surveys.length === 0 ? (
          <Empty text="최근 6개월 동안 들어온 만족도 조사가 없어요" />
        ) : (
          <>
            {avgAll != null && (
              <p className="px-1 text-label text-muted-foreground">
                최근 {surveys.length}건 평균 <span className="font-bold text-foreground tabular-nums">{avgAll}</span>점
              </p>
            )}
            <ul className="space-y-2.5">
              {surveys.map((s) => (
                <li key={s.id} className="rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-label font-bold text-foreground">{s.title}</p>
                      <p className="mt-0.5 text-label text-muted-foreground">
                        {[shortBranch(s.branch), s.anonymous ? "익명" : s.who ?? "이름 없음"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-label tabular-nums text-muted-foreground">{whenText(s.at)}</p>
                      {s.avg != null && (
                        <p className="mt-0.5 inline-flex items-center gap-0.5 text-label font-bold tabular-nums text-foreground">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.8} /> {s.avg}
                        </p>
                      )}
                    </div>
                  </div>
                  <ol className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                    {s.answers.map((a, i) => (
                      <li key={i}>
                        <p className="text-label font-semibold leading-snug text-muted-foreground">
                          {i + 1}. {a.q}
                        </p>
                        <div className="mt-0.5">
                          <AnswerValue a={a} />
                        </div>
                      </li>
                    ))}
                  </ol>
                  <ReplyBox key={`${s.id}:${replies.data?.[s.id]?.replied_at ?? ""}`} id={s.id} info={replies.data?.[s.id]} />
                </li>
              ))}
            </ul>
          </>
        )
      ) : voices.length === 0 ? (
        <Empty text="최근 6개월 동안 들어온 고객의 소리가 없어요" />
      ) : (
        <ul className="space-y-2.5">
          {voices.map((v) => {
            const cat = VOICE_CATEGORY[v.category] ?? { label: v.category, cls: "bg-secondary text-foreground" };
            return (
              <li key={v.id} className="rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-border/60">
                <div className="flex items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-micro font-bold", cat.cls)}>{cat.label}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">
                    {VOICE_STATUS[v.status] ?? v.status}
                  </span>
                  <span className="ml-auto shrink-0 text-label tabular-nums text-muted-foreground">{whenText(v.at)}</span>
                </div>
                {v.rating != null && (
                  <div className="mt-2">
                    <Stars value={v.rating} />
                  </div>
                )}
                <p className="mt-2 whitespace-pre-line break-words text-label leading-relaxed text-foreground">{v.content}</p>
                {v.coach && <p className="mt-2 text-label font-semibold text-emerald-600 dark:text-emerald-400">칭찬한 코치 · {v.coach}</p>}
                <p className="mt-2 text-label text-muted-foreground">
                  {[shortBranch(v.branch), v.who, v.phone].filter(Boolean).join(" · ") || "익명"}
                  {v.draw && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-reward">
                      <Gift className="h-3 w-3" /> 경품 응모
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 pt-1 text-center text-label leading-relaxed text-muted-foreground">
        일일경영리포트에 저장된 최근 6개월 응답이에요 (전체관리자만 볼 수 있어요). 만족도 조사 답변은 앱에서 보낸 회원에게만 보여요. 처리 상태 바꾸기와 경품 추첨은 경영리포트에서 해요.
      </p>
    </div>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
    <p className="text-label font-bold text-foreground">{text}</p>
  </div>
);

export default MemberVoiceInbox;
