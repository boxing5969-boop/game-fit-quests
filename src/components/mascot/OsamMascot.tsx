/**
 * 오삼 (OSAM) — 마이복서153 마스코트.
 *
 * 픽셀 아트 PNG 자산 기반 (public/assets/story-rpg/portraits/osam_*.png).
 * 이전 SVG 버전을 PNG 로 교체. state 별 emotion 매핑 + framer-motion 애니메이션.
 *
 * 자산:
 *   · /assets/story-rpg/portraits/osam_default.png   — idle / thinking
 *   · /assets/story-rpg/portraits/osam_happy.png     — wave / celebrate
 *   · /assets/story-rpg/portraits/osam_concerned.png — concerned (확장용)
 *
 * 사용:
 *   <OsamMascot size="md" state="wave" />
 *   <OsamMascot size="xl" state="celebrate" />
 */

import { motion } from "framer-motion";

type OsamSize = "xs" | "sm" | "md" | "lg" | "xl";
type OsamState = "idle" | "wave" | "celebrate" | "thinking";

const SIZE_PX: Record<OsamSize, number> = {
  xs: 48,
  sm: 72,
  md: 100,
  lg: 144,
  xl: 200,
};

// state → emotion (PNG 파일 매핑)
const STATE_TO_EMOTION: Record<OsamState, "default" | "happy" | "concerned"> = {
  idle: "default",
  wave: "happy",
  celebrate: "happy",
  thinking: "concerned",
};

const ASSET_BASE = "/assets/story-rpg/portraits";

export interface OsamMascotProps {
  size?: OsamSize;
  state?: OsamState;
  className?: string;
  /** 강조 글로우 색 (기본: 노란색) */
  glowColor?: string;
}

const OsamMascot = ({
  size = "md",
  state = "idle",
  className = "",
  glowColor = "hsla(42, 90%, 64%, 0.6)",
}: OsamMascotProps) => {
  const px = SIZE_PX[size];
  const emotion = STATE_TO_EMOTION[state];
  const src = `${ASSET_BASE}/osam_${emotion}.png`;

  // state 별 애니메이션
  const bodyAnim =
    state === "celebrate"
      ? {
          y: [0, -10, 0],
          rotate: [0, -5, 5, -5, 0],
        }
      : state === "wave"
        ? { rotate: [0, 3, -3, 0], y: [0, -2, 0] }
        : { y: [0, -3, 0] };

  const bodyTransition =
    state === "celebrate"
      ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const }
      : state === "wave"
        ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {/* 글로우 (state=celebrate 일 때만) */}
      {state === "celebrate" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
          }}
          aria-hidden="true"
        />
      )}

      {/* 픽셀 아트 PNG */}
      <motion.img
        src={src}
        alt="오삼이"
        width={px}
        height={px}
        className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        style={{
          imageRendering: "pixelated",
          objectFit: "contain",
        }}
        animate={bodyAnim}
        transition={bodyTransition}
        // PNG 로드 실패 시 시각적 fallback (alt 텍스트)
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
        }}
        loading="lazy"
        draggable={false}
      />

      {/* ── celebrate state: 별 + 반짝 (PNG 위에 오버레이) ── */}
      {state === "celebrate" && (
        <div className="pointer-events-none absolute inset-0">
          <motion.span
            className="absolute text-2xl"
            style={{ left: "8%", top: "10%" }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 20, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute text-xl"
            style={{ right: "5%", top: "12%" }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, -20, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
          >
            ⭐
          </motion.span>
          <motion.span
            className="absolute text-lg"
            style={{ left: "5%", bottom: "15%" }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
          >
            ✨
          </motion.span>
        </div>
      )}
    </div>
  );
};

export default OsamMascot;
