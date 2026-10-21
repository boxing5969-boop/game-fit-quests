/**
 * 📅 출석 기록 전체 — get_attendance_history (lib/attendanceHistory)
 *   userId 를 비우면 나, 넣으면 그 회원 (서버가 관리자 · 같은 지점 지점장만 허락).
 *   캐시 키 "153attendance" — 내정보 카드(useAttendanceStats)와 같은 접두어라 같이 새로 읽힌다.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAttendanceHistory, type AttendanceHistory } from "@/lib/attendanceHistory";
import { translateError } from "@/lib/errorMessages";

export function useAttendanceHistory(userId?: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<AttendanceHistory>({
    queryKey: ["153attendance", "history", userId ?? "me", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_attendance_history", { p_user_id: userId ?? null });
      if (error) throw new Error(translateError(error));
      return normalizeAttendanceHistory(data);
    },
  });
}
