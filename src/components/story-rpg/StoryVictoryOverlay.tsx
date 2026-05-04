/**
 * 153 스토리 RPG — 승리 풀스크린 (단계 41).
 *
 * z-[90] 풀스크린 + canvas-confetti 3-stage. 보상 카드 표시.
 *
 * 보호 원칙:
 *   · 보상 지급은 이미 RPC 에서 완료된 결과만 표시. 여기서 wallet update X.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import OsamMascot from "@/components/mascot/OsamMascot";
import type { StoryChapter, StoryRewardResult } from "@/types/storyRpg";

export interface StoryVictoryOverlayProps {
  chapter: StoryChapter;
  rewardResult: StoryRewardResult;
  onClose: () => void;
}

const StoryVictoryOverlay = ({
  chapter,
  rewardResult,
  onClose,
}: StoryVictoryOverlayProps) => {
  useEffect(() => {
    // 3-stage confetti
    const fire = (x: number, delay: number, particles: number) =>
      setTimeout(() => {
        confetti({
          particleCount: particles,
          spread: 70,
          origin: { x, y: 0.5 },
          colors: ["#fbbf24", "#fde047", "#f97316", "#fb7185"],
        });
      }, delay);

    fire(0.2, 0, 80);
    fire(0.8, 200, 80);
    fire(0.5, 450, 120);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-gradient-to-b from-amber-950/80 via-rose-950/70 to-gray-950 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.h1
        initial={{ scale: 0.4, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 14, stiffness: 220 }}
        className="bg-gradient-to-r from-amber-300 via-yellow-200 to-rose-300 bg-clip-text text-center text-6xl font-black uppercase tracking-wider text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]"
      >
        VICTORY!
      </motion.h1>

      <motion.div
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(251,191,36,0.0)",
            "0 0 40px 10px rgba(251,191,36,0.4)",
            "0 0 0 0 rgba(251,191,36,0.0)",
          ],
        }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        className="mt-6 rounded-full"
      >
        <OsamMascot size="xl" state="celebrate" />
      </motion.div>

      <p className="mt-4 text-center text-[12px] text-amber-100">
        {chapter.chapter_number}장
      </p>
      <h2 className="mt-1 text-center text-xl font-black text-foreground">
        {chapter.title}
      </h2>
      <p className="mt-2 text-center text-[12px] leading-relaxed text-amber-100/80">
        내 복서의 이야기가 다음 장으로 넘어갑니다.
      </p>

      <div className="mt-6 grid w-full max-w-sm gap-2">
        <div className="flex items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3">
          <span className="text-[11px] font-bold text-amber-200">QUEST XP</span>
          <span className="text-base font-black tabular-nums text-amber-100">
            +{rewardResult.quest_xp_granted}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3">
          <span className="text-[11px] font-bold text-rose-200">파이트 머니</span>
          <span className="text-base font-black tabular-nums text-rose-100">
            +{rewardResult.gems_granted}
          </span>
        </div>
        {rewardResult.reward_title && (
          <div className="flex items-center justify-between rounded-2xl border border-yellow-400/40 bg-yellow-500/10 px-4 py-3">
            <span className="text-[11px] font-bold text-yellow-200">🏆 칭호</span>
            <span className="text-sm font-black text-yellow-100">
              {rewardResult.reward_title}
            </span>
          </div>
        )}
        {rewardResult.reward_card_code && (
          <div className="flex items-center justify-between rounded-2xl border border-violet-400/40 bg-violet-500/10 px-4 py-3">
            <span className="text-[11px] font-bold text-violet-200">🎴 카드</span>
            <span className="text-sm font-black text-violet-100">
              {rewardResult.reward_card_code}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-8 rounded-pill border border-amber-400/60 bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-amber-950 shadow-lg shadow-amber-500/30 active:scale-[0.98]"
      >
        다음 챕터로 →
      </button>
    </motion.div>
  );
};

export default StoryVictoryOverlay;
