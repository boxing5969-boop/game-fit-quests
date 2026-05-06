/**
 * 153 스토리 RPG — 플레이어 복서 SVG (Stage 47B).
 *
 * 7 포즈: idle / jab / guard / footwork / counter / hurt / victory
 * route 별 옷/헤드밴드 색 (master amber / pro orange / champion red).
 * 200×240 viewBox, framer-motion variants 로 pose 전환.
 */

import { motion } from "framer-motion";

export type PlayerPose =
  | "idle"
  | "jab"
  | "guard"
  | "footwork"
  | "counter"
  | "hurt"
  | "victory";

export type PlayerRouteColor = "master" | "pro" | "champion";

export interface PlayerBoxerProps {
  pose?: PlayerPose;
  routeColor?: PlayerRouteColor;
  size?: "sm" | "md" | "lg";
  facing?: "right" | "left";
  className?: string;
}

const SIZE_PX: Record<NonNullable<PlayerBoxerProps["size"]>, number> = {
  sm: 80,
  md: 120,
  lg: 160,
};

const ROUTE_PALETTE: Record<PlayerRouteColor, { glove: string; band: string; shirt: string }> = {
  master: { glove: "#b87900", band: "#fdb85c", shirt: "#1f2a37" },
  pro: { glove: "#f5832b", band: "#fdb85c", shirt: "#1f2a37" },
  champion: { glove: "#a40e1a", band: "#fdb85c", shirt: "#0f0a14" },
};

const PlayerBoxer = ({
  pose = "idle",
  routeColor = "master",
  size = "md",
  facing = "right",
  className = "",
}: PlayerBoxerProps) => {
  const px = SIZE_PX[size];
  const palette = ROUTE_PALETTE[routeColor];
  const flip = facing === "left" ? "scaleX(-1)" : undefined;

  return (
    <motion.svg
      viewBox="0 0 200 240"
      width={px}
      height={px * 1.2}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ transform: flip, transformOrigin: "center" }}
      animate={
        pose === "idle"
          ? { y: [0, -2, 0] }
          : pose === "victory"
            ? { y: [-10, 0, -10] }
            : pose === "hurt"
              ? { rotate: [-3, 3, -2, 0] }
              : pose === "counter"
                ? { x: [-6, 8, 0] }
                : pose === "footwork"
                  ? { x: [0, 12, 0] }
                  : pose === "jab"
                    ? { x: [0, 6, 0] }
                    : { x: 0, y: 0 }
      }
      transition={{
        duration: pose === "idle" ? 1.4 : 0.4,
        repeat: pose === "idle" || pose === "victory" ? Infinity : 0,
        ease: "easeInOut",
      }}
    >
      {/* 그림자 */}
      <ellipse cx="100" cy="232" rx="36" ry="4" fill="#000" opacity="0.4" />

      {/* 다리 + 부츠 */}
      {pose === "footwork" ? (
        <>
          {/* 와이드 스탠스 */}
          <rect x="78" y="178" width="12" height="40" fill="#1a1a1a" rx="3" />
          <rect x="110" y="178" width="12" height="40" fill="#1a1a1a" rx="3" />
          <rect x="74" y="216" width="22" height="6" fill="#0a0a0a" rx="2" />
          <rect x="106" y="216" width="22" height="6" fill="#0a0a0a" rx="2" />
        </>
      ) : (
        <>
          <rect x="86" y="178" width="11" height="42" fill="#1a1a1a" rx="3" />
          <rect x="103" y="178" width="11" height="42" fill="#1a1a1a" rx="3" />
          <rect x="82" y="218" width="20" height="6" fill="#0a0a0a" rx="2" />
          <rect x="100" y="218" width="20" height="6" fill="#0a0a0a" rx="2" />
        </>
      )}

      {/* 몸통 — 셔츠 */}
      <path
        d={
          pose === "guard"
            ? "M 70 180 L 70 110 Q 100 100 130 110 L 130 180 Z"
            : "M 70 180 L 75 110 Q 100 100 125 110 L 130 180 Z"
        }
        fill={palette.shirt}
      />
      {/* 153 로고 */}
      <text
        x="100"
        y="155"
        fontSize="14"
        fontWeight="900"
        textAnchor="middle"
        fill={palette.band}
      >
        153
      </text>

      {/* 머리 + 헤드밴드 */}
      {pose === "hurt" ? (
        <>
          <ellipse cx="100" cy="78" rx="22" ry="26" fill="#f0d2b6" />
          <rect x="78" y="68" width="44" height="6" fill={palette.band} />
          {/* 별 (어지러움) */}
          <text x="125" y="60" fontSize="14" fill="#fde047">✦</text>
          <text x="70" y="55" fontSize="10" fill="#fde047">✦</text>
        </>
      ) : (
        <>
          <ellipse cx="100" cy="80" rx="22" ry="26" fill="#f0d2b6" stroke="#1a1a1a" strokeWidth="1.2" />
          <rect x="78" y="70" width="44" height="6" fill={palette.band} />
          {/* 눈 */}
          {pose === "victory" ? (
            <>
              <path d="M 86 82 Q 92 76 98 82" stroke="#1a1a1a" strokeWidth="2" fill="none" />
              <path d="M 102 82 Q 108 76 114 82" stroke="#1a1a1a" strokeWidth="2" fill="none" />
            </>
          ) : pose === "counter" ? (
            <>
              <path d="M 84 84 L 96 80" stroke="#1a1a1a" strokeWidth="2.5" />
              <path d="M 104 80 L 116 84" stroke="#1a1a1a" strokeWidth="2.5" />
            </>
          ) : (
            <>
              <ellipse cx="92" cy="83" rx="2" ry="3" fill="#1a1a1a" />
              <ellipse cx="108" cy="83" rx="2" ry="3" fill="#1a1a1a" />
            </>
          )}
          {/* 입 */}
          {pose === "victory" ? (
            <path d="M 92 95 Q 100 102 108 95" stroke="#1a1a1a" strokeWidth="2" fill="none" />
          ) : (
            <line x1="94" y1="96" x2="106" y2="96" stroke="#1a1a1a" strokeWidth="2" />
          )}
        </>
      )}

      {/* 글러브 — pose 별 위치 */}
      {pose === "jab" || pose === "counter" ? (
        <>
          {/* 후속 글러브 (가슴 앞) */}
          <ellipse cx="80" cy="135" rx="12" ry="14" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
          {/* 메인 글러브 (앞으로 뻗음) */}
          <ellipse
            cx={pose === "counter" ? "175" : "165"}
            cy={pose === "counter" ? "115" : "120"}
            rx={pose === "counter" ? "16" : "14"}
            ry={pose === "counter" ? "18" : "15"}
            fill={palette.glove}
            stroke="#1a1a1a"
            strokeWidth="1.5"
          />
          {/* 팔 */}
          <line
            x1="115"
            y1="125"
            x2={pose === "counter" ? "165" : "155"}
            y2={pose === "counter" ? "115" : "120"}
            stroke={palette.shirt}
            strokeWidth="10"
            strokeLinecap="round"
          />
        </>
      ) : pose === "guard" ? (
        <>
          {/* 양 글러브 얼굴 앞 모음 */}
          <ellipse cx="85" cy="92" rx="13" ry="15" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
          <ellipse cx="115" cy="92" rx="13" ry="15" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
        </>
      ) : pose === "victory" ? (
        <>
          {/* 양 글러브 위로 들기 */}
          <ellipse cx="65" cy="55" rx="14" ry="16" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
          <ellipse cx="135" cy="55" rx="14" ry="16" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
          <line x1="80" y1="100" x2="68" y2="65" stroke={palette.shirt} strokeWidth="10" strokeLinecap="round" />
          <line x1="120" y1="100" x2="132" y2="65" stroke={palette.shirt} strokeWidth="10" strokeLinecap="round" />
        </>
      ) : pose === "hurt" ? (
        <>
          {/* 한 글러브 떨어져 있음 */}
          <ellipse cx="62" cy="155" rx="12" ry="14" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" opacity="0.85" />
          <ellipse cx="135" cy="140" rx="12" ry="14" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" opacity="0.85" />
        </>
      ) : (
        <>
          {/* idle / footwork — 양 글러브 가슴 앞 */}
          <ellipse cx="78" cy="130" rx="13" ry="15" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
          <ellipse cx="122" cy="130" rx="13" ry="15" fill={palette.glove} stroke="#1a1a1a" strokeWidth="1.5" />
        </>
      )}

      {/* 풋워크 — 발밑 dust */}
      {pose === "footwork" && (
        <g fill="#ccc" opacity="0.8">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.circle
              key={i}
              cx={70 + i * 20}
              cy={224}
              r={1.5 + (i % 3)}
              animate={{ y: [0, -8, -14], opacity: [0.8, 0.4, 0] }}
              transition={{ duration: 0.5, delay: i * 0.05, repeat: Infinity }}
            />
          ))}
        </g>
      )}
    </motion.svg>
  );
};

export default PlayerBoxer;
