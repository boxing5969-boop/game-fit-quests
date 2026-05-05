/**
 * 153 스토리 RPG — 메인 페이지 (단계 46 전면 리팩터).
 *
 * 모드 머신:
 *   loading → prologue → no_route → world → scene → battle → ending → ending_claimed → world
 *
 * 보호 원칙:
 *   · 공식 시스템과 분리. member_progress / wallet 직접 update 0건.
 *   · LLM/ChatAssistant 호출 없음.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useApplyChoice,
  useMyPlayerStats,
  useProgressToScene,
  useStoryRpgState,
  useStorySession,
} from "@/hooks/useStoryRpg";
import StoryRpgPageHeader from "@/components/story-rpg/StoryRpgPageHeader";
import StoryRpgProtectionNotice from "@/components/story-rpg/StoryRpgProtectionNotice";
import StoryRouteSelect from "@/components/story-rpg/StoryRouteSelect";
import StoryCharacterPanel from "@/components/story-rpg/StoryCharacterPanel";
import StoryPlayerStatsHud from "@/components/story-rpg/StoryPlayerStatsHud";
import StorySceneShell from "@/components/story-rpg/StorySceneShell";
import StoryScenePlayer from "@/components/story-rpg/StoryScenePlayer";
import StoryBattleEngine from "@/components/story-rpg/StoryBattleEngine";
import StoryEndingCutscene from "@/components/story-rpg/StoryEndingCutscene";
import StoryWorldOverview from "@/components/story-rpg/StoryWorldOverview";
import StoryInventoryPanel from "@/components/story-rpg/StoryInventoryPanel";
import type {
  EndingCompleteResult,
  SceneProgressResult,
  StoryChapter,
  StoryScene,
  StorySceneEndingPayload,
} from "@/types/storyRpg";

type StoryRpgMode =
  | { kind: "loading" }
  | { kind: "no_route" }
  | { kind: "prologue"; sceneIndex: number }
  | { kind: "world" }
  | {
      kind: "scene";
      routeId: string;
      chapterId: string | null;
      sceneIndex: number;
    }
  | {
      kind: "battle";
      enemyCode: string;
      chapterId: string | null;
      victoryNext: number | null;
      defeatNext: number | null;
      routeId: string;
    }
  | { kind: "ending"; routeId: string; payload: StorySceneEndingPayload }
  | { kind: "ending_claimed"; result: EndingCompleteResult; title: string };

const StoryRpgPage = () => {
  const { data: rpgState, isLoading: rpgLoading } = useStoryRpgState();
  const { data: session, isLoading: sessionLoading } = useStorySession();
  const { data: playerStats } = useMyPlayerStats();
  const progressMut = useProgressToScene();
  const applyChoiceMut = useApplyChoice();

  const [mode, setMode] = useState<StoryRpgMode>({ kind: "loading" });
  const [scene, setScene] = useState<StoryScene | null>(null);
  const [showInventory, setShowInventory] = useState(false);

  const routes = rpgState?.routes ?? [];
  const allChapters = rpgState?.chapters ?? [];
  const nodes = rpgState?.nodes ?? [];
  const activeRouteCode = playerStats?.active_route_code ?? session?.active_route_code ?? null;
  const activeRoute = useMemo(
    () => routes.find((r) => r.code === activeRouteCode) ?? null,
    [routes, activeRouteCode],
  );
  const activeRouteId = activeRoute?.id ?? rpgState?.active_route_id ?? null;
  const activeChapters = useMemo(
    () => allChapters.filter((c) => c.route_id === activeRouteId),
    [allChapters, activeRouteId],
  );

  // scene_progress 파생 (rpgState.progress 첫 행이 active route 인지 매칭)
  const sceneProgressRaw = useMemo(
    () => (rpgState?.progress ?? []).find((p) => p.route_id === activeRouteId),
    [rpgState?.progress, activeRouteId],
  );
  const sceneProgress = sceneProgressRaw
    ? {
        route_id: sceneProgressRaw.route_id,
        chapter_id: sceneProgressRaw.current_chapter_id,
        current_scene_index: 0,
        completed_chapter_codes: [] as string[],
        ending_reached: sceneProgressRaw.route_completed,
        ending_code: null,
        play_count: 0,
        first_clear_at: null,
        last_played_at: sceneProgressRaw.last_synced_at,
      }
    : null;

  // ── 초기 모드 결정 ──────────────────────────────────────────
  useEffect(() => {
    if (sessionLoading || rpgLoading) {
      setMode({ kind: "loading" });
      return;
    }
    if (!session) {
      setMode({ kind: "loading" });
      return;
    }
    if (!session.prologue_completed) {
      setMode((cur) =>
        cur.kind === "prologue" ? cur : { kind: "prologue", sceneIndex: 0 },
      );
      return;
    }
    if (!activeRouteCode) {
      setMode((cur) => (cur.kind === "no_route" ? cur : { kind: "no_route" }));
      return;
    }
    setMode((cur) =>
      cur.kind === "world" ||
      cur.kind === "scene" ||
      cur.kind === "battle" ||
      cur.kind === "ending" ||
      cur.kind === "ending_claimed"
        ? cur
        : { kind: "world" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, rpgLoading, session?.prologue_completed, activeRouteCode]);

  // ── scene fetch ─────────────────────────────────────────────
  const fetchScene = (
    routeId: string | null,
    chapterId: string | null,
    sceneIndex: number,
  ) => {
    progressMut.mutate(
      { routeId, chapterId, sceneIndex },
      {
        onSuccess: (res: SceneProgressResult) => {
          if (!res.success || !res.scene_id || !res.payload || !res.scene_type) {
            toast.error(res.reason ?? "씬을 불러오지 못했습니다.");
            return;
          }
          const next: StoryScene = {
            id: res.scene_id,
            scope: chapterId ? "chapter" : "prologue",
            route_id: routeId,
            chapter_id: chapterId,
            scene_index: res.scene_index ?? sceneIndex,
            scene_type: res.scene_type,
            payload: res.payload,
            next_scene_index: res.next_scene_index ?? null,
            next_scene_victory: res.next_scene_victory ?? null,
            next_scene_defeat: res.next_scene_defeat ?? null,
            active: true,
            metadata: {},
          };
          setScene(next);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "씬을 불러오지 못했습니다.",
          );
        },
      },
    );
  };

  // ── prologue: scene 가져오기 ─────────────────────────────────
  useEffect(() => {
    if (mode.kind !== "prologue") return;
    fetchScene(null, null, mode.sceneIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind === "prologue" ? mode.sceneIndex : -1]);

  // ── scene mode: scene 가져오기 ───────────────────────────────
  useEffect(() => {
    if (mode.kind !== "scene") return;
    fetchScene(mode.routeId, mode.chapterId, mode.sceneIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode.kind === "scene" ? mode.routeId : "",
    mode.kind === "scene" ? mode.chapterId : "",
    mode.kind === "scene" ? mode.sceneIndex : -1,
  ]);

  // ── 씬 전환 시 battle/ending 자동 분기 ───────────────────────
  useEffect(() => {
    if (!scene) return;
    if (mode.kind !== "scene" && mode.kind !== "prologue") return;
    if (scene.scene_type === "battle") {
      const battlePayload = scene.payload as { enemy_code: string };
      if (mode.kind === "scene") {
        setMode({
          kind: "battle",
          enemyCode: battlePayload.enemy_code,
          chapterId: scene.chapter_id,
          victoryNext: scene.next_scene_victory,
          defeatNext: scene.next_scene_defeat,
          routeId: mode.routeId,
        });
      }
    } else if (scene.scene_type === "ending") {
      const endingPayload = scene.payload as StorySceneEndingPayload;
      if (mode.kind === "scene") {
        setMode({ kind: "ending", routeId: mode.routeId, payload: endingPayload });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  // ── 진행 핸들러 ──────────────────────────────────────────────
  const handleAdvance = (nextIndex: number) => {
    if (nextIndex < 0) {
      // 챕터 끝 → 월드맵 복귀
      setMode({ kind: "world" });
      return;
    }
    if (mode.kind === "prologue") {
      setMode({ kind: "prologue", sceneIndex: nextIndex });
    } else if (mode.kind === "scene") {
      setMode({
        kind: "scene",
        routeId: mode.routeId,
        chapterId: mode.chapterId,
        sceneIndex: nextIndex,
      });
    }
  };

  const handleChoice = (choiceIndex: number) => {
    if (!scene || scene.scene_type !== "choice") return;
    applyChoiceMut.mutate(
      { sceneId: scene.id, choiceIndex },
      {
        onSuccess: (res) => {
          // route_choice 가 있으면 (프롤로그 마지막 씬) 월드맵으로
          if (res.route_choice) {
            setMode({ kind: "world" });
            return;
          }
          handleAdvance(res.next_scene_index);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "선택 실패");
        },
      },
    );
  };

  const handleSelectChapter = (chapter: StoryChapter) => {
    if (!activeRouteId) return;
    setMode({
      kind: "scene",
      routeId: activeRouteId,
      chapterId: chapter.id,
      sceneIndex: 0,
    });
  };

  const handleVictory = () => {
    if (mode.kind !== "battle") return;
    const next = mode.victoryNext;
    if (next == null) {
      setMode({ kind: "world" });
      return;
    }
    setMode({
      kind: "scene",
      routeId: mode.routeId,
      chapterId: mode.chapterId,
      sceneIndex: next,
    });
  };

  const handleDefeat = () => {
    if (mode.kind !== "battle") return;
    const next = mode.defeatNext;
    if (next == null) {
      setMode({ kind: "world" });
      return;
    }
    toast.message("패배. 한 번 더 도전해보세요.");
    setMode({
      kind: "scene",
      routeId: mode.routeId,
      chapterId: mode.chapterId,
      sceneIndex: next,
    });
  };

  const handleEndingClaimed = (result: EndingCompleteResult) => {
    if (mode.kind !== "ending") return;
    if (result.already_claimed) {
      toast.message("이전에 이미 받은 엔딩이에요.");
    }
    setMode({
      kind: "ending_claimed",
      result,
      title: mode.payload.title,
    });
  };

  const showBackButton =
    mode.kind === "scene" ||
    mode.kind === "ending" ||
    mode.kind === "ending_claimed";
  const isBusy = progressMut.isPending || applyChoiceMut.isPending;

  return (
    <div className="min-h-dvh bg-background pb-32">
      <StoryRpgPageHeader />

      <div className="mx-auto w-full max-w-md md:max-w-xl space-y-4 px-4 py-4">
        {/* 능력치 HUD (no_route / loading / battle 외에서 표시) */}
        {mode.kind !== "loading" && mode.kind !== "battle" && (
          <StoryPlayerStatsHud stats={playerStats ?? null} compact />
        )}

        {/* ── loading ── */}
        {mode.kind === "loading" && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
            <p className="text-[12px] text-muted-foreground">세션 준비 중…</p>
          </div>
        )}

        {/* ── no_route ── */}
        {mode.kind === "no_route" && (
          <>
            <StoryCharacterPanel
              official={rpgState?.official_summary ?? null}
              activeRoute={activeRoute}
              activeProgress={null}
            />
            {routes.length > 0 && (
              <StoryRouteSelect routes={routes} activeRouteId={activeRouteId} />
            )}
          </>
        )}

        {/* ── prologue / scene ── */}
        {(mode.kind === "prologue" || mode.kind === "scene") && (
          <>
            {scene ? (
              <StorySceneShell bgmHint={(scene.payload as { bgm_hint?: string }).bgm_hint}>
                <StoryScenePlayer
                  scene={scene}
                  onAdvance={handleAdvance}
                  onChoice={handleChoice}
                  onBattleStart={() => {
                    /* useEffect 가 처리 */
                  }}
                  onEnding={() => {
                    /* useEffect 가 처리 */
                  }}
                  busy={isBusy}
                />
              </StorySceneShell>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
              </div>
            )}
          </>
        )}

        {/* ── world ── */}
        {mode.kind === "world" && (
          <>
            <StoryWorldOverview
              nodes={nodes}
              chapters={activeChapters}
              progress={sceneProgress}
              onSelectChapter={handleSelectChapter}
            />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowInventory((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-pill border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[12px] font-bold text-amber-100"
              >
                {showInventory ? "인벤토리 닫기" : "인벤토리 보기"}
              </button>
            </div>
            {showInventory && <StoryInventoryPanel mode="browse" />}
          </>
        )}

        {/* ── battle ── */}
        {mode.kind === "battle" && (
          <StorySceneShell backgroundTheme="ring">
            <StoryBattleEngine
              enemyCode={mode.enemyCode}
              chapterId={mode.chapterId}
              onVictory={handleVictory}
              onDefeat={handleDefeat}
            />
          </StorySceneShell>
        )}

        {/* ── ending ── */}
        {mode.kind === "ending" && (
          <StorySceneShell backgroundTheme="sunrise">
            <StoryEndingCutscene
              payload={mode.payload}
              routeId={mode.routeId}
              onClaimed={handleEndingClaimed}
            />
          </StorySceneShell>
        )}

        {/* ── ending_claimed ── */}
        {mode.kind === "ending_claimed" && (
          <StorySceneShell backgroundTheme="sunrise">
            <div className="space-y-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
                보상 수령 완료
              </p>
              <h2 className="text-xl font-black text-foreground">{mode.title}</h2>
              <p className="text-[12px] text-muted-foreground">
                STORY XP +{mode.result.story_xp_granted} · 링 코인 +
                {mode.result.ring_coins_granted}
                {mode.result.real_gems_granted > 0
                  ? ` · 파이트 머니 +${mode.result.real_gems_granted}`
                  : ""}
              </p>
              <button
                type="button"
                onClick={() => setMode({ kind: "world" })}
                className="rounded-pill border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-[12px] font-bold text-amber-100"
              >
                월드맵으로
              </button>
            </div>
          </StorySceneShell>
        )}

        {/* 하단 — 월드맵 복귀 버튼 (전투 / 로딩 / 프롤로그 / 엔딩 외) */}
        {showBackButton && mode.kind !== "battle" && (
          <button
            type="button"
            onClick={() => setMode({ kind: "world" })}
            className="mx-auto flex items-center gap-1.5 rounded-pill border border-white/15 bg-gray-900/60 px-3 py-1.5 text-[11px] font-bold text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            월드맵으로
          </button>
        )}

        {mode.kind === "world" && (
          <button
            type="button"
            onClick={() => setMode({ kind: "no_route" })}
            className="mx-auto flex items-center gap-1.5 rounded-pill border border-white/10 bg-gray-900/40 px-3 py-1.5 text-[10px] text-muted-foreground"
          >
            <MapIcon className="h-3 w-3" />
            루트 변경
          </button>
        )}

        <StoryRpgProtectionNotice />
      </div>
    </div>
  );
};

export default StoryRpgPage;
