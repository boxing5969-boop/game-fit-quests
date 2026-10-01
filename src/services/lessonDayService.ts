/**
 * 📋 레벨별 일차 수업 매뉴얼 — 읽기 전용 (2026-09-30 대표님).
 *
 * level_lesson_days: 로그인한 누구나 활성 행을 읽는다 (쓰기는 본사만 — RLS).
 * get_lesson_today:  서버가 출석(얼굴 인식·QR)으로 오늘(또는 다음) 수업이 몇 일차인지 계산한다.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeDay,
  normalizeToday,
  type LessonDay,
  type LessonToday,
} from "@/lib/lessonDays";

const DAY_COLS = "id, level, day_in_level, day_no, title, goal, repeat_of_day, steps, note";

export async function fetchLessonDays(): Promise<LessonDay[]> {
  // 새 표라 생성된 타입에 아직 없다 — 결과는 normalizeDay 가 모양을 검사한다
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("level_lesson_days")
    .select(DAY_COLS)
    .eq("is_active", true)
    .order("day_no", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map(normalizeDay)
    .filter((d): d is LessonDay => d !== null);
}

export async function fetchLessonToday(): Promise<LessonToday | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_lesson_today", {});
  if (error) throw error;
  return normalizeToday(data);
}
