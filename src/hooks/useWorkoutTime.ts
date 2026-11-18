/**
 * 운동시간 훅. 쿼리키 루트를 한 곳에 두고 파생키를 만든다(캐시 오염 방지).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_WORKOUT_TODAY,
  finishWorkoutSession,
  fixMyWorkoutEnd,
  getMyWorkoutFix,
  getMyWorkoutToday,
  getWorkoutTimeRanking,
} from "@/services/workoutTimeService";
import { parseWorkoutFix } from "@/lib/workoutFix";

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

/** 운동 끝 기록이 바뀌면(종료 버튼 · 시간 고치기) 같이 새로 읽을 것 */
function useWorkoutChanged() {
  const qc = useQueryClient();
  const { refreshProgress } = useAuth();
  return () => {
    // 레벨·XP 의 실제 저장소는 AuthContext.progress — ["member-progress"] 키는 구독자가 없다.
    void refreshProgress();
    qc.invalidateQueries({ queryKey: WORKOUT_TIME_KEY });
    // XP 가 올라가므로 지갑·진행도 화면도 같이 새로 물어본다.
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["member-progress"] });
    // 운동시간이 길면 승급 진행도(최대 1.25회)도 바뀐다 — 홈 카드 막대 갱신
    qc.invalidateQueries({ queryKey: ["level-cycle"] });
    // 운동 시간 합계(홈 '내 운동 시간' · 내정보 · 운동 기록 전체)도 그날 시간이 바뀐다 (2026-10-22)
    qc.invalidateQueries({ queryKey: ["153attendance"] });
  };
}

export function useFinishWorkout() {
  const changed = useWorkoutChanged();
  return useMutation({
    mutationFn: (atGym: boolean | null) => finishWorkoutSession(atGym),
    onSuccess: changed,
  });
}

/**
 * 고칠 수 있는 운동 기록(오늘 · 어제 · 끝 기록 없음) — 2026-11-19 회원 제안 「운동한 시간을 수정할 수 있었으면」.
 * 같은 WORKOUT_TIME_KEY 아래라 종료 버튼 · 고치기 뒤에 함께 새로 읽힌다. 함수가 없는 DB 면 빈 목록.
 */
export function useMyWorkoutFix(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...WORKOUT_TIME_KEY, "fix", user?.id ?? "anon"],
    queryFn: async () => parseWorkoutFix(await getMyWorkoutFix()),
    enabled: enabled && !!user?.id,
    staleTime: 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useFixWorkout() {
  const changed = useWorkoutChanged();
  return useMutation({
    mutationFn: ({ day, minutes }: { day: string; minutes: number }) => fixMyWorkoutEnd(day, minutes),
    // 실패(이미 끝 기록이 있음 등)여도 목록이 달라졌을 수 있어 다시 읽는다
    onSettled: changed,
  });
}
