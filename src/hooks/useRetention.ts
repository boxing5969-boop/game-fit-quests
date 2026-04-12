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
  actionType?: "soft_reminder" | "restart_routine" | "coach_nudge" | "levelup_reminder" | "remediation_reminder";
  /** Whether the restart routine banner should show */
  showRestartRoutine: boolean;
  /** Restart routine emphasis level */
  restartEmphasis?: "normal" | "strong";
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
        showRestartRoutine: false,
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
          showRestartRoutine: false,
        };
      }
    }

    // 14+ days: strong restart routine emphasis
    if (inactiveDays >= 14) {
      return {
        state: "coach_attention",
        inactiveDays,
        message: "오랜만이에요! 다시 시작하는 것만으로 충분합니다\n리스타트 루틴으로 가볍게 복귀해보세요",
        actionLabel: "리스타트 루틴 시작",
        actionType: "restart_routine",
        showRestartRoutine: true,
        restartEmphasis: "strong",
      };
    }

    // 7~13 days: normal restart routine
    if (inactiveDays >= 7) {
      return {
        state: "coach_attention",
        inactiveDays,
        message: "이번 주는 완벽함보다 복귀가 더 중요합니다\n리스타트 루틴으로 다시 시작해볼까요?",
        actionLabel: "리스타트 루틴 시작",
        actionType: "restart_routine",
        showRestartRoutine: true,
        restartEmphasis: "normal",
      };
    }

    // 5~6 days: at risk, show restart routine
    if (inactiveDays >= 5) {
      return {
        state: "at_risk",
        inactiveDays,
        message: "복귀 추천: 리스타트 루틴으로 다시 시작해보세요",
        actionLabel: "리스타트 루틴",
        actionType: "restart_routine",
        showRestartRoutine: true,
        restartEmphasis: "normal",
      };
    }

    // 2~4 days: soft reminder, no restart routine
    if (inactiveDays >= 2) {
      return {
        state: "slight_drop",
        inactiveDays,
        message: "오늘 움직이면 다시 리듬이 살아납니다",
        actionLabel: "오늘 수업 시작",
        actionType: "soft_reminder",
        showRestartRoutine: false,
      };
    }

    return {
      state: "active",
      inactiveDays,
      message: "자세와 리듬이 점점 안정되고 있어요",
      showRestartRoutine: false,
    };
  }, [sessions, activeProgress, canAttemptChecklist, status]);

  return retention;
}
