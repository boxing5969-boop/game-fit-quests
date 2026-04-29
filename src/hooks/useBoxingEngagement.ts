/**
 * 153 QUEST 몰입 레이어 — engagement summary hook.
 *
 * 공식 member_progress 와 무관하다. 본 hook 의 어떤 경로도
 * total_xp / current_level / current_rank 를 수정하지 않는다.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_ENGAGEMENT_SUMMARY,
  getMyBoxingEngagementSummary,
  type BoxingEngagementSummary,
} from "@/services/boxingEngagementService";

export const BOXING_ENGAGEMENT_KEY = ["boxing-engagement"] as const;

export function useBoxingEngagementSummary() {
  const { user } = useAuth();

  return useQuery<BoxingEngagementSummary>({
    queryKey: [...BOXING_ENGAGEMENT_KEY, "summary", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await getMyBoxingEngagementSummary();
      } catch {
        // 앱 전체를 깨지 말고 기본값 fallback (UI 가 0 으로 그릴 수 있게).
        return EMPTY_ENGAGEMENT_SUMMARY;
      }
    },
  });
}
