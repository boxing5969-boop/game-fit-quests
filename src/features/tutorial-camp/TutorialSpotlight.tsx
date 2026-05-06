/**
 * 7일 스타터 캠프 — 스포트라이트 + dim mask (단계 44).
 *
 * 4개 dim div 로 target 주위를 둘러싸 spotlight 영역만 비워둠.
 * → spotlight 안 element 는 자연스럽게 pointer-events 받음 (target click 보존).
 * → dim 영역 클릭은 차단 (onDimClick 콜백 — 안내 메시지 깜빡 등).
 */

import { motion } from "framer-motion";
import {
  COLOR_AMBER,
  DIM_COLOR,
  PULSE_DURATION_MS,
  SPOTLIGHT_PADDING,
  SPOTLIGHT_RADIUS,
  prefersReducedMotion,
} from "./tutorialCampMotion";
import type { TargetRect } from "./useTutorialTarget";

export interface TutorialSpotlightProps {
  rect: TargetRect;
  onDimClick?: () => void;
}

const TutorialSpotlight = ({ rect, onDimClick }: TutorialSpotlightProps) => {
  if (!rect.found || rect.width === 0 || rect.height === 0) {
    // fallback: 단일 dim layer (target 영역 0)
    return (
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: DIM_COLOR }}
        onClick={onDimClick}
        aria-hidden
      />
    );
  }

  const reduced = prefersReducedMotion();
  const padding = SPOTLIGHT_PADDING;
  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;
  const bottom = top + height;
  const right = left + width;

  return (
    <>
      {/* 4개 dim div — 좌우 아래위 */}
      <div
        className="fixed inset-x-0 top-0 z-[90]"
        style={{ height: top, background: DIM_COLOR }}
        onClick={onDimClick}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 z-[90]"
        style={{ top: bottom, bottom: 0, background: DIM_COLOR }}
        onClick={onDimClick}
        aria-hidden
      />
      <div
        className="fixed left-0 z-[90]"
        style={{ top, height, width: left, background: DIM_COLOR }}
        onClick={onDimClick}
        aria-hidden
      />
      <div
        className="fixed right-0 z-[90]"
        style={{
          top,
          height,
          left: right,
          background: DIM_COLOR,
        }}
        onClick={onDimClick}
        aria-hidden
      />

      {/* Pulse ring — pointer-events none 으로 target 클릭 방해 X */}
      <motion.div
        className="pointer-events-none fixed z-[91]"
        style={{
          top: top - 2,
          left: left - 2,
          width: width + 4,
          height: height + 4,
          borderRadius: SPOTLIGHT_RADIUS,
          border: `2px solid ${COLOR_AMBER}`,
          boxShadow: `0 0 0 1px rgba(253,184,92,0.25), 0 0 24px rgba(253,184,92,0.55)`,
        }}
        animate={
          reduced
            ? { opacity: 0.85 }
            : { opacity: [0.45, 1, 0.45] }
        }
        transition={
          reduced
            ? { duration: 0 }
            : {
                duration: PULSE_DURATION_MS / 1000,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
        aria-hidden
      />
    </>
  );
};

export default TutorialSpotlight;
