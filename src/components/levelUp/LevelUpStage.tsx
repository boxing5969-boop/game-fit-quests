/**
 * 153 — 레벨업 Cinematic 무대 (backdrop + vignette + 회전 빛줄기).
 *
 * Rank 별 색상 차별화:
 *   white — silver/holographic
 *   blue  — cyan storm
 *   red   — crimson flame
 *   black — gold + violet (mastery)
 *
 * 사용:
 *   <LevelUpStage rank="blue" isMaster={false}>
 *     <LevelUpTrophy ... />
 *     <LevelUpHeadline ... />
 *   </LevelUpStage>
 */

import { motion } from "framer-motion";
import { type ReactNode } from "react";

export interface LevelUpStageProps {
  rank: string;
  isMaster?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

/** Rank → conic-gradient 빛줄기 색상 (HSL 변수 기반) */
const LIGHT_RAYS_BY_RANK: Record<string, string> = {
  white:
    "conic-gradient(from var(--rays-angle, 0deg), transparent 0deg, hsla(220, 14%, 95%, 0.7) 30deg, transparent 60deg, transparent 90deg, hsla(42, 90%, 64%, 0.5) 120deg, transparent 150deg, transparent 180deg, hsla(220, 14%, 90%, 0.6) 210deg, transparent 240deg, transparent 270deg, hsla(42, 90%, 64%, 0.4) 300deg, transparent 330deg, transparent 360deg)",
  blue:
    "conic-gradient(from var(--rays-angle, 0deg), transparent 0deg, hsla(215, 100%, 70%, 0.8) 30deg, transparent 60deg, transparent 90deg, hsla(195, 100%, 70%, 0.6) 120deg, transparent 150deg, transparent 180deg, hsla(215, 100%, 60%, 0.7) 210deg, transparent 240deg, transparent 270deg, hsla(195, 100%, 65%, 0.5) 300deg, transparent 330deg, transparent 360deg)",
  red:
    "conic-gradient(from var(--rays-angle, 0deg), transparent 0deg, hsla(0, 84%, 65%, 0.9) 30deg, transparent 60deg, transparent 90deg, hsla(20, 100%, 60%, 0.7) 120deg, transparent 150deg, transparent 180deg, hsla(0, 84%, 60%, 0.8) 210deg, transparent 240deg, transparent 270deg, hsla(42, 90%, 60%, 0.6) 300deg, transparent 330deg, transparent 360deg)",
  black:
    "conic-gradient(from var(--rays-angle, 0deg), transparent 0deg, hsla(42, 90%, 64%, 1) 30deg, transparent 60deg, transparent 90deg, hsla(280, 70%, 60%, 0.8) 120deg, transparent 150deg, transparent 180deg, hsla(42, 100%, 70%, 0.95) 210deg, transparent 240deg, transparent 270deg, hsla(280, 70%, 50%, 0.7) 300deg, transparent 330deg, transparent 360deg)",
};

/** Rank → vignette glow 색상 */
const VIGNETTE_BY_RANK: Record<string, string> = {
  white:
    "radial-gradient(ellipse at center, transparent 30%, hsla(220, 14%, 90%, 0.15) 60%, hsla(220, 14%, 12%, 0.85) 100%)",
  blue:
    "radial-gradient(ellipse at center, transparent 30%, hsla(215, 100%, 30%, 0.25) 60%, hsla(220, 70%, 8%, 0.9) 100%)",
  red:
    "radial-gradient(ellipse at center, transparent 30%, hsla(0, 84%, 30%, 0.3) 60%, hsla(0, 30%, 5%, 0.92) 100%)",
  black:
    "radial-gradient(ellipse at center, transparent 25%, hsla(42, 90%, 35%, 0.4) 50%, hsla(280, 50%, 20%, 0.5) 75%, hsla(0, 0%, 0%, 0.95) 100%)",
};

const LevelUpStage = ({ rank, isMaster, children, onClick }: LevelUpStageProps) => {
  const rankKey = (rank ?? "white").toLowerCase();
  const lightRays = LIGHT_RAYS_BY_RANK[rankKey] ?? LIGHT_RAYS_BY_RANK.white;
  const vignette = VIGNETTE_BY_RANK[rankKey] ?? VIGNETTE_BY_RANK.white;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="레벨업 셀러브레이션"
    >
      {/* Layer 1: 진한 backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-foreground/85 backdrop-blur-md"
      />

      {/* Layer 2: vignette glow (rank 별) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute inset-0"
        style={{ background: vignette }}
      />

      {/* Layer 3: 회전 빛줄기 (conic-gradient) */}
      <motion.div
        initial={{ opacity: 0, rotate: 0, scale: 0.8 }}
        animate={{
          opacity: isMaster ? 0.95 : 0.75,
          rotate: 360,
          scale: 1,
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          opacity: { duration: 0.8, delay: 0.3 },
          rotate: { duration: isMaster ? 8 : 12, repeat: Infinity, ease: "linear" },
          scale: { duration: 0.8, delay: 0.3, type: "spring", damping: 14 },
        }}
        className="absolute h-[200vmax] w-[200vmax] mix-blend-screen"
        style={{
          background: lightRays,
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Layer 4: 보조 회전 (반대 방향, master 만) */}
      {isMaster && (
        <motion.div
          initial={{ opacity: 0, rotate: 360 }}
          animate={{ opacity: 0.5, rotate: 0 }}
          transition={{
            opacity: { duration: 1, delay: 0.5 },
            rotate: { duration: 16, repeat: Infinity, ease: "linear" },
          }}
          className="absolute h-[180vmax] w-[180vmax] mix-blend-overlay"
          style={{
            background: lightRays,
            filter: "blur(8px)",
            maskImage:
              "radial-gradient(ellipse at center, black 15%, transparent 60%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 15%, transparent 60%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Layer 5: 콘텐츠 (트로피, 헤드라인 등) */}
      <div
        className="relative z-10 mx-4 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </motion.div>
  );
};

export default LevelUpStage;
