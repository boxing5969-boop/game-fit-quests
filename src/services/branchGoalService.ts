/**
 * 우리 지점 목표 만들기 · 지점장·코치 권한 (2026-10-18 대표님:
 *   "우리지점 목표도 내가 설정할수있게 해줘 그리고 지점장이나 코치에게 내가 관리할수있는 권한을 주는 기능 넣자.")
 *
 * 서버: supabase/migrations/20261018130000_branch_goals_staff_perms.sql
 *   · get_branch_gym_raids  — 지점 목표 + 내가 열고 끝낼 수 있는지(can_manage) + (전체관리자·관리자) 고를 수 있는 지점
 *   · create_gym_raid · end_gym_raid — 전체관리자·관리자는 켜 둔 지점 어디든, 지점장·코치는 권한을 받으면 자기 지점
 *   · list_staff_permissions · set_staff_permission — 커뮤니티 모든 글 보기 · 우리 지점 목표 만들기 (전체관리자·관리자만)
 * 서버가 한국어로 보낸 안내는 그대로 보여 준다.
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { GymRaidRow } from "@/services/boxingEngagementService";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any).rpc(name, args)) as SbResult<T>;
  if (error) {
    const msg = error.message ?? "";
    throw new Error(/[가-힣]/.test(msg) ? msg : translateError(error));
  }
  return data as T;
}

/* ══════════ 우리 지점 목표 ══════════ */

/** 앱에서 열 수 있는 목표 종류 — contribute_to_gym_raid 가 실제로 세는 4가지 */
export type GoalRaidType = "cheer_sent" | "journal_write" | "quiz_correct" | "challenge_clear";
export const GOAL_TYPES: readonly GoalRaidType[] = ["cheer_sent", "journal_write", "quiz_correct", "challenge_clear"];
export const GOAL_TYPE_LABEL: Record<GoalRaidType, string> = {
  cheer_sent: "응원 보내기",
  journal_write: "오늘 운동 한 줄",
  quiz_correct: "복싱 IQ 퀴즈 정답",
  challenge_clear: "챌린지 완료",
};
/** 목표 이름 예시 (입력 칸 안내) */
export const GOAL_TITLE_EXAMPLE: Record<GoalRaidType, string> = {
  cheer_sent: "예: 서로 응원 150",
  journal_write: "예: 오늘 운동 한 줄 100개",
  quiz_correct: "예: 복싱 IQ 퀴즈 200문제",
  challenge_clear: "예: 챌린지 50번 완료",
};

export interface BranchRaid extends GymRaidRow {
  /** 앱에서 목표를 연 사람 (예전에 넣은 목표는 비어 있다) */
  created_by_name?: string | null;
}

export interface BranchRaidsResult {
  success: boolean;
  branch: string | null;
  /** 내가 이 지점 목표를 열고 끝낼 수 있나 */
  can_manage: boolean;
  /** 전체관리자·관리자만 — 목표를 볼·만들 지점 (켜 둔 지점) */
  branches: string[];
  raids: BranchRaid[];
}

export const getBranchGymRaids = (branch?: string | null) =>
  rpc<BranchRaidsResult>("get_branch_gym_raids", { p_branch: branch ?? null });

export interface CreateGoalInput {
  branch: string | null;
  title: string;
  description: string | null;
  raidType: GoalRaidType;
  target: number;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  rewardGems: number;
  rewardXp: number;
  rewardRespect: number;
}

export const createGymRaid = (i: CreateGoalInput) =>
  rpc<{ success: boolean; raid_id: string; branch: string }>("create_gym_raid", {
    p_branch: i.branch,
    p_title: i.title,
    p_description: i.description,
    p_raid_type: i.raidType,
    p_target: i.target,
    p_start: i.start,
    p_end: i.end,
    p_reward_gems: i.rewardGems,
    p_reward_xp: i.rewardXp,
    p_reward_respect: i.rewardRespect,
  });

export const endGymRaid = (raidId: string) => rpc<{ success: boolean }>("end_gym_raid", { p_raid_id: raidId });

/* ══════════ 지점장·코치 권한 ══════════ */

export type StaffPerm = "community_view" | "branch_goal";
export const STAFF_PERMS: readonly StaffPerm[] = ["community_view", "branch_goal"];
export const STAFF_PERM_LABEL: Record<StaffPerm, string> = {
  community_view: "커뮤니티 모든 글 보기",
  branch_goal: "우리 지점 목표 만들기",
};

export interface StaffPermRow {
  user_id: string;
  name: string;
  title: string;
  branch: string | null;
  avatar_url: string | null;
  community_view: boolean;
  community_view_at: string | null;
  branch_goal: boolean;
  branch_goal_at: string | null;
}

export const listStaffPermissions = () => rpc<{ staff: StaffPermRow[] }>("list_staff_permissions");

export const setStaffPermission = (userId: string, perm: StaffPerm, on: boolean) =>
  rpc<{ success: boolean; perm: StaffPerm; granted: boolean }>("set_staff_permission", {
    p_user_id: userId,
    p_perm: perm,
    p_on: on,
  });
