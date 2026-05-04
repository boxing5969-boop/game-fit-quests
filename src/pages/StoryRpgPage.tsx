/**
 * 153 스토리 RPG — 메인 페이지 (단계 36~38).
 *
 * 보호 원칙:
 *   · 공식 1~40 시스템과 분리. member_progress 미수정.
 *   · 공식 리그/레벨은 read-only 표시만.
 *   · LLM/ChatAssistant 호출 없음.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStoryRpgState, useSyncStoryProgress } from "@/hooks/useStoryRpg";
import StoryRpgPageHeader from "@/components/story-rpg/StoryRpgPageHeader";
import StoryRpgProtectionNotice from "@/components/story-rpg/StoryRpgProtectionNotice";
import StoryRouteSelect from "@/components/story-rpg/StoryRouteSelect";
import StoryChapterProgress from "@/components/story-rpg/StoryChapterProgress";
import StoryCharacterPanel from "@/components/story-rpg/StoryCharacterPanel";
import StoryWorldMap from "@/components/story-rpg/StoryWorldMap";
import StoryDialogBox from "@/components/story-rpg/StoryDialogBox";
import StoryQuestActions from "@/components/story-rpg/StoryQuestActions";
import StoryRewardPanel from "@/components/story-rpg/StoryRewardPanel";
import {
  STORY_ROUTE_NOT_SELECTED,
  STORY_ROUTE_SELECT_HINT,
} from "@/data/storyRpgCopy";
import type { StoryChapterSyncEntry } from "@/types/storyRpg";

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

  // 39단계: active 루트가 있으면 페이지 진입 시 진행도 자동 sync.
  // sync 결과는 chapter 별 진행률 표시 + 보상 패널에 사용된다.
  const sync = useSyncStoryProgress();
  const [syncEntries, setSyncEntries] = useState<StoryChapterSyncEntry[]>([]);
  const lastSyncedRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoute) return;
    // 같은 route 에 대해 1회만 자동 sync (수동 새로고침은 별도)
    if (lastSyncedRouteRef.current === activeRoute.code) return;
    lastSyncedRouteRef.current = activeRoute.code;
    sync.mutate(activeRoute.code, {
      onSuccess: (res) => {
        if (res?.chapters) setSyncEntries(res.chapters);
      },
    });
    // sync mutate 는 stable — deps 에 sync 자체를 넣으면 무한 루프
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.code]);

  const handleManualSync = () => {
    if (!activeRoute) return;
    sync.mutate(activeRoute.code, {
      onSuccess: (res) => {
        if (res?.chapters) setSyncEntries(res.chapters);
      },
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-32">
      <StoryRpgPageHeader />

      <div className="mx-auto w-full max-w-screen-sm space-y-4 px-4 pt-2">
        {/* 내 복서 캐릭터 패널 (공식 리그/레벨 read-only) */}
        <StoryCharacterPanel
          official={official}
          activeRoute={activeRoute}
          activeProgress={activeProgress}
        />

        {/* 현재 복서의 길 요약 */}
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

        {/* 오삼이 대화창 — active 루트가 있을 때만 */}
        {activeRouteId && currentChapter && (
          <StoryDialogBox
            chapter={currentChapter}
            dialogues={dialogues}
            onOpenQuests={() =>
              questActionsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          />
        )}

        {/* 월드맵 — active 루트의 노드 강조 */}
        {activeRouteId && activeChapters.length > 0 && (
          <StoryWorldMap
            nodes={nodes}
            chapters={activeChapters}
            progress={activeProgress}
          />
        )}

        {/* 3가지 복서의 길 */}
        {routes.length > 0 && (
          <StoryRouteSelect routes={routes} activeRouteId={activeRouteId} />
        )}

        {/* 수령 대기 보상 (sync 결과로 complete 되었지만 미수령) */}
        {activeRouteId && activeChapters.length > 0 && (
          <StoryRewardPanel
            chapters={activeChapters}
            syncEntries={syncEntries}
            rewardClaims={rewardClaims}
          />
        )}

        {/* 챕터 진행도 + 진행도 새로고침 */}
        {activeRouteId && activeChapters.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleManualSync}
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

        {/* 오늘의 퀘스트 진입 */}
        <div ref={questActionsRef}>
          <StoryQuestActions />
        </div>

        <StoryRpgProtectionNotice />
      </div>
    </div>
  );
};

export default StoryRpgPage;
