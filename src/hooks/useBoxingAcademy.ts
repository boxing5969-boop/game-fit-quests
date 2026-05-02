/**
 * 153 QUEST — 오삼이 복싱 아카데미 (퀴즈) hook.
 *
 * boxing_quiz_questions / submit_boxing_quiz_attempt RPC 래퍼.
 * 공식 mission/levels 흐름과 완전히 분리.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveBoxingQuizQuestions,
  submitBoxingQuizAttempt,
  type BoxingQuizAttemptResult,
  type BoxingQuizQuestion,
} from "@/services/boxingEngagementService";
import { useHiddenMissionTrigger } from "@/hooks/useHiddenMissions";
import { useGymRaidContributeTrigger } from "@/hooks/useGymRaid";

export const BOXING_ACADEMY_KEY = ["boxing-academy"] as const;

export function useBoxingAcademyQuestions(enabled = true) {
  return useQuery<BoxingQuizQuestion[]>({
    queryKey: [...BOXING_ACADEMY_KEY, "questions"],
    enabled,
    staleTime: 60_000,
    queryFn: getActiveBoxingQuizQuestions,
  });
}

export interface SubmitQuizArgs {
  questionId: string;
  selectedAnswer: string;
}

export function useSubmitBoxingQuizAttempt() {
  const qc = useQueryClient();
  const { triggerCheck } = useHiddenMissionTrigger();
  const { triggerContribute } = useGymRaidContributeTrigger();

  return useMutation<BoxingQuizAttemptResult, Error, SubmitQuizArgs>({
    mutationFn: ({ questionId, selectedAnswer }) =>
      submitBoxingQuizAttempt(questionId, selectedAnswer),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["boxing-academy"] });
      qc.invalidateQueries({ queryKey: ["boxing-iq-league"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // v1.5 16단계: 숨겨진 미션 평가 트리거 (디바운스)
      triggerCheck();
      // v2 21단계: 짐 레이드 contribute (정답일 때만, RPC 가 최근 5분 내 자동 매칭)
      if (result.is_correct) {
        triggerContribute("boxing_quiz_attempt");
      }
    },
  });
}
