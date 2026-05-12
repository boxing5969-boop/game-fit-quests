/**
 * 153 챌린지 — 회원 간 별도 랭킹 서비스 (RPC 래퍼).
 *
 * 점수원: quest_xp (boxing_engagement_profiles / boxing_engagement_events)
 * 기존 명예의 전당 (/halloffame) 과 별개 — 보조 챌린지 활동 기반.
 *
 * 보호 원칙: 읽기 전용. 공식 XP / wallet 변경 0건.
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type Challenge153Period = "weekly" | "monthly" | "all_time";

export interface Challenge153LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  branch_name: string;
  score: number;
  is_me: boolean;
}

export interface Challenge153MyRank {
  my_rank: number;
  my_score: number;
  total_participants: number;
  period: Challenge153Period;
}

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

function throwKo(err: unknown): never {
  throw new Error(translateError(err));
}

export async function get153ChallengeLeaderboard(
  period: Challenge153Period = "weekly",
  limit = 20,
): Promise<Challenge153LeaderboardRow[]> {
  const { data, error } = await sbRpc<Challenge153LeaderboardRow[]>(
    "get_153_challenge_leaderboard",
    { p_period: period, p_limit: limit },
  );
  if (error) throwKo(error);
  return data ?? [];
}

export async function getMy153ChallengeRank(
  period: Challenge153Period = "weekly",
): Promise<Challenge153MyRank> {
  const { data, error } = await sbRpc<Challenge153MyRank[]>(
    "get_my_153_challenge_rank",
    { p_period: period },
  );
  if (error) throwKo(error);
  const row = Array.isArray(data) ? data[0] : data;
  return (
    row ?? {
      my_rank: 0,
      my_score: 0,
      total_participants: 0,
      period,
    }
  );
}
