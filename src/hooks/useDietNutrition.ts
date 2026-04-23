/**
 * 153 다이어트 · 영양 프로필 React Query 훅.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import * as svc from "@/services/dietNutritionService";

const NUTRITION_KEY = ["diet", "nutrition"] as const;

export function useNutritionProfile(targetUserId?: string) {
  const { user } = useAuth();
  const resolved = targetUserId ?? user?.id;
  return useQuery({
    queryKey: targetUserId
      ? [...NUTRITION_KEY, "member", targetUserId]
      : [...NUTRITION_KEY, "mine", resolved],
    enabled: !!resolved,
    staleTime: 30_000,
    queryFn: async () => svc.getNutritionProfile(targetUserId),
  });
}

export function useUpsertNutritionProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.upsertNutritionProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NUTRITION_KEY });
    },
  });
}
