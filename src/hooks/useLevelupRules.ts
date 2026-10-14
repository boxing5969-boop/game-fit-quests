/**
 * 리그별 승급 규칙 (get_levelup_rules) — 가이드·홈 카드 힌트가 같은 캐시를 쓴다 (2026-09-22).
 * 쿼리키 ["levelup-rules"] 는 GuidePage 와 동일.
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LeagueRule } from "@/lib/journeyMath";
import { withBranchAuthority } from "@/lib/levelAuthority";

export function useLevelupRules(enabled = true) {
  const { profile } = useAuth();
  const branch = profile?.branch_name ?? null;
  // 화이트 레벨 10 승인 주체는 지점마다 다르다 — 시범 지점(선릉역점)은 지점장 타이틀매치, 다른 지점은 담당 코치님 (2026-10-14)
  // 캐시는 서버 원본 그대로 두고 화면마다 지점 기준으로 바꿔 읽는다 (GuidePage · GuideJourneyPage 와 같은 방식)
  const select = useCallback((rules: LeagueRule[]) => withBranchAuthority(rules, branch) ?? rules, [branch]);
  return useQuery({
    queryKey: ["levelup-rules"],
    enabled,
    staleTime: 10 * 60_000,
    select,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_levelup_rules", {});
      if (error) throw error;
      return (data || []) as LeagueRule[];
    },
  });
}
