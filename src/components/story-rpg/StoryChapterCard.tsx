/**
 * 153 스토리 RPG — 단일 챕터 카드 (단계 37).
 *
 * 챕터 상태: locked / available / in_progress / completed / reward_claimed
 *
 * 보상 claim 버튼은 39단계에서 sync 결과(`StoryChapterProgressDetail`) 기반으로 활성화된다.
 * 이번 단계에서는 카드 표시 + 진행 조건 텍스트 + 보상 받기 stub 까지 구현.
 */

import { Lock, Sparkles } from "lucide-react";
import {
  STORY_CHAPTER_STATE_VISUAL,
  type StoryChapterStateKey,
} from "@/data/storyRpgVisuals";
import { STORY_OBSTACLE_LABEL, STORY_CONDITION_LABEL } from "@/data/storyRpgCopy";
import type { StoryChapter, StoryNode } from "@/types/storyRpg";

export interface StoryChapterCardProps {
  chapter: StoryChapter;
  node?: StoryNode;
  state: StoryChapterStateKey;
  conditionDetail?: Record<string, { have: number; need: number }>;
  claiming?: boolean;
  onClaim?: (chapter: StoryChapter) => void;
}

const StoryChapterCard = ({
  chapter,
  node,
  state,
  conditionDetail,
  claiming,
  onClaim,
}: StoryChapterCardProps) => {
  const visual = STORY_CHAPTER_STATE_VISUAL[state];
  const isLocked = state === "locked";
  const isClaimed = state === "reward_claimed";
  const canClaim = state === "completed";

  // chapter 의 completion_condition 에서 조건 키만 뽑아 라벨로 표시
  const conditions = Object.entries(chapter.completion_condition ?? {}).filter(
    ([key]) => key !== "active_route_required",
  );

  return (
    <article
      className={`relative rounded-2xl border bg-gray-900/40 p-4 ${
        isLocked ? "border-white/5 opacity-70" : "border-white/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gray-900/70 text-sm font-black text-amber-300">
          {chapter.chapter_number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-foreground">{chapter.title}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-bold ${visual.chip}`}
            >
              {isLocked && <Lock className="h-3 w-3" />}
              {visual.label}
            </span>
          </div>
          {node && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              📍 {node.title}
              {chapter.obstacle_code && ` · 🥊 ${STORY_OBSTACLE_LABEL[chapter.obstacle_code] ?? chapter.obstacle_code}`}
            </p>
          )}
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {chapter.description}
          </p>
        </div>
      </div>

      {/* 진행 조건 — sync 결과가 있으면 진행률 같이 표시 */}
      {conditions.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {conditions.map(([key, value]) => {
            const need =
              typeof value === "number" ? value : Number(value ?? 0);
            const have = conditionDetail?.[key]?.have ?? 0;
            const labelText = STORY_CONDITION_LABEL[key] ?? key;
            const reached = have >= need;
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  reached
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                    : "border-white/10 bg-gray-900/60 text-muted-foreground"
                }`}
              >
                <span>{labelText}</span>
                <span className="tabular-nums font-bold">
                  {have}/{need}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 보상 영역 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-gray-900/50 px-3 py-2 text-[11px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
        <span>QUEST XP +{chapter.reward_quest_xp}</span>
        <span>·</span>
        <span>파이트 머니 +{chapter.reward_gems}</span>
        {chapter.reward_title && (
          <>
            <span>·</span>
            <span className="text-amber-200">{chapter.reward_title}</span>
          </>
        )}
      </div>

      {/* 액션 */}
      {(canClaim || isClaimed) && onClaim && (
        <button
          type="button"
          onClick={() => onClaim(chapter)}
          disabled={isClaimed || claiming}
          className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill border px-4 py-2 text-[12px] font-bold transition-all active:scale-[0.98] ${
            isClaimed
              ? "border-violet-500/30 bg-violet-500/10 text-violet-200 cursor-default"
              : "border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-100 hover:border-amber-500/60"
          } disabled:opacity-60`}
        >
          {isClaimed
            ? "보상 수령 완료"
            : claiming
              ? "보상 받는 중…"
              : "보상 받기"}
        </button>
      )}
    </article>
  );
};

export default StoryChapterCard;
