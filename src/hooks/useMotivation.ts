/**
 * 🥊 동기부여 1단계 — 첫 4주 스타터 · 이른 출석 축하 · 코치 '첫 4주 신규' (lib/motivation153 참고)
 *   캐시 키는 "153motivation" 으로 시작 — 다른 도메인 키와 겹치지 않게.
 *   서버 함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 화면은 지금 그대로.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  MOTIVATION_OFF,
  normalizeMotivation,
  normalizeWatchlist,
  type Motivation,
  type StarterWatchlist,
} from "@/lib/motivation153";

export const MOTIVATION_KEY = ["153motivation", "me"] as const;

async function fetchMotivation(): Promise<Motivation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_my_motivation");
  if (error) return MOTIVATION_OFF;
  return normalizeMotivation(data);
}

export function useMotivation(enabled = true) {
  const { user } = useAuth();
  return useQuery<Motivation>({
    queryKey: [...MOTIVATION_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: fetchMotivation,
  });
}

/** 축하 편지를 닫으면 — 안 본 이른 축하 · 첫 4주 달성을 모두 본 것으로 (실패해도 다음 접속에 편지가 한 번 더 올 뿐) */
export function useMarkMotivationSeen() {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("mark_my_motivation_seen");
    } catch {
      /* ignore */
    }
    void qc.invalidateQueries({ queryKey: MOTIVATION_KEY });
  }, [qc]);
}

/** 코치 화면 '첫 4주 신규' — 켠 지점 지도진 · 대표님만 (그 밖은 빈 목록) */
export function useStarterWatchlist(enabled = true, branch?: string | null) {
  const { user } = useAuth();
  return useQuery<StarterWatchlist>({
    queryKey: ["153motivation", "watchlist", branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_starter_watchlist", { p_branch: branch ?? null });
      if (error) return normalizeWatchlist(null);
      return normalizeWatchlist(data);
    },
  });
}
