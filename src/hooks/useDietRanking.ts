import { useQuery } from "@tanstack/react-query";
import * as diet from "@/services/dietService";

/**
 * 지점 내 습관 수행률 랭킹.
 *
 * 체중 감소량이 아닌 `approved_days_total`·`best_streak`·`habit_score`
 * 만으로 정렬 (서버 RPC `get_diet_ranking`). UI 측도 닉네임/아바타만 노출.
 */
export function useDietRanking(
  branchName: string | null | undefined,
  limit = 50,
) {
  return useQuery({
    queryKey: ["diet", "ranking", branchName, limit],
    enabled: !!branchName,
    staleTime: 60_000,
    queryFn: async () => {
      if (!branchName) return { success: false, error: "no_branch" } as const;
      return diet.getBranchRanking({ branchName, limit });
    },
  });
}
