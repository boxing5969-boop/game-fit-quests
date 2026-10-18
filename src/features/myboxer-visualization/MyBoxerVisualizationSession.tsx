/**
 * 153마인드셋 — 세션 화면 (2026-10-19 전면 개편)
 *
 * 흐름: 시작 화면(설명 · 길이 · 소리 설정) → 지금 기분 한 번 → 몰입 재생기(눈을 감고 듣는다) → 끝난 뒤 체크(또렷함 · 조절감 · 기분 · 한 줄) → 마무리(이번 주 목표 · 변화)
 *
 * 벤치마킹(Headspace · Calm · Insight Timer · Breathwrk · Open · 스포츠 심상 앱)에서 가져온 것
 *   · 눈을 감고 따라가는 소리 중심 — 목소리 + 배경 소리(따로 크기 조절) + 공 소리 + 호흡 소리·진동
 *   · 숨 쉬는 원(커지면 들숨, 작아지면 날숨) · 화면 어둡게 · 화면 꺼짐 막기
 *   · 시작 전 기분 / 끝난 뒤 기분·또렷함(심상 능력) — 변화가 쌓여 보인다
 *   · 일주일 3번 목표(연구: 주 3회 안팎이 가장 효과적) — 매일 못 해도 혼내지 않는다
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Moon,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CATEGORY_LABEL,
  MOOD_SCALE,
  type MindSession,
} from "./visualizationContent";
import {
  SOUNDSCAPE_LABEL,
  pickKoreanVoice,
  setAmbientVolume,
  speak,
  unlockAudio,
  type Soundscape,
} from "./mindAudio";
import { estimateMinutes, useMindPlayer, type MindVars } from "./useMindPlayer";
import { useLogMindsetSession, type MindsetStats } from "@/services/mindsetService";

// ─────────────────────────────────────────────────────────────
// 소리 설정 — 이 기기에 기억
// ─────────────────────────────────────────────────────────────

const PREF_KEY = "myboxer.mindset.prefs";
interface Prefs {
  voiceOn: boolean;
  rate: number;
  /** null = 세션마다 정해진 배경 소리 */
  scape: Soundscape | null;
  ambient: number;
}
const DEFAULT_PREFS: Prefs = { voiceOn: true, rate: 0.95, scape: null, ambient: 0.7 };
const loadPrefs = (): Prefs => {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};
const savePrefs = (p: Prefs) => {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* 무시 */
  }
};

const RATES: Array<{ v: number; label: string }> = [
  { v: 0.85, label: "느리게" },
  { v: 0.95, label: "보통" },
  { v: 1.05, label: "빠르게" },
];
const SCAPES: Soundscape[] = ["gym", "rain", "heartbeat", "off"];

const VIVID: string[] = ["흐릿했어요", "조금 보였어요", "보통", "또렷했어요", "실제 같았어요"];
const CONTROL: string[] = ["잘 안 됐어요", "조금", "보통", "꽤 됐어요", "마음대로 됐어요"];

const NOTE_HINT: Record<string, string> = {
  pre: "예) 오늘은 손이 내려가면 내가 먼저 올린다",
  skill: "예) 투를 칠 때 뒤꿈치가 들리는 느낌이 선명했다",
  fight: "예) 맞았을 때 숨부터 내쉬는 장면이 잘 그려졌다",
  pb: "예) 푸시업 구간에서 미리 끊어 쉬는 계획",
  reset: "예) 다음엔 거리가 가까워지면 먼저 잽",
  breath: "예) 두 바퀴째부터 심장이 가라앉았다",
  recover: "예) 오늘 가장 복싱인 같았던 순간",
  future: "예) 1년 뒤의 나는 웃고 있었다",
};

const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

type Step = "intro" | "checkin" | "player" | "post" | "done";

export interface MyBoxerVisualizationSessionProps {
  session: MindSession;
  vars: MindVars;
  onClose: () => void;
}

const MyBoxerVisualizationSession = ({ session, vars, onClose }: MyBoxerVisualizationSessionProps) => {
  const [step, setStep] = useState<Step>("intro");
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [variantKey, setVariantKey] = useState<string>(session.variants?.[0]?.key ?? "base");
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [vividness, setVividness] = useState<number | null>(null);
  const [control, setControl] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [playedSec, setPlayedSec] = useState(0);
  const [result, setResult] = useState<MindsetStats | null>(null);
  const logMut = useLogMindsetSession();

  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  const variant = session.variants?.find((v) => v.key === variantKey) ?? null;
  const cues = variant?.cues ?? session.cues;
  const minutes = useMemo(() => estimateMinutes(cues, vars, prefs.rate), [cues, vars, prefs.rate]);
  const variantMinutes = useMemo(
    () => Object.fromEntries((session.variants ?? []).map((v) => [v.key, estimateMinutes(v.cues, vars, prefs.rate)])),
    [session.variants, vars, prefs.rate],
  );
  const scape: Soundscape = prefs.scape ?? session.soundscape;

  useEffect(() => setAmbientVolume(prefs.ambient), [prefs.ambient]);

  const player = useMindPlayer({
    cues,
    vars,
    voiceOn: prefs.voiceOn,
    rate: prefs.rate,
    soundscape: scape,
    onDone: (sec) => {
      setPlayedSec(sec);
      window.setTimeout(() => setStep("post"), 1400);
    },
  });

  const begin = () => {
    unlockAudio();
    setStep("checkin");
  };

  const startPlaying = (mood: number | null) => {
    setMoodBefore(mood);
    unlockAudio();
    setStep("player");
    void player.play();
  };

  const save = async () => {
    const completed = playedSec >= player.state.total * 0.6;
    try {
      const st = await logMut.mutateAsync({
        sessionId: session.id,
        durationSec: playedSec,
        completed,
        moodBefore,
        moodAfter,
        vividness,
        control,
        note,
        closing: session.closing,
      });
      setResult(st);
      setStep("done");
    } catch {
      toast.error("기록을 남기지 못했어요. 잠시 후 다시 눌러 주세요");
    }
  };

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden text-amber-50"
      style={{ background: "linear-gradient(180deg, #070b1a 0%, #0c1328 55%, #070b1a 100%)" }}
    >
      <Glow tint={session.tint} />
      <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-28 pt-6">
        <AnimatePresence mode="wait">
          {step === "intro" && (
            <IntroStep
              key="intro"
              session={session}
              minutes={minutes}
              variantMinutes={variantMinutes}
              variantKey={variantKey}
              onVariant={setVariantKey}
              prefs={prefs}
              onPrefs={updatePrefs}
              scape={scape}
              onStart={begin}
              onClose={onClose}
            />
          )}
          {step === "checkin" && (
            <CheckinStep key="checkin" onPick={(v) => startPlaying(v)} onSkip={() => startPlaying(null)} onBack={() => setStep("intro")} />
          )}
          {step === "post" && (
            <PostStep
              key="post"
              session={session}
              early={playedSec < player.state.total * 0.6}
              moodBefore={moodBefore}
              moodAfter={moodAfter}
              onMoodAfter={setMoodAfter}
              vividness={vividness}
              onVividness={setVividness}
              control={control}
              onControl={setControl}
              note={note}
              onNote={setNote}
              saving={logMut.isPending}
              onSave={save}
            />
          )}
          {step === "done" && (
            <DoneStep
              key="done"
              session={session}
              stats={result}
              moodBefore={moodBefore}
              moodAfter={moodAfter}
              playedSec={playedSec}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </div>

      {step === "player" && (
        <PlayerOverlay
          session={session}
          state={player.state}
          prefs={prefs}
          scape={scape}
          onPause={player.pause}
          onPlay={() => {
            unlockAudio();
            void player.play();
          }}
          onFinish={player.finish}
          onVoice={() => updatePrefs({ voiceOn: !prefs.voiceOn })}
          onScape={() => {
            const next = SCAPES[(SCAPES.indexOf(scape) + 1) % SCAPES.length];
            updatePrefs({ scape: next });
            player.changeSoundscape(next);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 배경 빛
// ─────────────────────────────────────────────────────────────

function Glow({ tint }: { tint: [string, string] }) {
  return (
    <>
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${tint[0]} 0%, transparent 70%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-[-120px] h-[380px] w-[380px] rounded-full opacity-15 blur-3xl"
        style={{ background: `radial-gradient(circle, ${tint[1]} 0%, transparent 70%)` }}
        aria-hidden
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. 시작 화면
// ─────────────────────────────────────────────────────────────

function IntroStep({
  session,
  minutes,
  variantMinutes,
  variantKey,
  onVariant,
  prefs,
  onPrefs,
  scape,
  onStart,
  onClose,
}: {
  session: MindSession;
  minutes: number;
  variantMinutes: Record<string, number>;
  variantKey: string;
  onVariant: (k: string) => void;
  prefs: Prefs;
  onPrefs: (p: Partial<Prefs>) => void;
  scape: Soundscape;
  onStart: () => void;
  onClose: () => void;
}) {
  const [hasVoice, setHasVoice] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void pickKoreanVoice().then((v) => alive && setHasVoice(!!v));
    return () => {
      alive = false;
    };
  }, []);

  const tryVoice = async () => {
    unlockAudio();
    const v = await pickKoreanVoice();
    setHasVoice(!!v);
    speak("천천히 눈을 감습니다. 이 목소리로 안내할게요.", { enabled: true, voice: v, rate: prefs.rate });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-amber-200/20 bg-black/30 px-3 py-1 text-[11px] font-bold tracking-wide text-amber-200/80">
          {CATEGORY_LABEL[session.category]}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-full border border-amber-200/15 bg-black/30 p-2 text-amber-100/70 active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <header className="space-y-2 text-center">
        <OrbPreview tint={session.tint} />
        <h1 className="text-[28px] font-black leading-tight [text-wrap:balance]">{session.title}</h1>
        <p className="text-[13px] text-amber-100/70">{session.tagline}</p>
        <p className="text-[11.5px] text-amber-200/55">
          약 {minutes}분 · {session.when}
        </p>
      </header>

      <p className="whitespace-pre-line rounded-2xl border border-amber-200/10 bg-black/25 p-4 text-[13.5px] leading-relaxed text-amber-50/90">
        {session.intro}
      </p>

      {session.variants && (
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-wide text-amber-200/60">길이</p>
          <div className="flex gap-2">
            {session.variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => onVariant(v.key)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold transition-colors active:scale-[0.98]",
                  v.key === variantKey
                    ? "border-amber-300/70 bg-amber-400/15 text-amber-50"
                    : "border-amber-200/10 bg-black/25 text-amber-100/60",
                )}
              >
                {v.label} · {variantMinutes[v.key] ?? v.minutes}분
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {session.tips.slice(0, 3).map((text, i) => (
          <div key={i} className="min-w-0 rounded-2xl border border-amber-200/10 bg-black/25 p-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-[11px] font-black text-amber-300">
              {i + 1}
            </span>
            <p className="mt-1.5 text-[11.5px] leading-snug text-amber-100/80">{text}</p>
          </div>
        ))}
      </div>

      {/* 소리 설정 */}
      <div className="space-y-3 rounded-2xl border border-amber-200/10 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold">목소리 안내</p>
            <p className="text-[11px] text-amber-200/55">
              {hasVoice === false ? "이 기기에 한국어 음성이 없어 자막으로 진행돼요" : "끄면 자막만 보고 따라가요"}
            </p>
          </div>
          <Toggle on={prefs.voiceOn} onClick={() => onPrefs({ voiceOn: !prefs.voiceOn })} label="목소리 안내" />
        </div>
        {prefs.voiceOn && (
          <div className="flex items-center gap-2">
            {RATES.map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => onPrefs({ rate: r.v })}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] font-bold",
                  prefs.rate === r.v ? "border-amber-300/60 bg-amber-400/15 text-amber-50" : "border-amber-200/10 text-amber-100/55",
                )}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              onClick={tryVoice}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200/20 px-3 py-1 text-[11.5px] font-bold text-amber-100/80 active:scale-95"
            >
              <Volume2 className="h-3.5 w-3.5" />
              들어보기
            </button>
          </div>
        )}
        {hasVoice === false && prefs.voiceOn && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/75">
            휴대폰 설정 → 텍스트 음성 변환(TTS)에서 한국어 음성을 받으면 목소리로 들을 수 있어요.
          </p>
        )}
        <div className="h-px bg-amber-200/10" />
        <div>
          <p className="text-[13px] font-bold">배경 소리</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCAPES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onPrefs({ scape: k })}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] font-bold",
                  scape === k ? "border-amber-300/60 bg-amber-400/15 text-amber-50" : "border-amber-200/10 text-amber-100/55",
                )}
              >
                {SOUNDSCAPE_LABEL[k]}
              </button>
            ))}
          </div>
          {scape !== "off" && (
            <label className="mt-3 flex items-center gap-3 text-[11px] text-amber-200/60">
              <Waves className="h-3.5 w-3.5 shrink-0" />
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={prefs.ambient}
                onChange={(e) => onPrefs({ ambient: Number(e.target.value) })}
                aria-label="배경 소리 크기"
                className="h-1 w-full accent-amber-400"
              />
            </label>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-l-2 border-amber-400/60 bg-amber-500/5 px-4 py-3">
        <p className="text-[11px] font-bold tracking-wide text-amber-300/80">왜 효과가 있나요</p>
        <p className="mt-1 text-[12px] leading-relaxed text-amber-100/80">{session.why}</p>
      </div>

      <button
        type="button"
        data-tour="mindset-start-button"
        onClick={onStart}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-black tracking-wide text-[#1a1206] shadow-[0_0_30px_rgba(253,184,92,0.35)] active:scale-[0.98]"
        style={{ background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }}
      >
        시작하기
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.section>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-amber-400" : "bg-white/15")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

function OrbPreview({ tint }: { tint: [string, string] }) {
  return (
    <div className="relative mx-auto mb-3 h-28 w-28">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${tint[0]}88 0%, transparent 70%)` }}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff7e6 0%, ${tint[0]} 45%, ${tint[1]} 100%)` }}
        animate={{ scale: [0.94, 1.06, 0.94] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. 지금 기분
// ─────────────────────────────────────────────────────────────

function CheckinStep({ onPick, onSkip, onBack }: { onPick: (v: number) => void; onSkip: () => void; onBack: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="flex min-h-[70dvh] flex-col justify-center space-y-6 text-center"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-bold tracking-[0.3em] text-amber-300/70">CHECK-IN</p>
        <h2 className="text-2xl font-black">지금 기분은 어때요?</h2>
        <p className="text-[12px] text-amber-200/60">누르면 바로 시작해요. 이어폰을 끼고 눈을 감을 준비를 해요.</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {MOOD_SCALE.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => onPick(m.v)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-amber-200/10 bg-black/30 px-1 py-4 active:scale-95"
          >
            <MoodDot v={m.v} />
            <span className="text-[11px] font-bold leading-tight text-amber-100/85">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-4 text-[12px] font-bold text-amber-200/55">
        <button type="button" onClick={onBack} className="active:opacity-60">
          이전
        </button>
        <button type="button" onClick={onSkip} className="active:opacity-60">
          건너뛰고 시작
        </button>
      </div>
    </motion.section>
  );
}

/** 기분 점 — 1(낮음·파랑) → 5(높음·주황) */
function MoodDot({ v, size = 26 }: { v: number; size?: number }) {
  const colors = ["#64748b", "#818cf8", "#a3a3a3", "#34d399", "#f59e0b"];
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, #ffffffcc 0%, ${colors[v - 1]} 55%)`,
        boxShadow: `0 0 ${8 + v * 3}px ${colors[v - 1]}88`,
      }}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 몰입 재생기
// ─────────────────────────────────────────────────────────────

function PlayerOverlay({
  session,
  state,
  prefs,
  scape,
  onPause,
  onPlay,
  onFinish,
  onVoice,
  onScape,
}: {
  session: MindSession;
  state: ReturnType<typeof useMindPlayer>["state"];
  prefs: Prefs;
  scape: Soundscape;
  onPause: () => void;
  onPlay: () => void;
  onFinish: () => void;
  onVoice: () => void;
  onScape: () => void;
}) {
  const [dim, setDim] = useState(false);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(t);
  }, []);

  const remaining = Math.max(0, state.total - state.elapsed);
  const pct = state.total > 0 ? Math.min(1, state.elapsed / state.total) : 0;
  const playing = state.status === "playing";

  return (
    <div
      data-tour="mindset-player"
      className="fixed inset-0 z-[90] flex flex-col text-amber-50"
      style={{
        background: `radial-gradient(120% 80% at 50% 38%, ${session.tint[1]}33 0%, #060914 55%, #04060d 100%)`,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* 위 — 장면 · 남은 시간 · 끝내기 */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-amber-300/75">{session.title}</p>
          <p className="truncate text-[13px] font-bold text-amber-50/85">{state.chapter || " "}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] tabular-nums text-amber-200/60">-{fmtClock(remaining)}</span>
          <button
            type="button"
            onClick={onFinish}
            aria-label="여기서 끝내기"
            className="rounded-full border border-amber-200/15 bg-black/30 p-2 text-amber-100/70 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 가운데 — 숨 쉬는 원 + 자막 */}
      <button
        type="button"
        onClick={() => setDim(false)}
        className="relative flex flex-1 flex-col items-center justify-center px-6"
        aria-label="화면"
      >
        <Orb state={state} tint={session.tint} pct={pct} />
        <div className="mt-10 flex min-h-[96px] w-full items-start justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${state.cueIndex}-${state.caption}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45 }}
              className={cn(
                "max-w-[22rem] text-center leading-relaxed [text-wrap:balance]",
                state.captionKind === "call" && "text-[44px] font-black tracking-tight text-white",
                state.captionKind === "breath" && "text-[26px] font-black text-white",
                state.captionKind === "say" && "text-[18px] font-bold text-amber-50/95",
                state.captionKind === "quiet" && "text-[15px] font-semibold italic text-amber-200/60",
                state.captionKind === "bell" && "text-[20px] font-black tracking-[0.2em] text-amber-300",
              )}
            >
              {state.caption}
            </motion.p>
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {hint && playing && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-4 text-[11.5px] font-semibold text-amber-200/45"
            >
              눈을 감고 소리를 따라가요
            </motion.p>
          )}
        </AnimatePresence>
      </button>

      {/* 아래 — 조작 */}
      <div className="flex items-center justify-center gap-5 px-6 pb-8 pt-2">
        <RoundIcon label={prefs.voiceOn ? "목소리 끄기" : "목소리 켜기"} onClick={onVoice}>
          {prefs.voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </RoundIcon>
        <RoundIcon label={`배경 소리: ${SOUNDSCAPE_LABEL[scape]}`} onClick={onScape}>
          <Waves className={cn("h-5 w-5", scape === "off" && "opacity-40")} />
        </RoundIcon>
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          aria-label={playing ? "잠깐 멈추기" : "이어서 듣기"}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[#1a1206] shadow-[0_0_30px_rgba(253,184,92,0.35)] active:scale-95"
          style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b)" }}
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
        </button>
        <RoundIcon label="화면 어둡게" onClick={() => setDim(true)}>
          <Moon className="h-5 w-5" />
        </RoundIcon>
        <RoundIcon label="여기서 끝내기" onClick={onFinish}>
          <Check className="h-5 w-5" />
        </RoundIcon>
      </div>
      <p className="pb-4 text-center text-[11px] text-amber-200/40">{SOUNDSCAPE_LABEL[scape]}</p>

      {/* 화면 어둡게 — 눌러서 다시 밝게 */}
      <AnimatePresence>
        {dim && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDim(false)}
            aria-label="화면 다시 밝게"
            className="absolute inset-0 z-10 flex items-end justify-center bg-black/95 pb-16"
          >
            <span className="text-[11px] font-semibold text-white/25">눌러서 다시 밝게</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoundIcon({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/15 bg-white/5 text-amber-100/80 active:scale-95"
    >
      {children}
    </button>
  );
}

/** 숨 쉬는 원 — 호흡이면 커지고 작아지고, 구령이면 '퍽' 하고, 그 밖에는 천천히 숨 쉰다. 바깥 고리 = 진행 */
function Orb({ state, tint, pct }: { state: ReturnType<typeof useMindPlayer>["state"]; tint: [string, string]; pct: number }) {
  const R = 132;
  const C = 2 * Math.PI * R;
  const b = state.breath;
  const target = b ? (b.phase === "in" || b.phase === "hold" ? 1.32 : 0.86) : 1;
  const breathAnim = b
    ? { scale: target, transition: { duration: b.phase === "in" || b.phase === "out" ? b.sec : 0.3, ease: "easeInOut" as const } }
    : state.captionKind === "call"
      ? { scale: [1, 1.14, 1], transition: { duration: 0.32 } }
      : { scale: [1, 1.05, 1], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <div className="relative h-[300px] w-[300px]">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 300 300" aria-hidden>
        <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(253,230,138,0.10)" strokeWidth="3" />
        <circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke={tint[0]}
          strokeOpacity={pct > 0.005 ? 0.85 : 0}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s linear" }}
        />
      </svg>
      <motion.div
        key={b ? `b-${b.key}` : state.captionKind === "call" ? `c-${state.cueIndex}-${state.caption}` : "idle"}
        className="absolute inset-[56px] rounded-full"
        animate={breathAnim}
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff7e6 0%, ${tint[0]} 42%, ${tint[1]} 100%)`,
          boxShadow: `0 0 60px ${tint[0]}66, 0 0 120px ${tint[1]}44`,
        }}
      />
      {state.captionKind === "bell" && (
        <motion.div
          className="absolute inset-[30px] rounded-full border-2"
          style={{ borderColor: tint[0] }}
          initial={{ opacity: 0.9, scale: 0.9 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 1.2, repeat: 2 }}
        />
      )}
      {b && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold tabular-nums text-[#1a1206]/70">
          <BreathCount key={b.key} sec={b.sec} />
        </span>
      )}
    </div>
  );
}

function BreathCount({ sec }: { sec: number }) {
  const [n, setN] = useState(sec);
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => Math.max(1, x - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{n}</>;
}

// ─────────────────────────────────────────────────────────────
// 4. 끝난 뒤 체크
// ─────────────────────────────────────────────────────────────

function PostStep({
  session,
  early,
  moodBefore,
  moodAfter,
  onMoodAfter,
  vividness,
  onVividness,
  control,
  onControl,
  note,
  onNote,
  saving,
  onSave,
}: {
  session: MindSession;
  early: boolean;
  moodBefore: number | null;
  moodAfter: number | null;
  onMoodAfter: (v: number) => void;
  vividness: number | null;
  onVividness: (v: number) => void;
  control: number | null;
  onControl: (v: number) => void;
  note: string;
  onNote: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <motion.section
      data-tour="mindset-reflection"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <header className="space-y-1 pt-4">
        <p className="text-[11px] font-bold tracking-[0.3em] text-amber-300/70">AFTER</p>
        <h2 className="text-2xl font-black leading-tight">수고했어요. 어땠나요?</h2>
        <p className="text-[12px] text-amber-200/60">
          {early ? "끝까지 못 해도 괜찮아요. 오늘 한 만큼이 기록이에요." : "10초면 끝나요. 쌓이면 내 마음 근육이 보여요."}
        </p>
      </header>

      <Scale title="장면이 얼마나 또렷했나요?" labels={VIVID} value={vividness} onChange={onVividness} />
      <Scale title="원하는 대로 그려졌나요?" labels={CONTROL} value={control} onChange={onControl} />

      <div>
        <p className="text-[13px] font-bold">지금 기분은요?</p>
        {moodBefore && (
          <p className="mt-0.5 text-[11px] text-amber-200/55">시작할 때: {MOOD_SCALE[moodBefore - 1].label}</p>
        )}
        <div className="mt-2 grid grid-cols-5 gap-2">
          {MOOD_SCALE.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => onMoodAfter(m.v)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 active:scale-95",
                moodAfter === m.v ? "border-amber-300/70 bg-amber-400/15" : "border-amber-200/10 bg-black/25",
              )}
            >
              <MoodDot v={m.v} size={20} />
              <span className="text-[10.5px] font-bold leading-tight text-amber-100/85">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold">한 줄 남기기 <span className="font-normal text-amber-200/50">(나만 봐요 · 비워도 돼요)</span></p>
        <div className="mt-2 rounded-2xl border border-amber-200/10 bg-black/30 p-2">
          <Textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={NOTE_HINT[session.category] ?? "오늘 떠올린 장면 한 줄"}
            maxLength={300}
            className="min-h-[88px] resize-none border-0 bg-transparent text-[13px] leading-relaxed text-amber-50 placeholder:text-amber-200/30 focus-visible:ring-0"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-black text-[#1a1206] active:scale-[0.98] disabled:opacity-60"
        style={{ background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }}
      >
        <Check className="h-5 w-5" />
        {saving ? "남기는 중…" : "기록 남기기"}
      </button>
    </motion.section>
  );
}

function Scale({
  title,
  labels,
  value,
  onChange,
}: {
  title: string;
  labels: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold">{title}</p>
        <p className="text-[11px] font-bold text-amber-300/80">{value ? labels[value - 1] : ""}</p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={`${title} ${v}점 — ${labels[v - 1]}`}
            className={cn(
              "h-11 rounded-xl border text-[15px] font-black tabular-nums transition-colors active:scale-95",
              value != null && v <= value
                ? "border-amber-300/60 bg-gradient-to-b from-amber-300/30 to-amber-500/10 text-amber-50"
                : "border-amber-200/10 bg-black/25 text-amber-100/45",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-amber-200/40">
        <span>{labels[0]}</span>
        <span>{labels[4]}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 마무리
// ─────────────────────────────────────────────────────────────

const WEEK_GOAL = 3;

function DoneStep({
  session,
  stats,
  moodBefore,
  moodAfter,
  playedSec,
  onClose,
}: {
  session: MindSession;
  stats: MindsetStats | null;
  moodBefore: number | null;
  moodAfter: number | null;
  playedSec: number;
  onClose: () => void;
}) {
  const week = stats?.week_count ?? 1;
  const ring = Math.min(1, week / WEEK_GOAL);
  const R = 54;
  const C = 2 * Math.PI * R;
  const trend = stats && stats.rated >= 3 && stats.vivid_first > 0 ? { from: stats.vivid_first, to: stats.vivid_recent } : null;

  const headline = useMemo(() => {
    if (week >= WEEK_GOAL) return week === WEEK_GOAL ? "이번 주 목표 달성!" : `이번 주 ${week}번째 — 목표를 넘었어요`;
    return `이번 주 ${week}번째 라운드`;
  }, [week]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pt-6 text-center"
    >
      <div className="relative mx-auto h-36 w-36">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(253,230,138,0.12)" strokeWidth="8" />
          <motion.circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke={session.tint[0]}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - ring) }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[34px] font-black tabular-nums leading-none">
            {Math.min(week, 99)}
            <span className="text-[16px] text-amber-200/50">/{WEEK_GOAL}</span>
          </span>
          <span className="mt-1 text-[10px] font-bold tracking-widest text-amber-200/60">이번 주</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-black">{headline}</h2>
        <p className="text-[12.5px] text-amber-200/65">
          {Math.max(1, Math.round(playedSec / 60))}분 · {session.title}
          {stats && stats.streak >= 2 ? ` · ${stats.streak}일 연속` : ""}
        </p>
      </div>

      {(moodBefore && moodAfter) || trend ? (
        <div className="grid grid-cols-2 gap-2 text-left">
          {moodBefore && moodAfter ? (
            <div className="rounded-2xl border border-amber-200/10 bg-black/25 p-3">
              <p className="text-[10.5px] font-bold text-amber-200/55">기분</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-bold">
                <MoodDot v={moodBefore} size={14} />
                {MOOD_SCALE[moodBefore - 1].label}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-amber-50">
                <ArrowRight className="h-3 w-3 text-amber-300" />
                <MoodDot v={moodAfter} size={14} />
                {MOOD_SCALE[moodAfter - 1].label}
              </p>
            </div>
          ) : (
            <div />
          )}
          {trend ? (
            <div className="rounded-2xl border border-amber-200/10 bg-black/25 p-3">
              <p className="text-[10.5px] font-bold text-amber-200/55">또렷함 (처음 → 요즘)</p>
              <p className="mt-1 text-[22px] font-black tabular-nums">
                {trend.from.toFixed(1)}
                <span className="mx-1 text-[14px] text-amber-300">→</span>
                {trend.to.toFixed(1)}
              </p>
            </div>
          ) : (
            <div />
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border-l-2 px-4 py-3 text-left" style={{ borderColor: session.tint[0], background: "rgba(0,0,0,0.25)" }}>
        <Sparkles className="mb-1 h-4 w-4 text-amber-300" />
        <p className="whitespace-pre-line text-[13px] font-bold leading-relaxed text-amber-50/90">{session.closing}</p>
      </div>

      {stats?.local && (
        <p className="text-[11px] text-amber-200/45">인터넷이 불안해서 이 기기에만 먼저 남겼어요.</p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-black text-[#1a1206] active:scale-[0.98]"
        style={{ background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }}
      >
        다른 세션 보기
      </button>
    </motion.section>
  );
}

export default MyBoxerVisualizationSession;
