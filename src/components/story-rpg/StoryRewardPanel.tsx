/**
 * 153 스토리 RPG — 보상 패널 (단계 39).
 *
 * sync 결과로 'completed' 상태가 된 챕터 중, 아직 reward 를 수령하지 않은 항목을 한 곳에 묶어
 * 빠른 claim 을 유도한다.
 *
 * 보호 원칙:
 *   · claim 은 useClaimStoryReward(RPC 경유) — wallet 직접 update 없음.
 *   · 공식 XP 지급 없음.
 */

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useClaimStoryReward } from "@/hooks/useStoryRpg";
import {
  STORY_ALREADY_CLAIMED_BODY,
  STORY_NOT_COMPLETE_BODY,
  STORY_REWARD_TOAST_BODY,
  STORY_REWARD_TOAST_TITLE,
} from "@/data/storyRpgCopy";
import type {
  StoryChapter,
  StoryChapterSyncEntry,
  StoryRewardClaim,
} from "@/types/storyRpg";

export interface StoryRewardPanelProps {
  chapters: StoryChapter[];
  syncEntries: StoryChapterSyncEntry[];
  rewardClaims: StoryRewardClaim[];
}

const StoryRewardPanel = ({
  chapters,
  syncEntries,
  rewardClaims,
}: StoryRewardPanelProps) => {
  const claim = useClaimStoryReward();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const claimedSet = useMemo(
    () => new Set(rewardClaims.map((c) => c.chapter_id)),
    [rewardClaims],
  );

  const claimable = useMemo(() => {
    const completedIds = new Set(
      syncEntries.filter((e) => e.complete).map((e) => e.chapter_id),
    );
    return chapters
      .filter((c) => completedIds.has(c.id) && !claimedSet.has(c.id))
      .sort((a, b) => a.chapter_number - b.chapter_number);
  }, [chapters, syncEntries, claimedSet]);

  if (claimable.length === 0) return null;

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
        toast.error(err instanceof Error ? err.message : "보상 수령에 실패했습니다.");
      },
    });
  };

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-transparent p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-300" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          수령 대기 중
        </p>
      </div>
      <h2 className="mt-1 text-base font-black text-foreground">
        받을 보상이 {claimable.length}개 있습니다
      </h2>

      <div className="mt-3 space-y-2">
        {claimable.map((chapter) => (
          <div
            key={chapter.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-gray-900/50 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-[12px] font-bold text-foreground">
                {chapter.chapter_number}장 · {chapter.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                +{chapter.reward_quest_xp} XP · +{chapter.reward_gems} 파이트 머니
                {chapter.reward_title ? ` · ${chapter.reward_title}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleClaim(chapter)}
              disabled={claimingId === chapter.id}
              className="shrink-0 rounded-pill border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-100 active:scale-[0.98] hover:border-amber-500/60 disabled:opacity-60"
            >
              {claimingId === chapter.id ? "받는 중…" : "받기"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StoryRewardPanel;
