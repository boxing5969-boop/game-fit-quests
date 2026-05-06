/**
 * 7일 스타터 캠프 — React hook (단계 43).
 *
 * Storage / Events / Steps 를 합성해 UI 가 사용하기 좋은 형태로 노출.
 * 모든 mutate 함수는 즉시 localStorage 반영 + 로컬 state 갱신.
 *
 * 보호 규칙:
 *   · DB / Supabase / RPC 호출 0
 *   · wallet / member_progress / 공식 XP 변경 0
 *   · 153마인드셋 키 / session id 0 변경
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  startTutorialCamp,
  setTutorialCampDayStep,
  advanceTutorialCampStep,
  completeTutorialCampDay,
  skipTutorialCampDay,
  pauseTutorialCamp,
  resetTutorialCamp,
} from "./tutorialCampUtils";
import { getTutorialCampState } from "./tutorialCampStorage";
import { appendTutorialCampEvent } from "./tutorialCampEvents";
import {
  getStep,
  getStepsByDay,
  type TutorialCampStep,
} from "./tutorialCampSteps";
import type { TutorialCampState } from "./tutorialCampTypes";

export interface UseTutorialCampReturn {
  state: TutorialCampState;
  /** 현재 day×step 에 해당하는 step 데이터. 없으면 null. */
  currentStep: TutorialCampStep | null;
  /** 현재 day 의 step 배열 */
  currentDaySteps: TutorialCampStep[];
  isActive: boolean;
  isCompleted: boolean;
  /** 캠프 시작 또는 paused 에서 재개 */
  start: () => void;
  /** 다음 step 으로 진행 (currentStep + 1) */
  next: () => void;
  /** day 단위 스킵. 미지정 시 현재 day */
  skipDay: (day?: number) => void;
  /** day 단위 완료. 미지정 시 현재 day. day=7 이면 캠프 자동 완료 */
  completeDay: (day?: number) => void;
  /** 캠프 진행 / 이벤트 / dev preview 전체 초기화 */
  reset: () => void;
  /** 일시 정지 */
  pause: () => void;
  /** 재개 (start 와 동일 시맨틱 — 명시적 분리) */
  resume: () => void;
  /**
   * UI 가 target 영역 클릭을 감지했을 때 호출 — target_clicked 이벤트 append.
   * step 진행은 별도(보통 next() 호출).
   */
  markTargetClicked: (
    targetKey: string,
    metadata?: Record<string, unknown>,
  ) => void;
  /** 임의 day×step 으로 이동 (replay / dev preview 등) */
  goToDayStep: (day: number, step: number) => void;
}

export function useTutorialCamp(): UseTutorialCampReturn {
  const [state, setState] = useState<TutorialCampState>(() =>
    getTutorialCampState(),
  );

  // 마운트 시 storage 동기화 (탭 간 변경 / 직접 storage 수정 대비)
  useEffect(() => {
    setState(getTutorialCampState());
  }, []);

  const start = useCallback(() => {
    setState(startTutorialCamp());
  }, []);

  const next = useCallback(() => {
    setState(advanceTutorialCampStep());
  }, []);

  const skipDay = useCallback((day?: number) => {
    const fresh = getTutorialCampState();
    const target = typeof day === "number" ? day : fresh.currentDay;
    setState(skipTutorialCampDay(target));
  }, []);

  const completeDay = useCallback((day?: number) => {
    const fresh = getTutorialCampState();
    const target = typeof day === "number" ? day : fresh.currentDay;
    setState(completeTutorialCampDay(target));
  }, []);

  const reset = useCallback(() => {
    setState(resetTutorialCamp());
  }, []);

  const pause = useCallback(() => {
    setState(pauseTutorialCamp());
  }, []);

  const resume = useCallback(() => {
    setState(startTutorialCamp());
  }, []);

  const goToDayStep = useCallback((day: number, step: number) => {
    setState(setTutorialCampDayStep(day, step));
  }, []);

  const markTargetClicked = useCallback(
    (targetKey: string, metadata?: Record<string, unknown>) => {
      const fresh = getTutorialCampState();
      const stepData = getStep(fresh.currentDay, fresh.currentStep);
      appendTutorialCampEvent({
        eventType: "target_clicked",
        day: fresh.currentDay,
        step: fresh.currentStep,
        targetKey,
        actionType: stepData?.actionType ?? null,
        metadata,
      });
    },
    [],
  );

  const currentStep = useMemo(
    () => getStep(state.currentDay, state.currentStep),
    [state.currentDay, state.currentStep],
  );

  const currentDaySteps = useMemo(
    () => getStepsByDay(state.currentDay),
    [state.currentDay],
  );

  const isActive = state.status === "active";
  const isCompleted = state.status === "completed";

  return {
    state,
    currentStep,
    currentDaySteps,
    isActive,
    isCompleted,
    start,
    next,
    skipDay,
    completeDay,
    reset,
    pause,
    resume,
    markTargetClicked,
    goToDayStep,
  };
}
