import { usePendingMissionSubmissions, useApproveMission, useRejectMission, useHiddenMastery, useExternalCertProgress, useUpdateHiddenMastery, useUpdateCertProgress } from "@/hooks/useMissionData";
import { useAssignedMembers, useGrantManualXp, usePassBossBattle } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, X, User, Zap, Trophy, Eye, Shield, BookOpen, Heart, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import RankUpCeremony from "@/components/RankUpCeremony";
import { toast } from "sonner";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const MASTERY_FIELDS = [
  { key: "technique_score", label: "기술", icon: Target, color: "text-rank-blue" },
  { key: "conditioning_score", label: "체력", icon: Heart, color: "text-rank-red" },
  { key: "teaching_score", label: "지도력", icon: BookOpen, color: "text-primary" },
  { key: "safety_score", label: "안전", icon: Shield, color: "text-status-complete" },
  { key: "evaluation_score", label: "평가", icon: Eye, color: "text-accent" },
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
  const updateMastery = useUpdateHiddenMastery();
  const updateCert = useUpdateCertProgress();

  const [activeTab, setActiveTab] = useState<"pending" | "members">("pending");
  const [rankUpInfo, setRankUpInfo] = useState<{ show: boolean; oldRank: string; newRank: string; memberName: string }>({ show: false, oldRank: "", newRank: "", memberName: "" });
  const [xpModal, setXpModal] = useState<{ show: boolean; memberId: string; memberName: string }>({ show: false, memberId: "", memberName: "" });
  const [xpAmount, setXpAmount] = useState(10);
  const [xpReason, setXpReason] = useState("");
  const [detailMember, setDetailMember] = useState<any | null>(null);

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

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/home")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">{role === "admin" ? "관리자 대시보드" : "코치 대시보드"}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === "pending" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"}`}>
          📋 승인 대기 {pendingSubmissions?.length ? `(${pendingSubmissions.length})` : ""}
        </button>
        <button onClick={() => setActiveTab("members")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === "members" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"}`}>
          👥 회원 관리
        </button>
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
              <div key={sub.id} className="rounded-2xl border border-status-pending/30 bg-card p-4 shadow-sm">
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
              const isBossReady = prog?.current_level === 10;
              return (
                <div key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{member.nickname || member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.branch_name || "미설정"}</p>
                      {prog && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-rank-blue/15 px-2 py-0.5 text-[10px] font-bold text-rank-blue">
                            {RANK_LABELS[prog.current_rank] || prog.current_rank} Lv.{prog.current_level}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{prog.total_xp} XP</span>
                          <span className="text-[10px] text-muted-foreground">🔥{prog.streak_days}일</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setDetailMember(member)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-all active:scale-95">
                      <Eye className="h-3.5 w-3.5" /> 상세보기
                    </button>
                    <button onClick={() => setXpModal({ show: true, memberId: member.user_id, memberName: member.nickname || member.name })}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-all active:scale-95">
                      <Zap className="h-3.5 w-3.5" /> XP 지급
                    </button>
                    {isBossReady && (
                      <button onClick={() => handleBossPass(member)} disabled={bossBattleMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent py-2 text-xs font-bold text-accent-foreground transition-all active:scale-95 disabled:opacity-50">
                        <Trophy className="h-3.5 w-3.5" /> 타이틀매치
                      </button>
                    )}
                  </div>

                  {prog && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-xp-bg">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
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

      {/* Member Detail Modal (Hidden Mastery + Cert) */}
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

      <RankUpCeremony
        isOpen={rankUpInfo.show}
        onClose={() => setRankUpInfo({ show: false, oldRank: "", newRank: "", memberName: "" })}
        oldRank={rankUpInfo.oldRank}
        newRank={rankUpInfo.newRank}
        memberName={rankUpInfo.memberName}
      />
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
          <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
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
