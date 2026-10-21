/**
 * 📅 내 출석 기록 — 내정보 '출석 기록' 카드와 출석 축하 편지(WelcomeLetter)가 같은 캐시를 쓴다.
 *   캐시 키는 "153attendance" 로 시작 — 다른 도메인 키와 겹치지 않게. 서버: get_my_attendance_stats (lib/attendanceMilestone 참고)
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAttendanceStats, type AttendanceStats } from "@/lib/attendanceMilestone";
import { translateError } from "@/lib/errorMessages";

export const ATTENDANCE_STATS_KEY = ["153attendance", "stats"] as const;

async function fetchAttendanceStats(): Promise<AttendanceStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_my_attendance_stats");
  if (error) throw new Error(translateError(error));
  return normalizeAttendanceStats(data);
}

export function useAttendanceStats(enabled = true) {
  const { user } = useAuth();
  return useQuery<AttendanceStats>({
    queryKey: [...ATTENDANCE_STATS_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: fetchAttendanceStats,
  });
}

/** 축하 편지를 닫으면 — 안 본 축하를 모두 본 것으로 (실패해도 다음 접속에 편지가 한 번 더 올 뿐) */
export function useMarkAttendanceMilestonesSeen() {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("mark_attendance_milestones_seen");
    } catch {
      /* ignore */
    }
    void qc.invalidateQueries({ queryKey: ATTENDANCE_STATS_KEY });
  }, [qc]);
}
