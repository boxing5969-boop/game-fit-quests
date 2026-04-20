import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsInHallOfFame } from "@/hooks/useRankingData";
import {
  computeUserLevel,
  getNewlyUnlockedBetween,
  resolveDisplayName,
  type UnlockCategory,
} from "@/data/unlockRules";

/**
 * Member-side new-unlock notifications (Step 7 of the unlock rollout).
 *
 * Baseline is stored on profiles.last_unlock_check_level (Step 2B
 * migration) — server-authoritative so device swaps don't re-fire
 * toasts. The baseline is backfilled at migration time to each user's
 * current computed level, so migration day stays quiet.
 *
 *   • observed > baseline → fire one summary toast, push new baseline
 *   • observed < baseline → silently resync (coach can level-down)
 *   • observed == baseline → noop
 */

export function useLevelUpNotifications() {
  const { user, profile, progress, refreshProfile } = useAuth();
  const { data: isInHallOfFame = false } = useIsInHallOfFame();
  // Per-user guard so a single mount fires at most one toast per level
  // change (profile may refetch multiple times between the observation
  // and the persisted baseline catching up).
  const pendingRef = useRef<{ userId: string; target: number } | null>(null);

  useEffect(() => {
    if (!user?.id || !profile || !progress) return;

    const p = profile as any;
    const baseline = typeof p.last_unlock_check_level === "number"
      ? p.last_unlock_check_level
      : 1;

    const observed = computeUserLevel({
      current_rank: progress.current_rank,
      current_level: progress.current_level,
      bosses_cleared: progress.bosses_cleared ?? 0,
      is_in_hall_of_fame: isInHallOfFame,
    });

    if (observed === baseline) return;

    // Prevent double-fire: if we already queued a push for this target,
    // wait for refreshProfile to pull the new baseline through.
    if (
      pendingRef.current &&
      pendingRef.current.userId === user.id &&
      pendingRef.current.target >= observed
    ) {
      return;
    }

    if (observed > baseline) {
      const newlyUnlocked = getNewlyUnlockedBetween(baseline, observed);
      if (newlyUnlocked.length > 0) {
        const head = newlyUnlocked[0];
        const headLabel = resolveDisplayName(
          head.category as UnlockCategory,
          head.itemKey,
          head.itemKey,
        );
        const extra = newlyUnlocked.length - 1;
        toast.success(
          extra > 0
            ? `새 아이템 ${newlyUnlocked.length}개 해금! 🎁 (${headLabel} 외 ${extra}개)`
            : `${headLabel} 해금! 🎁`,
        );
      }
    }

    pendingRef.current = { userId: user.id, target: observed };
    void supabase
      .rpc("update_last_unlock_check_level" as any, { _level: observed })
      .then(({ error }) => {
        if (error) {
          console.warn("[useLevelUpNotifications] baseline push failed", error);
          pendingRef.current = null;
          return;
        }
        void refreshProfile();
      });
  }, [user?.id, profile, progress, isInHallOfFame, refreshProfile]);
}
