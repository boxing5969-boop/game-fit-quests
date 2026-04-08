import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, Users, Clock, TrendingUp, FileText, User, ChevronRight, Bell } from "lucide-react";
import { formatRank, RANK_ICONS, isManagerRole } from "@/lib/rankLabels";
import { Input } from "@/components/ui/input";

const RANK_ORDER_MAP: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };

type FilterType = "all" | "pending" | "active" | "boss_ready" | "recent";
type SortType = "recent_submission" | "level_desc" | "pending_count";

const BranchManagerHome = () => {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("level_desc");

  const branchName = profile?.branch_name || "";

  // Branch stats
  const { data: stats } = useQuery({
    queryKey: ["branch-stats", branchName],
    enabled: !!branchName && isManagerRole(role),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_branch_stats", { _branch_name: branchName });
      if (error) throw error;
      return data as { total_members: number; pending_count: number; weekly_levelups: number; today_submissions: number };
    },
  });

  // Members list
  const { data: members, isLoading } = useQuery({
    queryKey: ["branch-members", branchName],
    enabled: !!branchName && isManagerRole(role),
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*, member_progress(*)")
        .eq("branch_name", branchName)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get pending counts per member
      const userIds = (profiles || []).map(p => p.user_id);
      if (!userIds.length) return [];

      const { data: missionPending } = await supabase
        .from("mission_submissions")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "pending");

      const { data: questPending } = await supabase
        .from("quest_submissions")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "pending");

      const pendingMap = new Map<string, number>();
      [...(missionPending || []), ...(questPending || [])].forEach(s => {
        pendingMap.set(s.user_id, (pendingMap.get(s.user_id) || 0) + 1);
      });

      return (profiles || []).map(p => {
        const prog = Array.isArray(p.member_progress) ? p.member_progress[0] : p.member_progress;
        return {
          ...p,
          prog,
          pendingCount: pendingMap.get(p.user_id) || 0,
          globalLevel: prog ? RANK_ORDER_MAP[prog.current_rank] * 10 + prog.current_level : 0,
        };
      });
    },
  });

  // Notifications count
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      if (error) return 0;
      return count || 0;
    },
  });

  const filtered = useMemo(() => {
    if (!members) return [];
    let list = [...members];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.nickname?.toLowerCase().includes(q) ||
        m.phone_number?.includes(q)
      );
    }

    // Filter
    if (filter === "pending") list = list.filter(m => m.pendingCount > 0);
    else if (filter === "boss_ready") list = list.filter(m => m.prog?.current_level === 10);
    else if (filter === "active") list = list.filter(m => m.prog && m.prog.streak_days > 0);

    // Sort
    if (sort === "level_desc") list.sort((a, b) => b.globalLevel - a.globalLevel);
    else if (sort === "pending_count") list.sort((a, b) => b.pendingCount - a.pendingCount);

    return list;
  }, [members, search, filter, sort]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "pending", label: "승인대기" },
    { key: "boss_ready", label: "보스전 대기" },
    { key: "active", label: "최근 활동" },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{branchName}</p>
          <h1 className="text-2xl text-foreground">우리 지점 회원관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/mypage")} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
            <Bell className="h-5 w-5 text-secondary-foreground" />
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
            <User className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatCard icon="👥" label="전체 회원" value={stats?.total_members ?? "-"} />
        <StatCard icon="⏳" label="승인대기" value={stats?.pending_count ?? "-"} highlight />
        <StatCard icon="🔥" label="이번 주 승급" value={stats?.weekly_levelups ?? "-"} />
        <StatCard icon="📝" label="오늘 제출" value={stats?.today_submissions ?? "-"} />
      </div>

      {/* Search */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 닉네임, 전화번호 검색"
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Filters */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="mb-4 flex gap-1.5">
        {([
          { key: "level_desc" as SortType, label: "레벨순" },
          { key: "pending_count" as SortType, label: "승인대기순" },
        ]).map(s => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
              sort === s.key ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Member List */}
      <div className="space-y-2">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <span className="text-3xl">👥</span>
            <p className="mt-2 text-sm text-muted-foreground">
              {search ? "검색 결과가 없습니다" : "회원이 없습니다"}
            </p>
          </div>
        ) : (
          filtered.map(m => (
            <button
              key={m.id}
              onClick={() => navigate(`/manager/member/${m.user_id}`)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <span>{m.prog ? RANK_ICONS[m.prog.current_rank] : "⚪"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground truncate">{m.nickname || m.name}</span>
                    {m.pendingCount > 0 && (
                      <span className="shrink-0 rounded-full bg-status-pending/20 px-1.5 py-0.5 text-[9px] font-bold text-status-pending">
                        {m.pendingCount}건 대기
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {m.prog && (
                      <>
                        <span className="font-medium">{formatRank(m.prog.current_rank, m.prog.current_level)}</span>
                        <span>·</span>
                        <span>{m.globalLevel}/40</span>
                      </>
                    )}
                    {m.phone_number && (
                      <>
                        <span>·</span>
                        <span>{m.phone_number.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Quick action: go to member app */}
      <div className="mt-6">
        <button
          onClick={() => navigate("/home")}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm font-bold text-foreground">회원 앱으로 보기</p>
                <p className="text-xs text-muted-foreground">내 회원 화면 확인하기</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, highlight }: { icon: string; label: string; value: number | string; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-3 ${highlight && typeof value === "number" && value > 0 ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"}`}>
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${highlight && typeof value === "number" && value > 0 ? "text-status-pending" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  </div>
);

export default BranchManagerHome;
