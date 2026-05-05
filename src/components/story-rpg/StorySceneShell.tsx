/**
 * 153 스토리 RPG — 씬 비주얼 셸 (Stage 47A 확장).
 *
 * 일러스트 배경 (SceneBackground) + 시네마틱 레터박스 + 그라디언트 폴백.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { motion } from "framer-motion";
import Letterbox from "./visuals/effects/Letterbox";
import type { SceneBackgroundTheme, SceneMood } from "./visuals/backgrounds/SceneBackground";

// 비주얼 자산이 무거우므로 lazy 로드
const SceneBackground = lazy(() => import("./visuals/backgrounds/SceneBackground"));

const THEME_FALLBACK_GRADIENT: Record<string, string> = {
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
  /** Stage 47A — SceneBackground 테마 */
  backgroundTheme?: string;
  mood?: SceneMood;
  cinematic?: boolean;
}

const SCENE_THEME_KEYS: SceneBackgroundTheme[] = [
  "gym_entrance",
  "gym_mirror",
  "gym_ring",
  "gym_sandbag",
  "gym_rope",
  "gym_corner",
  "gym_hall",
  "master_room",
  "rival_arena",
  "champion_camp",
];

const StorySceneShell = ({
  children,
  bgmHint,
  backgroundTheme = "default",
  mood = "calm",
  cinematic = false,
}: StorySceneShellProps) => {
  const isSceneTheme = SCENE_THEME_KEYS.includes(backgroundTheme as SceneBackgroundTheme);
  const fallback =
    THEME_FALLBACK_GRADIENT[backgroundTheme] ?? THEME_FALLBACK_GRADIENT.default;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`relative mx-auto w-full max-w-md md:max-w-xl overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br ${fallback} shadow-lg shadow-amber-500/5`}
    >
      {/* 일러스트 배경 (z-0) */}
      {isSceneTheme && (
        <Suspense fallback={null}>
          <SceneBackground
            theme={backgroundTheme as SceneBackgroundTheme}
            mood={mood}
          />
        </Suspense>
      )}

      {bgmHint && (
        <span className="absolute right-3 top-2 z-20 text-[9px] font-mono uppercase tracking-[0.2em] text-amber-300/40">
          ♪ {bgmHint}
        </span>
      )}

      {/* 컨텐츠 (z-10) */}
      <div className="relative z-10 p-4">{children}</div>

      {/* 시네마틱 레터박스 (z-30) */}
      <Letterbox active={cinematic} />
    </motion.section>
  );
};

export default StorySceneShell;
