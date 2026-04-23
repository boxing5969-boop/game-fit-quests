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
