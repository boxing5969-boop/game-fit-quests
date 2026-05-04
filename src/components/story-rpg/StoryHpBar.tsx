/**
 * 153 스토리 RPG — HP 바 (단계 41).
 *
 * 부드러운 채워짐 애니메이션 + HP 비율에 따른 색상 그라디언트.
 */

import { motion } from "framer-motion";

export interface StoryHpBarProps {
  currentHp: number;
  maxHp: number;
  variant?: "player" | "enemy";
  showNumbers?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const HEIGHT: Record<NonNullable<StoryHpBarProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
};

const StoryHpBar = ({
  currentHp,
  maxHp,
  variant = "player",
  showNumbers = true,
  size = "md",
  label,
}: StoryHpBarProps) => {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const pct = ratio * 100;

  const fillClass = (() => {
    if (ratio < 0.3)
      return "bg-gradient-to-r from-rose-600 to-rose-400";
    if (ratio < 0.6)
      return "bg-gradient-to-r from-amber-500 to-yellow-300";
    return variant === "enemy"
      ? "bg-gradient-to-r from-rose-500 to-rose-300"
      : "bg-gradient-to-r from-emerald-500 to-emerald-300";
  })();

  return (
    <div className="w-full">
      {(label || showNumbers) && (
        <div className="flex items-center justify-between text-[10px] font-bold tabular-nums">
          {label && (
            <span
              className={
                variant === "enemy" ? "text-rose-200" : "text-emerald-200"
              }
            >
              {label}
            </span>
          )}
          {showNumbers && (
            <span className="text-foreground">
              {Math.max(0, Math.round(currentHp))}/{maxHp}
            </span>
          )}
        </div>
      )}
      <div
        className={`mt-1 w-full overflow-hidden rounded-full border border-white/15 bg-gray-900/70 ${HEIGHT[size]}`}
      >
        <motion.div
          className={`h-full rounded-full ${fillClass}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
        />
      </div>
    </div>
  );
};

export default StoryHpBar;
