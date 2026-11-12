import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, UserX, ChevronRight, MessageSquare } from "lucide-react";
import { formatRankShort, RANK_ICONS } from "@/lib/rankLabels";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStarterWatchlist } from "@/hooks/useMotivation";
import { isBehind, lastVisitLabel, type StarterWatchlist } from "@/lib/motivation153";
import { kstToday } from "@/lib/attendanceCheer";

type RiskLevel = "mild" | "moderate" | "severe";

interface AtRiskMember {
  user_id: string;
  nickname: string;
  name: string;
  avatar_url: string | null;
  branch_name: string;
  current_rank: string;
  current_level: number;
  total_xp: number;
  streak_days: number;
  last_activity_date: string | null;
  inactive_days: number;
  risk: RiskLevel;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode; minDays: number }> = {
  mild: { label: "주의", color: "text-status-pending", bg: "bg-status-pending/10", icon: <Clock className="h-4 w-4" />, minDays: 5 },
  moderate: { label: "위험", color: "text-reward-foreground", bg: "bg-reward/10", icon: <AlertTriangle className="h-4 w-4" />, minDays: 14 },
  severe: { label: "이탈 위험", color: "text-destructive", bg: "bg-destructive/10", icon: <UserX className="h-4 w-4" />, minDays: 30 },
};

/**
 * 🥊 첫 4주 신규 (2026-11-12 동기부여 1단계 · 대표님 「추천대로」 — 선릉역점만 먼저)
 *   첫 출석부터 28일 안의 회원 · 창 안 출석(n/8) · 마지막 출석 — 주 2번 속도보다 늦은 회원이 위로(서버 정렬).
 *   선릉역점 신규는 첫 4주 8번이면 3개월째 77%가 남고 1~3번이면 23% — 코치님이 먼저 이름을 불러 줄 회원.
 *   서버 get_starter_watchlist(켠 지점 지도진 · 대표님) — 켜지 않은 지점이거나 함수가 없으면 그리지 않는다.
 */
export const StarterWatchList = ({ data, onOpen }: { data: StarterWatchlist | undefined; onOpen: (userId: string) => void }) => {
  if (!data?.on || data.rows.length === 0) return null;
  const today = data.today ?? kstToday();
  const behind = data.rows.filter((r) => isBehind(r, data.goal)).length;
  return (
    <section aria-label="첫 4주 신규" className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">첫 4주 신규 {data.rows.length}명</p>
        {behind > 0 && <span className="rounded-full bg-status-pending/15 px-2 py-0.5 text-[10px] font-bold text-status-pending">먼저 챙길 회원 {behind}명</span>}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">첫 출석부터 4주 안에 {data.goal}번 · 주 2번 속도보다 늦은 회원이 위에 있어요</p>
      <div className="mt-2 space-y-1.5">
        {data.rows.map((r) => {
          const late = isBehind(r, data.goal);
          return (
            <button
              key={r.userId}
              type="button"
              onClick={() => onOpen(r.userId)}
              className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-9 w-9 object-cover" /> : r.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-foreground">{r.name}</span>
                  {r.realName && r.realName !== r.name && <span className="truncate text-[10px] text-muted-foreground">{r.realName}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {r.day}일째 · {lastVisitLabel(r.lastDay, today)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${
                  r.done ? "bg-reward/20 text-reward-foreground" : late ? "bg-status-pending/15 text-status-pending" : "bg-primary/15 text-primary"
                }`}
              >
                {r.done ? "달성" : `${r.count}/${data.goal}`}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </section>
  );
};

const StarterWatchSection = () => {
  const navigate = useNavigate();
  const { data } = useStarterWatchlist();
  return <StarterWatchList data={data} onOpen={(id) => navigate(`/manager/member/${id}`)} />;
};

const AtRiskMembersPanel = () => {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const branchName = profile?.branch_name || "";
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [quickNote, setQuickNote] = useState<{ userId: string; text: string } | null>(null);

  const { data: atRiskMembers, isLoading } = useQuery({
    queryKey: ["at-risk-members", branchName, isSuperAdmin],
    enabled: !!branchName || isSuperAdmin,
    queryFn: async () => {
      // Get all members with progress
      let profileQuery = supabase.from("profiles").select("user_id, nickname, name, avatar_url, branch_name, is_approved").eq("is_approved", true);
      if (!isSuperAdmin) profileQuery = profileQuery.eq("branch_name", branchName);
      const { data: profiles, error: pErr } = await profileQuery;
      if (pErr) throw pErr;
      if (!profiles?.length) return [];

      const userIds = profiles.map(p => p.user_id);

      // Get progress and latest attendance
      const [progressRes, attendanceRes, rolesRes] = await Promise.all([
        supabase.from("member_progress").select("user_id, current_rank, current_level, total_xp, streak_days").in("user_id", userIds),
        supabase.from("attendance_logs").select("user_id, checked_in_at").in("user_id", userIds).order("checked_in_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);

      const progressMap = new Map((progressRes.data || []).map(p => [p.user_id, p]));
      const managerIds = new Set((rolesRes.data || []).filter((r: any) => ["super_admin", "admin", "branch_manager", "coach"].includes(r.role)).map((r: any) => r.user_id));

      // Build last attendance map
      const lastAttendance = new Map<string, string>();
      (attendanceRes.data || []).forEach(a => {
        if (!lastAttendance.has(a.user_id)) lastAttendance.set(a.user_id, a.checked_in_at);
      });

      // Also check xp_logs for last activity
      const { data: xpLogs } = await supabase.from("xp_logs").select("user_id, created_at").in("user_id", userIds).order("created_at", { ascending: false });
      const lastXp = new Map<string, string>();
      (xpLogs || []).forEach(x => {
        if (!lastXp.has(x.user_id)) lastXp.set(x.user_id, x.created_at);
      });

      const today = new Date();
      const results: AtRiskMember[] = [];

      profiles.forEach(p => {
        if (managerIds.has(p.user_id)) return; // Skip managers
        const prog = progressMap.get(p.user_id);
        if (!prog) return;

        const lastAtt = lastAttendance.get(p.user_id);
        const lastXpDate = lastXp.get(p.user_id);
        const lastDate = [lastAtt, lastXpDate].filter(Boolean).sort().reverse()[0] || null;

        let inactiveDays = 999;
        if (lastDate) {
          inactiveDays = Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000);
        }

        if (inactiveDays < 5) return; // Not at risk

        let risk: RiskLevel = "mild";
        if (inactiveDays >= 30) risk = "severe";
        else if (inactiveDays >= 14) risk = "moderate";

        results.push({
          user_id: p.user_id,
          nickname: p.nickname || p.name || "회원",
          name: p.name || "",
          avatar_url: p.avatar_url,
          branch_name: p.branch_name,
          current_rank: prog.current_rank,
          current_level: prog.current_level,
          total_xp: prog.total_xp,
          streak_days: prog.streak_days,
          last_activity_date: lastDate,
          inactive_days: inactiveDays,
          risk,
        });
      });

      results.sort((a, b) => b.inactive_days - a.inactive_days);
      return results;
    },
  });

  const filtered = useMemo(() => {
    if (!atRiskMembers) return [];
    if (filter === "all") return atRiskMembers;
    return atRiskMembers.filter(m => m.risk === filter);
  }, [atRiskMembers, filter]);

  const counts = useMemo(() => {
    if (!atRiskMembers) return { mild: 0, moderate: 0, severe: 0, total: 0 };
    return {
      mild: atRiskMembers.filter(m => m.risk === "mild").length,
      moderate: atRiskMembers.filter(m => m.risk === "moderate").length,
      severe: atRiskMembers.filter(m => m.risk === "severe").length,
      total: atRiskMembers.length,
    };
  }, [atRiskMembers]);

  const handleQuickNote = async () => {
    if (!quickNote?.text.trim() || !quickNote.userId) return;
    try {
      const { error } = await supabase.from("manager_notes").insert({
        user_id: quickNote.userId,
        manager_id: profile?.user_id || "",
        content: quickNote.text,
        note_type: "internal",
      });
      if (error) throw error;
      toast.success("메모 저장 완료");
      setQuickNote(null);
    } catch {
      toast.error("메모 저장 실패");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <StarterWatchSection />
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StarterWatchSection />
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {(["mild", "moderate", "severe"] as RiskLevel[]).map(r => {
          const cfg = RISK_CONFIG[r];
          return (
            <button
              key={r}
              onClick={() => setFilter(filter === r ? "all" : r)}
              className={`rounded-2xl border p-3 text-center transition-all active:scale-95 ${filter === r ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
            >
              <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
              </div>
              <p className={`text-lg font-bold ${cfg.color}`}>{counts[r]}</p>
              <p className="text-[9px] text-muted-foreground">{cfg.label} ({cfg.minDays}일+)</p>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">✅</span>
          <p className="mt-2 text-sm text-muted-foreground">
            {filter === "all" ? "복귀 위험 회원이 없습니다" : "해당 등급의 위험 회원이 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const cfg = RISK_CONFIG[m.risk];
            return (
              <div key={m.user_id} className={`rounded-2xl border ${cfg.bg} border-border overflow-hidden`}>
                <button
                  onClick={() => navigate(`/manager/member/${m.user_id}`)}
                  className="w-full p-3.5 text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span>{RANK_ICONS[m.current_rank] || "⚪"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground truncate">{m.nickname}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.bg} ${cfg.color}`}>
                          {m.inactive_days}일 미활동
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {isSuperAdmin && <span className="font-medium text-primary/70">{m.branch_name}</span>}
                        <span>{formatRankShort(m.current_rank, m.current_level)}</span>
                        <span>·</span>
                        <span>{m.total_xp} XP</span>
                        {m.last_activity_date && (
                          <>
                            <span>·</span>
                            <span>마지막: {new Date(m.last_activity_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </button>
                {/* Quick note button */}
                <div className="flex border-t border-border/50 px-3 py-2">
                  {quickNote?.userId === m.user_id ? (
                    <div className="flex flex-1 gap-2">
                      <input
                        value={quickNote.text}
                        onChange={e => setQuickNote({ ...quickNote, text: e.target.value })}
                        placeholder="한줄 메모 입력..."
                        className="flex-1 rounded-lg bg-card px-2.5 py-1.5 text-xs outline-none border border-border"
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && handleQuickNote()}
                      />
                      <button onClick={handleQuickNote} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-95">
                        저장
                      </button>
                      <button onClick={() => setQuickNote(null)} className="text-xs text-muted-foreground">취소</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setQuickNote({ userId: m.user_id, text: "" })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground active:scale-95"
                    >
                      <MessageSquare className="h-3 w-3" /> 한줄 메모
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AtRiskMembersPanel;
