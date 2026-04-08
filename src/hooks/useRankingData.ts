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

export const useDivisionRanking = (limit = 50) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["division-ranking", profile?.branch_name, limit],
    enabled: !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_division_ranking", {
        _branch_name: profile!.branch_name,
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

export const useWeeklyActivityRanking = (limit = 20) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["weekly-activity-ranking", profile?.branch_name],
    enabled: !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_weekly_activity_ranking", {
        _branch_name: profile!.branch_name,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as WeeklyRanked[];
    },
  });
};

export const useMonthlyRisers = (limit = 10) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["monthly-risers", profile?.branch_name],
    enabled: !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_risers", {
        _branch_name: profile!.branch_name,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as MonthlyRanked[];
    },
  });
};

export const useStreakRanking = (limit = 10) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["streak-ranking", profile?.branch_name],
    enabled: !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_streak_ranking", {
        _branch_name: profile!.branch_name,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as StreakRanked[];
    },
  });
};

export const useBossConquerors = (limit = 10) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["boss-conquerors", profile?.branch_name],
    enabled: !!profile?.branch_name,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_boss_conquerors", {
        _branch_name: profile!.branch_name,
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
