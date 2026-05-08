import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorialCamp } from "@/features/tutorial-camp/useTutorialCamp";
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
  // 64-J: 5단계 가이드 완료 시 7일 캠프 자동 시작 (신규 회원 흐름):
  //   온보딩 → 환영 인사 → 오삼 가이드 5단계 → 7일 스타터 캠프
  const { state: campState, start: startCamp } = useTutorialCamp();

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

  // 64-H: stepsCompleted 가 늘어날 때마다 ✓ 완료 toast + 폭죽 효과.
  //   sonner toast id 로 dedup (다중 인스턴스 호출 시 중복 표시 방지).
  //   마지막 5 단계는 큰 폭죽 시퀀스 + 졸업 메시지.
  const lastStepsRef = useRef(stepsCompleted);
  useEffect(() => {
    if (stepsCompleted <= lastStepsRef.current) {
      lastStepsRef.current = stepsCompleted;
      return;
    }
    const justFinished = stepsCompleted; // 1..STEP_COUNT
    lastStepsRef.current = stepsCompleted;

    const justStep = TUTORIAL_STEPS[justFinished - 1];
    const isFinal = justFinished === STEP_COUNT;

    if (typeof window !== "undefined") {
      try {
        if (isFinal) {
          // 큰 폭죽 시퀀스 — 3 회
          const fire = (x: number, delay: number) =>
            window.setTimeout(() => {
              try {
                confetti({
                  particleCount: 100,
                  spread: 80,
                  origin: { x, y: 0.6 },
                  colors: [
                    "#fdb85c",
                    "#fde047",
                    "#fb7185",
                    "#fef3c7",
                    "#34d399",
                  ],
                });
              } catch {
                /* noop */
              }
            }, delay);
          fire(0.2, 0);
          fire(0.8, 250);
          fire(0.5, 500);
        } else {
          confetti({
            particleCount: 60,
            spread: 65,
            origin: { x: 0.5, y: 0.55 },
            colors: ["#fdb85c", "#fde047", "#fef3c7", "#34d399"],
          });
        }
      } catch {
        /* noop */
      }
    }

    toast.success(
      isFinal
        ? "🏆 5단계 모두 완료! 7일 스타터 캠프로 이어집니다."
        : `✓ ${justStep?.label ?? "단계"} 완료!`,
      {
        id: `tutorial-step-${justFinished}`,
        description: isFinal
          ? "오삼이가 7일 캠프를 자동으로 시작해드려요."
          : `다음 단계로 넘어갑니다.`,
        duration: isFinal ? 3500 : 2200,
      },
    );

    // 64-J: 5 단계 완료 → 7일 캠프 자동 시작 (status === 'not_started' 일 때만)
    //   회원 흐름: 온보딩 → 환영 인사 → 가이드 5단계 → 7일 캠프
    //   이미 시작/완료/스킵된 경우엔 재시작하지 않음 (멱등 보장)
    if (isFinal && campState.status === "not_started") {
      window.setTimeout(() => {
        try {
          startCamp();
        } catch {
          /* noop */
        }
      }, 2000);
    }
  }, [stepsCompleted, campState.status, startCamp]);

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

  /** Step별 즉시 보상 청구 (서버 멱등). 화면에서 fire-and-forget OK. */
  const claimStepReward = useCallback(
    async (step: number): Promise<{ amount: number; alreadyGranted: boolean } | null> => {
      const { data, error } = await supabase.rpc(
        "claim_tutorial_step_reward" as any,
        { _step: step },
      );
      if (error) {
        console.warn("[useTutorialState] claim_tutorial_step_reward failed", error);
        return null;
      }
      const result = (data ?? {}) as { success: boolean; amount?: number; already_granted?: boolean };
      if (!result.success) return null;
      qc.invalidateQueries({ queryKey: ["wallet"] });
      return {
        amount: result.amount ?? 0,
        alreadyGranted: !!result.already_granted,
      };
    },
    [qc],
  );

  /** 다음 단계로 전진 + 직전(=just completed) 단계의 보상 자동 청구. */
  const advance = useCallback(() => {
    setLocalCompleted((prev) => {
      const next = Math.min(prev + 1, STEP_COUNT);
      if (next === prev) return prev;
      void persistStep(next);
      // 'next' 자체가 막 완료된 step number — 그에 대한 즉시 보상 청구.
      void claimStepReward(next);
      return next;
    });
  }, [persistStep, claimStepReward]);

  /**
   * Reward mutation — Step 5 wires this to the "complete" button.
   *
   * Duplicate-claim defenses layered here:
   *   1. useMutation.isPending flips true between click and settle, so
   *      the caller can render the button disabled for the round trip.
   *   2. The server RPC itself is atomic: only the UPDATE that flips
   *      reward_claimed false→true grants gems. Any later call returns
   *      already_granted=true with 0 granted_gems.
   *   3. On success we refresh the profile so tutorial_completed=true
   *      propagates and isEligible drops — preventing the overlay from
   *      remounting and allowing a second click.
   */
  const completeReward = useMutation({
    mutationFn: async (): Promise<TutorialRewardResult> => {
      const { data, error } = await supabase.rpc(
        "complete_tutorial_once" as any,
        { _final_step: STEP_COUNT },
      );
      if (error) throw error;
      const result = (data ?? {}) as TutorialRewardResult;
      if (!result.success) {
        throw new Error(result.error ?? "튜토리얼 보상 지급 실패");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      void refreshProfile();
    },
  });

  /** 스킵 (서버 플래그). 최종 보상 지급 안 됨. */
  const markSkipped = useCallback(async () => {
    const { error } = await supabase.rpc("mark_tutorial_skipped" as any);
    if (error) {
      console.warn("[useTutorialState] mark_tutorial_skipped failed", error);
      return;
    }
    void refreshProfile();
  }, [refreshProfile]);

  /** 다시 시작 (Settings → 튜토리얼 다시 보기). 보상 재지급 0건 보장.
   *  · tutorial_step 0 으로 reset (server RPC)
   *  · 환영 모달 localStorage flag 도 제거 → 환영 인사부터 다시 노출
   */
  const restart = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc("restart_tutorial" as any);
    if (error) {
      console.warn("[useTutorialState] restart_tutorial failed", error);
      return false;
    }
    setLocalCompleted(0);
    // 환영 모달도 처음부터 — OsamiWelcomeModal 의 localStorage flag 제거
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("osami-welcome-seen");
      } catch {
        /* noop */
      }
    }
    // step toast dedup ref 도 reset (다음 advance 에서 toast 재발사 보장)
    lastStepsRef.current = 0;
    void refreshProfile();
    return true;
  }, [refreshProfile]);

  const isSkipped = !!p?.tutorial_skipped;

  return {
    /** Absolute signal: server has granted reward → tutorial is done forever. */
    isCompleted,
    /** UI signal: every step has been clicked through. */
    isFinished,
    /** 사용자가 명시적으로 스킵했는지. */
    isSkipped,
    /** Should the overlay render? */
    isEligible: !!user && !isCompleted && !isFinished && !isSkipped,
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
    claimStepReward,
    completeReward,
    markSkipped,
    restart,
  };
}
