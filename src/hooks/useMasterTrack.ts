import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import {
  MASTER_LEVEL_DEFINITIONS,
  canEnterMasterTrack,
  getMasterLevelDefinition,
  isMasterBossLevel,
  type MasterLevelDefinition,
} from "@/data/masterTierData";

/**
 * Client hooks for the Master Track 41~99 RPCs.
 *
 *   enter_master_track(_member_id)             — opt-in entry
 *   advance_master_level(_member_id)           — non-boss advance
 *   attempt_master_boss(_member_id, passed, note) — boss pass/fail
 *
 * All three are coach-facing by default (or self-call for enter).
 * They return JSON envelopes with a `success` flag — failures surface
 * as thrown Errors here so React Query mutation callers can use the
 * standard onError path.
 */

interface TrackEnvelopeBase {
  success: boolean;
  error?: string;
  required?: string;
}

interface EnterResult extends TrackEnvelopeBase {
  already_unlocked?: boolean;
  master_level?: number | null;
  overall_level?: number;
}

interface AdvanceResult extends TrackEnvelopeBase {
  master_level?: number;
  overall_level?: number;
  granted_gems?: number;
}

interface BossResult extends TrackEnvelopeBase {
  passed?: boolean;
  master_level?: number;
  overall_level?: number;
  granted_gems?: number;
  title_reward?: string | null;
  frame_reward?: string | null;
  aura_reward?: string | null;
  xp_before?: number;
  xp_after?: number;
  xp_lost?: number;
  retention_pct?: number;
}

const throwIfEnvelopeFailed = <T extends TrackEnvelopeBase>(result: T): T => {
  if (!result.success) {
    throw new Error(result.error ?? "master_track_rpc_failed");
  }
  return result;
};

export function useEnterMasterTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string): Promise<EnterResult> => {
      const { data, error } = await supabase.rpc(
        "enter_master_track" as any,
        { _member_id: memberId },
      );
      if (error) throw error;
      return throwIfEnvelopeFailed((data ?? {}) as EnterResult);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
    },
  });
}

export function useAdvanceMasterLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      expectedCurrent,
    }: {
      memberId: string;
      /** Current master_level as the client sees it — server rejects
       *  with stale_state if it has moved under us. Always pass when
       *  available to kill the double-click race. */
      expectedCurrent?: number;
    }): Promise<AdvanceResult> => {
      const { data, error } = await supabase.rpc(
        "advance_master_level" as any,
        {
          _member_id: memberId,
          _expected_current: expectedCurrent ?? null,
        },
      );
      if (error) throw error;
      return throwIfEnvelopeFailed((data ?? {}) as AdvanceResult);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["member-wallet"] });
    },
  });
}

export function useAttemptMasterBoss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      passed,
      coachNote,
      expectedCurrent,
    }: {
      memberId: string;
      passed: boolean;
      coachNote?: string;
      expectedCurrent?: number;
    }): Promise<BossResult> => {
      const { data, error } = await supabase.rpc(
        "attempt_master_boss" as any,
        {
          _member_id: memberId,
          _passed: passed,
          _coach_note: coachNote ?? null,
          _expected_current: expectedCurrent ?? null,
        },
      );
      if (error) throw error;
      return throwIfEnvelopeFailed((data ?? {}) as BossResult);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["member-wallet"] });
      qc.invalidateQueries({ queryKey: ["owned-customizations"] });
    },
  });
}

// ── Static accessors re-exported for convenience ───────────────────
export {
  MASTER_LEVEL_DEFINITIONS,
  canEnterMasterTrack,
  getMasterLevelDefinition,
  isMasterBossLevel,
};
export type { MasterLevelDefinition };
