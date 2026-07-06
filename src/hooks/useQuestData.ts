import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Levels ────
export const useLevels = () =>
  useQuery({
    queryKey: ["levels"],
    // levels 는 사실상 정적 테이블 — 페이지 이동마다 재조회할 필요 없음.
    // 관리 화면의 invalidateQueries(["levels"]) 는 staleTime 과 무관하게 즉시 갱신됨.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("levels")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

// ─── Quests ────
export const useQuests = () =>
  useQuery({
    queryKey: ["quests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quests")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

// ─── My Submissions ────
export const useMySubmissions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_submissions")
        .select("*, quests(*)")
        .eq("user_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ─── Submit Quest ────
export const useSubmitQuest = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questId: string) => {
      const { error } = await supabase.from("quest_submissions").insert({
        user_id: user!.id,
        quest_id: questId,
        status: "pending" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
};

// ─── Badges ────
export const useBadges = () =>
  useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*");
      if (error) throw error;
      return data;
    },
  });

// ─── My Badges ────
export const useMyBadges = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_badges")
        .select("*, badges(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
};

// ─── XP Logs (last 7 days for activity history) ────
export const useXpLogs = (limit = 20) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["xp-logs", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xp_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
};

// ─── Record Attendance ────
export const useRecordAttendance = () => {
  const { user, refreshProgress } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("record_attendance", {
        _user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProgress();
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      // ["levels"] 무효화 제거 — record_attendance 는 levels 테이블을 바꾸지 않는데
      // 홈 진입마다 levels 재조회를 유발하고 있었음.
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
};

// ─── Coach: Pending Submissions ────
export const usePendingSubmissions = () => {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["pending-submissions"],
    enabled: role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_submissions")
        .select("*, quests(*)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: Approve Submission (uses DB function) ────
export const useApproveSubmission = () => {
  const { refreshProgress } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, coachNote }: { id: string; coachNote?: string }) => {
      const { data, error } = await supabase.rpc("approve_quest_submission", {
        _submission_id: id,
        _coach_note: coachNote || null,
      });
      if (error) throw error;
      return data as {
        xp_granted: number;
        leveled_up: boolean;
        ranked_up: boolean;
        new_level: number;
        new_rank: string;
        total_xp: number;
      };
    },
    onSuccess: () => {
      refreshProgress();
      qc.invalidateQueries({ queryKey: ["pending-submissions"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
    },
  });
};

// ─── Coach: Reject Submission ────
export const useRejectSubmission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, coachNote }: { id: string; coachNote?: string }) => {
      const { error } = await supabase.rpc("reject_quest_submission", {
        _submission_id: id,
        _coach_note: coachNote || "다시 도전해보세요",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-submissions"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
};

// ─── Coach: Manual XP Grant ────
export const useGrantManualXp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, amount, reason }: { memberId: string; amount: number; reason?: string }) => {
      const { error } = await supabase.rpc("grant_manual_xp", {
        _member_id: memberId,
        _amount: amount,
        _reason: reason || "수동 XP 지급",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
    },
  });
};

// ─── Coach: Boss Battle Pass ────
export const usePassBossBattle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, coachNote }: { memberId: string; coachNote?: string }) => {
      const { data, error } = await supabase.rpc("pass_boss_battle", {
        _member_id: memberId,
        _coach_note: coachNote || "타이틀매치 합격",
      });
      if (error) throw error;
      return data as { ranked_up: boolean; new_rank: string; new_level: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["pending-submissions"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
    },
  });
};

// ─── Coach: Assigned Members ────
export const useAssignedMembers = () => {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["assigned-members", user?.id, role],
    enabled: (role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin") && !!user,
    queryFn: async () => {
      if (role === "admin" || role === "super_admin") {
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("*, member_progress(*)"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (rolesRes.error) throw rolesRes.error;
        const roleMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);
        return (profilesRes.data || []).map(p => ({ ...p, user_roles: { role: roleMap.get(p.user_id) || "member" } }));
      }
      const { data: assignments, error: aErr } = await supabase
        .from("coach_assignments")
        .select("member_id")
        .eq("coach_id", user!.id);
      if (aErr) throw aErr;
      if (!assignments?.length) return [];

      const memberIds = assignments.map(a => a.member_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("*, member_progress(*)")
        .in("user_id", memberIds);
      if (error) throw error;
      return data;
    },
  });
};

// ─── Admin: Manual Level Up ────
export const useManualLevelUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.rpc("manual_level_up", {
        _member_id: memberId,
      });
      if (error) throw error;
      return data as { new_level: number; current_rank: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
    },
  });
};

// ─── Admin: Manual Level Down ────
export const useManualLevelDown = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.rpc("manual_level_down", {
        _member_id: memberId,
      });
      if (error) throw error;
      return data as { new_level: number; new_rank: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
    },
  });
};

// ─── Admin: Set Member Level ────
export const useSetMemberLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, rank, level }: { memberId: string; rank: string; level: number }) => {
      const { data, error } = await supabase.rpc("set_member_level", {
        _member_id: memberId,
        _rank: rank as any,
        _level: level,
      });
      if (error) throw error;
      return data as { new_level: number; new_rank: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["levels"] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
    },
  });
};
