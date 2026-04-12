import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  PROMOTION_RULES,
  type RankUpStatus,
} from "@/data/whiteLevel1Data";
import { WHITE_LV2_PROMOTION_RULES } from "@/data/whiteLevel2Data";
import {
  LEVEL_RULES,
  calculateLevelStatus,
  calculateSessionXp,
  isQualifyingSession,
  evaluateChecklist,
  createDefaultLevelProgress,
  type LevelCycleProgress,
  type LevelProgressionStatus,
} from "@/data/levelRuleEngine";

/* ─── Local Progress State ─────────────────────────────
   Hybrid: reads from Supabase when available,
   supplements with localStorage for White Lv.1/Lv.2 metrics.
   Can be migrated to Supabase later.
──────────────────────────────────────────────────────── */

export interface TrainingSession {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  qualifies: boolean;
  xpAwarded: number;
  intensity: "easy" | "normal" | "hard";
  completedBlocks: string[];
  levelId: string;
}

export interface DailyParticipationRecord {
  date: string;
  mode: "self_challenge" | "coach_backup" | "partial" | "needs_review";
  xpAwarded: number;
  bonusXp: number;
  actualMinutes: number;
  selfChallengeStreak: number;
}

export interface LocalProgress {
  // Global (legacy compat)
  totalXp: number;
  rankSessions: number;
  attendanceDays: number;
  totalMinutes: number;
  homeMissionsToday: number;
  checklistPassed: boolean;
  checklistAttempted: boolean;
  checklistResults: boolean[];
  lastSessionDate: string | null;
  attendanceDateSet: string[];

  // Per-level cycle (new)
  currentLevelId: string;
  levelProgress: Record<string, LevelCycleProgress>;

  // Session log
  sessions: TrainingSession[];

  // Self-challenge tracking
  selfChallengeStreak: number;
  lastSelfChallengeDate: string | null;
  dailyParticipations: DailyParticipationRecord[];
}

const STORAGE_KEY = "white-lv1-progress";

function getDefaultProgress(): LocalProgress {
  return {
    totalXp: 0,
    rankSessions: 0,
    attendanceDays: 0,
    totalMinutes: 0,
    homeMissionsToday: 0,
    checklistPassed: false,
    checklistAttempted: false,
    checklistResults: [false, false, false, false, false, false],
    lastSessionDate: null,
    attendanceDateSet: [],
    currentLevelId: "white-1",
    levelProgress: {
      "white-1": createDefaultLevelProgress(),
      "white-2": createDefaultLevelProgress(),
    },
    sessions: [],
    selfChallengeStreak: 0,
    lastSelfChallengeDate: null,
    dailyParticipations: [],
  };
}

function loadProgress(): LocalProgress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaults = getDefaultProgress();
      // Merge with defaults for backward compat
      const result = { ...defaults, ...parsed };
      // Ensure levelProgress exists
      if (!result.levelProgress) {
        result.levelProgress = defaults.levelProgress;
      }
      if (!result.levelProgress["white-1"]) {
        result.levelProgress["white-1"] = createDefaultLevelProgress();
        // Migrate existing data
        result.levelProgress["white-1"].currentLevelXp = result.totalXp || 0;
        result.levelProgress["white-1"].qualifyingSessions = result.rankSessions || 0;
        result.levelProgress["white-1"].attendanceDays = result.attendanceDays || 0;
        result.levelProgress["white-1"].trainingMinutes = result.totalMinutes || 0;
        result.levelProgress["white-1"].checklistPassed = result.checklistPassed || false;
        result.levelProgress["white-1"].checklistAttempted = result.checklistAttempted || false;
        result.levelProgress["white-1"].checklistResults = result.checklistResults || [];
        result.levelProgress["white-1"].sessionDates = result.attendanceDateSet || [];
        result.levelProgress["white-1"].lastSessionDate = result.lastSessionDate || null;
      }
      if (!result.levelProgress["white-2"]) {
        result.levelProgress["white-2"] = createDefaultLevelProgress();
      }
      if (!result.currentLevelId) result.currentLevelId = "white-1";
      if (!result.sessions) result.sessions = [];
      return result;
    }
  } catch { /* ignore */ }
  return getDefaultProgress();
}

function saveProgress(p: LocalProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function useLocalProgress() {
  const { progress: supabaseProgress } = useAuth();
  const [local, setLocal] = useState<LocalProgress>(loadProgress);

  // Sync to localStorage on changes
  useEffect(() => {
    saveProgress(local);
  }, [local]);

  // Determine current level from Supabase if available
  const currentLevel = supabaseProgress?.current_level ?? 1;
  const currentRank = supabaseProgress?.current_rank ?? "white";
  const activeLevelId = currentRank === "white"
    ? `white-${currentLevel}`
    : local.currentLevelId;

  // Get the active level's progress
  const activeProgress = local.levelProgress[activeLevelId] || createDefaultLevelProgress();
  const rules = LEVEL_RULES[activeLevelId] || LEVEL_RULES["white-1"];

  // Merge with Supabase XP if available
  const totalXp = Math.max(local.totalXp, supabaseProgress?.total_xp ?? 0);

  // Calculate status using the rule engine
  const status: LevelProgressionStatus = calculateLevelStatus(rules, activeProgress);

  const recordSession = useCallback((minutes: number, completedBlocks: string[] = [], intensity: "easy" | "normal" | "hard" = "normal") => {
    const today = new Date().toISOString().slice(0, 10);
    const xp = calculateSessionXp(minutes);
    const qualifies = isQualifyingSession(minutes);

    setLocal(prev => {
      const levelId = currentRank === "white" ? `white-${currentLevel}` : prev.currentLevelId;
      const prevLp = prev.levelProgress[levelId] || createDefaultLevelProgress();

      // Max 1 qualifying session per day for the level
      const alreadyQualifiedToday = qualifies && prevLp.lastSessionDate === today;
      const isNewQualifying = qualifies && !alreadyQualifiedToday;
      const newDates = isNewQualifying && !prevLp.sessionDates.includes(today)
        ? [...prevLp.sessionDates, today]
        : prevLp.sessionDates;

      // Session record
      const session: TrainingSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        startedAt: new Date(Date.now() - minutes * 60000).toISOString(),
        endedAt: new Date().toISOString(),
        plannedMinutes: 50,
        actualMinutes: minutes,
        qualifies: isNewQualifying,
        xpAwarded: xp,
        intensity,
        completedBlocks,
        levelId,
      };

      const updatedLp: LevelCycleProgress = {
        ...prevLp,
        currentLevelXp: prevLp.currentLevelXp + xp,
        trainingMinutes: prevLp.trainingMinutes + minutes,
        qualifyingSessions: isNewQualifying ? prevLp.qualifyingSessions + 1 : prevLp.qualifyingSessions,
        attendanceDays: newDates.length,
        sessionDates: newDates,
        lastSessionDate: isNewQualifying ? today : prevLp.lastSessionDate,
      };

      // Also update global counters
      const globalDates = isNewQualifying && !prev.attendanceDateSet.includes(today)
        ? [...prev.attendanceDateSet, today]
        : prev.attendanceDateSet;

      return {
        ...prev,
        totalXp: prev.totalXp + xp,
        totalMinutes: prev.totalMinutes + minutes,
        rankSessions: isNewQualifying ? prev.rankSessions + 1 : prev.rankSessions,
        attendanceDays: globalDates.length,
        attendanceDateSet: globalDates,
        lastSessionDate: isNewQualifying ? today : prev.lastSessionDate,
        levelProgress: {
          ...prev.levelProgress,
          [levelId]: updatedLp,
        },
        sessions: [...prev.sessions, session],
      };
    });
  }, [currentLevel, currentRank]);

  const recordHomeMission = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setLocal(prev => {
      const levelId = currentRank === "white" ? `white-${currentLevel}` : prev.currentLevelId;
      const prevLp = prev.levelProgress[levelId] || createDefaultLevelProgress();
      const missionsToday = prevLp.lastSessionDate === today ? prevLp.homeMissionsToday : 0;
      if (missionsToday >= 1) return prev;
      return {
        ...prev,
        totalXp: prev.totalXp + 20,
        levelProgress: {
          ...prev.levelProgress,
          [levelId]: {
            ...prevLp,
            currentLevelXp: prevLp.currentLevelXp + 20,
            homeMissionsToday: missionsToday + 1,
          },
        },
      };
    });
  }, [currentLevel, currentRank]);

  const submitChecklist = useCallback((results: boolean[]) => {
    const { passed } = evaluateChecklist(rules, results);

    setLocal(prev => {
      const levelId = currentRank === "white" ? `white-${currentLevel}` : prev.currentLevelId;
      const prevLp = prev.levelProgress[levelId] || createDefaultLevelProgress();

      const updatedLp: LevelCycleProgress = {
        ...prevLp,
        checklistAttempted: true,
        checklistPassed: passed,
        checklistResults: results,
        remediationUsed: prevLp.checklistAttempted && !passed ? true : prevLp.remediationUsed,
        remediationDueAt: !passed && !prevLp.remediationUsed
          ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
          : prevLp.remediationDueAt,
      };

      return {
        ...prev,
        checklistPassed: passed,
        checklistAttempted: true,
        checklistResults: results,
        levelProgress: {
          ...prev.levelProgress,
          [levelId]: updatedLp,
        },
      };
    });

    return passed;
  }, [rules, currentLevel, currentRank]);

  const resetProgress = useCallback(() => {
    setLocal(getDefaultProgress());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Computed metrics for UI (compatible with existing code)
  const metrics = useMemo(() => ({
    xp: { current: activeProgress.currentLevelXp, target: rules.minXp },
    sessions: { current: activeProgress.qualifyingSessions, target: rules.minQualifyingSessions },
    days: { current: activeProgress.attendanceDays, target: rules.minAttendanceDays },
    minutes: { current: activeProgress.trainingMinutes, target: rules.minTrainingMinutes },
  }), [activeProgress, rules]);

  const canAttemptChecklist =
    activeProgress.currentLevelXp >= rules.minXp &&
    activeProgress.qualifyingSessions >= rules.minQualifyingSessions &&
    activeProgress.attendanceDays >= rules.minAttendanceDays &&
    activeProgress.trainingMinutes >= rules.minTrainingMinutes;

  return {
    local,
    totalXp,
    status,
    metrics,
    canAttemptChecklist,
    recordSession,
    recordHomeMission,
    submitChecklist,
    resetProgress,
    activeLevelId,
    activeProgress,
    rules,
    sessions: local.sessions,
  };
}
