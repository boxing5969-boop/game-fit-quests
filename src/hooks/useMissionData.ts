import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Missions with videos ────
export const useMissions = () =>
  useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*, mission_videos(*), levels!inner(*)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

// ─── Missions for a specific level ────
export const useMissionsForLevel = (levelId: string | undefined) =>
  useQuery({
    queryKey: ["missions", levelId],
    enabled: !!levelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*, mission_videos(*)")
        .eq("level_id", levelId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

// ─── My Mission Submissions ────
export const useMyMissionSubmissions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-mission-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_submissions")
        .select("*, missions(*)")
        .eq("user_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ─── Submit Mission (with optional video URL) ────
export const useSubmitMission = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ missionId, videoUrl }: { missionId: string; videoUrl?: string }) => {
      const insertData: any = {
        user_id: user!.id,
        mission_id: missionId,
        status: "pending",
      };
      if (videoUrl) insertData.video_url = videoUrl;
      const { error } = await supabase.from("mission_submissions").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
    },
  });
};

// ─── Coach: Pending Mission Submissions ────
export const usePendingMissionSubmissions = () => {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["pending-mission-submissions"],
    enabled: role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_submissions")
        .select("*, missions(*)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: Approve Mission ────
export const useApproveMission = () => {
  const { refreshProgress } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, coachNote }: { id: string; coachNote?: string }) => {
      const { data, error } = await supabase.rpc("approve_mission_submission", {
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
      qc.invalidateQueries({ queryKey: ["pending-mission-submissions"] });
      qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
      qc.invalidateQueries({ queryKey: ["xp-logs"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
    },
  });
};

// ─── Coach: Reject Mission ────
export const useRejectMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, coachNote }: { id: string; coachNote?: string }) => {
      const { error } = await supabase.rpc("reject_mission_submission", {
        _submission_id: id,
        _coach_note: coachNote || "다시 도전해보세요",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-mission-submissions"] });
      qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
    },
  });
};

// ─── Coach: Hidden Mastery ────
export const useHiddenMastery = (userId?: string) => {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["hidden-mastery", userId],
    enabled: (role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin") && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hidden_mastery")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: External Cert Progress ────
export const useExternalCertProgress = (userId?: string) => {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["external-cert", userId],
    enabled: (role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin") && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_cert_progress")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: Update Hidden Mastery ────
export const useUpdateHiddenMastery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, scores }: { userId: string; scores: Record<string, number> }) => {
      const { error } = await supabase
        .from("hidden_mastery")
        .update({ ...scores, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ["hidden-mastery", userId] });
    },
  });
};

// ─── Coach: Update Cert Progress ────
export const useUpdateCertProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data: certData }: { userId: string; data: Record<string, boolean | string> }) => {
      const { error } = await supabase
        .from("external_cert_progress")
        .update({ ...certData, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ["external-cert", userId] });
    },
  });
};
