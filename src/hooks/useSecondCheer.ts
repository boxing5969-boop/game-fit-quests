/**
 * 153 QUEST — 세컨드 응원 hook.
 *
 * send_boxing_cheer RPC 래퍼 + 후보 조회.
 * 2026-10-16 업그레이드: 스티커·한마디 응원은 하루 10번, 같은 동료에게 하루 1번 (타이틀매치 박수는 예전 규칙)
 *   받을 사람 고르기(useCheerCandidates) · 받은 응원함(useMyReceivedCheers) · 고마워요 153(useThankCheer)
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
import {
  getCheerCandidates,
  getMemberCheerSummary,
  getMyReceivedCheers,
  getMySentCheers,
  thankCheer,
  type CheerCandidates,
  type MemberCheerSummary,
  type ReceivedCheers,
  type SentCheers,
} from "@/services/cheerService";
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
      qc.invalidateQueries({ queryKey: CHEER_CANDIDATES_KEY });
      qc.invalidateQueries({ queryKey: SENT_CHEERS_KEY });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // v1.5 16단계: 숨겨진 미션 평가 트리거 (디바운스)
      triggerCheck();
      // v2 21단계: 짐 레이드 contribute (cheer_id 사용)
      triggerContribute("boxing_cheer", result.cheer_id);
    },
  });
}

/* ══════════ 2026-10-16 응원 업그레이드 ══════════ */

export const CHEER_CANDIDATES_KEY = ["cheer-candidates"] as const;
export const RECEIVED_CHEERS_KEY = ["received-cheers"] as const;
export const SENT_CHEERS_KEY = ["sent-cheers"] as const;

/** 받을 사람 고르기 — 지금 운동 중 → 오늘 다녀간 동료 → 최근 출석 순 */
export function useCheerCandidates(enabled: boolean, search = "") {
  const { user } = useAuth();
  const q = search.trim();
  return useQuery<CheerCandidates>({
    queryKey: [...CHEER_CANDIDATES_KEY, user?.id ?? "anon", q],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => getCheerCandidates(q),
  });
}

/** 받은 응원함 */
export function useMyReceivedCheers(enabled = true) {
  const { user } = useAuth();
  return useQuery<ReceivedCheers>({
    queryKey: [...RECEIVED_CHEERS_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getMyReceivedCheers(80),
  });
}

/** 보낸 응원 — 내가 누구에게 보냈는지 · 고마워요를 받았는지 (2026-10-28 회원 제안) */
export function useMySentCheers(enabled = true) {
  const { user } = useAuth();
  return useQuery<SentCheers>({
    queryKey: [...SENT_CHEERS_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getMySentCheers(80),
  });
}

/** 고마워요 153 — 보낸 사람에게 알림 */
export function useThankCheer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cheerId: string) => thankCheer(cheerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECEIVED_CHEERS_KEY }),
  });
}

/** 라이센스 '받은 응원' */
export function useMemberCheerSummary(userId: string | null | undefined, enabled = true) {
  return useQuery<MemberCheerSummary>({
    queryKey: ["member-cheer-summary", userId ?? ""],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    queryFn: () => getMemberCheerSummary(userId!),
  });
}
