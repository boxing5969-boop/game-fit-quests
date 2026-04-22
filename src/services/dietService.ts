/**
 * 153 다이어트 — Service Layer (RPC/Storage 래퍼).
 *
 * 이 모듈은 React 를 import 하지 않는 pure 함수만 내보냅니다. 훅
 * (useDietEnrollment 등) 은 Stage 3~ 에서 이 서비스 함수를 호출합니다.
 * 이렇게 분리하면:
 *   • 유닛 테스트가 단순해짐 (React 렌더 컨텍스트 없이 테스트 가능)
 *   • SSR/edge function/스크립트에서도 동일 코드 재사용 가능
 *   • 에러 핸들링과 RPC 호출 규약이 한곳에 집중됨
 *
 * 모든 쓰기는 서버 SECURITY DEFINER RPC 만 호출합니다. 직접 INSERT/UPDATE
 * 는 지양 (RLS 경로보다 RPC 내부 검증이 풍부해서).
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DietTrack = Database["public"]["Enums"]["diet_track"];
type DietLogStatus = Database["public"]["Enums"]["diet_log_status"];
type DietMealSlot = Database["public"]["Enums"]["diet_meal_slot"];
type DietEnrollmentStatus =
  Database["public"]["Enums"]["diet_enrollment_status"];
type DietCoachNoteTemplate =
  Database["public"]["Enums"]["diet_coach_note_template"];

export type DietEnrollmentRow =
  Database["public"]["Tables"]["diet_program_enrollments"]["Row"];
export type DietDailyLogRow =
  Database["public"]["Tables"]["diet_daily_logs"]["Row"];
export type DietDailyLogPhotoRow =
  Database["public"]["Tables"]["diet_daily_log_photos"]["Row"];
export type DietSafetyScreeningRow =
  Database["public"]["Tables"]["diet_safety_screenings"]["Row"];
export type DietCoachNoteRow =
  Database["public"]["Tables"]["diet_coach_notes"]["Row"];
export type DietWeeklyReviewRow =
  Database["public"]["Tables"]["diet_weekly_reviews"]["Row"];
export type DietProgressSnapshotRow =
  Database["public"]["Tables"]["diet_progress_snapshots"]["Row"];

// ──────────────────────────────────────────────────────────────────
// 공통 응답 형식
// ──────────────────────────────────────────────────────────────────
export type DietRpcOk<T> = { success: true } & T;
export type DietRpcErr = { success: false; error: string };
export type DietRpcResult<T> = DietRpcOk<T> | DietRpcErr;

const ok = <T>(data: T): DietRpcOk<T> => ({ success: true, ...data });
const err = (error: string): DietRpcErr => ({ success: false, error });

const asJsonRpc = <T>(data: unknown): DietRpcResult<T> => {
  if (!data || typeof data !== "object") return err("unexpected_response");
  return data as DietRpcResult<T>;
};

// ──────────────────────────────────────────────────────────────────
// 1. 동의 / Screening
// ──────────────────────────────────────────────────────────────────
export async function recordSafetyScreening(input: {
  pregnancyBreastfeeding: boolean;
  diabetesMedication: boolean;
  eatingDisorderRisk: boolean;
  otherConditions: string | null;
  consentAccepted: boolean;
  consentVersion: number;
}): Promise<DietRpcResult<{ screening_id: string; is_youth: boolean }>> {
  const { data, error } = await supabase.rpc("record_diet_safety_screening", {
    _pregnancy_breastfeeding: input.pregnancyBreastfeeding,
    _diabetes_medication: input.diabetesMedication,
    _eating_disorder_risk: input.eatingDisorderRisk,
    _other_conditions: input.otherConditions,
    _consent_accepted: input.consentAccepted,
    _consent_version: input.consentVersion,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 2. Enrollment
// ──────────────────────────────────────────────────────────────────
export async function enrollDietProgram(input: {
  screeningId: string;
  coachAssignedId?: string | null;
}): Promise<
  DietRpcResult<{ enrollment_id: string; track: DietTrack }>
> {
  const { data, error } = await supabase.rpc("enroll_diet_program", {
    _screening_id: input.screeningId,
    _coach_assigned_id: input.coachAssignedId ?? null,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

export async function updateEnrollmentStatus(input: {
  enrollmentId: string;
  nextStatus: DietEnrollmentStatus;
}): Promise<DietRpcResult<{ status: DietEnrollmentStatus }>> {
  const { data, error } = await supabase.rpc("update_diet_enrollment_status", {
    _enrollment_id: input.enrollmentId,
    _next_status: input.nextStatus,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 3. 일일 로그
// ──────────────────────────────────────────────────────────────────
export interface DailyHabitsPayload {
  water_ml?: number | null;
  step_count?: number | null;
  sleep_hours?: number | null;
  protein_first?: boolean | null;
  veggies_natural?: boolean | null;
  sugary_drink_avoided?: boolean | null;
  late_night_snack_avoided?: boolean | null;
  gym_attended?: boolean | null;
  mood?: string | null;
  memo?: string | null;
}

export async function submitDailyLog(input: {
  logDate: string; // YYYY-MM-DD
  habits: DailyHabitsPayload;
  note?: string | null;
}): Promise<DietRpcResult<{ log_id: string; day_number: number }>> {
  const { data, error } = await supabase.rpc("submit_diet_daily_log", {
    _log_date: input.logDate,
    _habits: input.habits as unknown as Database["public"]["Tables"]["diet_daily_logs"]["Row"] extends infer _ ? never : never,
    _note: input.note ?? null,
  } as unknown as {
    _log_date: string;
    _habits: DailyHabitsPayload;
    _note?: string | null;
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

export async function addLogPhoto(input: {
  logId: string;
  storagePath: string;
  mealSlot: DietMealSlot;
}): Promise<DietRpcResult<{ photo_id: string }>> {
  const { data, error } = await supabase.rpc("add_diet_log_photo", {
    _log_id: input.logId,
    _storage_path: input.storagePath,
    _meal_slot: input.mealSlot,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 4. Storage: 식사 사진 업로드
// ──────────────────────────────────────────────────────────────────
const DIET_PHOTOS_BUCKET = "diet-photos";

/**
 * 사진을 diet-photos 버킷에 업로드하고 storage_path 반환.
 * 이후 `addLogPhoto` 로 log 에 연결해야 함.
 *
 * 경로 규약: {userId}/{yyyy-mm-dd}/{mealSlot}-{timestamp}.{ext}
 */
export async function uploadDietPhoto(input: {
  userId: string;
  blob: Blob | File;
  logDate: string; // YYYY-MM-DD
  mealSlot: DietMealSlot;
  extension?: string; // jpg 기본
}): Promise<DietRpcResult<{ path: string }>> {
  const ext = input.extension ?? "jpg";
  const path = `${input.userId}/${input.logDate}/${input.mealSlot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(DIET_PHOTOS_BUCKET)
    .upload(path, input.blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });
  if (error) return err(error.message);
  return ok({ path });
}

/** 서명된 읽기 URL (60초 기본). */
export async function getDietPhotoSignedUrl(
  path: string,
  expiresSec = 60,
): Promise<DietRpcResult<{ url: string }>> {
  const { data, error } = await supabase.storage
    .from(DIET_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresSec);
  if (error) return err(error.message);
  if (!data?.signedUrl) return err("no_signed_url");
  return ok({ url: data.signedUrl });
}

// ──────────────────────────────────────────────────────────────────
// 5. 코치 리뷰 / 노트
// ──────────────────────────────────────────────────────────────────
export async function reviewDailyLog(input: {
  logId: string;
  action: DietLogStatus;
  feedback?: string | null;
}): Promise<
  DietRpcResult<{
    action: DietLogStatus;
    granted_gems: number;
    approved_days_total?: number;
    milestones_newly_reached?: { m7: boolean; m14: boolean; m21: boolean };
  }>
> {
  const { data, error } = await supabase.rpc("review_diet_log", {
    _log_id: input.logId,
    _action: input.action,
    _feedback: input.feedback ?? null,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

export async function createCoachNote(input: {
  enrollmentId: string;
  noteText: string;
  templateType?: DietCoachNoteTemplate;
  visibility?: "private" | "member_visible";
  relatedLogId?: string | null;
}): Promise<DietRpcResult<{ note_id: string }>> {
  const { data, error } = await supabase.rpc("create_diet_coach_note", {
    _enrollment_id: input.enrollmentId,
    _note_text: input.noteText,
    _template_type: input.templateType ?? "general",
    _visibility: input.visibility ?? "member_visible",
    _related_log_id: input.relatedLogId ?? null,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 6. 주간 리뷰
// ──────────────────────────────────────────────────────────────────
export async function submitWeeklyReview(input: {
  enrollmentId: string;
  weekIndex: 1 | 2 | 3;
  waistCm?: number | null;
  bodyPhotoUrl?: string | null;
  reflection?: string | null;
  nextWeekFocus?: string | null;
}): Promise<DietRpcResult<Record<string, never>>> {
  const { data, error } = await supabase.rpc("submit_diet_weekly_review", {
    _enrollment_id: input.enrollmentId,
    _week_index: input.weekIndex,
    _waist_cm: input.waistCm ?? null,
    _body_photo_url: input.bodyPhotoUrl ?? null,
    _reflection: input.reflection ?? null,
    _next_week_focus: input.nextWeekFocus ?? null,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

// ──────────────────────────────────────────────────────────────────
// 7. 진척도 / 랭킹
// ──────────────────────────────────────────────────────────────────
export interface DietProgressPayload {
  has_active: boolean;
  enrollment?: {
    id: string;
    track: DietTrack;
    start_date: string;
    current_day: number;
    current_stage: Database["public"]["Enums"]["diet_stage"];
    status: DietEnrollmentStatus;
    advanced_feature_enabled: boolean;
  };
  snapshot?: DietProgressSnapshotRow;
  pending_days?: number;
}

export async function getProgress(
  userId?: string,
): Promise<DietRpcResult<DietProgressPayload>> {
  const { data, error } = await supabase.rpc("get_diet_progress", {
    _user_id: userId ?? null,
  });
  if (error) return err(error.message);
  return asJsonRpc(data);
}

export async function getBranchRanking(input: {
  branchName: string;
  limit?: number;
}) {
  const { data, error } = await supabase.rpc("get_diet_ranking", {
    _branch_name: input.branchName,
    _limit: input.limit ?? 50,
  });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, rows: data ?? [] };
}

// ──────────────────────────────────────────────────────────────────
// 8. 읽기 전용 조회 헬퍼 (RLS 경로)
// ──────────────────────────────────────────────────────────────────
export async function fetchMyActiveEnrollment(): Promise<DietEnrollmentRow | null> {
  const { data, error } = await supabase
    .from("diet_program_enrollments")
    .select("*")
    .in("status", ["active", "not_started", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchDailyLog(
  enrollmentId: string,
  logDate: string,
): Promise<DietDailyLogRow | null> {
  const { data, error } = await supabase
    .from("diet_daily_logs")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .eq("log_date", logDate)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchLogPhotos(
  logId: string,
): Promise<DietDailyLogPhotoRow[]> {
  const { data, error } = await supabase
    .from("diet_daily_log_photos")
    .select("*")
    .eq("log_id", logId)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingLogsForCoach(limit = 20) {
  const { data, error } = await supabase
    .from("diet_daily_logs")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// 9. 통합 레이어 (분석 이벤트 / 환경설정)
// ──────────────────────────────────────────────────────────────────

/** 분석 이벤트 기록 — best-effort. 실패해도 UX 차단 금지 (조용히 무시). */
export async function logDietEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("log_diet_event", {
      _event_type: eventType,
      _event_data: eventData as unknown as never,
    } as unknown as {
      _event_type: string;
      _event_data?: Record<string, unknown>;
    });
    return !error;
  } catch {
    return false;
  }
}

/** 설정 조회. 실패 시 빈 객체 반환 — 클라이언트가 기본값으로 머지. */
export async function fetchDietPreferences(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("get_diet_preferences");
  if (error) return {};
  const payload = (data ?? {}) as { success?: boolean; settings?: unknown };
  if (!payload.success) return {};
  return (payload.settings as Record<string, unknown>) ?? {};
}

/** 설정 upsert. 성공 여부만 반환. */
export async function saveDietPreferences(
  settings: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.rpc("upsert_diet_preferences", {
    _settings: settings as unknown as never,
  } as unknown as {
    _settings: Record<string, unknown>;
  });
  return !error;
}
