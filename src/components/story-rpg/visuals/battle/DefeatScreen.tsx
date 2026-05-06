/**
 * 153 스토리 RPG — 패배 화면 (Stage 47B).
 *
 * 검은 페이드 + "DEFEAT" + 격려 문구 + 2 버튼.
 */

import { motion } from "framer-motion";
import PlayerBoxer, { type PlayerRouteColor } from "./PlayerBoxer";

export interface DefeatScreenProps {
  routeColor?: PlayerRouteColor;
  onRetry: () => void;
  onWorldMap: () => void;
}

const DefeatScreen = ({
  routeColor = "master",
  onRetry,
  onWorldMap,
}: DefeatScreenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400"
      >
        DEFEAT
      </motion.p>
      <motion.h2
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-black tracking-wider text-zinc-200"
      >
        패배
      </motion.h2>

      <PlayerBoxer pose="hurt" routeColor={routeColor} size="sm" />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="max-w-[260px] text-[11px] leading-relaxed text-zinc-400"
      >
        패배는 끝이 아니다. <br />
        호흡을 정비하고 다시 일어서자.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-4 flex flex-col gap-2"
      >
        <button
          type="button"
          onClick={onRetry}
          className="rounded-pill border border-amber-500/50 bg-amber-500/15 px-6 py-2 text-[12px] font-black text-amber-100 active:scale-[0.98]"
        >
          다시 도전
        </button>
        <button
          type="button"
          onClick={onWorldMap}
          className="rounded-pill border border-white/15 bg-gray-900/50 px-6 py-2 text-[11px] font-bold text-zinc-200 active:scale-[0.98]"
        >
          월드맵으로
        </button>
      </motion.div>
    </motion.div>
  );
};

export default DefeatScreen;
