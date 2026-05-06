/**
 * 7일 스타터 캠프 — 이벤트 로그 (단계 42).
 *
 * 정책:
 *   · 최근 MAX_EVENTS(500) 개만 보관 (FIFO — unshift + slice)
 *   · 최신이 배열 앞 (디버깅 시 최근 이벤트부터 확인)
 *   · SSR-safe / try-catch / 깨진 데이터 → 빈 배열
 *   · DB / Supabase 호출 0
 */

import { MAX_EVENTS, STORAGE_EVENTS_KEY, TUTORIAL_VERSION } from "./tutorialCampConstants";
import type {
  AppendEventInput,
  TutorialCampEvent,
  TutorialCampEventType,
} from "./tutorialCampTypes";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallthrough
    }
  }
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function isValidEventType(t: unknown): t is TutorialCampEventType {
  return (
    t === "shown" ||
    t === "target_clicked" ||
    t === "step_completed" ||
    t === "day_completed" ||
    t === "skipped" ||
    t === "resumed" ||
    t === "reset" ||
    t === "completed_all" ||
    t === "dev_set_state"
  );
}

/** 깨진 이벤트는 제거하고 정상 형태만 통과. */
function normalizeEventList(raw: unknown): TutorialCampEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: TutorialCampEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!isValidEventType(r.eventType)) continue;
    out.push({
      id: typeof r.id === "string" ? r.id : generateId(),
      tutorialVersion: TUTORIAL_VERSION,
      day: typeof r.day === "number" ? r.day : null,
      step: typeof r.step === "number" ? r.step : null,
      eventType: r.eventType,
      routePath: typeof r.routePath === "string" ? r.routePath : null,
      targetKey: typeof r.targetKey === "string" ? r.targetKey : null,
      actionType: typeof r.actionType === "string" ? r.actionType : null,
      metadata:
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : {},
      createdAt: typeof r.createdAt === "string" ? r.createdAt : nowISO(),
    });
    if (out.length >= MAX_EVENTS) break;
  }
  return out;
}

/** 모든 이벤트 read — 최신이 앞. */
export function getTutorialCampEvents(): TutorialCampEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_EVENTS_KEY);
    if (!raw) return [];
    return normalizeEventList(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** 이벤트 1건 append — 최신이 앞으로. 500개 초과 시 가장 오래된 것 제거. */
export function appendTutorialCampEvent(input: AppendEventInput): TutorialCampEvent | null {
  if (!isBrowser()) return null;
  if (!isValidEventType(input.eventType)) return null;

  let routePath = input.routePath ?? null;
  if (routePath === null) {
    try {
      routePath = typeof window !== "undefined" ? window.location.pathname : null;
    } catch {
      routePath = null;
    }
  }

  const event: TutorialCampEvent = {
    id: generateId(),
    tutorialVersion: TUTORIAL_VERSION,
    day: input.day ?? null,
    step: input.step ?? null,
    eventType: input.eventType,
    routePath,
    targetKey: input.targetKey ?? null,
    actionType: input.actionType ?? null,
    metadata: input.metadata ?? {},
    createdAt: nowISO(),
  };

  try {
    const current = getTutorialCampEvents();
    const next = [event, ...current].slice(0, MAX_EVENTS);
    window.localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(next));
    return event;
  } catch {
    return null;
  }
}

/** 이벤트 로그 전체 삭제. (state 와 별개로 동작 — utils.resetTutorialCamp 가 함께 호출.) */
export function clearTutorialCampEvents(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_EVENTS_KEY);
  } catch {
    // ignore
  }
}
