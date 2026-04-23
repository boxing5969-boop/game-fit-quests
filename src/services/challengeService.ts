/**
 * 챌린지 서비스 — 20260505 마이그레이션 RPC 래퍼.
 *
 * 모든 쓰기는 SECURITY DEFINER RPC 만 사용. RLS 는 읽기만.
 */

import { supabase } from "@/integrations/supabase/client";

export type ChallengeGoal =
  | "fat_loss"
  | "late_snack_stop"
  | "workout_habit"
  | "maintenance";
export type ChallengeStatus = "upcoming" | "active" | "ended";
export type ChallengeTeamSide = "red" | "blue" | "none";

export const CHALLENGE_GOAL_LABEL: Record<ChallengeGoal, string> = {
  fat_loss: "체지방 감량형",
  late_snack_stop: "야식 끊기형",
  workout_habit: "운동 습관형",
  maintenance: "유지 관리형",
};

export interface ChallengeRow {
  id: string;
  title: string;
  goal: ChallengeGoal;
  branch_name: string | null;
  start_date: string;
  duration_days: number;
  status: ChallengeStatus;
  invite_code: string | null;
  is_joined: boolean;
  participant_count: number;
}

export interface ChallengeLeaderRow {
  user_id: string;
  team_side: ChallengeTeamSide;
  total_points: number;
  current_streak: number;
  last_checkin_date: string | null;
  member_name: string | null;
  branch_name: string | null;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };
type Res<T> = Ok<T> | Err;

const err = (m: string): Err => ({ success: false, error: m });
const asRes = <T>(data: unknown): Res<T> => {
  if (!data || typeof data !== "object") return err("unexpected_response");
  return data as Res<T>;
};

export async function listChallenges(
  status?: ChallengeStatus,
  branchName?: string | null,
): Promise<Res<{ rows: ChallengeRow[] }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("list_challenges", {
    _status: status ?? null,
    _branch_name: branchName ?? null,
  });
  if (error) return err(error.message);
  return asRes<{ rows: ChallengeRow[] }>(data);
}

export async function joinChallenge(input: {
  challengeId: string;
  teamSide?: ChallengeTeamSide;
  inviteCode?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("join_challenge", {
    _challenge_id: input.challengeId,
    _team_side: input.teamSide ?? "none",
    _invite_code: input.inviteCode ?? null,
  });
  if (error) return err(error.message);
  return asRes<{ participant_id: string }>(data);
}

export async function submitChallengeCheckin(input: {
  challengeId: string;
  kind?: "daily" | "comeback" | "mission" | "photo";
  points?: number;
  note?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("submit_challenge_checkin", {
    _challenge_id: input.challengeId,
    _kind: input.kind ?? "daily",
    _points: input.points ?? 1,
    _note: input.note ?? null,
  });
  if (error) return err(error.message);
  return asRes<{
    checkin_id?: string;
    current_streak?: number;
    already_done_today?: boolean;
  }>(data);
}

export async function getChallengeLeaderboard(
  challengeId: string,
  limit = 50,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_challenge_leaderboard", {
    _challenge_id: challengeId,
    _limit: limit,
  });
  if (error) return err(error.message);
  return asRes<{
    team_red_points: number;
    team_blue_points: number;
    participant_count: number;
    rows: ChallengeLeaderRow[];
  }>(data);
}
