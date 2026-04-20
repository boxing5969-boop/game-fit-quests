import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TUTORIAL_STEPS,
  TUTORIAL_TOTAL_STEPS,
  TUTORIAL_REWARD_GEMS,
  type TutorialStepKey,
} from "@/data/unlockRules";

/**
 * Tutorial state orchestration (Step 3 of the unlock-system rollout).
 *
 * Persistence model
 *   • server-of-truth completion flag: profiles.tutorial_completed (DB)
 *       — written exactly once by complete_tutorial_and_grant_reward RPC
 *   • per-step progress: localStorage (client-only, can be reset without
 *       penalty because the reward path is idempotent at the DB level)
 *
 * The localStorage step tracker exists so that a user who closes the app
 * mid-tutorial reopens at the right step. Losing it (clearing storage,
 * different device) just restarts the walkthrough — the 1000-gem grant
 * still fires only once because the RPC UPDATEs with a WHERE guard.
 */

const STEP_KEY = "153_tutorial_step"; // holds one of TutorialStepKey

const isStepKey = (v: unknown): v is TutorialStepKey =>
  typeof v === "string" && TUTORIAL_STEPS.some((s) => s.key === v);

const readStoredStep = (): TutorialStepKey => {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    if (raw && isStepKey(raw)) return raw;
  } catch {
    // storage disabled — fall through
  }
  return TUTORIAL_STEPS[0].key;
};

const writeStoredStep = (key: TutorialStepKey) => {
  try {
    localStorage.setItem(STEP_KEY, key);
  } catch {
    // storage disabled — ignore; DB flag is the real completion source
  }
};

interface TutorialRewardResult {
  success: boolean;
  already_granted?: boolean;
  granted_gems?: number;
  balance?: number;
  error?: string;
}

export function useTutorialState() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  // Server flag is the source of truth. `as any` because types.ts lags
  // behind the migration that adds this column (rule 3: don't regen types
  // in a way that would touch unrelated call sites).
  const isCompleted = !!(profile as any)?.tutorial_completed;

  const [currentStepKey, setCurrentStepKey] = useState<TutorialStepKey>(
    () => readStoredStep(),
  );

  // If the server says "already done", collapse local state to terminal
  // so UI never re-prompts. Runs once per completion flip.
  useEffect(() => {
    if (isCompleted && currentStepKey !== "complete") {
      setCurrentStepKey("complete");
      writeStoredStep("complete");
    }
  }, [isCompleted, currentStepKey]);

  const currentStep = useMemo(
    () => TUTORIAL_STEPS.find((s) => s.key === currentStepKey) ?? TUTORIAL_STEPS[0],
    [currentStepKey],
  );

  const currentOrder = currentStep.order;
  const progressRatio = Math.min(currentOrder / TUTORIAL_TOTAL_STEPS, 1);

  const goToStep = useCallback((key: TutorialStepKey) => {
    setCurrentStepKey(key);
    writeStoredStep(key);
  }, []);

  const advance = useCallback(() => {
    setCurrentStepKey((prev) => {
      const idx = TUTORIAL_STEPS.findIndex((s) => s.key === prev);
      const next = TUTORIAL_STEPS[Math.min(idx + 1, TUTORIAL_STEPS.length - 1)];
      writeStoredStep(next.key);
      return next.key;
    });
  }, []);

  const completeReward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "complete_tutorial_and_grant_reward" as any,
      );
      if (error) throw error;
      const result = (data ?? {}) as TutorialRewardResult;
      if (!result.success) {
        throw new Error(result.error ?? "튜토리얼 보상 지급 실패");
      }
      return result;
    },
    onSuccess: () => {
      setCurrentStepKey("complete");
      writeStoredStep("complete");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      void refreshProfile();
    },
  });

  /** Hard reset for QA. Does NOT touch the server flag. */
  const resetLocal = useCallback(() => {
    try {
      localStorage.removeItem(STEP_KEY);
    } catch {
      /* noop */
    }
    setCurrentStepKey(TUTORIAL_STEPS[0].key);
  }, []);

  return {
    /** true once the server-side grant has fired for this user. */
    isCompleted,
    /** While the user is unauthenticated we don't show tutorial UI. */
    isEligible: !!user && !isCompleted,
    currentStep,
    currentStepKey,
    currentOrder,
    totalSteps: TUTORIAL_TOTAL_STEPS,
    progressRatio,
    rewardGems: TUTORIAL_REWARD_GEMS,
    steps: TUTORIAL_STEPS,
    goToStep,
    advance,
    completeReward,
    resetLocal,
  };
}
