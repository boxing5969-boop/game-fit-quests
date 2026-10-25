/**
 * 153 PB 기록 — DB 함수 호출 (supabase/migrations/20261015220000_test153_records.sql)
 *   생성된 타입에 아직 없어서 (supabase as any) 로 부른다.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Test153Division } from "@/lib/test153";
import { normalizeFitnessProfile, type FitnessProfile, type MeasureKind } from "@/lib/test153Profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface Test153Record {
  id: string;
  division: Test153Division;
  score_ms: number;
  total_ms: number;
  finished: boolean;
  remaining_reps: number;
  splits_ms: number[];
  measured_at: string;
  note: string | null;
  coach_name: string;
}

export interface Test153Best {
  id: string;
  score_ms: number;
  finished: boolean;
  remaining_reps: number;
  splits_ms: number[];
  measured_at: string;
}

export interface Test153Rank {
  branch: number | null;
  branch_total: number;
  all: number | null;
  all_total: number;
}

export interface Test153Summary {
  records: Test153Record[];
  best: Partial<Record<Test153Division, Test153Best>>;
  rank: Partial<Record<Test153Division, Test153Rank>>;
  branch_name: string | null;
}

export interface Test153RankRow {
  r_position: number;
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_branch_name: string | null;
  r_score_ms: number;
  r_finished: boolean;
  r_remaining_reps: number;
  r_gender: string | null;
  r_age_group: string | null;
  r_measured_at: string;
}

export interface SaveTest153Result {
  id: string;
  score_ms: number;
  is_pb: boolean;
  prev_pb_ms: number | null;
}

export const fetchTest153Summary = async (userId?: string): Promise<Test153Summary> => {
  const { data, error } = await sb.rpc("get_test153_summary", { p_user_id: userId ?? null });
  if (error) throw error;
  return data as Test153Summary;
};

export const fetchTest153Ranking = async (opts: {
  division: Test153Division;
  branch: string | null;
  gender: string | null;
  age: string | null;
  limit?: number;
}): Promise<Test153RankRow[]> => {
  const { data, error } = await sb.rpc("get_test153_ranking", {
    p_division: opts.division,
    p_branch: opts.branch,
    p_gender: opts.gender,
    p_age: opts.age,
    p_limit: opts.limit ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as Test153RankRow[];
};

export const saveTest153Record = async (args: {
  userId: string;
  division: Test153Division;
  gender: "남" | "여" | null;
  splitsMs: number[];
  finished: boolean;
  remainingReps: number;
  note?: string;
}): Promise<SaveTest153Result> => {
  const { data, error } = await sb.rpc("save_test153_record", {
    p_user_id: args.userId,
    p_division: args.division,
    p_gender: args.gender,
    p_splits_ms: args.splitsMs.map((n) => Math.round(n)),
    p_finished: args.finished,
    p_remaining_reps: args.finished ? 0 : args.remainingReps,
    p_note: args.note ?? null,
  });
  if (error) throw error;
  return data as SaveTest153Result;
};

export const voidTest153Record = async (id: string) => {
  const { error } = await sb.rpc("void_test153_record", { p_id: id });
  if (error) throw error;
};

/**
 * 153 체력 프로필 (2026-10-25 · 1단계 '내 체력 보기') — supabase/migrations/20261025130557_fitness_profile_153.sql
 *   userId 없으면 본인, 있으면 그 회원 (같은 지점 코치 · 지점장 · 관리자만 — 서버가 거른다)
 */
export const fetchFitnessProfile = async (userId?: string | null): Promise<FitnessProfile> => {
  const { data, error } = await sb.rpc("get_my_fitness_profile", { p_user_id: userId ?? null });
  if (error) throw error;
  return normalizeFitnessProfile(data);
};

/** 악력 · 허리둘레 · 안정시 심박 저장 — userId 없으면 본인(me), 회원이면 코치 측정(coach). 같은 날 다시 넣으면 고친다 */
export const saveFitnessMeasure = async (userId: string | null, kind: MeasureKind, value: number) => {
  const { data, error } = await sb.rpc("save_fitness_measure", { p_user_id: userId, p_kind: kind, p_value: value });
  if (error) throw error;
  return data as { kind: MeasureKind; value: number; source: "coach" | "me"; measured_on: string };
};
