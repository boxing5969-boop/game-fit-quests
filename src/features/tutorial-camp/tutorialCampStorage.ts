/**
 * 7일 스타터 캠프 — 저수준 localStorage 저장소 (단계 42).
 *
 * 정책:
 *   · SSR-safe: typeof window === "undefined" 체크
 *   · 모든 read/write try/catch — 깨진 데이터 → default fallback
 *   · QuotaExceeded 등 write 실패는 조용히 무시 (회원 경험 우선)
 *   · DB / Supabase / API 호출 0
 */

import {
  STORAGE_STATE_KEY,
  STORAGE_DEV_PREVIEW_KEY,
  TUTORIAL_VERSION,
  MIN_DAY,
  MAX_DAY,
  MIN_STEP,
} from "./tutorialCampConstants";
import type {
  TutorialCampState,
  TutorialCampStatus,
  TutorialCampDevPreview,
} from "./tutorialCampTypes";

// ─────────────────────────────────────────────────────────────
// Default state — state 깨졌을 때 폴백
// ─────────────────────────────────────────────────────────────

export const DEFAULT_STATE: TutorialCampState = {
  tutorialVersion: TUTORIAL_VERSION,
  status: "not_started",
  currentDay: MIN_DAY,
  currentStep: MIN_STEP,
  completedDays: [],
  skippedDays: [],
  startedAt: null,
  completedAt: null,
  skippedAt: null,
  lastSeenAt: null,
  replayMode: false,
  devPreviewMode: false,
  metadata: {},
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function clampDay(day: unknown): number {
  const n = typeof day === "number" && Number.isFinite(day) ? Math.floor(day) : MIN_DAY;
  return Math.min(MAX_DAY, Math.max(MIN_DAY, n));
}

function clampStep(step: unknown): number {
  const n = typeof step === "number" && Number.isFinite(step) ? Math.floor(step) : MIN_STEP;
  return Math.max(MIN_STEP, n);
}

function uniqueSortedDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const set = new Set<number>();
  for (const d of days) {
    if (typeof d === "number" && Number.isFinite(d) && d >= MIN_DAY && d <= MAX_DAY) {
      set.add(Math.floor(d));
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

function isValidStatus(s: unknown): s is TutorialCampStatus {
  return (
    s === "not_started" ||
    s === "active" ||
    s === "completed" ||
    s === "skipped" ||
    s === "paused"
  );
}

/**
 * 임의 데이터를 받아 안전한 TutorialCampState 로 정규화.
 * 깨진 필드는 default 로 폴백.
 */
function normalizeState(raw: unknown): TutorialCampState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  const r = raw as Record<string, unknown>;
  return {
    tutorialVersion: TUTORIAL_VERSION,
    status: isValidStatus(r.status) ? r.status : DEFAULT_STATE.status,
    currentDay: clampDay(r.currentDay),
    currentStep: clampStep(r.currentStep),
    completedDays: uniqueSortedDays(r.completedDays),
    skippedDays: uniqueSortedDays(r.skippedDays),
    startedAt: typeof r.startedAt === "string" ? r.startedAt : null,
    completedAt: typeof r.completedAt === "string" ? r.completedAt : null,
    skippedAt: typeof r.skippedAt === "string" ? r.skippedAt : null,
    lastSeenAt: typeof r.lastSeenAt === "string" ? r.lastSeenAt : null,
    replayMode: r.replayMode === true,
    devPreviewMode: r.devPreviewMode === true,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
  };
}

// ─────────────────────────────────────────────────────────────
// State CRUD
// ─────────────────────────────────────────────────────────────

/**
 * 현재 캠프 상태 read.
 * SSR / 깨진 데이터 / read 실패 시 default state 반환.
 */
export function getTutorialCampState(): TutorialCampState {
  if (!isBrowser()) return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_STATE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** 동일 탭 안의 다른 hook 인스턴스에게 변경 알림 — useTutorialCamp 가 listen. */
export const TUTORIAL_CAMP_STATE_EVENT = "tutorial-camp:state-changed";

/**
 * 캠프 상태 write.
 * 입력은 정규화 후 저장 — 외부에서 잘못된 값을 넣어도 깨진 채 보관 안 됨.
 * QuotaExceeded 등은 조용히 무시.
 *
 * 저장 직후 same-tab 변경 알림 이벤트 dispatch — 다른 hook 인스턴스 즉시 sync.
 */
export function saveTutorialCampState(state: TutorialCampState): void {
  if (!isBrowser()) return;
  try {
    const safe = normalizeState(state);
    window.localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(safe));
    try {
      window.dispatchEvent(new CustomEvent(TUTORIAL_CAMP_STATE_EVENT));
    } catch {
      // 이벤트 디스패치 실패는 조용히 무시 (저장 자체는 성공)
    }
  } catch {
    // QuotaExceeded / 보안 정책 등 — 조용히 무시
  }
}

/** state 저장소만 삭제 (events 는 별도 모듈). */
export function clearTutorialCampStateStorage(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_STATE_KEY);
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Dev preview 저수준 저장소
// ─────────────────────────────────────────────────────────────

export function getDevPreviewStorage(): TutorialCampDevPreview | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_DEV_PREVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const day = clampDay(parsed.day);
    const step = clampStep(parsed.step);
    const enabledAt =
      typeof parsed.enabledAt === "string" ? parsed.enabledAt : new Date().toISOString();
    return { day, step, enabledAt };
  } catch {
    return null;
  }
}

export function setDevPreviewStorage(preview: TutorialCampDevPreview): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      STORAGE_DEV_PREVIEW_KEY,
      JSON.stringify({
        day: clampDay(preview.day),
        step: clampStep(preview.step),
        enabledAt: preview.enabledAt,
      }),
    );
  } catch {
    // ignore
  }
}

export function clearDevPreviewStorage(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_DEV_PREVIEW_KEY);
  } catch {
    // ignore
  }
}
