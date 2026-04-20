import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useTutorialState } from "@/hooks/useTutorialState";
import { cn } from "@/lib/utils";

interface TutorialOverlayProps {
  /**
   * Fired once complete_tutorial_once succeeds. `grantedGems` is the
   * server-reported amount (0 when already_granted, which we treat as
   * a no-celebration path — the user should only see the confetti on
   * the actual flip).
   */
  onCompleted?: (grantedGems: number) => void;
}

/**
 * Home-page tutorial modal (Step 5 — reward wiring active).
 *
 * Per-step behavior
 *   • profile / ranking / effect_shop
 *       — CTA navigates. Route-level visit tracker calls advance()
 *         when the user arrives.
 *   • mini_game
 *       — placeholder: CTA calls advance() directly (no navigation;
 *         avoids overlapping the overlay's own screen).
 *   • complete
 *       — "보상 받기" fires complete_tutorial_once via useTutorialState.
 *         Button disables while pending. On success the parent opens
 *         TutorialCompleteModal; on error a toast surfaces the message.
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
  } = useTutorialState();

  const [dismissed, setDismissed] = useState(false);

  if (!isEligible || dismissed) return null;

  const isMiniGame = currentStep.key === "mini_game";
  const isComplete = currentStep.key === "complete";
  const isSubmitting = completeReward.isPending;

  const handlePrimary = () => {
    if (isSubmitting) return;

    if (isComplete) {
      completeReward.mutate(undefined, {
        onSuccess: (result) => {
          const granted = result.granted_gems ?? 0;
          // already_granted path: server says nothing to hand out. Close
          // quietly — no celebration (user must have already seen it).
          if (result.already_granted || granted <= 0) {
            setDismissed(true);
            return;
          }
          setDismissed(true);
          onCompleted?.(granted);
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
  };

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
          aria-label="튜토리얼 닫기"
          disabled={isSubmitting}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              튜토리얼 {stepsCompleted}/{totalSteps}
            </p>
            <h2
              id="tutorial-title"
              className="text-lg font-bold leading-tight text-foreground"
            >
              {currentStep.label}
            </h2>
          </div>
        </div>

        {/* Step dots with check marks */}
        <div className="mb-3 flex items-center justify-between gap-1">
          {steps.map((s, idx) => {
            const done = idx < stepsCompleted;
            const active = idx === stepsCompleted;
            return (
              <div
                key={s.key}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.order}
                </div>
                <span
                  className={cn(
                    "truncate text-[9px] font-medium leading-tight",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {s.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
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

        <div className="mt-6 flex gap-2">
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
            className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "지급 중…" : currentStep.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
