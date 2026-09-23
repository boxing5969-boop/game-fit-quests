/**
 * 153 챌린지 킹 보드 hooks — 요약(6개 왕좌) + 카테고리 순위표. 읽기 전용.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  get153KingBoard,
  get153KingSummary,
  getBranchNicknames,
  toggleNicknameLike,
  type BranchNicknames,
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

export const NICKNAME_LIKE_KEY = ["nickname-likes"] as const;

/** 같은 지점 회원 닉네임 목록 — 좋아요 시트가 열려 있을 때만 읽는다 */
export function useBranchNicknames(search: string, enabled: boolean) {
  const { user } = useAuth();
  const q = search.trim();
  return useQuery<BranchNicknames>({
    queryKey: [...NICKNAME_LIKE_KEY, "list", q, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getBranchNicknames(q || null, 60),
  });
}

/** 좋아요 토글 — 성공하면 목록·킹 보드를 다시 읽는다 */
export function useToggleNicknameLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => toggleNicknameLike(targetUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NICKNAME_LIKE_KEY });
      qc.invalidateQueries({ queryKey: KING_153_KEY });
    },
  });
}
