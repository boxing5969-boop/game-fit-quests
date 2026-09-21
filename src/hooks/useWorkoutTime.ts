/**
 * 운동시간 훅. 쿼리키 루트를 한 곳에 두고 파생키를 만든다(캐시 오염 방지).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_WORKOUT_TODAY,
  finishWorkoutSession,
  getMyWorkoutToday,
  getWorkoutTimeRanking,
} from "@/services/workoutTimeService";

export const WORKOUT_TIME_KEY = ["workout-time"] as const;

export function useMyWorkoutToday(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...WORKOUT_TIME_KEY, "today", user?.id ?? "anon"],
    queryFn: getMyWorkoutToday,
    enabled: enabled && !!user?.id,
    // 종료를 안 누른 동안 경과 시간이 흐르므로 가끔 다시 물어본다.
    // 다만 이 값은 참고용이고 확정 기록이 아니라 자주 당길 필요는 없다.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    placeholderData: EMPTY_WORKOUT_TODAY,
  });
}

export function useWorkoutTimeRanking(limit = 30, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...WORKOUT_TIME_KEY, "ranking", user?.id ?? "anon", limit],
    queryFn: () => getWorkoutTimeRanking(limit),
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (atGym: boolean | null) => finishWorkoutSession(atGym),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WORKOUT_TIME_KEY });
      // XP 가 올라가므로 지갑·진행도 화면도 같이 새로 물어본다.
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
    },
  });
}
