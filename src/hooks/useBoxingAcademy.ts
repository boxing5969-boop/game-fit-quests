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

  return useMutation<BoxingQuizAttemptResult, Error, SubmitQuizArgs>({
    mutationFn: ({ questionId, selectedAnswer }) =>
      submitBoxingQuizAttempt(questionId, selectedAnswer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["boxing-academy"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
