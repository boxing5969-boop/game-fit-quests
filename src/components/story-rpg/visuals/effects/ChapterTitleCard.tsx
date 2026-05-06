/**
 * 153 스토리 RPG — 챕터 시작 타이틀 카드 (Stage 47B+ 자산 통합).
 *
 * chapter.code 매칭되는 PNG 가 있으면 1.5s 페이드인 + 1.5s 유지 + 0.5s 페이드아웃.
 * 없으면 즉시 onComplete (skip).
 * StoryRpgPage 의 mode='scene' && sceneIndex===0 진입 시 한 번만 마운트.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveChapterTitleAsset, PIXELATED_CSS } from "../assetMap";

export interface ChapterTitleCardProps {
  chapterCode: string | null | undefined;
  onComplete: () => void;
}

const FADE_IN_MS = 500;
const HOLD_MS = 1500;
const FADE_OUT_MS = 500;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

const ChapterTitleCard = ({ chapterCode, onComplete }: ChapterTitleCardProps) => {
  const pngPath = resolveChapterTitleAsset(chapterCode);

  useEffect(() => {
    if (!pngPath) {
      // 매칭 자산 없음 — 즉시 완료
      onComplete();
      return;
    }
    const t = setTimeout(onComplete, TOTAL_MS);
    return () => clearTimeout(t);
  }, [pngPath, onComplete]);

  if (!pngPath) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={pngPath}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        exit={{ opacity: 0 }}
        transition={{
          duration: TOTAL_MS / 1000,
          times: [0, FADE_IN_MS / TOTAL_MS, (FADE_IN_MS + HOLD_MS) / TOTAL_MS, 1],
          ease: "linear",
        }}
        onClick={onComplete}
        className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85"
        style={{ pointerEvents: "auto" }}
      >
        <img
          src={pngPath}
          alt={chapterCode ?? "chapter title"}
          loading="eager"
          decoding="async"
          className="max-h-[80vh] max-w-[90vw] object-contain"
          style={PIXELATED_CSS}
        />
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest text-white/40">
          탭하여 건너뛰기
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChapterTitleCard;
