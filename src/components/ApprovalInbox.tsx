import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Pencil, ChevronDown, CheckSquare, Square, Clock } from "lucide-react";
import { formatRank, RANK_ICONS, TEMPLATE_COMMENTS } from "@/lib/rankLabels";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface PendingItem {
  id: string;
  type: "mission" | "quest" | "member" | "coach_request";
  title: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  rank: string;
  level: number;
  requested_at: string;
  xp_reward: number;
  branch_name?: string;
  phone_number?: string | null;
  signup_provider?: string;
}

const ApprovalInbox = () => {
  const { profile, role } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branchName = profile?.branch_name || "";
  const isSuperAdmin = role === "super_admin" || role === "admin";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "today">("today");

  // Fetch all pending approvals
  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["approval-inbox", branchName, isSuperAdmin],
    enabled: !!branchName || isSuperAdmin,
    queryFn: async () => {
      const [missionRes, questRes, profilesRes, coachReqRes] = await Promise.all([
        supabase
          .from("mission_submissions")
          .select("id, user_id, mission_id, requested_at, missions(title, xp_reward)")
          .eq("status", "pending")
          .order("requested_at", { ascending: false }),
        supabase
          .from("quest_submissions")
          .select("id, user_id, quest_id, requested_at, quests(title, xp_reward)")
          .eq("status", "pending")
          .order("requested_at", { ascending: false }),
        (() => {
          let query = supabase
            .from("profiles")
            .select("user_id, nickname, name, avatar_url, branch_name, phone_number, created_at")
            .eq("is_approved", false)
            .order("created_at", { ascending: false });

          if (!isSuperAdmin) {
            query = query.eq("branch_name", branchName);
          }

          return query;
        })(),
        isSuperAdmin
          ? supabase
              .from("coach_requests")
              .select("id, user_id, requested_at, status")
              .eq("status", "pending")
              .order("requested_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (missionRes.error) throw missionRes.error;
      if (questRes.error) throw questRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (coachReqRes && "error" in coachReqRes && coachReqRes.error) throw coachReqRes.error;

      const userIds = new Set<string>();
      (missionRes.data || []).forEach(s => userIds.add(s.user_id));
      (questRes.data || []).forEach(s => userIds.add(s.user_id));
      (profilesRes.data || []).forEach(p => userIds.add(p.user_id));
      ((coachReqRes && "data" in coachReqRes ? coachReqRes.data : []) || []).forEach((r: any) => userIds.add(r.user_id));

      if (userIds.size === 0) return [];

      const [profileDetailsRes, progressRes, providerRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nickname, name, avatar_url, branch_name, phone_number").in("user_id", [...userIds]),
        supabase.from("member_progress").select("user_id, current_rank, current_level").in("user_id", [...userIds]),
        supabase.rpc("get_signup_providers", { _user_ids: [...userIds] }),
      ]);

      if (profileDetailsRes.error) throw profileDetailsRes.error;
      if (progressRes.error) throw progressRes.error;
      if (providerRes.error) throw providerRes.error;

      const profileMap = new Map((profileDetailsRes.data || []).map(p => [p.user_id, p]));
      const progressMap = new Map((progressRes.data || []).map(p => [p.user_id, p]));
      const providerMap = new Map((providerRes.data || []).map((p) => [p.user_id, p.signup_provider]));

      const items: PendingItem[] = [];

      (missionRes.data || []).forEach(s => {
        const p = profileMap.get(s.user_id);
        const prog = progressMap.get(s.user_id);
        if (!p || p.branch_name !== branchName) return;
        items.push({
          id: s.id,
          type: "mission",
          title: (s.missions as any)?.title || "미션",
          user_id: s.user_id,
          nickname: p.nickname || "회원",
          avatar_url: p.avatar_url,
          rank: prog?.current_rank || "white",
          level: prog?.current_level || 1,
          requested_at: s.requested_at,
          xp_reward: (s.missions as any)?.xp_reward || 0,
          branch_name: p.branch_name,
          phone_number: p.phone_number,
          signup_provider: providerMap.get(s.user_id),
        });
      });

      (questRes.data || []).forEach(s => {
        const p = profileMap.get(s.user_id);
        const prog = progressMap.get(s.user_id);
        if (!p || p.branch_name !== branchName) return;
        items.push({
          id: s.id,
          type: "quest",
          title: (s.quests as any)?.title || "퀘스트",
          user_id: s.user_id,
          nickname: p.nickname || "회원",
          avatar_url: p.avatar_url,
          rank: prog?.current_rank || "white",
          level: prog?.current_level || 1,
          requested_at: s.requested_at,
          xp_reward: (s.quests as any)?.xp_reward || 0,
          branch_name: p.branch_name,
          phone_number: p.phone_number,
          signup_provider: providerMap.get(s.user_id),
        });
      });

      // Collect coach request user IDs to exclude from member list
      const coachRequestUserIds = new Set(
        (coachReqRes && "data" in coachReqRes ? coachReqRes.data : [])?.map((r: any) => r.user_id) || []
      );

      (profilesRes.data || []).forEach((p) => {
        // Skip users who have a pending coach request (they show as coach_request instead)
        if (coachRequestUserIds.has(p.user_id)) return;
        const prog = progressMap.get(p.user_id);
        items.push({
          id: p.user_id,
          type: "member",
          title: "회원 가입 승인 요청",
          user_id: p.user_id,
          nickname: p.nickname || p.name || "회원",
          avatar_url: p.avatar_url,
          rank: prog?.current_rank || "white",
          level: prog?.current_level || 1,
          requested_at: p.created_at,
          xp_reward: 0,
          branch_name: p.branch_name,
          phone_number: p.phone_number,
          signup_provider: providerMap.get(p.user_id),
        });
      });

      if (coachReqRes && "data" in coachReqRes) {
        (coachReqRes.data || []).forEach((r: any) => {
          const p = profileMap.get(r.user_id);
          const prog = progressMap.get(r.user_id);
          items.push({
            id: r.id,
            type: "coach_request",
            title: "관장님 가입 승인 요청",
            user_id: r.user_id,
            nickname: p?.nickname || p?.name || "관장님 신청자",
            avatar_url: p?.avatar_url || null,
            rank: prog?.current_rank || "white",
            level: prog?.current_level || 1,
            requested_at: r.requested_at,
            xp_reward: 0,
            branch_name: p?.branch_name,
            phone_number: p?.phone_number,
            signup_provider: providerMap.get(r.user_id),
          });
        });
      }

      return items;
    },
  });

  const sorted = useMemo(() => {
    if (!pendingItems) return [];
    const items = [...pendingItems];
    if (sortBy === "today") {
      const today = new Date().toDateString();
      items.sort((a, b) => {
        const aToday = new Date(a.requested_at).toDateString() === today ? 0 : 1;
        const bToday = new Date(b.requested_at).toDateString() === today ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
      });
    } else {
      items.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    }
    return items;
  }, [pendingItems, sortBy]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return (pendingItems || []).filter(i => new Date(i.requested_at).toDateString() === today).length;
  }, [pendingItems]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map(i => i.id)));
    }
  };

  // Set comment for an item
  const setComment = (id: string, text: string) => {
    setCommentMap(prev => ({ ...prev, [id]: text }));
  };

  // Batch approve
  const batchApproveMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const items = (pendingItems || []).filter(i => ids.includes(i.id));
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const note = commentMap[item.id] || null;
          if (item.type === "mission") {
            const { error } = await supabase.rpc("approve_mission_submission", { _submission_id: item.id, _coach_note: note });
            if (error) throw error;
          } else if (item.type === "quest") {
            const { error } = await supabase.rpc("approve_quest_submission", { _submission_id: item.id, _coach_note: note });
            if (error) throw error;
          } else if (item.type === "member") {
            const { error } = await supabase.rpc("approve_member", { _member_id: item.user_id });
            if (error) throw error;
          } else if (item.type === "coach_request") {
            const { error } = await supabase.rpc("approve_coach_request", { _request_id: item.id });
            if (error) throw error;
          }
        })
      );
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed}건 실패`);
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length}건 일괄 승인 완료! ✅`);
      setSelected(new Set());
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message || "일괄 승인 중 오류 발생"),
  });

  // Single action mutations
  const approveSingle = useMutation({
    mutationFn: async ({ item, note }: { item: PendingItem; note: string | null }) => {
      if (item.type === "mission") {
        const { error } = await supabase.rpc("approve_mission_submission", { _submission_id: item.id, _coach_note: note });
        if (error) throw error;
      } else if (item.type === "quest") {
        const { error } = await supabase.rpc("approve_quest_submission", { _submission_id: item.id, _coach_note: note });
        if (error) throw error;
      } else if (item.type === "member") {
        const { error } = await supabase.rpc("approve_member", { _member_id: item.user_id });
        if (error) throw error;
      } else if (item.type === "coach_request") {
        const { error } = await supabase.rpc("approve_coach_request", { _request_id: item.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("승인 완료! ✅"); invalidateAll(); },
  });

  const revisionSingle = useMutation({
    mutationFn: async ({ item, note }: { item: PendingItem; note: string }) => {
      if (item.type === "mission") {
        const { error } = await supabase.rpc("request_mission_revision", { _submission_id: item.id, _coach_note: note || "보완이 필요합니다" });
        if (error) throw error;
      } else if (item.type === "quest") {
        const { error } = await supabase.rpc("reject_quest_submission", { _submission_id: item.id, _coach_note: note || "보완이 필요합니다" });
        if (error) throw error;
      } else if (item.type === "member" || item.type === "coach_request") {
        throw new Error("가입 승인은 수정요청을 지원하지 않습니다");
      }
    },
    onSuccess: () => { toast.info("수정요청 완료"); invalidateAll(); },
  });

  const rejectSingle = useMutation({
    mutationFn: async ({ item, note }: { item: PendingItem; note: string }) => {
      if (item.type === "mission") {
        const { error } = await supabase.rpc("reject_mission_submission", { _submission_id: item.id, _coach_note: note || "다시 도전해보세요" });
        if (error) throw error;
      } else if (item.type === "quest") {
        const { error } = await supabase.rpc("reject_quest_submission", { _submission_id: item.id, _coach_note: note || "다시 도전해보세요" });
        if (error) throw error;
      } else if (item.type === "member") {
        const { error } = await supabase.rpc("reject_member", { _member_id: item.user_id });
        if (error) throw error;
      } else if (item.type === "coach_request") {
        const { error } = await supabase.rpc("reject_coach_request", { _request_id: item.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.info("반려 완료"); invalidateAll(); },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["approval-inbox"] });
    qc.invalidateQueries({ queryKey: ["branch-stats"] });
    qc.invalidateQueries({ queryKey: ["branch-members"] });
    qc.invalidateQueries({ queryKey: ["member-mission-subs"] });
    qc.invalidateQueries({ queryKey: ["coach-requests"] });
    qc.refetchQueries({ queryKey: ["approval-inbox"] });
    qc.refetchQueries({ queryKey: ["branch-stats"] });
    qc.refetchQueries({ queryKey: ["branch-members"] });
  };

  const isToday = (dateStr: string) => new Date(dateStr).toDateString() === new Date().toDateString();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <span className="text-4xl">✅</span>
        <p className="mt-3 text-sm font-bold text-foreground">모든 승인을 처리했습니다!</p>
        <p className="mt-1 text-xs text-muted-foreground">대기 중인 제출이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-elev-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-pending/10">
            <Clock className="h-5 w-5 text-status-pending" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">대기 {sorted.length}건</p>
            {todayCount > 0 && (
              <p className="text-[10px] text-status-pending font-medium">오늘 제출 {todayCount}건</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(sortBy === "today" ? "recent" : "today")}
            className="rounded-lg bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground active:scale-95"
          >
            {sortBy === "today" ? "📌 오늘 우선" : "🕐 최신순"}
          </button>
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-primary font-bold active:scale-95">
              {selected.size === sorted.length ? "전체 해제" : "전체 선택"}
            </button>
            <span className="text-xs text-muted-foreground">{selected.size}건 선택</span>
          </div>
          <button
            onClick={() => batchApproveMut.mutate([...selected])}
            disabled={batchApproveMut.isPending}
            className="flex items-center gap-1 rounded-xl bg-status-complete px-4 py-2 text-xs font-bold text-white shadow active:scale-95 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            일괄 승인
          </button>
        </div>
      )}

      {/* Select all toggle */}
      <button
        onClick={selectAll}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground active:scale-[0.98]"
      >
        {selected.size === sorted.length && sorted.length > 0 ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        전체 선택 ({sorted.length}건)
      </button>

      {/* Items */}
      {sorted.map((item) => (
        <div
          key={item.id}
          className={`rounded-2xl border p-4 transition-all ${
            selected.has(item.id)
              ? "border-primary/40 bg-primary/5"
              : isToday(item.requested_at)
              ? "border-status-pending/30 bg-status-pending/5"
              : "border-border bg-card"
          }`}
        >
          {/* Header row */}
          <div className="flex items-start gap-3">
            <button onClick={() => toggleSelect(item.id)} className="mt-1 shrink-0 active:scale-90">
              {selected.has(item.id) ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            <button
              onClick={() => navigate(`/manager/member/${item.user_id}`)}
              className="flex flex-1 items-center gap-2 text-left active:opacity-70"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
                {item.avatar_url ? (
                  <img src={item.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span>{RANK_ICONS[item.rank] || "⚪"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate">{item.nickname}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    item.type === "mission"
                      ? "bg-primary/10 text-primary"
                      : item.type === "quest"
                      ? "bg-accent/10 text-accent-foreground"
                      : item.type === "member"
                      ? "bg-amber-500/15 text-amber-700"
                      : "bg-destructive/10 text-destructive"
                  }`}>
                    {item.type === "mission"
                      ? "미션"
                      : item.type === "quest"
                      ? "퀘스트"
                      : item.type === "member"
                      ? "회원가입"
                      : "관장승인"}
                  </span>
                  {isToday(item.requested_at) && (
                    <span className="shrink-0 rounded-full bg-status-pending/15 px-1.5 py-0.5 text-[9px] font-bold text-status-pending">
                      오늘
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.title}
                  {item.branch_name ? ` · ${item.branch_name}` : ""}
                </p>
                {item.signup_provider && (item.type === "member" || item.type === "coach_request") && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    가입방식: {item.signup_provider === "google" ? "Google" : item.signup_provider === "apple" ? "Apple" : item.signup_provider === "microsoft" ? "Microsoft" : "일반회원가입"}
                  </p>
                )}
                {item.phone_number && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{item.phone_number}</p>
                )}
              </div>
            </button>

            <div className="shrink-0 text-right">
              {item.xp_reward > 0 ? (
                <p className="text-xs font-bold text-primary">+{item.xp_reward} XP</p>
              ) : (
                <p className="text-xs font-bold text-muted-foreground">가입 요청</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {formatRank(item.rank, item.level)}
              </p>
            </div>
          </div>

          {(item.type === "mission" || item.type === "quest") && (
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setExpandedTemplate(expandedTemplate === item.id ? null : item.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground active:scale-[0.98]"
              >
                <span>{commentMap[item.id] || "💬 코멘트 선택/입력..."}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${expandedTemplate === item.id ? "rotate-180" : ""}`} />
              </button>

              {expandedTemplate === item.id && (
                <div className="space-y-1.5 rounded-xl border border-border bg-background p-2">
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_COMMENTS.map(tc => (
                      <button
                        key={tc.label}
                        onClick={() => { setComment(item.id, tc.text); setExpandedTemplate(null); }}
                        className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground active:scale-95 hover:bg-primary/10"
                      >
                        {tc.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={commentMap[item.id] || ""}
                    onChange={e => setComment(item.id, e.target.value)}
                    placeholder="직접 입력..."
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => approveSingle.mutate({ item, note: commentMap[item.id] || null })}
              disabled={approveSingle.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-status-complete py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> 승인
            </button>
            {(item.type === "mission" || item.type === "quest") && (
              <button
                onClick={() => revisionSingle.mutate({ item, note: commentMap[item.id] || "보완이 필요합니다" })}
                disabled={revisionSingle.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
              >
                <Pencil className="h-3 w-3" /> 수정요청
              </button>
            )}
            <button
              onClick={() => rejectSingle.mutate({ item, note: commentMap[item.id] || "다시 도전해보세요" })}
              disabled={rejectSingle.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive py-2 text-xs font-bold text-destructive-foreground active:scale-95 disabled:opacity-50"
            >
              <X className="h-3 w-3" /> 반려
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ApprovalInbox;
