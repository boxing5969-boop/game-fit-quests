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
 * Source of truth
 *   • profiles.tutorial_completed       — boolean, flipped by RPC
 *   • profiles.tutorial_step            — int order (0..5), GREATEST-only
 *   • profiles.tutorial_reward_claimed  — decoupled idempotency flag
 *   • profiles.tutorial_completed_at    — audit timestamp
 *
 * Server enforces idempotency via complete_tutorial_once(_final_step):
 * reward_claimed=false → true transition is atomic; subsequent calls
 * return already_granted=true with 0 granted_gems.
 *
 * We no longer keep a localStorage mirror — the overlay only renders
 * after AuthContext populates `profile`, so server state is always
 * available when we need it.
 */

const clampOrder = (raw: unknown): number => {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 1;
  if (raw < 1) return 1;
  if (raw > TUTORIAL_STEPS.length) return TUTORIAL_STEPS.length;
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

  // `as any` because types.ts lags behind the columns added in
  // 20260420140000_tutorial_state_columns.sql (rule 3: don't regen
  // types in a way that would touch unrelated call sites).
  const p = profile as any;
  const isCompleted = !!p?.tutorial_completed;
  const serverStepOrder = clampOrder(p?.tutorial_step ?? 1);

  // Local mirror so `advance()` can optimistically push the UI forward
  // while the update_tutorial_step RPC is still in flight. Seeded from
  // server every time profile changes.
  const [localOrder, setLocalOrder] = useState<number>(serverStepOrder);
  useEffect(() => {
    setLocalOrder(serverStepOrder);
  }, [serverStepOrder]);

  const currentOrder = Math.max(localOrder, serverStepOrder);
  const currentStep = useMemo(
    () => TUTORIAL_STEPS[Math.min(currentOrder, TUTORIAL_STEPS.length) - 1],
    [currentOrder],
  );
  const currentStepKey: TutorialStepKey = currentStep.key;
  const progressRatio = Math.min(currentOrder / TUTORIAL_TOTAL_STEPS, 1);

  // Fire-and-forget step persistence. We don't block UI on this —
  // the RPC uses GREATEST so out-of-order resolution is safe.
  const persistStep = useCallback(async (order: number) => {
    const { error } = await supabase.rpc(
      "update_tutorial_step" as any,
      { _step: order },
    );
    if (error) {
      // Log but don't surface — failing to save a step is harmless;
      // the user reopens on the same step next mount.
      console.warn("[useTutorialState] update_tutorial_step failed", error);
      return;
    }
    void refreshProfile();
  }, [refreshProfile]);

  const goToStep = useCallback((key: TutorialStepKey) => {
    const step = TUTORIAL_STEPS.find((s) => s.key === key);
    if (!step) return;
    setLocalOrder(step.order);
    void persistStep(step.order);
  }, [persistStep]);

  const advance = useCallback(() => {
    setLocalOrder((prev) => {
      const next = Math.min(prev + 1, TUTORIAL_STEPS.length);
      void persistStep(next);
      return next;
    });
  }, [persistStep]);

  const completeReward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "complete_tutorial_once" as any,
        { _final_step: TUTORIAL_STEPS.length },
      );
      if (error) throw error;
      const result = (data ?? {}) as TutorialRewardResult;
      if (!result.success) {
        throw new Error(result.error ?? "튜토리얼 보상 지급 실패");
      }
      return result;
    },
    onSuccess: () => {
      setLocalOrder(TUTORIAL_STEPS.length);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      void refreshProfile();
    },
  });

  return {
    /** true once complete_tutorial_once has flipped the server flag. */
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
  };
}
