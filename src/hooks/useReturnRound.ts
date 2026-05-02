/**
 * 153 QUEST v1.5 15단계 — 리턴 라운드 hook.
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 미수정
 *   · 공식 XP 지급 0 — QUEST XP / 파이트 머니만
 *   · record_attendance 호출 0 / approve_mission_submission 호출 0
 *   · 마지막 활동일은 boxing_engagement_events 단일 소스 (RPC 내부 계산)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimReturnRoundReward,
  getReturnRoundStatus,
  type ClaimReturnRoundResult,
  type ReturnRoundStatus,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";

export const RETURN_ROUND_KEY = ["return-round"] as const;

export function useReturnRoundStatus() {
  const { user } = useAuth();

  return useQuery<ReturnRoundStatus>({
    queryKey: [...RETURN_ROUND_KEY, "status", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getReturnRoundStatus();
      } catch {
        return {
          success: true,
          active: false,
          inactive_days: 0,
          return_type: null,
          message: "꾸준히 오고 계시네요.",
        } as ReturnRoundStatus;
      }
    },
  });
}

export function useClaimReturnRoundReward() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<ClaimReturnRoundResult, Error, string>({
    mutationFn: claimReturnRoundReward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-round"] });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // v1.5 16단계: 'comeback_record' 숨겨진 미션 평가
      triggerCheck();
    },
  });
}
