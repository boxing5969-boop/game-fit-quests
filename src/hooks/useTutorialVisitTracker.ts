import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useTutorialState } from "@/hooks/useTutorialState";

/**
 * Visit-based tutorial completion (Step 4).
 *
 * Runs globally (mounted once in AppRoutes) and advances the tutorial
 * whenever the user navigates to the current step's `navTarget`:
 *
 *   profile    → /mypage
 *   ranking    → /halloffame
 *   effect_shop → /character-studio
 *   mini_game  → handled by an explicit button in TutorialOverlay
 *                (navTarget /home overlaps the overlay's own screen)
 *   complete   → explicit 완료 button (no navTarget)
 *
 * We only consider paths that differ from /home so that arriving at
 * the overlay's own screen can't accidentally auto-advance multiple
 * times. A ref-guard prevents double-fires on the same pathname
 * within one effect tick.
 */
export function useTutorialVisitTracker() {
  const location = useLocation();
  const { isEligible, currentStep, advance } = useTutorialState();
  const lastFiredRef = useRef<{ path: string; step: string } | null>(null);

  useEffect(() => {
    if (!isEligible) return;
    const target = currentStep.navTarget;
    if (!target || target === "/home") return;

    // Match as prefix so nested routes (e.g. /mypage/edit) still count.
    if (!location.pathname.startsWith(target)) return;

    // Don't re-fire on the same (step, path) tuple — protects against
    // profile refetch ticks that re-run this effect before the server
    // step value has caught up.
    if (
      lastFiredRef.current &&
      lastFiredRef.current.step === currentStep.key &&
      lastFiredRef.current.path === location.pathname
    ) {
      return;
    }
    lastFiredRef.current = { step: currentStep.key, path: location.pathname };

    advance();
  }, [location.pathname, isEligible, currentStep.key, currentStep.navTarget, advance]);
}
