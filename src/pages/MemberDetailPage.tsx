import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Clock, Pencil, ChevronRight, MessageSquare, FileText, Map, Activity, User, Eye, Trash2, Shield, Crown, Banknote } from "lucide-react";
import { formatRank, RANK_LABELS, RANK_ICONS, RANK_ORDER, isManagerRole } from "@/lib/rankLabels";
import { STAFF_CHAMPION_LABEL, STAFF_CHAMPION_LEVEL, isStaffProfile, staffChampionLine } from "@/lib/staffDisplay";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import LevelStatusActionSheet from "@/components/LevelStatusActionSheet";
import MissionVideoUpload from "@/components/MissionVideoUpload";
import BulkCompleteModal from "@/components/BulkCompleteModal";
import { useMemberWallet, useGrantGems } from "@/hooks/useWallet";
import RouteLoader from "@/components/splash/RouteLoader";
import LevelAdminPanel from "@/components/admin/LevelAdminPanel";
import { useMemberHandWrapPractice } from "@/hooks/useHandWrap";

type TabKey = "overview" | "missions" | "levelmap" | "activity" | "notes";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  locked: { label: "잠금", color: "text-muted-foreground" },
  in_progress: { label: "진행중", color: "text-primary" },
  pending: { label: "승인대기", color: "text-status-pending" },
  approved: { label: "완료", color: "text-status-complete" },
  revision_requested: { label: "수정요청", color: "text-amber-600" },
  rejected: { label: "반려", color: "text-destructive" },
  boss_cleared: { label: "보스전 완료", color: "text-reward" },
};

const MemberDetailPage = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [noteContent, setNoteContent] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null)); }, []);
  const [actionNote, setActionNote] = useState("");
  const [actionSheet, setActionSheet] = useState<{ rank: Enums<"rank_name">; level: number; status: string } | null>(null);
  const [showBulkComplete, setShowBulkComplete] = useState(false);
  const [gemAmount, setGemAmount] = useState("");
  const [gemReason, setGemReason] = useState("");
  const memberWallet = useMemberWallet(memberId);
  const grantGems = useGrantGems();
  // 붕대 감기 집 연습 — 다음 수업 때 코치님 앞에서 혼자 감아 보게 하는 확인용 (2026-10-13)
  const handWrap = useMemberHandWrapPractice(memberId, isManagerRole(role));

  // Member profile + progress
  const { data: member, isLoading } = useQuery({
    queryKey: ["member-detail", memberId],
    enabled: !!memberId && isManagerRole(role),
    queryFn: async () => {
      const [profileRes, progressRes, roleRes, providerRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", memberId!).single(),
        supabase.from("member_progress").select("*").eq("user_id", memberId!).single(),
        supabase.from("user_roles").select("role").eq("user_id", memberId!).single(),
        supabase.rpc("get_signup_providers", { _user_ids: [memberId!] }),
      ]);
      const provider = (providerRes.data || [])[0]?.signup_provider || "email";
      return {
        profile: profileRes.data,
        progress: progressRes.data,
        memberRole: roleRes.data?.role || "member",
        signupProvider: provider,
      };
    },
  });

  // Pending submissions
  const { data: missionSubs } = useQuery({
    queryKey: ["member-mission-subs", memberId],
    enabled: !!memberId && isManagerRole(role),
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_submissions")
        .select("*, missions(*)")
        .eq("user_id", memberId!)
        .order("requested_at", { ascending: false });
      return data || [];
    },
  });

  // Level status
  const { data: levelStatuses } = useQuery({
    queryKey: ["member-level-status", memberId],
    enabled: !!memberId && isManagerRole(role),
    queryFn: async () => {
      const { data } = await supabase
        .from("level_status")
        .select("*")
        .eq("user_id", memberId!);
      return data || [];
    },
  });

  // XP logs (activity)
  const { data: xpLogs } = useQuery({
    queryKey: ["member-xp-logs", memberId],
    enabled: !!memberId && isManagerRole(role) && activeTab === "activity",
    queryFn: async () => {
      const { data } = await supabase
        .from("xp_logs")
        .select("*")
        .eq("user_id", memberId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // 앱·커뮤니티 활동 — 본사만 (2026-10-16 대표님: "나는 모든 활동을 확인할수있게해줘", admin_member_activity)
  const isHq = role === "super_admin" || role === "admin";
  const [actShowAll, setActShowAll] = useState(false);
  const { data: appActivity, isLoading: appActivityLoading } = useQuery({
    queryKey: ["member-app-activity", memberId],
    enabled: !!memberId && isHq && activeTab === "activity",
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_member_activity", { p_user_id: memberId, p_limit: 200 });
      if (error) throw error;
      return ((data?.items ?? []) as AppActivityItem[]).filter((x) => x && x.at);
    },
  });

  // 회원 메모 — 지점장·관리자·전체관리자만 (2026-10-15 대표님: 회원 본인과 다른 사람은 못 보는 회원 특성 기록)
  const canMemo = role === "branch_manager" || role === "admin" || role === "super_admin";
  const { data: notes } = useQuery({
    queryKey: ["manager-notes", memberId],
    enabled: !!memberId && canMemo && activeTab === "notes",
    queryFn: async () => {
      const { data } = await supabase
        .from("manager_notes")
        .select("*")
        .eq("user_id", memberId!)
        .eq("note_type", "internal") // 오늘 운영 보드의 코치 처리 기록(daily_ops)은 빼고 회원 메모만
        .order("created_at", { ascending: false });
      const rows = data || [];
      // 누가 쓴 메모인지 — 이름을 못 읽으면(다른 지점 관리자 등) '관리자'
      const ids = Array.from(new Set(rows.map((r) => r.manager_id)));
      const names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("user_id, nickname, name").in("user_id", ids);
        (ps || []).forEach((x) => { names[x.user_id] = x.name || x.nickname || "관리자"; });
      }
      return rows.map((r) => ({ ...r, author: names[r.manager_id] ?? "관리자" }));
    },
  });

  // 153 마일리지 — 데스크 결제 할인 (지점장·전체관리자, 2026-10-15)
  const canMileage = role === "branch_manager" || role === "super_admin";
  const [mlPay, setMlPay] = useState("");
  const [mlUse, setMlUse] = useState("");
  const [mlMemo, setMlMemo] = useState("");
  // 받은·쓴 기록 전부 펼치기 (2026-10-16 대표님: "회원님 마일리지 어떻게 받은건지 기록을 볼수있도록 해줘~")
  const [mlShowAll, setMlShowAll] = useState(false);
  const { data: mileage, refetch: refetchMileage } = useQuery({
    queryKey: ["member-mileage", memberId],
    enabled: !!memberId && canMileage,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_member_mileage", { p_user_id: memberId });
      if (error) throw error;
      return data as {
        balance: number;
        count?: number;
        summary?: Array<{ kind: string; count: number; earned: number; spent: number }>;
        items: Array<{ amount: number; kind?: string; reason: string; at: string }>;
      };
    },
  });
  const useMileageMut = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_use_mileage", {
        p_user_id: memberId,
        p_amount: Number(mlUse.replace(/\D/g, "")),
        p_payment_amount: Number(mlPay.replace(/\D/g, "")),
        p_memo: mlMemo.trim() || null,
      });
      if (error) throw error;
      return data as { balance: number };
    },
    onSuccess: (d) => {
      toast.success(`마일리지 ${Number(mlUse.replace(/\D/g, "")).toLocaleString("ko-KR")}점 사용 · 남은 ${Number(d?.balance ?? 0).toLocaleString("ko-KR")}점`);
      setMlUse("");
      setMlPay("");
      setMlMemo("");
      void refetchMileage();
    },
    onError: (e: Error) => toast.error(e.message || "마일리지를 쓰지 못했어요"),
  });
  const mlMax = (() => {
    const pay = Number(mlPay.replace(/\D/g, "")) || 0;
    const bal = mileage?.balance ?? 0;
    return Math.max(0, Math.min(Math.floor(Math.max(bal, 0) / 1000) * 1000, Math.floor((pay * 0.1) / 1000) * 1000));
  })();

  // 출석 기록 (출입기·앱 QR) — 개요 요약 + 출석·활동 탭 목록
  const { data: attendance } = useQuery({
    queryKey: ["member-attendance", memberId],
    enabled: !!memberId && isManagerRole(role),
    queryFn: async () => {
      const [listRes, totalRes] = await Promise.all([
        // 생성된 타입에 ended_at 이 아직 없다 — DB 에는 있음
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("attendance_logs")
          .select("id, checked_in_at, ended_at, method")
          .eq("user_id", memberId!)
          .eq("is_duplicate", false)
          .order("checked_in_at", { ascending: false })
          .limit(120),
        supabase
          .from("attendance_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", memberId!)
          .eq("is_duplicate", false),
      ]);
      const list = (listRes.data || []) as Array<{ id: string; checked_in_at: string; ended_at: string | null; method: string }>;
      const kstMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
      const thisMonth = list.filter(
        (a) => new Date(new Date(a.checked_in_at).getTime() + 9 * 3600_000).toISOString().slice(0, 7) === kstMonth,
      ).length;
      return { list, total: totalRes.count ?? list.length, thisMonth, last: list[0]?.checked_in_at ?? null };
    },
  });

  // Mutations
  const approveMission = useMutation({
    mutationFn: async (subId: string) => {
      const { data, error } = await supabase.rpc("approve_mission_submission", { _submission_id: subId, _coach_note: actionNote || null });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("승인 완료!");
      qc.invalidateQueries({ queryKey: ["member-mission-subs", memberId] });
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["branch-members"] });
      setActionNote("");
    },
  });

  const rejectMission = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase.rpc("reject_mission_submission", { _submission_id: subId, _coach_note: actionNote || "다시 도전해보세요" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("반려 완료");
      qc.invalidateQueries({ queryKey: ["member-mission-subs", memberId] });
      setActionNote("");
    },
  });

  const revisionMission = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase.rpc("request_mission_revision", { _submission_id: subId, _coach_note: actionNote || "보완이 필요합니다" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("수정요청 완료");
      qc.invalidateQueries({ queryKey: ["member-mission-subs", memberId] });
      setActionNote("");
    },
  });

  const setLevelStatusMut = useMutation({
    mutationFn: async ({ rank, level, status, note }: { rank: string; level: number; status: string; note?: string }) => {
      const { data, error } = await supabase.rpc("set_level_status", {
        _member_id: memberId!,
        _rank: rank as any,
        _level: level,
        _status: status as any,
        _note: note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("레벨 상태 변경 완료");
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
    },
  });

  const bossBattleMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("pass_boss_battle", { _member_id: memberId! });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (result) => {
      if (result?.ranked_up) {
        toast.success(`리그 승격! ${RANK_LABELS[result.new_rank]} 리그 레벨 1 해금! 🏆`);
      } else {
        toast.success("보스전 합격 처리 완료! 🏆");
      }
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("manager_notes").insert({
        user_id: memberId!,
        manager_id: (await supabase.auth.getUser()).data.user!.id,
        note_type: "internal", // 회원에게 보이는 메모는 쓰지 않는다 (2026-10-15)
        content: noteContent.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("메모 저장 완료");
      setNoteContent("");
      qc.invalidateQueries({ queryKey: ["manager-notes", memberId] });
    },
    onError: () => toast.error("메모를 저장하지 못했어요 — 같은 지점 회원만 메모할 수 있어요"),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("manager_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager-notes", memberId] }),
    onError: () => toast.error("내가 쓴 메모만 지울 수 있어요"),
  });

  const deleteUserMut = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ targetUserId: memberId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "삭제 실패");
      return result;
    },
    onSuccess: () => {
      toast.success("계정이 삭제되었습니다");
      qc.invalidateQueries({ queryKey: ["branch-members"] });
      qc.invalidateQueries({ queryKey: ["approval-inbox"] });
      navigate(-1);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !member?.profile || !member?.progress) {
    // RouteLoader 와 톤 일치 — iframe wrapper / Suspense fallback / 본체 로딩이
    // 모두 같은 어두운 radial 배경 + 부드러운 호흡 로고로 통일되어
    // 회원 클릭 → iframe 새로고침 → 페이지 본체 로드 시 깜빡임이 사라진다.
    return <RouteLoader label="회원 정보를 불러오는 중" />;
  }

  const p = member.profile;
  const prog = member.progress;
  const pendingSubs = (missionSubs || []).filter(s => s.status === "pending");
  const globalLevel = RANK_ORDER.indexOf(prog.current_rank as any) * 10 + prog.current_level;

  const getLevelStatus = (rank: string, level: number) => {
    const found = (levelStatuses || []).find(ls => ls.rank_name === rank && ls.level_number === level);
    return found?.status || "locked";
  };

  // 생성된 타입에 아직 없는 회원권 칸 — DB 에는 있음
  const memberPlan = p as typeof p & { gym_reg_date?: string | null; membership_end?: string | null };

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "개요", icon: User },
    { key: "missions", label: "미션 승인", icon: FileText },
    { key: "levelmap", label: "로드맵 체크", icon: Map },
    { key: "activity", label: "출석·활동", icon: Activity },
    ...(canMemo ? [{ key: "notes" as TabKey, label: "회원 메모", icon: MessageSquare }] : []),
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg text-foreground">{p.nickname || p.name}</h1>
            {isStaffProfile(p) ? (
              // 153OS 지도진 명단에 있는 코치님·지점장님 — 역할이 member 여도 회원이 아니다 (2026-09-23)
              // 대표님 지시: 코치님은 모두 챔피언 · Lv.77 (화면 전용)
              <span className="rounded-full bg-reward/20 px-2 py-0.5 text-[10px] font-bold text-reward">{staffChampionLine(p)}</span>
            ) : member.memberRole === "branch_manager" || member.memberRole === "coach" ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">관장님</span>
            ) : member.memberRole === "super_admin" || member.memberRole === "admin" ? (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">관리자</span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">회원</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {p.branch_name}
            {" · "}
            {member.signupProvider === "google" ? "Google 가입" : member.signupProvider === "apple" ? "Apple 가입" : "일반 가입"}
          </p>
        </div>
        {!isStaffProfile(p) && (
          <RankBadge rank={prog.current_rank as Enums<"rank_name">} level={prog.current_level} size="sm" />
        )}
      </div>

      {/* Summary Card */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <div className="grid grid-cols-4 gap-2 text-center">
          <MiniStat label="총 XP" value={prog.total_xp.toLocaleString()} />
          <MiniStat label="출석" value={`${prog.streak_days}일`} />
          {isStaffProfile(p)
            ? <MiniStat label={STAFF_CHAMPION_LABEL} value={`Lv.${STAFF_CHAMPION_LEVEL}`} />
            : <MiniStat label="진행" value={`${globalLevel}/40`} />}
          <MiniStat label="대기" value={`${pendingSubs.length}건`} highlight={pendingSubs.length > 0} />
        </div>
      </div>

      {/* ─── 관리자 레벨 조정 패널 (super_admin / branch_manager / coach 만 자동 표시) ─── */}
      <div className="mb-4">
        <LevelAdminPanel
          memberId={p.user_id}
          memberName={p.nickname || p.name}
          currentRank={prog.current_rank}
          currentLevel={prog.current_level}
          mode="full"
        />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          {/* 출석 요약 (2026-10-15 대표님: 이름 누르면 출석 데이터·기록 등 상세) */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="총 출석" value={attendance ? `${attendance.total}회` : "…"} />
            <StatTile label="이번 달" value={attendance ? `${attendance.thisMonth}회` : "…"} />
            <StatTile label="마지막 출석" value={attendance ? (attendance.last ? fmtDay(attendance.last) : "없음") : "…"} />
          </div>
          {(memberPlan.gym_reg_date || memberPlan.membership_end) && (
            <InfoCard label="회원권" value={`${memberPlan.gym_reg_date ?? "?"} ~ ${memberPlan.membership_end ?? "?"}`} />
          )}
          {(p.pt_ticket || p.pt_remaining != null || p.pt_until) && (
            <InfoCard
              label="PT"
              value={[p.pt_ticket, p.pt_remaining != null ? `남은 ${p.pt_remaining}회` : null, p.pt_until ? `~${p.pt_until}` : null]
                .filter(Boolean)
                .join(" · ") || "-"}
            />
          )}
          <InfoCard label="현재 랭크" value={formatRank(prog.current_rank, prog.current_level)} />
          <InfoCard label="보스전 클리어" value={`${prog.bosses_cleared}회`} />
          {handWrap.data && handWrap.data.goal > 0 && (
            <InfoCard
              label="붕대 집 연습"
              value={
                handWrap.data.days === 0
                  ? "아직 기록 없음"
                  : `${Math.min(handWrap.data.days, handWrap.data.goal)}/${handWrap.data.goal}일${
                      handWrap.data.rewarded || handWrap.data.days >= handWrap.data.goal ? " 완료" : ""
                    }${handWrap.data.lastOn ? ` · 마지막 ${handWrap.data.lastOn.slice(5).replace("-", "/")}` : ""}`
              }
            />
          )}
          <InfoCard label="이름" value={p.name} />
          <InfoCard label="전화번호" value={p.phone_number || "미등록"} />

          {/* Quick Actions */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-foreground">빠른 액션</h3>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn label="승인대기 보기" onClick={() => setActiveTab("missions")} count={pendingSubs.length} />
              <ActionBtn label="로드맵 체크" onClick={() => setActiveTab("levelmap")} />
              <button
                onClick={() => navigate(`/manager/member/${memberId}/preview`)}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-bold text-primary transition-all active:scale-[0.98]"
              >
                <Eye className="h-4 w-4" /> 회원 앱으로 보기
              </button>
              {prog.current_level === 10 && (
                <button
                  onClick={() => bossBattleMut.mutate()}
                  disabled={bossBattleMut.isPending}
                  className="col-span-2 rounded-xl bg-reward py-3 text-sm font-bold text-reward-foreground shadow transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  🏆 보스전 합격 처리
                </button>
              )}
            </div>
          </div>

          {/* 153 마일리지 — 데스크 결제 할인 */}
          {canMileage && mileage && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-sm font-bold text-foreground">🪙 153 마일리지 · 데스크 결제 할인</h3>
              <div className="rounded-xl bg-amber-500/10 p-3 text-center">
                <span className="text-2xl font-bold text-foreground">{mileage.balance.toLocaleString("ko-KR")}점</span>
                <p className="mt-1 text-xs text-muted-foreground">1점 = 1원 · 결제 금액의 10%까지 · 1,000점 단위</p>
              </div>
              {(mileage.summary ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="마일리지 받은 곳 합계">
                  {(mileage.summary ?? []).map((sm) => (
                    <span key={sm.kind} className="rounded-pill border border-border bg-card px-2.5 py-1 text-[11.5px] font-bold text-foreground">
                      {MILEAGE_KIND_LABEL[sm.kind] ?? sm.kind}{" "}
                      {sm.earned > 0 && <span className="text-amber-600">+{sm.earned.toLocaleString("ko-KR")}</span>}
                      {sm.spent < 0 && <span className="text-muted-foreground"> {sm.spent.toLocaleString("ko-KR")}</span>}
                      <span className="font-medium text-muted-foreground"> · {sm.count.toLocaleString("ko-KR")}건</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  value={mlPay}
                  onChange={(e) => setMlPay(e.target.value)}
                  placeholder="결제 금액(원)"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  inputMode="numeric"
                  value={mlUse}
                  onChange={(e) => setMlUse(e.target.value)}
                  placeholder={mlMax > 0 ? `사용 점수 (최대 ${mlMax.toLocaleString("ko-KR")})` : "사용 점수"}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <input
                value={mlMemo}
                onChange={(e) => setMlMemo(e.target.value)}
                placeholder="메모 (예: 3개월권 재등록)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => mlMax > 0 && setMlUse(String(mlMax))}
                  disabled={mlMax <= 0}
                  className="rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground active:scale-95 disabled:opacity-40"
                >
                  최대로 쓰기
                </button>
                <button
                  type="button"
                  onClick={() => useMileageMut.mutate()}
                  disabled={useMileageMut.isPending || !mlUse || !mlPay}
                  className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
                >
                  {useMileageMut.isPending ? "처리 중..." : "마일리지 사용"}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                차감한 만큼 브로제이 결제 금액에서 직접 빼 주세요. 누가 언제 얼마를 썼는지 기록이 남아요.
              </p>
              {mileage.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="px-0.5 text-xs font-bold text-foreground">
                    받은·쓴 기록 <span className="font-medium text-muted-foreground">· {(mileage.count ?? mileage.items.length).toLocaleString("ko-KR")}건</span>
                  </p>
                  <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card px-3">
                    {(mlShowAll ? mileage.items : mileage.items.slice(0, 8)).map((it, i) => (
                      <li key={`${it.at}-${i}`} className="flex items-start gap-2 py-2">
                        <span className="w-16 shrink-0 pt-0.5 text-[11px] text-muted-foreground">{fmtDay(it.at)}</span>
                        <span className="min-w-0 flex-1 text-[12px] leading-snug text-foreground">
                          {it.kind && (
                            <span className="mr-1 rounded bg-secondary px-1 py-px text-[10px] font-bold text-muted-foreground">
                              {MILEAGE_KIND_LABEL[it.kind] ?? it.kind}
                            </span>
                          )}
                          {it.reason || "마일리지"}
                        </span>
                        <span className={`shrink-0 pt-0.5 text-[12px] font-bold ${it.amount >= 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {it.amount > 0 ? "+" : ""}
                          {it.amount.toLocaleString("ko-KR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {mileage.items.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setMlShowAll((v) => !v)}
                      className="w-full rounded-xl border border-border bg-card py-2 text-[12px] font-bold text-foreground active:scale-[0.99]"
                    >
                      {mlShowAll ? "접기" : `전체 ${mileage.items.length.toLocaleString("ko-KR")}건 보기`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fight Money Management */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-reward" /> 챔피언 머니 관리
            </h3>
            <div className="rounded-xl bg-reward/10 p-3 text-center">
              <span className="text-2xl font-bold text-reward-foreground">💵 {memberWallet.data?.gems_balance?.toLocaleString() || 0}</span>
              <p className="text-xs text-muted-foreground mt-1">현재 보유 챔피언 머니</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={gemAmount}
                onChange={e => setGemAmount(e.target.value)}
                placeholder="수량"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={gemReason}
                onChange={e => setGemReason(e.target.value)}
                placeholder="사유"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const amt = parseInt(gemAmount);
                  if (!amt || amt <= 0) { toast.error("수량을 입력하세요"); return; }
                  grantGems.mutate({ userId: memberId!, amount: amt, reason: gemReason || "관리자 수동 지급" }, {
                    onSuccess: () => { toast.success(`+${amt} 챔피언 머니 지급!`); setGemAmount(""); setGemReason(""); memberWallet.refetch(); }
                  });
                }}
                disabled={grantGems.isPending}
                className="rounded-xl bg-status-complete/20 py-2.5 text-sm font-bold text-status-complete active:scale-95 disabled:opacity-50"
              >
                💵 지급
              </button>
              <button
                onClick={() => {
                  const amt = parseInt(gemAmount);
                  if (!amt || amt <= 0) { toast.error("수량을 입력하세요"); return; }
                  grantGems.mutate({ userId: memberId!, amount: -amt, reason: gemReason || "관리자 수동 차감" }, {
                    onSuccess: () => { toast.success(`-${amt} 챔피언 머니 차감`); setGemAmount(""); setGemReason(""); memberWallet.refetch(); }
                  });
                }}
                disabled={grantGems.isPending}
                className="rounded-xl bg-destructive/20 py-2.5 text-sm font-bold text-destructive active:scale-95 disabled:opacity-50"
              >
                💵 차감
              </button>
            </div>
          </div>

          {/* Super Admin: Bulk Complete */}
          {role === "super_admin" && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> 전체관리자 전용
              </h3>
              <button
                onClick={() => setShowBulkComplete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-destructive/30 bg-destructive/5 py-3 text-sm font-bold text-destructive transition-all active:scale-[0.98] hover:bg-destructive/10"
              >
                <Crown className="h-4 w-4" /> 회원 전체 완료 처리
              </button>
              <button
                onClick={() => {
                  if (confirm(`"${p.nickname || p.name}" 계정을 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                    deleteUserMut.mutate();
                  }
                }}
                disabled={deleteUserMut.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteUserMut.isPending ? "삭제 중..." : "계정 삭제"}
              </button>
              <p className="text-center text-[10px] text-muted-foreground">모든 데이터가 영구 삭제됩니다</p>
            </div>
          )}
        </div>
      )}

      {/* ── Missions Tab ── */}
      {activeTab === "missions" && (
        <div className="space-y-3">
          {(missionSubs || []).length === 0 ? (
            <EmptyState text="제출된 미션이 없습니다" />
          ) : (
            (missionSubs || []).map(sub => (
              <div key={sub.id} className={`rounded-2xl border p-4 ${
                sub.status === "pending" ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"
              }`}>
                <div className="mb-2">
                  <p className="text-sm font-bold text-foreground">{sub.missions?.title || "미션"}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(sub.requested_at).toLocaleDateString("ko-KR")}</span>
                    <span className={`font-bold ${STATUS_LABELS[sub.status]?.color || ""}`}>
                      {STATUS_LABELS[sub.status]?.label || sub.status}
                    </span>
                  </div>
                  {sub.coach_note && (
                    <p className="mt-1 text-xs text-muted-foreground italic">💬 {sub.coach_note}</p>
                  )}
                </div>

                {/* Video evidence */}
                {((sub as any).video_url || sub.status === "pending") && (
                  <div className="mb-3">
                    <MissionVideoUpload
                      submissionId={sub.id}
                      videoUrl={(sub as any).video_url}
                      timestampComments={((sub as any).video_timestamp_comments as any[]) || []}
                      isManager={true}
                    />
                  </div>
                )}

                {sub.status === "pending" && (
                  <div className="space-y-2">
                    <input
                      value={actionNote}
                      onChange={e => setActionNote(e.target.value)}
                      placeholder="코멘트 (선택)"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => approveMission.mutate(sub.id)} disabled={approveMission.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-status-complete py-2 text-xs font-bold text-primary-foreground active:scale-95 disabled:opacity-50">
                        <Check className="h-3 w-3" /> 승인
                      </button>
                      <button onClick={() => revisionMission.mutate(sub.id)} disabled={revisionMission.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-50">
                        <Pencil className="h-3 w-3" /> 수정요청
                      </button>
                      <button onClick={() => rejectMission.mutate(sub.id)} disabled={rejectMission.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive py-2 text-xs font-bold text-destructive-foreground active:scale-95 disabled:opacity-50">
                        <X className="h-3 w-3" /> 반려
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Level Map Tab ── */}
      {activeTab === "levelmap" && (
        <div className="space-y-5">
          {RANK_ORDER.map((rank, ri) => (
            <div key={rank}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                <span>{RANK_ICONS[rank]}</span>
                {RANK_LABELS[rank]} 리그
              </h3>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                  const status = getLevelStatus(rank, lvl);
                  const gLvl = ri * 10 + lvl;
                  const isCurrent = gLvl === globalLevel;
                  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.locked;

                  return (
                    <button
                      key={lvl}
                      onClick={() => setActionSheet({ rank: rank as Enums<"rank_name">, level: lvl, status })}
                      className={`flex flex-col items-center rounded-xl border-2 p-1.5 text-center transition-all active:scale-95 ${
                        isCurrent ? "border-primary bg-primary/10" :
                        status === "approved" || status === "boss_cleared" ? "border-status-complete/30 bg-status-complete/5" :
                        status === "pending" ? "border-status-pending/30 bg-status-pending/5" :
                        status === "revision_requested" ? "border-amber-500/30 bg-amber-500/5" :
                        status === "rejected" ? "border-destructive/30 bg-destructive/5" :
                        status === "in_progress" ? "border-primary/30 bg-primary/5" :
                        "border-border bg-card"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-foreground">{gLvl}</span>
                      <span className={`text-[8px] font-medium ${statusInfo.color}`}>
                        {status === "approved" ? "✅" : status === "boss_cleared" ? "🏆" : status === "pending" ? "⏳" : status === "revision_requested" ? "✏️" : status === "rejected" ? "❌" : status === "in_progress" ? "▶️" : "🔒"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-muted-foreground text-center">
            노드를 탭하면 상태 변경 액션시트가 열립니다. 변경 이력과 되돌리기가 가능합니다.
          </p>

          {/* Action Sheet */}
          {actionSheet && memberId && (
            <LevelStatusActionSheet
              open={!!actionSheet}
              onOpenChange={(open) => !open && setActionSheet(null)}
              memberId={memberId}
              rank={actionSheet.rank}
              level={actionSheet.level}
              currentStatus={actionSheet.status}
            />
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && (
        <div className="space-y-2">
          {isHq && (
            <>
              <h3 className="px-1 pt-1 text-sm font-bold text-foreground">
                앱·커뮤니티 활동 <span className="text-muted-foreground">· 전체관리자만</span>
              </h3>
              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                글·댓글·153·응원·짝꿍·같이 운동·하트·퀴즈·컨디션·게임·챌린지·153 PB·레벨·설문 참여·마일리지. 메시지(DM) 내용과 설문 답변(익명)은 보이지 않아요.
              </p>
              {appActivityLoading ? (
                <p className="px-1 py-3 text-xs text-muted-foreground">불러오는 중…</p>
              ) : (appActivity ?? []).length === 0 ? (
                <EmptyState text="앱·커뮤니티 활동이 없습니다" />
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    {(actShowAll ? appActivity ?? [] : (appActivity ?? []).slice(0, 30)).map((a, i) => (
                      <div key={`${a.type}-${a.at}-${i}`} className={`px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                            {APP_ACTIVITY_LABEL[a.type] ?? a.type}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{a.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {fmtDay(a.at)} {fmtTime(a.at)}
                          </span>
                        </div>
                        {(a.detail || a.meta?.visibility === "partners" || a.meta?.visibility === "private" || a.meta?.hidden) && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">
                            {/* 공개 범위 — 전체 공개는 표시 안 함 (2026-10-18 친구만 · 나만 보기) */}
                            {a.meta?.visibility === "partners" && <span className="mr-1 font-bold">[친구만]</span>}
                            {a.meta?.visibility === "private" && <span className="mr-1 font-bold">[나만 보기]</span>}
                            {a.meta?.hidden && <span className="mr-1 font-bold text-destructive">[숨긴 글]</span>}
                            {a.detail}
                          </p>
                        )}
                        {a.meta?.photo && (
                          <img src={a.meta.photo} alt="회원이 올린 사진" loading="lazy" className="mt-1.5 max-h-48 rounded-lg object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                  {(appActivity ?? []).length > 30 && (
                    <button
                      type="button"
                      onClick={() => setActShowAll((v) => !v)}
                      className="w-full rounded-xl border border-border bg-card py-2 text-[12px] font-bold text-foreground active:scale-[0.99]"
                    >
                      {actShowAll ? "접기" : `전체 ${(appActivity ?? []).length}건 보기`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <h3 className="px-1 pt-1 text-sm font-bold text-foreground">
            출석 기록 {attendance ? <span className="text-muted-foreground">· 총 {attendance.total}회</span> : null}
          </h3>
          {(attendance?.list ?? []).length === 0 ? (
            <EmptyState text="출석 기록이 없습니다" />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {(attendance?.list ?? []).slice(0, 60).map((a, i) => {
                const mins = a.ended_at ? Math.round((new Date(a.ended_at).getTime() - new Date(a.checked_in_at).getTime()) / 60000) : null;
                return (
                  <div key={a.id} className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmtDay(a.checked_in_at)} {fmtTime(a.checked_in_at)}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.method === "qr_manual" ? "앱 QR 출석" : "출입기"}
                        {a.ended_at ? ` · ${fmtTime(a.ended_at)} 퇴실` : ""}
                      </p>
                    </div>
                    {mins != null && mins > 0 && mins < 600 && (
                      <span className="text-xs font-bold text-primary">{mins}분</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <h3 className="px-1 pt-3 text-sm font-bold text-foreground">XP 기록</h3>
          {(xpLogs || []).length === 0 ? (
            <EmptyState text="활동 기록이 없습니다" />
          ) : (
            (xpLogs || []).map(log => (
              <div key={log.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{log.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString("ko-KR")} {new Date(log.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className={`text-xs font-bold ${log.amount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {log.amount > 0 ? "+" : ""}{log.amount} XP
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Notes Tab ── */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              🔒 지점장·전체관리자만 봐요. 회원 본인과 다른 회원·코치님에게는 보이지 않아요.
            </p>
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="예) 왼쪽 어깨 수술 이력 · 평일 저녁 7시 운동 · 다이어트 목표"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              rows={3}
            />
            <button
              onClick={() => noteContent.trim() && addNote.mutate()}
              disabled={!noteContent.trim() || addNote.isPending}
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              저장
            </button>
          </div>

          {/* Notes list */}
          {(notes || []).length === 0 && <EmptyState text="아직 메모가 없어요" />}
          {(notes || []).map(note => (
            <div key={note.id} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-bold text-foreground">{note.author}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString("ko-KR")}
                </span>
                {(note.manager_id === myId || role === "super_admin") && (
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    disabled={deleteNote.isPending}
                    className="ml-auto text-[11px] font-bold text-muted-foreground underline disabled:opacity-50"
                  >
                    지우기
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Complete Modal (super_admin only) */}
      {role === "super_admin" && memberId && (
        <BulkCompleteModal
          open={showBulkComplete}
          onClose={() => setShowBulkComplete(false)}
          memberId={memberId}
          memberName={p.nickname || p.name}
          currentRank={prog.current_rank}
          currentLevel={prog.current_level}
          currentXp={prog.total_xp}
          bossesCleard={prog.bosses_cleared}
        />
      )}
    </div>
  );
};

/** 마일리지 종류 (mileage_ledger.kind) */
const MILEAGE_KIND_LABEL: Record<string, string> = {
  attendance: "출석",
  level_up: "레벨업",
  title_match: "타이틀매치",
  record: "153 레코드",
  adjust: "사용·조정",
};

/** 앱·커뮤니티 활동 한 줄 (admin_member_activity) */
interface AppActivityItem {
  type: string;
  at: string;
  title: string;
  detail: string | null;
  meta?: { visibility?: string; hidden?: boolean; photo?: string | null } | null;
}

const APP_ACTIVITY_LABEL: Record<string, string> = {
  post: "글",
  comment: "댓글",
  "153": "153",
  cheer_sent: "응원",
  cheer_got: "응원",
  birthday_sent: "생일",
  birthday_got: "생일",
  cornerman: "짝꿍",
  partner_call: "같이 운동",
  partner_join: "같이 운동",
  heart: "하트",
  quiz: "퀴즈",
  condition: "컨디션",
  game: "게임",
  challenge: "챌린지",
  test153: "153 PB",
  handwrap: "붕대",
  level: "레벨",
  survey: "설문",
  mileage: "마일리지",
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card px-2 py-3 text-center">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-[15px] font-bold text-foreground">{value}</p>
  </div>
);

const MiniStat = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold ${highlight ? "text-status-pending" : "text-foreground"}`}>{value}</p>
  </div>
);

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

const ActionBtn = ({ label, onClick, count }: { label: string; onClick: () => void; count?: number }) => (
  <button onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-xs font-bold text-foreground transition-all active:scale-95">
    {label}
    {count !== undefined && count > 0 && (
      <span className="rounded-full bg-status-pending/20 px-1.5 py-0.5 text-[9px] font-bold text-status-pending">{count}</span>
    )}
  </button>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <span className="text-3xl">📋</span>
    <p className="mt-2 text-sm text-muted-foreground">{text}</p>
  </div>
);

export default MemberDetailPage;
