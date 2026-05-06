/**
 * 153 스토리 RPG — 카드 사용 연출 (Stage 47B).
 *
 * 카드가 우측에서 날아옴 → shimmer → 효과 텍스트 popup → 페이드.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";

export interface CardUseEffectProps {
  card: { code: string; name: string; effect_label?: string };
  onComplete: () => void;
}

const CardUseEffect = ({ card, onComplete }: CardUseEffectProps) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 1500);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/40"
    >
      <motion.div
        initial={{ x: 200, opacity: 0, rotate: 8 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative h-[200px] w-[140px] overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-500/30 via-rose-500/20 to-amber-900/40 shadow-[0_0_20px_rgba(253,184,92,0.6)]"
      >
        {/* shimmer */}
        <motion.div
          className="absolute inset-0"
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 0.9, delay: 0.3, repeat: Infinity, ease: "linear" }}
          style={{
            background:
              "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
          }}
        />
        {/* 카드 내용 */}
        <div className="relative z-10 flex h-full flex-col items-center justify-between p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-200">
            CARD
          </p>
          <div className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 60 60" width="50" height="50">
              <ellipse cx="30" cy="30" rx="22" ry="24" fill="#fdb85c" stroke="#7a4a1a" strokeWidth="2" />
              <text x="30" y="36" fontSize="22" textAnchor="middle" fill="#7a1a1a" fontWeight="900">★</text>
            </svg>
            <p className="text-[12px] font-black text-amber-100">{card.name}</p>
          </div>
          <p className="text-[10px] text-yellow-200">
            {card.effect_label ?? card.code}
          </p>
        </div>
      </motion.div>

      {/* 효과 텍스트 popup */}
      <motion.p
        initial={{ y: 0, opacity: 0, scale: 0.8 }}
        animate={{ y: -100, opacity: 1, scale: 1.2 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 text-2xl font-black text-yellow-300 drop-shadow-[0_0_10px_rgba(253,184,92,0.8)]"
      >
        ★ FIGHT
      </motion.p>
    </motion.div>
  );
};

export default CardUseEffect;
