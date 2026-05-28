import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { useTutorialState } from "@/hooks/useTutorialState";
import { CoachBot } from "@/components/tutorial/CoachBot";
import { StepRewardChip } from "@/components/tutorial/StepRewardChip";
import { TUTORIAL_STEP_REWARDS } from "@/data/unlockRules";
import { cn } from "@/lib/utils";

interface TutorialOverlayProps {
  /**
   * Fired once complete_tutorial_once succeeds. `grantedGems` is the
   * server-reported amount for the FINAL step (step 5 = 400). 단계별
   * 보상 합계는 1000 파이트 머니 — 호출자가 합산해서 표시한다.
   */
  onCompleted?: (grantedGems: number) => void;
}

/**
 * "랭킹업 입단식" 튜토리얼 오버레이 — Step 8 재디자인.
 *
 * 컨셉
 *   • 코치봇 NPC 가이드 + 게임 퀘스트형 카드
 *   • 단계 완료 시마다 즉시 파이트 머니 카운트업 연출 (도파민)
 *   • 5/5 도달 시 complete_tutorial_once → 칭호 + 이펙트 함께 지급
 *   • 스킵 가능, 단 스킵 시 최종 보상 지급 안 됨 (서버 가드)
 */
export const TutorialOverlay = ({ onCompleted }: TutorialOverlayProps) => {
  const navigate = useNavigate();
  const {
    isEligible,
    currentStep,
    stepsCompleted,
    progressRatio,
    totalSteps,
    steps,
    advance,
    completeReward,
    markSkipped,
  } = useTutorialState();

  const [dismissed, setDismissed] = useState(false);
  const [recentReward, setRecentReward] = useState<number | null>(null);

  // 새 단계로 진입할 때마다 직전 단계의 보상 표시 (현재 stepsCompleted 가
  // 즉시 advance 후의 값이라, 직전이 N 이면 reward[N] 만큼 노출).
  useEffect(() => {
    if (stepsCompleted >= 1 && stepsCompleted <= 4) {
      setRecentReward(TUTORIAL_STEP_REWARDS[stepsCompleted] ?? 0);
      const t = setTimeout(() => setRecentReward(null), 2000);
      return () => clearTimeout(t);
    }
  }, [stepsCompleted]);

  if (!isEligible || dismissed) return null;

  const isMiniGame = false;
  const isComplete = stepsCompleted >= totalSteps;
  const isSubmitting = completeReward.isPending;

  const handlePrimary = () => {
    if (isSubmitting) return;
    if (isComplete) {
      completeReward.mutate(undefined, {
        onSuccess: (result) => {
          if (result.already_granted || (result.granted_gems ?? 0) <= 0) {
            setDismissed(true);
            return;
          }
          setDismissed(true);
          // 표시는 합산 (단계별 100/100/200/200 + 마지막 400 = 1000)
          onCompleted?.(1000);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "보상 지급에 실패했어요. 잠시 후 다시 시도해주세요.",
          );
        },
      });
      return;
    }
    if (isMiniGame) {
      advance();
      return;
    }
    if (currentStep.navTarget) {
      setDismissed(true);
      navigate(currentStep.navTarget);
    }
  };

  const handleSkip = () => {
    if (isSubmitting) return;
    setDismissed(true);
    void markSkipped();
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-foreground/55 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div
        className="relative w-full max-w-md animate-slide-up rounded-t-3xl border border-primary/25 bg-gradient-to-br from-card via-card to-[hsl(8_60%_8%)] p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="튜토리얼 닫기"
          disabled={isSubmitting}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header — 입단식 타이틀 + 진행도 */}
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            🥊 랭킹업 입단식
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <h2
              id="tutorial-title"
              className="text-lg font-bold leading-tight text-foreground truncate"
            >
              {currentStep.label}
            </h2>
            <span className="number-font text-[11px] font-bold text-muted-foreground shrink-0">
              {stepsCompleted}/{totalSteps}
            </span>
          </div>
        </div>

        {/* 코치봇 + 멘트 */}
        <div className="mb-4">
          <CoachBot message={currentStep.description} />
        </div>

        {/* 5-dot 진행 인디케이터 */}
        <div className="mb-2 flex items-center justify-between gap-1">
          {steps.map((s, idx) => {
            const done = idx < stepsCompleted;
            const active = idx === stepsCompleted;
            return (
              <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all",
                    done && "border-reward bg-reward text-[hsl(30_60%_12%)] scale-100",
                    active && "border-primary bg-primary/10 text-primary scale-110",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.order}
                </div>
                <span
                  className={cn(
                    "truncate text-[9px] font-medium leading-tight",
                    active ? "text-primary" : done ? "text-reward" : "text-muted-foreground",
                  )}
                >
                  {s.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* 진행 바 */}
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-reward transition-all duration-500"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>

        {/* 보상 미리보기 + 직전 단계 보상 칩 */}
        <div className="mb-4 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            이번 단계 보상{" "}
            <b className="number-font text-reward">
              +{(TUTORIAL_STEP_REWARDS[currentStep.order] ?? 0).toLocaleString()}
            </b>
          </span>
          {recentReward != null && recentReward > 0 && (
            <StepRewardChip amount={recentReward} />
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={isSubmitting}
            className="flex-[2] rounded-2xl bg-gradient-to-r from-primary to-[hsl(13_85%_50%)] px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "지급 중…" : currentStep.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
