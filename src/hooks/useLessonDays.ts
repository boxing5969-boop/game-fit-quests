/**
 * 📋 일차별 수업 매뉴얼 훅 — 쿼리키는 모두 ["lesson-days"] / ["lesson-today", userId].
 *
 * 매뉴얼은 거의 안 바뀌어서 10분 캐시. 오늘 몇 일차인지는 체육관 입구 얼굴 인식(앱 밖)으로 바뀌므로
 * 화면에 들어올 때마다 다시 묻는다(staleTime 30초 + 마운트 시 재조회).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLessonDays, fetchLessonToday } from "@/services/lessonDayService";
import { indexByDayNo } from "@/lib/lessonDays";

export const LESSON_DAYS_KEY = ["lesson-days"] as const;
export const LESSON_TODAY_KEY = ["lesson-today"] as const;

export function useLessonDays(enabled = true) {
  const q = useQuery({
    queryKey: LESSON_DAYS_KEY,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: fetchLessonDays,
  });
  const days = q.data;
  const byDayNo = useMemo(() => indexByDayNo(days ?? []), [days]);
  return { ...q, byDayNo };
}

export function useLessonToday(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...LESSON_TODAY_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    refetchOnMount: "always",
    queryFn: fetchLessonToday,
  });
}
