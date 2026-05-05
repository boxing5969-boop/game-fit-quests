/**
 * 153 스토리 RPG visual tokens (단계 35).
 *
 * 기존 마이복서153 UI 스타일을 크게 바꾸지 않고, route/node/obstacle 별 색상·아이콘 매핑만 제공.
 * 실제 UI 컴포넌트는 36~38단계에서 본 토큰을 import 해서 사용한다.
 */

import type { StoryNodeType, StoryRouteType } from "@/types/storyRpg";

export const STORY_ROUTE_VISUAL: Record<
  StoryRouteType,
  { accent: string; ring: string; gradient: string; chip: string; emoji: string }
> = {
  master: {
    accent: "text-amber-300",
    ring: "ring-amber-300/40",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    chip: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    emoji: "🥇",
  },
  pro: {
    accent: "text-sky-300",
    ring: "ring-sky-300/40",
    gradient: "from-sky-500/20 via-indigo-500/10 to-transparent",
    chip: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    emoji: "🥊",
  },
  champion: {
    accent: "text-rose-300",
    ring: "ring-rose-300/40",
    gradient: "from-rose-500/20 via-fuchsia-500/10 to-transparent",
    chip: "bg-rose-500/15 text-rose-200 border-rose-500/30",
    emoji: "👑",
  },
};

// lucide-react 아이콘 이름 (StoryWorldNode 에서 dynamic import 또는 매핑으로 사용)
export const STORY_NODE_ICON: Record<StoryNodeType, string> = {
  gym: "DoorOpen",
  mirror: "Square",
  rope: "Activity",
  sandbag: "Package",
  ring: "CircleDot",
  corner: "CornerDownRight",
  hall: "Star",
  master_room: "GraduationCap",
  camp: "Tent",
  rival_arena: "Swords",
};

export const STORY_OBSTACLE_EMOJI: Record<string, string> = {
  lazy_slime: "🟢",
  guard_breaker: "🛡️",
  breath_holder: "👻",
  wrist_break: "🫨",
  quit_demon: "😈",
  excuse_goblin: "🙊",
  tense_wolf: "🐺",
  compare_monster: "🪞",
  overtrain_golem: "🪨",
};

export const STORY_CHAPTER_STATE_VISUAL = {
  locked: {
    label: "잠김",
    chip: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  available: {
    label: "도전 가능",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  },
  in_progress: {
    label: "진행 중",
    chip: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  },
  completed: {
    label: "조건 완료",
    chip: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  },
  reward_claimed: {
    label: "보상 수령 완료",
    chip: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  },
} as const;

export type StoryChapterStateKey = keyof typeof STORY_CHAPTER_STATE_VISUAL;

// ──────────────────────────────────────────────────────────────────
// Stage 47A — 비주얼 오버홀 토큰
// ──────────────────────────────────────────────────────────────────

export const STORY_VISUAL_TOKENS = {
  amberDeep: "#b87900",
  bloodRed: "#a40e1a",
  fogGray: "#8a92a3",
  lanternGlow: "#fdb85c",
  midnightNavy: "#0b0e2e",
  midnightDeep: "#1a1f4d",
  dawnOrange: "#f5832b",
  champCrimson: "#1a0a0a",
} as const;

export const STORY_ROUTE_BACKDROP_PALETTE = {
  master_path: {
    skyFrom: STORY_VISUAL_TOKENS.midnightNavy,
    skyTo: STORY_VISUAL_TOKENS.midnightDeep,
    accent: STORY_VISUAL_TOKENS.lanternGlow,
  },
  pro_path: {
    skyFrom: "#1c2547",
    skyTo: STORY_VISUAL_TOKENS.dawnOrange,
    accent: STORY_VISUAL_TOKENS.amberDeep,
  },
  champion_road: {
    skyFrom: "#000814",
    skyTo: STORY_VISUAL_TOKENS.champCrimson,
    accent: STORY_VISUAL_TOKENS.bloodRed,
  },
} as const;
