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

        {/* fallback dim — target 못 찾았거나 라우트 mismatch */}
        {fallbackDim && (
          <div
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(10, 16, 36, 0.78)" }}
            onClick={onDimNudge}
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

        {/* "여기를 눌러보세요" — target 옆 floating chip (직접 클릭 강제 + 미클릭 시) */}
        {step.requireTargetClick &&
          !targetClicked &&
          rect &&
          rect.found &&
          routeMatch && (
            <TapHere rect={rect} placement={step.placement} />
          )}

        {/* Progress dots — tooltip 위쪽에 별도 고정 위치 */}
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[94] flex justify-center px-4">
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
        />
      </div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────
// "여기를 눌러보세요" — target 옆 floating chip
// pointer-events: none (target 클릭 방해 X), placement 기준 위치
// ─────────────────────────────────────────────────────────────
function TapHere({
  rect,
  placement,
}: {
  rect: NonNullable<TutorialOverlayProps["rect"]>;
  placement: TutorialOverlayProps["step"]["placement"];
}) {
  const CHIP_GAP = 12;
  const CHIP_HEIGHT = 28;
  let top = rect.top + rect.height + CHIP_GAP;
  let left = rect.left + rect.width / 2;

  if (placement === "top") {
    top = rect.top - CHIP_GAP - CHIP_HEIGHT;
  } else if (placement === "left") {
    left = rect.left - CHIP_GAP;
    top = rect.top + rect.height / 2 - CHIP_HEIGHT / 2;
  } else if (placement === "right") {
    left = rect.left + rect.width + CHIP_GAP;
    top = rect.top + rect.height / 2 - CHIP_HEIGHT / 2;
  }

  return (
    <motion.div
      className="pointer-events-none fixed z-[92] -translate-x-1/2 whitespace-nowrap rounded-pill border border-amber-300/70 bg-amber-500 px-3 py-1 text-[10px] font-black tracking-wider text-amber-950 shadow-[0_4px_14px_rgba(253,184,92,0.5)]"
      style={{ top, left }}
      animate={{
        y: placement === "top" ? [0, 3, 0] : [0, -3, 0],
        opacity: [0.85, 1, 0.85],
      }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      👆 여기를 클릭하세요
    </motion.div>
  );
}

export default TutorialOverlay;
