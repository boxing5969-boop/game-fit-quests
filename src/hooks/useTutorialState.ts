import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TUTORIAL_STEPS,
  TUTORIAL_REWARD_GEMS,
  type TutorialStep,
} from "@/data/unlockRules";

/**
 * Tutorial state orchestration (Step 4 of the unlock-system rollout).
 *
 * Semantics
 *   • `tutorial_step` on the server is the *number of steps completed*
 *     (0..5). Step N+1 is the one currently displayed.
 *   • `advance()` increments by 1 (GREATEST-enforced server-side) and
 *     refreshes the profile so every consumer sees the new count.
 *   • Reward (1000 gems) is NOT wired in this step — the completeReward
 *     mutation is still exported so a future step can flip the button.
 *
 * Visibility
 *   • `isEligible` gates the overlay:
 *       logged in  &&  !tutorial_completed  &&  stepsCompleted < 5
 *   • `isFinished` is a UI-only signal (stepsCompleted >= 5) used to
 *     hide the overlay before the reward RPC has been wired.
 */

const STEP_COUNT = TUTORIAL_STEPS.length; // 5

const clampSteps = (raw: unknown): number => {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > STEP_COUNT) return STEP_COUNT;
  return Math.trunc(raw);
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

  const p = profile as any;
  const isCompleted = !!p?.tutorial_completed;
  const serverStepsCompleted = clampSteps(p?.tutorial_step ?? 0);

  // Local mirror so advance() can push UI before the profile round-trip.
  // GREATEST server-side ensures we never regress, and the effect keeps
  // the local value from lagging when the server catches up.
  const [localCompleted, setLocalCompleted] = useState(serverStepsCompleted);
  useEffect(() => {
    if (serverStepsCompleted > localCompleted) {
      setLocalCompleted(serverStepsCompleted);
    }
  }, [serverStepsCompleted, localCompleted]);

  const stepsCompleted = Math.max(localCompleted, serverStepsCompleted);
  const isFinished = stepsCompleted >= STEP_COUNT;
  const displayIndex = Math.min(stepsCompleted, STEP_COUNT - 1);
  const currentStep: TutorialStep = TUTORIAL_STEPS[displayIndex];
  const progressRatio = stepsCompleted / STEP_COUNT;

  const persistStep = useCallback(
    async (step: number) => {
      const { error } = await supabase.rpc(
        "update_tutorial_step" as any,
        { _step: step },
      );
      if (error) {
        console.warn("[useTutorialState] update_tutorial_step failed", error);
        return;
      }
      void refreshProfile();
    },
    [refreshProfile],
  );

  /** Advance to the next step. No-op once all five are done. */
  const advance = useCallback(() => {
    setLocalCompleted((prev) => {
      const next = Math.min(prev + 1, STEP_COUNT);
      if (next === prev) return prev;
      void persistStep(next);
      return next;
    });
  }, [persistStep]);

  /**
   * Reward mutation kept exported for a future step. The overlay in
   * Step 4 does NOT invoke this — reward wiring is deferred per spec.
   */
  const completeReward = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "complete_tutorial_once" as any,
      { _final_step: STEP_COUNT },
    );
    if (error) throw error;
    const result = (data ?? {}) as TutorialRewardResult;
    if (!result.success) {
      throw new Error(result.error ?? "튜토리얼 보상 지급 실패");
    }
    qc.invalidateQueries({ queryKey: ["wallet"] });
    void refreshProfile();
    return result;
  }, [qc, refreshProfile]);

  return {
    /** Absolute signal: server has granted reward → tutorial is done forever. */
    isCompleted,
    /** UI signal: every step has been clicked through. */
    isFinished,
    /** Should the overlay render? */
    isEligible: !!user && !isCompleted && !isFinished,
    /** 0..5 */
    stepsCompleted,
    /** 0..1 */
    progressRatio,
    /** Always the step currently shown (even when isFinished, it's the last). */
    currentStep,
    totalSteps: STEP_COUNT,
    rewardGems: TUTORIAL_REWARD_GEMS,
    steps: TUTORIAL_STEPS,
    advance,
    completeReward,
  };
}
