/**
 * 📊 영상으로 배우기 데이터 — 대표님 데이터 화면 · 회원 「많이 담은 동작」 (2026-11-15 대표님 「다음 4단계진행」 4단계)
 *
 *   · useCardStats — training_card_stats(일, 지점): 대표님 · 운영진만(서버가 다시 확인) · 사람 수만
 *   · useCardPopular — training_card_popular(): 담은 회원이 5명을 넘는 카드 열쇠(숫자 없음 · 로그인한 사람)
 *   · 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 데이터 = null · 많이 담은 = 빈 칸 — 화면은 칸을 그리지 않는다
 *   · 예시 모드(?demo=1)는 서버를 부르지 않는다 — 예시 숫자(화면에 「예시」)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { demoPopular, demoStats, parseStats, type CardStats } from "@/lib/cardData";
import { isTrainingDemo } from "@/services/trainingCardService";

export const CARD_DATA_KEY = ["training-library", "stats"] as const;
export const CARD_POPULAR_KEY = ["training-library", "popular"] as const;

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);

/** 대표님 데이터 — enabled 는 화면이 관리자 계정일 때만 */
export function useCardStats(enabled: boolean, days: number, branch: string | null, demoKeys: readonly string[] = []) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...CARD_DATA_KEY, days, branch ?? "all", demo ? "demo" : "db"],
    enabled,
    staleTime: 2 * 60_000,
    retry: 1,
    queryFn: async (): Promise<CardStats | null> => {
      if (demo) return demoStats(days, branch, demoKeys);
      const { data, error } = await rpc("training_card_stats", { p_days: days, p_branch: branch });
      if (error) {
        if (missingFn(error)) return null;
        throw new Error(error.message ?? "데이터를 불러오지 못했어요");
      }
      return parseStats(data);
    },
  });
}

/** 회원 화면 「많이 담은 동작」 — 실패해도 조용히 빈 칸 */
export function useCardPopular(enabled: boolean, demoKeys: readonly string[] = []) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...CARD_POPULAR_KEY, demo ? "demo" : "db"],
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<ReadonlySet<string>> => {
      if (demo) return demoPopular(demoKeys);
      const { data, error } = await rpc("training_card_popular");
      if (error) return new Set();
      return new Set((Array.isArray(data) ? data : []).filter((k): k is string => typeof k === "string" && /^[cm]:/.test(k)));
    },
  });
}
