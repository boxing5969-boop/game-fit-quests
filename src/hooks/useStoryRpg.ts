/**
 * 153 스토리 RPG hooks (단계 35 + 46).
 *
 * 보호 원칙:
 *   · 본 hook 의 어떤 경로도 member_progress 를 수정하지 않는다.
 *   · wallet 직접 update 없음. 보상은 RPC 내부 grant_gems 경유.
 *   · query key prefix 는 ["story-rpg", ...] 로 격리.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyChoice,
  changeStoryRoute,
  chooseStoryRoute,
  claimCardReward,
  completeEnding,
  fetchMyInventory,
  fetchMyPlayerStats,
  fetchStoryCards,
  fetchStoryEnemies,
  getMyStoryRpgState,
  progressToScene,
  resetStoryRoute,
  startBattle,
  startStorySession,
  submitPlayerCommand,
} from "@/services/storyRpgService";
import {
  EMPTY_STORY_RPG_STATE,
  type BattleCommand,
  type StoryCard,
  type StoryEnemy,
  type StoryInventoryItem,
  type StoryPlayerStats,
  type StoryRpgState,
  type StorySessionStartResult,
} from "@/types/storyRpg";

// ── Query keys ────────────────────────────────────────────────────
export const STORY_RPG_KEY = ["story-rpg"] as const;
export const STORY_SESSION_KEY = ["story-rpg", "session"] as const;
export const STORY_SCENE_KEY = ["story-rpg", "scene"] as const;
export const STORY_BATTLE_KEY = ["story-rpg", "battle"] as const;
export const STORY_INVENTORY_KEY = ["story-rpg", "inventory"] as const;
export const STORY_ENEMIES_KEY = ["story-rpg", "enemies"] as const;
export const STORY_CARDS_KEY = ["story-rpg", "cards"] as const;
export const STORY_PLAYER_STATS_KEY = ["story-rpg", "stats"] as const;

// ── 기존 보존 ──────────────────────────────────────────────────────

export function useStoryRpgState() {
  const { user } = useAuth();
  return useQuery<StoryRpgState>({
    queryKey: [...STORY_RPG_KEY, "state", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await getMyStoryRpgState();
      } catch {
        return EMPTY_STORY_RPG_STATE;
      }
    },
  });
}

export function useChooseStoryRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeCode: string) => chooseStoryRoute(routeCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
    },
  });
}

export function useChangeStoryRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeCode: string) => changeStoryRoute(routeCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
    },
  });
}

// ── Stage 46 — 신규 hook ──────────────────────────────────────────

export function useStorySession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useQuery<StorySessionStartResult>({
    queryKey: [...STORY_SESSION_KEY, user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 10_000,
    queryFn: async () => {
      const result = await startStorySession();
      // 같은 데이터를 STORY_PLAYER_STATS_KEY 캐시에도 반영
      qc.setQueryData(
        [...STORY_PLAYER_STATS_KEY, user?.id ?? "anon"],
        result.stats,
      );
      return result;
    },
  });
}

export function useProgressToScene() {
  return useMutation({
    mutationFn: ({
      routeId,
      chapterId,
      sceneIndex,
    }: {
      routeId: string | null;
      chapterId: string | null;
      sceneIndex: number;
    }) => progressToScene(routeId, chapterId, sceneIndex),
  });
}

export function useApplyChoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sceneId,
      choiceIndex,
    }: {
      sceneId: string;
      choiceIndex: number;
    }) => applyChoice(sceneId, choiceIndex),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_PLAYER_STATS_KEY] });
      qc.invalidateQueries({ queryKey: [...STORY_INVENTORY_KEY] });
      qc.invalidateQueries({ queryKey: [...STORY_SESSION_KEY] });
    },
  });
}

export function useStartBattle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      enemyCode,
      chapterId,
    }: {
      enemyCode: string;
      chapterId: string | null;
    }) => startBattle(enemyCode, chapterId),
    onSuccess: (data) => {
      qc.setQueryData([...STORY_BATTLE_KEY, "current"], data);
      qc.invalidateQueries({ queryKey: [...STORY_PLAYER_STATS_KEY] });
    },
  });
}

export function useSubmitBattleCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      command,
      targetData,
    }: {
      command: BattleCommand;
      targetData?: Record<string, unknown>;
    }) => submitPlayerCommand(command, targetData ?? {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...STORY_BATTLE_KEY] });
      qc.invalidateQueries({ queryKey: [...STORY_PLAYER_STATS_KEY] });
      qc.invalidateQueries({ queryKey: [...STORY_SESSION_KEY] });
      if (data.status === "victory") {
        qc.invalidateQueries({ queryKey: [...STORY_INVENTORY_KEY] });
      }
    },
  });
}

export function useClaimCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardCode,
      source,
    }: {
      cardCode: string;
      source: "chapter_clear" | "choice" | "hidden_scene" | "enemy_drop";
    }) => claimCardReward(cardCode, source),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_INVENTORY_KEY] });
    },
  });
}

export function useCompleteEnding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeId,
      endingCode,
    }: {
      routeId: string;
      endingCode: string;
    }) => completeEnding(routeId, endingCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
      // real_gems 가 grant_gems 로 wallet 에 반영됨 — 클라이언트는 invalidate 만
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useResetRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => resetStoryRoute(routeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
    },
  });
}

// ── 마스터 / 인벤토리 / 능력치 query ───────────────────────────────

export function useStoryEnemies() {
  return useQuery<StoryEnemy[]>({
    queryKey: [...STORY_ENEMIES_KEY],
    staleTime: 5 * 60_000,
    queryFn: () => fetchStoryEnemies(),
  });
}

export function useStoryCards() {
  return useQuery<StoryCard[]>({
    queryKey: [...STORY_CARDS_KEY],
    staleTime: 5 * 60_000,
    queryFn: () => fetchStoryCards(),
  });
}

export function useMyInventory() {
  const { user } = useAuth();
  return useQuery<StoryInventoryItem[]>({
    queryKey: [...STORY_INVENTORY_KEY, user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => fetchMyInventory(),
  });
}

export function useMyPlayerStats() {
  const { user } = useAuth();
  return useQuery<StoryPlayerStats | null>({
    queryKey: [...STORY_PLAYER_STATS_KEY, user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 10_000,
    queryFn: () => fetchMyPlayerStats(),
  });
}

// ── Deprecated stubs (StoryRpgPage 리팩터 후 제거 예정) ─────────────

/** @deprecated Stage 45 RPC drop. */
export function useSyncStoryProgress() {
  return useMutation({
    mutationFn: async (_routeCode: string) => {
      throw new Error("deprecated");
    },
  });
}

/** @deprecated Stage 45 RPC drop. */
export function useClaimStoryReward() {
  return useMutation({
    mutationFn: async (_chapterId: string) => {
      throw new Error("deprecated");
    },
  });
}
