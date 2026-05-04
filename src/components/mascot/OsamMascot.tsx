/**
 * 오삼 (OSAM) — 마이복서153 마스코트.
 *
 * 기존 boxer_*.png 와 별도의 신규 chibi 스타일 SVG 캐릭터.
 *
 * 특징:
 *   · 동그란 chibi 비율 (3등신)
 *   · 큰 눈 + 분홍 볼 + 153 헤드밴드 (yellow + red)
 *   · 작은 복싱글러브 (red)
 *   · state="idle" — 기본 / "wave" — 손 흔들기 / "celebrate" — 점프
 *   · size prop 으로 사이즈 조절 (xs/sm/md/lg/xl)
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

  // 애니메이션 variants
  const bodyAnim =
    state === "celebrate"
      ? {
          y: [0, -10, 0],
          rotate: [0, -5, 5, -5, 0],
        }
      : state === "wave"
        ? { rotate: [0, 2, -2, 0] }
        : { y: [0, -3, 0] };

  const bodyTransition =
    state === "celebrate"
      ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
      : state === "wave"
        ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
        : { duration: 2.4, repeat: Infinity, ease: "easeInOut" };

  const rightGloveAnim =
    state === "wave"
      ? { rotate: [-30, -50, -30], y: [0, -5, 0] }
      : state === "celebrate"
        ? { y: [0, -8, 0], rotate: [0, -10, 10, 0] }
        : { rotate: 0 };

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

      <motion.svg
        viewBox="0 0 200 240"
        xmlns="http://www.w3.org/2000/svg"
        width={px}
        height={px}
        className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        animate={bodyAnim}
        transition={bodyTransition}
      >
        {/* ── 그림자 ── */}
        <ellipse cx="100" cy="225" rx="55" ry="6" fill="rgba(0,0,0,0.2)" />

        {/* ── 몸통 (T-shirt 노랑) ── */}
        <path
          d="M 60 145 Q 60 130 75 130 L 125 130 Q 140 130 140 145 L 145 200 Q 145 215 130 215 L 70 215 Q 55 215 55 200 Z"
          fill="#F6C453"
          stroke="#D9A93D"
          strokeWidth="2"
        />

        {/* ── T-shirt 153 로고 ── */}
        <text
          x="100"
          y="175"
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill="#E8553A"
          fontFamily="system-ui, sans-serif"
        >
          153
        </text>

        {/* ── 다리 (반바지) ── */}
        <rect x="74" y="200" width="22" height="24" rx="6" fill="#E8553A" />
        <rect x="104" y="200" width="22" height="24" rx="6" fill="#E8553A" />
        <rect x="76" y="216" width="18" height="6" rx="2" fill="#FFE0B2" />
        <rect x="106" y="216" width="18" height="6" rx="2" fill="#FFE0B2" />

        {/* ── 머리 (살구색) ── */}
        <ellipse cx="100" cy="80" rx="55" ry="52" fill="#FFE0B2" stroke="#E8C58F" strokeWidth="2" />

        {/* ── 헤드밴드 (빨강 + 153) ── */}
        <rect x="48" y="42" width="104" height="16" rx="3" fill="#E8553A" />
        <rect x="48" y="42" width="104" height="3" fill="#FF7855" />
        <text
          x="100"
          y="55"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill="#FFFFFF"
          fontFamily="system-ui, sans-serif"
          letterSpacing="1"
        >
          153
        </text>
        {/* 헤드밴드 매듭 (왼쪽) */}
        <path d="M 48 50 L 38 45 L 38 58 Z" fill="#E8553A" />
        <path d="M 48 50 L 36 56 L 40 62 Z" fill="#C8462C" />

        {/* ── 머리카락 (앞머리 — 헤드밴드 위로 살짝) ── */}
        <path
          d="M 55 45 Q 60 28 80 30 Q 100 22 120 30 Q 140 28 145 45 L 140 50 Q 130 38 115 40 Q 100 32 85 40 Q 70 38 60 50 Z"
          fill="#3A2B1C"
        />

        {/* ── 귀 ── */}
        <ellipse cx="48" cy="80" rx="6" ry="9" fill="#FFE0B2" stroke="#E8C58F" strokeWidth="1" />
        <ellipse cx="152" cy="80" rx="6" ry="9" fill="#FFE0B2" stroke="#E8C58F" strokeWidth="1" />

        {/* ── 눈 (큰 동그란 눈) ── */}
        <ellipse cx="80" cy="85" rx="9" ry="10" fill="#FFFFFF" />
        <ellipse cx="120" cy="85" rx="9" ry="10" fill="#FFFFFF" />
        {/* 동공 */}
        <circle cx="82" cy="87" r="6" fill="#1A1A1A" />
        <circle cx="122" cy="87" r="6" fill="#1A1A1A" />
        {/* 하이라이트 (반짝) */}
        <circle cx="84" cy="84" r="2.5" fill="#FFFFFF" />
        <circle cx="124" cy="84" r="2.5" fill="#FFFFFF" />
        <circle cx="80" cy="89" r="1" fill="#FFFFFF" />
        <circle cx="120" cy="89" r="1" fill="#FFFFFF" />

        {/* ── 눈썹 ── */}
        {state === "thinking" ? (
          <>
            <path d="M 70 72 Q 78 68 90 73" stroke="#3A2B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 110 73 Q 122 68 130 72" stroke="#3A2B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M 70 73 Q 80 70 90 73" stroke="#3A2B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 110 73 Q 120 70 130 73" stroke="#3A2B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* ── 볼 (분홍) ── */}
        <ellipse cx="68" cy="100" rx="6" ry="4" fill="#FF8AB0" opacity="0.55" />
        <ellipse cx="132" cy="100" rx="6" ry="4" fill="#FF8AB0" opacity="0.55" />

        {/* ── 입 (방긋 미소) ── */}
        {state === "celebrate" ? (
          // celebrate: 입 크게 벌린 미소
          <path
            d="M 86 108 Q 100 122 114 108 Q 100 118 86 108 Z"
            fill="#7A2E20"
            stroke="#3A2B1C"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ) : state === "thinking" ? (
          // thinking: 작은 동그라미
          <circle cx="100" cy="108" r="3" fill="#7A2E20" stroke="#3A2B1C" strokeWidth="1.5" />
        ) : (
          // idle/wave: 부드러운 미소
          <path
            d="M 88 107 Q 100 116 112 107"
            stroke="#3A2B1C"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* ── 왼쪽 복싱글러브 (정적) ── */}
        <g>
          <ellipse cx="55" cy="160" rx="18" ry="20" fill="#E8553A" stroke="#A33524" strokeWidth="2" />
          <ellipse cx="55" cy="155" rx="13" ry="6" fill="#FF7855" opacity="0.5" />
          <rect x="48" y="173" width="14" height="6" rx="2" fill="#FFFFFF" />
          {/* 글러브 끈 */}
          <path d="M 48 170 Q 55 175 62 170" stroke="#A33524" strokeWidth="1.5" fill="none" />
        </g>

        {/* ── 오른쪽 복싱글러브 (state 별 애니) ── */}
        <motion.g
          animate={rightGloveAnim}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "145px 160px" }}
        >
          <ellipse cx="145" cy="160" rx="18" ry="20" fill="#E8553A" stroke="#A33524" strokeWidth="2" />
          <ellipse cx="145" cy="155" rx="13" ry="6" fill="#FF7855" opacity="0.5" />
          <rect x="138" y="173" width="14" height="6" rx="2" fill="#FFFFFF" />
          <path d="M 138 170 Q 145 175 152 170" stroke="#A33524" strokeWidth="1.5" fill="none" />
        </motion.g>

        {/* ── celebrate state: 별 + 반짝 ── */}
        {state === "celebrate" && (
          <>
            <motion.text
              x="35"
              y="50"
              fontSize="20"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 20, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              ✨
            </motion.text>
            <motion.text
              x="155"
              y="55"
              fontSize="18"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, -20, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
            >
              ⭐
            </motion.text>
            <motion.text
              x="20"
              y="180"
              fontSize="16"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
            >
              ✨
            </motion.text>
          </>
        )}
      </motion.svg>
    </div>
  );
};

export default OsamMascot;
