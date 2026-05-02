/**
 * 153 QUEST — 재미 챌린지 hook.
 *
 * boxing_fun_challenges / submit_boxing_fun_challenge_attempt RPC 래퍼.
 * 공식 1~40 미션과 완전히 분리. 보상은 QUEST XP + 파이트 머니만.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveBoxingFunChallenges,
  submitBoxingFunChallengeAttempt,
  type BoxingFunChallenge,
  type FunChallengeAttemptResult,
  type SubmitFunChallengeInput,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";

export const BOXING_FUN_CHALLENGES_KEY = ["boxing-fun-challenges"] as const;

export function useBoxingFunChallenges(enabled = true) {
  return useQuery<BoxingFunChallenge[]>({
    queryKey: [...BOXING_FUN_CHALLENGES_KEY, "active"],
    enabled,
    staleTime: 60_000,
    queryFn: getActiveBoxingFunChallenges,
  });
}

export function useSubmitBoxingFunChallengeAttempt() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<
    FunChallengeAttemptResult,
    Error,
    SubmitFunChallengeInput
  >({
    mutationFn: submitBoxingFunChallengeAttempt,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["boxing-fun-challenges"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // v1.5 16단계: 숨겨진 미션 평가 트리거 (디바운스)
      triggerCheck();
    },
  });
}
