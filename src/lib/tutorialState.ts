/**
 * Pure helpers for reading tutorial state off a profile row.
 *
 * These exist so non-hook consumers (e.g. route guards, analytics, the
 * AuthContext, or a future onboarding banner) can ask the same questions
 * that `useTutorialState` answers, without having to import the hook or
 * duplicate the boolean logic.
 *
 * Write operations are intentionally NOT here — they must go through the
 * SECURITY DEFINER RPCs (update_tutorial_step, claim_tutorial_step_reward,
 * complete_tutorial_once, mark_tutorial_skipped, restart_tutorial) which
 * enforce GREATEST ratcheting, step-claim idempotency, and auth.uid().
 *
 * Shape note
 *   The profile passed in may come from:
 *     • types.ts (AuthContext.profile, fully typed)
 *     • a raw Supabase select (any cast)
 *   so every field is read defensively.
 */

export interface TutorialStateLike {
  tutorial_completed?: boolean | null;
  tutorial_step?: number | null;
  tutorial_reward_claimed?: boolean | null;
  tutorial_skipped?: boolean | null;
  tutorial_started_at?: string | null;
  tutorial_completed_at?: string | null;
}

export const TUTORIAL_TOTAL_STEPS = 5;

/**
 * Canonical step count (clamped 0..5). Use this instead of reading
 * tutorial_step directly so typos, nulls, and out-of-range values all
 * degrade to safe defaults.
 */
export function readTutorialStep(p: TutorialStateLike | null | undefined): number {
  const raw = p?.tutorial_step;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > TUTORIAL_TOTAL_STEPS) return TUTORIAL_TOTAL_STEPS;
  return Math.trunc(raw);
}

/**
 * Should the overlay auto-mount on this user's first home-screen visit?
 *
 * Mirrors useTutorialState.isEligible: logged-in + not completed + not
 * skipped + step < TOTAL. The auth check (is there even a user?) is left
 * to the caller so this helper stays pure.
 */
export function shouldAutoStartTutorial(
  p: TutorialStateLike | null | undefined,
): boolean {
  if (!p) return false;
  if (p.tutorial_completed) return false;
  if (p.tutorial_skipped) return false;
  return readTutorialStep(p) < TUTORIAL_TOTAL_STEPS;
}

/** Has the final 1000-gem reward been paid out? */
export function hasClaimedTutorialReward(
  p: TutorialStateLike | null | undefined,
): boolean {
  return !!p?.tutorial_reward_claimed;
}

/** Has the user ever opened the tutorial (or explicitly skipped it)? */
export function hasTouchedTutorial(
  p: TutorialStateLike | null | undefined,
): boolean {
  if (!p) return false;
  return (
    !!p.tutorial_started_at ||
    !!p.tutorial_skipped ||
    !!p.tutorial_completed ||
    readTutorialStep(p) > 0
  );
}
