/**
 * 153 다이어트 — 연령/트랙 순수 헬퍼.
 *
 * 서버 RPC `resolve_diet_track` 과 동일 로직을 클라이언트에서 빠르게
 * 재현하기 위한 pure 함수들. UI 분기와 검증용으로만 사용하고, 최종
 * 저장/강제는 반드시 서버 RPC 경유 (규칙 5·6 안전장치).
 *
 * profiles.birth_date 는 text 타입이라 format 이 다양할 수 있으므로
 * 가능한 포맷을 안전하게 파싱하고 실패 시 null 반환.
 */

import type { Database } from "@/integrations/supabase/types";

export type DietTrack = Database["public"]["Enums"]["diet_track"];
export type DietStage = Database["public"]["Enums"]["diet_stage"];
export type DietEnrollmentStatus =
  Database["public"]["Enums"]["diet_enrollment_status"];
export type DietLogStatus = Database["public"]["Enums"]["diet_log_status"];
export type DietMealSlot = Database["public"]["Enums"]["diet_meal_slot"];
export type DietAgeGroup = Database["public"]["Enums"]["diet_age_group"];
export type DietCoachNoteTemplate =
  Database["public"]["Enums"]["diet_coach_note_template"];

export const TEEN_AGE_THRESHOLD = 18;

/**
 * 다양한 text 포맷의 생년월일을 Date 로 안전 파싱.
 * 실패 시 null. 예: "1990-05-15", "1990/5/15", "19900515".
 */
export function parseBirthDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD / YYYY/MM/DD
  const m1 = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m1) {
    const d = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // YYYYMMDD
  const m2 = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // ISO fallback
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** 만 나이 (로컬 시간 기준). 실패 시 null. */
export function computeAge(
  birthDate: string | null | undefined,
  today: Date = new Date(),
): number | null {
  const d = parseBirthDate(birthDate);
  if (!d) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age < 0 ? null : age;
}

/** 나이 기준 트랙 결정. 18세 미만 youth_habit, 이상 adult_standard. 생년월일 없음 → null. */
export function resolveTrackFromAge(age: number | null): DietTrack | null {
  if (age === null) return null;
  if (age < TEEN_AGE_THRESHOLD) return "youth_habit";
  return "adult_standard";
}

/** birth_date text 로 바로 트랙 결정. */
export function resolveTrackFromBirthDate(
  birthDate: string | null | undefined,
): DietTrack | null {
  return resolveTrackFromAge(computeAge(birthDate));
}

/** 청소년 여부 (안전 기본값: 생년월일 없음 = false 이지만 UI 에서 입력 유도 필요). */
export function isYouthTrack(track: DietTrack | null): boolean {
  return track === "youth_habit";
}

/** 청소년 트랙에서 advanced 기능이 허용되는지 (항상 false). */
export function canEnableAdvanced(track: DietTrack | null): boolean {
  return track === "adult_advanced_hidden" || track === "adult_standard";
}

/** day_number(1..21) → 스테이지. 범위 밖은 null. */
export function stageForDay(dayNumber: number): DietStage | null {
  if (dayNumber < 1 || dayNumber > 21) return null;
  if (dayNumber <= 7) return "reset";
  if (dayNumber <= 14) return "burning";
  return "lifestyle";
}

/** 어느 주(1·2·3)에 속하는지. */
export function weekIndexForDay(dayNumber: number): 1 | 2 | 3 | null {
  if (dayNumber < 1 || dayNumber > 21) return null;
  if (dayNumber <= 7) return 1;
  if (dayNumber <= 14) return 2;
  return 3;
}

/** 승인된 일수 / 21 × 100. 0~100 정수. */
export function completionRate(approvedDays: number): number {
  return Math.max(0, Math.min(100, Math.round((approvedDays / 21) * 100)));
}
