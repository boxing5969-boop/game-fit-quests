/**
 * 153 다이어트 · 21일 종료 후 분기(유지/연장) React Query 훅.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import * as svc from "@/services/dietPostProgramService";

const POST_KEY = ["diet", "postProgram"] as const;

// ── 조회 ──────────────────────────────────────────────────────────
export function usePostProgramPlan(targetUserId?: string) {
  const { user } = useAuth();
  const resolved = targetUserId ?? user?.id;
  return useQuery({
    queryKey: targetUserId
      ? [...POST_KEY, "member", targetUserId]
      : [...POST_KEY, "mine", resolved],
    enabled: !!resolved,
    staleTime: 30_000,
    queryFn: async () => svc.getPostProgramPlan(targetUserId),
  });
}

export function useCoachPostProgramList(
  filter: "all" | "pending" | "maintenance" | "extend" = "all",
) {
  return useQuery({
    queryKey: [...POST_KEY, "coachList", filter],
    staleTime: 30_000,
    queryFn: async () => svc.coachListPostProgramMembers(filter),
  });
}

// ── 뮤테이션 ──────────────────────────────────────────────────────
const invalidatePost = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: POST_KEY });
};

export function useEnsurePostProgramPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) => svc.ensurePostProgramPlan(enrollmentId),
    onSuccess: () => invalidatePost(qc),
  });
}

// 21일 안 채우고 조기 시작 — enrollment 강제 completed + plan 생성
export function useEarlyStartPostProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) => svc.earlyStartPostProgram(enrollmentId),
    onSuccess: () => {
      invalidatePost(qc);
      // enrollment 상태 자체가 바뀌었으므로 다이어트 진행도 / 직접 조회 fallback 도 모두 무효화
      qc.invalidateQueries({ queryKey: ["diet", "progress"] });
      qc.invalidateQueries({ queryKey: ["diet", "enrollment"] });
      qc.invalidateQueries({ queryKey: ["diet", "post-program-page-enrollment"] });
    },
  });
}

export function useSelectPostProgramPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.selectPostProgramPath,
    onSuccess: () => invalidatePost(qc),
  });
}

export function useSubmitPostProgramCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.submitPostProgramCheckin,
    onSuccess: () => invalidatePost(qc),
  });
}

export function useCoachRecommendPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.coachRecommendPath,
    onSuccess: () => invalidatePost(qc),
  });
}

// 11단계 · 연장 심화
export function useSubmitExtendReassessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.submitExtendReassessment,
    onSuccess: () => invalidatePost(qc),
  });
}

export function useCoachTagPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.coachTagPattern,
    onSuccess: () => invalidatePost(qc),
  });
}

export function useEndExtendCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.endExtendCycle,
    onSuccess: () => invalidatePost(qc),
  });
}
