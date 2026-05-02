/**
 * 153 QUEST v1.5 16단계 — 숨겨진 미션 hook.
 *
 * check_and_claim_hidden_missions / get_my_hidden_mission_progress
 * RPC 래퍼. 호출 측 디바운스 + RPC 내부 early return 으로 부하 방지.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 공식 XP 지급 0 — QUEST XP / 파이트 머니 / RP 만
 *   · 파이트 머니는 RPC 내부 grant_gems 만 경유
 */

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  checkAndClaimHiddenMissions,
  getMyHiddenMissionProgress,
  type CheckAndClaimHiddenMissionsResult,
  type HiddenMissionProgressResult,
} from "@/services/boxingEngagementService";

export const HIDDEN_MISSIONS_KEY = ["hidden-missions"] as const;

export function useMyHiddenMissionProgress(enabled = true) {
  const { user } = useAuth();

  return useQuery<HiddenMissionProgressResult>({
    queryKey: [...HIDDEN_MISSIONS_KEY, "progress", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getMyHiddenMissionProgress();
      } catch {
        return { success: true, missions: [] };
      }
    },
  });
}

export function useCheckAndClaimHiddenMissions() {
  const qc = useQueryClient();

  return useMutation<CheckAndClaimHiddenMissionsResult, Error, void>({
    mutationFn: checkAndClaimHiddenMissions,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["hidden-missions"] });
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      if (data.claimed.length > 0) {
        qc.invalidateQueries({ queryKey: ["wallet"] });
      }
    },
  });
}

/**
 * 호출 측 디바운스 헬퍼.
 * mutation onSuccess 에서 setTimeout 으로 호출하여
 * 동일 사용자 액션 폭주 시 한 번만 RPC 발사한다.
 *
 * 사용 예:
 *   const { triggerCheck } = useHiddenMissionTrigger();
 *   triggerCheck(); // mutation onSuccess 에서 호출
 */
export function useHiddenMissionTrigger() {
  const claim = useCheckAndClaimHiddenMissions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCheck = useCallback(
    (delayMs = 800) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        claim.mutate(undefined, {
          onSuccess: (data) => {
            if (data.claimed.length === 0) return;
            // 토스트로 알림 — 첫 번째만 강조 (한 번에 여러 개 동시 클레임 가능)
            for (const m of data.claimed) {
              toast.success(`숨겨진 미션 발견! ${m.title}`, {
                description: m.description,
                duration: 5000,
              });
            }
          },
        });
      }, delayMs);
    },
    [claim],
  );

  return { triggerCheck };
}
