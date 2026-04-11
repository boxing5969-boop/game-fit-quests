// ═══════════════════════════════════════════════════════
// Weekly Prescription Hook
// Generates a simple weekly training recommendation
// based on recent activity for White Lv.1 & Lv.2.
// ═══════════════════════════════════════════════════════
import { useMemo } from "react";
import { useLocalProgress } from "@/hooks/useLocalProgress";

export type PlanType = "라이트" | "기본" | "빠른 경로";

export interface WeeklyPrescription {
  planType: PlanType;
  targetSessions: number;
  targetMinutes: number;
  targetHomeMissions: number;
  focusAreas: string[];
  motivationCopy: string;
  targetStrengthDays?: number;
}

function getRecentSessions(sessions: { date: string; qualifies: boolean }[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sessions.filter(s => s.date >= cutoffStr && s.qualifies).length;
}

export function useWeeklyPrescription() {
  const { sessions, activeLevelId, activeProgress } = useLocalProgress();

  const prescription = useMemo((): WeeklyPrescription => {
    const recentQualifying = getRecentSessions(
      sessions.map(s => ({ date: s.date, qualifies: s.qualifies })),
      7,
    );

    const isLv2 = activeLevelId === "white-2";

    if (recentQualifying <= 1) {
      return {
        planType: "라이트",
        targetSessions: 2,
        targetMinutes: 100,
        targetHomeMissions: 2,
        focusAreas: isLv2
          ? ["전진/후진 스텝", "잽 복귀"]
          : ["가드 유지", "잽 기초", "짧은 복귀"],
        motivationCopy: "이번 주는 2회만 채워도 충분합니다",
      };
    }

    if (recentQualifying <= 3) {
      return {
        planType: "기본",
        targetSessions: 3,
        targetMinutes: 150,
        targetHomeMissions: 1,
        focusAreas: isLv2
          ? ["이동 잽", "자세 복구"]
          : ["리듬", "가드", "잽 정확도"],
        motivationCopy: "좋은 페이스를 유지하고 있어요",
      };
    }

    return {
      planType: "빠른 경로",
      targetSessions: isLv2 ? 6 : 5,
      targetMinutes: isLv2 ? 300 : 250,
      targetHomeMissions: 1,
      focusAreas: isLv2
        ? ["이동 잽 체크리스트 준비"]
        : ["레벨업 심사 준비"],
      motivationCopy: "빠른 경로로 가고 있어요! 🔥",
    };
  }, [sessions, activeLevelId]);

  // Compute weekly actual values
  const weeklyStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recentSessions = sessions.filter(s => s.date >= cutoffStr);
    return {
      sessions: recentSessions.filter(s => s.qualifies).length,
      minutes: recentSessions.reduce((sum, s) => sum + s.actualMinutes, 0),
      totalSessions: recentSessions.length,
    };
  }, [sessions]);

  return { prescription, weeklyStats };
}
