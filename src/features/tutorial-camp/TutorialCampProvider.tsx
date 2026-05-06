/**
 * 7일 스타터 캠프 — overlay Provider (단계 44).
 *
 * 역할:
 *   · useTutorialCamp + useLocation 매칭
 *   · target click 감지 → markTargetClicked + (requireTargetClick=true 면) auto-next
 *   · isActive 가 아니면 아무것도 렌더 X
 *   · animation === "celebration"/"confetti" → TutorialCelebration
 *   · 그 외 → TutorialOverlay
 *
 * App.tsx 의 ProtectedRoute 안에서 한 번 마운트되면 모든 라우트 위에 떠 있다.
 *
 * 보호 규칙:
 *   · BottomNav / 기존 라우트 0 변경
 *   · DB / API 호출 0
 *   · 153마인드셋 / 공식 훈련 / wallet 0 영향
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTutorialCamp } from "./useTutorialCamp";
import { useTutorialTarget } from "./useTutorialTarget";
import {
  appendTutorialCampEvent,
} from "./tutorialCampEvents";
import {
  getStepsCountByDay,
} from "./tutorialCampSteps";
import TutorialOverlay from "./TutorialOverlay";
import TutorialCelebration from "./TutorialCelebration";

const TutorialCampProvider = () => {
  const camp = useTutorialCamp();
  const location = useLocation();
  const navigate = useNavigate();

  const [targetClicked, setTargetClicked] = useState(false);
  const lastStepKeyRef = useRef<string | null>(null);

  // 활성 step 결정
  const step = camp.currentStep;
  const isActiveCamp = camp.isActive && step !== null;

  // step 변경 시 targetClicked 리셋
  useEffect(() => {
    if (!step) {
      lastStepKeyRef.current = null;
      setTargetClicked(false);
      return;
    }
    const key = `${step.day}.${step.step}`;
    if (lastStepKeyRef.current !== key) {
      lastStepKeyRef.current = key;
      setTargetClicked(false);
    }
  }, [step]);

  // 라우트 매칭
  const routeMatch = useMemo(() => {
    if (!step) return true;
    if (!step.route) return true;
    // exact match 또는 prefix match (예: /guide/safety)
    return location.pathname === step.route;
  }, [location.pathname, step]);

  // target rect — selector 가 있고 라우트 매칭됐을 때만
  const targetSelector =
    step && routeMatch && step.targetSelector ? step.targetSelector : null;
  const rect = useTutorialTarget(targetSelector);

  // step 진입 시 shown 이벤트 1회 append
  const shownStepKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    const key = `${step.day}.${step.step}`;
    if (shownStepKeyRef.current === key) return;
    shownStepKeyRef.current = key;
    appendTutorialCampEvent({
      eventType: "shown",
      day: step.day,
      step: step.step,
      targetKey: step.targetKey,
      actionType: step.actionType,
      routePath: location.pathname,
    });
  }, [isActiveCamp, step, location.pathname]);

  // target click 감지 — DOM element 에 capture-phase listener 부착
  useEffect(() => {
    if (!isActiveCamp || !step || !rect?.found) return;
    if (typeof document === "undefined") return;
    let element: Element | null = null;
    try {
      element = document.querySelector(step.targetSelector);
    } catch {
      element = null;
    }
    if (!element) return;

    const onClick = () => {
      setTargetClicked(true);
      camp.markTargetClicked(step.targetKey, {
        route: location.pathname,
      });
      // requireTargetClick=true 면 잠시 후 자동 next (자연스러운 흐름)
      if (step.requireTargetClick) {
        setTimeout(() => {
          camp.next();
        }, 600);
      }
    };
    element.addEventListener("click", onClick, { capture: true });
    return () => {
      element?.removeEventListener("click", onClick, { capture: true });
    };
    // step.targetSelector 가 바뀌어도 element 재탐색
  }, [isActiveCamp, step, rect?.found, camp, location.pathname]);

  // 핸들러
  const handleNext = useCallback(() => {
    if (!step) return;
    // Day 마지막 step 인 경우 — completeDay 호출
    const dayStepCount = getStepsCountByDay(step.day);
    if (step.step >= dayStepCount - 1) {
      camp.completeDay(step.day);
      return;
    }
    camp.next();
  }, [step, camp]);

  const handleSkipDay = useCallback(() => {
    if (!step) return;
    camp.skipDay(step.day);
  }, [step, camp]);

  const handlePause = useCallback(() => {
    camp.pause();
  }, [camp]);

  const handleGoToRoute = useCallback(() => {
    if (!step) return;
    if (step.route && step.route !== location.pathname) {
      navigate(step.route);
    }
  }, [step, location.pathname, navigate]);

  const handleDimNudge = useCallback(() => {
    // dim 영역 클릭 시 안내 깜빡임 — 별도 토스트 X (조용한 UX)
    // 추후 단계에서 nudge 효과 추가 가능
  }, []);

  const handleCelebrationContinue = useCallback(() => {
    // celebration 화면에서 "오늘 캠프 마치기" / "7일 캠프 마치기" 버튼
    if (!step) return;
    // celebration 또는 confetti step 은 항상 day 의 마지막
    camp.completeDay(step.day);
  }, [step, camp]);

  // 마운트 가드
  if (!isActiveCamp || !step) return null;

  // celebration / confetti 분기
  if (step.animation === "celebration" || step.animation === "confetti") {
    return (
      <TutorialCelebration
        step={step}
        onContinue={handleCelebrationContinue}
      />
    );
  }

  const totalStepsInDay = getStepsCountByDay(step.day);

  return (
    <TutorialOverlay
      step={step}
      rect={rect}
      routeMatch={routeMatch}
      targetClicked={targetClicked}
      totalStepsInDay={totalStepsInDay}
      onNext={handleNext}
      onSkipDay={handleSkipDay}
      onPause={handlePause}
      onGoToRoute={handleGoToRoute}
      onMarkClicked={() => setTargetClicked(true)}
      onDimNudge={handleDimNudge}
    />
  );
};

export default TutorialCampProvider;
