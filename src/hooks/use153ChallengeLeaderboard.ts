/**
 * 153 챌린지 회원 간 랭킹 hooks.
 *
 * 기간 (weekly / monthly / all_time) 별 quest_xp 누적 점수.
 * 기존 명예의 전당과 별개 — 읽기 전용.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  get153ChallengeLeaderboard,
  getMy153ChallengeRank,
  type Challenge153LeaderboardRow,
  type Challenge153MyRank,
  type Challenge153Period,
} from "@/services/challenge153LeaderboardService";

export const CHALLENGE_153_KEY = ["challenge-153"] as const;

export function use153ChallengeLeaderboard(
  period: Challenge153Period = "weekly",
  limit = 20,
  enabled = true,
) {
  const { user } = useAuth();
  return useQuery<Challenge153LeaderboardRow[]>({
    queryKey: [
      ...CHALLENGE_153_KEY,
      "leaderboard",
      period,
      limit,
      user?.id ?? "anon",
    ],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => get153ChallengeLeaderboard(period, limit),
  });
}

export function useMy153ChallengeRank(
  period: Challenge153Period = "weekly",
  enabled = true,
) {
  const { user } = useAuth();
  return useQuery<Challenge153MyRank>({
    queryKey: [...CHALLENGE_153_KEY, "my-rank", period, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: () => getMy153ChallengeRank(period),
  });
}
