/**
 * 153 스토리 RPG — 챕터 클리어 cinematic (Stage 47A-fix).
 *
 * complete_chapter 응답 직후 1.5s 검은 화면 + amber 텍스트.
 * 스킵: 클릭하면 즉시 닫힘.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChapterCompleteResult } from "@/types/storyRpg";

export interface ChapterClearOverlayProps {
  result: ChapterCompleteResult | null;
  onClose: () => void;
}

const HOLD_MS = 1500;

const ChapterClearOverlay = ({ result, onClose }: ChapterClearOverlayProps) => {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onClose, HOLD_MS);
    return () => clearTimeout(t);
  }, [result, onClose]);

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center"
          style={{ pointerEvents: "auto" }}
        >
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80"
          >
            CHAPTER CLEAR
          </motion.p>
          <motion.h2
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4, type: "spring", stiffness: 200 }}
            className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-3xl font-black tracking-wider text-transparent drop-shadow-[0_0_18px_rgba(253,184,92,0.5)]"
          >
            {result.chapter_title ?? result.chapter_code}
          </motion.h2>
          {result.already_completed ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[11px] text-amber-100/70"
            >
              이미 완료된 챕터입니다 (보상 0)
            </motion.p>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[12px] text-amber-100/90"
            >
              <span className="text-amber-300">+{result.story_xp_granted}</span> XP
              <span className="mx-2 text-amber-400/60">·</span>
              <span className="text-yellow-200">+{result.ring_coins_granted}</span> 코인
              {result.card_added && result.card_code && (
                <>
                  <span className="mx-2 text-amber-400/60">·</span>
                  <span className="text-violet-200">🎴 {result.card_code}</span>
                </>
              )}
            </motion.p>
          )}
          {result.reward_title && !result.already_completed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-[11px] font-bold text-yellow-300"
            >
              🏆 {result.reward_title}
            </motion.p>
          )}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="mt-2 text-[9px] uppercase tracking-widest text-white/40"
          >
            탭하여 건너뛰기
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChapterClearOverlay;
