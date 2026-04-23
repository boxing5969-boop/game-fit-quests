/**
 * 153 다이어트 · 21일 종료 후 경로(유지/연장) 서비스 레이어.
 *
 * 마이그레이션 `20260430000000_diet_post_program.sql` 의 RPC 를 래핑.
 * 자동 생성 타입(types.ts) 이 아직 반영되기 전에도 동작하도록
 * `supabase.rpc` 호출은 `as any` 로 type-escape 하되, 반환은 내부 타입으로 정규화.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DietPostProgramCheckin,
  DietPostProgramPath,
  DietPostProgramPlan,
  DietPostProgramRecommendation,
} from "@/lib/diet/postProgramTypes";

export type PostProgramRpcOk<T> = { success: true } & T;
export type PostProgramRpcErr = { success: false; error: string };
export type PostProgramRpcResult<T> = PostProgramRpcOk<T> | PostProgramRpcErr;

const ok = <T>(data: T): PostProgramRpcOk<T> => ({ success: true, ...data });
const err = (error: string): PostProgramRpcErr => ({ success: false, error });

const asRpc = <T>(data: unknown): PostProgramRpcResult<T> => {
  if (!data || typeof data !== "object") return err("unexpected_response");
  return data as PostProgramRpcResult<T>;
};

// ──────────────────────────────────────────────────────────────────
// 1. 21일 완료 후 plan 레코드 ensure
// ──────────────────────────────────────────────────────────────────
export async function ensurePostProgramPlan(
  enrollmentId: string,
): Promise<
  PostProgramRpcResult<{
    plan_id: string;
    summary: Record<string, unknown>;
    recommended_path: DietPostProgramRecommendation;
    selected_path: DietPostProgramPath;
    created: boolean;
  }>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("ensure_post_program_plan", {
    _enrollment_id: enrollmentId,
  });
  if (error) return err(error.message);
  return asRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 2. 경로 선택 (회원)
// ──────────────────────────────────────────────────────────────────
export interface SelectPathInput {
  planId: string;
  path: Exclude<DietPostProgramPath, "pending">;
  targetAchieved?: boolean | null;
  maintenanceTargetWeightKg?: number | null;
  maintenanceTargetWaistCm?: number | null;
  extensionCycleLength?: 14 | 21;
}

export async function selectPostProgramPath(input: SelectPathInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("select_post_program_path", {
    _plan_id: input.planId,
    _path: input.path,
    _target_achieved: input.targetAchieved ?? null,
    _maintenance_target_weight_kg: input.maintenanceTargetWeightKg ?? null,
    _maintenance_target_waist_cm: input.maintenanceTargetWaistCm ?? null,
    _extension_cycle_length: input.extensionCycleLength ?? 14,
  });
  if (error) return err(error.message);
  return asRpc<{ plan_id: string; selected_path: DietPostProgramPath }>(data);
}

// ──────────────────────────────────────────────────────────────────
// 3. 주간 체크인 (유지/연장 공용)
// ──────────────────────────────────────────────────────────────────
export interface PostCheckinInput {
  planId: string;
  weekIndex: number;
  weightKg?: number | null;
  waistCm?: number | null;
  adherenceScore?: number | null;
  flexibleMealsCount?: number;
  lateBingeCount?: number;
  attendedWorkouts?: number;
  proteinFirstDays?: number;
  reflection?: string | null;
}

export async function submitPostProgramCheckin(input: PostCheckinInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("submit_post_program_checkin", {
    _plan_id: input.planId,
    _week_index: input.weekIndex,
    _weight_kg: input.weightKg ?? null,
    _waist_cm: input.waistCm ?? null,
    _adherence_score: input.adherenceScore ?? null,
    _flexible_meals_count: input.flexibleMealsCount ?? 0,
    _late_binge_count: input.lateBingeCount ?? 0,
    _attended_workouts: input.attendedWorkouts ?? 0,
    _protein_first_days: input.proteinFirstDays ?? 0,
    _reflection: input.reflection ?? null,
  });
  if (error) return err(error.message);
  return asRpc<{
    checkin_id: string;
    needs_recovery: boolean;
    recovery_reason: string | null;
  }>(data);
}

// ──────────────────────────────────────────────────────────────────
// 4. plan + 체크인 조회
// ──────────────────────────────────────────────────────────────────
export interface PostProgramPayload {
  has_plan: boolean;
  plan?: DietPostProgramPlan;
  checkins?: DietPostProgramCheckin[];
}

export async function getPostProgramPlan(
  userId?: string,
): Promise<PostProgramRpcResult<PostProgramPayload>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_post_program_plan", {
    _user_id: userId ?? null,
  });
  if (error) return err(error.message);
  return asRpc<PostProgramPayload>(data);
}

// ──────────────────────────────────────────────────────────────────
// 5. 코치 — 권장 경로/문구 저장
// ──────────────────────────────────────────────────────────────────
export async function coachRecommendPath(input: {
  planId: string;
  path: DietPostProgramRecommendation;
  note?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("coach_recommend_post_program_path", {
    _plan_id: input.planId,
    _path: input.path,
    _note: input.note ?? null,
  });
  if (error) return err(error.message);
  return asRpc<Record<string, never>>(data);
}

// ──────────────────────────────────────────────────────────────────
// 6. 코치 — 완주 회원 목록 + 경로별 필터
// ──────────────────────────────────────────────────────────────────
export interface CoachPostProgramRow {
  plan_id: string;
  user_id: string;
  member_name: string;
  branch_name: string;
  recommended_path: DietPostProgramRecommendation;
  selected_path: DietPostProgramPath;
  follow_up_status: string;
  coach_recommended_path: DietPostProgramRecommendation | null;
  completion_summary: Record<string, unknown>;
  finished_at: string | null;
}

export async function coachListPostProgramMembers(
  filter: "all" | "pending" | "maintenance" | "extend" = "all",
): Promise<PostProgramRpcResult<{ rows: CoachPostProgramRow[] }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("coach_list_post_program_members", {
    _filter: filter,
  });
  if (error) return err(error.message);
  return asRpc<{ rows: CoachPostProgramRow[] }>(data);
}

// ok() helper 은 다른 파일에서 재사용되지 않아 미사용 경고 방지
void ok;
