/**
 * 7일 스타터 캠프 — Day 진행 dots (단계 44).
 *
 * 현재 day 안의 step 진행 상황을 작은 dot 으로 표시.
 */

import { COLOR_AMBER } from "./tutorialCampMotion";

export interface TutorialProgressDotsProps {
  total: number;
  current: number;
  className?: string;
}

const TutorialProgressDots = ({
  total,
  current,
  className,
}: TutorialProgressDotsProps) => {
  if (total <= 0) return null;
  return (
    <div
      className={`flex items-center justify-center gap-1.5 ${className ?? ""}`}
      aria-label={`Step ${current + 1} / ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: active ? 18 : 6,
              background: done
                ? COLOR_AMBER
                : active
                  ? COLOR_AMBER
                  : "rgba(253,184,92,0.18)",
            }}
          />
        );
      })}
    </div>
  );
};

export default TutorialProgressDots;
