import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Users, Bell, Settings2, ArrowRightLeft, AlertTriangle, Download } from "lucide-react";
import BranchCompareReport from "@/components/BranchCompareReport";
import TransferApprovalCenter from "@/components/TransferApprovalCenter";
import BroadcastNotification from "@/components/BroadcastNotification";
import AtRiskMembersPanel from "@/components/AtRiskMembersPanel";
import { formatRankShort } from "@/lib/rankLabels";
import { toast } from "sonner";

type AdminTab = "overview" | "branches" | "transfers" | "broadcast" | "at_risk" | "settings";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");

  // React Rules-of-Hooks: useQuery 는 조건부 early-return 이후에 호출되면
  // 렌더마다 hook 개수가 달라져 크래시 위험. `enabled` 로만 페치를 차단하고
  // 권한 거절 UI 는 모든 hook 호출 이후로 미룬다.
  const isAuthorized = role === "super_admin" || role === "admin";

  // Global stats
  const { data: globalStats } = useQuery({
    queryKey: ["global-admin-stats"],
    enabled: isAuthorized,
    queryFn: async () => {
      const [membersRes, pendingMissionsRes, pendingQuestsRes, transferRes, branchesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, is_approved", { count: "exact" }),
        supabase.from("mission_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("quest_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("branch_transfer_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("branches").select("id", { count: "exact", head: true }),
      ]);
      const profiles = membersRes.data || [];
      const unapproved = profiles.filter(p => !p.is_approved).length;
      return {
        totalMembers: profiles.length,
        unapproved,
        pendingSubmissions: (pendingMissionsRes.count || 0) + (pendingQuestsRes.count || 0),
        pendingTransfers: transferRes.count || 0,
        totalBranches: branchesRes.count || 0,
      };
    },
  });

  // CSV export
  const handleExportMembers = async () => {
    try {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!profiles?.length) { toast.info("내보낼 데이터가 없습니다"); return; }

      const userIds = profiles.map(p => p.user_id);
      const { data: progress } = await supabase.from("member_progress").select("*").in("user_id", userIds);
      const progMap = new Map((progress || []).map(p => [p.user_id, p]));

      const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
      const header = "이름,닉네임,지점,리그,레벨,전체레벨,XP,연속일,보스클리어,가입승인,가입일,전화번호\n";
      const rows = profiles.map(p => {
        const prog = progMap.get(p.user_id);
        const globalLv = prog ? (({ white: 0, blue: 10, red: 20, black: 30 }[prog.current_rank] || 0) + prog.current_level) : 0;
        return [
          p.name, p.nickname, p.branch_name,
          RANK_LABELS[prog?.current_rank || "white"] || "화이트",
          prog?.current_level || 1, globalLv,
          prog?.total_xp || 0, prog?.streak_days || 0, prog?.bosses_cleared || 0,
          p.is_approved ? "Y" : "N",
          new Date(p.created_at).toLocaleDateString("ko-KR"),
          p.phone_number || "",
        ].join(",");
      }).join("\n");

      const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `회원목록_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 내보내기 완료");
    } catch {
      toast.error("내보내기 실패");
    }
  };

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "개요", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "branches", label: "지점 비교", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "at_risk", label: "위험 회원", icon: <AlertTriangle className="h-4 w-4" /> },
    { key: "transfers", label: "이전 승인", icon: <ArrowRightLeft className="h-4 w-4" /> },
    { key: "broadcast", label: "공지", icon: <Bell className="h-4 w-4" /> },
  ];

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/manager")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl text-foreground">전체관리자 대시보드</h1>
          <p className="text-xs text-muted-foreground">모든 지점 통합 관리</p>
        </div>
        <button
          onClick={handleExportMembers}
          className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground active:scale-95"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {/* Global Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xl font-bold text-foreground">{globalStats?.totalMembers ?? "-"}</p>
          <p className="text-[9px] text-muted-foreground">전체 회원</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xl font-bold text-primary">{globalStats?.totalBranches ?? "-"}</p>
          <p className="text-[9px] text-muted-foreground">지점 수</p>
        </div>
        <div className={`rounded-2xl border p-3 text-center ${(globalStats?.pendingSubmissions || 0) > 0 ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"}`}>
          <p className={`text-xl font-bold ${(globalStats?.pendingSubmissions || 0) > 0 ? "text-status-pending" : "text-foreground"}`}>
            {globalStats?.pendingSubmissions ?? "-"}
          </p>
          <p className="text-[9px] text-muted-foreground">승인 대기</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className={`rounded-2xl border p-3 text-center ${(globalStats?.unapproved || 0) > 0 ? "border-reward/30 bg-reward/5" : "border-border bg-card"}`}>
          <p className="text-lg font-bold text-foreground">{globalStats?.unapproved ?? "-"}</p>
          <p className="text-[9px] text-muted-foreground">미승인 회원</p>
        </div>
        <div className={`rounded-2xl border p-3 text-center ${(globalStats?.pendingTransfers || 0) > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
          <p className="text-lg font-bold text-foreground">{globalStats?.pendingTransfers ?? "-"}</p>
          <p className="text-[9px] text-muted-foreground">이전 대기</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <BranchCompareReport />}
      {tab === "branches" && <BranchCompareReport />}
      {tab === "at_risk" && <AtRiskMembersPanel />}
      {tab === "transfers" && <TransferApprovalCenter />}
      {tab === "broadcast" && <BroadcastNotification />}
    </div>
  );
};

export default SuperAdminDashboard;
