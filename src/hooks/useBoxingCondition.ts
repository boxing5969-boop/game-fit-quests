/**
 * 153 QUEST v1.5 14단계 — 컨디션 게이지 hook.
 *
 * boxing_condition_logs + submit_boxing_condition / get_today_boxing_condition
 * RPC 래퍼. 보상 0 (파밍 방지) — 본 hook 의 어떤 경로도 wallet/공식 XP 를
 * 수정하지 않는다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRecentBoxingConditions,
  getTodayBoxingCondition,
  submitBoxingCondition,
  type BoxingConditionLogRow,
  type SubmitBoxingConditionInput,
  type SubmitBoxingConditionResult,
  type TodayBoxingCondition,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";

export const BOXING_CONDITION_KEY = ["boxing-condition"] as const;

export function useTodayBoxingCondition() {
  const { user } = useAuth();

  return useQuery<TodayBoxingCondition>({
    queryKey: [...BOXING_CONDITION_KEY, "today", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await getTodayBoxingCondition();
      } catch {
        return {
          success: true,
          has_today: false,
          condition_type: null,
        } as TodayBoxingCondition;
      }
    },
  });
}

export function useRecentBoxingConditions(days = 14, enabled = true) {
  const { user } = useAuth();

  return useQuery<BoxingConditionLogRow[]>({
    queryKey: [...BOXING_CONDITION_KEY, "recent", user?.id ?? "anon", days],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => getRecentBoxingConditions(days),
  });
}

export function useSubmitBoxingCondition() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<
    SubmitBoxingConditionResult,
    Error,
    SubmitBoxingConditionInput
  >({
    mutationFn: submitBoxingCondition,
    onSuccess: () => {
      // 컨디션 변경 시 보조 퀘스트 추천 우선순위가 즉시 갱신되도록
      qc.invalidateQueries({ queryKey: ["boxing-condition"] });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      // wallet 은 보상 0 이므로 invalidate 안함
      // v1.5 16단계: 'condition_7' 숨겨진 미션 평가
      triggerCheck();
    },
  });
}
