/**
 * 153 스토리 RPG — 단일 루트 카드 (단계 37).
 */

import { Loader2 } from "lucide-react";
import type { StoryRoute } from "@/types/storyRpg";
import { STORY_ROUTE_VISUAL } from "@/data/storyRpgVisuals";

export type StoryRouteCardState = "current" | "available" | "switchable";

export interface StoryRouteCardProps {
  route: StoryRoute;
  state: StoryRouteCardState;
  loading?: boolean;
  onSelect: (route: StoryRoute) => void;
}

const STATE_BUTTON_LABEL: Record<StoryRouteCardState, string> = {
  current: "현재 선택됨",
  available: "이 길 선택하기",
  switchable: "이 길로 변경",
};

const StoryRouteCard = ({
  route,
  state,
  loading,
  onSelect,
}: StoryRouteCardProps) => {
  const visual = STORY_ROUTE_VISUAL[route.route_type];
  const isCurrent = state === "current";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${visual.gradient} p-4 ${
        isCurrent
          ? `border-white/30 ring-2 ${visual.ring}`
          : "border-white/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{visual.emoji}</span>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.2em] ${visual.accent}`}
          >
            {route.subtitle ?? "복서의 길"}
          </p>
          <h3 className="mt-0.5 text-base font-black text-foreground">
            {route.title}
          </h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {route.description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(route)}
        disabled={isCurrent || loading}
        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill border px-4 py-2 text-[12px] font-bold transition-all active:scale-[0.98] ${
          isCurrent
            ? `${visual.chip} cursor-default`
            : "border-white/15 bg-gray-900/60 text-foreground hover:border-white/30"
        } disabled:opacity-60`}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {STATE_BUTTON_LABEL[state]}
      </button>
    </div>
  );
};

export default StoryRouteCard;
