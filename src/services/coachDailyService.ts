/**
 * 📊 코치 매일 리포트 · 오늘 미션 — 서버 함수 감싸기 (DB 20261126224743_coach_daily.sql)
 *   coach_daily_me = 내 리포트 · 내 미션(관장 · 관리자는 코치님별 표까지). 12/1 전에는 관리자 미리보기만.
 *   함수가 없거나 막히면 꺼진 것으로 본다 — 지도자 홈은 지금 그대로. 캐시 키는 "153leader" 아래 "daily".
 *   미션 완료는 지도자 홈 기록(leader_contact_save)으로 — 기록을 남기면 이 캐시도 새로 받는다(leaderHomeService).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DAILY_OFF, normalizeCoachDaily, type CoachDailyData } from "@/lib/coachDaily";
import { LEADER_KEY } from "@/services/leaderHomeService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

export function useCoachDaily(branch: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<CoachDailyData>({
    queryKey: [...LEADER_KEY, "daily", branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("coach_daily_me", { p_branch: branch ?? null });
      if (error) return DAILY_OFF;
      return normalizeCoachDaily(data);
    },
  });
}
