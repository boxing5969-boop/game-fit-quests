import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Pencil, Trophy, ChevronUp, Home, Swords, Map as MapIcon, Gift } from "lucide-react";
import { formatRank, RANK_LABELS, RANK_ICONS, RANK_ORDER, isManagerRole } from "@/lib/rankLabels";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { useLevels } from "@/hooks/useQuestData";
import { useMissions } from "@/hooks/useMissionData";
import XPBar from "@/components/XPBar";

type PreviewTab = "home" | "missions" | "levelmap" | "rewards";

const RANK_ORDER_ARR: Enums<"rank_name">[] = ["white", "blue", "red", "black"];

const MemberPreviewPage = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<PreviewTab>("home");
  const [actionNote, setActionNote] = useState("");
  const [showActionBar, setShowActionBar] = useState(true);

  const { data: member } = useQuery({
    queryKey: ["member-detail", memberId],
    enabled: !!memberId && isManagerRole(role),
    queryFn: async () => {
      const [profileRes, progressRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", memberId!).single(),
        supabase.from("member_progress").select("*").eq("user_id", memberId!).single(),
      ]);
      return { profile: profileRes.data, progress: progressRes.data };
    },
  });

  const { data: levels } = useLevels();
  const { data: missions } = useMissions();

  const { data: missionSubs } = useQuery({
    queryKey: ["member-mission-subs", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_submissions")
        .select("*, missions(*)")
        .eq("user_id", memberId!)
        .order("requested_at", { ascending: false });
      return data || [];
    },
  });

  const { data: levelStatuses } = useQuery({
    queryKey: ["member-level-status", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data } = await supabase.from("level_status").select("*").eq("user_id", memberId!);
      return data || [];
    },
  });

  // Mutations
  const approveMission = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase.rpc("approve_mission_submission", { _submission_id: subId, _coach_note: actionNote || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("승인 완료!");
      qc.invalidateQueries({ queryKey: ["member-mission-subs", memberId] });
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
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

  const levelUpMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("manual_level_up", { _member_id: memberId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("레벨업 완료!");
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
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
        toast.success(`승급! ${RANK_LABELS[result.new_rank]} 레벨 1 해금! 🏆`);
      } else {
        toast.success("보스전 합격! 🏆");
      }
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
    },
  });

  const setLevelStatusMut = useMutation({
    mutationFn: async ({ rank, level, status, note }: { rank: string; level: number; status: string; note?: string }) => {
      const { error } = await supabase.rpc("set_level_status", {
        _member_id: memberId!, _rank: rank as any, _level: level, _status: status as any, _note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("상태 변경 완료");
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
    },
  });

  if (!member?.profile || !member?.progress) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const p = member.profile;
  const prog = member.progress;
  const globalLevel = RANK_ORDER_ARR.indexOf(prog.current_rank as Enums<"rank_name">) * 10 + prog.current_level;
  const pendingSubs = (missionSubs || []).filter(s => s.status === "pending");
  const subMap = new Map((missionSubs || []).map(s => [s.mission_id, s.status]));

  const getLevelStatus = (rank: string, level: number) => {
    return (levelStatuses || []).find(ls => ls.rank_name === rank && ls.level_number === level)?.status || "locked";
  };

  const STATUS_COLORS: Record<string, string> = {
    locked: "border-border bg-muted/30 opacity-40",
    in_progress: "border-primary bg-primary/10",
    pending: "border-status-pending/30 bg-status-pending/5",
    approved: "border-status-complete/30 bg-status-complete/5",
    revision_requested: "border-amber-500/30 bg-amber-500/5",
    rejected: "border-destructive/30 bg-destructive/5",
    boss_cleared: "border-accent/30 bg-accent/5",
  };

  const STATUS_EMOJI: Record<string, string> = {
    locked: "🔒", in_progress: "▶️", pending: "⏳", approved: "✅",
    revision_requested: "✏️", rejected: "❌", boss_cleared: "🏆",
  };

  const TABS: { key: PreviewTab; label: string; icon: any }[] = [
    { key: "home", label: "홈", icon: Home },
    { key: "missions", label: "미션", icon: Swords },
    { key: "levelmap", label: "계급도", icon: Map },
    { key: "rewards", label: "보상", icon: Gift },
  ];

  return (
    <div className="mx-auto max-w-lg pb-40">
      {/* Admin Action Bar - Fixed top */}
      {showActionBar && (
        <div className="sticky top-0 z-50 border-b border-accent/30 bg-foreground/95 backdrop-blur-md px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="rounded-full bg-primary-foreground/10 p-1.5 active:scale-95">
                <ArrowLeft className="h-4 w-4 text-primary-foreground" />
              </button>
              <div>
                <p className="text-xs text-primary-foreground/60">회원 앱 미리보기</p>
                <p className="text-sm font-bold text-primary-foreground">{p.nickname || p.name}</p>
              </div>
            </div>
            <RankBadge rank={prog.current_rank as Enums<"rank_name">} level={prog.current_level} size="sm" />
          </div>
          {/* Quick actions */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {pendingSubs.length > 0 && (
              <button
                onClick={() => { setActiveTab("missions"); }}
                className="shrink-0 rounded-full bg-status-pending/20 px-2.5 py-1 text-[10px] font-bold text-status-pending"
              >
                ⏳ 승인대기 {pendingSubs.length}건
              </button>
            )}
            <button
              onClick={() => levelUpMut.mutate()}
              disabled={levelUpMut.isPending || prog.current_level >= 10}
              className="shrink-0 rounded-full bg-status-complete/20 px-2.5 py-1 text-[10px] font-bold text-status-complete disabled:opacity-40"
            >
              <ChevronUp className="inline h-3 w-3" /> 레벨 완료
            </button>
            {prog.current_level === 10 && (
              <button
                onClick={() => bossBattleMut.mutate()}
                disabled={bossBattleMut.isPending}
                className="shrink-0 rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent disabled:opacity-40"
              >
                🏆 보스전 합격
              </button>
            )}
            <button
              onClick={() => setActiveTab("levelmap")}
              className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary"
            >
              🗺️ 계급도 체크
            </button>
          </div>
        </div>
      )}

      {/* Preview Content */}
      <div className="px-4 pt-4">
        {/* ── Home Tab ── */}
        {activeTab === "home" && (
          <div className="space-y-4">
            {/* Member info card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    RANK_ICONS[prog.current_rank]
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-foreground">{p.nickname || p.name}</h2>
                  <p className="text-sm text-muted-foreground">{formatRank(prog.current_rank, prog.current_level)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">총 XP</p><p className="text-sm font-bold text-foreground">{prog.total_xp}</p></div>
                <div><p className="text-xs text-muted-foreground">출석</p><p className="text-sm font-bold text-foreground">{prog.streak_days}일</p></div>
                <div><p className="text-xs text-muted-foreground">진행</p><p className="text-sm font-bold text-foreground">{globalLevel}/40</p></div>
                <div><p className="text-xs text-muted-foreground">보스전</p><p className="text-sm font-bold text-foreground">{prog.bosses_cleared}회</p></div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-xp-bg">
                <div className="h-full rounded-full bg-xp-bar transition-all" style={{ width: `${(globalLevel / 40) * 100}%` }} />
              </div>
            </div>

            {/* Recent missions */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-foreground">최근 미션 제출</h3>
              {(missionSubs || []).slice(0, 5).map(sub => (
                <div key={sub.id} className="mb-2 rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{sub.missions?.title || "미션"}</p>
                    <span className={`text-xs font-bold ${
                      sub.status === "approved" ? "text-status-complete" :
                      sub.status === "pending" ? "text-status-pending" :
                      sub.status === "rejected" ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {sub.status === "approved" ? "✅ 승인" : sub.status === "pending" ? "⏳ 대기" :
                       sub.status === "rejected" ? "❌ 반려" : sub.status === "revision_requested" ? "✏️ 수정요청" : sub.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!missionSubs || missionSubs.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">제출된 미션이 없습니다</p>
              )}
            </div>
          </div>
        )}

        {/* ── Missions Tab ── */}
        {activeTab === "missions" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">미션 현황</h2>
            {(missionSubs || []).map(sub => (
              <div key={sub.id} className={`rounded-2xl border p-4 ${
                sub.status === "pending" ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"
              }`}>
                <p className="text-sm font-bold text-foreground">{sub.missions?.title || "미션"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(sub.requested_at).toLocaleDateString("ko-KR")}
                  {sub.coach_note && <span className="ml-2 italic">💬 {sub.coach_note}</span>}
                </p>
                {sub.status === "pending" && (
                  <div className="mt-3 space-y-2">
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
                        <Pencil className="h-3 w-3" /> 수정
                      </button>
                      <button onClick={() => rejectMission.mutate(sub.id)} disabled={rejectMission.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive py-2 text-xs font-bold text-destructive-foreground active:scale-95 disabled:opacity-50">
                        <X className="h-3 w-3" /> 반려
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Level Map Tab ── */}
        {activeTab === "levelmap" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-foreground">🗺️ 계급도 (회원 시점)</h2>
            {RANK_ORDER_ARR.map((rank, ri) => (
              <div key={rank}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                  <span>{RANK_ICONS[rank]}</span> {RANK_LABELS[rank]}
                </h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                    const status = getLevelStatus(rank, lvl);
                    const gLvl = ri * 10 + lvl;
                    const isCurrent = gLvl === globalLevel;
                    return (
                      <button
                        key={lvl}
                        onClick={() => {
                          const nextStatus = status === "approved" ? "locked" : "approved";
                          setLevelStatusMut.mutate({ rank, level: lvl, status: nextStatus });
                        }}
                        className={`flex flex-col items-center rounded-xl border-2 p-1.5 transition-all active:scale-95 ${
                          isCurrent ? "border-primary bg-primary/10 ring-2 ring-primary/30" : STATUS_COLORS[status] || ""
                        }`}
                      >
                        <span className="text-[10px] font-bold text-foreground">{lvl}</span>
                        <span className="text-[10px]">{STATUS_EMOJI[status] || "🔒"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rewards Tab ── */}
        {activeTab === "rewards" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">🎁 보상 현황</h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">총 XP: <span className="font-bold text-foreground">{prog.total_xp}</span></p>
              <p className="text-sm text-muted-foreground">보스전 클리어: <span className="font-bold text-foreground">{prog.bosses_cleared}회</span></p>
              <p className="text-sm text-muted-foreground">현재 랭크: <span className="font-bold text-foreground">{formatRank(prog.current_rank, prog.current_level)}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar (Member-style) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${
                activeTab === tab.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberPreviewPage;
