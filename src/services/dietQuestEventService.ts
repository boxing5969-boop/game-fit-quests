/**
 * 153 다이어트 — diet_quest_events 테이블 서비스 레이어.
 *
 * 마이그레이션 20260506000000_add_diet_quest_events.sql 의 테이블 래퍼.
 *
 * RLS:
 *   · INSERT — 본인만
 *   · SELECT/UPDATE — 본인 + 매니저 + super_admin
 *
 * 타입 주의:
 *   types.ts(자동 생성) 에 아직 diet_quest_events 가 없을 수 있어 from() 호출은 cast 사용.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  QuestSourceKind,
  TimingGrade,
} from "@/lib/diet/questEvents";

// ──────────────────────────────────────────────────────────────────
// Types — DB row shape (마이그레이션과 1:1)
// ──────────────────────────────────────────────────────────────────

export interface DietQuestEventRow {
  id: string;
  user_id: string;
  enrollment_id: string;
  log_date: string;
  day_number: number;
  mission_id: string;
  mission_label: string;
  source_kind: QuestSourceKind;
  meal_slot: string | null;
  completed_at: string;
  timing_grade: TimingGrade;
  base_score: number;
  timing_bonus: number;
  total_score: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface RecordQuestEventInput {
  userId: string;
  enrollmentId: string;
  logDate: string; // YYYY-MM-DD
  dayNumber: number;
  missionId: string;
  missionLabel: string;
  sourceKind: QuestSourceKind;
  mealSlot?: string | null;
  completedAt?: Date;
  timingGrade: TimingGrade;
  baseScore: number;
  timingBonus: number;
  totalScore: number;
  meta?: Record<string, unknown>;
}

export interface ServiceErr {
  success: false;
  error: string;
}
export type ServiceOk<T> = { success: true } & T;
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

const err = (e: string): ServiceErr => ({ success: false, error: e });

// types.ts 갱신 전까지 from() cast — 향후 npm run gen-types 시 제거.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ──────────────────────────────────────────────────────────────────
// INSERT
// ──────────────────────────────────────────────────────────────────

export async function recordQuestEvent(
  input: RecordQuestEventInput,
): Promise<ServiceResult<{ event: DietQuestEventRow }>> {
  const { data, error } = await sb
    .from("diet_quest_events")
    .insert({
      user_id: input.userId,
      enrollment_id: input.enrollmentId,
      log_date: input.logDate,
      day_number: input.dayNumber,
      mission_id: input.missionId,
      mission_label: input.missionLabel,
      source_kind: input.sourceKind,
      meal_slot: input.mealSlot ?? null,
      completed_at: (input.completedAt ?? new Date()).toISOString(),
      timing_grade: input.timingGrade,
      base_score: input.baseScore,
      timing_bonus: input.timingBonus,
      total_score: input.totalScore,
      meta: input.meta ?? {},
    })
    .select("*")
    .single();

  if (error) return err(error.message);
  return { success: true, event: data as DietQuestEventRow };
}

// ──────────────────────────────────────────────────────────────────
// SELECT — 일자별
// ──────────────────────────────────────────────────────────────────

export async function listQuestEventsForDay(
  enrollmentId: string,
  logDate: string,
): Promise<ServiceResult<{ events: DietQuestEventRow[] }>> {
  const { data, error } = await sb
    .from("diet_quest_events")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .eq("log_date", logDate)
    .order("completed_at", { ascending: true });

  if (error) return err(error.message);
  return { success: true, events: (data ?? []) as DietQuestEventRow[] };
}

// ──────────────────────────────────────────────────────────────────
// SELECT — enrollment 전체 (21일 누적용)
// ──────────────────────────────────────────────────────────────────

export async function listQuestEventsForEnrollment(
  enrollmentId: string,
): Promise<ServiceResult<{ events: DietQuestEventRow[] }>> {
  const { data, error } = await sb
    .from("diet_quest_events")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .order("log_date", { ascending: true })
    .order("completed_at", { ascending: true });

  if (error) return err(error.message);
  return { success: true, events: (data ?? []) as DietQuestEventRow[] };
}

// ──────────────────────────────────────────────────────────────────
// 중복 방지 — 같은 (enrollment, log_date, mission_id) 이벤트가 이미 있는지 확인
//   같은 미션을 한 날에 두 번 emit 하지 않으려는 보호용.
// ──────────────────────────────────────────────────────────────────

export async function hasQuestEvent(
  enrollmentId: string,
  logDate: string,
  missionId: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from("diet_quest_events")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("log_date", logDate)
    .eq("mission_id", missionId)
    .limit(1);

  if (error) return false; // 안전 fallback — 중복 방지 보다 emit 우선
  return Array.isArray(data) && data.length > 0;
}
