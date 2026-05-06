/**
 * 마이복서153 — 시각화 훈련 세션 컴포넌트.
 *
 * 7 흐름:
 *   1. 시작 화면
 *   2. 오늘의 마음 선택
 *   3. 오늘의 한 가지 마음가짐 선택
 *   4. 오늘의 세 가지 실천 약속 선택 (정확히 3개, FIFO)
 *   5. 3분 1라운드 시각화 플레이어 (12 세그먼트 × 15초)
 *   6. 훈련 후 감정 기록
 *   7. 저장 완료 화면 → localStorage 단독
 *
 * 보호 원칙:
 *   · DB / API 호출 0.
 *   · 다른 파일 미수정.
 *   · localStorage 만 사용 (key: myboxer.visualization.records).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Pause,
  Play,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MOOD_OPTIONS,
  MINDSET_OPTIONS,
  PROMISE_OPTIONS,
  VISUALIZATION_SESSION,
  getActiveSegment,
  getMoodOption,
  getMindsetOption,
  type MoodKey,
  type MindsetKey,
  type PromiseKey,
  type VisualizationSession as VisualizationSessionData,
} from "./visualizationContent";

// ─────────────────────────────────────────────────────────────
// localStorage
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "myboxer.visualization.records";

interface VisualizationRecord {
  sessionId: string;
  completedAt: string;
  mood?: MoodKey;
  mindset?: MindsetKey;
  promises: PromiseKey[];
  reflection: string;
  declaration: string;
}

function appendRecord(record: VisualizationRecord): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: VisualizationRecord[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    safeList.unshift(record);
    // 최근 200개만 보관 (안전 상한)
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(safeList.slice(0, 200)),
    );
  } catch {
    // QuotaExceeded 등 — 조용히 무시
  }
}

// ─────────────────────────────────────────────────────────────
// 흐름 단계
// ─────────────────────────────────────────────────────────────

type Step =
  | "start"
  | "mood"
  | "mindset"
  | "promises"
  | "player"
  | "reflection"
  | "saved";

const STEP_ORDER: Step[] = [
  "start",
  "mood",
  "mindset",
  "promises",
  "player",
  "reflection",
  "saved",
];

// ─────────────────────────────────────────────────────────────
// Public props
// ─────────────────────────────────────────────────────────────

export interface MyBoxerVisualizationSessionProps {
  /**
   * 사용할 시각화 세션 데이터.
   * 미지정 시 단기 세션 (153복싱짐으로 돌아온 사람) 으로 폴백.
   * 장기 세션을 사용하려면 `session={LONG_TERM_VISUALIZATION_SESSION}` 전달.
   */
  session?: VisualizationSessionData;
  /** 세션 종료 / 닫기 핸들러 (선택). 없으면 "처음부터" 버튼만 노출. */
  onClose?: () => void;
  /** 저장 완료 후 호출 (선택). 외부에서 추가 액션이 필요할 때. */
  onSaved?: (record: VisualizationRecord) => void;
}

// ─────────────────────────────────────────────────────────────
// 본 컴포넌트
// ─────────────────────────────────────────────────────────────

const MyBoxerVisualizationSession = ({
  session = VISUALIZATION_SESSION,
  onClose,
  onSaved,
}: MyBoxerVisualizationSessionProps) => {
  const [step, setStep] = useState<Step>("start");
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [mindset, setMindset] = useState<MindsetKey | null>(null);
  const [promises, setPromises] = useState<PromiseKey[]>([]);
  const [reflection, setReflection] = useState("");

  // 플레이어 상태
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // step 진행 helpers
  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };
  const goPrev = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const restart = () => {
    setStep("start");
    setMood(null);
    setMindset(null);
    setPromises([]);
    setReflection("");
    setElapsed(0);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 약속 — 정확히 3개, 4번째 클릭 시 FIFO (가장 오래된 제거)
  const togglePromise = (key: PromiseKey) => {
    setPromises((prev) => {
      if (prev.includes(key)) {
        return prev.filter((p) => p !== key);
      }
      if (prev.length < 3) {
        return [...prev, key];
      }
      // 3개 이상 — 가장 오래된 1개 제거 + 새 선택 추가
      return [...prev.slice(1), key];
    });
  };

  // ── 플레이어 setInterval ──
  useEffect(() => {
    if (step !== "player") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= session.durationSeconds) {
          // 도달 시 자동 멈춤
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsPlaying(false);
          return session.durationSeconds;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [step, isPlaying, session]);

  // 언마운트 cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 시각화 자연 종료 시 감정 기록 화면으로 자동 이동.
  //   · 마지막 세그먼트("오늘이 시작이다" 등)를 1.8초간 머무를 시간 확보 후 전환.
  //   · 사용자가 "지금 마무리하기" 버튼으로 수동 이동한 경우엔 이 효과는 비활성.
  useEffect(() => {
    if (step !== "player") return;
    if (elapsed < session.durationSeconds) return;
    const t = setTimeout(() => {
      setStep("reflection");
    }, 1800);
    return () => clearTimeout(t);
  }, [step, elapsed, session.durationSeconds]);

  // 세션이 바뀌면 진행 상태 초기화 (외부에서 다른 세션 prop 으로 변경 시)
  useEffect(() => {
    setElapsed(0);
    setIsPlaying(false);
  }, [session.id]);

  const playerComplete = elapsed >= session.durationSeconds;
  const currentSegment = useMemo(
    () => getActiveSegment(elapsed, session),
    [elapsed, session],
  );
  const moodResp = mood ? getMoodOption(mood)?.response : null;
  const mindsetDesc = mindset ? getMindsetOption(mindset)?.description : null;
  const canSave = step === "reflection";

  // ── 저장 ──
  const handleSave = () => {
    const record: VisualizationRecord = {
      sessionId: session.id,
      completedAt: new Date().toISOString(),
      mood: mood ?? undefined,
      mindset: mindset ?? undefined,
      promises,
      reflection: reflection.trim(),
      declaration: session.closingDeclaration,
    };
    appendRecord(record);
    setStep("saved");
    if (onSaved) onSaved(record);
  };

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0a1024 0%, #0d1530 50%, #0a1024 100%)",
      }}
    >
      {/* 배경 amber glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #fdb85c 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-24 pt-8 text-amber-50">
        {/* 상단 — 닫기 (있을 때만) */}
        {onClose && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="세션 닫기"
              className="rounded-full border border-amber-500/15 bg-black/30 p-1.5 text-amber-200/70 transition-colors hover:bg-black/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 단계 인디케이터 */}
        {step !== "start" && step !== "saved" && (
          <StepIndicator step={step} />
        )}

        <AnimatePresence mode="wait">
          {step === "start" && (
            <StartScreen
              key="start"
              title={session.title}
              subtitle={session.subtitle}
              openingText={session.openingText}
              onStart={() => setStep("mood")}
            />
          )}
          {step === "mood" && (
            <MoodStep
              key="mood"
              selected={mood}
              onSelect={setMood}
              onNext={goNext}
              onBack={goPrev}
              response={moodResp ?? null}
            />
          )}
          {step === "mindset" && (
            <MindsetStep
              key="mindset"
              selected={mindset}
              onSelect={setMindset}
              onNext={goNext}
              onBack={goPrev}
              description={mindsetDesc ?? null}
            />
          )}
          {step === "promises" && (
            <PromisesStep
              key="promises"
              selected={promises}
              onToggle={togglePromise}
              onNext={() => {
                setElapsed(0);
                setIsPlaying(false);
                goNext();
              }}
              onBack={goPrev}
            />
          )}
          {step === "player" && (
            <PlayerStep
              key="player"
              session={session}
              elapsed={elapsed}
              isPlaying={isPlaying}
              segment={currentSegment}
              complete={playerComplete}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onResume={() => setIsPlaying(true)}
              onRestart={() => {
                setElapsed(0);
                setIsPlaying(true);
              }}
              onFinish={() => {
                setIsPlaying(false);
                setStep("reflection");
              }}
            />
          )}
          {step === "reflection" && (
            <ReflectionStep
              key="reflection"
              value={reflection}
              closingDeclaration={session.closingDeclaration}
              onChange={setReflection}
              onSave={handleSave}
              onBack={() => setStep("player")}
              canSave={canSave}
            />
          )}
          {step === "saved" && (
            <SavedScreen
              key="saved"
              onAgain={restart}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 단계 인디케이터 — 5 단계 dot (mood → mindset → promises → player → reflection)
// ─────────────────────────────────────────────────────────────

const STEP_DOTS: Step[] = ["mood", "mindset", "promises", "player", "reflection"];

function StepIndicator({ step }: { step: Step }) {
  const idx = STEP_DOTS.indexOf(step);
  return (
    <div className="mb-6 flex justify-center gap-1.5">
      {STEP_DOTS.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1 w-6 rounded-full transition-colors",
            i < idx
              ? "bg-amber-300/80"
              : i === idx
                ? "bg-amber-300"
                : "bg-amber-200/15",
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. 시작 화면
// ─────────────────────────────────────────────────────────────

function StartScreen({
  title,
  subtitle,
  openingText,
  onStart,
}: {
  title: string;
  subtitle: string;
  openingText: string;
  onStart: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-7 pt-6 text-center"
    >
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-300/70">
          MYBOXER 153
        </p>
        <h1 className="whitespace-pre-line text-3xl font-black leading-tight text-amber-50">
          {title}
        </h1>
        <p className="text-[12px] text-amber-200/60">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-black/30 to-rose-900/10 p-5 text-left">
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-amber-100/90">
          {openingText}
        </p>
      </div>

      <div className="rounded-xl border-l-2 border-rose-500/60 bg-rose-950/15 px-4 py-3 text-left">
        <p className="text-[11px] leading-relaxed text-rose-100/80">
          복싱은 강해지는 시간이기도 하지만,
          <br />
          나를 다시 좋아하게 되는 시간이기도 합니다.
        </p>
      </div>

      <Button
        onClick={onStart}
        className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-base font-black tracking-wider text-amber-950 shadow-[0_0_20px_rgba(253,184,92,0.35)] hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
      >
        시작하기
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. 오늘의 마음 선택
// ─────────────────────────────────────────────────────────────

function MoodStep({
  selected,
  onSelect,
  onNext,
  onBack,
  response,
}: {
  selected: MoodKey | null;
  onSelect: (k: MoodKey) => void;
  onNext: () => void;
  onBack: () => void;
  response: string | null;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">
          STEP 1 · 오늘의 마음
        </p>
        <h2 className="text-xl font-black text-amber-50">
          오늘 당신의 마음은 어떤가요?
        </h2>
      </header>

      <div className="space-y-2">
        {MOOD_OPTIONS.map((opt) => (
          <SelectableCard
            key={opt.key}
            active={selected === opt.key}
            onClick={() => onSelect(opt.key)}
          >
            <span className="text-[13px] font-bold">{opt.label}</span>
          </SelectableCard>
        ))}
      </div>

      {response && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-3"
        >
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-amber-100">
            {response}
          </p>
        </motion.div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!selected}
      />
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 오늘의 한 가지 마음가짐
// ─────────────────────────────────────────────────────────────

function MindsetStep({
  selected,
  onSelect,
  onNext,
  onBack,
  description,
}: {
  selected: MindsetKey | null;
  onSelect: (k: MindsetKey) => void;
  onNext: () => void;
  onBack: () => void;
  description: string | null;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">
          STEP 2 · 오늘의 마음가짐
        </p>
        <h2 className="text-xl font-black text-amber-50">
          오늘 한 가지 마음가짐을 고르세요.
        </h2>
      </header>

      <div className="space-y-2">
        {MINDSET_OPTIONS.map((opt) => (
          <SelectableCard
            key={opt.key}
            active={selected === opt.key}
            onClick={() => onSelect(opt.key)}
          >
            <span className="text-[13px] font-bold">{opt.label}</span>
          </SelectableCard>
        ))}
      </div>

      {description && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-3"
        >
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-amber-100">
            {description}
          </p>
        </motion.div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!selected}
      />
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. 실천 약속 (정확히 3개)
// ─────────────────────────────────────────────────────────────

function PromisesStep({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: PromiseKey[];
  onToggle: (k: PromiseKey) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const ready = selected.length === 3;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">
          STEP 3 · 실천 약속
        </p>
        <h2 className="text-xl font-black text-amber-50">
          오늘 지킬 세 가지 약속을 고르세요.
        </h2>
        <p className="text-[11px] text-amber-200/60">
          {selected.length} / 3 선택됨 · 4번째를 고르면 가장 먼저 고른 약속이
          빠집니다.
        </p>
      </header>

      <div className="space-y-2">
        {PROMISE_OPTIONS.map((opt) => {
          const isOn = selected.includes(opt.key);
          return (
            <SelectableCard
              key={opt.key}
              active={isOn}
              onClick={() => onToggle(opt.key)}
              indicator={isOn ? <Check className="h-4 w-4" /> : null}
            >
              <div>
                <p className="text-[13px] font-bold">{opt.label}</p>
                <p className="mt-0.5 text-[11px] text-amber-200/60">
                  {opt.action}
                </p>
              </div>
            </SelectableCard>
          );
        })}
      </div>

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!ready}
        nextLabel="3분 시각화 시작"
      />
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 3분 1라운드 시각화 플레이어
// ─────────────────────────────────────────────────────────────

function PlayerStep({
  session,
  elapsed,
  isPlaying,
  segment,
  complete,
  onPlay,
  onPause,
  onResume,
  onRestart,
  onFinish,
}: {
  session: VisualizationSessionData;
  elapsed: number;
  isPlaying: boolean;
  segment: ReturnType<typeof getActiveSegment>;
  complete: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onFinish: () => void;
}) {
  const total = session.durationSeconds;
  const pct = Math.min(100, (elapsed / total) * 100);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const tmm = String(Math.floor(total / 60)).padStart(2, "0");
  const tss = String(total % 60).padStart(2, "0");

  const started = elapsed > 0 || isPlaying;
  const segIdx = segment.id;
  const totalSeg = session.segments.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <header className="space-y-1 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">
          STEP 4 · 3분 시각화
        </p>
        <h2 className="text-lg font-black text-amber-50">{session.title}</h2>
      </header>

      {/* 진행률 바 + 시간 */}
      <div className="space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-amber-200/70">
          <span>
            {mm}:{ss}
          </span>
          <span className="text-amber-200/40">
            세그먼트 {segIdx} / {totalSeg}
          </span>
          <span>
            {tmm}:{tss}
          </span>
        </div>
      </div>

      {/* 현재 세그먼트 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={segment.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-black/40 to-rose-900/10 p-5"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <CircleDot className="h-3 w-3 text-amber-300" />
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
              {segment.title}
            </p>
          </div>
          <p className="mb-4 text-[12px] italic text-amber-200/70">
            {segment.guide}
          </p>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-amber-50/95">
            {segment.narration}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* 컨트롤 */}
      <div className="space-y-2">
        {!started && (
          <Button
            onClick={onPlay}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
          >
            <Play className="mr-1 h-4 w-4" />
            시작
          </Button>
        )}

        {started && !complete && (
          <div className="flex gap-2">
            {isPlaying ? (
              <Button
                variant="outline"
                onClick={onPause}
                className="h-11 flex-1 rounded-xl border-amber-500/30 bg-black/30 text-amber-100 hover:bg-black/50"
              >
                <Pause className="mr-1 h-4 w-4" />
                일시정지
              </Button>
            ) : (
              <Button
                onClick={onResume}
                className="h-11 flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-bold text-amber-950 hover:from-amber-400 hover:to-amber-300"
              >
                <Play className="mr-1 h-4 w-4" />
                계속하기
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onRestart}
              className="h-11 rounded-xl border-amber-500/20 bg-black/30 text-amber-200 hover:bg-black/50"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 완료 또는 수동 종료 */}
        <Button
          variant="ghost"
          onClick={onFinish}
          className={cn(
            "h-11 w-full rounded-xl text-[12px] font-bold transition-colors",
            complete
              ? "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              : "text-amber-300/70 hover:bg-black/30 hover:text-amber-200",
          )}
        >
          <SkipForward className="mr-1 h-4 w-4" />
          {complete ? "마무리로 이동" : "지금 마무리하기"}
        </Button>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. 훈련 후 감정 기록
// ─────────────────────────────────────────────────────────────

function ReflectionStep({
  value,
  closingDeclaration,
  onChange,
  onSave,
  onBack,
  canSave,
}: {
  value: string;
  closingDeclaration: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onBack: () => void;
  canSave: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">
          STEP 5 · 감정 기록
        </p>
        <h2 className="text-xl font-black text-amber-50">
          오늘 가장 복싱인 같았던 순간을
          <br />한 줄로 남겨 보세요.
        </h2>
        <p className="text-[11px] text-amber-200/60">
          비워 두어도 저장됩니다.
        </p>
      </header>

      <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="예) 두 번째 세트에서 손이 내려갔는데, 스스로 다시 올린 순간."
          className="min-h-[160px] resize-none border-0 bg-transparent text-[13px] leading-relaxed text-amber-50 placeholder:text-amber-200/30 focus-visible:ring-0"
          maxLength={500}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-amber-200/40">
          {value.length} / 500
        </p>
      </div>

      <div className="rounded-xl border-l-2 border-rose-500/60 bg-rose-950/15 px-4 py-3">
        <p className="whitespace-pre-line text-[11px] leading-relaxed text-rose-100/80">
          {closingDeclaration}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-11 flex-1 rounded-xl border-amber-500/20 bg-black/30 text-amber-200 hover:bg-black/50"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          이전
        </Button>
        <Button
          onClick={onSave}
          disabled={!canSave}
          className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="mr-1 h-4 w-4" />
          저장하기
        </Button>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. 저장 완료
// ─────────────────────────────────────────────────────────────

function SavedScreen({
  onAgain,
  onClose,
}: {
  onAgain: () => void;
  onClose?: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-7 pt-8 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10">
        <Sparkles className="h-7 w-7 text-amber-300" />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/70">
          SAVED
        </p>
        <h2 className="text-2xl font-black leading-tight text-amber-50">
          오늘의 153마인드셋이
          <br />
          저장되었습니다.
        </h2>
      </div>

      <p className="whitespace-pre-line text-[13px] leading-relaxed text-amber-100/85">
        당신은 오늘도 153복싱짐으로 돌아왔습니다.
        {"\n"}이 기록은 단순한 메모가 아니라,
        {"\n"}복싱인이 되어가는 마음의 증거입니다.
      </p>

      <div className="rounded-xl border-l-2 border-rose-500/60 bg-rose-950/15 px-4 py-3 text-left">
        <p className="text-[11px] leading-relaxed text-rose-100/80">
          복싱은 강해지는 시간이기도 하지만,
          <br />
          나를 다시 좋아하게 되는 시간이기도 합니다.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          onClick={onAgain}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          새 마인드셋 시작
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-11 w-full rounded-xl text-amber-300/70 hover:bg-black/30 hover:text-amber-200"
          >
            오늘은 여기까지
          </Button>
        )}
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────
// 공용 — 카드형 선택지 / 네비 버튼
// ─────────────────────────────────────────────────────────────

function SelectableCard({
  active,
  onClick,
  children,
  indicator,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  indicator?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.99]",
        active
          ? "border-amber-400/60 bg-gradient-to-r from-amber-500/15 to-amber-400/5 text-amber-50 shadow-[0_0_0_1px_rgba(253,184,92,0.2)_inset]"
          : "border-amber-200/10 bg-black/30 text-amber-100/85 hover:border-amber-200/25 hover:bg-black/40",
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-amber-400 text-amber-950"
            : "border border-amber-200/15 bg-black/40 text-amber-200/40",
        )}
      >
        {indicator ?? (active ? <Check className="h-3.5 w-3.5" /> : null)}
      </div>
    </button>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "다음",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <Button
        variant="outline"
        onClick={onBack}
        className="h-11 flex-1 rounded-xl border-amber-500/20 bg-black/30 text-amber-200 hover:bg-black/50"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        이전
      </Button>
      <Button
        onClick={onNext}
        disabled={nextDisabled}
        className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-40"
      >
        {nextLabel}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

export default MyBoxerVisualizationSession;
