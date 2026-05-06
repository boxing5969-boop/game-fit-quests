/**
 * 153 스토리 RPG — 승리 cinematic (Stage 47B).
 *
 * "VICTORY" + 광선 5개 + 보상 요약 + 2초 후 onComplete.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import PlayerBoxer, { type PlayerRouteColor } from "./PlayerBoxer";

export interface VictoryFanfareProps {
  rewards?: {
    story_xp?: number;
    ring_coins?: number;
    card_code?: string | null;
  };
  routeColor?: PlayerRouteColor;
  onComplete: () => void;
}

const VictoryFanfare = ({
  rewards,
  routeColor = "master",
  onComplete,
}: VictoryFanfareProps) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 2000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 overflow-hidden bg-black/70 px-6 text-center"
    >
      {/* 광선 5개 */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ray-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#fdb85c" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#fdb85c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }).map((_, i) => {
          const angle = -45 + i * 22.5;
          return (
            <motion.line
              key={i}
              x1="50"
              y1="50"
              x2={50 + Math.cos((angle * Math.PI) / 180) * 80}
              y2={50 + Math.sin((angle * Math.PI) / 180) * 80}
              stroke="url(#ray-grad)"
              strokeWidth="1.5"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: [0, 0.8, 0.5], pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
            />
          );
        })}
      </svg>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 text-[10px] font-black uppercase tracking-[0.5em] text-amber-300/80"
      >
        VICTORY
      </motion.p>
      <motion.h2
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 220 }}
        className="relative z-10 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-4xl font-black tracking-wider text-transparent drop-shadow-[0_0_20px_rgba(253,184,92,0.6)]"
      >
        승리!
      </motion.h2>

      <div className="relative z-10 mt-2 flex flex-col items-center gap-1 text-[12px] text-amber-100">
        {typeof rewards?.story_xp === "number" && rewards.story_xp > 0 && (
          <p>
            <span className="text-amber-300">+{rewards.story_xp}</span> XP
          </p>
        )}
        {typeof rewards?.ring_coins === "number" && rewards.ring_coins > 0 && (
          <p>
            <span className="text-yellow-200">+{rewards.ring_coins}</span> 링 코인
          </p>
        )}
        {rewards?.card_code && (
          <p className="text-violet-200">🎴 카드 '{rewards.card_code}' 획득</p>
        )}
      </div>

      <div className="relative z-10 mt-3">
        <PlayerBoxer pose="victory" routeColor={routeColor} size="sm" />
      </div>
    </motion.div>
  );
};

export default VictoryFanfare;
