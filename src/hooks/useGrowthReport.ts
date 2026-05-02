/**
 * 153 QUEST v1.5 17단계 — 성장 리포트 hook.
 *
 * 공식 데이터(member_progress)는 useAuth().progress 를 통해 읽기 전용.
 * QUEST 데이터는 boxing_engagement_profiles + 관련 테이블 합산.
 *
 * 보호 원칙:
 *   · member_progress 직접 update 0
 *   · 점수 함수와 별개 — 표시 전용 합산
 */

import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useBoxingEngagementSummary } from "@/hooks/useBoxingEngagement";
import { useReturnRoundStatus } from "@/hooks/useReturnRound";
import { useMyHiddenMissionProgress } from "@/hooks/useHiddenMissions";
import { useRecentBoxingConditions } from "@/hooks/useBoxingCondition";
import {
  pickGrowthReportOsamiComment,
  pickParentCoachOneLiner,
  type GrowthReportContext,
} from "@/data/growthReportMessages";

export interface GrowthReportOfficialBlock {
  /** 공식 데이터 — 읽기 전용 */
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  bossesCleared: number;
  streakDays: number;
}

export interface GrowthReportQuestBlock {
  questXp: number;
  respect: number;
  quizCorrect: number;
  quizAttempts: number;
  challengeClear: number;
  challengeAttempts: number;
  journalCount: number;
  cheerSent: number;
  cheerReceived: number;
  hiddenMissionClaimed: number;
  conditionLogCount: number;
  hasReturnRound: boolean;
}

export interface GrowthReport {
  official: GrowthReportOfficialBlock;
  quest: GrowthReportQuestBlock;
  osamiComment: string;
  parentCoachOneLiner: string;
}

export function useGrowthReport(enabled = true): {
  report: GrowthReport | null;
  isLoading: boolean;
} {
  const { progress } = useAuth();
  const { data: summary, isLoading: sumLoading } = useBoxingEngagementSummary();
  const { data: returnStatus, isLoading: rrLoading } = useReturnRoundStatus();
  const { data: hidden, isLoading: hiddenLoading } =
    useMyHiddenMissionProgress(enabled);
  const { data: conditions, isLoading: condLoading } = useRecentBoxingConditions(
    30,
    enabled,
  );

  const isLoading =
    sumLoading || rrLoading || hiddenLoading || condLoading;

  const report = useMemo<GrowthReport | null>(() => {
    if (!progress || !summary) return null;

    const claimedHidden = (hidden?.missions ?? []).filter(
      (m) => m.claimed,
    ).length;

    const quest: GrowthReportQuestBlock = {
      questXp: summary.quest_xp,
      respect: summary.respect_points,
      quizCorrect: summary.quiz_correct_count,
      quizAttempts: summary.quiz_attempt_count,
      challengeClear: summary.challenge_clear_count,
      challengeAttempts: summary.challenge_attempt_count,
      journalCount: summary.journal_count,
      cheerSent: summary.cheer_sent_count,
      cheerReceived: summary.cheer_received_count,
      hiddenMissionClaimed: claimedHidden,
      conditionLogCount: conditions?.length ?? 0,
      hasReturnRound: returnStatus?.active === true,
    };

    const official: GrowthReportOfficialBlock = {
      totalXp: progress.total_xp ?? 0,
      currentLevel: progress.current_level ?? 1,
      currentRank: progress.current_rank ?? "white",
      bossesCleared: progress.bosses_cleared ?? 0,
      streakDays: progress.streak_days ?? 0,
    };

    const ctx: GrowthReportContext = {
      questXp: quest.questXp,
      questCorrect: quest.quizCorrect,
      challengeClear: quest.challengeClear,
      journalCount: quest.journalCount,
      cheerSent: quest.cheerSent,
      hiddenMissionClaimedCount: quest.hiddenMissionClaimed,
      hasReturnRound: quest.hasReturnRound,
      conditionLogCount: quest.conditionLogCount,
    };

    return {
      official,
      quest,
      osamiComment: pickGrowthReportOsamiComment(ctx),
      parentCoachOneLiner: pickParentCoachOneLiner(ctx),
    };
  }, [progress, summary, returnStatus, hidden, conditions]);

  return { report, isLoading };
}
