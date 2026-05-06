/**
 * 153 스토리 RPG — 데미지 popup (Stage 47B).
 *
 * 위로 떠오르며 페이드 (0.7s). variant 별 색/크기.
 */

import { motion } from "framer-motion";

export type DamagePopupVariant = "normal" | "weakness" | "crit" | "miss";

export interface DamagePopupProps {
  id: string | number;
  x: number;
  y: number;
  value: number | string;
  variant?: DamagePopupVariant;
}

const VARIANT_CLASS: Record<DamagePopupVariant, string> = {
  normal: "text-white text-base",
  weakness: "text-yellow-300 text-lg font-black drop-shadow-[0_0_6px_rgba(253,184,92,0.6)]",
  crit: "text-rose-400 text-2xl font-black drop-shadow-[0_0_8px_rgba(228,30,40,0.7)]",
  miss: "text-zinc-400 text-sm",
};

const DamagePopup = ({ x, y, value, variant = "normal" }: DamagePopupProps) => {
  return (
    <motion.span
      initial={{ y: 0, opacity: 1, scale: 0.85 }}
      animate={{ y: -50, opacity: 1, scale: 1.1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`pointer-events-none absolute z-30 -translate-x-1/2 font-black tabular-nums ${VARIANT_CLASS[variant]}`}
      style={{ left: x, top: y }}
    >
      {variant === "miss" ? "MISS" : `-${value}`}
    </motion.span>
  );
};

export default DamagePopup;
