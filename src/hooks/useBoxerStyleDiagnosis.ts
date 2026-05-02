/**
 * 153 QUEST v1.5 17단계 — 복서 스타일 진단 hook.
 *
 * 보호 원칙 (§11-⑦):
 *   · 본 hook 의 어떤 경로도 member_progress / total_xp / current_level 을
 *     점수 함수에 전달하지 않는다.
 *   · 표시용 컨텍스트(현재 리그·레벨)는 BoxerStyleDiagnosisCard 가 별도로 읽음.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useBoxingEngagementSummary } from "@/hooks/useBoxingEngagement";
import { useMyHiddenMissionProgress } from "@/hooks/useHiddenMissions";
import {
  computeBoxerStyleDiagnosis,
  type BoxerStyleDiagnosis,
  type BoxerStyleInput,
} from "@/data/boxerStyleRules";
import {
  getRecentBoxingConditions,
  type BoxingConditionLogRow,
} from "@/services/boxingEngagementService";
import { supabase } from "@/integrations/supabase/client";

interface ChallengeAttemptLite {
  category: string;
  status: string;
}

async function fetchRecentChallengeAttempts(
  userId: string,
): Promise<ChallengeAttemptLite[]> {
  // 본인만 SELECT 허용된 RLS 정책 활용. 최근 90일 한정.
  const since = new Date();
  since.setDate(since.getDate() - 90);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("boxing_fun_challenge_attempts")
    .select(
      `id, status, created_at,
       challenge:boxing_fun_challenges(category)`,
    )
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    category: row.challenge?.category ?? "jab",
    status: row.status ?? "submitted",
  }));
}

export function useBoxerStyleDiagnosis(): {
  diagnosis: BoxerStyleDiagnosis | null;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } =
    useBoxingEngagementSummary();
  const { data: hidden, isLoading: hiddenLoading } =
    useMyHiddenMissionProgress();

  const { data: challenges, isLoading: chLoading } = useQuery<
    ChallengeAttemptLite[]
  >({
    queryKey: ["boxer-style", "challenges", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => fetchRecentChallengeAttempts(user!.id),
  });

  const { data: conditions, isLoading: condLoading } = useQuery<
    BoxingConditionLogRow[]
  >({
    queryKey: ["boxer-style", "conditions", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => getRecentBoxingConditions(90),
  });

  const isLoading =
    summaryLoading || hiddenLoading || chLoading || condLoading;

  const diagnosis = useMemo<BoxerStyleDiagnosis | null>(() => {
    if (!summary) return null;
    const input: BoxerStyleInput = {
      profile: {
        quiz_correct_count: summary.quiz_correct_count,
        quiz_attempt_count: summary.quiz_attempt_count,
        challenge_clear_count: summary.challenge_clear_count,
        cheer_sent_count: summary.cheer_sent_count,
        cheer_received_count: summary.cheer_received_count,
        journal_count: summary.journal_count,
        current_quiz_streak: summary.current_quiz_streak,
        best_quiz_streak: summary.best_quiz_streak,
      },
      challengeAttempts: (challenges ?? []).map((c) => ({
        category: c.category as BoxerStyleInput["challengeAttempts"][number]["category"],
        status: c.status,
      })),
      conditionLogs: (conditions ?? []).map((c) => ({
        condition_type: c.condition_type,
      })),
      hiddenMissionClaims: (hidden?.missions ?? [])
        .filter((m) => m.claimed)
        .map((m) => ({ code: m.code })),
    };
    return computeBoxerStyleDiagnosis(input);
  }, [summary, challenges, conditions, hidden]);

  return { diagnosis, isLoading };
}
