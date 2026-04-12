// ═══════════════════════════════════════════════════════
// Level Progression Rule Engine
// Reusable for all 40 levels. 3-day/3-session/150-min pacing.
// ═══════════════════════════════════════════════════════

import { PROMOTION_RULES } from "@/data/whiteLevel1Data";
import { WHITE_LV2_PROMOTION_RULES } from "@/data/whiteLevel2Data";
import { ALL_LEVELS, type UnifiedLevel } from "@/data/allLevelsData";

/* ─── Types ───────────────────────────────────────────── */
export interface LevelRuleConfig {
  levelId: string;
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

export interface ChecklistItem {
  id: number;
  title: string;
  details: string[];
  mandatory: boolean;
}

/* ─── Generate rule config from UnifiedLevel ──────────── */
function buildRuleFromLevel(ul: UnifiedLevel): LevelRuleConfig {
  const pc = ul.progressionConfig;
  const isMilestone = ul.levelInLeague === 10;
  return {
    levelId: `${ul.league}-${ul.levelInLeague}`,
    league: ul.league,
    level: ul.levelInLeague,
    minXp: pc.xpRequired,
    minQualifyingSessions: pc.sessionsRequired,
    minAttendanceDays: pc.attendanceDaysRequired,
    minTrainingMinutes: pc.totalMinutesRequired,
    checklistPassCount: pc.checklistPassCount,
    mandatoryCheckItems: pc.mandatoryItems,
    remediationWindowDays: 7,
    remediationExtraSessions: 1,
    additionalRules: isMilestone ? { isBossLevel: true } : undefined,
  };
}

/* ─── Level Rule Configs (auto-generated for all 40) ──── */
export const LEVEL_RULES: Record<string, LevelRuleConfig> = (() => {
  const map: Record<string, LevelRuleConfig> = {};
  ALL_LEVELS.forEach(ul => {
    const id = `${ul.league}-${ul.levelInLeague}`;
    map[id] = buildRuleFromLevel(ul);
  });
  // Override white-1 and white-2 with existing detailed data for backward compat
  map["white-1"] = {
    ...map["white-1"],
    minXp: PROMOTION_RULES.xpRequired,
    minQualifyingSessions: PROMOTION_RULES.sessionsRequired,
    minAttendanceDays: PROMOTION_RULES.attendanceDaysRequired,
    minTrainingMinutes: PROMOTION_RULES.totalMinutesRequired,
    checklistPassCount: PROMOTION_RULES.checklistPassCount,
    mandatoryCheckItems: PROMOTION_RULES.mandatoryItems,
  };
  map["white-2"] = {
    ...map["white-2"],
    minXp: WHITE_LV2_PROMOTION_RULES.xpRequired,
    minQualifyingSessions: WHITE_LV2_PROMOTION_RULES.sessionsRequired,
    minAttendanceDays: WHITE_LV2_PROMOTION_RULES.attendanceDaysRequired,
    minTrainingMinutes: WHITE_LV2_PROMOTION_RULES.totalMinutesRequired,
    checklistPassCount: WHITE_LV2_PROMOTION_RULES.checklistPassCount,
    mandatoryCheckItems: WHITE_LV2_PROMOTION_RULES.mandatoryItems,
    additionalRules: {
      movementJabBlockMinSessions: WHITE_LV2_PROMOTION_RULES.movementJabBlockMinSessions,
    },
  };
  return map;
})();

/* ─── Get checklist for a level ───────────────────────── */
export function getChecklistForLevel(levelId: string): ChecklistItem[] {
  // Find the unified level data
  const parts = levelId.split("-");
  if (parts.length !== 2) return [];
  const league = parts[0];
  const lvNum = parseInt(parts[1], 10);
  const ul = ALL_LEVELS.find(l => l.league === league && l.levelInLeague === lvNum);
  if (!ul) return [];
  return ul.reviewCriteria.map((rc, i) => ({
    id: i + 1,
    title: rc.title,
    details: rc.details,
    mandatory: rc.mandatory,
  }));
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
