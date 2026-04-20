import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, X } from "lucide-react";

import { useTutorialState } from "@/hooks/useTutorialState";
import { cn } from "@/lib/utils";

/**
 * Home-page tutorial modal (Step 4).
 *
 * Visibility
 *   mounts only when useTutorialState reports `isEligible`
 *   (logged in + !tutorial_completed + stepsCompleted < 5)
 *
 * Per-step behavior
 *   • profile / ranking / effect_shop
 *       — CTA navigates. Route-level visit tracker calls advance()
 *         when the user arrives, so the button itself does not
 *         advance — this prevents double-counting if the user returns
 *         to home without visiting the target.
 *   • mini_game
 *       — placeholder: CTA calls advance() directly (no navigation;
 *         avoids overlapping the overlay's own screen).
 *   • complete
 *       — 완료 button calls advance() (pushes stepsCompleted to 5
 *         which hides the overlay). Reward RPC is NOT invoked here —
 *         spec defers 1000-gem grant to a future step.
 */
export const TutorialOverlay = () => {
  const navigate = useNavigate();
  const {
    isEligible,
    currentStep,
    stepsCompleted,
    progressRatio,
    totalSteps,
    steps,
    advance,
  } = useTutorialState();

  const [dismissed, setDismissed] = useState(false);

  if (!isEligible || dismissed) return null;

  const isMiniGame = currentStep.key === "mini_game";
  const isComplete = currentStep.key === "complete";

  const handlePrimary = () => {
    if (isComplete) {
      advance();
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
          aria-label="튜토리얼 닫기"
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
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98]"
          >
            {currentStep.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
