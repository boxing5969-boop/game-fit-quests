import { useCallback } from "react";
import { logDietEvent } from "@/services/dietService";
import type { DietEventType } from "@/lib/diet/analytics";

/**
 * 153 다이어트 — 분석 이벤트 전송 훅.
 *
 * 최소 래퍼 — React Query 캐시 없음. fire-and-forget.
 * 호출 실패는 조용히 무시 (UX 에 영향 주지 않음).
 */
export function useDietAnalytics() {
  const logEvent = useCallback(
    async (
      eventType: DietEventType | string,
      eventData: Record<string, unknown> = {},
    ): Promise<void> => {
      await logDietEvent(eventType, eventData);
    },
    [],
  );
  return { logEvent };
}
