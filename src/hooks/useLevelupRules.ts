/**
 * 리그별 승급 규칙 (get_levelup_rules) — 가이드·홈 카드 힌트가 같은 캐시를 쓴다 (2026-09-22).
 * 쿼리키 ["levelup-rules"] 는 GuidePage 와 동일.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueRule } from "@/lib/journeyMath";

export function useLevelupRules(enabled = true) {
  return useQuery({
    queryKey: ["levelup-rules"],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_levelup_rules", {});
      if (error) throw error;
      return (data || []) as LeagueRule[];
    },
  });
}
