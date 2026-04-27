/**
 * 153 다이어트 — diet_quest_events React Query 훅.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/dietQuestEventService";

const KEY = ["diet-quest-events"] as const;

/** 오늘(또는 임의 날짜) enrollment 의 이벤트 목록. */
export function useQuestEventsForDay(
  enrollmentId: string | undefined,
  logDate: string | undefined,
) {
  return useQuery({
    queryKey: [...KEY, "day", enrollmentId ?? "none", logDate ?? "none"],
    enabled: !!enrollmentId && !!logDate,
    staleTime: 15_000,
    queryFn: () => svc.listQuestEventsForDay(enrollmentId!, logDate!),
  });
}

/** enrollment 전체(21일) 이벤트 — 누적·시계열용. */
export function useQuestEventsForEnrollment(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "enrollment", enrollmentId ?? "none"],
    enabled: !!enrollmentId,
    staleTime: 30_000,
    queryFn: () => svc.listQuestEventsForEnrollment(enrollmentId!),
  });
}

/** 단일 이벤트 적재 mutation. 캐시 무효화는 enrollment 단위. */
export function useRecordQuestEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.recordQuestEvent,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: [...KEY, "day", variables.enrollmentId, variables.logDate],
      });
      qc.invalidateQueries({
        queryKey: [...KEY, "enrollment", variables.enrollmentId],
      });
    },
  });
}
