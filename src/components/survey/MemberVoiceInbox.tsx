/**
 * 📋 받은 설문·고객의 소리 — 본사 전용 (2026-10-18 대표님: "설문조사랑 앱 오류 신고 … 회원님들이 보낸 것 자세히 볼 수 있게").
 *
 *   · 데이터: Edge Function member-voice-inbox — 일일경영리포트(153OS)의 만족도 조사 응답 · 고객의 소리를 서버에서 읽어 온다 (최근 6개월).
 *   · 읽기 전용. 처리 상태 바꾸기·경품 추첨은 경영리포트에서. 연락처는 가운데를 가려서 보여 준다.
 *   · 주소: /survey?inbox=1 (고객의 소리부터: &tab=voice)
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, RotateCcw, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
        <span className="text-[12.5px] font-bold tabular-nums text-foreground">{a.score}</span>
      </span>
    ) : (
      <span className="text-[13.5px] font-bold tabular-nums text-foreground">
        {a.score} / {max}
      </span>
    );
  }
  const t = (a.text ?? "").trim();
  return t ? (
    <span className="whitespace-pre-line break-words text-[13.5px] leading-relaxed text-foreground">{t}</span>
  ) : (
    <span className="text-[12.5px] text-muted-foreground">답 없음</span>
  );
};

type Tab = "surveys" | "voices";

const MemberVoiceInbox = ({ initialTab = "surveys" }: { initialTab?: Tab }) => {
  const inbox = useMemberVoiceInbox(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const surveys = inbox.data?.surveys ?? [];
  const voices = inbox.data?.voices ?? [];
  const avgAll = useMemo(() => {
    const xs = surveys.map((s) => s.avg).filter((n): n is number => typeof n === "number");
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  }, [surveys]);

  if (inbox.isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 경영리포트에서 불러오는 중…
      </div>
    );
  if (inbox.isError)
    return (
      <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
        <p className="text-[14px] font-bold text-foreground">받은 응답을 불러오지 못했어요</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">경영리포트 연결이 잠시 안 될 수 있어요</p>
        <button
          type="button"
          onClick={() => inbox.refetch()}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-[13px] font-bold text-foreground active:scale-95"
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
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-colors",
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
              <p className="px-1 text-[12.5px] text-muted-foreground">
                최근 {surveys.length}건 평균 <span className="font-bold text-foreground tabular-nums">{avgAll}</span>점
              </p>
            )}
            <ul className="space-y-2.5">
              {surveys.map((s) => (
                <li key={s.id} className="rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-foreground">{s.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {[shortBranch(s.branch), s.anonymous ? "익명" : s.who ?? "이름 없음"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11.5px] tabular-nums text-muted-foreground">{whenText(s.at)}</p>
                      {s.avg != null && (
                        <p className="mt-0.5 inline-flex items-center gap-0.5 text-[13px] font-bold tabular-nums text-foreground">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.8} /> {s.avg}
                        </p>
                      )}
                    </div>
                  </div>
                  <ol className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                    {s.answers.map((a, i) => (
                      <li key={i}>
                        <p className="text-[12px] font-semibold leading-snug text-muted-foreground">
                          {i + 1}. {a.q}
                        </p>
                        <div className="mt-0.5">
                          <AnswerValue a={a} />
                        </div>
                      </li>
                    ))}
                  </ol>
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
                  <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", cat.cls)}>{cat.label}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">
                    {VOICE_STATUS[v.status] ?? v.status}
                  </span>
                  <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{whenText(v.at)}</span>
                </div>
                {v.rating != null && (
                  <div className="mt-2">
                    <Stars value={v.rating} />
                  </div>
                )}
                <p className="mt-2 whitespace-pre-line break-words text-[14px] leading-relaxed text-foreground">{v.content}</p>
                {v.coach && <p className="mt-2 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">칭찬한 코치 · {v.coach}</p>}
                <p className="mt-2 text-[12px] text-muted-foreground">
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

      <p className="px-1 pt-1 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        일일경영리포트에 저장된 최근 6개월 응답이에요 (본사만 볼 수 있어요). 처리 상태 바꾸기와 경품 추첨은 경영리포트에서 해요.
      </p>
    </div>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
    <p className="text-[14px] font-bold text-foreground">{text}</p>
  </div>
);

export default MemberVoiceInbox;
