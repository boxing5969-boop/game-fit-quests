import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DASHBOARD_MOCK_METRICS, type WeeklyMetrics } from "@/data/dashboardMockData";

/**
 * Calculates weekly stats from xp_logs.
 * Falls back to mock data when real data is unavailable.
 */
export function useWeeklyStats(): WeeklyMetrics {
  const { user } = useAuth();

  const { data: xpLogs } = useQuery({
    queryKey: ["weekly-xp-logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("xp_logs")
        .select("amount, reason, created_at")
        .eq("user_id", user!.id)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return useMemo(() => {
    if (!xpLogs || xpLogs.length === 0) return DASHBOARD_MOCK_METRICS;

    // Estimate activity minutes from XP (rough: 1 XP ≈ 1 min activity)
    const totalXp = xpLogs.reduce((sum, l) => sum + l.amount, 0);
    const activityMinutes = Math.round(totalXp * 1.5);

    // Count unique days with activity as strength proxy
    const uniqueDays = new Set(xpLogs.map(l => l.created_at.slice(0, 10)));
    const strengthDays = Math.min(uniqueDays.size, 7);

    return {
      activityMinutes,
      strengthDays: Math.min(strengthDays, 2),
      averageRpe: 4,
      highIntensitySessions: Math.min(Math.floor(xpLogs.length / 3), 5),
      balanceSessions: 0,
      isOver65: false,
      hasBalanceFlag: false,
    };
  }, [xpLogs]);
}
