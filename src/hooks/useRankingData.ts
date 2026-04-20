import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RankedMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_bosses_cleared: number;
  r_total_xp: number;
  r_streak_days: number;
  rank_position: number;
}

interface WeeklyRanked {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  weekly_xp: number;
  rank_position: number;
}

interface MonthlyRanked {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  monthly_xp: number;
  rank_position: number;
}

interface StreakRanked {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_streak_days: number;
  rank_position: number;
}

interface BossRanked {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_bosses_cleared: number;
  rank_position: number;
}

/**
 * Branch override convention (used by all 5 ranking hooks below):
 *   undefined → "내 지점" (default — server falls back to caller's branch)
 *   null      → "전체 지점 통합" (super_admin only — server enforces)
 *   string    → 특정 지점명 (super_admin only — server enforces;
 *               non-admins get silently rewritten to their own branch)
 *
 * Security note: the server-side RPC is the source of truth. Non-admin
 * callers are force-scoped to their own branch regardless of the value
 * passed from the client. Frontend only gates the SUPER-ADMIN UI.
 */
type BranchOverride = string | null | undefined;

const resolveBranch = (
  override: BranchOverride,
  fallback: string | null | undefined,
): string | null => {
  if (override === undefined) return fallback ?? null;
  return override; // string or null
};

export const useDivisionRanking = (
  limit = 50,
  branchOverride?: BranchOverride,
) => {
  const { profile } = useAuth();
  const effective = resolveBranch(branchOverride, profile?.branch_name);
  return useQuery({
    queryKey: ["division-ranking", effective, limit],
    // enabled if either (a) super-admin passed explicit override (null OK)
    // or (b) regular user has a branch_name from profile
    enabled: branchOverride !== undefined || !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_division_ranking", {
        // `effective` may be null (all branches for super_admin) — the
        // migrated RPC accepts NULL. TS types lag until types.ts is
        // regenerated post-migration, hence the cast.
        _branch_name: effective as unknown as string,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as RankedMember[];
    },
  });
};

export const useRivalsAbove = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rivals-above", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rivals_above", {
        _user_id: user!.id,
        _count: 3,
      });
      if (error) throw error;
      return (data || []) as RankedMember[];
    },
  });
};

export const useWeeklyActivityRanking = (
  limit = 20,
  branchOverride?: BranchOverride,
) => {
  const { profile } = useAuth();
  const effective = resolveBranch(branchOverride, profile?.branch_name);
  return useQuery({
    queryKey: ["weekly-activity-ranking", effective, limit],
    enabled: branchOverride !== undefined || !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_weekly_activity_ranking", {
        _branch_name: effective as unknown as string,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as WeeklyRanked[];
    },
  });
};

export const useMonthlyRisers = (
  limit = 10,
  branchOverride?: BranchOverride,
) => {
  const { profile } = useAuth();
  const effective = resolveBranch(branchOverride, profile?.branch_name);
  return useQuery({
    queryKey: ["monthly-risers", effective, limit],
    enabled: branchOverride !== undefined || !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_risers", {
        _branch_name: effective as unknown as string,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as MonthlyRanked[];
    },
  });
};

export const useStreakRanking = (
  limit = 10,
  branchOverride?: BranchOverride,
) => {
  const { profile } = useAuth();
  const effective = resolveBranch(branchOverride, profile?.branch_name);
  return useQuery({
    queryKey: ["streak-ranking", effective, limit],
    enabled: branchOverride !== undefined || !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_streak_ranking", {
        _branch_name: effective as unknown as string,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as StreakRanked[];
    },
  });
};

export const useBossConquerors = (
  limit = 10,
  branchOverride?: BranchOverride,
) => {
  const { profile } = useAuth();
  const effective = resolveBranch(branchOverride, profile?.branch_name);
  return useQuery({
    queryKey: ["boss-conquerors", effective, limit],
    enabled: branchOverride !== undefined || !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_boss_conquerors", {
        _branch_name: effective as unknown as string,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as BossRanked[];
    },
  });
};

export const useSetRival = () => {
  const qc = useQueryClient();
  const { refreshProgress } = useAuth();
  return useMutation({
    mutationFn: async (rivalId: string) => {
      const { error } = await supabase.rpc("set_rival", { _rival_id: rivalId });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProgress();
      qc.invalidateQueries({ queryKey: ["rivals-above"] });
    },
  });
};

interface HallOfFameMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_bosses_cleared: number;
  r_total_xp: number;
  r_branch_name: string;
  rank_position: number;
}

export const useHallOfFame = (limit = 20) => {
  return useQuery({
    queryKey: ["hall-of-fame", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hall_of_fame", { _limit: limit });
      if (error) throw error;
      return (data || []) as HallOfFameMember[];
    },
  });
};

export const useMyRankPosition = () => {
  const { user } = useAuth();
  const { data: ranking } = useDivisionRanking();
  if (!ranking || !user) return null;
  const me = ranking.find(r => r.r_user_id === user.id);
  return me?.rank_position ?? null;
};

/** 현재 유저가 명예의 전당에 등재되어 있는지 Supabase에서 확인 */
export const useIsInHallOfFame = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-hall-of-fame", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("get_hall_of_fame", { _limit: 9999 });
      if (error) throw error;
      return (data ?? []).some((m: { r_user_id: string }) => m.r_user_id === user.id);
    },
  });
};

/**
 * Super-admin helper: list every branch name for the switcher UI.
 * Regular users never see the switcher, so the query is cheap enough
 * to leave un-gated; RLS on `branches` should allow public read
 * (SelectBranchPage already relies on that for signup).
 */
export const useBranchesList = () => {
  return useQuery({
    queryKey: ["branches-list"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });
};
