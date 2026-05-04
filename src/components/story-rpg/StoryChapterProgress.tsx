/**
 * 153 스토리 RPG — 챕터 진행도 컨테이너 (단계 37).
 *
 * active 루트의 6챕터를 렌더링한다. 보상 claim 은 39단계에서 sync detail 까지 연동된다.
 *
 * 챕터 상태 결정 규칙 (이번 단계):
 *   · 보상 claim 기록 있음 → reward_claimed
 *   · current_chapter_number 와 같음 → in_progress
 *   · current_chapter_number 보다 작음 → completed
 *   · current_chapter_number 보다 큼 → locked
 *   · 39단계에서 sync detail 의 chapter.complete=true 인 경우 completed 로 끌어올림.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import StoryChapterCard from "./StoryChapterCard";
import { useClaimStoryReward } from "@/hooks/useStoryRpg";
import {
  STORY_ALREADY_CLAIMED_BODY,
  STORY_NOT_COMPLETE_BODY,
  STORY_REWARD_TOAST_BODY,
  STORY_REWARD_TOAST_TITLE,
} from "@/data/storyRpgCopy";
import type { StoryChapterStateKey } from "@/data/storyRpgVisuals";
import type {
  StoryChapter,
  StoryChapterSyncEntry,
  StoryNode,
  StoryProgress,
  StoryRewardClaim,
} from "@/types/storyRpg";

export interface StoryChapterProgressProps {
  chapters: StoryChapter[];
  nodes: StoryNode[];
  progress: StoryProgress | null;
  rewardClaims: StoryRewardClaim[];
  /** 39단계에서 sync 결과 주입 — 미주입 시 카드의 진행률은 0/N 으로 보인다. */
  syncEntries?: StoryChapterSyncEntry[];
}

const StoryChapterProgress = ({
  chapters,
  nodes,
  progress,
  rewardClaims,
  syncEntries,
}: StoryChapterProgressProps) => {
  const claim = useClaimStoryReward();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const claimedSet = useMemo(
    () => new Set(rewardClaims.map((c) => c.chapter_id)),
    [rewardClaims],
  );

  const syncMap = useMemo(() => {
    const m = new Map<string, StoryChapterSyncEntry>();
    syncEntries?.forEach((e) => m.set(e.chapter_id, e));
    return m;
  }, [syncEntries]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, StoryNode>();
    nodes.forEach((n) => m.set(n.code, n));
    return m;
  }, [nodes]);

  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters],
  );

  const currentNum = progress?.current_chapter_number ?? 1;

  const decideState = (chapter: StoryChapter): StoryChapterStateKey => {
    if (claimedSet.has(chapter.id)) return "reward_claimed";

    const sync = syncMap.get(chapter.id);
    if (sync?.complete) return "completed";

    if (chapter.chapter_number < currentNum) return "completed";
    if (chapter.chapter_number === currentNum) return "in_progress";
    if (chapter.chapter_number > currentNum) return "locked";
    return "locked";
  };

  const handleClaim = (chapter: StoryChapter) => {
    setClaimingId(chapter.id);
    claim.mutate(chapter.id, {
      onSuccess: (res) => {
        setClaimingId(null);
        if (!res.success) {
          toast.error(res.reason ?? STORY_NOT_COMPLETE_BODY);
          return;
        }
        if (res.already_claimed) {
          toast.message(STORY_ALREADY_CLAIMED_BODY);
          return;
        }
        toast.success(STORY_REWARD_TOAST_TITLE, {
          description: `${STORY_REWARD_TOAST_BODY} (+${res.quest_xp_granted} XP · +${res.gems_granted} 파이트 머니)`,
        });
      },
      onError: (err) => {
        setClaimingId(null);
        toast.error(
          err instanceof Error ? err.message : "보상 수령에 실패했습니다.",
        );
      },
    });
  };

  if (sorted.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          챕터 진행도
        </p>
        <h2 className="mt-0.5 text-base font-black text-foreground">
          이 길의 6장
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          기존 복싱 IQ / 챌린지 / 일기 / 응원이 챕터의 조건이 됩니다.
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((chapter) => {
          const state = decideState(chapter);
          const sync = syncMap.get(chapter.id);
          return (
            <StoryChapterCard
              key={chapter.id}
              chapter={chapter}
              node={nodeMap.get(chapter.world_node_code)}
              state={state}
              conditionDetail={sync?.detail.progress}
              claiming={claimingId === chapter.id}
              onClaim={
                state === "completed" || state === "reward_claimed"
                  ? handleClaim
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
};

export default StoryChapterProgress;
