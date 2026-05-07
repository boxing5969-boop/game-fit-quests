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
  /** peek 모드 — overlay 임시 hide, 회원이 실제 화면 만져보게 함 */
  peeking?: boolean;
  /** 이전 step 으로 갈 수 있는지 (Day 1 step 0 이면 false) */
  canGoBack?: boolean;
  onNext: () => void;
  onPrev?: () => void;
  onSkipDay: () => void;
  onPause: () => void;
  onGoToRoute: () => void;
  onMarkClicked: () => void;
  onDimNudge: () => void;
  /** "잠깐 살펴보기" CTA — peek 모드 진입 */
  onTryItYourself?: () => void;
  /** peek 모드 즉시 종료 */
  onResumeFromPeek?: () => void;
}

const TutorialOverlay = ({
  step,
  rect,
  routeMatch,
  targetClicked,
  totalStepsInDay,
  peeking = false,
  canGoBack = false,
  onNext,
  onPrev,
  onSkipDay,
  onPause,
  onGoToRoute,
  onMarkClicked,
  onDimNudge,
  onTryItYourself,
  onResumeFromPeek,
}: TutorialOverlayProps) => {
  // peek 모드 — overlay 모두 hide, 우상단 작은 floating 라벨 + 복귀 버튼만
  if (peeking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="pointer-events-auto fixed right-3 top-3 z-[94] inline-flex items-center gap-2 rounded-pill border border-amber-400/50 bg-black/85 px-3 py-1.5 text-[11px] font-bold text-amber-100 shadow-[0_4px_14px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        role="status"
        aria-label="잠깐 살펴보는 중"
      >
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden />
        잠깐 살펴보는 중 · 8초 후 복귀
        <button
          type="button"
          onClick={onResumeFromPeek}
          className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-amber-950 hover:bg-amber-400"
        >
          바로 복귀
        </button>
      </motion.div>
    );
  }

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
          onTryItYourself={onTryItYourself}
        />
      </div>
    </AnimatePresence>
  );
};

export default TutorialOverlay;
