/**
 * 🔔 복싱 타이머 소리 — 최대한 크게 (2026-11-22 대표님 「소리는 최대한 크게 나오고 복싱 타이머야」)
 *
 * 153마인드셋 공 소리(mindAudio playBell)는 명상용이라 작고 부드럽다 → 체육관 음악 · 샌드백 소리 위로 들리게 따로 만든다.
 *   · 소리 → 강한 압축기(작은 소리를 끌어올림) → 키우기 → 부드러운 깎기(tanh — 찢어지는 소리 없이 0dB 바로 아래까지) → 스피커
 *   · 휴대폰 스피커가 가장 크게 들리는 2~4kHz 에 힘을 준 금속 공(링 벨) · 나무 딱딱이 · 삐 소리. 파일 없이 Web Audio 로 만든다.
 *   · 아이폰 무음 스위치를 켜 둬도 울리게 타이머를 여는 동안만 '재생' 오디오(audioSession playback) — 닫으면 되돌린다
 *     (그동안 회원님이 듣던 음악은 잠깐 멈출 수 있다 — 화면에 한 줄 안내).
 *   기기 볼륨보다 크게는 못 낸다 — 화면에서 「휴대폰 볼륨을 끝까지」를 안내한다.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let input: GainNode | null = null;
let level = 1;

function build(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    const c = new AC();
    const inG = c.createGain();
    inG.gain.value = 1;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 4;
    comp.ratio.value = 16;
    comp.attack.value = 0.001;
    comp.release.value = 0.2;
    const makeup = c.createGain();
    makeup.gain.value = 2.4;
    const shaper = c.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6);
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    inG.connect(comp).connect(makeup).connect(shaper).connect(c.destination);
    ctx = c;
    input = inG;
    return c;
  } catch {
    ctx = null;
    input = null;
    return null;
  }
}

/** 소리 크기 0.3 ~ 1 (기본 1 = 최대) */
export function setLoudLevel(v: number): void {
  level = Math.min(1, Math.max(0.3, v));
  if (input) input.gain.value = level;
}

/** 버튼을 누른 순간에 부른다 — 아이폰은 손가락으로 누를 때만 소리를 연다 */
export function unlockLoud(): void {
  try {
    const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (as && as.type !== "playback") as.type = "playback";
  } catch {
    /* 지원하지 않는 기기 */
  }
  const c = build();
  if (!c) return;
  if (input) input.gain.value = level;
  if (c.state !== "running") void c.resume().catch(() => undefined);
  // 아주 짧은 무음 한 번 — 사파리가 오디오를 확실히 연다
  try {
    const b = c.createBuffer(1, 1, c.sampleRate);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start();
  } catch {
    /* 무시 */
  }
}

/** 다른 앱에 다녀오면 멈춰 있을 수 있다 */
export function resumeLoud(): void {
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => undefined);
}

/** 타이머를 닫을 때 — 아이폰 오디오를 원래대로 */
export function releaseLoud(): void {
  try {
    const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (as && as.type === "playback") as.type = "auto";
  } catch {
    /* 무시 */
  }
  if (ctx && ctx.state === "running") void ctx.suspend().catch(() => undefined);
}

function ready(): { c: Ctx; out: GainNode } | null {
  const c = build();
  if (!c || !input) return null;
  if (c.state !== "running") void c.resume().catch(() => undefined);
  return { c, out: input };
}

let noise: AudioBuffer | null = null;
function noiseBuf(c: Ctx): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate * 0.3);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noise = b;
  return b;
}

/** 링 벨 '땡' 한 번 — 어긋난 배음(금속) + 때리는 소리 + 긴 여운 */
function strike(c: Ctx, out: AudioNode, t0: number, ring: number): void {
  const f0 = 1180;
  const partials: [number, number][] = [
    [1, 0.55],
    [1.505, 0.38],
    [2.0, 0.5],
    [2.74, 0.42],
    [3.3, 0.3],
    [4.1, 0.2],
  ];
  partials.forEach(([p, amp], i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = i < 2 ? "triangle" : "sine";
    o.frequency.value = f0 * p;
    const decay = Math.max(0.35, ring - i * 0.22);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(amp, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(amp * 0.35, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + decay + 0.05);
  });
  // 망치가 종을 때리는 '챙' — 짧은 높은 잡음
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2500;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
  src.connect(hp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + 0.08);
}

/** 공 n 번 — 라운드 시작 1 · 끝 3 · 모두 끝 3(길게). 걸리는 초를 돌려준다 */
export function loudBell(times = 1, long = false): number {
  const r = ready();
  if (!r) return 0;
  const { c, out } = r;
  const gap = times > 1 ? 0.33 : 0;
  const ring = long ? 2.6 : times > 1 ? 1.2 : 2.2;
  const t = c.currentTime + 0.03;
  for (let i = 0; i < times; i++) strike(c, out, t + i * gap, i === times - 1 ? ring : Math.min(ring, 0.9));
  return (times - 1) * gap + ring;
}

/** 10초 전 딱딱이 — '딱! 딱! 딱!' (나무 두드리는 소리) */
export function loudClapper(): void {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  [0, 0.17, 0.34].forEach((dt) => {
    const t0 = c.currentTime + 0.03 + dt;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 2.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    src.connect(bp).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + 0.1);
    // 나무 울림 — 짧은 낮은 '톡'
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = "square";
    o.frequency.value = 1150;
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.35, t0 + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    o.connect(og).connect(out);
    o.start(t0);
    o.stop(t0 + 0.06);
  });
}

/** 마지막 3초 '삐' — high = 마지막 한 번 */
export function loudBeep(high = false): void {
  const r = ready();
  if (!r) return;
  const { c, out } = r;
  const t0 = c.currentTime + 0.02;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = high ? 2100 : 1600;
  const len = 0.16;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.004);
  g.gain.setValueAtTime(0.5, t0 + len - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + len + 0.02);
}
