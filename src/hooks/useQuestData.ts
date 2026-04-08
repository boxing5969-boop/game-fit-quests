import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, Enums } from "@/integrations/supabase/types";

// ─── Levels ────
export const useLevels = () =>
  useQuery({
    queryKey: ["levels"],
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
        status: "pending",
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

// ─── XP Logs ────
export const useXpLogs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["xp-logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xp_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: Pending Submissions ────
export const usePendingSubmissions = () => {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["pending-submissions"],
    enabled: role === "coach" || role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_submissions")
        .select("*, quests(*), profiles!quest_submissions_user_id_fkey(*)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ─── Coach: Review Submission ────
export const useReviewSubmission = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, coachNote }: { id: string; status: "approved" | "rejected"; coachNote?: string }) => {
      const { error } = await supabase
        .from("quest_submissions")
        .update({
          status,
          coach_note: coachNote || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-submissions"] });
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
};

// ─── Coach: Assigned Members ────
export const useAssignedMembers = () => {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["assigned-members", user?.id],
    enabled: (role === "coach" || role === "admin") && !!user,
    queryFn: async () => {
      if (role === "admin") {
        // Admin sees all profiles
        const { data, error } = await supabase
          .from("profiles")
          .select("*, member_progress(*)");
        if (error) throw error;
        return data;
      }
      // Coach sees assigned members via their profiles (RLS handles it)
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
