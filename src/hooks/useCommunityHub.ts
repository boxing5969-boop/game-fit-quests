/**
 * 153 커뮤니티 확장 훅 — 쿼리 키·무효화를 한 곳에 모은다.
 *
 * 규약 (useCornerman 과 동일):
 *   · 루트 키 상수를 export → 파생 키에 user id 를 포함
 *   · 조회 실패는 빈 값으로 폴백 (카드가 화면을 깨뜨리지 않게)
 *   · mutation onSuccess 에서 루트 키 무효화
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useGymRaidContributeTrigger } from "@/hooks/useGymRaid";
import {
  EMPTY_GEAR_POSTS,
  EMPTY_PARTNER_CALLS,
  EMPTY_TIME_CREW,
  EMPTY_TITLEMATCH_FEED,
  clapTitleMatch,
  closeGearPost,
  closePartnerCall,
  createGearPost,
  createPartnerCall,
  getGearPosts,
  getPartnerCalls,
  getTimeCrew,
  getTitleMatchFeed,
  joinPartnerCall,
  leavePartnerCall,
  type GearCondition,
  type GearDeal,
  type GearKind,
  type PartnerPurpose,
} from "@/services/communityHubService";

export const PARTNER_CALLS_KEY = ["153hub", "partner-calls"] as const;
export const GEAR_POSTS_KEY = ["153hub", "gear-posts"] as const;
export const TITLEMATCH_FEED_KEY = ["153hub", "titlematch-feed"] as const;
export const TIME_CREW_KEY = ["153hub", "time-crew"] as const;

/* ── 오늘 파트너 구하기 ── */

export function usePartnerCalls(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PARTNER_CALLS_KEY, user?.id ?? "anon"],
    enabled: !!user?.id && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await getPartnerCalls();
      } catch {
        return EMPTY_PARTNER_CALLS;
      }
    },
  });
}

export function usePartnerCallActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PARTNER_CALLS_KEY });

  const create = useMutation({
    mutationFn: (v: { purpose: PartnerPurpose; slotHour: number; note: string | null }) =>
      createPartnerCall(v.purpose, v.slotHour, v.note),
    onSuccess: invalidate,
  });
  const join = useMutation({ mutationFn: joinPartnerCall, onSuccess: invalidate });
  const leave = useMutation({ mutationFn: leavePartnerCall, onSuccess: invalidate });
  const close = useMutation({ mutationFn: closePartnerCall, onSuccess: invalidate });

  return { create, join, leave, close };
}

/* ── 중고 장비 나눔 ── */

export function useGearPosts(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...GEAR_POSTS_KEY, user?.id ?? "anon"],
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getGearPosts(30);
      } catch {
        return EMPTY_GEAR_POSTS;
      }
    },
  });
}

export function useGearActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: GEAR_POSTS_KEY });

  const create = useMutation({
    mutationFn: (v: {
      kind: GearKind;
      size: string | null;
      condition: GearCondition;
      deal: GearDeal;
      note: string | null;
    }) => createGearPost(v),
    onSuccess: invalidate,
  });
  const close = useMutation({ mutationFn: closeGearPost, onSuccess: invalidate });

  return { create, close };
}

/* ── 타이틀매치 축하 피드 ── */

export function useTitleMatchFeed(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TITLEMATCH_FEED_KEY, user?.id ?? "anon"],
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getTitleMatchFeed(20);
      } catch {
        return EMPTY_TITLEMATCH_FEED;
      }
    },
  });
}

export function useClapTitleMatch() {
  const qc = useQueryClient();
  const { triggerContribute } = useGymRaidContributeTrigger();

  return useMutation({
    mutationFn: (v: { receiverUserId: string; sourceId: string }) =>
      clapTitleMatch(v.receiverUserId, v.sourceId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: TITLEMATCH_FEED_KEY });
      // 박수는 기존 응원 한도·짐 레이드 기여와 같은 원장을 쓴다
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // 지점 짐 레이드(cheer_sent)에 1점 — 세컨드 응원과 같은 카운터.
      // cheer_id 가 없으면 서버가 조용히 넘긴다(회원 흐름을 막지 않는다).
      if (result?.cheer_id) triggerContribute("boxing_cheer", result.cheer_id);
    },
  });
}

/* ── 같은 시간대 팀 ── */

export function useTimeCrew() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TIME_CREW_KEY, user?.id ?? "anon"],
    enabled: !!user?.id,
    // 출석 데이터 기반이라 자주 바뀌지 않는다
    staleTime: 10 * 60_000,
    queryFn: async () => {
      try {
        return await getTimeCrew();
      } catch {
        return EMPTY_TIME_CREW;
      }
    },
  });
}
