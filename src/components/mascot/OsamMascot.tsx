/**
 * 오삼 (OSAM) — 마이복서153 마스코트.
 *
 * 10가지 표정 PNG 자산 (public/assets/mascot/osami_*.png).
 *
 * 자산 (10):
 *   · default     — 평소 / 살짝 입 삐죽
 *   · wink        — 윙크 + 미소 (인사/시작 멘트)
 *   · happy       — 활짝 큰 웃음 (성공 / 보상)
 *   · determined  — 결의 / 진지 (미션 진행 / 도전)
 *   · shy         — 부끄러움 / 살짝 걱정
 *   · sad         — 눈물 / 슬픔 (실패 / 안타까움)
 *   · surprised   — 놀람 (알림 / 깜짝 이벤트)
 *   · confused    — 갸우뚱 (안내 필요 / 도움말)
 *   · victory     — 승리 / 신남 (대미션 클리어 / 챔피언)
 *   · smile       — 부드러운 미소 (잔잔한 응원 / 일기)
 *
 * 사용:
 *   <OsamMascot size="md" state="wink" />
 *   <OsamMascot size="xl" state="victory" />
 *
 * 호환:
 *   기존 state ("idle" | "wave" | "celebrate" | "thinking") 도 alias 로 유지.
 */

import { motion } from "framer-motion";

type OsamSize = "xs" | "sm" | "md" | "lg" | "xl";

/** 새 10종 표정 + 기존 호환 alias 4종. */
export type OsamState =
  | "default"
  | "wink"
  | "happy"
  | "determined"
  | "shy"
  | "sad"
  | "surprised"
  | "confused"
  | "victory"
  | "smile"
  // legacy alias (기존 코드 호환)
  | "idle"
  | "wave"
  | "celebrate"
  | "thinking";

const SIZE_PX: Record<OsamSize, number> = {
  xs: 48,
  sm: 72,
  md: 100,
  lg: 144,
  xl: 200,
};

/** 새 10종 + legacy alias → 실제 PNG 파일명 (확장자 제외). */
const STATE_TO_FILE: Record<OsamState, string> = {
  default: "default",
  wink: "wink",
  happy: "happy",
  determined: "determined",
  shy: "shy",
  sad: "sad",
  surprised: "surprised",
  confused: "confused",
  victory: "victory",
  smile: "smile",
  // legacy alias
  idle: "default",
  wave: "wink",
  celebrate: "victory",
  thinking: "confused",
};

const ASSET_BASE = "/assets/mascot";

/** 화려한 글로우/별 효과를 띄우는 state 들. */
const CELEBRATE_STATES = new Set<OsamState>(["victory", "celebrate", "happy"]);

export interface OsamMascotProps {
  size?: OsamSize;
  state?: OsamState;
  className?: string;
  /** 강조 글로우 색 (기본: 노란색) */
  glowColor?: string;
}

const OsamMascot = ({
  size = "md",
  state = "default",
  className = "",
  glowColor = "hsla(42, 90%, 64%, 0.6)",
}: OsamMascotProps) => {
  const px = SIZE_PX[size];
  const file = STATE_TO_FILE[state];
  const src = `${ASSET_BASE}/osami_${file}.png`;

  const isCelebrating = CELEBRATE_STATES.has(state);
  const isWaving = state === "wink" || state === "wave" || state === "smile";

  // state 별 애니메이션
  const bodyAnim = isCelebrating
    ? {
        y: [0, -10, 0],
        rotate: [0, -5, 5, -5, 0],
      }
    : isWaving
      ? { rotate: [0, 3, -3, 0], y: [0, -2, 0] }
      : { y: [0, -3, 0] };

  const bodyTransition = isCelebrating
    ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const }
    : isWaving
      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {/* 글로우 (celebrate 계열 state 에서만) */}
      {isCelebrating && (
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

      {/* PNG (3D 캐릭터) — pixelated 렌더링 제거 (3D 일러스트라 부드러운 보간이 더 좋음) */}
      <motion.img
        src={src}
        alt="오삼이"
        width={px}
        height={px}
        className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        style={{ objectFit: "contain" }}
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

      {/* celebrate 계열 state: 별 + 반짝 오버레이 */}
      {isCelebrating && (
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
