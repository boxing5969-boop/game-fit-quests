import { useEffect, useRef } from "react";
import { toast } from "sonner";

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
 * Levels are authored by coaches via grant_manual_xp / manual_level_up /
 * pass_boss_battle RPCs, so the member doesn't trigger their own level-up
 * directly. We therefore detect the change *observationally*: compare the
 * derived userLevel on each progress update to a localStorage snapshot.
 *
 *   • first observation  → seed snapshot, no toast
 *   • snapshot increased → fire one summary toast of newly unlocked items
 *   • snapshot decreased → silently resync (coach can level-down too)
 *
 * The snapshot is keyed per-user so shared devices don't cross-fire.
 * Clearing storage resets the baseline — at worst the next real level-up
 * toast is suppressed once; no double-grant risk because this is UI-only.
 */
const PREV_LEVEL_KEY = "153_user_level_snapshot";

export function useLevelUpNotifications() {
  const { user, progress } = useAuth();
  const { data: isInHallOfFame = false } = useIsInHallOfFame();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !progress) return;

    const nowLevel = computeUserLevel({
      current_rank: progress.current_rank,
      current_level: progress.current_level,
      bosses_cleared: progress.bosses_cleared ?? 0,
      is_in_hall_of_fame: isInHallOfFame,
    });

    const storageKey = `${PREV_LEVEL_KEY}:${user.id}`;
    let prev: number | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) prev = Number(raw);
    } catch {
      // storage disabled — skip; we just won't notify this session
    }

    if (prev == null || Number.isNaN(prev)) {
      try {
        localStorage.setItem(storageKey, String(nowLevel));
      } catch {
        /* noop */
      }
      seededRef.current = true;
      return;
    }

    if (nowLevel > prev) {
      const newlyUnlocked = getNewlyUnlockedBetween(prev, nowLevel);
      try {
        localStorage.setItem(storageKey, String(nowLevel));
      } catch {
        /* noop */
      }
      if (newlyUnlocked.length === 0) return;

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
    } else if (nowLevel < prev) {
      try {
        localStorage.setItem(storageKey, String(nowLevel));
      } catch {
        /* noop */
      }
    }
  }, [user?.id, progress, isInHallOfFame]);
}
