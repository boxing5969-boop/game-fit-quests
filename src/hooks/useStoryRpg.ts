/**
 * 153 스토리 RPG hooks (단계 35).
 *
 * 보호 원칙:
 *   · 본 hook 의 어떤 경로도 member_progress 를 수정하지 않는다.
 *   · wallet 직접 update 없음. 보상은 RPC 내부 grant_gems 경유.
 *   · query key prefix 는 ["story-rpg", ...] 로 격리 (challenges/wallet/diet 와 충돌 없음).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  changeStoryRoute,
  chooseStoryRoute,
  claimStoryChapterReward,
  getMyStoryRpgState,
  syncStoryChapterProgress,
} from "@/services/storyRpgService";
import { EMPTY_STORY_RPG_STATE, type StoryRpgState } from "@/types/storyRpg";

export const STORY_RPG_KEY = ["story-rpg"] as const;

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

export function useSyncStoryProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeCode: string) => syncStoryChapterProgress(routeCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
    },
  });
}

export function useClaimStoryReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) => claimStoryChapterReward(chapterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...STORY_RPG_KEY] });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
