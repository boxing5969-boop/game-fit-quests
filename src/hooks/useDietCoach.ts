/**
 * 153 다이어트 — 코치 영역 훅.
 *
 * 제공
 *   • usePendingDietLogs(limit) — 지점 내 pending 체크인 목록
 *   • useDietMemberDetail(userId) — 특정 회원의 enrollment + 최근 로그
 *   • useReviewDietLog() — approve/reject/revision mutation
 *   • useCreateDietCoachNote() — 코치 노트 작성 mutation
 *
 * 권한은 RLS + SECURITY DEFINER 가 서버측에서 강제. 클라이언트는 조회만 책임.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as diet from "@/services/dietService";
import type { Database } from "@/integrations/supabase/types";
import { DIET_EVENT_TYPES } from "@/lib/diet/analytics";

type DietDailyLogRow =
  Database["public"]["Tables"]["diet_daily_logs"]["Row"];
type DietCoachNoteRow =
  Database["public"]["Tables"]["diet_coach_notes"]["Row"];
type DietEnrollmentRow =
  Database["public"]["Tables"]["diet_program_enrollments"]["Row"];

export interface PendingDietLogItem {
  log: DietDailyLogRow;
  nickname: string | null;
  avatar_url: string | null;
}

export function usePendingDietLogs(limit = 30) {
  return useQuery({
    queryKey: ["diet", "coach", "pending", limit],
    staleTime: 15_000,
    queryFn: async (): Promise<PendingDietLogItem[]> => {
      const { data: logs, error } = await supabase
        .from("diet_daily_logs")
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      if (!logs || logs.length === 0) return [];

      // 회원 닉네임·아바타 일괄 조회 (RLS — 코치 권한으로 읽을 수 있는 범위)
      const ids = Array.from(new Set(logs.map((l) => l.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", ids);
      const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return logs.map((log) => ({
        log,
        nickname: profMap.get(log.user_id)?.nickname ?? null,
        avatar_url: profMap.get(log.user_id)?.avatar_url ?? null,
      }));
    },
  });
}

export interface DietMemberDetail {
  enrollment: DietEnrollmentRow | null;
  recentLogs: DietDailyLogRow[];
  coachNotes: DietCoachNoteRow[];
  nickname: string | null;
  avatar_url: string | null;
  branch_name: string | null;
}

export function useDietMemberDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["diet", "coach", "member", userId],
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async (): Promise<DietMemberDetail> => {
      if (!userId) throw new Error("missing userId");

      const [enrRes, profRes] = await Promise.all([
        supabase
          .from("diet_program_enrollments")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["active", "paused", "completed", "not_started"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("nickname, avatar_url, branch_name")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (enrRes.error) throw enrRes.error;
      const enrollment = enrRes.data ?? null;

      let recentLogs: DietDailyLogRow[] = [];
      let coachNotes: DietCoachNoteRow[] = [];
      if (enrollment) {
        const [logsRes, notesRes] = await Promise.all([
          supabase
            .from("diet_daily_logs")
            .select("*")
            .eq("enrollment_id", enrollment.id)
            .order("log_date", { ascending: false })
            .limit(21),
          supabase
            .from("diet_coach_notes")
            .select("*")
            .eq("enrollment_id", enrollment.id)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        if (logsRes.error) throw logsRes.error;
        if (notesRes.error) throw notesRes.error;
        recentLogs = logsRes.data ?? [];
        coachNotes = notesRes.data ?? [];
      }

      return {
        enrollment,
        recentLogs,
        coachNotes,
        nickname: profRes.data?.nickname ?? null,
        avatar_url: profRes.data?.avatar_url ?? null,
        branch_name: profRes.data?.branch_name ?? null,
      };
    },
  });
}

const invalidateCoach = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["diet", "coach"] });
  qc.invalidateQueries({ queryKey: ["diet", "dailyLog"] });
  qc.invalidateQueries({ queryKey: ["diet", "recentLogs"] });
  qc.invalidateQueries({ queryKey: ["diet", "progress"] });
};

export function useReviewDietLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: diet.reviewDailyLog,
    onSuccess: (res, variables) => {
      invalidateCoach(qc);
      // best-effort analytics — 승인 시 보상/배지/완주 신호
      if ("success" in res && res.success && res.action === "approved") {
        void diet.logDietEvent(DIET_EVENT_TYPES.HABIT_SCORE_UPDATED, {
          log_id: variables.logId,
          approved_days_total: res.approved_days_total ?? null,
        });
        const newly = res.milestones_newly_reached ?? {
          m7: false,
          m14: false,
          m21: false,
        };
        if (newly.m7 || newly.m14 || newly.m21) {
          void diet.logDietEvent(DIET_EVENT_TYPES.BADGE_EARNED, {
            log_id: variables.logId,
            milestones: newly,
          });
        }
        if (newly.m21) {
          void diet.logDietEvent(DIET_EVENT_TYPES.PROGRAM_COMPLETED, {
            log_id: variables.logId,
          });
        }
      }
    },
  });
}

export function useCreateDietCoachNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: diet.createCoachNote,
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: ["diet", "coach", "member"] });
      qc.invalidateQueries({ queryKey: ["diet", "latestCoachNote"] });
      if ("success" in res && res.success) {
        void diet.logDietEvent(DIET_EVENT_TYPES.COACH_NOTE_SENT, {
          note_id: res.note_id,
          enrollment_id: variables.enrollmentId,
          template_type: variables.templateType ?? "general",
          visibility: variables.visibility ?? "member_visible",
        });
      }
    },
  });
}
