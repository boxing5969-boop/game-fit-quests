import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_DIET_PREFERENCES,
  mergeDietPreferences,
  type DietPreferences,
} from "@/lib/diet/preferences";
import {
  fetchDietPreferences,
  saveDietPreferences,
} from "@/services/dietService";

/**
 * 153 다이어트 — 사용자 환경설정 훅.
 *
 * 반환값
 *   • data: DietPreferences (항상 보정된 기본값 포함)
 *   • update(next): 저장 + 캐시 무효화
 *   • isLoading / isUpdating
 */
export function useDietPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["diet", "preferences", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const raw = await fetchDietPreferences();
      return mergeDietPreferences(raw);
    },
  });

  const mutation = useMutation({
    mutationFn: async (next: DietPreferences) => {
      const ok = await saveDietPreferences(next as unknown as Record<string, unknown>);
      if (!ok) throw new Error("save_failed");
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(["diet", "preferences", user?.id], next);
      qc.invalidateQueries({ queryKey: ["diet", "ranking"] });
    },
  });

  return {
    data: query.data ?? DEFAULT_DIET_PREFERENCES,
    isLoading: query.isLoading,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
