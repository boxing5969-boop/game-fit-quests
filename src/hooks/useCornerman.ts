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
  getCornermanPeople,
  getMyInviteStats,
  searchCornermanPeople,
  sendMemberInvite,
  EMPTY_CORNERMAN_STATUS,
  type ClaimCornermanBonusResult,
  type CornermanCandidate,
  type CornermanPerson,
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

/** 같은 지점 회원 이름으로 찾기 (2026-10-18) — 앱에 없는 회원도 (joined=false). 요청·초대하면 CORNERMAN_KEY 와 같이 새로 받는다 */
export function useCornermanSearch(query: string, enabled = true) {
  const { user } = useAuth();
  const q = query.trim();
  return useQuery<CornermanPerson[]>({
    queryKey: [...CORNERMAN_KEY, "search", user?.id ?? "anon", q],
    enabled: enabled && !!user?.id && q.length > 0,
    staleTime: 30_000,
    queryFn: () => searchCornermanPeople(q),
  });
}

/** 짝꿍 후보(앱 쓰는 회원) + 앱에 아직 없는 우리 지점 회원 (2026-10-18) */
export function useCornermanPeople(limit = 30, enabled = true) {
  const { user } = useAuth();
  return useQuery<CornermanPerson[]>({
    queryKey: [...CORNERMAN_KEY, "people", user?.id ?? "anon", limit],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => getCornermanPeople(limit),
  });
}

/** 앱 초대 — 기록만 서버에, 링크는 화면이 공유 창으로 */
export function useSendMemberInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMemberInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORNERMAN_KEY });
    },
  });
}

export function useMyInviteStats(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...CORNERMAN_KEY, "invite-stats", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: getMyInviteStats,
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
