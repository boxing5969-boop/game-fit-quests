import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  INDUCTION_STEPS,
  INDUCTION_TOTAL_REWARD,
  INDUCTION_TOTAL_STEPS,
  clampInductionStep,
  getInductionStep,
  type InductionStep,
} from "@/data/inductionTutorialSteps";
import {
  shouldAutoStartTutorial,
  type TutorialStateLike,
} from "@/lib/tutorialState";

/**
 * useTutorialProgress — 입단식 상태 오케스트레이터.
 *
 * ──────────────────────────────────────────────────────────────────
 * 자동 실행 / 재실행 진실표
 * ──────────────────────────────────────────────────────────────────
 * `isOpen` = !!user  &&  shouldAutoStartTutorial(profile)  &&  !isFinished
 *
 * | tutorial_completed | tutorial_skipped | tutorial_step | isOpen |
 * |--------------------|------------------|---------------|--------|
 * | false              | false            | 0             | ✅ 자동 실행 |
 * | false              | false            | 1..4          | ✅ 이어서 재개 |
 * | true               | false            | 5             | ❌ 자동 실행 금지 |
 * | false              | true             | 0..4          | ❌ 스킵 — 자동 실행 금지 |
 * | false              | false            | 5             | ❌ (완료 중 edge) |
 *
 * 재실행 경로 (UI)
 *   • MyPage 액션 리스트 "🥊 입단식 다시 보기" (완료/스킵 유저만)
 *   • SettingsPage 온보딩 섹션 "🥊 랭킹업 입단식 다시 시작"
 *   → 둘 다 `restartTutorial()` → RPC `restart_tutorial`
 *   → profiles: completed=false, skipped=false, step=0 (reward_claimed 은 보존)
 *
 * ──────────────────────────────────────────────────────────────────
 * 왜 별도 훅인가
 * ──────────────────────────────────────────────────────────────────
 * `useTutorialState` 는 기존 TutorialOverlay / SettingsPage /
 * useTutorialVisitTracker 가 이미 의존하는 legacy API 이다. 새 입단식
 * UI 를 만들기 위해 기존 훅을 재설계하면 6개 호출부가 한꺼번에 흔들리므로,
 * 본 훅은 동일한 서버 상태(profiles + tutorial_step_claims)를 **공유**
 * 하면서도 사용자가 요구한 명시적 API (completeTutorialStep, skipTutorial,
 * finishTutorial, claimTutorialRewardIfEligible, restartTutorial) 만
 * 노출한다. 두 훅이 동시에 마운트돼도 서버측 GREATEST / UNIQUE 제약이
 * 최종 일관성을 보장한다.
 *
 * ──────────────────────────────────────────────────────────────────
 * 서버 RPC 맵핑 (모두 SECURITY DEFINER, auth.uid() 기반)
 * ──────────────────────────────────────────────────────────────────
 *   completeTutorialStep(n)         → update_tutorial_step(n)
 *                                     + claim_tutorial_step_reward(n)
 *   skipTutorial()                  → mark_tutorial_skipped()
 *   finishTutorial()                → complete_tutorial_once(5)
 *   claimTutorialRewardIfEligible() → complete_tutorial_once(5) (if !claimed)
 *   restartTutorial()               → restart_tutorial()
 *
 * ──────────────────────────────────────────────────────────────────
 * 중복 지급 방지 (3-layer)
 * ──────────────────────────────────────────────────────────────────
 *   1. UI: `rewardClaimed` true 면 claimTutorialRewardIfEligible 이
 *      네트워크 왕복 없이 즉시 `{ alreadyClaimed: true }` 로 종료.
 *   2. Mutation: useMutation.isPending 으로 버튼 더블클릭 차단.
 *   3. Server: `tutorial_reward_claimed` 원자 플립, step_claims UNIQUE.
 *      클라이언트 어떤 레이스에도 2회차부터 0젬만 반환.
 *
 * ──────────────────────────────────────────────────────────────────
 * 새로고침 / 재접속 시 유지
 * ──────────────────────────────────────────────────────────────────
 * 모든 진척/보상 플래그는 profiles 컬럼(tutorial_step, tutorial_completed,
 * tutorial_skipped, tutorial_reward_claimed, tutorial_started_at,
 * tutorial_completed_at) 과 tutorial_step_claims 에 기록된다. 클라이언트
 * state 는 optimistic mirror 뿐이며 AuthContext 가 로그인 시 profile 을
 * 재조회하므로 페이지 새로고침 / 재접속 후에도 정확한 step 이 복원된다.
 * ──────────────────────────────────────────────────────────────────
 */

interface FinishResult {
  success: boolean;
  alreadyGranted: boolean;
  grantedGems: number;
  balance: number;
  titleReward?: string;
  effectReward?: string;
}

interface StepCompletionResult {
  step: number;
  /** 이 호출에서 실제로 지급된 젬 (이미 지급된 경우 0) */
  amount: number;
  alreadyGranted: boolean;
}

export function useTutorialProgress() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  // AuthContext.profile 은 types.ts 의 Row 와 일치 — 이번 작업에서
  // tutorial_* 필드를 모두 반영했지만, refresh 중에는 null 가능.
  const p = profile as TutorialStateLike | null;

  const isCompleted = !!p?.tutorial_completed;
  const isSkipped = !!p?.tutorial_skipped;
  const rewardClaimed = !!p?.tutorial_reward_claimed;
  const serverStep = clampInductionStep(p?.tutorial_step ?? 0);

  // Optimistic mirror — 서버 round-trip 전에 UI 가 다음 스텝을 반영할 수
  // 있도록 유지.
  //
  // 동기화 규칙
  //   • 서버 값이 더 크면 올려서 따라잡음 (일반적인 advance 이후).
  //   • 서버 값이 0 으로 떨어지면 restart_tutorial 이 실행된 신호 →
  //     optimistic 값도 0 으로 리셋. 이 규칙이 없으면 글로벌 마운트된
  //     오버레이 훅 인스턴스의 localStep 이 이전 세션 값(예: 5)을 유지해
  //     `isFinished` 가 계속 true 로 잠겨 재시작이 화면에 반영되지 않는다.
  const [localStep, setLocalStep] = useState(serverStep);
  useEffect(() => {
    if (serverStep > localStep) {
      setLocalStep(serverStep);
    } else if (serverStep === 0 && localStep > 0) {
      setLocalStep(0);
    }
  }, [serverStep, localStep]);

  const stepsCompleted = Math.max(localStep, serverStep);
  const isFinished = stepsCompleted >= INDUCTION_TOTAL_STEPS;

  // 현재 표시해야 할 step (완료됐으면 마지막 step 유지).
  const currentStepOrder = (isFinished
    ? INDUCTION_TOTAL_STEPS
    : stepsCompleted + 1) as 1 | 2 | 3 | 4 | 5;
  const currentStep: InductionStep = getInductionStep(currentStepOrder);

  // 자동 열림: 최초 로그인 + 미완료 + 미스킵 + step<5
  const isOpen = !!user && shouldAutoStartTutorial(p) && !isFinished;

  // ──────────────────────────────────────────────────────────────
  // Operations
  // ──────────────────────────────────────────────────────────────

  /**
   * 단계 완료 — 서버 step 전진 + 해당 step 보상 즉시 지급 (멱등).
   *
   * 여러 번 호출해도:
   *   • update_tutorial_step 은 GREATEST 로만 전진 → 후퇴 없음.
   *   • claim_tutorial_step_reward 는 UNIQUE(user_id, step_order) →
   *     2회차부터 amount=0, alreadyGranted=true.
   */
  const completeTutorialStep = useCallback(
    async (order: 1 | 2 | 3 | 4 | 5): Promise<StepCompletionResult | null> => {
      // Optimistic: UI 가 즉시 반응.
      setLocalStep((prev) => Math.max(prev, order));

      const { error: stepErr } = await supabase.rpc(
        "update_tutorial_step" as any,
        { _step: order },
      );
      if (stepErr) {
        console.warn("[useTutorialProgress] update_tutorial_step failed", stepErr);
        // optimistic step 은 유지 — 서버 롤백해도 다음 persist 에서 재시도.
      }

      const { data, error: rewardErr } = await supabase.rpc(
        "claim_tutorial_step_reward" as any,
        { _step: order },
      );
      if (rewardErr) {
        console.warn("[useTutorialProgress] claim_tutorial_step_reward failed", rewardErr);
        void refreshProfile();
        return null;
      }

      const payload = (data ?? {}) as {
        success: boolean;
        amount?: number;
        already_granted?: boolean;
      };

      qc.invalidateQueries({ queryKey: ["wallet"] });
      void refreshProfile();

      if (!payload.success) return null;
      return {
        step: order,
        amount: payload.amount ?? 0,
        alreadyGranted: !!payload.already_granted,
      };
    },
    [qc, refreshProfile],
  );

  /** 스킵 — tutorial_skipped=true. 최종 보상 지급 차단 (서버에서 검증). */
  const skipTutorial = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc("mark_tutorial_skipped" as any);
    if (error) {
      console.warn("[useTutorialProgress] mark_tutorial_skipped failed", error);
      return false;
    }
    void refreshProfile();
    return true;
  }, [refreshProfile]);

  /**
   * 최종 완료 + 400젬 + 신입 챌린저 칭호 + sparkle 이펙트 지급.
   *
   * useMutation 으로 감싼 이유:
   *   • isPending 으로 버튼 더블클릭 차단
   *   • TanStack Query devtools 에서 호출 추적 용이
   */
  const finishMutation = useMutation({
    mutationFn: async (): Promise<FinishResult> => {
      const { data, error } = await supabase.rpc("complete_tutorial_once" as any, {
        _final_step: INDUCTION_TOTAL_STEPS,
      });
      if (error) throw error;
      const payload = (data ?? {}) as {
        success: boolean;
        already_granted?: boolean;
        granted_gems?: number;
        balance?: number;
        title_reward?: string;
        effect_reward?: string;
        error?: string;
      };
      if (!payload.success) throw new Error(payload.error ?? "튜토리얼 완료 실패");
      return {
        success: true,
        alreadyGranted: !!payload.already_granted,
        grantedGems: payload.granted_gems ?? 0,
        balance: payload.balance ?? 0,
        titleReward: payload.title_reward,
        effectReward: payload.effect_reward,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // 실제 훅 key 는 `["owned-customizations", userId]` (useCustomizationPurchase)
      // 이전 값 `["customizations", "owned"]` 은 어떤 쿼리와도 매칭되지 않아
      // complete_tutorial_once 가 삽입한 title/effect 가 CharacterStudio 에
      // 새로고침 전까지 보이지 않았음.
      qc.invalidateQueries({ queryKey: ["owned-customizations"] });
      void refreshProfile();
    },
  });

  const finishTutorial = useCallback(
    (): Promise<FinishResult> => finishMutation.mutateAsync(),
    [finishMutation],
  );

  /**
   * 보상 미지급 상태에서만 최종 보상 지급 시도.
   * 이미 지급된 경우 네트워크 호출 없이 즉시 종료 (서버 호출 자체는
   * 멱등이지만 UI 지연/로그 노이즈를 줄이기 위한 클라이언트 short-circuit).
   */
  const claimTutorialRewardIfEligible = useCallback(async (): Promise<
    FinishResult | { alreadyClaimed: true }
  > => {
    if (rewardClaimed) return { alreadyClaimed: true };
    return finishTutorial();
  }, [rewardClaimed, finishTutorial]);

  /** 설정 화면의 "튜토리얼 다시 보기" 용. 보상 재지급은 서버가 차단. */
  const restartTutorial = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc("restart_tutorial" as any);
    if (error) {
      console.warn("[useTutorialProgress] restart_tutorial failed", error);
      return false;
    }
    setLocalStep(0);
    void refreshProfile();
    return true;
  }, [refreshProfile]);

  return {
    // ── State ────────────────────────────────────────────────
    /** 오버레이를 자동으로 띄워야 하는가 (로그인 + 미완료 + 미스킵). */
    isOpen,
    /** 서버 tutorial_completed. */
    isCompleted,
    /** 서버 tutorial_skipped. */
    isSkipped,
    /** 서버 tutorial_reward_claimed. (1회성 1000젬 지급 여부) */
    rewardClaimed,
    /** 완료된 step 수 (0..5, optimistic mirror 포함). */
    stepsCompleted,
    /** 모든 step 을 마쳤는가 (UI-only). */
    isFinished,
    /** 지금 표시할 step 의 1-based order. */
    currentStepOrder,
    /** 지금 표시할 step config. */
    currentStep,
    /** 진행률 0..1. */
    progressRatio: stepsCompleted / INDUCTION_TOTAL_STEPS,
    /** 5. */
    totalSteps: INDUCTION_TOTAL_STEPS,
    /** 1000. */
    totalReward: INDUCTION_TOTAL_REWARD,
    /** 5개 step config (frozen). */
    steps: INDUCTION_STEPS,

    // ── Actions ──────────────────────────────────────────────
    completeTutorialStep,
    skipTutorial,
    finishTutorial,
    claimTutorialRewardIfEligible,
    restartTutorial,

    // ── Mutation meta (버튼 disabled 바인딩용) ──────────────
    isFinishing: finishMutation.isPending,
  };
}
