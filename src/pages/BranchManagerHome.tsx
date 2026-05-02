import { useState, useMemo } from "react";
import CoachLevelReviewInbox from "@/components/CoachLevelReviewInbox";
import DailyOperationsBoard from "@/components/DailyOperationsBoard";
import AtRiskMembersPanel from "@/components/AtRiskMembersPanel";
import LevelAdminPanel from "@/components/admin/LevelAdminPanel";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users, User, ChevronRight, Bell, Inbox, UserCheck, UserX, Download, AlertTriangle, BarChart3 } from "lucide-react";
import { formatRank, RANK_ICONS, isManagerRole } from "@/lib/rankLabels";
import { Input } from "@/components/ui/input";
import ApprovalInbox from "@/components/ApprovalInbox";
import { toast } from "sonner";

const RANK_ORDER_MAP: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };

type FilterType = "all" | "pending" | "active" | "boss_ready" | "unapproved";
type SortType = "recent_submission" | "level_desc" | "pending_count";
type MainTab = "members" | "inbox" | "level_review" | "operations" | "at_risk";

const BranchManagerHome = () => {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("level_desc");
  const [mainTab, setMainTab] = useState<MainTab>("members");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const branchName = profile?.branch_name || "";
  const isSuperAdmin = role === "super_admin" || role === "admin";

  // Branch stats
  const { data: stats } = useQuery({
    queryKey: ["branch-stats", branchName, isSuperAdmin],
    enabled: !!branchName && isManagerRole(role),
    queryFn: async () => {
      if (isSuperAdmin) {
        // Super admin: aggregate stats from all branches
        const [profilesRes, pendingMissionsRes, pendingQuestsRes, xpRes, submissionsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, is_approved", { count: "exact" }),
          supabase.from("mission_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("quest_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("xp_logs").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
          supabase.from("mission_submissions").select("id", { count: "exact", head: true }).gte("requested_at", new Date().toISOString().split("T")[0]),
        ]);
        const profiles = profilesRes.data || [];
        const unapproved = profiles.filter(p => !p.is_approved).length;
        return {
          total_members: profiles.length,
          pending_count: unapproved + (pendingMissionsRes.count || 0) + (pendingQuestsRes.count || 0),
          weekly_levelups: xpRes.count || 0,
          today_submissions: submissionsRes.count || 0,
        };
      }
      const { data, error } = await supabase.rpc("get_branch_stats", { _branch_name: branchName });
      if (error) throw error;
      return data as { total_members: number; pending_count: number; weekly_levelups: number; today_submissions: number };
    },
  });

  // Members list
  const { data: members, isLoading } = useQuery({
    queryKey: ["branch-members", branchName, isSuperAdmin],
    enabled: (!!branchName || isSuperAdmin) && isManagerRole(role),
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!isSuperAdmin) {
        query = query.eq("branch_name", branchName);
      }
      const { data: profiles, error: profErr } = await query;
      if (profErr) throw profErr;

      const userIds = (profiles || []).map(p => p.user_id);
      if (!userIds.length) return [];

      const [progressRes, missionPendingRes, questPendingRes, rolesRes, providerRes] = await Promise.all([
        supabase.from("member_progress").select("*").in("user_id", userIds),
        supabase.from("mission_submissions").select("user_id").in("user_id", userIds).eq("status", "pending"),
        supabase.from("quest_submissions").select("user_id").in("user_id", userIds).eq("status", "pending"),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.rpc("get_signup_providers", { _user_ids: userIds }),
      ]);

      const progressMap = new Map<string, typeof progressRes.data extends (infer T)[] | null ? T : never>();
      (progressRes.data || []).forEach(p => progressMap.set(p.user_id, p));

      const pendingMap = new Map<string, number>();
      [...(missionPendingRes.data || []), ...(questPendingRes.data || [])].forEach(s => {
        pendingMap.set(s.user_id, (pendingMap.get(s.user_id) || 0) + 1);
      });

      const roleMap = new Map<string, string>();
      (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      const providerMap = new Map<string, string>();
      (providerRes.data || []).forEach((r: any) => providerMap.set(r.user_id, r.signup_provider));

      return (profiles || []).map(p => {
        const prog = progressMap.get(p.user_id) || null;
        return {
          ...p,
          prog,
          pendingCount: pendingMap.get(p.user_id) || 0,
          globalLevel: prog ? RANK_ORDER_MAP[prog.current_rank] * 10 + prog.current_level : 0,
          memberRole: roleMap.get(p.user_id) || "member",
          signupProvider: providerMap.get(p.user_id) || "email",
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

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.nickname?.toLowerCase().includes(q) ||
        m.phone_number?.includes(q)
      );
    }

    if (filter === "pending") list = list.filter(m => m.pendingCount > 0);
    else if (filter === "unapproved") list = list.filter(m => !(m as any).is_approved);
    else if (filter === "boss_ready") list = list.filter(m => m.prog?.current_level === 10);
    else if (filter === "active") list = list.filter(m => m.prog && m.prog.streak_days > 0);

    if (sort === "level_desc") list.sort((a, b) => b.globalLevel - a.globalLevel);
    else if (sort === "pending_count") list.sort((a, b) => b.pendingCount - a.pendingCount);

    return list;
  }, [members, search, filter, sort]);

  const unapprovedCount = useMemo(() => members?.filter(m => !(m as any).is_approved).length || 0, [members]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "unapproved", label: `가입승인 (${unapprovedCount})` },
    { key: "pending", label: "미션대기" },
    { key: "boss_ready", label: "보스전 대기" },
    { key: "active", label: "최근 활동" },
  ];

  const handleApproveMember = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.rpc("approve_member", { _member_id: userId });
      if (error) throw error;
       toast.success("회원 가입을 승인했습니다");
       queryClient.invalidateQueries({ queryKey: ["branch-members"] });
       queryClient.invalidateQueries({ queryKey: ["branch-stats"] });
       queryClient.invalidateQueries({ queryKey: ["approval-inbox"] });
       queryClient.refetchQueries({ queryKey: ["branch-members"] });
       queryClient.refetchQueries({ queryKey: ["branch-stats"] });
       queryClient.refetchQueries({ queryKey: ["approval-inbox"] });
    } catch (err: any) {
      toast.error(err.message || "승인 실패");
    }
  };

  const handleRejectMember = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.rpc("reject_member", { _member_id: userId });
      if (error) throw error;
       toast.success("회원 가입을 거절했습니다");
       queryClient.invalidateQueries({ queryKey: ["branch-members"] });
       queryClient.invalidateQueries({ queryKey: ["branch-stats"] });
       queryClient.invalidateQueries({ queryKey: ["approval-inbox"] });
       queryClient.refetchQueries({ queryKey: ["branch-members"] });
       queryClient.refetchQueries({ queryKey: ["branch-stats"] });
       queryClient.refetchQueries({ queryKey: ["approval-inbox"] });
    } catch (err: any) {
      toast.error(err.message || "거절 실패");
    }
  };

  const handleExportCsv = () => {
    if (!filtered?.length) { toast.info("내보낼 데이터가 없습니다"); return; }
    const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
    const header = "이름,닉네임,지점,리그,레벨,XP,연속일,승인\n";
    const rows = filtered.map(m => [
      m.name, m.nickname, m.branch_name,
      RANK_LABELS[m.prog?.current_rank || "white"],
      m.prog?.current_level || 1, m.prog?.total_xp || 0,
      m.prog?.streak_days || 0, (m as any).is_approved ? "Y" : "N",
    ].join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `회원목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV 내보내기 완료");
  };

  const handleMemberClick = (userId: string) => {
    if (window.innerWidth >= 1024) {
      setSelectedMemberId(userId);
    } else {
      navigate(`/manager/member/${userId}`);
    }
  };

  // ── Member List Panel (shared between mobile and desktop) ──
  const MemberListContent = () => (
    <>
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
          filtered.map(m => {
            const isApproved = (m as any).is_approved;
            return (
            <div
              key={m.id}
              className={`rounded-2xl border bg-card shadow-elev-1 transition-all ${
                selectedMemberId === m.user_id ? "border-primary ring-2 ring-primary/20" : "border-border"
              } ${!isApproved ? "border-amber-500/30 bg-amber-50/50" : ""}`}
            >
              <button
                onClick={() => handleMemberClick(m.user_id)}
                className="w-full p-4 text-left active:scale-[0.98] transition-all"
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
                      {(m as any).memberRole === "branch_manager" || (m as any).memberRole === "coach" ? (
                        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">관장님</span>
                      ) : null}
                      {!isApproved && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                          승인대기
                        </span>
                      )}
                      {isApproved && m.pendingCount > 0 && (
                        <span className="shrink-0 rounded-full bg-status-pending/20 px-1.5 py-0.5 text-[9px] font-bold text-status-pending">
                          {m.pendingCount}건 대기
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {isSuperAdmin && m.branch_name && (
                        <>
                          <span className="font-medium text-primary/70">{m.branch_name}</span>
                          <span>·</span>
                        </>
                      )}
                      <span className="text-[10px]">{(m as any).signupProvider === "google" ? "Google" : (m as any).signupProvider === "apple" ? "Apple" : "일반"}</span>
                      <span>·</span>
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
              {!isApproved && (
                <div className="flex gap-2 border-t border-border px-4 py-2.5">
                  <button
                    onClick={(e) => handleApproveMember(m.user_id, e)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95"
                  >
                    <UserCheck className="h-4 w-4" /> 승인
                  </button>
                  <button
                    onClick={(e) => handleRejectMember(m.user_id, e)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive/10 py-2.5 text-sm font-bold text-destructive transition-all active:scale-95"
                  >
                    <UserX className="h-4 w-4" /> 거절
                  </button>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>

      {/* Quick action: checkin board + member app + admin */}
      <div className="mt-6 space-y-2">
        <button
          onClick={() => navigate("/manager/checkin-board")}
          className="w-full rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left shadow-elev-1 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-sm font-bold text-foreground">체크인 보드 관리</p>
                <p className="text-xs text-muted-foreground">QR 체크인 · 라이브 보드 · 로그</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </div>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full rounded-2xl border border-reward/30 bg-reward/5 p-4 text-left shadow-elev-1 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-bold text-foreground">전체관리자 대시보드</p>
                  <p className="text-xs text-muted-foreground">지점 비교 · 위험 회원 · 공지 · 이전 승인</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-reward-foreground" />
            </div>
          </button>
        )}
        <button
          onClick={handleExportCsv}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">회원 목록 CSV 내보내기</p>
                <p className="text-xs text-muted-foreground">현재 필터 적용된 회원 목록 다운로드</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
        <button
          onClick={() => navigate("/home")}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 transition-all active:scale-[0.98]"
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
    </>
  );

  // ── Desktop Right Panel (iframe preview) ──
  const DesktopDetailPanel = () => {
    if (!selectedMemberId) {
      return (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <span className="text-5xl">👈</span>
            <p className="mt-4 text-lg font-bold text-foreground">회원을 선택하세요</p>
            <p className="mt-1 text-sm text-muted-foreground">좌측에서 회원을 클릭하면 상세 정보가 여기에 표시됩니다</p>
          </div>
        </div>
      );
    }

    /*
      이전엔 우측 패널을 iframe 으로 미리보기 했지만, super_admin 의
      profile.branch_name 이 null 인 경우 ProtectedRoute 가 iframe 안에서
      `/select-branch` 로 redirect → 그 페이지가 다시 redirect 하며 무한
      루프가 발생했다 (RouteLoader 가 초당 수십 번 깜빡거림). iframe 의
      auth context 가 부모와 별도 인스턴스로 시작하면서 발생하는 알려진
      문제이며, iframe 의 메모리/CPU 부담도 큰 편이라 React 컴포넌트
      직접 렌더 또는 명시적 navigate 으로 전환하는 게 정답. 본 fix 에서는
      이미 존재하는 `/manager/member/:memberId` 라우트로 navigate 만 한다.
      회원 상세는 전체 화면에서 보고, 우측 패널에는 선택 안내만 표시.
    */
    return (
      <div
        className="flex h-full flex-col"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, #0B0F16 0%, #06070B 70%, #03040A 100%)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/40 bg-card/80 px-4 py-3 backdrop-blur-sm">
          <p className="text-sm font-bold text-white">회원 상세</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/manager/member/${selectedMemberId}/preview`)}
              className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition-all active:scale-95"
            >
              📱 회원 앱 보기
            </button>
            <button
              onClick={() => navigate(`/manager/member/${selectedMemberId}`)}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-all active:scale-95"
            >
              전체 화면 →
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* ─── 빠른 액션 — 관리자 레벨 조정 (super_admin/관장/코치만 표시) ─── */}
          <div className="mx-auto mb-5 w-full max-w-md">
            <LevelAdminPanel memberId={selectedMemberId} mode="compact" />
          </div>

          {/* ─── 안내 + 전체 화면 진입 ─── */}
          <div className="mx-auto max-w-md text-center">
            <span className="text-4xl">🥊</span>
            <p className="mt-3 text-sm font-bold text-white">
              회원 상세 정보 보기
            </p>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-white/60 mx-auto">
              상단 <strong className="text-primary">전체 화면 →</strong> 버튼 또는
              아래 버튼으로 상세 페이지로 이동하세요. 모바일 앱 화면을
              미리 보려면 <strong className="text-primary">📱 회원 앱 보기</strong>.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => navigate(`/manager/member/${selectedMemberId}`)}
                className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] hover:brightness-110"
              >
                회원 상세 열기
              </button>
              <button
                onClick={() => navigate(`/manager/member/${selectedMemberId}/preview`)}
                className="rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary transition-all active:scale-[0.98] hover:bg-primary/20"
              >
                회원 앱 미리보기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Mobile Layout (< lg) ── */}
      <div className="lg:hidden mx-auto max-w-lg px-4 pb-32 pt-4">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{isSuperAdmin ? "전체 지점" : branchName}</p>
            <h1 className="text-2xl text-foreground">{isSuperAdmin ? "전체 회원관리" : "우리 지점 회원관리"}</h1>
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
          <button onClick={() => setMainTab("inbox")} className="text-left">
            <StatCard icon="⏳" label="승인대기" value={stats?.pending_count ?? "-"} highlight />
          </button>
          <StatCard icon="🔥" label="이번 주 승격" value={stats?.weekly_levelups ?? "-"} />
          <StatCard icon="📝" label="오늘 제출" value={stats?.today_submissions ?? "-"} />
        </div>

        {/* Main Tab Switch */}
        <div className="mb-4 flex gap-1.5 rounded-2xl border border-border bg-muted/30 p-1">
          <button
            onClick={() => setMainTab("members")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              mainTab === "members" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            회원
          </button>
          <button
            onClick={() => setMainTab("inbox")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              mainTab === "inbox" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            <Inbox className="h-4 w-4" />
            승인
            {stats?.pending_count && stats.pending_count > 0 ? (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-status-pending px-1.5 text-[10px] font-bold text-white">
                {stats.pending_count}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setMainTab("level_review")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              mainTab === "level_review" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            📋 심사
          </button>
          <button
            onClick={() => setMainTab("operations")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              mainTab === "operations" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            ⚡ 운영
          </button>
          <button
            onClick={() => setMainTab("at_risk")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              mainTab === "at_risk" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            위험
          </button>
        </div>

        {mainTab === "inbox" && <ApprovalInbox />}
        {mainTab === "members" && <MemberListContent />}
        {mainTab === "level_review" && <CoachLevelReviewInbox />}
        {mainTab === "operations" && <DailyOperationsBoard />}
        {mainTab === "at_risk" && <AtRiskMembersPanel />}
      </div>

      {/* ── Desktop 2-Column Layout (>= lg) ── */}
      <div className="hidden lg:flex h-screen">
        {/* Left: Member List */}
        <div className="w-[420px] shrink-0 overflow-y-auto border-r border-border bg-background px-4 pb-8 pt-4">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{isSuperAdmin ? "전체 지점" : branchName}</p>
              <h1 className="text-xl text-foreground">{isSuperAdmin ? "전체 회원관리" : "회원관리"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/mypage")} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
                <Bell className="h-4 w-4 text-secondary-foreground" />
                {unreadCount && unreadCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <StatCard icon="👥" label="전체 회원" value={stats?.total_members ?? "-"} />
            <button onClick={() => setMainTab("inbox")} className="text-left">
              <StatCard icon="⏳" label="승인대기" value={stats?.pending_count ?? "-"} highlight />
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-1.5 rounded-2xl border border-border bg-muted/30 p-1">
            <button
              onClick={() => setMainTab("members")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mainTab === "members" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              회원
            </button>
            <button
              onClick={() => setMainTab("inbox")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mainTab === "inbox" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              승인
              {stats?.pending_count && stats.pending_count > 0 ? (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-pending px-1 text-[9px] font-bold text-white">
                  {stats.pending_count}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setMainTab("level_review")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mainTab === "level_review" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
              }`}
            >
              📋 심사
            </button>
          </div>

          {mainTab === "inbox" && <ApprovalInbox />}
          {mainTab === "members" && <MemberListContent />}
          {mainTab === "level_review" && <CoachLevelReviewInbox />}
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          <DesktopDetailPanel />
        </div>
      </div>
    </>
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
