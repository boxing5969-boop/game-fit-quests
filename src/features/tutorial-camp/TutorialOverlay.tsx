/**
 * 7일 스타터 캠프 — overlay 합성 (단계 44).
 *
 * Spotlight + Pointer + ProgressDots + Tooltip 을 한 번에 렌더.
 * step.animation === "celebration" / "confetti" 인 경우는 외부(Provider)에서
 * TutorialCelebration 으로 분기 — 본 컴포넌트는 일반 step 만 처리.
 */

import { AnimatePresence, motion } from "framer-motion";
import TutorialSpotlight from "./TutorialSpotlight";
import TutorialHandPointer from "./TutorialHandPointer";
import TutorialTooltip from "./TutorialTooltip";
import TutorialProgressDots from "./TutorialProgressDots";
import type { TargetRect } from "./useTutorialTarget";
import type { TutorialCampStep } from "./tutorialCampSteps";

export interface TutorialOverlayProps {
  step: TutorialCampStep;
  rect: TargetRect | null;
  routeMatch: boolean;
  targetClicked: boolean;
  totalStepsInDay: number;
  /** 이전 step 으로 갈 수 있는지 (Day 1 step 0 이면 false) */
  canGoBack?: boolean;
  onNext: () => void;
  onPrev?: () => void;
  onSkipDay: () => void;
  onPause: () => void;
  onGoToRoute: () => void;
  onMarkClicked: () => void;
  onDimNudge: () => void;
  /** 50-A: step.completionRule 기준 통합 만족 여부 (Tooltip next gating). */
  conditionMet?: boolean;
  /** 50-A: 세부 completion 상태 (helper/success message 분기용). */
  completionState?: Record<string, boolean>;
}

const TutorialOverlay = ({
  step,
  rect,
  routeMatch,
  targetClicked,
  totalStepsInDay,
  canGoBack = false,
  onNext,
  onPrev,
  onSkipDay,
  onPause,
  onGoToRoute,
  onMarkClicked,
  onDimNudge,
  conditionMet,
  completionState,
}: TutorialOverlayProps) => {

  const showSpotlight =
    !!rect &&
    rect.found &&
    routeMatch &&
    (step.animation === "spotlight" ||
      step.animation === "pulse" ||
      step.animation === "hand" ||
      step.animation === "arrow" ||
      step.animation === "bounce");

  const showPointer =
    !!rect &&
    rect.found &&
    routeMatch &&
    (step.animation === "hand" ||
      step.animation === "arrow" ||
      step.animation === "bounce");

  const fallbackDim = !rect || !rect.found || !routeMatch;

  return (
    <AnimatePresence mode="wait">
      <div key={`${step.day}.${step.step}`}>
        {/* Spotlight + dim mask */}
        {showSpotlight && rect && (
          <TutorialSpotlight rect={rect} onDimClick={onDimNudge} />
        )}

        {/* fallback dim — target 못 찾았거나 라우트 mismatch.
            pointer-events: none — 모달/sheet 의 button 클릭이 통과되도록. */}
        {fallbackDim && (
          <div
            className="pointer-events-none fixed inset-0 z-[110]"
            style={{ background: "rgba(10, 16, 36, 0.78)" }}
            aria-hidden
          />
        )}

        {/* Hand / arrow pointer */}
        {showPointer && rect && (
          <TutorialHandPointer
            rect={rect}
            placement={step.placement}
            variant={step.animation}
          />
        )}

        {/* "여기를 클릭하세요" — target 안쪽 상단 floating chip (직접 클릭 강제 + 미클릭 시) */}
        {step.requireTargetClick &&
          !targetClicked &&
          rect &&
          rect.found &&
          routeMatch && (
            <TapHere rect={rect} targetSelector={step.targetSelector} />
          )}

        {/* Progress dots — tooltip 위쪽에 별도 고정 위치 */}
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[113] flex justify-center px-4">
          <div className="rounded-full border border-amber-400/30 bg-black/55 px-3 py-1.5 backdrop-blur-sm">
            <TutorialProgressDots
              total={totalStepsInDay}
              current={step.step}
            />
            <p className="mt-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-amber-200/80">
              Day {step.day} · {step.step + 1} / {totalStepsInDay}
            </p>
          </div>
        </div>

        {/* Tooltip */}
        <TutorialTooltip
          step={step}
          rect={rect}
          targetClicked={targetClicked}
          routeMatch={routeMatch}
          canGoBack={canGoBack}
          onNext={onNext}
          onPrev={onPrev}
          onSkipDay={onSkipDay}
          onPause={onPause}
          onGoToRoute={onGoToRoute}
          onMarkClicked={onMarkClicked}
          conditionMet={conditionMet}
          completionState={completionState}
        />
      </div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────
// "여기를 클릭하세요" — target 안쪽 상단 floating chip (클릭 가능)
//   · 회원이 chip 자체를 누르면 → target 안 actionable element(button/a) 자동 발동
//   · 동시에 target 본체를 직접 눌러도 Provider 의 capture-phase listener 가 처리
//   · z-[94] — tooltip(z-93) 위
// ─────────────────────────────────────────────────────────────
function TapHere({
  rect,
  targetSelector,
}: {
  rect: NonNullable<TutorialOverlayProps["rect"]>;
  targetSelector: string;
}) {
  const CHIP_INSET = 12;
  let top = rect.top + CHIP_INSET;
  let left = rect.left + rect.width / 2;

  if (typeof window !== "undefined") {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    if (top < 60) top = 60;
    if (top > vh - 60) top = vh - 60;
    if (left < 80) left = 80;
    if (left > vw - 80) left = vw - 80;
  }

  const handleChipClick = () => {
    if (typeof document === "undefined") return;
    let target: HTMLElement | null = null;
    try {
      target = document.querySelector(targetSelector) as HTMLElement | null;
    } catch {
      target = null;
    }
    if (!target) return;
    // 안의 첫 actionable element 우선 — 모달/sheet 열림 같은 실제 동작 트리거
    const inner = target.querySelector(
      'button, a, [role="button"]',
    ) as HTMLElement | null;
    const dispatchTarget = inner ?? target;
    try {
      dispatchTarget.click();
    } catch {
      /* noop */
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleChipClick}
      className="pointer-events-auto fixed z-[113] -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-pill border-2 border-amber-300 bg-amber-500 px-4 py-1.5 text-[11px] font-black tracking-wider text-amber-950 shadow-[0_6px_20px_rgba(253,184,92,0.65)] hover:bg-amber-400 active:scale-95"
      style={{ top, left }}
      animate={{
        y: [0, -4, 0],
        scale: [1, 1.08, 1],
        opacity: [0.9, 1, 0.9],
      }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      aria-label="이 영역의 기능을 직접 체험하기"
    >
      👆 여기를 클릭하세요
    </motion.button>
  );
}

export default TutorialOverlay;
