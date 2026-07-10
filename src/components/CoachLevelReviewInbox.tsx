// Coach Level Review Inbox — 레벨업 심사 인박스
// 실데이터 연동: level_status(pending/revision_requested) 큐 + set_level_status RPC.
// 이전 목데이터 데모를 대체 — UI 구조·스타일은 유지.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RANK_LABELS } from "@/data/sharedConstants";
import { toast } from "sonner";

// Quick feedback templates — 승인/보완 시 approval_note 로 전송됨
const QUICK_FEEDBACK = [
  "가드가 얼굴에서 멀어집니다",
  "잽 후 손이 늦게 돌아옵니다",
  "전진/후진 스텝에서 발이 교차됩니다",
  "스텝 후 자세 복구가 느립니다",
  "줄넘기 리듬은 좋지만 가드 유지가 더 필요합니다",
  "다음 수업에서 부족한 항목만 보완하면 됩니다",
];

type ReviewStatus = "pending" | "revision_requested";

interface ReviewMember {
  lsId: string;
  userId: string;
  nickname: string;
  rank: string;
  level: number;
  status: ReviewStatus;
  totalXp: number;
  streakDays: number;
  days30: number;
  bossesCleared: number;
  requestedAt: string;
  note: string | null;
}

type FilterKey = "all" | "review_ready" | "remediation" | "deadline";

// 보완 요청 후 마감 안내 기준(요청일 + 7일). 서버 컬럼이 아닌 표시용 계산.
const REMEDIATION_DAYS = 7;
const dueDateStr = (m: ReviewMember) =>
  new Date(new Date(m.requestedAt).getTime() + REMEDIATION_DAYS * 86400000).toLocaleDateString("en-CA");
const daysLeft = (m: ReviewMember) =>
  Math.ceil((new Date(m.requestedAt).getTime() + REMEDIATION_DAYS * 86400000 - Date.now()) / 86400000);

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "레벨업 심사 가능",
  revision_requested: "보완 필요",
};

const STATUS_ICON: Record<ReviewStatus, typeof CheckCircle2> = {
  pending: CheckCircle2,
  revision_requested: AlertTriangle,
};

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending: "text-status-complete bg-status-complete/10",
  revision_requested: "text-status-pending bg-status-pending/10",
};

const CoachLevelReviewInbox = () => {
  const { user, role, profile } = useAuth();
  const seesAll = role === "admin" || role === "super_admin";
  const branch = profile?.branch_name || "";
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["level-review-queue", seesAll ? "all" : branch],
    enabled: !!user?.id && (seesAll || !!branch),
    staleTime: 30_000,
    queryFn: async (): Promise<ReviewMember[]> => {
      // level_status 는 types.ts 재생성 전 테이블 — 기존 파일들과 같은 캐스트 패턴 사용
      const { data: lsRows, error } = await (supabase as any)
        .from("level_status")
        .select("id, user_id, rank_name, level_number, status, approval_note, updated_at")
        .in("status", ["pending", "revision_requested"])
        .order("updated_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const rows = (lsRows || []) as Array<{
        id: string; user_id: string; rank_name: string; level_number: number;
        status: ReviewStatus; approval_note: string | null; updated_at: string;
      }>;
      if (rows.length === 0) return [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];

      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [profilesRes, progressRes, attRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nickname, name, branch_name").in("user_id", userIds),
        supabase.from("member_progress").select("user_id, total_xp, streak_days, bosses_cleared").in("user_id", userIds),
        supabase.from("attendance_logs").select("user_id, checked_in_at").in("user_id", userIds).eq("is_duplicate", false).gte("checked_in_at", since30),
      ]);
      const pMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const gMap = new Map((progressRes.data || []).map((g) => [g.user_id, g]));
      const attDays = new Map<string, Set<string>>();
      for (const a of attRes.data || []) {
        const day = new Date(a.checked_in_at).toLocaleDateString("en-CA");
        if (!attDays.has(a.user_id)) attDays.set(a.user_id, new Set());
        attDays.get(a.user_id)!.add(day);
      }

      return rows
        .filter((r) => {
          const p = pMap.get(r.user_id);
          return p && (seesAll || p.branch_name === branch);
        })
        .map((r) => {
          const p = pMap.get(r.user_id)!;
          const g = gMap.get(r.user_id);
          return {
            lsId: r.id,
            userId: r.user_id,
            nickname: p.nickname || p.name || "회원",
            rank: r.rank_name,
            level: r.level_number,
            status: r.status,
            totalXp: g?.total_xp ?? 0,
            streakDays: g?.streak_days ?? 0,
            days30: attDays.get(r.user_id)?.size ?? 0,
            bossesCleared: g?.bosses_cleared ?? 0,
            requestedAt: r.updated_at,
            note: r.approval_note,
          };
        });
    },
  });

  // 승인/보완 → approve_level_review (실제 레벨업 + 사이클 리셋). 보류(in_progress)만 set_level_status.
  const decide = useMutation({
    mutationFn: async ({ m, status }: { m: ReviewMember; status: "approved" | "revision_requested" | "in_progress" }) => {
      const note = selectedFeedback.length > 0 ? selectedFeedback.join(" / ") : null;
      if (status === "approved" || status === "revision_requested") {
        const { error } = await (supabase.rpc as any)("approve_level_review", {
          _member_id: m.userId,
          _approve: status === "approved",
          _note: note,
        });
        if (error) throw error;
        return status;
      }
      const { error } = await supabase.rpc("set_level_status", {
        _member_id: m.userId,
        _rank: m.rank as never,
        _level: m.level,
        _status: status as never,
        _note: note,
      });
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      qc.invalidateQueries({ queryKey: ["level-review-queue"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["level-cycle"] });
      setSelectedFeedback([]);
      toast.success(
        status === "approved" ? "레벨업 승인 — 레벨이 올랐습니다 🎉"
        : status === "revision_requested" ? "보완을 요청했습니다"
        : "심사를 보류했습니다 (진행중으로 되돌림)",
      );
    },
    onError: (e: any) => toast.error(e?.message || "처리 실패 — 다시 시도해주세요"),
  });

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "review_ready", label: "심사 가능" },
    { key: "remediation", label: "보완중" },
    { key: "deadline", label: "마감 임박" },
  ];

  const filtered = queue.filter((m) => {
    if (filter === "review_ready") return m.status === "pending";
    if (filter === "remediation") return m.status === "revision_requested";
    if (filter === "deadline") return m.status === "revision_requested" && daysLeft(m) <= 2;
    return true;
  });

  const toggleFeedback = (fb: string) => {
    setSelectedFeedback((prev) =>
      prev.includes(fb) ? prev.filter((f) => f !== fb) : [...prev, fb],
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground">📋 레벨업 심사 인박스</h3>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
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

      {/* Queue */}
      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">✅</span>
          <p className="mt-2 text-sm text-muted-foreground">심사 대기 회원이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((member) => {
            const Icon = STATUS_ICON[member.status] || Clock;
            const color = STATUS_COLOR[member.status] || "text-muted-foreground bg-muted";
            return (
              <div key={member.lsId} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{member.nickname}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {RANK_LABELS[member.rank] || member.rank} Lv.{member.level}
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>
                    <Icon className="h-3 w-3" /> {STATUS_LABEL[member.status]}
                  </span>
                </div>

                {/* Metrics — 서버 실측치 */}
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  <MiniMetric label="총 XP" value={member.totalXp.toLocaleString()} />
                  <MiniMetric label="연속출석" value={`${member.streakDays}일`} />
                  <MiniMetric label="30일 출석" value={`${member.days30}일`} />
                  <MiniMetric label="보스" value={`${member.bossesCleared}회`} />
                </div>

                {member.status === "revision_requested" && (
                  <p className="mb-2 text-[10px] text-status-pending">
                    ⏰ 보완 마감: {dueDateStr(member)} (요청 +{REMEDIATION_DAYS}일)
                  </p>
                )}
                {member.note && (
                  <p className="mb-2 text-[10px] text-muted-foreground">📝 {member.note}</p>
                )}

                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => decide.mutate({ m: member, status: "approved" })}
                    disabled={decide.isPending}
                    className="flex-1 rounded-xl bg-status-complete py-2.5 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    ✅ 레벨업 승인
                  </button>
                  <button
                    onClick={() => decide.mutate({ m: member, status: "revision_requested" })}
                    disabled={decide.isPending}
                    className="flex-1 rounded-xl bg-status-pending/20 py-2.5 text-xs font-bold text-status-pending transition-all active:scale-95 disabled:opacity-50"
                  >
                    🔄 보완 요청
                  </button>
                  <button
                    onClick={() => decide.mutate({ m: member, status: "in_progress" })}
                    disabled={decide.isPending}
                    title="심사 보류 — 진행중으로 되돌림"
                    className="rounded-xl bg-muted px-3 py-2.5 text-xs font-bold text-muted-foreground transition-all active:scale-95 disabled:opacity-50"
                  >
                    ⏸️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick feedback templates */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <p className="mb-2 text-xs font-bold text-foreground">💬 빠른 피드백 템플릿</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FEEDBACK.map((fb) => (
            <button
              key={fb}
              onClick={() => toggleFeedback(fb)}
              className={`rounded-full border px-2.5 py-1 text-[10px] transition-all active:scale-95 ${
                selectedFeedback.includes(fb)
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {fb}
            </button>
          ))}
        </div>
        {selectedFeedback.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            선택된 피드백은 승인/보완 처리 시 회원 알림에 함께 전송됩니다: {selectedFeedback.join(" / ")}
          </p>
        )}
      </div>
    </div>
  );
};

const MiniMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg bg-muted/30 p-1.5 text-center">
    <p className="text-xs font-bold text-foreground">{value}</p>
    <p className="text-[8px] text-muted-foreground">{label}</p>
  </div>
);

export default CoachLevelReviewInbox;
