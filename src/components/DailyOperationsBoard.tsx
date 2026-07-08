// 오늘 운영 보드 — 실데이터 연동
// 방문자: attendance_logs(오늘·지점) / 오늘도전 완료: activity_sessions(completed)
// 코치 처리·태그: manager_notes(note_type='daily_ops', content=JSON) 영속 저장.
// 이전 localStorage+데모 방문자 fallback 을 대체 — UI 구조·스타일은 유지.
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COACH_QUICK_TAGS, COACH_QUICK_ACTIONS } from "@/data/allLevelsData";
import { CheckCircle2, Clock, Users, AlertTriangle, TrendingUp, ChevronDown, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TodayVisitor {
  userId: string;
  nickname: string;
  currentLevel: number;
  currentRank: string;
  status: string;
  selfChallengeComplete: boolean;
  coachTags: string[];
  checkedInAt: string;
}

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  self_challenge: { bg: "bg-status-complete/10", text: "text-status-complete", label: "오늘 도전 완료" },
  coach_backup: { bg: "bg-primary/10", text: "text-primary", label: "코치 확인 완료" },
  partial: { bg: "bg-status-pending/10", text: "text-status-pending", label: "부분 완료" },
  needs_review: { bg: "bg-destructive/10", text: "text-destructive", label: "보완 필요" },
  pending: { bg: "bg-muted", text: "text-muted-foreground", label: "미처리" },
  not_completed: { bg: "bg-muted", text: "text-muted-foreground", label: "미완료" },
};

const EXTENDED_ACTIONS = [
  ...COACH_QUICK_ACTIONS,
  { id: "league_promotion", label: "승격 체크", emoji: "🏆", color: "bg-reward" },
];

// 코치 액션 → 참여 상태 매핑 (기존 매핑 유지 + promotion_check 보강)
const ACTION_STATUS: Record<string, string> = {
  complete: "coach_backup",
  partial: "partial",
  needs_review: "needs_review",
  levelup_check: "needs_review",
  promotion_check: "needs_review",
  league_promotion: "needs_review",
};

// 로컬(KST) 자정 기준 — UTC 사용 시 오전 0~9시에 어제 보드가 보임.
const todayStartIso = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString();
};

type DailyOpsNote = { action?: string; status?: string; tags?: string[] };

const DailyOperationsBoard = () => {
  const { user, profile } = useAuth();
  const branch = profile?.branch_name || "";
  const qc = useQueryClient();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState<string | null>(null);

  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ["daily-ops", branch],
    enabled: !!user?.id && !!branch,
    refetchInterval: 60_000, // 운영 보드 특성상 1분 자동 갱신
    queryFn: async (): Promise<TodayVisitor[]> => {
      const since = todayStartIso();
      const { data: logs, error } = await supabase
        .from("attendance_logs")
        .select("user_id, display_name_snapshot, league_snapshot, level_snapshot, checked_in_at")
        .eq("branch_name", branch)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: true });
      if (error) throw error;

      const byUser = new Map<string, NonNullable<typeof logs>[number]>();
      for (const l of logs || []) if (!byUser.has(l.user_id)) byUser.set(l.user_id, l);
      const userIds = [...byUser.keys()];
      if (userIds.length === 0) return [];

      const [sessionsRes, notesRes] = await Promise.all([
        supabase
          .from("activity_sessions")
          .select("user_id, status")
          .eq("branch_name", branch)
          .gte("started_at", since)
          .in("user_id", userIds),
        supabase
          .from("manager_notes")
          .select("user_id, content, created_at")
          .eq("note_type", "daily_ops")
          .gte("created_at", since)
          .in("user_id", userIds)
          .order("created_at", { ascending: false }),
      ]);

      const completedSet = new Set(
        (sessionsRes.data || []).filter((s) => s.status === "completed").map((s) => s.user_id),
      );
      const noteByUser = new Map<string, DailyOpsNote>();
      for (const n of notesRes.data || []) {
        if (noteByUser.has(n.user_id)) continue; // 최신 노트만
        try {
          noteByUser.set(n.user_id, JSON.parse(n.content) as DailyOpsNote);
        } catch {
          /* 구형 텍스트 노트는 무시 */
        }
      }

      return userIds.map((id) => {
        const l = byUser.get(id)!;
        const note = noteByUser.get(id);
        const selfDone = completedSet.has(id);
        return {
          userId: id,
          nickname: l.display_name_snapshot || "회원",
          currentRank: l.league_snapshot || "white",
          currentLevel: l.level_snapshot || 1,
          selfChallengeComplete: selfDone,
          status: note?.status || (selfDone ? "self_challenge" : "pending"),
          coachTags: note?.tags || [],
          checkedInAt: l.checked_in_at,
        };
      });
    },
  });

  const actionMut = useMutation({
    mutationFn: async ({ userId, action, tags }: { userId: string; action: string; tags: string[] }) => {
      const status = ACTION_STATUS[action] || "pending";
      const { error } = await supabase.from("manager_notes").insert({
        user_id: userId,
        manager_id: user!.id,
        note_type: "daily_ops",
        content: JSON.stringify({ action, status, tags }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-ops", branch] });
      toast.success("처리 기록 저장됨");
    },
    onError: () => toast.error("저장 실패 — 다시 시도해주세요"),
  });

  const metrics = useMemo(() => {
    const total = visitors.length;
    const selfComplete = visitors.filter((v) => v.selfChallengeComplete).length;
    const coachComplete = visitors.filter((v) => v.status === "coach_backup").length;
    const partial = visitors.filter((v) => v.status === "partial").length;
    const needsReview = visitors.filter((v) => v.status === "needs_review").length;
    const pending = visitors.filter((v) => v.status === "pending").length;
    const selfRate = total > 0 ? Math.round((selfComplete / total) * 100) : 0;
    return { total, selfComplete, coachComplete, partial, needsReview, pending, selfRate };
  }, [visitors]);

  const handleQuickAction = (userId: string, action: string) => {
    actionMut.mutate({ userId, action, tags: selectedTags });
    setSelectedTags([]);
    setShowTagPicker(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const pendingVisitors = visitors.filter((v) => v.status === "pending");
  const processedVisitors = visitors.filter((v) => v.status !== "pending");

  return (
    <div className="space-y-4">
      {/* Metrics — 2 rows */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={<Users className="h-4 w-4 text-primary" />} label="오늘 방문" value={metrics.total} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-status-complete" />} label="오늘 도전" value={metrics.selfComplete} />
        <MetricCard icon={<Clock className="h-4 w-4 text-status-pending" />} label="미처리" value={metrics.pending} highlight={metrics.pending > 0} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MetricCard icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="참여율" value={`${metrics.selfRate}%`} />
        <MetricCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />} label="코치" value={metrics.coachComplete} />
        <MetricCard icon={<Shield className="h-3.5 w-3.5 text-status-pending" />} label="부분" value={metrics.partial} />
        <MetricCard icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />} label="보완" value={metrics.needsReview} />
      </div>

      {/* Pending Queue */}
      {pendingVisitors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">⏳ 코치 백업 필요 ({pendingVisitors.length}명)</h3>
          <div className="space-y-2">
            {pendingVisitors.map((v) => (
              <div key={v.userId} className="rounded-2xl border border-status-pending/30 bg-card shadow-elev-1 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {v.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{v.nickname}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {RANK_LABELS[v.currentRank] || v.currentRank} Lv.{v.currentLevel}
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-1 border-t border-border px-2 py-2">
                  {EXTENDED_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(v.userId, action.id)}
                      disabled={actionMut.isPending}
                      className={`flex-1 rounded-lg py-1.5 text-[9px] font-bold text-white transition-all active:scale-95 disabled:opacity-50 ${action.color}`}
                    >
                      {action.emoji} {action.label}
                    </button>
                  ))}
                </div>

                {/* Quick tags toggle */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setShowTagPicker(showTagPicker === v.userId ? null : v.userId)}
                    className="text-[10px] text-muted-foreground flex items-center gap-1"
                  >
                    🏷️ 태그 추가 <ChevronDown className={`h-3 w-3 transition-transform ${showTagPicker === v.userId ? "rotate-180" : ""}`} />
                  </button>
                  {showTagPicker === v.userId && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COACH_QUICK_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                            selectedTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed List */}
      {processedVisitors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">✅ 처리 완료 ({processedVisitors.length}명)</h3>
          <div className="space-y-1.5">
            {processedVisitors.map((v) => {
              const style = STATUS_STYLE[v.status] || STATUS_STYLE.pending;
              return (
                <div key={v.userId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {v.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">{v.nickname}</p>
                      <span className="text-[9px] text-muted-foreground">{RANK_LABELS[v.currentRank]} Lv.{v.currentLevel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      {v.coachTags.length > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          {v.coachTags.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {v.selfChallengeComplete && (
                    <span className="text-[9px] font-bold text-status-complete">오늘 도전</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      ) : visitors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">👥</span>
          <p className="mt-2 text-sm text-muted-foreground">오늘 방문자가 없습니다</p>
        </div>
      ) : null}
    </div>
  );
};

const MetricCard = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number | string; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-3 text-center ${highlight ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"}`}>
    <div className="mx-auto mb-1 flex justify-center">{icon}</div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[9px] text-muted-foreground">{label}</p>
  </div>
);

export default DailyOperationsBoard;
