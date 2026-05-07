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

        {/* "여기를 클릭하세요" — target 안쪽 상단 floating chip (직접 클릭 강제 + 미클릭 시) */}
        {step.requireTargetClick &&
          !targetClicked &&
          rect &&
          rect.found &&
          routeMatch && <TapHere rect={rect} />}

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
// "여기를 클릭하세요" — target 안쪽 상단 floating chip
//   · z-[94] — tooltip(z-93) 위에 떠 있어 어떤 위치에서도 항상 보임
//   · target 영역 내부 상단 12px — spotlight 안에 명확히 떠 있어 시선 집중
//   · pointer-events: none — target 클릭 방해 0
//   · viewport clamp — 화면 가장자리 쳐도 깨지지 않음
// ─────────────────────────────────────────────────────────────
function TapHere({
  rect,
}: {
  rect: NonNullable<TutorialOverlayProps["rect"]>;
}) {
  const CHIP_INSET = 12;
  // target 안쪽 상단 중앙
  let top = rect.top + CHIP_INSET;
  let left = rect.left + rect.width / 2;

  // viewport clamp — 화면 위쪽 끝이거나 너무 작은 target 일 때
  if (typeof window !== "undefined") {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    if (top < 60) top = 60;
    if (top > vh - 60) top = vh - 60;
    if (left < 80) left = 80;
    if (left > vw - 80) left = vw - 80;
  }

  return (
    <motion.div
      className="pointer-events-none fixed z-[94] -translate-x-1/2 whitespace-nowrap rounded-pill border-2 border-amber-300 bg-amber-500 px-4 py-1.5 text-[11px] font-black tracking-wider text-amber-950 shadow-[0_6px_20px_rgba(253,184,92,0.65)]"
      style={{ top, left }}
      animate={{
        y: [0, -4, 0],
        scale: [1, 1.08, 1],
        opacity: [0.9, 1, 0.9],
      }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      👆 여기를 클릭하세요
    </motion.div>
  );
}

export default TutorialOverlay;
