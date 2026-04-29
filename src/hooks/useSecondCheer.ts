/**
 * 153 QUEST — 세컨드 응원 hook.
 *
 * send_boxing_cheer RPC 래퍼 + 후보 조회.
 * 본인에게는 보낼 수 없고, 일일 sender 20회 / 같은 receiver 3회 RP 인정
 * 한도가 서버에서 적용된다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSecondCheerCandidates,
  sendBoxingCheer,
  type SecondCheerCandidate,
  type SendCheerInput,
  type SendCheerResult,
} from "@/services/boxingEngagementService";

export const SECOND_CHEER_KEY = ["second-cheer"] as const;

export function useSecondCheerCandidates(limit = 30, enabled = true) {
  const { user } = useAuth();

  return useQuery<SecondCheerCandidate[]>({
    queryKey: [...SECOND_CHEER_KEY, "candidates", user?.id ?? "anon", limit],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => getSecondCheerCandidates(limit),
  });
}

export function useSendBoxingCheer() {
  const qc = useQueryClient();

  return useMutation<SendCheerResult, Error, SendCheerInput>({
    mutationFn: sendBoxingCheer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["second-cheer"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
