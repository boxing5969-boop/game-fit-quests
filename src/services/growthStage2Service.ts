/**
 * 🌱 오늘의 1분 성장 2단계 — 서버 읽고 쓰기 (2026-11-17 대표님 「다음진행」 · 선릉역점부터)
 *   get_my_growth(읽은 날 · 누적 도장 · 운동 달력 체크 첫날) · mark_my_growth_seen · growth_coach_state · growth_coach_say
 *   (supabase/migrations/20261117013509_growth_stage2.sql). 계산 · 글은 lib/growthStage2.
 *   함수가 없는 DB(적용 전 · 옛 DB 미리보기)거나 켠 지점 회원이 아니면 꺼진 것으로 — 화면은 1단계 그대로.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  COACH_STATE_OFF,
  MY_GROWTH_OFF,
  growthCheckOf,
  normalizeCoachState,
  normalizeMyGrowth,
  type GrowthCheck,
  type GrowthCoachState,
  type MyGrowth,
} from "@/lib/growthStage2";

type RpcError = { code?: string; message?: string } | null;
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);
const missingFn = (error: RpcError): boolean =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));

/** 캐시 열쇠 — 내 읽은 날 · 코치 한마디 */
export const GROWTH_ME_KEY = ["153growth", "me"] as const;
export const GROWTH_COACH_KEY = ["153growth", "coach"] as const;

/** 함수가 없는 서버 — 이번 접속 동안 그만 부른다 */
let off = false;
/** 이 계정이 켠 지점 회원이 아님을 이미 안다 — 운동 달력이 범위마다 다시 묻지 않게 */
let knownOff: string | null = null;

/** 내 읽은 날 · 누적 도장 (범위를 주면 그 사이 읽은 날도). 못 읽으면 꺼진 것으로 */
export async function fetchMyGrowth(uid: string | null | undefined, from?: string | null, to?: string | null): Promise<MyGrowth> {
  if (off || !uid || knownOff === uid) return MY_GROWTH_OFF;
  try {
    const { data, error } = await rpc("get_my_growth", { p_from: from ?? null, p_to: to ?? null });
    if (missingFn(error)) {
      off = true;
      return MY_GROWTH_OFF;
    }
    if (error) return MY_GROWTH_OFF;
    const g = normalizeMyGrowth(data);
    if (!g.on) knownOff = uid;
    return g;
  } catch {
    return MY_GROWTH_OFF;
  }
}

/** 운동 달력에 붙일 조각 — 그날의 체크에 '1분 성장'이 드는 계정만 (아니면 null = 예전 그대로) */
export async function fetchGrowthCheck(uid: string | null | undefined, from: string, to: string): Promise<GrowthCheck | null> {
  return growthCheckOf(await fetchMyGrowth(uid, from, to));
}

/** 내 읽은 날 · 누적 도장 — 홈 카드 서랍의 한 줄 · 축하 편지 */
export function useMyGrowth(enabled = true) {
  const { user } = useAuth();
  return useQuery<MyGrowth>({
    queryKey: [...GROWTH_ME_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    retry: false,
    queryFn: () => fetchMyGrowth(user?.id),
  });
}

/** 축하 편지를 닫으면 — 안 본 도장을 모두 본 것으로 (실패해도 다음 접속에 편지가 한 번 더 올 뿐) */
export function useMarkGrowthSeen() {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      await rpc("mark_my_growth_seen");
    } catch {
      /* ignore */
    }
    void qc.invalidateQueries({ queryKey: GROWTH_ME_KEY });
  }, [qc]);
}

/** 코치 「오늘의 한마디」 — 켠 지점 지도진 · 대표님 · 운영진만 (그 밖 · 함수가 없으면 꺼짐) */
export function useGrowthCoach(branch: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery<GrowthCoachState>({
    queryKey: [...GROWTH_COACH_KEY, branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await rpc("growth_coach_state", { p_branch: branch ?? null });
        if (error) return COACH_STATE_OFF;
        return normalizeCoachState(data);
      } catch {
        return COACH_STATE_OFF;
      }
    },
  });
}

/** 수업에서 전했어요 · 취소 — 누르는 순간 바뀌고, 실패하면 되돌린다 */
export function useGrowthCoachSay(branch: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...GROWTH_COACH_KEY, branch ?? "mine", user?.id ?? "anon"];
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { data, error } = await rpc("growth_coach_say", { p_branch: branch ?? null, p_on: on });
      if (error) throw new Error("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요");
      return normalizeCoachState(data);
    },
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GrowthCoachState>(key);
      if (prev?.on && prev.mine !== on) {
        qc.setQueryData<GrowthCoachState>(key, { ...prev, mine: on, count: Math.max(0, prev.count + (on ? 1 : -1)) });
      }
      return { prev };
    },
    onError: (_e, _on, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (next) => {
      if (next.on) qc.setQueryData(key, next);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: GROWTH_COACH_KEY }),
  });
}

/** 시험용 — 접속 동안 기억한 것을 비운다 */
export function resetGrowthStage2ServiceForTest(): void {
  off = false;
  knownOff = null;
}
