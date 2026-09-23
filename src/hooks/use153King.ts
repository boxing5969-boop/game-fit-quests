/**
 * 153 챌린지 킹 보드 hooks — 요약(6개 왕좌) + 카테고리 순위표. 읽기 전용.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  get153KingBoard,
  get153KingSummary,
  type KingBoard,
  type KingCategory,
  type KingPeriod,
  type KingScope,
  type KingSummary,
} from "@/services/king153Service";

export const KING_153_KEY = ["153-king"] as const;

export function use153KingSummary(period: KingPeriod, scope: KingScope) {
  const { user } = useAuth();
  return useQuery<KingSummary>({
    queryKey: [...KING_153_KEY, "summary", period, scope, user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => get153KingSummary(period, scope),
  });
}

export function use153KingBoard(category: KingCategory | null, period: KingPeriod, scope: KingScope, limit = 10) {
  const { user } = useAuth();
  return useQuery<KingBoard>({
    queryKey: [...KING_153_KEY, "board", category, period, scope, limit, user?.id ?? "anon"],
    enabled: !!user?.id && !!category,
    staleTime: 60_000,
    queryFn: () => get153KingBoard(category as KingCategory, period, scope, limit),
  });
}
