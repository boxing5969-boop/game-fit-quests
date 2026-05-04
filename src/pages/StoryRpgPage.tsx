/**
 * 153 스토리 RPG — 메인 페이지 (단계 36~41).
 *
 * 41단계 업그레이드:
 *   · 비주얼 월드맵에서 챕터 노드 탭 → 전투 모달 (StoryBattleScreen)
 *   · 액션 클릭 → 페이지 navigate → 돌아오면 자동 sync
 *   · 조건 충족 + claim 성공 → VICTORY 풀스크린 (StoryVictoryOverlay)
 *
 * 보호 원칙:
 *   · 공식 1~40 시스템과 분리. member_progress 미수정.
 *   · 공식 리그/레벨은 read-only 표시만.
 *   · LLM/ChatAssistant 호출 없음.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useClaimStoryReward,
  useStoryRpgState,
  useSyncStoryProgress,
} from "@/hooks/useStoryRpg";
import StoryRpgPageHeader from "@/components/story-rpg/StoryRpgPageHeader";
import StoryRpgProtectionNotice from "@/components/story-rpg/StoryRpgProtectionNotice";
import StoryRouteSelect from "@/components/story-rpg/StoryRouteSelect";
import StoryChapterProgress from "@/components/story-rpg/StoryChapterProgress";
import StoryCharacterPanel from "@/components/story-rpg/StoryCharacterPanel";
import StoryWorldMap from "@/components/story-rpg/StoryWorldMap";
import StoryDialogBox from "@/components/story-rpg/StoryDialogBox";
import StoryQuestActions from "@/components/story-rpg/StoryQuestActions";
import StoryRewardPanel from "@/components/story-rpg/StoryRewardPanel";
import StoryBattleScreen from "@/components/story-rpg/StoryBattleScreen";
import StoryVictoryOverlay from "@/components/story-rpg/StoryVictoryOverlay";
import {
  STORY_ALREADY_CLAIMED_BODY,
  STORY_NOT_COMPLETE_BODY,
  STORY_ROUTE_NOT_SELECTED,
  STORY_ROUTE_SELECT_HINT,
} from "@/data/storyRpgCopy";
import type {
  StoryChapter,
  StoryChapterSyncEntry,
  StoryRewardResult,
} from "@/types/storyRpg";

const StoryRpgPage = () => {
  const { data, isLoading } = useStoryRpgState();

  const activeRouteId = data?.active_route_id ?? null;
  const routes = data?.routes ?? [];
  const allChapters = data?.chapters ?? [];
  const nodes = data?.nodes ?? [];
  const dialogues = data?.dialogues ?? [];
  const rewardClaims = data?.reward_claims ?? [];
  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? null;
  const official = data?.official_summary ?? null;
  const activeProgress = data?.progress.find(
    (p) => p.route_id === activeRouteId,
  ) ?? null;

  const activeChapters = useMemo(
    () => allChapters.filter((c) => c.route_id === activeRouteId),
    [allChapters, activeRouteId],
  );

  const currentChapter = useMemo(() => {
    if (!activeProgress) return null;
    return (
      activeChapters.find(
        (c) => c.chapter_number === activeProgress.current_chapter_number,
      ) ?? null
    );
  }, [activeChapters, activeProgress]);

  const questActionsRef = useRef<HTMLDivElement | null>(null);

  // ─── 진행도 sync ───────────────────────────────────────────
  const sync = useSyncStoryProgress();
  const [syncEntries, setSyncEntries] = useState<StoryChapterSyncEntry[]>([]);
  const lastSyncedRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoute) return;
    if (lastSyncedRouteRef.current === activeRoute.code) return;
    lastSyncedRouteRef.current = activeRoute.code;
    sync.mutate(activeRoute.code, {
      onSuccess: (res) => {
        if (res?.chapters) setSyncEntries(res.chapters);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.code]);

  const runSync = () => {
    if (!activeRoute) return;
    sync.mutate(activeRoute.code, {
      onSuccess: (res) => {
        if (res?.chapters) setSyncEntries(res.chapters);
      },
    });
  };

  // 페이지 visibility/focus 시 자동 sync (다른 페이지에서 활동 후 돌아왔을 때)
  useEffect(() => {
    if (!activeRoute) return;
    const handler = () => {
      if (document.visibilityState === "visible") runSync();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.code]);

  // ─── 전투 + 승리 모달 상태 ──────────────────────────────────
  const [battleChapter, setBattleChapter] = useState<StoryChapter | null>(null);
  const [victory, setVictory] = useState<{
    chapter: StoryChapter;
    result: StoryRewardResult;
  } | null>(null);

  const battleSyncDetail = useMemo(() => {
    if (!battleChapter) return null;
    return (
      syncEntries.find((e) => e.chapter_id === battleChapter.id)?.detail ?? null
    );
  }, [battleChapter, syncEntries]);

  const claim = useClaimStoryReward();

  const handleClaimFromBattle = () => {
    if (!battleChapter) return;
    claim.mutate(battleChapter.id, {
      onSuccess: (res) => {
        if (!res.success) {
          toast.error(res.reason ?? STORY_NOT_COMPLETE_BODY);
          return;
        }
        if (res.already_claimed) {
          toast.message(STORY_ALREADY_CLAIMED_BODY);
          setBattleChapter(null);
          return;
        }
        setVictory({ chapter: battleChapter, result: res });
        setBattleChapter(null);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "보상 수령에 실패했습니다.",
        );
      },
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-32">
      <StoryRpgPageHeader />

      <div className="mx-auto w-full max-w-screen-sm space-y-4 px-4 pt-2">
        <StoryCharacterPanel
          official={official}
          activeRoute={activeRoute}
          activeProgress={activeProgress}
        />

        <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            현재 복서의 길
          </p>
          {isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : activeRoute ? (
            <>
              <p className="mt-2 text-lg font-black text-foreground">
                {activeRoute.title}
              </p>
              {activeRoute.subtitle && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {activeRoute.subtitle}
                </p>
              )}
              {activeProgress && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  챕터 {activeProgress.current_chapter_number}/6 ·
                  완료 {activeProgress.completed_chapter_count}개
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-black text-foreground">
                {STORY_ROUTE_NOT_SELECTED}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {STORY_ROUTE_SELECT_HINT}
              </p>
            </>
          )}
        </section>

        {activeRouteId && currentChapter && (
          <StoryDialogBox
            chapter={currentChapter}
            dialogues={dialogues}
            onChallenge={() => setBattleChapter(currentChapter)}
            onOpenQuests={() =>
              questActionsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          />
        )}

        {activeRouteId && activeChapters.length > 0 && (
          <StoryWorldMap
            nodes={nodes}
            chapters={activeChapters}
            progress={activeProgress}
            onChapterTap={(c) => setBattleChapter(c)}
          />
        )}

        {routes.length > 0 && (
          <StoryRouteSelect routes={routes} activeRouteId={activeRouteId} />
        )}

        {activeRouteId && activeChapters.length > 0 && (
          <StoryRewardPanel
            chapters={activeChapters}
            syncEntries={syncEntries}
            rewardClaims={rewardClaims}
          />
        )}

        {activeRouteId && activeChapters.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={runSync}
                disabled={sync.isPending}
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-gray-900/60 px-3 py-1.5 text-[11px] font-bold text-foreground transition-all active:scale-[0.98] hover:border-white/30 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3 w-3 ${sync.isPending ? "animate-spin" : ""}`}
                />
                {sync.isPending ? "새로고침 중…" : "진행도 새로고침"}
              </button>
            </div>
            <StoryChapterProgress
              chapters={activeChapters}
              nodes={nodes}
              progress={activeProgress}
              rewardClaims={rewardClaims}
              syncEntries={syncEntries}
            />
          </div>
        )}

        <div ref={questActionsRef}>
          <StoryQuestActions />
        </div>

        <StoryRpgProtectionNotice />
      </div>

      {/* 전투 모달 */}
      {battleChapter && (
        <StoryBattleScreen
          chapter={battleChapter}
          progressDetail={battleSyncDetail}
          onClose={() => setBattleChapter(null)}
          onClaimReward={handleClaimFromBattle}
        />
      )}

      {/* 승리 풀스크린 */}
      {victory && (
        <StoryVictoryOverlay
          chapter={victory.chapter}
          rewardResult={victory.result}
          onClose={() => setVictory(null)}
        />
      )}
    </div>
  );
};

export default StoryRpgPage;
