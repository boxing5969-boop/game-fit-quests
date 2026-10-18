/**
 * 153 QUEST v2 21단계 — 짐 레이드 hook + contribute 디바운스 트리거.
 *
 * 보호 원칙 (§3 + §11):
 *   · 공식 missions / member_progress 미수정
 *   · 기존 /challenges 21일 챌린지 무수정 — 자체 도메인
 *   · contribute 호출 빈도 디바운스 (§11-⑥) — 800ms
 *   · contribute 실패는 silent (사용자 흐름 막지 않음)
 *   · 보상은 RPC 반환값만 사용
 */

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimGymRaidReward,
  contributeToGymRaid,
  getActiveGymRaids,
  type ActiveGymRaidsResult,
  type ClaimGymRaidRewardResult,
  type GymRaidContributeSourceType,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";
import {
  createGymRaid,
  endGymRaid,
  getBranchGymRaids,
  type BranchRaidsResult,
  type CreateGoalInput,
} from "@/services/branchGoalService";

export const GYM_RAID_KEY = ["gym-raid"] as const;

/**
 * 우리 지점 목표 시트 (2026-10-18) — 목표 + 내가 열고 끝낼 수 있는지 + (전체관리자·관리자) 지점 고르기.
 * branch 를 비우면 서버가 정한 기본 지점 (회원·코치는 늘 자기 지점).
 */
export function useBranchGymRaids(branch: string | null, enabled = true) {
  const { user } = useAuth();

  return useQuery<BranchRaidsResult>({
    queryKey: [...GYM_RAID_KEY, "branch", user?.id ?? "anon", branch ?? "__mine__"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getBranchGymRaids(branch),
  });
}

/** 목표 열기 — 전체관리자·관리자 · 권한 받은 지점장·코치 (서버가 다시 확인) */
export function useCreateGymRaid() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; raid_id: string; branch: string }, Error, CreateGoalInput>({
    mutationFn: createGymRaid,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GYM_RAID_KEY });
    },
  });
}

/** 진행 중인 목표 끝내기 */
export function useEndGymRaid() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: endGymRaid,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GYM_RAID_KEY });
    },
  });
}

export function useActiveGymRaids(enabled = true) {
  const { user } = useAuth();

  return useQuery<ActiveGymRaidsResult>({
    queryKey: [...GYM_RAID_KEY, "active", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getActiveGymRaids();
      } catch {
        return { success: true, raids: [] } as ActiveGymRaidsResult;
      }
    },
  });
}

export function useClaimGymRaidReward() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<ClaimGymRaidRewardResult, Error, string>({
    mutationFn: claimGymRaidReward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GYM_RAID_KEY });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      triggerCheck();
    },
  });
}

/**
 * 짐 레이드 contribute 디바운스 트리거.
 * 4 hook (Academy/FunChallenge/Journal/Cheer) 의 onSuccess 에서 호출.
 *
 * 사용:
 *   const { triggerContribute } = useGymRaidContributeTrigger();
 *   triggerContribute("boxing_quiz_attempt", attemptId);
 *
 * §11-⑥ 호출 빈도 가드: 800ms 디바운스 + RPC 자체의 UNIQUE 충돌 무시.
 * §21단계: contribute 실패는 silent — 사용자 흐름 안 막음.
 */
export function useGymRaidContributeTrigger() {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerContribute = useCallback(
    (
      sourceType: GymRaidContributeSourceType,
      sourceId?: string | null,
    ) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // sourceId 없으면 RPC 가 최근 5분 내 자동 매칭
        contributeToGymRaid(sourceType, sourceId ?? null)
          .then((result) => {
            if (result.contributed) {
              qc.invalidateQueries({ queryKey: GYM_RAID_KEY });
            }
          })
          .catch(() => {
            // silent — 사용자 흐름 영향 없음
          });
      }, 800);
    },
    [qc],
  );

  return { triggerContribute };
}
