/**
 * 153마인드셋 — 대본 재생기 (2026-10-19)
 *
 * 세션 대본(Cue 목록)을 순서대로 재생한다: 문장 말하기 → 쉼 → 상상하는 고요한 시간 → 호흡 → 공 소리 → 실시간 콤비 구령.
 * 예전처럼 '15초마다 글 한 덩어리'가 아니라, 문장마다 목소리와 자막이 함께 넘어가고 사이사이 상상할 시간을 준다.
 *
 * 일시정지는 지금 하던 동작(문장 하나 · 호흡 한 바퀴 · 구령 한 세트)을 처음부터 다시 하는 방식 — 기기 음성의 pause 가
 * 안드로이드에서 믿을 수 없어서(멈춤 = 취소) 가장 단순하고 확실한 방법을 쓴다.
 *
 * 2026-10-19 검수 반영
 *   · 긴 호흡(17바퀴)도 멈췄다 이어 들으면 '지금 바퀴'부터 — 처음부터 다시 하지 않는다
 *   · 남은 시간 · 고리는 대본 위치로 센다(멈췄다 다시 들어도 두 번 세지 않는다). 끝까지 갔는지(60%)도 위치로 본다
 *   · 끝난 뒤에는 다시 재생되지 않고, 끝 소식(onDone)은 한 번만
 *   · 다른 앱에 다녀오면 소리를 다시 깨우고, 2초 넘게 떠나 있었으면 지금 동작을 처음부터 다시 맞춘다
 *   · 같은 구령이 되풀이돼도 화면이 박자마다 다시 움직이게 beat 를 센다
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
  restoreAudioSession,
  resumeAudio,
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
  /** 대본 위치(초) — 남은 시간 · 진행 고리 */
  elapsed: number;
  total: number;
  cueIndex: number;
  /** 자막이 바뀔 때마다 1씩 — 같은 구령이 되풀이돼도 화면이 다시 움직이게 */
  beat: number;
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
  /** playedSec = 실제로 들은 시간 · reached = 대본을 어디까지 갔는지(0~1) */
  onDone?: (playedSec: number, reached: number) => void;
}

export function useMindPlayer({ cues, vars, voiceOn, rate, soundscape, onDone }: Options) {
  // 문장마다 예상 길이 · 그 앞까지의 합 (대본 위치 계산용)
  const { cueSecs, before, total } = useMemo(() => {
    const secs = cues.map((c) => estimateCueSec(c, vars, rate));
    const pre: number[] = [];
    let acc = 0;
    secs.forEach((s) => {
      pre.push(acc);
      acc += s;
    });
    return { cueSecs: secs, before: pre, total: Math.round(acc) };
  }, [cues, vars, rate]);
  const [state, setState] = useState<MindPlayerState>({
    status: "idle",
    caption: "",
    captionKind: "say",
    chapter: "",
    breath: null,
    elapsed: 0,
    total,
    cueIndex: 0,
    beat: 0,
  });

  const runRef = useRef(0); // 재생 토큰 — 바뀌면 진행 중이던 재생은 멈춘다
  const idxRef = useRef(0);
  /** 이어 들을 자리 — 호흡은 몇 번째 바퀴, 구령은 몇 번째 세트 */
  const subRef = useRef({ idx: -1, cycle: 0, rep: 0 });
  const speechRef = useRef<SpeakHandle | null>(null);
  const timersRef = useRef<number[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const optsRef = useRef({ voiceOn, rate, vars });
  optsRef.current = { voiceOn, rate, vars };
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const geoRef = useRef({ cueSecs, before, total });
  geoRef.current = { cueSecs, before, total };
  const playedRef = useRef(0);
  /** 지금 동작이 시작된 대본 위치(초) + 그 뒤로 흐른 시간 */
  const posBaseRef = useRef(0);
  const posClockRef = useRef(0);
  const maxPosRef = useRef(0);
  const doneRef = useRef(false);
  const statusRef = useRef<MindPlayerState["status"]>("idle");
  const hiddenAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => setState((s) => ({ ...s, total })), [total]);

  const setStatus = (status: MindPlayerState["status"]) => {
    statusRef.current = status;
    setState((s) => ({ ...s, status }));
  };

  /** 대본 위치 — 지금 문장의 끝을 넘지 않는다 */
  const position = () => {
    const { cueSecs: secs, before: pre, total: tot } = geoRef.current;
    const i = idxRef.current;
    const cueEnd = (pre[i] ?? 0) + (secs[i] ?? 0);
    return Math.min(tot, cueEnd, posBaseRef.current + posClockRef.current);
  };
  /** 새 동작 시작 — 대본 위치를 그 자리로 */
  const markStep = (i: number, offset = 0) => {
    posBaseRef.current = (geoRef.current.before[i] ?? 0) + offset;
    posClockRef.current = 0;
  };

  // 시계 — 재생 중에만 흐른다. 화면이 꺼져 멈춰 있던 시간(한 번에 2초 넘게 건너뛴 시간)은 세지 않는다
  const advance = () => {
    const now = performance.now();
    let d = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;
    if (d > 2) d = 0.25;
    playedRef.current += d;
    posClockRef.current += d;
    const pos = position();
    if (pos > maxPosRef.current) maxPosRef.current = pos;
    return pos;
  };
  const startClock = () => {
    if (tickRef.current) return;
    lastTickRef.current = performance.now();
    tickRef.current = window.setInterval(() => {
      const pos = advance();
      setState((s) => ({ ...s, elapsed: Math.floor(pos) }));
    }, 250);
  };
  const stopClock = () => {
    if (tickRef.current) {
      advance();
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  /** 끝 소식 — 한 번만 */
  const reportDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const tot = geoRef.current.total;
    onDoneRef.current?.(Math.round(playedRef.current), tot > 0 ? Math.min(1, maxPosRef.current / tot) : 1);
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

  /** 자막 바꾸기 — 박자(beat)도 하나 올린다 */
  const show = (patch: Partial<MindPlayerState>) => setState((s) => ({ ...s, ...patch, beat: s.beat + 1 }));

  const runFrom = useCallback(
    async (start: number, token: number) => {
      for (let i = start; i < cues.length; i++) {
        if (runRef.current !== token) return;
        idxRef.current = i;
        const resume = subRef.current.idx === i ? subRef.current : { idx: i, cycle: 0, rep: 0 };
        subRef.current = { ...resume };
        const c = cues[i];
        setState((s) => ({ ...s, cueIndex: i }));
        const vars = optsRef.current.vars;
        switch (c.k) {
          case "chapter":
            markStep(i);
            setState((s) => ({ ...s, chapter: c.title }));
            break;
          case "say": {
            markStep(i);
            const text = resolveSay(c, vars);
            if (!text) break;
            show({ caption: text, captionKind: "say", breath: null });
            if (!(await say(text, token, c.clip))) return;
            if (!(await wait(c.gap ?? 0.9, token))) return;
            break;
          }
          case "quiet":
            markStep(i);
            show({ caption: c.caption ?? "", captionKind: "quiet", breath: null });
            if (!(await wait(c.sec, token))) return;
            break;
          case "bell": {
            markStep(i);
            show({ caption: c.caption ?? "", captionKind: "bell", breath: null });
            buzz([60, 80, 60, 80, 60]);
            const d = playBell(c.times ?? 3);
            if (!(await wait(Math.max(1.2, d), token))) return;
            break;
          }
          case "clap":
            markStep(i);
            playClapper();
            buzz([30, 60, 30]);
            if (!(await wait(1, token))) return;
            break;
          case "combo": {
            const setSec = c.calls.length * c.every;
            for (let r = resume.rep; r < c.reps; r++) {
              subRef.current = { idx: i, cycle: 0, rep: r };
              markStep(i, r * setSec);
              for (const call of c.calls) {
                if (runRef.current !== token) return;
                show({ caption: call, captionKind: "call", breath: null });
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
            const cycleSec = c.pattern === "box" ? 16 : 10;
            for (let cy = resume.cycle; cy < c.cycles; cy++) {
              subRef.current = { idx: i, cycle: cy, rep: 0 };
              markStep(i, cy * cycleSec);
              for (const ph of pat) {
                if (runRef.current !== token) return;
                show({
                  caption: ph.word,
                  captionKind: "breath",
                  breath: { phase: ph.phase, sec: ph.sec, key: Date.now() },
                });
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
        subRef.current = { idx: -1, cycle: 0, rep: 0 };
      }
      if (runRef.current !== token) return;
      stopClock();
      stopSoundscape();
      void keepScreenOn(false);
      restoreAudioSession();
      maxPosRef.current = geoRef.current.total;
      statusRef.current = "done";
      setState((s) => ({ ...s, status: "done", caption: "", breath: null, elapsed: geoRef.current.total }));
      reportDone();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cues],
  );

  const play = useCallback(async () => {
    if (doneRef.current) return; // 끝난 뒤에는 다시 재생하지 않는다 (기록 화면 뒤에서 소리가 나지 않게)
    const token = ++runRef.current;
    if (!voiceRef.current) voiceRef.current = await pickKoreanVoice();
    if (runRef.current !== token || doneRef.current) return;
    setSoundscape(soundscape);
    duckSoundscape(false);
    void keepScreenOn(true);
    startClock();
    setStatus("playing");
    void runFrom(idxRef.current, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFrom, soundscape]);

  /** 진행 중인 동작을 멈춘다 (소리 · 시계) */
  const halt = () => {
    runRef.current++;
    clearTimers();
    speechRef.current?.cancel();
    stopSpeech();
    stopClock();
  };

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    halt();
    duckSoundscape(true);
    setStatus("paused");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 끝내기 — 기록 화면으로 */
  const finish = useCallback(() => {
    if (doneRef.current) return;
    halt();
    stopSoundscape();
    void keepScreenOn(false);
    restoreAudioSession();
    statusRef.current = "done";
    setState((s) => ({ ...s, status: "done", breath: null }));
    reportDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 배경 소리 바꾸기 — 재생 중이면 바로 */
  const changeSoundscape = useCallback((k: Soundscape) => {
    if (statusRef.current === "playing") setSoundscape(k);
  }, []);

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
      restoreAudioSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 다른 앱으로 갔다 오면 — 소리를 다시 깨우고 화면 꺼짐 막기를 다시 건다.
  // 2초 넘게 떠나 있었으면 음성이 멈춰 있을 수 있어 지금 동작(문장·호흡 한 바퀴)을 처음부터 다시 맞춘다.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = performance.now();
        return;
      }
      const away = hiddenAtRef.current != null ? performance.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      if (statusRef.current !== "playing") return;
      resumeAudio();
      void keepScreenOn(true);
      if (away > 2000) {
        halt();
        const token = runRef.current;
        startClock();
        void runFrom(idxRef.current, token);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFrom]);

  return { state, play, pause, finish, changeSoundscape };
}
