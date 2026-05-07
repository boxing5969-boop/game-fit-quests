/**
 * 7일 스타터 캠프 — 고수준 상태 전이 함수 (단계 42).
 *
 * Storage / Events 모듈을 합성한 lifecycle 함수들.
 * 모든 변경은 즉시 localStorage 에 반영되며, 의미 있는 전이는 events 로그로 기록.
 *
 * 보호 원칙:
 *   · DB / Supabase / RPC 호출 0
 *   · wallet / member_progress / 공식 XP 변경 0
 *   · 153마인드셋 (myboxer.visualization.records) 키 / session id 0 변경
 */

import { MAX_DAY, MIN_DAY, MIN_STEP } from "./tutorialCampConstants";
import type { TutorialCampState } from "./tutorialCampTypes";
import {
  DEFAULT_STATE,
  clearDevPreviewStorage,
  clearTutorialCampStateStorage,
  getDevPreviewStorage,
  getTutorialCampState,
  saveTutorialCampState,
  setDevPreviewStorage,
} from "./tutorialCampStorage";
import {
  appendTutorialCampEvent,
  clearTutorialCampEvents,
} from "./tutorialCampEvents";
// 단계 47 — Day / 전체 캠프 완료 시 30초 마무리 sheet trigger (UI hook only)
import { triggerPostActionReflection } from "@/data/postActionReflectionMessages";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

export function clampDay(day: number): number {
  if (!Number.isFinite(day)) return MIN_DAY;
  return Math.min(MAX_DAY, Math.max(MIN_DAY, Math.floor(day)));
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return MIN_STEP;
  return Math.max(MIN_STEP, Math.floor(step));
}

function addUniqueDay(list: number[], day: number): number[] {
  const d = clampDay(day);
  if (list.includes(d)) return list;
  return [...list, d].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────
// Lifecycle 함수 (15개 export — 명세 기반)
// ─────────────────────────────────────────────────────────────

/**
 * 캠프 처음 시작 또는 paused 상태에서 재개.
 *   · status not_started → active + startedAt 기록
 *   · status paused → active + resumed 이벤트
 *   · status completed/skipped 재시작 시에는 resetTutorialCamp() 사용 권장
 */
export function startTutorialCamp(): TutorialCampState {
  const cur = getTutorialCampState();
  const ts = nowISO();

  if (cur.status === "active") {
    // 이미 active — lastSeenAt 만 갱신
    const next: TutorialCampState = { ...cur, lastSeenAt: ts };
    saveTutorialCampState(next);
    return next;
  }

  const wasPaused = cur.status === "paused";
  const next: TutorialCampState = {
    ...cur,
    status: "active",
    startedAt: cur.startedAt ?? ts,
    lastSeenAt: ts,
  };
  saveTutorialCampState(next);

  if (wasPaused) {
    appendTutorialCampEvent({
      eventType: "resumed",
      day: next.currentDay,
      step: next.currentStep,
    });
  }
  return next;
}

/**
 * day / step 강제 설정. clamp 적용.
 * devPreviewMode=true 일 때 dev_set_state 이벤트 자동 append.
 */
export function setTutorialCampDayStep(day: number, step: number): TutorialCampState {
  const cur = getTutorialCampState();
  const nextDay = clampDay(day);
  const nextStep = clampStep(step);
  const next: TutorialCampState = {
    ...cur,
    currentDay: nextDay,
    currentStep: nextStep,
    lastSeenAt: nowISO(),
  };
  saveTutorialCampState(next);

  if (next.devPreviewMode) {
    appendTutorialCampEvent({
      eventType: "dev_set_state",
      day: nextDay,
      step: nextStep,
      metadata: { source: "setTutorialCampDayStep" },
    });
  }
  return next;
}

/**
 * 현재 step + 1.
 * day boundary(다음 day 진입)는 호출자가 completeTutorialCampDay 로 명시 처리.
 * step_completed 이벤트 자동 append.
 */
export function advanceTutorialCampStep(): TutorialCampState {
  const cur = getTutorialCampState();
  const nextStep = clampStep(cur.currentStep + 1);
  const next: TutorialCampState = {
    ...cur,
    currentStep: nextStep,
    lastSeenAt: nowISO(),
  };
  saveTutorialCampState(next);

  appendTutorialCampEvent({
    eventType: "step_completed",
    day: next.currentDay,
    step: cur.currentStep, // 완료한 step 번호
  });
  return next;
}

/**
 * Day 완료 처리.
 *   · completedDays 에 추가 (중복 방지)
 *   · day=7 이면 markTutorialCampCompleted() 자동 호출
 *   · 그 외엔 currentDay = day+1, currentStep = 0
 *   · day_completed 이벤트 자동 append
 */
export function completeTutorialCampDay(day: number): TutorialCampState {
  const cur = getTutorialCampState();
  const completedDay = clampDay(day);
  const ts = nowISO();

  const completedDays = addUniqueDay(cur.completedDays, completedDay);

  let next: TutorialCampState;
  if (completedDay >= MAX_DAY) {
    // Day 7 완료 → 전체 캠프 완료
    next = {
      ...cur,
      completedDays,
      currentDay: MAX_DAY,
      currentStep: cur.currentStep,
      status: "completed",
      completedAt: cur.completedAt ?? ts,
      lastSeenAt: ts,
      lastDayCompletedAt: ts,
    };
    saveTutorialCampState(next);
    appendTutorialCampEvent({
      eventType: "day_completed",
      day: completedDay,
    });
    appendTutorialCampEvent({
      eventType: "completed_all",
      day: completedDay,
    });
    // Day 7 완료식은 force=true — 하루 1회 제한 무시 (큰 의식)
    triggerPostActionReflection("camp_finish", { force: true });
    return next;
  }

  // Day cooldown — 하루 1 Day 정책.
  //   · currentDay 는 다음 day 로 이동해 두지만, status="paused" 로 전환해
  //     같은 날 안에서 overlay 자동 진입을 막는다.
  //   · 다음날(자정 이후) 진입 시 Provider 가 자동으로 status="active" 복귀.
  next = {
    ...cur,
    completedDays,
    currentDay: clampDay(completedDay + 1),
    currentStep: MIN_STEP,
    status: "paused",
    lastSeenAt: ts,
    lastDayCompletedAt: ts,
  };
  saveTutorialCampState(next);
  appendTutorialCampEvent({
    eventType: "day_completed",
    day: completedDay,
  });
  triggerPostActionReflection("camp_day");
  return next;
}

/**
 * Day 단위 스킵.
 *   · skippedDays 에 추가
 *   · skippedAt 기록
 *   · status 는 그대로 (전체 캠프 스킵은 별도 정책 — 본 함수는 day skip 만)
 *   · 다음 day(있으면)로 currentDay 이동, currentStep 0
 *   · skipped 이벤트 자동 append
 */
export function skipTutorialCampDay(day: number): TutorialCampState {
  const cur = getTutorialCampState();
  const skippedDay = clampDay(day);
  const ts = nowISO();

  const skippedDays = addUniqueDay(cur.skippedDays, skippedDay);
  const nextDay = skippedDay >= MAX_DAY ? MAX_DAY : clampDay(skippedDay + 1);

  const next: TutorialCampState = {
    ...cur,
    skippedDays,
    currentDay: nextDay,
    currentStep: MIN_STEP,
    skippedAt: ts,
    lastSeenAt: ts,
  };
  saveTutorialCampState(next);
  appendTutorialCampEvent({
    eventType: "skipped",
    day: skippedDay,
    metadata: { scope: "day" },
  });
  return next;
}

/**
 * 캠프 일시 정지. status="paused".
 * 이후 startTutorialCamp() 호출 시 resumed 이벤트 발생.
 */
export function pauseTutorialCamp(): TutorialCampState {
  const cur = getTutorialCampState();
  const next: TutorialCampState = {
    ...cur,
    status: "paused",
    lastSeenAt: nowISO(),
  };
  saveTutorialCampState(next);
  return next;
}

/**
 * 캠프 진행을 모두 초기화.
 *   · state → DEFAULT_STATE (단, 깔끔하게 새로 시작)
 *   · events 전체 삭제 + reset 1건만 남김
 *   · dev preview 저장소 삭제
 */
export function resetTutorialCamp(): TutorialCampState {
  clearTutorialCampStateStorage();
  clearTutorialCampEvents();
  clearDevPreviewStorage();

  const next: TutorialCampState = { ...DEFAULT_STATE };
  saveTutorialCampState(next);
  appendTutorialCampEvent({
    eventType: "reset",
  });
  return next;
}

/**
 * 캠프 전체 완료 마크.
 *   · status="completed" + completedAt 기록
 *   · completed_all 이벤트 자동 append
 *   · completeTutorialCampDay(7) 가 내부에서 이미 호출하지만, 외부에서 강제로
 *     완료시키고 싶을 때(예: Day 7 마지막 step 통과 후) 별도로 호출 가능.
 */
export function markTutorialCampCompleted(): TutorialCampState {
  const cur = getTutorialCampState();
  if (cur.status === "completed") {
    return cur;
  }
  const ts = nowISO();
  const next: TutorialCampState = {
    ...cur,
    status: "completed",
    completedAt: cur.completedAt ?? ts,
    currentDay: MAX_DAY,
    lastSeenAt: ts,
  };
  saveTutorialCampState(next);
  appendTutorialCampEvent({
    eventType: "completed_all",
    day: MAX_DAY,
  });
  return next;
}

// ─────────────────────────────────────────────────────────────
// Dev preview
// ─────────────────────────────────────────────────────────────

/**
 * 개발자 preview 모드 활성.
 *   · state.devPreviewMode = true
 *   · state.currentDay / currentStep 강제 설정
 *   · 별도 dev preview 저장소에 day/step/enabledAt 기록
 *   · dev_set_state 이벤트 append
 *
 * ⚠️ 회원 UI 노출 0 — 호출 가드는 호출처(콘솔 명령 / ?camp=dev / super_admin)가 책임.
 */
export function enableDevPreview(day: number, step: number): TutorialCampState {
  const cur = getTutorialCampState();
  const nextDay = clampDay(day);
  const nextStep = clampStep(step);
  const ts = nowISO();

  const next: TutorialCampState = {
    ...cur,
    currentDay: nextDay,
    currentStep: nextStep,
    devPreviewMode: true,
    lastSeenAt: ts,
  };
  saveTutorialCampState(next);
  setDevPreviewStorage({ day: nextDay, step: nextStep, enabledAt: ts });
  appendTutorialCampEvent({
    eventType: "dev_set_state",
    day: nextDay,
    step: nextStep,
    metadata: { source: "enableDevPreview" },
  });
  return next;
}

/** 개발자 preview 모드 해제. dev_set_state 이벤트(disable) append. */
export function disableDevPreview(): TutorialCampState {
  const cur = getTutorialCampState();
  const next: TutorialCampState = {
    ...cur,
    devPreviewMode: false,
    lastSeenAt: nowISO(),
  };
  saveTutorialCampState(next);
  clearDevPreviewStorage();
  appendTutorialCampEvent({
    eventType: "dev_set_state",
    day: cur.currentDay,
    step: cur.currentStep,
    metadata: { source: "disableDevPreview", action: "disabled" },
  });
  return next;
}

// 호출자가 dev preview 저장소만 read 하고 싶을 때 사용.
// (state.devPreviewMode 와 별개 — 저장소 내용 직접 확인용)
export { getDevPreviewStorage } from "./tutorialCampStorage";
