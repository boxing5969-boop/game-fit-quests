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

  // ── Day cooldown — 다음날 진입 시 paused → active 자동 복귀 ──
  //   · completeTutorialCampDay 가 status="paused" + lastDayCompletedAt 기록
  //   · 마운트 시 lastDayCompletedAt 이 어제 이전이면 자동 resume
  useEffect(() => {
    if (camp.state.status !== "paused") return;
    if (!camp.state.lastDayCompletedAt) return;
    if (camp.state.currentDay > 7) return;
    const last = new Date(camp.state.lastDayCompletedAt);
    const now = new Date();
    const sameDay =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate();
    if (!sameDay) {
      // 자정 지났음 → 자동 resume
      camp.start();
    }
    // 같은 날이면 paused 상태로 — overlay 안 띄움 (cooldown)
  }, [
    camp.state.status,
    camp.state.lastDayCompletedAt,
    camp.state.currentDay,
    camp,
  ]);

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

    const onClick = (e: Event) => {
      setTargetClicked(true);
      camp.markTargetClicked(step.targetKey, {
        route: location.pathname,
      });
      // root wrapper(예: section/article/div) 자체에는 onClick 이 없을 때
      // 안의 첫 actionable element(button / a / role=button)를 자동 발동.
      // 회원이 spotlight 안 빈 영역을 눌러도 실제 기능(모달/sheet)이 열림.
      const clicked = e.target as HTMLElement | null;
      if (!clicked) return;
      const isActionable =
        clicked.tagName === "BUTTON" ||
        clicked.tagName === "A" ||
        clicked.getAttribute("role") === "button" ||
        clicked.closest("button, a, [role='button']");
      if (isActionable) return; // 이미 정확한 element 클릭 — 기존 동작 그대로
      const root = element as HTMLElement | null;
      if (!root) return;
      const inner = root.querySelector(
        'button, a, [role="button"]',
      ) as HTMLElement | null;
      if (inner) {
        // capture phase 끝난 후 안의 actionable 자동 click
        setTimeout(() => {
          try {
            inner.click();
          } catch {
            /* noop */
          }
        }, 60);
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

  // 이전 단계 — Day 안에서 step-1, Day 경계면 이전 Day 마지막 step 으로
  const handlePrev = useCallback(() => {
    if (!step) return;
    if (step.step > 0) {
      camp.goToDayStep(step.day, step.step - 1);
      return;
    }
    if (step.day > 1) {
      const prevDay = step.day - 1;
      const prevDayCount = getStepsCountByDay(prevDay);
      camp.goToDayStep(prevDay, Math.max(0, prevDayCount - 1));
    }
    // Day 1 step 0 이면 noop (canGoBack 으로 차단)
  }, [step, camp]);

  const canGoBack = !!step && (step.step > 0 || step.day > 1);

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
    // dim 영역 클릭 시 — 조용한 noop. 회원이 막히면 "건너뛰기" 또는 "잠시 멈추기" 사용.
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
      canGoBack={canGoBack}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkipDay={handleSkipDay}
      onPause={handlePause}
      onGoToRoute={handleGoToRoute}
      onMarkClicked={() => setTargetClicked(true)}
      onDimNudge={handleDimNudge}
    />
  );
};

export default TutorialCampProvider;
