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

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTutorialCamp } from "./useTutorialCamp";
import { useTutorialTarget } from "./useTutorialTarget";
import {
  appendTutorialCampEvent,
} from "./tutorialCampEvents";
import {
  getStepsCountByDay,
  type TutorialCampStep,
} from "./tutorialCampSteps";
import TutorialOverlay from "./TutorialOverlay";
import TutorialCelebration from "./TutorialCelebration";

// ─────────────────────────────────────────────────────────────
// 50-A: completion state machine
//   step 의 completionRule 별 listener 가 갱신하는 boolean 모음.
//   step 변경 시 모두 reset.
// ─────────────────────────────────────────────────────────────
interface CompletionState {
  quizQuestionRead: boolean;
  quizAnswerSelected: boolean;
  quizCorrectAnswerSelected: boolean;
  scrolledToBottom: boolean;
  textInputSatisfied: boolean;
  optionSelected: boolean;
  conditionChecked: boolean;
  modalClosed: boolean;
}

const INITIAL_COMPLETION: CompletionState = {
  quizQuestionRead: false,
  quizAnswerSelected: false,
  quizCorrectAnswerSelected: false,
  scrolledToBottom: false,
  textInputSatisfied: false,
  optionSelected: false,
  conditionChecked: false,
  modalClosed: false,
};

type CompletionAction =
  | { type: "reset" }
  | { type: "set"; key: keyof CompletionState; value: boolean };

function completionReducer(
  state: CompletionState,
  action: CompletionAction,
): CompletionState {
  if (action.type === "reset") return { ...INITIAL_COMPLETION };
  if (action.type === "set") {
    if (state[action.key] === action.value) return state;
    return { ...state, [action.key]: action.value };
  }
  return state;
}

/**
 * step 의 completionRule 을 보고 완료 여부 계산.
 * completionRule 미정의 시 requireTargetClick 폴백 (기존 35 step 호환).
 */
function isStepConditionMet(
  step: TutorialCampStep,
  targetClicked: boolean,
  c: CompletionState,
): boolean {
  if (step.completionRule) {
    switch (step.completionRule) {
      case "target_clicked":
        return targetClicked;
      case "quiz_question_read":
        return c.quizQuestionRead;
      case "quiz_answer_selected":
        return c.quizAnswerSelected;
      case "quiz_correct_answer_selected":
        return c.quizCorrectAnswerSelected;
      case "scrolled_to_bottom":
        return c.scrolledToBottom;
      case "text_input_min_length":
        return c.textInputSatisfied;
      case "option_selected":
        return c.optionSelected;
      case "toggle_selected":
        return c.optionSelected;
      case "condition_checked":
        return c.conditionChecked;
      case "modal_closed":
        return c.modalClosed;
      case "manual_confirm":
        return true;
      default:
        return targetClicked;
    }
  }
  // 기존 호환: completionRule 미정의 시 requireTargetClick 만 본다.
  if (step.requireTargetClick) return targetClicked;
  return true;
}

const TutorialCampProvider = () => {
  const camp = useTutorialCamp();
  const location = useLocation();
  const navigate = useNavigate();

  const [targetClicked, setTargetClicked] = useState(false);
  const lastStepKeyRef = useRef<string | null>(null);

  // 50-A: completion state (step 의 신규 completionRule 만족 여부 모음)
  const [completion, dispatchCompletion] = useReducer(
    completionReducer,
    INITIAL_COMPLETION,
  );

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

  // step 변경 시 targetClicked + completion state 모두 리셋
  useEffect(() => {
    if (!step) {
      lastStepKeyRef.current = null;
      setTargetClicked(false);
      dispatchCompletion({ type: "reset" });
      return;
    }
    const key = `${step.day}.${step.step}`;
    if (lastStepKeyRef.current !== key) {
      lastStepKeyRef.current = key;
      setTargetClicked(false);
      dispatchCompletion({ type: "reset" });
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

  // 모달 자동 감지 timer 추적 — step 변경/unmount 시 모두 clear
  const modalPollRef = useRef<{
    initial?: number;
    interval?: number;
    safety?: number;
    finishTimeout?: number;
  }>({});
  const innerClickRef = useRef<number | null>(null);
  const clearModalPolling = useCallback(() => {
    const p = modalPollRef.current;
    if (p.initial) window.clearTimeout(p.initial);
    if (p.interval) window.clearInterval(p.interval);
    if (p.safety) window.clearTimeout(p.safety);
    if (p.finishTimeout) window.clearTimeout(p.finishTimeout);
    modalPollRef.current = {};
  }, []);

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
      // root wrapper 빈 영역 클릭 → 안 actionable 자동 발동
      const clicked = e.target as HTMLElement | null;
      if (clicked) {
        const isActionable =
          clicked.tagName === "BUTTON" ||
          clicked.tagName === "A" ||
          clicked.getAttribute("role") === "button" ||
          clicked.closest("button, a, [role='button']");
        if (!isActionable) {
          const root = element as HTMLElement | null;
          const inner = root?.querySelector(
            'button, a, [role="button"]',
          ) as HTMLElement | null;
          if (inner) {
            if (innerClickRef.current)
              window.clearTimeout(innerClickRef.current);
            innerClickRef.current = window.setTimeout(() => {
              innerClickRef.current = null;
              try {
                inner.click();
              } catch {
                /* noop */
              }
            }, 60);
          }
        }
      }

      // 모달/sheet 자동 감지 — 회원이 정답 맞추고 닫으면 자동 다음 step
      //   · 이전 폴링이 살아있으면 정리 후 새로 시작 (step 변경 race 방지)
      //   · 1.5초 폴링 (CPU 절감) — modal close watcher useEffect 와 보완
      //   · autoAdvance step 은 cascade 가 처리하므로 skip
      if (!step.autoAdvance) {
        clearModalPolling();
        modalPollRef.current.initial = window.setTimeout(() => {
          if (!hasOtherDialog()) return;
          modalPollRef.current.interval = window.setInterval(() => {
            if (!hasOtherDialog()) {
              if (modalPollRef.current.interval) {
                window.clearInterval(modalPollRef.current.interval);
                modalPollRef.current.interval = undefined;
              }
              modalPollRef.current.finishTimeout = window.setTimeout(() => {
                modalPollRef.current.finishTimeout = undefined;
                camp.next();
              }, 1000);
            }
          }, 1500);
          modalPollRef.current.safety = window.setTimeout(() => {
            clearModalPolling();
          }, 60_000);
        }, 600);
      }
    };
    element.addEventListener("click", onClick, { capture: true });
    return () => {
      element?.removeEventListener("click", onClick, { capture: true });
      clearModalPolling();
      if (innerClickRef.current) {
        window.clearTimeout(innerClickRef.current);
        innerClickRef.current = null;
      }
    };
    // step.targetSelector 가 바뀌어도 element 재탐색
  }, [isActiveCamp, step, rect?.found, camp, location.pathname, clearModalPolling]);

  // ─────────────────────────────────────────────────────────────
  // 50-A 신규 listener: input / scroll / option / condition / modal
  //   각 listener 는 step.completionRule 또는 관련 selector 가 있을 때만 활성.
  //   step 변경 시 cleanup 자동.
  // ─────────────────────────────────────────────────────────────

  // 1) text input listener
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined") return;
    const selector = step.inputSelector;
    if (!selector) return;
    const minLen = step.minTextLength ?? 5;

    let target: HTMLInputElement | HTMLTextAreaElement | null = null;
    try {
      target = document.querySelector(selector) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
    } catch {
      target = null;
    }
    if (!target) return;

    const handle = () => {
      const ok = (target?.value ?? "").trim().length >= minLen;
      dispatchCompletion({
        type: "set",
        key: "textInputSatisfied",
        value: ok,
      });
    };
    handle(); // 초기값 측정
    target.addEventListener("input", handle);
    return () => {
      target?.removeEventListener("input", handle);
    };
  }, [isActiveCamp, step]);

  // 2) scroll listener — scrollContainerSelector 또는 window. rAF throttle.
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined" || typeof window === "undefined")
      return;
    if (
      step.completionRule !== "scrolled_to_bottom" &&
      !step.scrollContainerSelector
    )
      return;
    const threshold = step.scrollThreshold ?? 0.85;

    let container: HTMLElement | Window = window;
    if (step.scrollContainerSelector) {
      try {
        const el = document.querySelector(
          step.scrollContainerSelector,
        ) as HTMLElement | null;
        if (el) container = el;
      } catch {
        // selector 잘못되면 window fallback
      }
    }

    let satisfied = false;
    const compute = () => {
      if (satisfied) return;
      let ratio = 0;
      if (container === window) {
        const scrolled = window.scrollY + window.innerHeight;
        const total = document.documentElement.scrollHeight;
        ratio = total > 0 ? scrolled / total : 1;
      } else {
        const el = container as HTMLElement;
        const scrolled = el.scrollTop + el.clientHeight;
        ratio = el.scrollHeight > 0 ? scrolled / el.scrollHeight : 1;
      }
      if (ratio >= threshold) {
        satisfied = true;
        dispatchCompletion({
          type: "set",
          key: "scrolledToBottom",
          value: true,
        });
      }
    };

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        compute();
      });
    };
    compute();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isActiveCamp, step]);

  // 3) option selector listener (옵션/토글 클릭)
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined") return;
    const selector = step.optionSelector;
    if (!selector) return;

    const handler = (e: Event) => {
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      try {
        if (tgt.closest(selector)) {
          dispatchCompletion({
            type: "set",
            key: "optionSelected",
            value: true,
          });
        }
      } catch {
        /* selector 오류 무시 */
      }
    };
    document.addEventListener("click", handler, { capture: true });
    return () => {
      document.removeEventListener("click", handler, { capture: true });
    };
  }, [isActiveCamp, step]);

  // 4) condition selector listener (컨디션 토글 등)
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined") return;
    const selector = step.conditionSelector;
    if (!selector) return;

    const handler = (e: Event) => {
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      try {
        if (tgt.closest(selector)) {
          dispatchCompletion({
            type: "set",
            key: "conditionChecked",
            value: true,
          });
        }
      } catch {
        /* noop */
      }
    };
    document.addEventListener("click", handler, { capture: true });
    return () => {
      document.removeEventListener("click", handler, { capture: true });
    };
  }, [isActiveCamp, step]);

  // 5) modal close watcher — modalSelector element 가 DOM 에서 사라지면 만족.
  //    MutationObserver 가 우선 (즉각), polling 은 1.5s 안전망 (브라우저 호환)
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined") return;
    const selector = step.modalSelector;
    if (!selector) return;

    let satisfied = false;
    const check = () => {
      if (satisfied) return;
      let exists = false;
      try {
        exists = !!document.querySelector(selector);
      } catch {
        exists = false;
      }
      // modal 이 한 번이라도 열렸다가 닫히면 modalClosed=true
      // — 처음부터 없는 경우는 무시 (회원이 아직 안 열었을 수 있음)
      if (exists) {
        modalSeenRef.current = true;
      } else if (modalSeenRef.current) {
        satisfied = true;
        dispatchCompletion({
          type: "set",
          key: "modalClosed",
          value: true,
        });
      }
    };

    check();
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(check);
      try {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      } catch {
        observer = null;
      }
    }
    // 안전망 polling — observer 못 쓰는 환경 + 첫 렌더 race
    const id = window.setInterval(check, 1500);
    return () => {
      observer?.disconnect();
      window.clearInterval(id);
    };
  }, [isActiveCamp, step]);

  // modal seen flag — step 변경 시 reset
  const modalSeenRef = useRef(false);
  useEffect(() => {
    modalSeenRef.current = false;
  }, [step]);

  // 6) quiz_answer_selected — expectedAnswerSelector 가 있으면 그 element 의 클릭 감지
  //    expectedAnswerValue 가 있으면 data-tutorial-answer-value 매칭 시 correct.
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (typeof document === "undefined") return;
    if (
      !step.expectedAnswerSelector &&
      step.completionRule !== "quiz_answer_selected" &&
      step.completionRule !== "quiz_correct_answer_selected"
    )
      return;

    const handler = (e: Event) => {
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      try {
        // 정답 또는 일반 선택지 클릭 감지
        const answerEl = step.expectedAnswerSelector
          ? tgt.closest(step.expectedAnswerSelector)
          : null;
        const anyAnswer =
          tgt.closest("[data-tutorial-answer]") ||
          tgt.closest('[role="radio"]') ||
          tgt.closest("button[data-answer]");
        if (answerEl || anyAnswer) {
          dispatchCompletion({
            type: "set",
            key: "quizAnswerSelected",
            value: true,
          });
          // 정답 매칭
          const el = (answerEl ?? anyAnswer) as HTMLElement | null;
          if (el && step.expectedAnswerValue) {
            const v = el.getAttribute("data-tutorial-answer-value");
            if (v === step.expectedAnswerValue) {
              dispatchCompletion({
                type: "set",
                key: "quizCorrectAnswerSelected",
                value: true,
              });
            }
          } else if (answerEl) {
            // expectedAnswerSelector 매칭 자체가 정답
            dispatchCompletion({
              type: "set",
              key: "quizCorrectAnswerSelected",
              value: true,
            });
          }
        }
      } catch {
        /* noop */
      }
    };
    document.addEventListener("click", handler, { capture: true });
    return () => {
      document.removeEventListener("click", handler, { capture: true });
    };
  }, [isActiveCamp, step]);

  // 7) quiz_question_read — 단순히 "확인" chip 클릭 또는 짧은 지연 후 satisfied.
  //    overlay 내부 helper 가 markQuizQuestionRead 콜백 호출 시 set.
  //    + helper: 4초 자동 satisfied (회원이 읽을 시간)
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (step.completionRule !== "quiz_question_read") return;
    const id = window.setTimeout(() => {
      dispatchCompletion({
        type: "set",
        key: "quizQuestionRead",
        value: true,
      });
    }, 4000);
    return () => window.clearTimeout(id);
  }, [isActiveCamp, step]);

  // 캠프 자체 overlay (data-tour-overlay) 외 다른 dialog 가 열려 있는지
  function hasOtherDialog(): boolean {
    if (typeof document === "undefined") return false;
    const dialogs = document.querySelectorAll('[role="dialog"]');
    return Array.from(dialogs).some(
      (d) =>
        !d.hasAttribute("data-tour-overlay") &&
        !d.closest("[data-tour-overlay]"),
    );
  }

  // 캠프 외 다른 dialog 자동 dismiss — ESC + close button 백업 클릭
  //   · 회원이 모달 위에서 '다음으로' 눌렀는데 모달 이 그대로면 다음 step
  //     spotlight 이 모달 뒤에 가려서 진행 안 된 것처럼 보임 → 자동 닫기
  //   · 닫힌 dialog 가 있었으면 true 반환
  function dismissOtherDialogs(): boolean {
    if (typeof document === "undefined" || typeof window === "undefined")
      return false;
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const others = dialogs.filter(
      (d) =>
        !d.hasAttribute("data-tour-overlay") &&
        !d.closest("[data-tour-overlay]"),
    );
    if (others.length === 0) return false;
    // 1) ESC dispatch — Radix Dialog/Sheet 표준 닫기 경로
    try {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    } catch {
      /* noop */
    }
    // 2) 백업 — 안 닫히는 controlled dialog 대비 close button 자동 클릭
    window.setTimeout(() => {
      others.forEach((d) => {
        if (!d.isConnected) return;
        const closeBtn = d.querySelector(
          '[aria-label="닫기"], [aria-label*="close" i]',
        ) as HTMLElement | null;
        try {
          closeBtn?.click();
        } catch {
          /* noop */
        }
      });
    }, 100);
    return true;
  }

  // 핸들러
  const handleNext = useCallback(() => {
    if (!step) return;
    // 다른 모달이 떠 있으면 자동 dismiss — 다음 step spotlight 이 모달 뒤로
    // 가려서 진행 안 된 것처럼 보이는 회원 혼란 제거.
    // 동시에 onClick 안에서 시작된 모달 자동 감지 폴링도 정리 (중복 next 방지).
    if (dismissOtherDialogs()) {
      clearModalPolling();
    }
    // Day 마지막 step 인 경우 — completeDay 호출
    const dayStepCount = getStepsCountByDay(step.day);
    if (step.step >= dayStepCount - 1) {
      camp.completeDay(step.day);
      return;
    }
    camp.next();
  }, [step, camp, clearModalPolling]);

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
    // 55단계: suppressReflectionSheet=true 면 PostActionReflectionSheet 차단 플래그 세팅
    if (step.suppressReflectionSheet && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          "tutorial-camp-suppress-reflection-until",
          String(Date.now() + 60_000), // 60초 동안 차단
        );
      } catch {
        // ignore
      }
    }
    // celebration 또는 confetti step 은 항상 day 의 마지막
    camp.completeDay(step.day);
  }, [step, camp]);

  // 50-A: 통합 완료 판정 (next gating 용) — step null 안전
  const conditionMet = step
    ? isStepConditionMet(step, targetClicked, completion)
    : false;

  // 64: 다른 dialog 가 떠있는지 추적 — TutorialTooltip 의 compact 모드 전환용.
  //   회원이 모달 안에서 행동(정답 선택 등) 진행 중일 때 카드가 모달 컨텐츠를
  //   가리는 문제 → 모달 떠있고 조건 미충족 시 카드 자동 컴팩트.
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    if (!isActiveCamp) {
      setModalOpen(false);
      return;
    }
    if (typeof document === "undefined") return;
    const check = () => {
      const v = hasOtherDialog();
      setModalOpen((prev) => (prev === v ? prev : v));
    };
    check();
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(check);
      try {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-state", "aria-hidden"],
        });
      } catch {
        observer = null;
      }
    }
    const id = window.setInterval(check, 1500);
    return () => {
      observer?.disconnect();
      window.clearInterval(id);
    };
  }, [isActiveCamp]);

  // 57: cascade 인프라 — step.autoAdvance=true 면 조건 충족 시 자동 다음 step
  //   · 250ms 지연: 회원이 자기 클릭 시각 피드백 본 직후 빠르게 진행
  //     (이전 600ms 는 모달 떠있는 동안 spotlight 가 카드 위치=모달 뒤
  //      영역에 잘못 박혀 보이는 시간이 너무 길었음)
  //   · step 중복 advance 방지 (ref 가드)
  //   · 모든 hook 은 early return 전에 호출 (React Hooks 규칙)
  const autoAdvancedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (!step.autoAdvance) return;
    if (!conditionMet) return;
    const key = `${step.day}.${step.step}`;
    if (autoAdvancedKeyRef.current === key) return;
    autoAdvancedKeyRef.current = key;
    const id = window.setTimeout(() => {
      handleNext();
    }, 250);
    return () => window.clearTimeout(id);
  }, [isActiveCamp, step, conditionMet, handleNext]);

  // step 변경 시 autoAdvance 가드 reset
  useEffect(() => {
    autoAdvancedKeyRef.current = null;
  }, [step]);

  // 57+: autoNavigate 인프라 — step 진입 시 route 다르고 autoNavigate=true 면 자동 이동
  //   · 0.4초 지연 (회원이 step 의 안내 잠깐 보고 이동)
  //   · 같은 step 중복 navigate 방지
  const autoNavigatedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActiveCamp || !step) return;
    if (!step.autoNavigate) return;
    if (!step.route) return;
    if (location.pathname === step.route) return;
    const key = `${step.day}.${step.step}`;
    if (autoNavigatedKeyRef.current === key) return;
    autoNavigatedKeyRef.current = key;
    const id = window.setTimeout(() => {
      navigate(step.route);
    }, 400);
    return () => window.clearTimeout(id);
  }, [isActiveCamp, step, location.pathname, navigate]);

  useEffect(() => {
    autoNavigatedKeyRef.current = null;
  }, [step]);

  // 마운트 가드 — 모든 hook 호출 후 early return
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
      conditionMet={conditionMet}
      completionState={completion}
      modalOpen={modalOpen}
    />
  );
};

export default TutorialCampProvider;
