/**
 * 153 — 레벨업 트로피 / 배지 (rank 별 차별화).
 *
 * 시퀀스:
 *   0~0.4s: 위에서 떨어지듯 spring scale-in (overshoot)
 *   0.4~1.4s: 360도 회전
 *   계속: 잔잔한 펄스 + glow ring
 */

import { motion } from "framer-motion";

export interface LevelUpTrophyProps {
  rank: string;
  isMaster?: boolean;
}

/** Rank → 트로피 emoji */
const TROPHY_EMOJI: Record<string, string> = {
  white: "🥊",
  blue: "🏅",
  red: "🥇",
  black: "🏆",
};

/** Rank → 글로우 색상 (HSL) */
const GLOW_BY_RANK: Record<string, string> = {
  white: "0 0 60px hsla(220, 14%, 95%, 0.8), 0 0 120px hsla(220, 14%, 85%, 0.5)",
  blue:
    "0 0 60px hsla(215, 100%, 70%, 0.9), 0 0 120px hsla(195, 100%, 60%, 0.6), 0 0 200px hsla(215, 100%, 50%, 0.3)",
  red:
    "0 0 60px hsla(0, 84%, 65%, 0.95), 0 0 120px hsla(20, 100%, 60%, 0.7), 0 0 200px hsla(0, 84%, 50%, 0.4)",
  black:
    "0 0 80px hsla(42, 90%, 64%, 1), 0 0 140px hsla(42, 100%, 70%, 0.9), 0 0 220px hsla(280, 70%, 60%, 0.6)",
};

/** Rank → 백 그라데이션 (rim 색) */
const RIM_BY_RANK: Record<string, string> = {
  white:
    "conic-gradient(from 0deg, hsla(220, 14%, 95%, 1), hsla(42, 90%, 80%, 1), hsla(220, 14%, 85%, 1), hsla(220, 14%, 95%, 1))",
  blue:
    "conic-gradient(from 0deg, hsla(215, 100%, 70%, 1), hsla(195, 100%, 75%, 1), hsla(215, 100%, 50%, 1), hsla(215, 100%, 70%, 1))",
  red:
    "conic-gradient(from 0deg, hsla(0, 84%, 70%, 1), hsla(42, 90%, 70%, 1), hsla(0, 84%, 50%, 1), hsla(0, 84%, 70%, 1))",
  black:
    "conic-gradient(from 0deg, hsla(42, 90%, 70%, 1), hsla(280, 70%, 60%, 1), hsla(42, 100%, 80%, 1), hsla(42, 90%, 60%, 1))",
};

const LevelUpTrophy = ({ rank, isMaster }: LevelUpTrophyProps) => {
  const rankKey = (rank ?? "white").toLowerCase();
  const emoji = isMaster ? "👑" : TROPHY_EMOJI[rankKey] ?? "🥊";
  const glow = GLOW_BY_RANK[rankKey] ?? GLOW_BY_RANK.white;
  const rim = RIM_BY_RANK[rankKey] ?? RIM_BY_RANK.white;

  return (
    <div className="relative mx-auto mb-6 flex h-44 w-44 items-center justify-center">
      {/* Rim — 회전 그라데이션 링 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
        animate={{
          opacity: 1,
          scale: 1,
          rotate: 360,
        }}
        transition={{
          opacity: { duration: 0.6, delay: 0.2 },
          scale: { duration: 0.8, delay: 0.2, type: "spring", damping: 12 },
          rotate: {
            duration: isMaster ? 4 : 6,
            repeat: Infinity,
            ease: "linear",
          },
        }}
        className="absolute inset-0 rounded-full"
        style={{
          background: rim,
          filter: "blur(2px)",
        }}
        aria-hidden="true"
      />

      {/* Inner 어두운 배경 */}
      <div
        className="absolute inset-2 rounded-full bg-card/95"
        aria-hidden="true"
      />

      {/* 펄스 글로우 (반복) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0.4, 0.9, 0.4],
        }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.4,
        }}
        className="absolute inset-3 rounded-full"
        style={{
          boxShadow: glow,
        }}
        aria-hidden="true"
      />

      {/* 트로피 emoji — 떨어졌다가 spring 으로 정착 + 한바퀴 회전 */}
      <motion.div
        initial={{ y: -200, scale: 0, rotate: -180, opacity: 0 }}
        animate={{
          y: [0, -8, 0],
          scale: 1,
          rotate: 360,
          opacity: 1,
        }}
        transition={{
          y: {
            delay: 1.4,
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          },
          scale: {
            duration: 0.9,
            delay: 0.4,
            type: "spring",
            damping: 9,
            stiffness: 220,
          },
          rotate: {
            duration: 0.9,
            delay: 0.4,
            type: "spring",
            damping: 14,
          },
          opacity: { duration: 0.4, delay: 0.4 },
        }}
        className="relative z-10 select-none text-7xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        aria-hidden="true"
      >
        {emoji}
      </motion.div>

      {/* Master 만 — 추가 별 장식 */}
      {isMaster && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.8],
              }}
              transition={{
                duration: 2,
                delay: 1.2 + i * 0.15,
                repeat: Infinity,
                repeatDelay: 0.8,
              }}
              className="absolute select-none text-2xl"
              style={{
                left: `${50 + 50 * Math.cos((i / 6) * Math.PI * 2)}%`,
                top: `${50 + 50 * Math.sin((i / 6) * Math.PI * 2)}%`,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden="true"
            >
              ✨
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
};

export default LevelUpTrophy;
