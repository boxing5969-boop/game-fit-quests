/**
 * 153마인드셋 — 소리 엔진 (2026-10-19 대표님: "시각화 훈련 퀄리티 — 성공한 시각화 앱을 벤치마킹해서 경쟁이 될 정도로")
 *
 * 잘 되는 시각화·명상 앱(Headspace · Calm · 마보 등)의 공통점은 '눈을 감고 귀로 따라간다'는 것.
 * 예전 화면은 15초마다 긴 글만 넘어가서 눈을 감을 수가 없었다 → 소리를 중심으로 바꾼다.
 *
 *   · 목소리: 기기의 한국어 음성(speechSynthesis) — 문장 하나씩 읽고 사이에 쉼을 둔다.
 *     기기마다 목소리가 달라서 가장 자연스러운 한국어 목소리를 골라 쓴다(Google · Natural/Neural · Yuna · SunHi …).
 *     목소리를 끄거나 기기에 한국어 음성이 없으면 자막만으로 같은 속도로 진행한다.
 *     나중에 녹음 파일(대표님 목소리 등)이 생기면 문장마다 clip 으로 바꿔 끼울 수 있다(playClip).
 *     '153'은 '일오삼'으로 읽게 바꿔서 보낸다(toSpokenKo) — 휴대폰 음성은 그냥 두면 '백오십삼'이라 읽는다. 자막은 153 그대로.
 *   · 공 소리(라운드 시작·끝) · 10초 전 딱딱이 · 배경 소리(새벽 체육관 · 빗소리 · 심장 박동)는 파일 없이 Web Audio 로 만든다.
 *   · 화면 꺼짐 막기(Wake Lock) · 진동(되는 기기만).
 */

import { toSpokenKo } from "@/lib/spokenKo";

export type Soundscape = "off" | "gym" | "rain" | "heartbeat";

export const SOUNDSCAPE_LABEL: Record<Soundscape, string> = {
  off: "배경 소리 끄기",
  gym: "새벽 체육관",
  rain: "빗소리",
  heartbeat: "심장 박동",
};

// ─────────────────────────────────────────────────────────────
// Web Audio — 공 · 딱딱이 · 배경 소리
// ─────────────────────────────────────────────────────────────

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let ambientGain: GainNode | null = null;
let ambientStop: (() => void) | null = null;
let currentScape: Soundscape = "off";
/** 배경 소리 크기 (0.1 ~ 1) — 목소리와 따로 (Calm 처럼 목소리·배경 소리 크기를 나눈다) */
let ambientLevel = 0.7;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return null;
    }
  }
  return ctx;
}

/** 버튼을 누른 순간에 불러야 한다(아이폰·사파리는 손가락으로 누를 때만 소리를 연다) */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume().catch(() => undefined);
  // 음성도 같이 깨운다 — 빈 문장을 한 번 말해 두면 iOS 에서 다음 문장부터 막히지 않는다
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* 무시 */
  }
}

function noiseBuffer(c: Ctx, seconds: number, kind: "white" | "brown" | "pink"): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
  }
  return buf;
}

/** 복싱 공 — '땡' 을 n 번 (금속 종: 어긋난 배음 + 긴 여운) */
export function playBell(times = 3): number {
  const c = getCtx();
  if (!c || !master) return 0;
  const gap = 0.42;
  const now = c.currentTime + 0.05;
  const partials = [1, 2.76, 5.4, 8.93, 13.34];
  const f0 = 690;
  for (let n = 0; n < times; n++) {
    const t0 = now + n * gap;
    partials.forEach((p, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = f0 * p;
      const peak = 0.32 / (i + 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9 - i * 0.25);
      o.connect(g).connect(master!);
      o.start(t0);
      o.stop(t0 + 2);
    });
  }
  return (times - 1) * gap + 1.6;
}

/** 라운드 10초 전 딱딱이 — '딱 딱' */
export function playClapper(): void {
  const c = getCtx();
  if (!c || !master) return;
  const buf = noiseBuffer(c, 0.12, "white");
  [0, 0.16].forEach((dt) => {
    const t0 = c.currentTime + 0.03 + dt;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2100;
    bp.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    src.connect(bp).connect(g).connect(master!);
    src.start(t0);
    src.stop(t0 + 0.12);
  });
}

/** 호흡 신호 — 들숨은 살짝 올라가는 소리, 날숨은 내려가는 소리 (아주 작게) */
export function playBreathTone(phase: "in" | "out", seconds: number): void {
  const c = getCtx();
  if (!c || !master) return;
  const t0 = c.currentTime + 0.02;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  const [a, b] = phase === "in" ? [196, 262] : [262, 175];
  o.frequency.setValueAtTime(a, t0);
  o.frequency.linearRampToValueAtTime(b, t0 + seconds);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.045, t0 + 0.6);
  g.gain.linearRampToValueAtTime(0.035, t0 + Math.max(0.7, seconds - 0.6));
  g.gain.linearRampToValueAtTime(0.0001, t0 + seconds);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + seconds + 0.05);
}

/** 배경 소리 켜기/바꾸기 — 같은 것이면 그대로 */
export function setSoundscape(kind: Soundscape): void {
  if (kind === currentScape && (kind === "off" || ambientStop)) return;
  stopSoundscape();
  currentScape = kind;
  if (kind === "off") return;
  const c = getCtx();
  if (!c || !master) return;
  ambientGain = c.createGain();
  ambientGain.gain.setValueAtTime(0.0001, c.currentTime);
  ambientGain.gain.linearRampToValueAtTime(ambientLevel, c.currentTime + 2.5);
  ambientGain.connect(master);
  const out = ambientGain;
  const timers: number[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  const loop = (buf: AudioBuffer, filter: (n: AudioNode) => AudioNode, gain: number) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = gain;
    filter(src).connect(g).connect(out);
    src.start();
    sources.push(src);
  };

  if (kind === "gym") {
    // 새벽 체육관: 낮은 공기 소리 + 멀리서 샌드백 치는 소리 + 가끔 줄넘기
    loop(noiseBuffer(c, 6, "brown"), (n) => {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 380;
      n.connect(lp);
      return lp;
    }, 0.32);
    const thumpBuf = noiseBuffer(c, 0.25, "brown");
    const thump = () => {
      const t0 = c.currentTime + 0.02;
      const combo = Math.random() < 0.45 ? 2 : 1;
      for (let k = 0; k < combo; k++) {
        const s = c.createBufferSource();
        s.buffer = thumpBuf;
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 210 + Math.random() * 90;
        const g = c.createGain();
        const tt = t0 + k * (0.22 + Math.random() * 0.1);
        const peak = 0.22 + Math.random() * 0.22;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(peak, tt + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.22);
        s.connect(lp).connect(g).connect(out);
        s.start(tt);
        s.stop(tt + 0.25);
      }
      timers.push(window.setTimeout(thump, 1400 + Math.random() * 3600));
    };
    timers.push(window.setTimeout(thump, 1800));
  } else if (kind === "rain") {
    loop(noiseBuffer(c, 6, "pink"), (n) => {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 350;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      n.connect(hp).connect(lp);
      return lp;
    }, 0.55);
    const dropBuf = noiseBuffer(c, 0.04, "white");
    const drop = () => {
      const t0 = c.currentTime + 0.01;
      const s = c.createBufferSource();
      s.buffer = dropBuf;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2500 + Math.random() * 3500;
      bp.Q.value = 6;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.08, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      s.connect(bp).connect(g).connect(out);
      s.start(t0);
      s.stop(t0 + 0.04);
      timers.push(window.setTimeout(drop, 60 + Math.random() * 380));
    };
    timers.push(window.setTimeout(drop, 400));
  } else if (kind === "heartbeat") {
    // 1분에 60번 — '쿵-쿵'
    loop(noiseBuffer(c, 6, "brown"), (n) => {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 220;
      n.connect(lp);
      return lp;
    }, 0.12);
    const beat = () => {
      const t0 = c.currentTime + 0.02;
      [0, 0.27].forEach((dt, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(i === 0 ? 62 : 54, t0 + dt);
        o.frequency.exponentialRampToValueAtTime(38, t0 + dt + 0.16);
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(i === 0 ? 0.55 : 0.38, t0 + dt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
        o.connect(g).connect(out);
        o.start(t0 + dt);
        o.stop(t0 + dt + 0.22);
      });
      timers.push(window.setTimeout(beat, 1000));
    };
    timers.push(window.setTimeout(beat, 600));
  }

  ambientStop = () => {
    timers.forEach((t) => window.clearTimeout(t));
    const g = out.gain;
    try {
      g.cancelScheduledValues(c.currentTime);
      g.setValueAtTime(g.value, c.currentTime);
      g.linearRampToValueAtTime(0.0001, c.currentTime + 0.6);
    } catch {
      /* 무시 */
    }
    window.setTimeout(() => {
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* 이미 멈춤 */
        }
      });
      try {
        out.disconnect();
      } catch {
        /* 무시 */
      }
    }, 700);
  };
}

export function stopSoundscape(): void {
  if (ambientStop) ambientStop();
  ambientStop = null;
  ambientGain = null;
  currentScape = "off";
}

/** 배경 소리 크기 */
export function setAmbientVolume(v: number): void {
  ambientLevel = Math.min(1, Math.max(0.05, v));
  const c = ctx;
  if (!c || !ambientGain) return;
  try {
    const g = ambientGain.gain;
    g.cancelScheduledValues(c.currentTime);
    g.setValueAtTime(g.value, c.currentTime);
    g.linearRampToValueAtTime(ambientLevel, c.currentTime + 0.3);
  } catch {
    /* 무시 */
  }
}

/** 배경 소리를 잠깐 줄였다 키운다 (일시정지) */
export function duckSoundscape(on: boolean): void {
  const c = ctx;
  if (!c || !ambientGain) return;
  const g = ambientGain.gain;
  try {
    g.cancelScheduledValues(c.currentTime);
    g.setValueAtTime(g.value, c.currentTime);
    g.linearRampToValueAtTime(on ? 0.0001 : ambientLevel, c.currentTime + 0.5);
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────────────────────────────────────
// 목소리 — 기기 한국어 음성
// ─────────────────────────────────────────────────────────────

const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let voicePromise: Promise<SpeechSynthesisVoice | null> | null = null;

function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = 0;
  if (/natural|neural|online|premium|enhanced|wavenet/.test(n)) s += 6;
  if (/sunhi|선희|yuna|유나|seoyeon|서연|jimin|지민/.test(n)) s += 5;
  if (/google/.test(n)) s += 4;
  if (/samsung/.test(n)) s += 3;
  if (/heami|해미/.test(n)) s += 1;
  if (/compact|espeak/.test(n)) s -= 6;
  if (v.localService) s += 1;
  return s;
}

/** 가장 자연스러운 한국어 목소리 (없으면 null) — 목록이 늦게 올라오는 기기를 위해 잠깐 기다린다 */
export function pickKoreanVoice(): Promise<SpeechSynthesisVoice | null> {
  if (!hasSpeech()) return Promise.resolve(null);
  if (voicePromise) return voicePromise;
  voicePromise = new Promise((resolve) => {
    const choose = () => {
      const all = window.speechSynthesis.getVoices();
      const ko = all.filter((v) => /^ko([-_]|$)/i.test(v.lang));
      if (!ko.length) return null;
      return [...ko].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
    };
    const first = choose();
    if (first) return resolve(first);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(choose());
    };
    try {
      window.speechSynthesis.addEventListener?.("voiceschanged", finish, { once: true });
    } catch {
      /* 무시 */
    }
    window.setTimeout(finish, 1500);
  });
  // 목록이 비어 있었으면 다음에 다시 찾게 둔다
  void voicePromise.then((v) => {
    if (!v) voicePromise = null;
  });
  return voicePromise;
}

export interface SpeakHandle {
  done: Promise<void>;
  cancel: () => void;
}

/** 대략 몇 초에 읽는지 — 자막만 보일 때와 음성이 끝 소식을 안 줄 때의 안전 시간 */
export function estimateSpeechSec(text: string, rate = 1): number {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(1.2, (chars * 0.165) / rate + 0.4);
}

/**
 * 한 문장 말하기. 끝나면 done. 목소리가 없으면 읽는 시간만큼 기다린다.
 * 일부 안드로이드 크롬은 onend 를 주지 않는 때가 있어 안전 시간(예상 × 1.8 + 2초)이 지나면 넘어간다.
 */
export function speak(text: string, opts: { enabled: boolean; voice: SpeechSynthesisVoice | null; rate: number }): SpeakHandle {
  let cancelled = false;
  let timer = 0;
  let resolveFn: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  const finish = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    resolveFn();
  };
  const est = estimateSpeechSec(text, opts.rate);

  if (!opts.enabled || !hasSpeech()) {
    timer = window.setTimeout(finish, est * 1000);
  } else {
    try {
      const u = new SpeechSynthesisUtterance(toSpokenKo(text));
      u.lang = "ko-KR";
      if (opts.voice) u.voice = opts.voice;
      u.rate = opts.rate;
      u.pitch = 1;
      u.volume = 1;
      u.onend = () => {
        if (!cancelled) finish();
      };
      u.onerror = () => {
        if (!cancelled) finish();
      };
      window.speechSynthesis.speak(u);
      timer = window.setTimeout(finish, (est * 1.8 + 2) * 1000);
    } catch {
      timer = window.setTimeout(finish, est * 1000);
    }
  }
  return {
    done,
    cancel: () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      timer = 0;
      try {
        if (hasSpeech()) window.speechSynthesis.cancel();
      } catch {
        /* 무시 */
      }
      resolveFn();
    },
  };
}

export function stopSpeech(): void {
  try {
    if (hasSpeech()) window.speechSynthesis.cancel();
  } catch {
    /* 무시 */
  }
}

/** 녹음 파일 한 개 재생 (나중에 대표님 목소리 등) — 끝나면 done */
export function playClip(url: string): SpeakHandle {
  const a = new Audio(url);
  let resolveFn: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  a.onended = () => resolveFn();
  a.onerror = () => resolveFn();
  void a.play().catch(() => resolveFn());
  return {
    done,
    cancel: () => {
      try {
        a.pause();
      } catch {
        /* 무시 */
      }
      resolveFn();
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 화면 꺼짐 막기 · 진동
// ─────────────────────────────────────────────────────────────

type WakeLockLike = { release: () => Promise<void> };
let wakeLock: WakeLockLike | null = null;

export async function keepScreenOn(on: boolean): Promise<void> {
  try {
    if (on) {
      if (wakeLock) return;
      const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
      if (!nav.wakeLock) return;
      wakeLock = await nav.wakeLock.request("screen");
    } else if (wakeLock) {
      const w = wakeLock;
      wakeLock = null;
      await w.release();
    }
  } catch {
    wakeLock = null;
  }
}

export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* 무시 */
  }
}

/** 화면이 닫힐 때 모두 정리 */
export function releaseAll(): void {
  stopSpeech();
  stopSoundscape();
  void keepScreenOn(false);
}
