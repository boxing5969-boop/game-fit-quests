// ═══════════════════════════════════════════════════════
// Retention & Re-engagement Hook
// Monitors activity and generates retention messages.
// ═══════════════════════════════════════════════════════
import { useMemo } from "react";
import { useLocalProgress } from "@/hooks/useLocalProgress";

export type RetentionState = "active" | "slight_drop" | "at_risk" | "coach_attention";

export interface RetentionInfo {
  state: RetentionState;
  inactiveDays: number;
  message: string;
  actionLabel?: string;
  actionType?: "soft_reminder" | "light_session" | "coach_nudge" | "levelup_reminder" | "remediation_reminder";
}

export function useRetention() {
  const { sessions, activeProgress, status, canAttemptChecklist } = useLocalProgress();

  const retention = useMemo((): RetentionInfo => {
    // Calculate days since last session
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = activeProgress.lastSessionDate || (sessions.length > 0 ? sessions[sessions.length - 1].date : null);

    let inactiveDays = 0;
    if (lastDate) {
      const diff = new Date(today).getTime() - new Date(lastDate).getTime();
      inactiveDays = Math.floor(diff / 86400000);
    } else {
      inactiveDays = 999; // Never trained
    }

    // Levelup reminder
    if (canAttemptChecklist && !activeProgress.checklistPassed && !activeProgress.checklistAttempted) {
      return {
        state: "active",
        inactiveDays,
        message: "레벨업 심사가 열렸습니다\n지금 체크테스트를 보면 좋습니다",
        actionLabel: "체크테스트 시작",
        actionType: "levelup_reminder",
      };
    }

    // Remediation reminder
    if (activeProgress.remediationDueAt) {
      const dueDate = new Date(activeProgress.remediationDueAt);
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
      if (daysUntilDue <= 2 && daysUntilDue > 0 && !activeProgress.checklistPassed) {
        return {
          state: "active",
          inactiveDays,
          message: "보완 마감이 가까워지고 있습니다\n부족한 항목만 보완하면 됩니다",
          actionLabel: "6회차에서 다시 도전하세요",
          actionType: "remediation_reminder",
        };
      }
    }

    // Activity-based states
    if (inactiveDays >= 6) {
      return {
        state: "coach_attention",
        inactiveDays,
        message: "이번 주는 완벽함보다 복귀가 더 중요합니다\n쉬운 루틴으로 다시 시작해볼까요?",
        actionLabel: "10분 복귀 루틴",
        actionType: "coach_nudge",
      };
    }
    if (inactiveDays >= 4) {
      return {
        state: "at_risk",
        inactiveDays,
        message: "복귀 모드 추천: 10분 라이트 세션으로 다시 시작해보세요",
        actionLabel: "10분 라이트 세션",
        actionType: "light_session",
      };
    }
    if (inactiveDays >= 2) {
      return {
        state: "slight_drop",
        inactiveDays,
        message: "오늘 10분만 움직여도 다시 리듬이 살아납니다",
        actionLabel: "오늘 수업 시작",
        actionType: "soft_reminder",
      };
    }

    return {
      state: "active",
      inactiveDays,
      message: "자세와 리듬이 점점 안정되고 있어요",
    };
  }, [sessions, activeProgress, canAttemptChecklist, status]);

  return retention;
}
