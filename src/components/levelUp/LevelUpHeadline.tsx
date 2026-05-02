/**
 * 153 — 레벨업 헤드라인 텍스트 + XP 카운트업.
 *
 * 시퀀스:
 *   1.0~1.5s: "LEVEL UP!" 텍스트 spring stagger
 *   1.5~1.9s: rank/level 정보 등장
 *   1.9~2.9s: XP 카운트업 (0 → +xp)
 */

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

import { RANK_LABELS } from "@/lib/rankLabels";

export interface LevelUpHeadlineProps {
  newLevel: number;
  newRank: string;
  xpGranted: number;
  isMaster?: boolean;
  /** "레벨 업" / "리그 승급" / "마스터 달성" 등 헤드라인 텍스트 변경 */
  headline?: string;
  /** rank 변경 모드일 때 표시 (white → blue) */
  oldRank?: string;
}

const TITLE_FONT = `'Black Han Sans', 'Noto Sans KR', system-ui, sans-serif`;

const LevelUpHeadline = ({
  newLevel,
  newRank,
  xpGranted,
  isMaster,
  headline,
  oldRank,
}: LevelUpHeadlineProps) => {
  const rankKey = (newRank ?? "white").toLowerCase();
  const oldRankKey = oldRank ? (oldRank ?? "white").toLowerCase() : null;
  const rankLabel = RANK_LABELS[rankKey] ?? rankKey;
  const oldRankLabel = oldRankKey ? RANK_LABELS[oldRankKey] ?? oldRankKey : null;

  const isRankUp = !!oldRank && oldRankKey !== rankKey;
  const headlineText =
    headline ??
    (isMaster
      ? "🏆 마스터 달성"
      : isRankUp
        ? "🎉 리그 승급"
        : "⚡ 레벨 업");

  // XP 카운트업
  const xpMotion = useMotionValue(0);
  const xpRounded = useTransform(xpMotion, (latest) => Math.round(latest));
  const [xpDisplay, setXpDisplay] = useState(0);

  useEffect(() => {
    if (xpGranted <= 0) return;
    const controls = animate(xpMotion, xpGranted, {
      duration: 1.0,
      delay: 1.9,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    const unsub = xpRounded.on("change", (v) => setXpDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [xpMotion, xpRounded, xpGranted]);

  // 텍스트 spring stagger
  const headlineLetters = Array.from(headlineText);

  return (
    <div className="text-center">
      {/* 메인 헤드라인 — 한 글자씩 spring 등장 */}
      <motion.h2
        className="mb-2 select-none text-[42px] font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        style={{ fontFamily: TITLE_FONT }}
      >
        {headlineLetters.map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 40, scale: 0.4, filter: "blur(8px)" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{
              duration: 0.5,
              delay: 1.0 + i * 0.04,
              type: "spring",
              damping: 14,
              stiffness: 240,
            }}
            className="inline-block"
            style={{
              textShadow:
                "0 0 24px hsla(42, 90%, 64%, 0.8), 0 0 48px hsla(42, 90%, 64%, 0.4)",
            }}
          >
            {char === " " ? " " : char}
          </motion.span>
        ))}
      </motion.h2>

      {/* Rank 변경 표시 (oldRank 있으면) */}
      {isRankUp && oldRankLabel && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 1.5,
            type: "spring",
            damping: 16,
          }}
          className="mb-2 flex items-center justify-center gap-3 text-[18px] font-bold text-white/90"
        >
          <span className="opacity-60">{oldRankLabel}</span>
          <motion.span
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-reward"
          >
            →
          </motion.span>
          <span className="text-reward">{rankLabel}</span>
        </motion.div>
      )}

      {/* 레벨 / 리그 정보 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="mb-6 text-[20px] font-bold tracking-wide text-white"
      >
        {!isRankUp && (
          <span>
            {rankLabel} <span className="text-reward">Lv.{newLevel}</span>
          </span>
        )}
        {isRankUp && (
          <span className="text-reward">새 리그 입성</span>
        )}
      </motion.div>

      {/* XP 카운트업 */}
      {xpGranted > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 1.85 }}
          className="mb-2"
        >
          <div className="mx-auto inline-flex items-baseline gap-2 rounded-pill border border-reward/40 bg-foreground/40 px-5 py-2 backdrop-blur-sm">
            <span className="text-[12px] font-bold uppercase tracking-wider text-reward">
              XP
            </span>
            <motion.span
              key={xpDisplay}
              className="number-font text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(246,196,83,0.8)]"
            >
              +{xpDisplay.toLocaleString()}
            </motion.span>
          </div>
        </motion.div>
      )}

      {/* Master 보너스 메시지 */}
      {isMaster && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.4 }}
          className="mt-3 text-[14px] font-medium text-reward/90"
        >
          최고의 자리에 도달했습니다 🥊
        </motion.p>
      )}
    </div>
  );
};

export default LevelUpHeadline;
