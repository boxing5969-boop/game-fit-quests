/**
 * 🥊 붕대 감기 — 이 기기에서 고른 것 기억 (2026-11-12).
 *
 *   감는 손(오른손 · 왼손) · 보는 방법(실제 영상 · 그림) · 속도(영상 · 그림 따로).
 *   전체 영상 · 12단계 한눈에 · 단계 상세가 같은 값을 쓴다 — 한 곳에서 손을 바꾸면 화면 전체가 같이 바뀐다.
 *   못 쓰는 브라우저(사생활 보호 창 등)면 기억만 못 하고 기본값으로 돈다.
 *   손 · 그림 속도는 예전 키 그대로 (mb153.handwrap.hand · mb153.handwrap.rate2) — 회원이 골라 둔 것을 잃지 않게.
 */
import { useSyncExternalStore } from "react";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_DEFAULT_REAL_RATE,
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_DEFAULT_VIEW,
  HANDWRAP_STEP_SPEEDS,
  type HandSide,
  type HandWrapView,
} from "@/data/handWrapGuide";

export interface HandWrapPrefs {
  hand: HandSide;
  view: HandWrapView;
  /** 그림 애니메이션 속도 */
  drawRate: number;
  /** 실제 영상 속도 */
  realRate: number;
}

const KEYS = {
  hand: "mb153.handwrap.hand",
  view: "mb153.handwrap.view",
  drawRate: "mb153.handwrap.rate2",
  realRate: "mb153.handwrap.rate.real",
} as const;

const readRaw = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeRaw = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* 사생활 보호 창 등 — 기억만 못 할 뿐 */
  }
};

const validRate = (raw: string | null, fallback: number): number => {
  const r = Number(raw);
  return raw != null && HANDWRAP_STEP_SPEEDS.some((s) => s.rate === r) ? r : fallback;
};

const load = (): HandWrapPrefs => {
  const hand = readRaw(KEYS.hand);
  const view = readRaw(KEYS.view);
  return {
    hand: hand === "left" || hand === "right" ? hand : HANDWRAP_DEFAULT_HAND,
    view: view === "real" || view === "draw" ? view : HANDWRAP_DEFAULT_VIEW,
    drawRate: validRate(readRaw(KEYS.drawRate), HANDWRAP_DEFAULT_STEP_RATE),
    realRate: validRate(readRaw(KEYS.realRate), HANDWRAP_DEFAULT_REAL_RATE),
  };
};

let state: HandWrapPrefs | null = null;
const listeners = new Set<() => void>();

const snapshot = (): HandWrapPrefs => (state ??= load());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const update = (patch: Partial<HandWrapPrefs>) => {
  state = { ...snapshot(), ...patch };
  listeners.forEach((fn) => fn());
};

export const setHandWrapHand = (hand: HandSide) => {
  update({ hand });
  writeRaw(KEYS.hand, hand);
};
export const setHandWrapView = (view: HandWrapView) => {
  update({ view });
  writeRaw(KEYS.view, view);
};
/** 지금 보는 방법의 속도만 바꾼다 — 영상을 천천히 본다고 그림까지 느려지지 않게 */
export const setHandWrapRate = (view: HandWrapView, rate: number) => {
  if (!HANDWRAP_STEP_SPEEDS.some((s) => s.rate === rate)) return;
  if (view === "real") {
    update({ realRate: rate });
    writeRaw(KEYS.realRate, String(rate));
  } else {
    update({ drawRate: rate });
    writeRaw(KEYS.drawRate, String(rate));
  }
};

/** 시험용 — 저장소를 다시 읽게 */
export const resetHandWrapPrefsForTest = () => {
  state = null;
};

export function useHandWrapPrefs(): HandWrapPrefs {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
