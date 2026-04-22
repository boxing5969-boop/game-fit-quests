import { useQuery } from "@tanstack/react-query";
import { hasAttendanceOn } from "@/lib/diet/attendanceBridge";

/**
 * 153 다이어트 — 오늘 체육관 출석 여부.
 *
 * `attendance_logs` 에 오늘 기록이 있으면 true.
 * Tracker UI 에서 `gym_attended` 초기값 자동 반영용.
 * 수동 토글은 그대로 허용 (사용자가 off 로 바꿀 수 있음).
 */
export function useAttendanceToday(
  userId: string | undefined,
  logDate: string,
) {
  return useQuery({
    queryKey: ["diet", "attendance", userId, logDate],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => (userId ? hasAttendanceOn(userId, logDate) : false),
  });
}
