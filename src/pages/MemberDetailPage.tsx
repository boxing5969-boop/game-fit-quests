import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Clock, Pencil, ChevronRight, MessageSquare, FileText, Map, Activity, User, Eye } from "lucide-react";
import { formatRank, RANK_LABELS, RANK_ICONS, RANK_ORDER, isManagerRole } from "@/lib/rankLabels";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import LevelStatusActionSheet from "@/components/LevelStatusActionSheet";
import MissionVideoUpload from "@/components/MissionVideoUpload";

type TabKey = "overview" | "missions" | "levelmap" | "activity" | "notes";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  locked: { label: "잠금", color: "text-muted-foreground" },
  in_progress: { label: "진행중", color: "text-primary" },
  pending: { label: "승인대기", color: "text-status-pending" },
  approved: { label: "완료", color: "text-status-complete" },
  revision_requested: { label: "수정요청", color: "text-amber-600" },
  rejected: { label: "반려", color: "text-destructive" },
  boss_cleared: { label: "보스전 완료", color: "text-accent" },
};

const MemberDetailPage = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<"internal" | "visible">("internal");
  const [actionNote, setActionNote] = useState("");
  const [actionSheet, setActionSheet] = useState<{ rank: Enums<"rank_name">; level: number; status: string } | null>(null);

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

  // Manager notes
  const { data: notes } = useQuery({
    queryKey: ["manager-notes", memberId],
    enabled: !!memberId && isManagerRole(role) && activeTab === "notes",
    queryFn: async () => {
      const { data } = await supabase
        .from("manager_notes")
        .select("*")
        .eq("user_id", memberId!)
        .order("created_at", { ascending: false });
      return data || [];
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
        note_type: noteType,
        content: noteContent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("메모 저장 완료");
      setNoteContent("");
      qc.invalidateQueries({ queryKey: ["manager-notes", memberId] });
    },
  });

  if (isLoading || !member?.profile || !member?.progress) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div className="mt-8 flex justify-center">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const p = member.profile;
  const prog = member.progress;
  const pendingSubs = (missionSubs || []).filter(s => s.status === "pending");
  const globalLevel = RANK_ORDER.indexOf(prog.current_rank as any) * 10 + prog.current_level;

  const getLevelStatus = (rank: string, level: number) => {
    const found = (levelStatuses || []).find(ls => ls.rank_name === rank && ls.level_number === level);
    return found?.status || "locked";
  };

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "개요", icon: User },
    { key: "missions", label: "미션 승인", icon: FileText },
    { key: "levelmap", label: "리그맵 체크", icon: Map },
    { key: "activity", label: "활동기록", icon: Activity },
    { key: "notes", label: "메모", icon: MessageSquare },
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
            {member.memberRole === "branch_manager" || member.memberRole === "coach" ? (
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
        <RankBadge rank={prog.current_rank as Enums<"rank_name">} level={prog.current_level} size="sm" />
      </div>

      {/* Summary Card */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2 text-center">
          <MiniStat label="총 XP" value={prog.total_xp.toLocaleString()} />
          <MiniStat label="출석" value={`${prog.streak_days}일`} />
          <MiniStat label="진행" value={`${globalLevel}/40`} />
          <MiniStat label="대기" value={`${pendingSubs.length}건`} highlight={pendingSubs.length > 0} />
        </div>
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
          <InfoCard label="현재 랭크" value={formatRank(prog.current_rank, prog.current_level)} />
          <InfoCard label="보스전 클리어" value={`${prog.bosses_cleared}회`} />
          <InfoCard label="이름" value={p.name} />
          <InfoCard label="전화번호" value={p.phone_number || "미등록"} />

          {/* Quick Actions */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-foreground">빠른 액션</h3>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn label="승인대기 보기" onClick={() => setActiveTab("missions")} count={pendingSubs.length} />
              <ActionBtn label="리그맵 체크" onClick={() => setActiveTab("levelmap")} />
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
                  className="col-span-2 rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground shadow transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  🏆 보스전 합격 처리
                </button>
              )}
            </div>
          </div>
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
                      <span className="text-[10px] font-bold text-foreground">{lvl}</span>
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
            <div className="mb-2 flex gap-2">
              <button onClick={() => setNoteType("internal")} className={`rounded-full px-3 py-1 text-xs font-bold ${noteType === "internal" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                내부 메모
              </button>
              <button onClick={() => setNoteType("visible")} className={`rounded-full px-3 py-1 text-xs font-bold ${noteType === "visible" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                회원 표시
              </button>
            </div>
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="메모를 입력하세요..."
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
          {(notes || []).map(note => (
            <div key={note.id} className={`rounded-xl border p-3 ${note.note_type === "visible" ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${note.note_type === "visible" ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                  {note.note_type === "visible" ? "회원 표시" : "내부"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
