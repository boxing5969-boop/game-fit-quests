/**
 * 153 스토리 RPG — 충격파 (Stage 47B).
 *
 * 3 동심원 + sparkles. 0.3s 페이드.
 */

import { motion } from "framer-motion";

export type HitKind = "normal" | "crit" | "weakness";

export interface HitEffectProps {
  id: string | number;
  x: number;
  y: number;
  kind?: HitKind;
}

const COLOR: Record<HitKind, string> = {
  normal: "#ffffff",
  crit: "#e41e28",
  weakness: "#fdb85c",
};

const HitEffect = ({ x, y, kind = "normal" }: HitEffectProps) => {
  const c = COLOR[kind];
  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width: 60, height: 60 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: c }}
        />
      ))}
      {/* sparkles */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * 60 * Math.PI) / 180;
        const dx = Math.cos(angle) * 28;
        const dy = Math.sin(angle) * 28;
        return (
          <motion.span
            key={`s-${i}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: c, boxShadow: `0 0 4px ${c}` }}
          />
        );
      })}
    </div>
  );
};

export default HitEffect;
