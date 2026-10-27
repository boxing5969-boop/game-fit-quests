import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Inbox, Lightbulb, MessageCircle, MessageSquareHeart, Star, ThumbsUp, Gift, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import MemberVoiceInbox from "@/components/survey/MemberVoiceInbox";
import {
  SURVEY_REWARD,
  claimSurveyReward,
  getBranchSurveyLinks,
  getFeedbackChannel,
  getMySurveyRewards,
  getPublicSurvey,
  submitFeedback,
  submitSurvey,
  type FeedbackCategory,
  type SurveyAnswer,
  type SurveyQuestion,
  type SurveyRewardKind,
} from "@/services/memberSurveyService";

// ── 회원 설문 (2026-10-15 대표님: "일일경영리포트에서 QR로 하는 설문·만족도 조사를 앱에 넣어줘") ──
// 만족도 조사 + 고객의 소리(경품 추첨). 응답은 경영리포트로 바로 간다 — memberSurveyService 참고.
// 참여 보상: 만족도 조사 +3,000 · 고객의 소리 +5,000 챔피언 머니 (종류별 한 달 한 번, 2026-10-16 대표님).
// 2026-10-18 대표님: "회원님들이 보낸 것 자세히 볼 수 있게" → 본사(super_admin·admin)에게 '받은 설문·고객의 소리'
// (components/survey/MemberVoiceInbox — 경영리포트에서 서버로 읽어 온다). 주소: /survey?inbox=1 (&tab=voice).

type View = "hub" | "satisfaction" | "feedback" | "done" | "inbox";

const CATS: { key: FeedbackCategory; label: string; hint: string; Icon: typeof ThumbsUp; tone: string }[] = [
  { key: "coach_praise", label: "코치 칭찬", hint: "고마운 코치님이 있어요", Icon: ThumbsUp, tone: "text-emerald-500 bg-emerald-500/10" },
  { key: "improvement", label: "개선 제안", hint: "이렇게 바뀌면 좋겠어요", Icon: Lightbulb, tone: "text-amber-500 bg-amber-500/10" },
  { key: "complaint", label: "불편·건의", hint: "불편했던 점을 알려주세요", Icon: MessageSquareHeart, tone: "text-rose-500 bg-rose-500/10" },
  { key: "free", label: "자유 한마디", hint: "무엇이든 좋아요", Icon: MessageCircle, tone: "text-sky-500 bg-sky-500/10" },
];

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="뒤로가기"
    className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
  >
    <ArrowLeft className="h-4 w-4 text-secondary-foreground" />
  </button>
);

const StarRow = ({ value, onChange, max = 5 }: { value: number | null; onChange: (v: number) => void; max?: number }) => (
  <div className="flex justify-between gap-1.5">
    {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n}점`}
        className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card py-3 transition-transform active:scale-90"
      >
        <Star
          className={cn("h-7 w-7", value != null && n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
          strokeWidth={1.8}
        />
      </button>
    ))}
  </div>
);

const Chip = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-2xl border px-3.5 py-3 text-left text-label font-semibold transition-colors",
      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
    )}
  >
    {children}
  </button>
);

function QuestionBlock({ q, idx, value, onChange }: { q: SurveyQuestion; idx: number; value: SurveyAnswer; onChange: (a: SurveyAnswer) => void }) {
  const max = q.options?.max ?? 5;
  const labels = q.options?.labels ?? {};
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-body font-bold leading-snug text-foreground">
        <span className="mr-1.5 text-primary">Q{idx + 1}.</span>
        {q.question_text}
        {!q.is_required && <span className="ml-1 text-label font-medium text-muted-foreground">(선택)</span>}
      </p>
      {q.question_type === "rating" && (
        <>
          <StarRow value={value.answer_score ?? null} max={max} onChange={(v) => onChange({ answer_score: v })} />
          {(labels["1"] || labels[String(max)]) && (
            <div className="flex justify-between text-micro text-muted-foreground">
              <span>{labels["1"]}</span>
              <span>{labels[String(max)]}</span>
            </div>
          )}
        </>
      )}
      {q.question_type === "multiple_choice" && (
        <div className="grid grid-cols-1 gap-2">
          {(q.options?.choices ?? []).map((c, i) => (
            <Chip key={c} active={value.answer_text === c} onClick={() => onChange({ answer_text: c, answer_score: i + 1 })}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      {q.question_type === "yes_no" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "예", icon: "👍" },
            { label: "아니오", icon: "🤔" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange({ answer_text: o.label })}
              className={cn(
                "rounded-2xl border py-4 text-body font-bold transition-all active:scale-95",
                value.answer_text === o.label ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
              )}
            >
              <span className="mr-1">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {q.question_type === "text" && (
        <textarea
          value={value.answer_text ?? ""}
          onChange={(e) => onChange({ answer_text: e.target.value })}
          rows={4}
          maxLength={1000}
          placeholder="편하게 적어주세요"
          className="w-full resize-none rounded-xl border border-border bg-background p-3 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
      )}
    </div>
  );
}

const SurveyPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, role } = useAuth();
  const isHq = role === "super_admin" || role === "admin";
  const [params] = useSearchParams();
  const branch = profile?.branch_name ?? null;
  const [view, setView] = useState<View>(() => (params.get("inbox") === "1" ? "inbox" : "hub"));
  const [busy, setBusy] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{ kind: SurveyRewardKind; reward: number; drawNote?: string | null; drawEntered?: boolean } | null>(null);

  const links = useQuery({ queryKey: ["survey-links", branch], queryFn: () => getBranchSurveyLinks(branch), enabled: !!branch });
  const rewards = useQuery({ queryKey: ["survey-rewards"], queryFn: getMySurveyRewards });
  const survey = useQuery({
    queryKey: ["public-survey", links.data?.survey_slug],
    queryFn: () => getPublicSurvey(links.data!.survey_slug!),
    enabled: !!links.data?.survey_slug,
    retry: 1,
  });
  const channel = useQuery({
    queryKey: ["feedback-channel", links.data?.feedback_slug],
    queryFn: () => getFeedbackChannel(links.data!.feedback_slug!),
    enabled: !!links.data?.feedback_slug,
    retry: 1,
  });

  // 만족도 조사 상태
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const missing = useMemo(() => {
    const qs = survey.data?.questions ?? [];
    return qs.filter((q) => {
      if (!q.is_required) return false;
      const a = answers[q.id];
      if (q.question_type === "text" || q.question_type === "yes_no") return !(a?.answer_text ?? "").trim();
      return a?.answer_score == null;
    }).length;
  }, [answers, survey.data]);

  // 고객의 소리 상태
  const [cat, setCat] = useState<FeedbackCategory | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [coachName, setCoachName] = useState("");
  const [drawOptIn, setDrawOptIn] = useState(false);
  const [contactName, setContactName] = useState(profile?.name ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.phone_number ?? "");
  const [agreed, setAgreed] = useState(false);
  const drawOk = !drawOptIn || (agreed && contactPhone.replace(/\D/g, "").length >= 10);
  const canSendFeedback = !!cat && content.trim().length >= 2 && drawOk && !busy;

  async function afterSubmit(kind: SurveyRewardKind, extra?: { drawNote?: string | null; drawEntered?: boolean }) {
    const r = await claimSurveyReward(kind);
    if (r.granted) {
      toast.success(`챔피언 머니 +${(r.amount ?? SURVEY_REWARD[kind]).toLocaleString()} 💵`);
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    }
    void qc.invalidateQueries({ queryKey: ["survey-rewards"] });
    setDoneInfo({ kind, reward: r.granted ? (r.amount ?? SURVEY_REWARD[kind]) : 0, ...extra });
    setView("done");
    window.scrollTo({ top: 0 });
  }

  async function sendSurvey() {
    if (!links.data?.survey_slug || missing > 0) return;
    setBusy(true);
    try {
      await submitSurvey(links.data.survey_slug, answers);
      await afterSubmit("satisfaction");
      setAnswers({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "제출에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function sendFeedback() {
    if (!links.data?.feedback_slug || !cat || !canSendFeedback) return;
    setBusy(true);
    try {
      const r = await submitFeedback({
        slug: links.data.feedback_slug,
        category: cat,
        rating,
        content,
        coach_name: coachName,
        draw_opt_in: drawOptIn,
        contact_name: contactName,
        contact_phone: contactPhone,
        privacy_agreed: agreed,
      });
      await afterSubmit("feedback", { drawNote: r.note, drawEntered: r.drawEntered });
      setCat(null); setRating(null); setContent(""); setCoachName(""); setDrawOptIn(false); setAgreed(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  const header = (title: string, subtitle: string, onBack: () => void) => (
    <PageHeader sticky title={title} subtitle={subtitle} leftAction={<BackBtn onClick={onBack} />} />
  );

  // ── 본사: 받은 설문·고객의 소리 ──
  if (view === "inbox" && isHq) {
    return (
      <AppPage header={header("받은 설문·고객의 소리", "회원님이 보낸 응답 · 전체관리자만 봐요", () => setView("hub"))}>
        <MemberVoiceInbox initialTab={params.get("tab") === "voice" ? "voices" : "surveys"} />
      </AppPage>
    );
  }

  // ── 완료 ──
  if (view === "done" && doneInfo) {
    return (
      <AppPage header={header("감사합니다", "소중한 의견 잘 받았어요", () => setView("hub"))}>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Check className="h-8 w-8 text-primary" strokeWidth={3} />
          </span>
          <p className="text-heading font-extrabold text-foreground">접수됐습니다!</p>
          <p className="text-body leading-relaxed text-muted-foreground">
            보내주신 내용은 지점장님과 운영진이 직접 확인하고
            <br />
            체육관을 더 좋게 만드는 데 쓰입니다.
          </p>
          {doneInfo.reward > 0 && (
            <p className="mt-1 rounded-pill bg-amber-400/15 px-4 py-2 text-body font-bold text-amber-600 dark:text-amber-300">
              💵 챔피언 머니 +{doneInfo.reward.toLocaleString()} 지급
            </p>
          )}
          {doneInfo.kind === "feedback" && (doneInfo.drawEntered || doneInfo.drawNote) && (
            <p className="text-label text-muted-foreground">
              {doneInfo.drawEntered ? "🎁 이번 달 경품 추첨에 응모됐어요" : doneInfo.drawNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => setView("hub")}
            className="mt-4 rounded-pill bg-primary px-6 py-3 text-body font-bold text-primary-foreground active:scale-95"
          >
            처음으로
          </button>
        </div>
      </AppPage>
    );
  }

  // ── 만족도 조사 ──
  if (view === "satisfaction") {
    return (
      <AppPage header={header(survey.data?.template.title ?? "만족도 조사", survey.data?.template.description ?? "1분이면 끝나요", () => setView("hub"))}>
        {survey.isLoading ? (
          <p className="mt-10 text-center text-body text-muted-foreground">불러오는 중…</p>
        ) : survey.error ? (
          <p className="mt-10 text-center text-body text-muted-foreground">{(survey.error as Error).message}</p>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="px-1 text-label text-muted-foreground">🔒 익명으로 전달돼요. 이름·연락처는 함께 보내지 않습니다.</p>
            {survey.data!.questions.map((q, i) => (
              <QuestionBlock
                key={q.id}
                q={q}
                idx={i}
                value={answers[q.id] ?? {}}
                onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
              />
            ))}
            <button
              type="button"
              onClick={sendSurvey}
              disabled={busy || missing > 0}
              className="mt-2 w-full rounded-2xl bg-primary py-4 text-body font-extrabold text-primary-foreground shadow-elev-1 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "보내는 중…" : missing > 0 ? `필수 질문 ${missing}개 남았어요` : "제출하기"}
            </button>
          </div>
        )}
      </AppPage>
    );
  }

  // ── 고객의 소리 ──
  if (view === "feedback") {
    return (
      <AppPage header={header("고객의 소리", channel.data?.branch_name ?? "칭찬·제안·건의 무엇이든", () => setView("hub"))}>
        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-2">
            {CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]",
                  cat === c.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card",
                )}
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", c.tone)}>
                  <c.Icon className="h-4 w-4" />
                </span>
                <span className="text-label font-bold text-foreground">{c.label}</span>
                <span className="text-micro leading-snug text-muted-foreground">{c.hint}</span>
              </button>
            ))}
          </div>

          {cat && (
            <>
              {cat === "coach_praise" && (
                <input
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  maxLength={40}
                  placeholder="어느 코치님인가요? (선택)"
                  className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                />
              )}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={
                  cat === "coach_praise"
                    ? "어떤 점이 좋았는지 한 줄이면 충분해요 :)"
                    : cat === "complaint"
                      ? "언제, 어떤 점이 불편하셨나요?"
                      : cat === "improvement"
                        ? "이렇게 바뀌면 더 좋겠다 싶은 점을 알려주세요"
                        : "자유롭게 적어주세요"
                }
                className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
              />
              <div className="space-y-2">
                <p className="px-1 text-label font-bold text-foreground">
                  전반적인 만족도 <span className="font-medium text-muted-foreground">(선택)</span>
                </p>
                <StarRow value={rating} onChange={setRating} />
              </div>

              {channel.data?.prize_text && (
                <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={drawOptIn}
                      onChange={(e) => setDrawOptIn(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-primary"
                    />
                    <span>
                      <span className="flex items-center gap-1 text-label font-bold text-foreground">
                        <Gift className="h-4 w-4 text-amber-500" /> 이달의 경품 추첨 응모
                      </span>
                      <span className="mt-0.5 block text-label text-muted-foreground">{channel.data.prize_text}</span>
                    </span>
                  </label>
                  {drawOptIn && (
                    <div className="space-y-2">
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        maxLength={40}
                        placeholder="이름"
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-body focus:border-primary focus:outline-none"
                      />
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        inputMode="tel"
                        maxLength={20}
                        placeholder="연락처 (당첨 안내용)"
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-body focus:border-primary focus:outline-none"
                      />
                      <label className="flex items-start gap-2 text-label leading-relaxed text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-primary"
                        />
                        <span>
                          추첨·경품 전달을 위해 이름과 연락처를 수집하는 데 동의합니다. 추첨이 끝나면 지난 달 응모 정보는 자동으로
                          파기돼요. 의견 내용은 항상 익명으로 전달됩니다.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={sendFeedback}
                disabled={!canSendFeedback}
                className="w-full rounded-2xl bg-primary py-4 text-body font-extrabold text-primary-foreground shadow-elev-1 transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "보내는 중…" : "보내기"}
              </button>
            </>
          )}
        </div>
      </AppPage>
    );
  }

  // ── 첫 화면 ──
  const hasAny = !!links.data?.survey_slug || !!links.data?.feedback_slug;
  const RewardTag = ({ kind }: { kind: SurveyRewardKind }) =>
    rewards.data?.[kind] ? (
      <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">이번 달 참여 완료 ✓</span>
    ) : (
      <span className="rounded-pill bg-amber-400/15 px-2 py-0.5 text-micro font-bold text-amber-600 dark:text-amber-300">
        💵 +{SURVEY_REWARD[kind].toLocaleString()}
      </span>
    );

  return (
    <AppPage header={header("설문·고객의 소리", "여러분의 목소리로 체육관이 좋아집니다", () => navigate(-1))}>
      {isHq && (
        <button
          type="button"
          onClick={() => setView("inbox")}
          className="mb-3 flex w-full items-center gap-3.5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Inbox className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-extrabold text-foreground">받은 설문·고객의 소리</span>
            <span className="mt-0.5 block text-label text-muted-foreground">전 지점 보기 · 회원님이 보낸 응답을 자세히 봐요</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
      {links.isLoading ? (
        <p className="mt-10 text-center text-body text-muted-foreground">불러오는 중…</p>
      ) : !hasAny ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <span className="text-display">📋</span>
          <p className="text-body font-bold text-foreground">우리 지점 설문은 곧 열려요</p>
          <p className="text-body text-muted-foreground">
            앱에 문제가 있다면 <button type="button" className="font-bold text-primary underline" onClick={() => navigate("/feedback")}>오류 신고</button>로 알려주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.data?.survey_slug && (
            <button
              type="button"
              onClick={() => setView("satisfaction")}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-title">⭐</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-body font-extrabold text-foreground">만족도 조사</span>
                  <RewardTag kind="satisfaction" />
                </span>
                <span className="mt-0.5 block text-label text-muted-foreground">1분이면 끝나요 · 익명으로 전달</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {links.data?.feedback_slug && (
            <button
              type="button"
              onClick={() => setView("feedback")}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-title">💬</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-body font-extrabold text-foreground">고객의 소리</span>
                  <RewardTag kind="feedback" />
                </span>
                <span className="mt-0.5 block text-label text-muted-foreground">
                  코치 칭찬·개선 제안·건의{channel.data?.prize_text ? " · 🎁 이달의 경품 추첨" : ""}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          <p className="px-1 pt-2 text-center text-label leading-relaxed text-muted-foreground">
            보내주신 내용은 지점장님과 운영진이 직접 확인합니다.
            <br />
            참여 보상은 종류별로 한 달에 한 번 지급돼요.
          </p>
        </div>
      )}
    </AppPage>
  );
};

export default SurveyPage;
