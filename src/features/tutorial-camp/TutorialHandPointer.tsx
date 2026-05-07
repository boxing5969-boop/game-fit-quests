/**
 * 7일 스타터 캠프 — 손가락 / 화살표 포인터 (단계 44).
 *
 * step.animation 이 hand / arrow / bounce 일 때 target 근처에 노출.
 * pointer-events: none — target 클릭 방해 X.
 */

import { motion } from "framer-motion";
import {
  COLOR_AMBER,
  POINTER_BOUNCE_MS,
  prefersReducedMotion,
} from "./tutorialCampMotion";
import type { TargetRect } from "./useTutorialTarget";
import type {
  TutorialCampAnimation,
  TutorialCampPlacement,
} from "./tutorialCampSteps";

export interface TutorialHandPointerProps {
  rect: TargetRect;
  placement: TutorialCampPlacement;
  variant: TutorialCampAnimation;
}

const TutorialHandPointer = ({
  rect,
  placement,
  variant,
}: TutorialHandPointerProps) => {
  if (!rect.found) return null;
  // pulse / spotlight / confetti / celebration 은 본 컴포넌트 비표시
  if (variant !== "hand" && variant !== "arrow" && variant !== "bounce") {
    return null;
  }

  const reduced = prefersReducedMotion();
  const POINTER_SIZE = 28;
  const GAP = 10;

  let x = rect.left + rect.width / 2 - POINTER_SIZE / 2;
  let y = rect.top + rect.height + GAP;
  let bounceAxis: "y" | "x" = "y";
  let bounceFrom = 0;
  let bounceTo = -8;

  if (placement === "top") {
    y = rect.top - POINTER_SIZE - GAP;
    bounceTo = 8;
  } else if (placement === "left") {
    x = rect.left - POINTER_SIZE - GAP;
    y = rect.top + rect.height / 2 - POINTER_SIZE / 2;
    bounceAxis = "x";
    bounceTo = 8;
  } else if (placement === "right") {
    x = rect.left + rect.width + GAP;
    y = rect.top + rect.height / 2 - POINTER_SIZE / 2;
    bounceAxis = "x";
    bounceTo = -8;
  }

  return (
    <motion.div
      className="pointer-events-none fixed z-[112]"
      style={{ left: x, top: y, width: POINTER_SIZE, height: POINTER_SIZE }}
      animate={
        reduced
          ? {}
          : bounceAxis === "y"
            ? { y: [bounceFrom, bounceTo, bounceFrom] }
            : { x: [bounceFrom, bounceTo, bounceFrom] }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: POINTER_BOUNCE_MS / 1000,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
      aria-hidden
    >
      {variant === "arrow" || variant === "bounce" ? (
        <ArrowSvg placement={placement} />
      ) : (
        <HandSvg placement={placement} />
      )}
    </motion.div>
  );
};

function HandSvg({ placement }: { placement: TutorialCampPlacement }) {
  // 손가락 — bottom 기본 (target 아래에서 위로 가리키는 손)
  const rotate =
    placement === "top"
      ? 180
      : placement === "left"
        ? 90
        : placement === "right"
          ? -90
          : 0;
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      style={{
        transform: `rotate(${rotate}deg)`,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
      }}
    >
      {/* 손가락 윤곽 (가리키는 손) */}
      <path
        d="M12 2 L13.5 2 L13.5 11 L17 11 Q19 11 19 13 L19 18 Q19 21 16 21 L9 21 Q6 21 6 18 L6 14 Q6 12 8 11 L10.5 10 L10.5 2 Z"
        fill={COLOR_AMBER}
        stroke="#7a4400"
        strokeWidth="0.8"
      />
      {/* 손톱 */}
      <ellipse cx="12" cy="3.5" rx="0.8" ry="1.1" fill="#fff" opacity="0.7" />
    </svg>
  );
}

function ArrowSvg({ placement }: { placement: TutorialCampPlacement }) {
  // 기본: 아래쪽 ↓ — bottom placement
  const rotate =
    placement === "top"
      ? 180
      : placement === "left"
        ? 90
        : placement === "right"
          ? -90
          : 0;
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      style={{
        transform: `rotate(${rotate}deg)`,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
      }}
    >
      <path
        d="M12 2 L12 18 M12 18 L6 12 M12 18 L18 12"
        stroke={COLOR_AMBER}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default TutorialHandPointer;
