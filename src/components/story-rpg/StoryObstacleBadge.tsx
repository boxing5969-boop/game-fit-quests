/**
 * 153 스토리 RPG — 장애물(나쁜 습관) 배지 (단계 38).
 *
 * 적은 사람이 아니라 습관/상태로 표현. 폭력적 사람 공격 구조 회피.
 */

import { STORY_OBSTACLE_DESC, STORY_OBSTACLE_LABEL } from "@/data/storyRpgCopy";
import { STORY_OBSTACLE_EMOJI } from "@/data/storyRpgVisuals";

export interface StoryObstacleBadgeProps {
  code: string;
  showDescription?: boolean;
  size?: "sm" | "md";
}

const StoryObstacleBadge = ({
  code,
  showDescription,
  size = "sm",
}: StoryObstacleBadgeProps) => {
  const label = STORY_OBSTACLE_LABEL[code] ?? code;
  const desc = STORY_OBSTACLE_DESC[code];
  const emoji = STORY_OBSTACLE_EMOJI[code] ?? "🥊";

  if (size === "md") {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <p className="text-sm font-bold text-rose-200">{label}</p>
        </div>
        {showDescription && desc && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {desc}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-200">
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
};

export default StoryObstacleBadge;
