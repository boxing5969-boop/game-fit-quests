/**
 * 🥊 복싱 타이머 — 계산 한 곳 (2026-11-22 대표님 「회원님들 자율운동할때 사용할수있는 타이머 · 소리는 최대한 크게 · 복싱 타이머」)
 *
 *   · 준비(0 · 5 · 10초) → 라운드 → 쉬는 시간 → 라운드 … → 끝. 라운드 수 0 = 무제한(멈출 때까지).
 *   · 화면은 지난 시간(ms)만 들고, 지금 구간 · 남은 시간 · 울릴 소리는 모두 여기서 셈한다(시계로 세서 화면을 껐다 켜도 맞음).
 *   · 소리 신호: 라운드 시작 = 공 한 번 · 라운드 끝 = 공 세 번 · 라운드 10초 전 = 딱딱이 ·
 *     준비 · 쉬는 시간 마지막 3초 = 삐 삐 삐 · 모두 끝 = 공 세 번(길게).
 *   화면 · 소리는 components/training/BoxingTimerSheet · lib/loudBell. 시험 boxingTimer.test.ts
 */

export type TimerSettings = {
  /** 라운드 길이(초) */
  roundSec: number;
  /** 쉬는 시간(초) */
  restSec: number;
  /** 라운드 수 — 0 = 무제한 */
  rounds: number;
  /** 시작 전 준비(초) */
  prepSec: number;
  /** 라운드 끝 10초 전 딱딱이 */
  warn10: boolean;
};

export const ROUND_MIN = 30;
export const ROUND_MAX = 10 * 60;
export const ROUND_STEP = 30;
export const REST_MIN = 10;
export const REST_MAX = 3 * 60;
export const REST_STEP = 10;
export const ROUNDS_MAX = 20;
export const PREP_CHOICES = [0, 5, 10] as const;
export const WARN_AT_SEC = 10;

export const DEFAULT_TIMER: TimerSettings = { roundSec: 180, restSec: 30, rounds: 6, prepSec: 10, warn10: true };

export type TimerPreset = { id: string; name: string; sub: string; s: Omit<TimerSettings, "warn10" | "prepSec"> };

/** 자주 쓰는 틀 — 누르면 그대로 채워진다 */
export const TIMER_PRESETS: readonly TimerPreset[] = [
  { id: "free", name: "자율 운동", sub: "3분 · 쉬기 30초 · 6라운드", s: { roundSec: 180, restSec: 30, rounds: 6 } },
  { id: "pro", name: "프로 경기", sub: "3분 · 쉬기 1분 · 12라운드", s: { roundSec: 180, restSec: 60, rounds: 12 } },
  { id: "amateur", name: "아마추어 경기", sub: "2분 · 쉬기 1분 · 3라운드", s: { roundSec: 120, restSec: 60, rounds: 3 } },
  { id: "sandbag", name: "샌드백 인터벌", sub: "1분 · 쉬기 30초 · 10라운드", s: { roundSec: 60, restSec: 30, rounds: 10 } },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;

/** 저장해 둔 값 · 손으로 고친 값을 믿지 않고 다듬는다 */
export function normalizeTimer(v: unknown): TimerSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof TimerSettings, unknown>>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  const prep = num(o.prepSec, DEFAULT_TIMER.prepSec);
  return {
    roundSec: clamp(snap(num(o.roundSec, DEFAULT_TIMER.roundSec), ROUND_STEP), ROUND_MIN, ROUND_MAX),
    restSec: clamp(snap(num(o.restSec, DEFAULT_TIMER.restSec), REST_STEP), REST_MIN, REST_MAX),
    rounds: clamp(Math.round(num(o.rounds, DEFAULT_TIMER.rounds)), 0, ROUNDS_MAX),
    prepSec: (PREP_CHOICES as readonly number[]).includes(prep) ? prep : DEFAULT_TIMER.prepSec,
    warn10: typeof o.warn10 === "boolean" ? o.warn10 : DEFAULT_TIMER.warn10,
  };
}

export type PhaseKind = "prep" | "round" | "rest" | "done";

export type TimerPhase = {
  kind: PhaseKind;
  /** 지금(또는 다음) 라운드 번호 — 1부터 · 준비 중이면 1 · 끝이면 마지막 라운드 */
  round: number;
  /** 이 구간에 남은 ms (끝이면 0) */
  remainingMs: number;
  /** 이 구간 길이 ms */
  lengthMs: number;
  /** 이 구간이 시작된 시각(지난 시간 기준 ms) */
  startMs: number;
};

const S = 1000;

/** 무제한이 아니면 전체 길이(ms) — 준비 + 라운드 n + 쉬기 n-1 */
export function totalMs(s: TimerSettings): number | null {
  if (s.rounds <= 0) return null;
  return (s.prepSec + s.rounds * s.roundSec + (s.rounds - 1) * s.restSec) * S;
}

/** 지난 시간(ms) → 지금 구간 */
export function phaseAt(s: TimerSettings, elapsedMs: number): TimerPhase {
  const t = Math.max(0, elapsedMs);
  const prep = s.prepSec * S;
  const round = s.roundSec * S;
  const rest = s.restSec * S;
  if (t < prep) return { kind: "prep", round: 1, remainingMs: prep - t, lengthMs: prep, startMs: 0 };
  const total = totalMs(s);
  if (total != null && t >= total) {
    return { kind: "done", round: s.rounds, remainingMs: 0, lengthMs: 0, startMs: total };
  }
  const cycle = round + rest;
  const k = Math.floor((t - prep) / cycle);
  const inCycle = t - prep - k * cycle;
  const cycleStart = prep + k * cycle;
  if (inCycle < round) {
    return { kind: "round", round: k + 1, remainingMs: round - inCycle, lengthMs: round, startMs: cycleStart };
  }
  return { kind: "rest", round: k + 2, remainingMs: cycle - inCycle, lengthMs: rest, startMs: cycleStart + round };
}

/** 다음 구간이 시작되는 시각 — 「건너뛰기」 · 끝이면 그대로 */
export function nextPhaseStart(s: TimerSettings, elapsedMs: number): number {
  const p = phaseAt(s, elapsedMs);
  if (p.kind === "done") return elapsedMs;
  return p.startMs + p.lengthMs;
}

export type CueKind = "roundStart" | "roundEnd" | "warn" | "tick" | "finish";
export type Cue = { at: number; kind: CueKind; round: number };

/**
 * (from, to] 사이에 울릴 소리 — 시각 순. 시작 순간(0)은 from 을 -1 로 주면 들어간다.
 * 무제한이면 to 까지만 만든다.
 */
export function cuesBetween(s: TimerSettings, from: number, to: number): Cue[] {
  if (to <= from) return [];
  const out: Cue[] = [];
  const push = (at: number, kind: CueKind, round: number) => {
    if (at > from && at <= to) out.push({ at, kind, round });
  };
  const prep = s.prepSec * S;
  const round = s.roundSec * S;
  const rest = s.restSec * S;
  const cycle = round + rest;
  const n = s.rounds > 0 ? s.rounds : Math.ceil(Math.max(0, to - prep) / cycle) + 1;
  for (let sec = 3; sec >= 1; sec--) if (prep - sec * S >= 0) push(prep - sec * S, "tick", 1);
  for (let r = 1; r <= n; r++) {
    const start = prep + (r - 1) * cycle;
    if (start > to) break;
    push(start, "roundStart", r);
    if (s.warn10 && round > WARN_AT_SEC * S * 2) push(start + round - WARN_AT_SEC * S, "warn", r);
    const end = start + round;
    const last = s.rounds > 0 && r === s.rounds;
    push(end, last ? "finish" : "roundEnd", r);
    if (!last) for (let sec = 3; sec >= 1; sec--) if (rest > sec * S) push(end + rest - sec * S, "tick", r + 1);
  }
  return out.sort((a, b) => a.at - b.at || order(a.kind) - order(b.kind));
}

const order = (k: CueKind) => ({ roundEnd: 0, finish: 0, roundStart: 1, warn: 2, tick: 3 })[k];

/**
 * 화면을 껐다 켜서 몇 초가 한꺼번에 지나갔으면 — 다 울리지 않고 마지막 신호 하나만(그것도 1.5초 안의 것만)
 */
export const CUE_STALE_MS = 1500;
export function cuesToPlay(s: TimerSettings, from: number, to: number): Cue[] {
  const all = cuesBetween(s, from, to).filter((c) => to - c.at <= CUE_STALE_MS);
  if (to - from <= CUE_STALE_MS) return all;
  return all.length ? [all[all.length - 1]] : [];
}

/** 0:00 모양 — 남은 시간은 올림(0.2초 남았으면 0:01) */
export function clockText(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / S));
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

/** '3분' · '1분 30초' · '30초' */
export function durationText(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  if (m && r) return `${m}분 ${r}초`;
  return m ? `${m}분` : `${r}초`;
}

export function roundsText(n: number): string {
  return n > 0 ? `${n}라운드` : "무제한";
}

export function phaseLabel(p: TimerPhase, s: TimerSettings): string {
  if (p.kind === "prep") return "준비";
  if (p.kind === "done") return "끝!";
  if (p.kind === "rest") return "쉬는 시간";
  return s.rounds > 0 && p.round === s.rounds && s.rounds > 1 ? "마지막 라운드" : `${p.round}라운드`;
}

/** 설정 한 줄 — '3분 · 쉬기 30초 · 6라운드' */
export function settingsLine(s: TimerSettings): string {
  return `${durationText(s.roundSec)} · 쉬기 ${durationText(s.restSec)} · ${roundsText(s.rounds)}`;
}

/** 지금 설정이 어느 틀과 같은가 */
export function presetOf(s: TimerSettings): string | null {
  const p = TIMER_PRESETS.find((x) => x.s.roundSec === s.roundSec && x.s.restSec === s.restSec && x.s.rounds === s.rounds);
  return p?.id ?? null;
}
