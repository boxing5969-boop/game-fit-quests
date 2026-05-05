/**
 * 153 스토리 RPG — 씬 비주얼 셸 (단계 46).
 *
 * 모든 scene 컴포넌트를 감싸는 비율 박스. 배경 그라디언트 / bgm hint 표시.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const THEME_GRADIENT: Record<string, string> = {
  default: "from-slate-950 via-gray-900 to-slate-950",
  gym: "from-amber-950/40 via-slate-900 to-gray-950",
  ring: "from-rose-950/30 via-slate-900 to-amber-950/20",
  master_room: "from-amber-900/40 via-amber-950/30 to-gray-950",
  mirror: "from-indigo-950/30 via-slate-900 to-gray-950",
  ring_lights: "from-amber-900/30 via-gray-950 to-amber-900/30",
  starfield: "from-indigo-950 via-slate-950 to-gray-950",
  sunrise: "from-amber-700/30 via-rose-700/20 to-indigo-900/30",
};

export interface StorySceneShellProps {
  children: ReactNode;
  bgmHint?: string | null;
  backgroundTheme?: string;
}

const StorySceneShell = ({
  children,
  bgmHint,
  backgroundTheme = "default",
}: StorySceneShellProps) => {
  const grad = THEME_GRADIENT[backgroundTheme] ?? THEME_GRADIENT.default;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`relative mx-auto w-full max-w-md md:max-w-xl rounded-3xl border border-amber-500/20 bg-gradient-to-br ${grad} p-4 shadow-lg shadow-amber-500/5`}
    >
      {bgmHint && (
        <span className="absolute right-3 top-2 text-[9px] font-mono uppercase tracking-[0.2em] text-amber-300/40">
          ♪ {bgmHint}
        </span>
      )}
      {children}
    </motion.section>
  );
};

export default StorySceneShell;
