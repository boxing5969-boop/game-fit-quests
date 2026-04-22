/**
 * 153 다이어트 — 기존 체육관 출석(attendance_logs) 과의 어댑터.
 *
 * 원칙
 *   • 기존 `record_attendance` RPC 와 `attendance_logs` 스키마는 건드리지 않는다.
 *   • 오늘 출석 유무만 조회해 `diet_daily_logs.gym_attended` 초기값 힌트로 사용.
 *   • 조회 실패는 조용히 false (수동 토글 fallback 유지).
 */

import { supabase } from "@/integrations/supabase/client";

/** 로컬 날짜(YYYY-MM-DD) → 하루의 ISO 범위 [startOfDay, endOfDay] */
function dayRange(logDate: string): { start: string; end: string } {
  const start = new Date(`${logDate}T00:00:00`);
  const end = new Date(`${logDate}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * 해당 유저가 `logDate` 날에 이미 출석 체크인 했는지.
 * 실패 시 false (UX 중단 금지).
 */
export async function hasAttendanceOn(
  userId: string,
  logDate: string,
): Promise<boolean> {
  try {
    const { start, end } = dayRange(logDate);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("user_id", userId)
      .gte("checked_in_at", start)
      .lte("checked_in_at", end)
      .limit(1);
    if (error) return false;
    return !!data && data.length > 0;
  } catch {
    return false;
  }
}
