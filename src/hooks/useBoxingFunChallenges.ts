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
    },
  });
}
