import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PROMOTION_RULES, getRankUpStatus, type RankUpStatus } from "@/data/whiteLevel1Data";

/* ─── Local Progress State ─────────────────────────────
   Hybrid: reads from Supabase when available,
   supplements with localStorage for White Lv.1 metrics.
   Can be migrated to Supabase later.
──────────────────────────────────────────────────────── */

export interface LocalProgress {
  totalXp: number;
  rankSessions: number;       // sessions >= 45 min
  attendanceDays: number;     // unique days with rank sessions
  totalMinutes: number;
  homeMissionsToday: number;
  checklistPassed: boolean;
  checklistAttempted: boolean;
  checklistResults: boolean[];
  lastSessionDate: string | null;
  attendanceDateSet: string[];
}

const STORAGE_KEY = "white-lv1-progress";

const defaultProgress: LocalProgress = {
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
};

function loadProgress(): LocalProgress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultProgress, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...defaultProgress };
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

  // Merge with Supabase XP if available
  const totalXp = Math.max(local.totalXp, supabaseProgress?.total_xp ?? 0);

  const status: RankUpStatus = getRankUpStatus(
    totalXp,
    local.rankSessions,
    local.attendanceDays,
    local.totalMinutes,
    local.checklistPassed,
    local.checklistAttempted,
  );

  const recordSession = useCallback((minutes: number) => {
    const today = new Date().toISOString().slice(0, 10);

    setLocal(prev => {
      // Calculate XP based on minutes
      let xpGained = 0;
      if (minutes >= 50) xpGained = 100;
      else if (minutes >= 40) xpGained = 80;
      else if (minutes >= 30) xpGained = 60;

      // Rank session: only count if >= 45 min and max 1 per day
      const isRankSession = minutes >= 45 && prev.lastSessionDate !== today;
      const newDates = isRankSession && !prev.attendanceDateSet.includes(today)
        ? [...prev.attendanceDateSet, today]
        : prev.attendanceDateSet;

      return {
        ...prev,
        totalXp: prev.totalXp + xpGained,
        totalMinutes: prev.totalMinutes + minutes,
        rankSessions: isRankSession ? prev.rankSessions + 1 : prev.rankSessions,
        attendanceDays: newDates.length,
        attendanceDateSet: newDates,
        lastSessionDate: isRankSession ? today : prev.lastSessionDate,
      };
    });
  }, []);

  const recordHomeMission = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setLocal(prev => {
      // Reset daily count if new day
      const homeMissionsToday = prev.lastSessionDate === today ? prev.homeMissionsToday : 0;
      if (homeMissionsToday >= 1) return prev;
      return {
        ...prev,
        totalXp: prev.totalXp + 20,
        homeMissionsToday: homeMissionsToday + 1,
      };
    });
  }, []);

  const submitChecklist = useCallback((results: boolean[]) => {
    const mandatoryPassed = PROMOTION_RULES.mandatoryItems.every(i => results[i]);
    const passCount = results.filter(Boolean).length;
    const passed = mandatoryPassed && passCount >= PROMOTION_RULES.checklistPassCount;

    setLocal(prev => ({
      ...prev,
      checklistAttempted: true,
      checklistPassed: passed,
      checklistResults: results,
    }));

    return passed;
  }, []);

  const resetProgress = useCallback(() => {
    setLocal({ ...defaultProgress });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Computed metrics for UI
  const metrics = {
    xp: { current: totalXp, target: PROMOTION_RULES.xpRequired },
    sessions: { current: local.rankSessions, target: PROMOTION_RULES.sessionsRequired },
    days: { current: local.attendanceDays, target: PROMOTION_RULES.attendanceDaysRequired },
    minutes: { current: local.totalMinutes, target: PROMOTION_RULES.totalMinutesRequired },
  };

  const canAttemptChecklist =
    totalXp >= PROMOTION_RULES.xpRequired &&
    local.rankSessions >= PROMOTION_RULES.sessionsRequired &&
    local.attendanceDays >= PROMOTION_RULES.attendanceDaysRequired &&
    local.totalMinutes >= PROMOTION_RULES.totalMinutesRequired;

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
  };
}
