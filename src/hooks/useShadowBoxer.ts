/**
 * 153 QUEST v2 20단계 — 그림자 복서 hook.
 *
 * 보호 원칙 (§3 + §11):
 *   · 공식 missions / member_progress 미수정 — 본 hook 의 어떤 경로도
 *     점수 함수에 공식 데이터를 전달하지 않는다 (서버 RPC 자체에서도
 *     boxing_engagement_* / quiz/challenge/cheer/journal 만 SELECT).
 *   · 보상은 RPC 반환값만 사용
 *   · grant_gems 직접 호출 0건
 *   · 월 1회 한도 — RPC 내부 idempotency_key 처리
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimShadowBoxerReward,
  getShadowBoxerSnapshot,
  type ClaimShadowBoxerResult,
  type ShadowBoxerSnapshot,
  type ShadowBoxerWindow,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";

export const SHADOW_BOXER_KEY = ["shadow-boxer"] as const;

export function useShadowBoxerSnapshot(
  windowDays: ShadowBoxerWindow = 30,
  enabled = true,
) {
  const { user } = useAuth();

  return useQuery<ShadowBoxerSnapshot>({
    queryKey: [...SHADOW_BOXER_KEY, "snapshot", user?.id ?? "anon", windowDays],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getShadowBoxerSnapshot(windowDays);
      } catch {
        return {
          success: true,
          ready: false,
          window_days: windowDays,
          reason: "분석 준비 중입니다.",
        } as ShadowBoxerSnapshot;
      }
    },
  });
}

export function useClaimShadowBoxerReward() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();

  return useMutation<ClaimShadowBoxerResult, Error, ShadowBoxerWindow>({
    mutationFn: claimShadowBoxerReward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHADOW_BOXER_KEY });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // 그림자 보상 → 추가 hidden mission 트리거
      triggerCheck();
    },
  });
}
