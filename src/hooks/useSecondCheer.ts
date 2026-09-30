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
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";
import { useGymRaidContributeTrigger } from "@/hooks/useGymRaid";

export const SECOND_CHEER_KEY = ["second-cheer"] as const;

export function useSecondCheerCandidates(limit = 30, enabled = true, search = "") {
  const { user } = useAuth();
  const q = search.trim();

  return useQuery<SecondCheerCandidate[]>({
    queryKey: [...SECOND_CHEER_KEY, "candidates", user?.id ?? "anon", limit, q],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    // 검색어를 바꾸는 동안 이전 목록을 그대로 보여 준다 (깜빡임 방지)
    placeholderData: (prev) => prev,
    queryFn: () => getSecondCheerCandidates(limit, q),
  });
}

export function useSendBoxingCheer() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();
  const { triggerContribute } = useGymRaidContributeTrigger();

  return useMutation<SendCheerResult, Error, SendCheerInput>({
    mutationFn: sendBoxingCheer,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["second-cheer"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // v1.5 16단계: 숨겨진 미션 평가 트리거 (디바운스)
      triggerCheck();
      // v2 21단계: 짐 레이드 contribute (cheer_id 사용)
      triggerContribute("boxing_cheer", result.cheer_id);
    },
  });
}
