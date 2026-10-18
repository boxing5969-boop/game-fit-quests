/**
 * 153마인드셋 — 대본 재생기 (2026-10-19)
 *
 * 세션 대본(Cue 목록)을 순서대로 재생한다: 문장 말하기 → 쉼 → 상상하는 고요한 시간 → 호흡 → 공 소리 → 실시간 콤비 구령.
 * 예전처럼 '15초마다 글 한 덩어리'가 아니라, 문장마다 목소리와 자막이 함께 넘어가고 사이사이 상상할 시간을 준다.
 *
 * 일시정지는 지금 하던 동작(문장·호흡 한 바퀴)을 처음부터 다시 하는 방식 — 기기 음성의 pause 가 안드로이드에서
 * 믿을 수 없어서(멈춤 = 취소) 가장 단순하고 확실한 방법을 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buzz,
  duckSoundscape,
  estimateSpeechSec,
  keepScreenOn,
  pickKoreanVoice,
  playBell,
  playBreathTone,
  playClapper,
  playClip,
  setSoundscape,
  speak,
  stopSpeech,
  stopSoundscape,
  type SpeakHandle,
  type Soundscape,
} from "./mindAudio";

/** 대본 한 줄 */
export type Cue =
  /** 말하기 — text 안의 {goal} {cue} {pb} {pbGoal} {division} 은 회원 정보로 바뀐다. 정보가 없으면 alt, alt 도 없으면 건너뛴다 */
  | { k: "say"; text: string; alt?: string; gap?: number; clip?: string }
  /** 말없이 상상하는 시간 */
  | { k: "quiet"; sec: number; caption?: string }
  /** 호흡 — box: 4초 들숨·4초 멈춤·4초 날숨·4초 멈춤 / calm: 4초 들숨·6초 날숨 */
  | { k: "breath"; pattern: "box" | "calm"; cycles: number }
  /** 공 소리 (3번 = 라운드 시작·끝) */
  | { k: "bell"; times?: number; caption?: string }
  /** 10초 전 딱딱이 */
  | { k: "clap" }
  /** 실시간 구령 — calls 를 every 초마다 하나씩, reps 번 되풀이 (원투 리허설) */
  | { k: "combo"; calls: string[]; every: number; reps: number }
  /** 장면 제목 (시간 없음) */
  | { k: "chapter"; title: string };

export interface MindVars {
  goal?: string | null;
  /** 나의 한마디 (큐 워드) */
  cue?: string | null;
  pb?: string | null;
  pbGoal?: string | null;
  division?: string | null;
}

export type BreathPhase = "in" | "hold" | "out" | "rest";

export interface MindPlayerState {
  status: "idle" | "playing" | "paused" | "done";
  caption: string;
  /** 자막 종류 — 구령은 크게, 상상 시간은 흐리게 */
  captionKind: "say" | "quiet" | "call" | "bell" | "breath";
  chapter: string;
  breath: { phase: BreathPhase; sec: number; key: number } | null;
  elapsed: number;
  total: number;
  cueIndex: number;
}

const BOX: Array<{ phase: BreathPhase; sec: number; word: string }> = [
  { phase: "in", sec: 4, word: "들이마시고" },
  { phase: "hold", sec: 4, word: "멈추고" },
  { phase: "out", sec: 4, word: "내쉬고" },
  { phase: "rest", sec: 4, word: "멈추고" },
];
const CALM: Array<{ phase: BreathPhase; sec: number; word: string }> = [
  { phase: "in", sec: 4, word: "들이마시고" },
  { phase: "out", sec: 6, word: "길게 내쉬고" },
];

const fill = (text: string, vars: MindVars): string | null => {
  let missing = false;
  const out = text.replace(/\{(goal|cue|pb|pbGoal|division)\}/g, (_, key: keyof MindVars) => {
    const v = vars[key];
    if (!v) {
      missing = true;
      return "";
    }
    return String(v);
  });
  return missing ? null : out;
};

/** 실제로 읽을 문장 (정보가 없으면 alt, 그것도 없으면 null) */
export function resolveSay(c: Extract<Cue, { k: "say" }>, vars: MindVars): string | null {
  const main = fill(c.text, vars);
  if (main != null) return main;
  if (c.alt) return fill(c.alt, vars);
  return null;
}

export function estimateCueSec(c: Cue, vars: MindVars, rate: number): number {
  switch (c.k) {
    case "say": {
      const t = resolveSay(c, vars);
      return t ? estimateSpeechSec(t, rate) + (c.gap ?? 0.9) : 0;
    }
    case "quiet":
      return c.sec;
    case "breath":
      return c.cycles * (c.pattern === "box" ? 16 : 10);
    case "bell":
      return 2.6;
    case "clap":
      return 1;
    case "combo":
      return c.reps * c.calls.length * c.every;
    case "chapter":
      return 0;
  }
}

/** 대본 전체 예상 분 (화면 표시용 — 반올림, 최소 1분) */
export function estimateMinutes(cues: Cue[], vars: MindVars, rate = 0.95): number {
  const sec = cues.reduce((s, c) => s + estimateCueSec(c, vars, rate), 0);
  return Math.max(1, Math.round(sec / 60));
}

interface Options {
  cues: Cue[];
  vars: MindVars;
  voiceOn: boolean;
  rate: number;
  soundscape: Soundscape;
  onDone?: (playedSec: number) => void;
}

export function useMindPlayer({ cues, vars, voiceOn, rate, soundscape, onDone }: Options) {
  const total = useMemo(() => Math.round(cues.reduce((s, c) => s + estimateCueSec(c, vars, rate), 0)), [cues, vars, rate]);
  const [state, setState] = useState<MindPlayerState>({
    status: "idle",
    caption: "",
    captionKind: "say",
    chapter: "",
    breath: null,
    elapsed: 0,
    total,
    cueIndex: 0,
  });

  const runRef = useRef(0); // 재생 토큰 — 바뀌면 진행 중이던 재생은 멈춘다
  const idxRef = useRef(0);
  const speechRef = useRef<SpeakHandle | null>(null);
  const timersRef = useRef<number[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const optsRef = useRef({ voiceOn, rate, vars });
  optsRef.current = { voiceOn, rate, vars };
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const playedRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => setState((s) => ({ ...s, total })), [total]);

  // 경과 시간 — 재생 중에만 흐른다
  const startClock = () => {
    if (tickRef.current) return;
    lastTickRef.current = performance.now();
    tickRef.current = window.setInterval(() => {
      const now = performance.now();
      playedRef.current += (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setState((s) => ({ ...s, elapsed: Math.floor(playedRef.current) }));
    }, 250);
  };
  const stopClock = () => {
    if (tickRef.current) {
      const now = performance.now();
      playedRef.current += (now - lastTickRef.current) / 1000;
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const wait = (sec: number, token: number) =>
    new Promise<boolean>((resolve) => {
      const t = window.setTimeout(() => resolve(runRef.current === token), Math.max(0, sec) * 1000);
      timersRef.current.push(t);
    });

  const say = async (text: string, token: number, clip?: string) => {
    const { voiceOn: on, rate: r } = optsRef.current;
    const h = clip && on ? playClip(clip) : speak(text, { enabled: on, voice: voiceRef.current, rate: r });
    speechRef.current = h;
    await h.done;
    speechRef.current = null;
    return runRef.current === token;
  };

  const runFrom = useCallback(
    async (start: number, token: number) => {
      for (let i = start; i < cues.length; i++) {
        if (runRef.current !== token) return;
        idxRef.current = i;
        const c = cues[i];
        setState((s) => ({ ...s, cueIndex: i }));
        const vars = optsRef.current.vars;
        switch (c.k) {
          case "chapter":
            setState((s) => ({ ...s, chapter: c.title }));
            break;
          case "say": {
            const text = resolveSay(c, vars);
            if (!text) break;
            setState((s) => ({ ...s, caption: text, captionKind: "say", breath: null }));
            if (!(await say(text, token, c.clip))) return;
            if (!(await wait(c.gap ?? 0.9, token))) return;
            break;
          }
          case "quiet":
            setState((s) => ({ ...s, caption: c.caption ?? "", captionKind: "quiet", breath: null }));
            if (!(await wait(c.sec, token))) return;
            break;
          case "bell": {
            setState((s) => ({ ...s, caption: c.caption ?? "", captionKind: "bell", breath: null }));
            buzz([60, 80, 60, 80, 60]);
            const d = playBell(c.times ?? 3);
            if (!(await wait(Math.max(1.2, d), token))) return;
            break;
          }
          case "clap":
            playClapper();
            buzz([30, 60, 30]);
            if (!(await wait(1, token))) return;
            break;
          case "combo": {
            for (let r = 0; r < c.reps; r++) {
              for (const call of c.calls) {
                if (runRef.current !== token) return;
                setState((s) => ({ ...s, caption: call, captionKind: "call", breath: null }));
                buzz(25);
                const t0 = performance.now();
                // 구령은 짧게 — 말이 끝나든 말든 박자(every)에 맞춰 다음으로
                const h = speak(call, { enabled: optsRef.current.voiceOn, voice: voiceRef.current, rate: Math.max(1, optsRef.current.rate) });
                speechRef.current = h;
                const spent = (performance.now() - t0) / 1000;
                if (!(await wait(c.every - spent, token))) return;
              }
            }
            break;
          }
          case "breath": {
            const pat = c.pattern === "box" ? BOX : CALM;
            for (let cy = 0; cy < c.cycles; cy++) {
              for (const ph of pat) {
                if (runRef.current !== token) return;
                setState((s) => ({
                  ...s,
                  caption: ph.word,
                  captionKind: "breath",
                  breath: { phase: ph.phase, sec: ph.sec, key: Date.now() },
                }));
                if (ph.phase === "in" || ph.phase === "out") playBreathTone(ph.phase, ph.sec);
                buzz(ph.phase === "in" ? 40 : ph.phase === "out" ? [20, 40, 20] : 15);
                // 처음 두 바퀴만 말로 안내, 그 뒤에는 소리·원만 (말이 많으면 호흡에 방해된다)
                if (cy < 2) speak(ph.word, { enabled: optsRef.current.voiceOn, voice: voiceRef.current, rate: optsRef.current.rate });
                if (!(await wait(ph.sec, token))) return;
              }
            }
            setState((s) => ({ ...s, breath: null }));
            break;
          }
        }
      }
      if (runRef.current !== token) return;
      stopClock();
      stopSoundscape();
      void keepScreenOn(false);
      setState((s) => ({ ...s, status: "done", caption: "", breath: null, elapsed: Math.floor(playedRef.current) }));
      onDoneRef.current?.(Math.round(playedRef.current));
    },
    [cues],
  );

  const play = useCallback(async () => {
    const token = ++runRef.current;
    if (!voiceRef.current) voiceRef.current = await pickKoreanVoice();
    if (runRef.current !== token) return;
    setSoundscape(soundscape);
    duckSoundscape(false);
    void keepScreenOn(true);
    startClock();
    setState((s) => ({ ...s, status: "playing" }));
    void runFrom(idxRef.current, token);
  }, [runFrom, soundscape]);

  const pause = useCallback(() => {
    runRef.current++;
    clearTimers();
    speechRef.current?.cancel();
    stopSpeech();
    stopClock();
    duckSoundscape(true);
    setState((s) => ({ ...s, status: "paused" }));
  }, []);

  /** 끝내기 — 기록 화면으로 */
  const finish = useCallback(() => {
    runRef.current++;
    clearTimers();
    speechRef.current?.cancel();
    stopSpeech();
    stopClock();
    stopSoundscape();
    void keepScreenOn(false);
    setState((s) => ({ ...s, status: "done", breath: null }));
    onDoneRef.current?.(Math.round(playedRef.current));
  }, []);

  /** 배경 소리 바꾸기 — 재생 중이면 바로 */
  const changeSoundscape = useCallback(
    (k: Soundscape) => {
      if (state.status === "playing") setSoundscape(k);
    },
    [state.status],
  );

  // 화면을 떠나면 모두 정리
  useEffect(
    () => () => {
      runRef.current++;
      clearTimers();
      speechRef.current?.cancel();
      stopSpeech();
      if (tickRef.current) window.clearInterval(tickRef.current);
      stopSoundscape();
      void keepScreenOn(false);
    },
    [],
  );

  // 다른 앱으로 갔다 오면 화면 꺼짐 막기를 다시 건다
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && state.status === "playing") void keepScreenOn(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [state.status]);

  return { state, play, pause, finish, changeSoundscape };
}
