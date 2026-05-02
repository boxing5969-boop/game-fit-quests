/**
 * 153 QUEST v1.5 16단계 — 복싱 IQ 리그 hook.
 *
 * get_boxing_iq_league_summary RPC 래퍼.
 * 공식 레벨/리그와 분리. 표시만.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getBoxingIqLeagueSummary,
  type BoxingIqLeagueSummary,
} from "@/services/boxingEngagementService";

export const BOXING_IQ_LEAGUE_KEY = ["boxing-iq-league"] as const;

export const EMPTY_IQ_LEAGUE: BoxingIqLeagueSummary = {
  success: true,
  quiz_correct_count: 0,
  quiz_attempt_count: 0,
  accuracy_rate: 0,
  current_quiz_streak: 0,
  best_quiz_streak: 0,
  week_correct_count: 0,
  grade: "복싱 입문생",
};

export function useBoxingIqLeague(enabled = true) {
  const { user } = useAuth();

  return useQuery<BoxingIqLeagueSummary>({
    queryKey: [...BOXING_IQ_LEAGUE_KEY, "summary", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getBoxingIqLeagueSummary();
      } catch {
        return EMPTY_IQ_LEAGUE;
      }
    },
  });
}
