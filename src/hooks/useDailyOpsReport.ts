// ═══════════════════════════════════════════════════════
// useDailyOpsReport — 관장·코치 일일 운영 리포트 데이터 (read-only)
// 오늘(로컬 자정~) 기준 출석/순방문/신규가입/진행중 + 최근 7일 출석.
// 기존 클라이언트 집계 패턴 재사용 (새 마이그레이션/RPC 없음).
// ═══════════════════════════════════════════════════════
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyOpsReport {
  /** 오늘 체크인 횟수 (중복 제외) */
  checkins: number;
  /** 오늘 순방문 회원 수 (user_id distinct) */
  uniqueVisitors: number;
  /** 오늘 신규 가입 수 */
  newSignups: number;
  /** 현재 진행 중인 운동 세션 수 (종료 안 됨 + 오늘 시작) */
  activeNow: number;
  /** 최근 7일 누적 체크인 횟수 (추세) */
  weekCheckins: number;
}

interface Params {
  branchName: string;
  isSuperAdmin: boolean;
  enabled: boolean;
}

export function useDailyOpsReport({ branchName, isSuperAdmin, enabled }: Params) {
  return useQuery({
    queryKey: ["daily-ops-report", branchName, isSuperAdmin],
    enabled: enabled && (isSuperAdmin || !!branchName),
    staleTime: 60_000,
    queryFn: async (): Promise<DailyOpsReport> => {
      // 로컬 자정 기준 "오늘" 경계
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todayISO = start.toISOString();
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() - 6); // 오늘 포함 최근 7일
      const weekISO = weekStart.toISOString();

      // 오늘 체크인 (순방문 계산 위해 user_id 행 수집 — 하루치라 소량)
      let attendanceQ = supabase
        .from("attendance_logs")
        .select("user_id")
        .gte("checked_in_at", todayISO)
        .eq("is_duplicate", false);
      // 오늘 신규 가입
      let signupsQ = supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .gte("created_at", todayISO);
      // 현재 진행 중인 운동 세션
      let activeQ = supabase
        .from("activity_sessions")
        .select("id", { count: "exact", head: true })
        .is("ended_at", null)
        .gte("started_at", todayISO);
      // 최근 7일 체크인 (추세)
      let weekQ = supabase
        .from("attendance_logs")
        .select("id", { count: "exact", head: true })
        .gte("checked_in_at", weekISO)
        .eq("is_duplicate", false);

      // 전체 관리자가 아니면 지점으로 한정 (RLS + branch_name 필터)
      if (!isSuperAdmin) {
        attendanceQ = attendanceQ.eq("branch_name", branchName);
        signupsQ = signupsQ.eq("branch_name", branchName);
        activeQ = activeQ.eq("branch_name", branchName);
        weekQ = weekQ.eq("branch_name", branchName);
      }

      const [attRes, signupRes, activeRes, weekRes] = await Promise.all([
        attendanceQ,
        signupsQ,
        activeQ,
        weekQ,
      ]);

      const rows = attRes.data ?? [];
      const uniqueVisitors = new Set(rows.map((r) => r.user_id)).size;

      return {
        checkins: rows.length,
        uniqueVisitors,
        newSignups: signupRes.count ?? 0,
        activeNow: activeRes.count ?? 0,
        weekCheckins: weekRes.count ?? 0,
      };
    },
  });
}
