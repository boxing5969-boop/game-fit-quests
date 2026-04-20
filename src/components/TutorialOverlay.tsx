import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Gem } from "lucide-react";
import { toast } from "sonner";

import { useTutorialState } from "@/hooks/useTutorialState";

/**
 * Home-page tutorial modal (Step 4 of the unlock-system rollout).
 *
 * Visibility rules
 *   • mounts only when useTutorialState reports `isEligible`
 *     (logged in + server says tutorial_completed = false)
 *   • per-mount `dismissed` state hides it after the user taps skip
 *     or navigates out via a step CTA. Re-entering HomePage produces
 *     a fresh mount → overlay shows again at the persisted step.
 *
 * Reward path
 *   • non-terminal steps: advance + navigate to step.navTarget
 *   • terminal step ("complete"): fire completeReward mutation
 *     → RPC flips profiles.tutorial_completed → isEligible becomes
 *     false → overlay unmounts naturally on next render.
 */
export const TutorialOverlay = () => {
  const navigate = useNavigate();
  const tutorial = useTutorialState();
  const {
    isEligible,
    currentStep,
    currentOrder,
    totalSteps,
    progressRatio,
    rewardGems,
    completeReward,
    advance,
  } = tutorial;

  const [dismissed, setDismissed] = useState(false);

  if (!isEligible || dismissed) return null;

  const isFinal = currentStep.key === "complete";
  const isSubmitting = completeReward.isPending;

  const handlePrimary = () => {
    if (isFinal) {
      completeReward.mutate(undefined, {
        onSuccess: (result) => {
          if (!result.already_granted && (result.granted_gems ?? 0) > 0) {
            toast.success(`튜토리얼 완료! +${result.granted_gems} 젬 지급 🎉`);
          }
          setDismissed(true);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "보상 지급 실패");
        },
      });
      return;
    }
    advance();
    if (currentStep.navTarget) {
      setDismissed(true);
      navigate(currentStep.navTarget);
    }
  };

  const handleSkip = () => setDismissed(true);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div
        className="relative w-full max-w-md animate-slide-up rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSkip}
          aria-label="튜토리얼 건너뛰기"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              튜토리얼 {currentOrder}/{totalSteps}
            </p>
            <h2
              id="tutorial-title"
              className="text-lg font-bold leading-tight text-foreground"
            >
              {currentStep.label}
            </h2>
          </div>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {currentStep.description}
        </p>

        {isFinal && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-reward/30 bg-reward/10 px-4 py-3 text-sm text-reward">
            <Gem className="h-4 w-4 shrink-0" />
            <span>
              보상 받기를 누르면 <b className="number-font">{rewardGems}</b> 젬이 지급됩니다.
            </span>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            disabled={isSubmitting}
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={isSubmitting}
            className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting ? "지급 중…" : currentStep.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
