/**
 * 🥊 복싱 타이머 — 회원님 자율 운동용 라운드 타이머 (2026-11-22 대표님 「회원님들 자율운동할때 사용할수있는 타이머 · 소리는 최대한 크게」)
 *
 *   · 여는 곳: 훈련 탭 「오늘 할 것」 「복싱 타이머」 줄(BoxingTimerEntry) · 전체 메뉴 훈련 도구 › 복싱 타이머 · 기능 검색 — 주소 `/missions?timer=1`
 *   · 고르기 화면: 자주 쓰는 틀 4개 · 라운드 시간 · 쉬는 시간 · 라운드 수(무제한) · 준비 · 10초 전 딱딱이 · 소리 시험 → 「시작」
 *     고른 값은 이 기기에 기억(`153timer:settings`).
 *   · 달리는 화면: 아주 큰 남은 시간 · 지금 구간(준비 · n라운드 · 마지막 라운드 · 쉬는 시간) · 라운드 점 · 멈춤/계속 · 처음부터 · 건너뛰기
 *     라운드 마지막 10초는 빨간 숫자 · 쉬는 시간은 주황.
 *   · 소리는 lib/loudBell(압축 + 키우기 — 최대한 크게) · 진동(안드로이드) · 화면 꺼짐 막기 · 시계로 세서 화면을 껐다 켜도 맞음.
 *   흰 바탕 · 글씨 6단계 이름만(큰 시계 숫자만 예외).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { buzz, keepScreenOn } from "@/features/myboxer-visualization/mindAudio";
import { loudBeep, loudBell, loudClapper, releaseLoud, resumeLoud, unlockLoud } from "@/lib/loudBell";
import {
  DEFAULT_TIMER,
  PREP_CHOICES,
  REST_MAX,
  REST_MIN,
  REST_STEP,
  ROUNDS_MAX,
  ROUND_MAX,
  ROUND_MIN,
  ROUND_STEP,
  TIMER_PRESETS,
  WARN_AT_SEC,
  clockText,
  cuesToPlay,
  durationText,
  nextPhaseStart,
  normalizeTimer,
  phaseAt,
  phaseLabel,
  presetOf,
  roundsText,
  settingsLine,
  totalMs,
  type Cue,
  type TimerSettings,
} from "@/lib/boxingTimer";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import { seqLabel } from "@/lib/sparringVideo";
import { SPARVID_KEY, endMatch, type MatchStarted } from "@/services/sparringVideoService";
import SparringRecorderPanel from "@/components/sparring/SparringRecorderPanel";

const STORE_KEY = "153timer:settings";

function loadSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? normalizeTimer(JSON.parse(raw)) : DEFAULT_TIMER;
  } catch {
    return DEFAULT_TIMER;
  }
}
function saveSettings(s: TimerSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* 저장 못 하는 기기 */
  }
}

function playCue(c: Cue): void {
  if (c.kind === "roundStart") {
    loudBell(1);
    buzz(500);
  } else if (c.kind === "roundEnd") {
    loudBell(3);
    buzz([300, 120, 300, 120, 300]);
  } else if (c.kind === "finish") {
    loudBell(3, true);
    buzz([400, 150, 400, 150, 600]);
  } else if (c.kind === "warn") {
    loudClapper();
    buzz([90, 70, 90, 70, 90]);
  } else {
    loudBeep();
    buzz(120);
  }
}

// ─────────────────────────────────────────────────────────────
// 고르기 화면
// ─────────────────────────────────────────────────────────────

const Stepper = ({
  label,
  value,
  onMinus,
  onPlus,
  minusOff,
  plusOff,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusOff: boolean;
  plusOff: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
    <span className="text-body font-bold text-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMinus}
        disabled={minusOff}
        aria-label={`${label} 줄이기`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground transition-all active:scale-95 disabled:opacity-30"
      >
        <Minus className="h-5 w-5" />
      </button>
      <span className="number-font min-w-[5.5rem] text-center text-heading text-foreground">{value}</span>
      <button
        type="button"
        onClick={onPlus}
        disabled={plusOff}
        aria-label={`${label} 늘리기`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground transition-all active:scale-95 disabled:opacity-30"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  </div>
);

const Setup = ({ s, set, onStart }: { s: TimerSettings; set: (s: TimerSettings) => void; onStart: () => void }) => {
  const active = presetOf(s);
  const patch = (p: Partial<TimerSettings>) => set(normalizeTimer({ ...s, ...p }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {TIMER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patch(p.s)}
              aria-pressed={active === p.id}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.98]",
                active === p.id ? "border-primary bg-primary/10" : "border-border bg-card",
              )}
            >
              <p className="text-body font-bold text-foreground">{p.name}</p>
              <p className="text-label text-muted-foreground">{p.sub}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Stepper
            label="라운드 시간"
            value={durationText(s.roundSec)}
            onMinus={() => patch({ roundSec: s.roundSec - ROUND_STEP })}
            onPlus={() => patch({ roundSec: s.roundSec + ROUND_STEP })}
            minusOff={s.roundSec <= ROUND_MIN}
            plusOff={s.roundSec >= ROUND_MAX}
          />
          <Stepper
            label="쉬는 시간"
            value={durationText(s.restSec)}
            onMinus={() => patch({ restSec: s.restSec - REST_STEP })}
            onPlus={() => patch({ restSec: s.restSec + REST_STEP })}
            minusOff={s.restSec <= REST_MIN}
            plusOff={s.restSec >= REST_MAX}
          />
          <Stepper
            label="라운드 수"
            value={roundsText(s.rounds)}
            onMinus={() => patch({ rounds: s.rounds <= 0 ? ROUNDS_MAX : s.rounds - 1 })}
            onPlus={() => patch({ rounds: s.rounds <= 0 ? 1 : s.rounds >= ROUNDS_MAX ? 0 : s.rounds + 1 })}
            minusOff={s.rounds === 1}
            plusOff={s.rounds === 0}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="mb-2 text-body font-bold text-foreground">시작 전 준비</p>
          <div className="grid grid-cols-3 gap-2">
            {PREP_CHOICES.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => patch({ prepSec: sec })}
                aria-pressed={s.prepSec === sec}
                className={cn(
                  "h-11 rounded-xl text-body font-bold transition-all active:scale-95",
                  s.prepSec === sec ? "bg-foreground text-background" : "bg-secondary text-foreground",
                )}
              >
                {sec === 0 ? "바로" : `${sec}초`}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => patch({ warn10: !s.warn10 })}
          aria-pressed={s.warn10}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
        >
          <span>
            <span className="block text-body font-bold text-foreground">라운드 {WARN_AT_SEC}초 전 「딱딱」</span>
            <span className="block text-label text-muted-foreground">끝나기 전에 마지막 힘을 내요</span>
          </span>
          <span
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              s.warn10 ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
                s.warn10 ? "left-[1.375rem]" : "left-0.5",
              )}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            unlockLoud();
            loudBell(1);
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-body font-bold text-foreground transition-all active:scale-[0.99]"
        >
          <Volume2 className="h-5 w-5" /> 소리 시험 「땡」
        </button>

        <p className="text-label text-muted-foreground">
          휴대폰 볼륨을 끝까지 올리고 화면을 켜 둔 채로 써 주세요. 무음 모드여도 울려요 · 듣던 음악은 잠깐 멈출 수 있어요.
        </p>
      </div>

      <div className="border-t border-border bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <p className="mb-2 text-center text-label text-muted-foreground">{settingsLine(s)}</p>
        <button
          type="button"
          onClick={onStart}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-heading text-primary-foreground transition-all active:scale-[0.99]"
        >
          <Play className="h-5 w-5 fill-current" /> 시작
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 달리는 화면
// ─────────────────────────────────────────────────────────────

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const Runner = ({
  s,
  onEdit,
  onDone,
  banner,
}: {
  s: TimerSettings;
  onEdit: () => void;
  /** 마지막 라운드가 끝났을 때 한 번 (스파링 기록 — 경기 끝) */
  onDone?: () => void;
  /** 맨 위 띠 (스파링 기록 — 경기 번호 · 두 사람 · 끝/취소) */
  banner?: ReactNode;
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const accRef = useRef(0);
  const startRef = useRef(now());
  const lastRef = useRef(-1);

  const read = useCallback(() => accRef.current + (running ? now() - startRef.current : 0), [running]);

  const fire = useCallback(
    (to: number) => {
      const cues = cuesToPlay(s, lastRef.current, to);
      lastRef.current = to;
      cues.forEach(playCue);
    },
    [s],
  );

  // 시계 — 0.1초마다
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = read();
      fire(t);
      setElapsed(t);
      const total = totalMs(s);
      if (total != null && t >= total) {
        accRef.current = total;
        setRunning(false);
      }
    };
    tick();
    const iv = window.setInterval(tick, 100);
    return () => window.clearInterval(iv);
  }, [running, read, fire, s]);

  // 화면 꺼짐 막기 · 다른 앱에 다녀오면 소리 다시 깨우기
  useEffect(() => {
    void keepScreenOn(true);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        resumeLoud();
        void keepScreenOn(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void keepScreenOn(false);
    };
  }, []);

  const phase = phaseAt(s, elapsed);
  const done = phase.kind === "done";

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (done) onDoneRef.current?.();
  }, [done]);

  const toggle = () => {
    unlockLoud();
    if (done) return;
    if (running) {
      accRef.current = read();
      setRunning(false);
    } else {
      startRef.current = now();
      setRunning(true);
    }
  };
  const restart = () => {
    unlockLoud();
    accRef.current = 0;
    lastRef.current = -1;
    startRef.current = now();
    setElapsed(0);
    setRunning(true);
  };
  const skip = () => {
    unlockLoud();
    if (done) return;
    const to = nextPhaseStart(s, read());
    accRef.current = to;
    startRef.current = now();
    // 건너뛴 구간의 신호는 울리지 않고, 새 구간의 시작 신호만
    lastRef.current = to - 1;
    fire(to);
    setElapsed(to);
  };

  const last10 = phase.kind === "round" && phase.remainingMs <= WARN_AT_SEC * 1000;
  const tone =
    phase.kind === "rest"
      ? "text-amber-600"
      : last10
        ? "text-destructive"
        : phase.kind === "prep"
          ? "text-muted-foreground"
          : "text-foreground";
  const bar = phase.kind === "rest" ? "bg-amber-500" : last10 ? "bg-destructive" : "bg-primary";
  const progress = phase.lengthMs > 0 ? 1 - phase.remainingMs / phase.lengthMs : 1;
  const next =
    phase.kind === "prep"
      ? `곧 1라운드 · ${durationText(s.roundSec)}`
      : phase.kind === "round"
        ? s.rounds > 0 && phase.round >= s.rounds
          ? "이번 라운드가 마지막이에요"
          : `다음 · 쉬는 시간 ${durationText(s.restSec)}`
        : phase.kind === "rest"
          ? `다음 · ${s.rounds > 0 && phase.round === s.rounds ? "마지막 라운드" : `${phase.round}라운드`}`
          : "";
  const doneRounds = phase.kind === "round" ? phase.round - 1 : phase.kind === "rest" ? phase.round - 1 : done ? s.rounds : 0;
  const dots = s.rounds > 0 ? s.rounds : 0;
  const totalMin = done ? Math.round((s.rounds * s.roundSec) / 60) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {banner}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <p className={cn("text-title", done ? "text-primary" : tone)} aria-live="polite">
          {phaseLabel(phase, s)}
        </p>
        {!done ? (
          <>
            <p
              className={cn("number-font my-2 font-black leading-none tabular-nums", tone, !running && "opacity-50")}
              style={{ fontSize: "min(30vw, 34vh)" }} /* 글씨예외 — 멀리서도 보이는 큰 시계 */
              role="timer"
              aria-label={`남은 시간 ${clockText(phase.remainingMs)}`}
            >
              {clockText(phase.remainingMs)}
            </p>
            <div className="h-3 w-full max-w-md overflow-hidden rounded-full bg-foreground/10">
              <div className={cn("h-full rounded-full transition-[width] duration-100", bar)} style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-body font-bold text-muted-foreground">{running ? next : "멈춤 — ▶ 를 누르면 이어서"}</p>
          </>
        ) : (
          <div className="my-6 text-center">
            <p className="text-display text-foreground">수고했어요!</p>
            <p className="mt-2 text-body text-muted-foreground">
              {s.rounds}라운드 · 운동 {totalMin}분 다 했어요
            </p>
          </div>
        )}
        {dots > 0 && dots <= ROUNDS_MAX && (
          <div className="mt-5 flex max-w-md flex-wrap justify-center gap-1.5" aria-label={`${s.rounds}라운드 중 ${doneRounds}라운드 끝`}>
            {Array.from({ length: dots }, (_, i) => {
              const cur = phase.kind === "round" && phase.round === i + 1;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full",
                    i < doneRounds ? "bg-foreground" : cur ? "bg-primary ring-2 ring-primary/30" : "bg-foreground/15",
                  )}
                />
              );
            })}
          </div>
        )}
        {s.rounds === 0 && phase.kind !== "prep" && (
          <p className="mt-4 text-label text-muted-foreground">무제한 · {Math.max(0, doneRounds)}라운드 끝</p>
        )}
      </div>

      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
        {done ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="h-14 rounded-2xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.99]"
            >
              설정 바꾸기
            </button>
            <button
              type="button"
              onClick={restart}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.99]"
            >
              <RotateCcw className="h-5 w-5" /> 다시 하기
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={restart}
              aria-label="처음부터"
              className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
            >
              <RotateCcw className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={running ? "멈추기" : "계속"}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-background shadow-lg active:scale-95"
            >
              {running ? <Pause className="h-10 w-10 fill-current" /> : <Play className="ml-1 h-10 w-10 fill-current" />}
            </button>
            <button
              type="button"
              onClick={skip}
              aria-label="다음 구간으로 건너뛰기"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
            >
              <SkipForward className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────

const Body = ({ onClose, startMode }: { onClose: () => void; startMode: "timer" | "spar" }) => {
  const [s, setS] = useState<TimerSettings>(() => loadSettings());
  const [runKey, setRunKey] = useState<number | null>(null);
  // 🥊 스파링 기록 (2026-11-25 스파링 영상 1차) — 코치 · 지점장만 칸이 보인다(권한은 서버가 다시 본다)
  const { role, profile } = useAuth();
  const isStaff = isManagerRole(role) || (!!profile && isStaffProfile(profile));
  const [mode, setMode] = useState<"timer" | "spar">(startMode === "spar" && isStaff ? "spar" : "timer");
  // 알림으로 바로 열면 역할을 읽기 전일 수 있다 — 코치로 확인되면 그때 스파링 칸으로
  useEffect(() => {
    if (startMode === "spar" && isStaff) setMode("spar");
  }, [startMode, isStaff]);
  const [match, setMatch] = useState<MatchStarted | null>(null);
  const qc = useQueryClient();
  const set = (v: TimerSettings) => {
    setS(v);
    saveSettings(v);
  };
  const close = useCallback(() => {
    releaseLoud();
    onClose();
  }, [onClose]);
  useModalDismiss(true, close, { back: true });
  useEffect(() => () => releaseLoud(), []);

  const start = () => {
    unlockLoud();
    setRunKey(Date.now());
  };
  const line = useMemo(() => settingsLine(s), [s]);

  // 경기 끝 · 취소 → 기록하고 다음 두 사람 고르기로
  const finishMatch = useCallback(
    async (cancel: boolean) => {
      const m = match;
      if (!m) return;
      setMatch(null);
      setRunKey(null);
      try {
        await endMatch(m.id, cancel);
        toast.success(cancel ? `${seqLabel(m.seq)} 경기를 취소했어요` : `${seqLabel(m.seq)} 경기 끝 · 다음 두 명을 골라 주세요`);
      } catch (e) {
        toast.error((e as Error).message);
      }
      void qc.invalidateQueries({ queryKey: SPARVID_KEY });
    },
    [match, qc],
  );

  const sparBanner = match ? (
    <div className="mx-5 mb-2 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-foreground">
          {seqLabel(match.seq)} {match.a_name} vs {match.b_name}
        </p>
        <p className={cn("truncate text-micro", match.film_ok ? "text-status-complete" : "text-muted-foreground")}>
          {match.film_ok ? "🎥 촬영 중" : "촬영 안 함"} · {match.match_code}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void finishMatch(true)}
        className="h-9 shrink-0 rounded-full bg-secondary px-3 text-micro font-bold text-foreground active:scale-95"
      >
        취소
      </button>
      <button
        type="button"
        onClick={() => void finishMatch(false)}
        className="h-9 shrink-0 rounded-full bg-foreground px-3 text-micro font-bold text-background active:scale-95"
      >
        경기 끝
      </button>
    </div>
  ) : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="복싱 타이머" className="fixed inset-0 z-[115] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Bell className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-heading text-foreground">{mode === "spar" ? "스파링 기록" : "복싱 타이머"}</p>
          {runKey != null && <p className="truncate text-label text-muted-foreground">{line}</p>}
        </div>
        {runKey != null && !match && (
          <button
            type="button"
            onClick={() => setRunKey(null)}
            className="h-10 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
          >
            설정
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="타이머 닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {isStaff && runKey == null && (
        <div className="mx-5 mb-3 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="tablist" aria-label="타이머 · 스파링 기록">
          {(
            [
              ["timer", "타이머"],
              ["spar", "🥊 스파링 기록"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "h-9 rounded-full text-label font-bold transition-all",
                mode === k ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {runKey != null ? (
        <Runner
          key={runKey}
          s={s}
          onEdit={() => setRunKey(null)}
          onDone={match ? () => void finishMatch(false) : undefined}
          banner={sparBanner}
        />
      ) : mode === "spar" && isStaff ? (
        <SparringRecorderPanel
          s={s}
          onSettings={() => setMode("timer")}
          onStartMatch={(m) => {
            setMatch(m);
            start();
          }}
        />
      ) : (
        <Setup s={s} set={set} onStart={start} />
      )}
    </div>
  );
};

const BoxingTimerSheet = ({
  open,
  onClose,
  startMode = "timer",
}: {
  open: boolean;
  onClose: () => void;
  /** "spar" = 코치 스파링 기록 칸으로 열기 (밤 11시 「오늘의 스파링」 알림 `/missions?timer=spar`) */
  startMode?: "timer" | "spar";
}) => {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<Body onClose={onClose} startMode={startMode} />, document.body);
};

export default BoxingTimerSheet;
