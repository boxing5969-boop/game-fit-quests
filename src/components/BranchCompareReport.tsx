import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, Trophy, Zap } from "lucide-react";

interface BranchStat {
  branch_name: string;
  total_members: number;
  active_members: number;
  weekly_xp: number;
  avg_level: number;
  pending_count: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--rank-blue))", "hsl(var(--rank-red))", "#10b981", "#f59e0b"];

const BranchCompareReport = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["branch-compare"],
    queryFn: async () => {
      const { data: branches } = await supabase.from("branches").select("name").order("name");
      if (!branches?.length) return [];

      const results: BranchStat[] = [];

      for (const branch of branches) {
        const [profilesRes, progressRes, weeklyXpRes, pendingRes] = await Promise.all([
          supabase.from("profiles").select("user_id", { count: "exact" }).eq("branch_name", branch.name).eq("is_approved", true),
          supabase.from("member_progress").select("user_id, current_rank, current_level, streak_days")
            .in("user_id", (await supabase.from("profiles").select("user_id").eq("branch_name", branch.name)).data?.map(p => p.user_id) || []),
          supabase.from("xp_logs").select("amount")
            .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
            .in("user_id", (await supabase.from("profiles").select("user_id").eq("branch_name", branch.name)).data?.map(p => p.user_id) || []),
          supabase.from("mission_submissions").select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .in("user_id", (await supabase.from("profiles").select("user_id").eq("branch_name", branch.name)).data?.map(p => p.user_id) || []),
        ]);

        const RANK_ORDER: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };
        const progData = progressRes.data || [];
        const globalLevels = progData.map(p => (RANK_ORDER[p.current_rank] || 0) * 10 + p.current_level);
        const avgLevel = globalLevels.length ? Math.round(globalLevels.reduce((a, b) => a + b, 0) / globalLevels.length * 10) / 10 : 0;
        const activeMembers = progData.filter(p => p.streak_days > 0).length;
        const weeklyXp = (weeklyXpRes.data || []).reduce((s, x) => s + x.amount, 0);

        results.push({
          branch_name: branch.name,
          total_members: profilesRes.count || 0,
          active_members: activeMembers,
          weekly_xp: weeklyXp,
          avg_level: avgLevel,
          pending_count: pendingRes.count || 0,
        });
      }

      return results;
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>;
  }

  if (!stats?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-3xl">📊</span>
        <p className="mt-2 text-sm text-muted-foreground">지점 데이터가 없습니다</p>
      </div>
    );
  }

  const chartData = stats.map((s, i) => ({
    name: s.branch_name.length > 6 ? s.branch_name.slice(0, 6) + "…" : s.branch_name,
    회원수: s.total_members,
    주간XP: s.weekly_xp,
    평균레벨: s.avg_level,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">전체 회원</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.reduce((s, b) => s + b.total_members, 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">주간 총 XP</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.reduce((s, b) => s + b.weekly_xp, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Chart: Members per branch */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold text-foreground">지점별 회원 수</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip />
            <Bar dataKey="회원수" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart: Weekly XP per branch */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold text-foreground">지점별 주간 XP</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip />
            <Bar dataKey="주간XP" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Branch cards */}
      <div className="space-y-2">
        {stats.map(s => (
          <div key={s.branch_name} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{s.branch_name}</p>
              {s.pending_count > 0 && (
                <span className="rounded-full bg-status-pending/20 px-2 py-0.5 text-[10px] font-bold text-status-pending">
                  {s.pending_count}건 대기
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{s.total_members}</p>
                <p className="text-[9px] text-muted-foreground">회원</p>
              </div>
              <div>
                <p className="text-lg font-bold text-status-complete">{s.active_members}</p>
                <p className="text-[9px] text-muted-foreground">활동중</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{s.weekly_xp}</p>
                <p className="text-[9px] text-muted-foreground">주간 XP</p>
              </div>
              <div>
                <p className="text-lg font-bold text-rank-blue">{s.avg_level}</p>
                <p className="text-[9px] text-muted-foreground">평균 Lv</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BranchCompareReport;
