/**
 * 🧠 마음 체크 — 아래에서 올라오는 창 (2026-11-14 대표님 「정신적인 향상도 넣자 · 과학적이고 설득력이 정말 중요해」)
 *   처음이면 안내 · 동의(민감정보 별도 동의 · 만 14세 확인) → 18문항을 한 장에 하나씩(고르면 다음으로) → 오늘의 마음 능력치.
 *   점수는 서버가 센다(mind_check_save) — 예시 화면(demo)은 같은 식(lib/mind153 score*)으로 이 기기 안에서만.
 *   문항 · 보기 · 출처는 data/mindScales 한 곳.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DmSheet } from "@/components/dm/DmParts";
import { MIND_ITEM_TOTAL, MIND_SCALE, MIND_SCALES } from "@/data/mindScales";
import {
  MIN_AGE,
  MIND_HELP_LINE,
  MIND_KEYS,
  MIND_REST_LINE,
  MIND_RESEARCH,
  MIND_STEPS,
  answeredAll,
  buildMindView,
  changeText,
  emptyMindAnswers,
  heroLine,
  nextStepText,
  scoreText,
  type MindAnswers,
  type MindState,
  type MindView,
} from "@/lib/mind153";
import { cn } from "@/lib/utils";

export interface MindSaveOutcome {
  replaced: boolean;
  state: MindState;
}

export interface MindCheckSheetProps {
  open: boolean;
  onClose: () => void;
  state: MindState;
  today: string;
  /** 동의 — 성공하면 다음 단계로 */
  onConsent: (adult: boolean) => Promise<unknown>;
  /** 저장 — 서버(또는 예시)가 센 결과 */
  onSave: (a: { conf: number[]; vital: number[]; habit: number[] }) => Promise<MindSaveOutcome>;
}

type Step = "intro" | "q" | "result";

const ScoreBar = ({ value, gold, className }: { value: number; gold?: boolean; className?: string }) => (
  <div className={cn("h-2.5 rounded-full bg-muted", className)} aria-hidden>
    <div
      className={cn("h-full rounded-full transition-[width] duration-700", gold ? "bg-reward" : "bg-primary")}
      style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
    />
  </div>
);

/* ───────────── 안내 · 동의 ───────────── */

const Intro = ({
  state,
  onStart,
  busy,
}: {
  state: MindState;
  onStart: (adult: boolean) => void;
  busy: boolean;
}) => {
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const tooYoung = state.age != null && state.age < MIN_AGE;
  return (
    <div className="pb-2">
      <p className="text-title font-black leading-snug text-foreground">운동이 내 마음을 어떻게 바꾸는지, 내 답으로 재요</p>
      <p className="mt-2 text-body leading-relaxed text-foreground">세계 연구에서 널리 쓰는 심리 검사 3가지를 그대로 써요. 지어낸 점수는 없어요.</p>

      <ul className="mt-4 space-y-2">
        {MIND_SCALES.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-body font-bold text-foreground">{s.label}</span>
              <span className="block truncate text-label text-muted-foreground">{s.test}</span>
            </span>
            <span className="shrink-0 text-label font-bold tabular-nums text-foreground">{s.items.length}문항</span>
          </li>
        ))}
      </ul>

      <ul className="mt-4 space-y-1.5 text-label leading-relaxed text-foreground">
        <li className="flex gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>답과 점수는 나만 봐요 — 코치님 · 지점장님 · 대표님도 못 봐요</span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>진단이 아니에요 — 4주마다 다시 재서 내 변화를 보는 자기 점검이에요</span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>언제든 지울 수 있어요 · 동의하지 않아도 앱은 그대로 써요</span>
        </li>
      </ul>

      {tooYoung ? (
        <p className="mt-6 rounded-xl bg-muted/50 px-4 py-3 text-body font-bold text-foreground">마음 체크는 만 {MIN_AGE}세 이상만 쓸 수 있어요</p>
      ) : (
        <>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
            <span className="text-body text-foreground">만 {MIN_AGE}세 이상이에요</span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
            <span className="text-body leading-snug text-foreground">
              마음 체크 답(민감정보 — 건강에 관한 정보)을 내 변화를 보는 데만 쓰는 데 동의해요
              <span className="mt-1 block text-label text-muted-foreground">보관: 내가 지우거나 동의를 거둘 때까지 · 회원 탈퇴 때 파기</span>
            </span>
          </label>
          <button
            type="button"
            disabled={!adult || !agree || busy}
            onClick={() => onStart(adult)}
            className="mt-4 h-14 w-full rounded-2xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "저장하는 중…" : !adult || !agree ? "위 두 가지를 확인해 주세요" : "동의하고 시작 · 2분"}
          </button>
        </>
      )}
    </div>
  );
};

/* ───────────── 문항 — 한 장에 하나 ───────────── */

const Question = ({
  stepIndex,
  answers,
  onPick,
}: {
  stepIndex: number;
  answers: MindAnswers;
  onPick: (v: number) => void;
}) => {
  const step = MIND_STEPS[stepIndex];
  const scale = MIND_SCALE[step.key];
  const item = scale.items[step.index];
  const picked = answers[step.key][step.index];
  return (
    <div className="pb-2">
      <div className="h-1.5 rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((stepIndex + 1) / MIND_ITEM_TOTAL) * 100}%` }} />
      </div>
      <p className="mt-4 text-label font-bold text-muted-foreground">
        {scale.label} · {step.index + 1}/{scale.items.length}
      </p>
      <p className="mt-1 text-label text-muted-foreground">{scale.prompt}</p>
      <p className="mt-3 min-h-[4.5rem] text-title font-black leading-snug text-foreground">{item.text}</p>
      <div className="mt-5 space-y-2" role="radiogroup" aria-label={item.text}>
        {scale.options.map((o) => {
          const on = picked === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.v)}
              className={cn(
                "flex h-14 w-full items-center justify-center rounded-2xl border-2 text-body font-bold transition-transform active:scale-[0.99]",
                on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ───────────── 결과 ───────────── */

export const MindResult = ({ view, replaced }: { view: MindView; replaced: boolean }) => {
  const last = view.last;
  if (!last) return null;
  return (
    <div className="pb-2">
      <p className="text-label font-bold text-muted-foreground">오늘의 마음 능력치</p>
      {view.hero.kind === "growth" && (
        <p className={cn("mt-1 text-title font-black leading-snug", view.hero.meaningful ? "text-reward" : "text-foreground")}>
          {MIND_SCALE[view.hero.key].label} {changeText(view.hero.change)}
        </p>
      )}
      {/* 숫자는 아래 줄에 한 번만 — 맨 위 한 줄은 말로만 */}
      <p className="mt-1 text-body leading-snug text-foreground">{heroLine(view.hero, false)}</p>

      <div className="mt-5 space-y-4">
        {view.rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0">
                <span className="text-body font-bold text-foreground">{r.label}</span>
                <span className="ml-1.5 text-label text-muted-foreground">{r.test}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5">
                {/* 주인공 줄의 오른 점수는 맨 위에 이미 크게 — 다시 쓰지 않는다 */}
                {r.change != null && !(view.hero.kind === "growth" && view.hero.key === r.key) && (
                  <span className={cn("text-label font-bold tabular-nums", r.meaningful ? "text-reward" : "text-primary")}>{changeText(r.change)}</span>
                )}
                <span className="text-heading font-black tabular-nums text-foreground">{scoreText(r.now)}</span>
              </span>
            </div>
            <ScoreBar value={r.now} gold={r.meaningful} className="mt-2" />
            <p className="mt-1.5 text-label leading-snug text-foreground">{MIND_RESEARCH.find((x) => x.key === r.key)?.body}</p>
          </div>
        ))}
      </div>

      {view.lowConf && <p className="mt-5 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">{MIND_HELP_LINE}</p>}
      {view.lowVital && <p className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">{MIND_REST_LINE}</p>}

      <p className="mt-5 text-body font-bold text-foreground">{nextStepText(view)}</p>
      <p className="mt-1 text-label text-muted-foreground">
        {replaced ? "2주 안에 다시 해서 지난 기록을 고쳐 썼어요" : "4주가 되면 알림으로 알려 드려요 · 점수는 0~100"}
      </p>
    </div>
  );
};

/* ───────────── 창 ───────────── */

const MindCheckSheet = ({ open, onClose, state, today, onConsent, onSave }: MindCheckSheetProps) => {
  const [step, setStep] = useState<Step>(state.consent ? "q" : "intro");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<MindAnswers>(emptyMindAnswers);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MindSaveOutcome | null>(null);
  const advanceTimer = useRef<number | null>(null);

  // 열 때마다 처음부터 — 동의가 있으면 바로 첫 문항
  useEffect(() => {
    if (!open) return;
    setStep(state.consent ? "q" : "intro");
    setQi(0);
    setAnswers(emptyMindAnswers());
    setBusy(false);
    setSaveError(null);
    setOutcome(null);
    // 열 때 한 번만 — 저장 뒤 상태가 바뀌어도 결과 화면을 지키게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const resultView = useMemo(() => (outcome ? buildMindView(outcome.state.checks, today) : null), [outcome, today]);

  const save = async (a: MindAnswers) => {
    if (!answeredAll(a)) return;
    setBusy(true);
    setSaveError(null);
    try {
      const out = await onSave({
        conf: a.conf as number[],
        vital: a.vital as number[],
        habit: a.habit as number[],
      });
      setOutcome(out);
      setStep("result");
    } catch (e) {
      setSaveError((e as Error).message || "저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요");
    } finally {
      setBusy(false);
    }
  };

  const pick = (v: number) => {
    const s = MIND_STEPS[qi];
    const next: MindAnswers = { ...answers, [s.key]: answers[s.key].map((x, i) => (i === s.index ? v : x)) };
    setAnswers(next);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (qi < MIND_STEPS.length - 1) {
      advanceTimer.current = window.setTimeout(() => setQi((i) => Math.min(i + 1, MIND_STEPS.length - 1)), 180);
    } else {
      void save(next);
    }
  };

  const start = async (adult: boolean) => {
    setBusy(true);
    try {
      await onConsent(adult);
      setStep("q");
    } catch (e) {
      toast.error((e as Error).message || "동의를 저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const title = step === "result" ? "마음 체크 결과" : "마음 체크";
  const subtitle =
    step === "intro" ? `${MIND_ITEM_TOTAL}문항 · 2분 · 나만 봐요` : step === "q" ? `${qi + 1}/${MIND_ITEM_TOTAL} · 고르면 다음으로 넘어가요` : "검증된 검사 3가지 · 0~100";

  const footer =
    step === "q" ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setQi((i) => Math.max(0, i - 1))}
          disabled={qi === 0 || busy}
          className="flex h-12 shrink-0 items-center gap-1 rounded-xl bg-secondary px-4 text-body font-bold text-secondary-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
          이전
        </button>
        {saveError ? (
          <button
            type="button"
            onClick={() => void save(answers)}
            disabled={busy}
            className="h-12 min-w-0 flex-1 rounded-xl bg-primary px-3 text-body font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "저장하는 중…" : "다시 저장"}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-right text-label text-muted-foreground">
            {busy ? "점수를 세는 중…" : MIND_STEPS[qi].key === MIND_KEYS[0] ? "처음 떠오르는 답이 가장 정확해요" : "솔직한 답이 내 변화를 보여 줘요"}
          </span>
        )}
      </div>
    ) : step === "result" ? (
      <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.99]">
        완료
      </button>
    ) : undefined;

  return (
    <DmSheet open={open} onClose={onClose} tall title={title} subtitle={subtitle} footer={footer}>
      {step === "intro" && <Intro state={state} onStart={(a) => void start(a)} busy={busy} />}
      {step === "q" && (
        <>
          <Question stepIndex={qi} answers={answers} onPick={pick} />
          {saveError && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-label font-bold text-destructive">{saveError}</p>}
        </>
      )}
      {step === "result" && resultView && <MindResult view={resultView} replaced={outcome?.replaced ?? false} />}
    </DmSheet>
  );
};

export default MindCheckSheet;
