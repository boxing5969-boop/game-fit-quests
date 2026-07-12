import { usePendingMissionSubmissions, useApproveMission, useRejectMission, useHiddenMastery, useExternalCertProgress, useUpdateHiddenMastery, useUpdateCertProgress } from "@/hooks/useMissionData";
import { useAssignedMembers, useGrantManualXp, usePassBossBattle, useManualLevelUp, useManualLevelDown, useSetMemberLevel } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, User, Zap, Trophy, Eye, Shield, BookOpen, Heart, Target, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Phone, Mail, MapPin, Calendar, Settings2 } from "lucide-react";
import MissionManager from "@/components/MissionManager";
import QuestManager from "@/components/admin/QuestManager";
import LevelManager from "@/components/admin/LevelManager";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import RankUpCeremony from "@/components/RankUpCeremony";
import CoachLevelReviewInbox from "@/components/CoachLevelReviewInbox";
import CoachSparringInbox from "@/components/CoachSparringInbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import QuestCoachSummaryPanel from "@/components/engagement/coach/QuestCoachSummaryPanel";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "관리자", color: "bg-destructive/15 text-destructive" },
  coach: { label: "코치", color: "bg-reward/15 text-reward-foreground" },
  member: { label: "회원", color: "bg-muted text-muted-foreground" },
};

const MASTERY_FIELDS = [
  { key: "technique_score", label: "기술", icon: Target, color: "text-rank-blue" },
  { key: "conditioning_score", label: "체력", icon: Heart, color: "text-rank-red" },
  { key: "teaching_score", label: "지도력", icon: BookOpen, color: "text-primary" },
  { key: "safety_score", label: "안전", icon: Shield, color: "text-status-complete" },
  { key: "evaluation_score", label: "평가", icon: Eye, color: "text-reward" },
];

const CoachDashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: pendingSubmissions, isLoading: pendingLoading } = usePendingMissionSubmissions();
  const { data: members, isLoading: membersLoading } = useAssignedMembers();
  const approveMutation = useApproveMission();
  const rejectMutation = useRejectMission();
  const grantXpMutation = useGrantManualXp();
  const bossBattleMutation = usePassBossBattle();
  const levelUpMutation = useManualLevelUp();
  const levelDownMutation = useManualLevelDown();
  const setLevelMutation = useSetMemberLevel();
  const updateMastery = useUpdateHiddenMastery();
  const updateCert = useUpdateCertProgress();

  const qc = useQueryClient();
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    enabled: role === "admin" || role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: coachRequests, isLoading: coachReqLoading } = useQuery({
    queryKey: ["coach-requests", role],
    enabled: role === "admin" || role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return data.map(r => ({ ...r, profile: profileMap.get(r.user_id) }));
    },
  });

  const approveCoachMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("approve_coach_request", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-requests"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      toast.success("관장님 승인 완료! 코치 권한이 부여되었습니다.");
    },
  });

  const rejectCoachMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("reject_coach_request", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-requests"] });
      toast.info("관장님 가입 거절 완료");
    },
  });

  const [activeTab, setActiveTab] = useState<"pending" | "members" | "branches" | "missions" | "quests" | "levels" | "coach-requests" | "level-review" | "sparring">("pending");
  const [rankUpInfo, setRankUpInfo] = useState<{ show: boolean; oldRank: string; newRank: string; memberName: string }>({ show: false, oldRank: "", newRank: "", memberName: "" });
  const [xpModal, setXpModal] = useState<{ show: boolean; memberId: string; memberName: string }>({ show: false, memberId: "", memberName: "" });
  const [xpAmount, setXpAmount] = useState(10);
  const [xpReason, setXpReason] = useState("");
  const [detailMember, setDetailMember] = useState<any | null>(null);
  const [branchInput, setBranchInput] = useState("");
  const [editingBranch, setEditingBranch] = useState<{ id: string; name: string } | null>(null);
  const [levelSetModal, setLevelSetModal] = useState<{ show: boolean; memberId: string; memberName: string; currentRank: string; currentLevel: number }>({ show: false, memberId: "", memberName: "", currentRank: "white", currentLevel: 1 });
  const [setRank, setSetRank] = useState("white");
  const [setLevel, setSetLevel] = useState(1);

  const handleApprove = async (subId: string) => {
    try {
      const result = await approveMutation.mutateAsync({ id: subId });
      if (result?.leveled_up) {
        toast.success(`레벨 업! Lv.${result.new_level} (+${result.xp_granted} XP)`);
      } else {
        toast.success(`승인 완료! +${result?.xp_granted || 0} XP`);
      }
    } catch { toast.error("승인 실패"); }
  };

  const handleReject = async (subId: string) => {
    try {
      await rejectMutation.mutateAsync({ id: subId, coachNote: "다시 도전해보세요" });
      toast.info("반려 완료");
    } catch { toast.error("반려 실패"); }
  };

  const handleGrantXp = async () => {
    if (!xpModal.memberId || xpAmount <= 0) return;
    try {
      await grantXpMutation.mutateAsync({ memberId: xpModal.memberId, amount: xpAmount, reason: xpReason || "수동 XP 지급" });
      toast.success(`${xpModal.memberName}에게 ${xpAmount} XP 지급 완료`);
      setXpModal({ show: false, memberId: "", memberName: "" });
      setXpAmount(10); setXpReason("");
    } catch { toast.error("XP 지급 실패"); }
  };

  const handleBossPass = async (member: any) => {
    const prog = Array.isArray(member.member_progress) ? member.member_progress[0] : member.member_progress;
    if (!prog || prog.current_level !== 10) {
      toast.error("Lv.10 회원만 타이틀매치 합격 처리 가능합니다");
      return;
    }
    try {
      const result = await bossBattleMutation.mutateAsync({ memberId: member.user_id });
      if (result?.ranked_up) {
        setRankUpInfo({ show: true, oldRank: prog.current_rank, newRank: result.new_rank, memberName: member.nickname || member.name });
      } else {
        toast.success("보스전 합격 처리 완료");
      }
    } catch { toast.error("합격 처리 실패"); }
  };

  const handleLevelUp = async (member: any) => {
    try {
      const result = await levelUpMutation.mutateAsync(member.user_id);
      toast.success(`${member.nickname || member.name} → Lv.${result.new_level} 레벨업! 🥊`);
    } catch (e: any) {
      if (e?.message?.includes("boss battle")) {
        toast.error("Lv.10은 타이틀매치로 리그 승격해야 합니다");
      } else {
        toast.error("레벨업 실패");
      }
    }
  };

  const handleLevelDown = async (member: any) => {
    const prog = Array.isArray(member.member_progress) ? member.member_progress[0] : member.member_progress;
    if (!prog) return;
    if (prog.current_rank === "white" && prog.current_level === 1) {
      toast.error("화이트 Lv.1 이하로 강등할 수 없습니다");
      return;
    }
    if (!confirm(`${member.nickname || member.name}을(를) 1레벨 강등하시겠습니까?`)) return;
    try {
      const result = await levelDownMutation.mutateAsync(member.user_id);
      toast.success(`${member.nickname || member.name} → ${RANK_LABELS[result.new_rank] || result.new_rank} Lv.${result.new_level}로 강등`);
    } catch (e: any) {
      toast.error(e?.message || "강등 실패");
    }
  };

  const handleSetLevel = async () => {
    if (!levelSetModal.memberId) return;
    try {
      const result = await setLevelMutation.mutateAsync({ memberId: levelSetModal.memberId, rank: setRank, level: setLevel });
      toast.success(`${levelSetModal.memberName} → ${RANK_LABELS[result.new_rank] || result.new_rank} Lv.${result.new_level} 설정 완료`);
      setLevelSetModal({ show: false, memberId: "", memberName: "", currentRank: "white", currentLevel: 1 });
    } catch (e: any) {
      toast.error(e?.message || "레벨 설정 실패");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">{(role === "admin" || role === "super_admin") ? "관리자 대시보드" : "관장님 대시보드"}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => setActiveTab("pending")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "pending" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          📋 승인 {pendingSubmissions?.length ? `(${pendingSubmissions.length})` : ""}
        </button>
        <button onClick={() => setActiveTab("members")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "members" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          👥 회원
        </button>
        <button onClick={() => setActiveTab("level-review")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "level-review" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          📋 레벨업 심사
        </button>
        <button onClick={() => setActiveTab("sparring")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "sparring" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          🥊 스파링
        </button>
        {(role === "admin" || role === "super_admin") && (
          <>
            <button onClick={() => setActiveTab("quests")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "quests" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              🥊 퀘스트
            </button>
            <button onClick={() => setActiveTab("missions")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "missions" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              🎯 미션
            </button>
            <button onClick={() => setActiveTab("levels")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "levels" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              🗺️ 레벨
            </button>
            <button onClick={() => setActiveTab("branches")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "branches" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              🏢 지점
            </button>
            <button onClick={() => setActiveTab("coach-requests")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${activeTab === "coach-requests" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              🥊 관장 {coachRequests?.length ? `(${coachRequests.length})` : ""}
            </button>
          </>
        )}
      </div>

      {/* Pending Tab */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)
          ) : !pendingSubmissions?.length ? (
            <EmptyState icon="✅" message="승인 대기 중인 미션이 없습니다" />
          ) : (
            pendingSubmissions.map((sub: any) => (
              <div key={sub.id} className="rounded-2xl border border-status-pending/30 bg-card p-4 shadow-elev-1">
                <div className="mb-3">
                  <p className="text-sm font-bold text-foreground">{sub.missions?.title || "미션"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(sub.requested_at).toLocaleDateString("ko-KR")}</span>
                    <span className="text-xs font-bold text-primary">+{sub.missions?.xp_reward || 0} XP</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(sub.id)} disabled={approveMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-status-complete py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
                    <Check className="h-4 w-4" /> 승인
                  </button>
                  <button onClick={() => handleReject(sub.id)} disabled={rejectMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition-all active:scale-95 disabled:opacity-50">
                    <X className="h-4 w-4" /> 반려
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Level Review Tab */}
      {activeTab === "level-review" && <CoachLevelReviewInbox />}

      {/* Sparring Consents Tab — 코치/관장/관리자 스파링 동의서 확인 */}
      {activeTab === "sparring" && <CoachSparringInbox />}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-3">
          {membersLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
          ) : !members?.length ? (
            <EmptyState icon="👥" message="담당 회원이 없습니다" />
          ) : (
            members.map((member: any) => {
              const prog = Array.isArray(member.member_progress) ? member.member_progress[0] : member.member_progress;
              const memberRole = Array.isArray(member.user_roles) ? member.user_roles[0]?.role : member.user_roles?.role;
              const roleInfo = ROLE_LABELS[memberRole] || ROLE_LABELS.member;
              const isBossReady = prog?.current_level === 10;
              return (
                <div key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{member.nickname || member.name || "이름 없음"}</p>
                        {memberRole && memberRole !== "member" && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                        )}
                      </div>
                      {prog && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-rank-blue/15 px-2 py-0.5 text-[10px] font-bold text-rank-blue">
                            {RANK_LABELS[prog.current_rank] || prog.current_rank} Lv.{prog.current_level}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{prog.total_xp} XP</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Full Member Info */}
                  <div className="mt-3 space-y-1.5 rounded-xl bg-secondary/50 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="text-foreground font-medium">{member.name || "미입력"}</span>
                      <span className="text-muted-foreground">({member.nickname || "닉네임 없음"})</span>
                    </div>
                    {member.phone_number && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{member.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{member.branch_name || "지점 미설정"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>가입: {new Date(member.created_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                    {prog && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>🔥 {prog.streak_days}일 연속</span>
                        <span>🏆 보스 {prog.bosses_cleared}회</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => setDetailMember(member)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-all active:scale-95">
                      <Eye className="h-3.5 w-3.5" /> 상세
                    </button>
                    <button onClick={() => setXpModal({ show: true, memberId: member.user_id, memberName: member.nickname || member.name })}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-all active:scale-95">
                      <Zap className="h-3.5 w-3.5" /> XP
                    </button>
                    {(role === "admin" || role === "super_admin") && (
                      <button onClick={() => {
                        setLevelSetModal({ show: true, memberId: member.user_id, memberName: member.nickname || member.name, currentRank: prog?.current_rank || "white", currentLevel: prog?.current_level || 1 });
                        setSetRank(prog?.current_rank || "white");
                        setSetLevel(prog?.current_level || 1);
                      }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-all active:scale-95">
                        <Settings2 className="h-3.5 w-3.5" /> 레벨설정
                      </button>
                    )}
                  </div>

                  {/* Level Control Buttons */}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleLevelDown(member)} disabled={levelDownMutation.isPending || (prog?.current_rank === "white" && prog?.current_level === 1)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive/10 py-2 text-xs font-bold text-destructive transition-all active:scale-95 disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" /> 강등
                    </button>
                    {!isBossReady && prog?.current_level < 10 && (
                      <button onClick={() => handleLevelUp(member)} disabled={levelUpMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
                        <ArrowUp className="h-3.5 w-3.5" /> 레벨업
                      </button>
                    )}
                    {isBossReady && (
                      <button onClick={() => handleBossPass(member)} disabled={bossBattleMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-reward py-2 text-xs font-bold text-reward-foreground transition-all active:scale-95 disabled:opacity-50">
                        <Trophy className="h-3.5 w-3.5" /> 타이틀매치
                      </button>
                    )}
                  </div>

                  {prog && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-xp-bg">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-reward transition-all"
                          style={{ width: `${Math.min((prog.total_xp / ((["white","blue","red","black"].indexOf(prog.current_rank) * 10 + prog.current_level + 1) * 50)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quests Tab (Admin only) */}
      {activeTab === "quests" && (role === "admin" || role === "super_admin") && <QuestManager />}

      {/* Missions Tab (Admin only) */}
      {activeTab === "missions" && (role === "admin" || role === "super_admin") && <MissionManager />}

      {/* Levels Tab (Admin only) */}
      {activeTab === "levels" && (role === "admin" || role === "super_admin") && <LevelManager />}

      {/* Branches Tab (Admin only) */}
      {activeTab === "branches" && (role === "admin" || role === "super_admin") && (
        <div className="space-y-3">
          {/* Add / Edit Branch */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
            <h3 className="mb-3 text-sm font-bold text-foreground">
              {editingBranch ? "✏️ 지점 수정" : "➕ 새 지점 추가"}
            </h3>
            <div className="flex gap-2">
              <Input
                value={editingBranch ? editingBranch.name : branchInput}
                onChange={(e) => editingBranch ? setEditingBranch({ ...editingBranch, name: e.target.value }) : setBranchInput(e.target.value)}
                placeholder="지점 이름"
                className="rounded-xl"
              />
              <button
                onClick={async () => {
                  if (editingBranch) {
                    if (!editingBranch.name.trim()) return;
                    const { error } = await supabase.from("branches").update({ name: editingBranch.name.trim() }).eq("id", editingBranch.id);
                    if (error) { toast.error("수정 실패"); return; }
                    toast.success("지점 수정 완료");
                    setEditingBranch(null);
                  } else {
                    if (!branchInput.trim()) return;
                    const { error } = await supabase.from("branches").insert({ name: branchInput.trim() });
                    if (error) { toast.error("추가 실패"); return; }
                    toast.success("지점 추가 완료");
                    setBranchInput("");
                  }
                  qc.invalidateQueries({ queryKey: ["branches"] });
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground active:scale-95"
              >
                {editingBranch ? "수정" : "추가"}
              </button>
              {editingBranch && (
                <button onClick={() => setEditingBranch(null)} className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground active:scale-95">
                  취소
                </button>
              )}
            </div>
          </div>

          {/* Branch List */}
          {branches?.length ? branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-elev-1">
              <span className="text-sm font-medium text-foreground">🏢 {b.name}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingBranch({ id: b.id, name: b.name })}
                  className="rounded-lg bg-secondary p-2 active:scale-95">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={async () => {
                  if (!confirm(`"${b.name}" 지점을 삭제하시겠습니까?`)) return;
                  const { error } = await supabase.from("branches").delete().eq("id", b.id);
                  if (error) { toast.error("삭제 실패"); return; }
                  toast.success("지점 삭제 완료");
                  qc.invalidateQueries({ queryKey: ["branches"] });
                }}
                  className="rounded-lg bg-destructive/10 p-2 active:scale-95">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>
          )) : (
            <EmptyState icon="🏢" message="등록된 지점이 없습니다" />
          )}
        </div>
      )}

      {/* Coach Requests Tab */}
      {activeTab === "coach-requests" && (role === "admin" || role === "super_admin") && (
        <div className="space-y-3">
          {coachReqLoading ? (
            [1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)
          ) : !coachRequests?.length ? (
            <EmptyState icon="✅" message="승인 대기 중인 관장님 요청이 없습니다" />
          ) : (
            coachRequests.map((req: any) => (
              <div key={req.id} className="rounded-2xl border border-status-pending/30 bg-card p-4 shadow-elev-1">
                <div className="mb-3">
                  <p className="text-sm font-bold text-foreground">{req.profile?.nickname || req.profile?.name || "이름 없음"}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p>📍 {req.profile?.branch_name || "지점 미설정"}</p>
                    {req.profile?.phone_number && <p>📞 {req.profile.phone_number}</p>}
                    <p>📅 {new Date(req.requested_at).toLocaleDateString("ko-KR")} 신청</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveCoachMutation.mutate(req.id)} disabled={approveCoachMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-status-complete py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
                    <Check className="h-4 w-4" /> 승인
                  </button>
                  <button onClick={() => rejectCoachMutation.mutate(req.id)} disabled={rejectCoachMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition-all active:scale-95 disabled:opacity-50">
                    <X className="h-4 w-4" /> 거절
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}


      {detailMember && (
        <MemberDetailModal
          member={detailMember}
          onClose={() => setDetailMember(null)}
        />
      )}

      {/* Manual XP Modal */}
      {xpModal.show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setXpModal({ show: false, memberId: "", memberName: "" })}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg text-foreground">⚡ XP 수동 지급</h3>
            <p className="mb-3 text-sm text-muted-foreground">대상: <strong className="text-foreground">{xpModal.memberName}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">XP 양</label>
                <div className="flex gap-2">
                  {[10, 20, 30, 50].map(v => (
                    <button key={v} onClick={() => setXpAmount(v)}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${xpAmount === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                    >{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">사유</label>
                <input value={xpReason} onChange={e => setXpReason(e.target.value)} placeholder="예: 수업 태도 우수"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <button onClick={handleGrantXp} disabled={grantXpMutation.isPending}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {grantXpMutation.isPending ? "지급 중..." : `${xpAmount} XP 지급하기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level Set Modal */}
      {levelSetModal.show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setLevelSetModal({ show: false, memberId: "", memberName: "", currentRank: "white", currentLevel: 1 })}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg text-foreground">⚙️ 레벨 직접 설정</h3>
            <p className="mb-3 text-sm text-muted-foreground">대상: <strong className="text-foreground">{levelSetModal.memberName}</strong></p>
            <p className="mb-3 text-xs text-muted-foreground">현재: {RANK_LABELS[levelSetModal.currentRank] || levelSetModal.currentRank} Lv.{levelSetModal.currentLevel}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">랭크</label>
                <div className="flex gap-2">
                  {(["white", "blue", "red", "black"] as const).map(r => (
                    <button key={r} onClick={() => setSetRank(r)}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${setRank === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                    >{RANK_LABELS[r]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">레벨 (1~10)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(l => (
                    <button key={l} onClick={() => setSetLevel(l)}
                      className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${setLevel === l ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleSetLevel} disabled={setLevelMutation.isPending}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {setLevelMutation.isPending ? "설정 중..." : `${RANK_LABELS[setRank] || setRank} Lv.${setLevel}로 설정`}
              </button>
            </div>
          </div>
        </div>
      )}

      <RankUpCeremony
        isOpen={rankUpInfo.show}
        onClose={() => setRankUpInfo({ show: false, oldRank: "", newRank: "", memberName: "" })}
        oldRank={rankUpInfo.oldRank}
        newRank={rankUpInfo.newRank}
        memberName={rankUpInfo.memberName}
      />

      {/* ─── v2 22단계: 153 QUEST 몰입 관리 (코치/관장 전용) ─── */}
      {/*       표시 전용. RPC 내부에서 권한 검증 + 민감정보 화이트리스트. */}
      <QuestCoachSummaryPanel />
    </div>
  );
};

/* ── Member Detail Modal with Hidden Mastery + Cert ── */
const MemberDetailModal = ({ member, onClose }: { member: any; onClose: () => void }) => {
  const prog = Array.isArray(member.member_progress) ? member.member_progress[0] : member.member_progress;
  const { data: mastery } = useHiddenMastery(member.user_id);
  const { data: cert } = useExternalCertProgress(member.user_id);

  const isMaster40 = prog?.current_rank === "black" && prog?.current_level === 10 && prog?.bosses_cleared >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg text-foreground">{member.nickname || member.name}</h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-2 active:scale-95">
            <X className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>

        {/* Basic info */}
        {prog && (
          <div className="mb-4 rounded-xl bg-secondary p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-rank-blue/15 px-2 py-0.5 text-xs font-bold text-rank-blue">
                {RANK_LABELS[prog.current_rank] || prog.current_rank} Lv.{prog.current_level}
              </span>
              <span className="text-sm font-bold text-foreground">{prog.total_xp} XP</span>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>🔥 {prog.streak_days}일 연속</span>
              <span>🏆 보스 {prog.bosses_cleared}회</span>
            </div>
          </div>
        )}

        {/* Hidden Mastery Scores */}
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-bold text-foreground">📊 마스터리 점수</h4>
          {mastery ? (
            <div className="space-y-2">
              {MASTERY_FIELDS.map(({ key, label, icon: Icon, color }) => {
                const score = (mastery as any)[key] || 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="w-12 text-xs text-muted-foreground">{label}</span>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-foreground">{score}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">데이터 없음</p>
          )}
        </div>

        {/* External Cert Progress */}
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-bold text-foreground">📋 자격 준비도</h4>
          {cert ? (
            <div className="space-y-2">
              <CertRow label="단증 4단 준비" ready={cert.dan4_ready} />
              <CertRow label="심사관 후보 추천 가능" ready={cert.examiner_ready} />
              <CertRow label="코치 자격 트랙 준비" ready={cert.coach_cert_ready} />
              <CertRow label="연령 기준 충족" ready={cert.age_gate} />
              <CertRow label="코치 승인" ready={cert.coach_approval} />
              {cert.notes && (
                <p className="mt-1 text-xs text-muted-foreground">메모: {cert.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">데이터 없음</p>
          )}
        </div>

        {/* MASTER 40 Status */}
        {isMaster40 && (
          <div className="rounded-xl border-2 border-reward bg-reward/10 p-4">
            <h4 className="text-sm font-bold text-foreground">🏆 MASTER 40 달성</h4>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {cert?.dan4_ready && <p className="text-status-complete">✅ 단증 4단 준비 조건 완료</p>}
              {cert?.examiner_ready && <p className="text-status-complete">✅ 심사관 후보자 추천 가능</p>}
              {cert?.coach_cert_ready && <p className="text-status-complete">✅ 코치 자격 트랙 준비 완료</p>}
              {!cert?.dan4_ready && <p>⬜ 단증 4단 준비 미완료</p>}
              {!cert?.examiner_ready && <p>⬜ 심사관 후보 미추천</p>}
              {!cert?.coach_cert_ready && <p>⬜ 코치 자격 미준비</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CertRow = ({ label, ready }: { label: string; ready: boolean }) => (
  <div className="flex items-center gap-2">
    <span className={ready ? "text-status-complete" : "text-muted-foreground"}>{ready ? "✅" : "⬜"}</span>
    <span className={`text-xs ${ready ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    <span className={`ml-auto text-[10px] font-bold ${ready ? "text-status-complete" : "text-muted-foreground"}`}>
      {ready ? "준비 완료" : "미완료"}
    </span>
  </div>
);

const EmptyState = ({ icon, message }: { icon: string; message: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <span className="text-4xl">{icon}</span>
    <p className="mt-3 text-sm text-muted-foreground">{message}</p>
  </div>
);

export default CoachDashboard;
