/**
 * 챌린지 React Query 훅.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/challengeService";

const KEY = ["challenges"] as const;

export function useChallengeList(
  status?: svc.ChallengeStatus,
  branchName?: string | null,
) {
  return useQuery({
    queryKey: [...KEY, "list", status ?? "all", branchName ?? "all"],
    staleTime: 30_000,
    queryFn: () => svc.listChallenges(status, branchName),
  });
}

export function useChallengeLeaderboard(challengeId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "leaderboard", challengeId],
    enabled: !!challengeId,
    staleTime: 15_000,
    queryFn: () => svc.getChallengeLeaderboard(challengeId!, 50),
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.joinChallenge,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useSubmitChallengeCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.submitChallengeCheckin,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
