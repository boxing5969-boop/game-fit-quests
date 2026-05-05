/**
 * 153 스토리 RPG — 챕터 노드 SVG 아이콘 (Stage 47A).
 *
 * 18 챕터를 커버하는 약 14 종 variant. status 별 색상/효과.
 */

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import type { ChapterIconVariant } from "./chapterIconMap";

export type ChapterNodeStatus = "locked" | "available" | "current" | "cleared";

export interface ChapterNodeIconProps {
  variant: ChapterIconVariant;
  status: ChapterNodeStatus;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  label?: string;
}

const SIZE_PX: Record<NonNullable<ChapterNodeIconProps["size"]>, number> = {
  sm: 48,
  md: 64,
  lg: 80,
};

const ChapterNodeIcon = ({
  variant,
  status,
  size = "md",
  onClick,
  label,
}: ChapterNodeIconProps) => {
  const px = SIZE_PX[size];
  const isLocked = status === "locked";
  const isCleared = status === "cleared";
  const isCurrent = status === "current";

  const stroke =
    status === "cleared"
      ? "#fdb85c"
      : status === "current"
        ? "#fef3c7"
        : status === "available"
          ? "#fdb85c"
          : "#475569";
  const fill =
    status === "locked" ? "rgba(15, 23, 42, 0.7)" : "rgba(15, 23, 42, 0.85)";
  const iconColor =
    status === "locked" ? "#64748b" : status === "cleared" ? "#fdb85c" : "#fef3c7";

  return (
    <motion.button
      type="button"
      disabled={isLocked}
      onClick={onClick}
      animate={
        isCurrent
          ? {
              boxShadow: [
                "0 0 0 0 rgba(253,184,92,0)",
                "0 0 0 10px rgba(253,184,92,0.18)",
                "0 0 0 0 rgba(253,184,92,0)",
              ],
            }
          : {}
      }
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
      whileHover={
        !isLocked
          ? { scale: 1.08, filter: "drop-shadow(0 0 6px rgba(253,184,92,0.6))" }
          : undefined
      }
      whileTap={!isLocked ? { scale: 0.94 } : undefined}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 ${
        isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      }`}
      style={{ width: px, height: px, background: fill, borderColor: stroke }}
      aria-label={label}
    >
      <svg viewBox="0 0 64 64" width={px * 0.62} height={px * 0.62}>
        <ChapterIconShape variant={variant} color={iconColor} />
      </svg>

      {isCleared && (
        <Check
          className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amber-400 p-0.5 text-amber-950"
          strokeWidth={3}
        />
      )}
      {isLocked && (
        <Lock className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gray-700 p-0.5 text-gray-300" />
      )}
    </motion.button>
  );
};

function ChapterIconShape({
  variant,
  color,
}: {
  variant: ChapterIconVariant;
  color: string;
}) {
  switch (variant) {
    case "door_open":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="10" width="14" height="44" />
          <rect x="36" y="10" width="14" height="44" />
          <line x1="32" y1="10" x2="32" y2="54" strokeDasharray="2 3" />
          <circle cx="22" cy="32" r="1.5" fill={color} />
          <circle cx="42" cy="32" r="1.5" fill={color} />
        </g>
      );
    case "two_gloves":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <ellipse cx="22" cy="34" rx="11" ry="14" />
          <ellipse cx="42" cy="34" rx="11" ry="14" />
          <path d="M 30 34 L 34 34" />
        </g>
      );
    case "mirror":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="18" y="10" width="28" height="40" rx="14" />
          <path d="M 24 20 Q 32 14 40 20" />
          <path d="M 24 30 Q 32 28 40 30" opacity="0.5" />
        </g>
      );
    case "rope_sun":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <circle cx="32" cy="22" r="10" />
          <line x1="32" y1="6" x2="32" y2="10" />
          <line x1="14" y1="22" x2="18" y2="22" />
          <line x1="46" y1="22" x2="50" y2="22" />
          <path d="M 12 50 Q 32 42 52 50" />
          <path d="M 12 54 Q 32 60 52 54" />
        </g>
      );
    case "broken_glove":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <ellipse cx="32" cy="32" rx="18" ry="20" />
          <path d="M 22 22 L 32 32 L 26 38 L 38 50" />
        </g>
      );
    case "master_door":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 12 10 Q 32 4 52 10 L 52 54 L 12 54 Z" />
          <line x1="32" y1="10" x2="32" y2="54" />
          <circle cx="32" cy="34" r="4" fill={color} />
          <line x1="32" y1="38" x2="32" y2="46" />
        </g>
      );
    case "metronome":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M 18 54 L 26 14 L 38 14 L 46 54 Z" />
          <line x1="32" y1="14" x2="42" y2="34" />
          <circle cx="42" cy="34" r="3" fill={color} />
        </g>
      );
    case "shadow_pair":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <circle cx="22" cy="26" r="7" />
          <circle cx="42" cy="26" r="7" />
          <path d="M 14 50 L 30 38" />
          <path d="M 50 50 L 34 38" />
        </g>
      );
    case "helping_hand":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 14 36 L 14 50 L 30 50 L 30 28 L 22 28 Z" />
          <path d="M 32 28 L 50 16 L 50 36 Q 42 44 32 40" />
        </g>
      );
    case "broken_clock":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <circle cx="32" cy="32" r="20" />
          <path d="M 32 18 L 32 32 L 42 38" />
          <path d="M 14 18 L 50 50" strokeDasharray="3 4" />
        </g>
      );
    case "inner_ring":
      return (
        <g stroke={color} strokeWidth="3" fill="none">
          <ellipse cx="32" cy="32" rx="22" ry="14" />
          <ellipse cx="32" cy="32" rx="14" ry="9" opacity="0.6" />
          <ellipse cx="32" cy="32" rx="6" ry="4" opacity="0.3" />
        </g>
      );
    case "infinite_mirror":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="10" width="36" height="44" rx="6" />
          <rect x="20" y="16" width="24" height="32" rx="4" opacity="0.7" />
          <rect x="26" y="22" width="12" height="20" rx="2" opacity="0.4" />
        </g>
      );
    case "ring_corner":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <line x1="14" y1="14" x2="14" y2="50" />
          <line x1="50" y1="14" x2="50" y2="50" />
          <line x1="14" y1="20" x2="50" y2="20" />
          <line x1="14" y1="32" x2="50" y2="32" />
          <line x1="14" y1="44" x2="50" y2="44" />
        </g>
      );
    case "sandbag":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <line x1="32" y1="6" x2="32" y2="14" />
          <rect x="22" y="14" width="20" height="36" rx="6" />
          <line x1="22" y1="22" x2="42" y2="22" />
          <line x1="22" y1="42" x2="42" y2="42" />
        </g>
      );
    case "champion_belt":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <rect x="6" y="22" width="52" height="20" rx="4" />
          <circle cx="32" cy="32" r="7" fill={color} fillOpacity="0.4" />
        </g>
      );
    case "rival_arena":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <ellipse cx="32" cy="38" rx="22" ry="10" />
          <line x1="22" y1="22" x2="42" y2="22" />
          <line x1="22" y1="22" x2="14" y2="38" />
          <line x1="42" y1="22" x2="50" y2="38" />
        </g>
      );
    case "fight_camp":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 12 50 L 32 14 L 52 50 Z" />
          <circle cx="32" cy="50" r="5" fill={color} fillOpacity="0.4" />
        </g>
      );
    case "boxing_hall":
      return (
        <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M 32 6 L 38 22 L 56 22 L 42 32 L 48 50 L 32 40 L 16 50 L 22 32 L 8 22 L 26 22 Z" />
        </g>
      );
    default:
      return <circle cx="32" cy="32" r="20" stroke={color} strokeWidth="3" fill="none" />;
  }
}

export default ChapterNodeIcon;
