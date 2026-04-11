// ═══════════════════════════════════════════════════════
// Level Progression Rule Engine
// Reusable for all 40 levels. White Lv.1 & Lv.2 first.
// ═══════════════════════════════════════════════════════

import { PROMOTION_RULES, WHITE_LV1_CHECKLIST, type ChecklistItem } from "@/data/whiteLevel1Data";
import { WHITE_LV2_PROMOTION_RULES, WHITE_LV2_CHECKLIST } from "@/data/whiteLevel2Data";

/* ─── Types ───────────────────────────────────────────── */
export interface LevelRuleConfig {
  levelId: string; // e.g. "white-1"
  league: string;
  level: number;
  minXp: number;
  minQualifyingSessions: number;
  minAttendanceDays: number;
  minTrainingMinutes: number;
  checklistPassCount: number;
  mandatoryCheckItems: number[];
  remediationWindowDays: number;
  remediationExtraSessions: number;
  additionalRules?: Record<string, any>;
}

export interface LevelCycleProgress {
  currentLevelXp: number;
  qualifyingSessions: number;
  attendanceDays: number;
  trainingMinutes: number;
  checklistPassed: boolean;
  checklistAttempted: boolean;
  checklistResults: boolean[];
  remediationUsed: boolean;
  remediationDueAt: string | null;
  eligibleForReview: boolean;
  status: LevelProgressionStatus;
  sessionDates: string[];
  lastSessionDate: string | null;
  homeMissionsToday: number;
}

export type LevelProgressionStatus =
  | "진행중"
  | "레벨업 심사 가능"
  | "보완 필요"
  | "레벨업 완료"
  | "코치 확인 필요";

/* ─── Level Rule Configs ──────────────────────────────── */
export const LEVEL_RULES: Record<string, LevelRuleConfig> = {
  "white-1": {
    levelId: "white-1",
    league: "white",
    level: 1,
    minXp: PROMOTION_RULES.xpRequired,
    minQualifyingSessions: PROMOTION_RULES.sessionsRequired,
    minAttendanceDays: PROMOTION_RULES.attendanceDaysRequired,
    minTrainingMinutes: PROMOTION_RULES.totalMinutesRequired,
    checklistPassCount: PROMOTION_RULES.checklistPassCount,
    mandatoryCheckItems: PROMOTION_RULES.mandatoryItems,
    remediationWindowDays: 7,
    remediationExtraSessions: 1,
  },
  "white-2": {
    levelId: "white-2",
    league: "white",
    level: 2,
    minXp: WHITE_LV2_PROMOTION_RULES.xpRequired,
    minQualifyingSessions: WHITE_LV2_PROMOTION_RULES.sessionsRequired,
    minAttendanceDays: WHITE_LV2_PROMOTION_RULES.attendanceDaysRequired,
    minTrainingMinutes: WHITE_LV2_PROMOTION_RULES.totalMinutesRequired,
    checklistPassCount: WHITE_LV2_PROMOTION_RULES.checklistPassCount,
    mandatoryCheckItems: WHITE_LV2_PROMOTION_RULES.mandatoryItems,
    remediationWindowDays: 7,
    remediationExtraSessions: 1,
    additionalRules: {
      movementJabBlockMinSessions: WHITE_LV2_PROMOTION_RULES.movementJabBlockMinSessions,
    },
  },
};

/* ─── Get checklist for a level ───────────────────────── */
export function getChecklistForLevel(levelId: string): ChecklistItem[] {
  if (levelId === "white-1") return WHITE_LV1_CHECKLIST;
  if (levelId === "white-2") return WHITE_LV2_CHECKLIST;
  return [];
}

/* ─── Calculate Level Status ──────────────────────────── */
export function calculateLevelStatus(
  rules: LevelRuleConfig,
  progress: LevelCycleProgress,
): LevelProgressionStatus {
  const metricsComplete =
    progress.currentLevelXp >= rules.minXp &&
    progress.qualifyingSessions >= rules.minQualifyingSessions &&
    progress.attendanceDays >= rules.minAttendanceDays &&
    progress.trainingMinutes >= rules.minTrainingMinutes;

  if (progress.checklistPassed) return "레벨업 완료";
  if (metricsComplete && progress.checklistAttempted && !progress.checklistPassed && progress.remediationUsed) {
    return "코치 확인 필요";
  }
  if (metricsComplete && progress.checklistAttempted && !progress.checklistPassed) {
    return "보완 필요";
  }
  if (metricsComplete) return "레벨업 심사 가능";
  return "진행중";
}

/* ─── Check if eligible for review ────────────────────── */
export function isEligibleForReview(rules: LevelRuleConfig, progress: LevelCycleProgress): boolean {
  return (
    progress.currentLevelXp >= rules.minXp &&
    progress.qualifyingSessions >= rules.minQualifyingSessions &&
    progress.attendanceDays >= rules.minAttendanceDays &&
    progress.trainingMinutes >= rules.minTrainingMinutes &&
    !progress.checklistPassed
  );
}

/* ─── Calculate XP from session minutes ───────────────── */
export function calculateSessionXp(minutes: number): number {
  if (minutes >= 50) return 100;
  if (minutes >= 40) return 80;
  if (minutes >= 30) return 60;
  return 0;
}

/* ─── Check if session qualifies for level ────────────── */
export function isQualifyingSession(minutes: number): boolean {
  return minutes >= 45;
}

/* ─── Submit checklist evaluation ─────────────────────── */
export function evaluateChecklist(
  rules: LevelRuleConfig,
  results: boolean[],
): { passed: boolean; mandatoryPassed: boolean; passCount: number } {
  const mandatoryPassed = rules.mandatoryCheckItems.every(i => results[i]);
  const passCount = results.filter(Boolean).length;
  const passed = mandatoryPassed && passCount >= rules.checklistPassCount;
  return { passed, mandatoryPassed, passCount };
}

/* ─── Default empty progress ──────────────────────────── */
export function createDefaultLevelProgress(): LevelCycleProgress {
  return {
    currentLevelXp: 0,
    qualifyingSessions: 0,
    attendanceDays: 0,
    trainingMinutes: 0,
    checklistPassed: false,
    checklistAttempted: false,
    checklistResults: [],
    remediationUsed: false,
    remediationDueAt: null,
    eligibleForReview: false,
    status: "진행중",
    sessionDates: [],
    lastSessionDate: null,
    homeMissionsToday: 0,
  };
}
