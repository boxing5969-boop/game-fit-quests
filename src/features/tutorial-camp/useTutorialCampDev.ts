/**
 * 7일 스타터 캠프 — 개발자 / super_admin preview hook (단계 43).
 *
 * 단계 46 의 admin preview 패널에서 사용.
 * ⚠️ 회원 UI 노출 0 — 호출처(콘솔 명령 / `?camp=dev` / super_admin 가드) 책임.
 *
 * 보호 규칙:
 *   · DB / Supabase / RPC 호출 0
 *   · UI 자동 노출 X — 단순 hook
 */

import { useCallback, useEffect, useState } from "react";
import {
  enableDevPreview,
  disableDevPreview,
} from "./tutorialCampUtils";
import {
  getTutorialCampState,
  getDevPreviewStorage,
} from "./tutorialCampStorage";
import { getTutorialCampEvents } from "./tutorialCampEvents";
import type {
  TutorialCampDevPreview,
  TutorialCampEvent,
  TutorialCampState,
} from "./tutorialCampTypes";

export interface UseTutorialCampDevReturn {
  /** 현재 캠프가 dev preview 모드인지 */
  devPreviewMode: boolean;
  /** 임의 day×step 으로 강제 이동 + devPreviewMode=true */
  setDevDayStep: (day: number, step: number) => void;
  /** dev preview 해제 — devPreviewMode=false + 저장소 삭제 */
  resetDevPreview: () => void;
  /** 디버깅용 — 현재 state / events / devPreview 저장소를 한 번에 read */
  getDebugState: () => {
    state: TutorialCampState;
    events: TutorialCampEvent[];
    devPreview: TutorialCampDevPreview | null;
  };
}

export function useTutorialCampDev(): UseTutorialCampDevReturn {
  const [state, setState] = useState<TutorialCampState>(() =>
    getTutorialCampState(),
  );

  useEffect(() => {
    setState(getTutorialCampState());
  }, []);

  const setDevDayStep = useCallback((day: number, step: number) => {
    setState(enableDevPreview(day, step));
  }, []);

  const resetDevPreview = useCallback(() => {
    setState(disableDevPreview());
  }, []);

  const getDebugState = useCallback(() => {
    return {
      state: getTutorialCampState(),
      events: getTutorialCampEvents(),
      devPreview: getDevPreviewStorage(),
    };
  }, []);

  return {
    devPreviewMode: state.devPreviewMode,
    setDevDayStep,
    resetDevPreview,
    getDebugState,
  };
}
