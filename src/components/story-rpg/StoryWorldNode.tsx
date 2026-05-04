/**
 * 153 스토리 RPG — 단일 월드맵 노드 (단계 38).
 */

import {
  Activity,
  CircleDot,
  CornerDownRight,
  DoorOpen,
  GraduationCap,
  Package,
  Square,
  Star,
  Swords,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { STORY_NODE_ICON } from "@/data/storyRpgVisuals";
import type { StoryNode, StoryNodeType } from "@/types/storyRpg";

const ICON_MAP: Record<string, LucideIcon> = {
  DoorOpen,
  Square,
  Activity,
  Package,
  CircleDot,
  CornerDownRight,
  Star,
  GraduationCap,
  Tent,
  Swords,
};

export type StoryWorldNodeState = "current" | "cleared" | "locked" | "neutral";

export interface StoryWorldNodeProps {
  node: StoryNode;
  state?: StoryWorldNodeState;
}

const STATE_STYLE: Record<StoryWorldNodeState, string> = {
  current:
    "border-amber-400/60 bg-gradient-to-br from-amber-500/20 to-rose-500/10 text-amber-100 ring-2 ring-amber-400/40",
  cleared:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
  locked:
    "border-white/5 bg-gray-900/40 text-muted-foreground opacity-70",
  neutral:
    "border-white/10 bg-gray-900/50 text-foreground",
};

const StoryWorldNode = ({ node, state = "neutral" }: StoryWorldNodeProps) => {
  const iconName = STORY_NODE_ICON[node.node_type as StoryNodeType] ?? "Square";
  const Icon = ICON_MAP[iconName] ?? Square;

  return (
    <div
      className={`relative flex flex-col gap-1.5 rounded-2xl border p-3 transition-all ${STATE_STYLE[state]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="truncate text-[12px] font-black">{node.title}</p>
      </div>
      <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
        {node.description}
      </p>
      {state === "current" && (
        <span className="absolute -top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-amber-950">
          지금 여기
        </span>
      )}
    </div>
  );
};

export default StoryWorldNode;
