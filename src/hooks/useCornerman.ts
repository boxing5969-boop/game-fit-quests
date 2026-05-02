/**
 * 153 QUEST v2 19단계 — 코너맨 매칭 hook.
 *
 * 보호 원칙 (§3 + §11):
 *   · 공식 missions / member_progress 미수정
 *   · 보상은 RPC 반환값(quest_xp_granted/gems_granted/respect_granted)만 사용
 *   · grant_gems 직접 호출 0건 — claim_cornerman_daily_bonus 내부에서만
 *   · 같은 지점 + 진짜 활동 + 1일 1회 + active pair 4중 검증 (RPC 측)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimCornermanDailyBonus,
  endCornermanPair,
  getCornermanCandidates,
  getMyCornermanStatus,
  requestCornermanPair,
  respondCornermanPair,
  EMPTY_CORNERMAN_STATUS,
  type ClaimCornermanBonusResult,
  type CornermanCandidate,
  type CornermanRequestResult,
  type CornermanStatus,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";

export const CORNERMAN_KEY = ["cornerman"] as const;

export function useMyCornermanStatus() {
  const { user } = useAuth();

  return useQuery<CornermanStatus>({
    queryKey: [...CORNERMAN_KEY, "status", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await getMyCornermanStatus();
      } catch {
        return EMPTY_CORNERMAN_STATUS;
      }
    },
  });
}

export function useCornermanCandidates(limit = 30, enabled = true) {
  const { user } = useAuth();

  return useQuery<CornermanCandidate[]>({
    queryKey: [...CORNERMAN_KEY, "candidates", user?.id ?? "anon", limit],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => getCornermanCandidates(limit),
  });
}

export function useRequestCornermanPair() {
  const qc = useQueryClient();

  return useMutation<CornermanRequestResult, Error, string>({
    mutationFn: requestCornermanPair,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORNERMAN_KEY });
    },
  });
}

export function useRespondCornermanPair() {
  const qc = useQueryClient();

  return useMutation<
    CornermanRequestResult,
    Error,
    { pairId: string; action: "accept" | "decline" }
  >({
    mutationFn: ({ pairId, action }) => respondCornermanPair(pairId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORNERMAN_KEY });
    },
  });
}

export function useEndCornermanPair() {
  const qc = useQueryClient();

  return useMutation<CornermanRequestResult, Error, string>({
    mutationFn: endCornermanPair,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORNERMAN_KEY });
    },
  });
}

export function useClaimCornermanDailyBonus() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<ClaimCornermanBonusResult, Error, void>({
    mutationFn: claimCornermanDailyBonus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORNERMAN_KEY });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // 코너맨 보너스도 숨겨진 미션 평가 트리거
      triggerCheck();
    },
  });
}
