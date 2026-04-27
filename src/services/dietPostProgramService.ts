/**
 * 153 다이어트 · 21일 종료 후 경로(유지/연장) 서비스 레이어.
 *
 * 마이그레이션 `20260430000000_diet_post_program.sql` 의 RPC 를 래핑.
 * 자동 생성 타입(types.ts) 이 아직 반영되기 전에도 동작하도록
 * `supabase.rpc` 호출은 `as any` 로 type-escape 하되, 반환은 내부 타입으로 정규화.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DietExtendGoals,
  DietExtendReassessment,
  DietExtendResult,
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
// 1-b. 조기 시작 — 21일 안 채우고 사후 프로그램 진입.
//      enrollment.status active → completed 강제 전환 + plan 생성. 멱등.
// ──────────────────────────────────────────────────────────────────
export async function earlyStartPostProgram(enrollmentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "early_start_post_program",
    { _enrollment_id: enrollmentId },
  );
  if (error) return err(error.message);
  return asRpc<{
    plan_id: string;
    selected_path: DietPostProgramPath;
    created: boolean;
    early_start?: boolean;
  }>(data);
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
  pattern_tags: string[] | null;
  extend_started_at: string | null;
  extend_ended_at: string | null;
  extend_result: DietExtendResult | null;
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

// ──────────────────────────────────────────────────────────────────
// 7. 연장 재평가 제출 (11단계 · fat_loss_extend_153 deep)
// ──────────────────────────────────────────────────────────────────
export interface ExtendReassessmentInput {
  planId: string;
  reassessment: DietExtendReassessment;
  extendGoals: DietExtendGoals;
  userPatternOverrides?: string[] | null;
}

export async function submitExtendReassessment(input: ExtendReassessmentInput) {
  const r = input.reassessment;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("submit_extend_reassessment", {
    _plan_id: input.planId,
    _recent_21d_adherence: Math.round(r.recent_21d_adherence),
    _weakest_habit: r.weakest_habit,
    _weekly_workouts: r.weekly_workouts,
    _sleep_hours: r.sleep_hours,
    _eating_out_weekly: r.eating_out_weekly,
    _late_binge_weekly: r.late_binge_weekly,
    _biggest_obstacle: r.biggest_obstacle,
    _extend_goals: input.extendGoals as unknown as Record<string, unknown>,
    _user_pattern_overrides: input.userPatternOverrides ?? null,
  });
  if (error) return err(error.message);
  return asRpc<{
    pattern_tags: string[];
    reassessment: DietExtendReassessment;
  }>(data);
}

// ──────────────────────────────────────────────────────────────────
// 8. 코치 — 패턴 태그 추가/제거
// ──────────────────────────────────────────────────────────────────
export async function coachTagPattern(input: {
  planId: string;
  tag: string;
  action: "add" | "remove";
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("coach_tag_pattern", {
    _plan_id: input.planId,
    _tag: input.tag,
    _action: input.action,
  });
  if (error) return err(error.message);
  return asRpc<Record<string, never>>(data);
}

// ──────────────────────────────────────────────────────────────────
// 9. 연장 사이클 종료 + 결과 선택
// ──────────────────────────────────────────────────────────────────
export async function endExtendCycle(input: {
  planId: string;
  result: DietExtendResult;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("end_extend_cycle", {
    _plan_id: input.planId,
    _result: input.result,
  });
  if (error) return err(error.message);
  return asRpc<{ result: DietExtendResult }>(data);
}

// ok() helper 은 다른 파일에서 재사용되지 않아 미사용 경고 방지
void ok;
