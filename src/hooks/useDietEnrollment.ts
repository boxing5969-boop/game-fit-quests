/**
 * 153 다이어트 — Enrollment 훅.
 *
 * `src/services/dietService.ts` 의 pure 래퍼를 React Query 로 감싸
 * 캐시·무효화·로딩 상태를 UI 에 제공한다.
 *
 * 캐시 키 규약
 *   • ["diet", "progress", userId] — 내 진척도 (getProgress)
 *   • ["diet", "progress", "member", targetUserId] — 코치 시점
 *
 * 뮤테이션 성공 시 위 두 키를 모두 invalidate 해 UI 가 최신 상태로 복구.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import * as diet from "@/services/dietService";

// ──────────────────────────────────────────────────────────────────
// 조회
// ──────────────────────────────────────────────────────────────────
export function useDietProgress(targetUserId?: string) {
  const { user } = useAuth();
  const resolved = targetUserId ?? user?.id;
  return useQuery({
    queryKey: targetUserId
      ? ["diet", "progress", "member", targetUserId]
      : ["diet", "progress", resolved],
    enabled: !!resolved,
    staleTime: 30_000,
    queryFn: async () => diet.getProgress(targetUserId),
  });
}

// ──────────────────────────────────────────────────────────────────
// 뮤테이션
// ──────────────────────────────────────────────────────────────────
const invalidateProgress = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["diet", "progress"] });
};

export function useRecordSafetyScreening() {
  return useMutation({
    mutationFn: diet.recordSafetyScreening,
  });
}

export function useEnrollDietProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: diet.enrollDietProgram,
    onSuccess: () => invalidateProgress(qc),
  });
}

export function useUpdateDietEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: diet.updateEnrollmentStatus,
    onSuccess: () => invalidateProgress(qc),
  });
}
