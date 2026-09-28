// ═══════════════════════════════════════════════════════
// useDailyOpsReport — 관장·코치 일일 운영 리포트 데이터 (read-only)
// 오늘(로컬 자정~) 기준 출석/순방문/신규가입/진행중 + 최근 7일 출석.
// 기존 클라이언트 집계 패턴 재사용 (새 마이그레이션/RPC 없음).
//
// 2026-09-28 — 브로제이 대조 추가(대표님 요청: "앱 숫자가 브로제이와 안 맞는다").
//   · broj: 출입 동기화(sync-broj-checkins)가 1분마다 남기는 오늘(KST) 지점별 "브로제이 기준" 숫자
//     (broj_daily_counts) — 회원 입장 건수(재입장 포함) · 회원 인원 · 코치 인원 · 앱 반영 인원과 차이.
//   · 앱 출석은 코치(지도진) 계정을 뺀다 — 예전엔 코치 출근·회원권 입장까지 섞여 브로제이 회원 수와 어긋났다.
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
  /** 브로제이 대조 — 오늘(KST) 브로제이 출입 기록이 있는 지점만. 없으면 null */
  broj: BrojDaily | null;
}

/** 한 지점(또는 합계)의 브로제이 기준 숫자 */
export interface BrojCounts {
  branchName: string;
  /** 회원 입장 건수 — 문이 열린 입장만, 나갔다 다시 들어온 것도 센다(브로제이 목록과 같은 기준) */
  memberEntries: number;
  /** 회원 인원(전화번호 기준) */
  memberPeople: number;
  /** 코치(직원) 출근 인원 */
  staffPeople: number;
  /** 앱 회원 계정과 연결된 인원 */
  appMemberPeople: number;
  /** 코치 계정인데 회원권으로 입장한 인원 — 앱은 코치로 센다 */
  staffMemberPeople: number;
  /** 앱 계정이 없는 인원 */
  unlinkedPeople: number;
  /** 문 거절(이용권 만료·월 입장 횟수 소진) — 출석에서 뺀 건수 */
  rejectedEntries: number;
  updatedAt: string;
}

export interface BrojDaily {
  total: BrojCounts;
  branches: BrojCounts[];
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

const toBrojCounts = (r: Record<string, unknown>): BrojCounts => ({
  branchName: String(r.branch_name ?? ""),
  memberEntries: num(r.member_entries),
  memberPeople: num(r.member_people),
  staffPeople: num(r.staff_people),
  appMemberPeople: num(r.app_member_people),
  staffMemberPeople: num(r.staff_member_people),
  unlinkedPeople: num(r.unlinked_people),
  rejectedEntries: num(r.rejected_entries),
  updatedAt: String(r.updated_at ?? ""),
});

const sumBroj = (rows: BrojCounts[]): BrojCounts =>
  rows.reduce<BrojCounts>(
    (t, r) => ({
      branchName: t.branchName,
      memberEntries: t.memberEntries + r.memberEntries,
      memberPeople: t.memberPeople + r.memberPeople,
      staffPeople: t.staffPeople + r.staffPeople,
      appMemberPeople: t.appMemberPeople + r.appMemberPeople,
      staffMemberPeople: t.staffMemberPeople + r.staffMemberPeople,
      unlinkedPeople: t.unlinkedPeople + r.unlinkedPeople,
      rejectedEntries: t.rejectedEntries + r.rejectedEntries,
      updatedAt: r.updatedAt > t.updatedAt ? r.updatedAt : t.updatedAt,
    }),
    {
      branchName: "전체", memberEntries: 0, memberPeople: 0, staffPeople: 0, appMemberPeople: 0,
      staffMemberPeople: 0, unlinkedPeople: 0, rejectedEntries: 0, updatedAt: "",
    },
  );

/** KST 오늘 YYYY-MM-DD — 브로제이 집계는 KST 날짜로 저장된다 */
const kstToday = (): string => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

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
      // 브로제이 대조 — 오늘(KST) 지점별 숫자 (생성 타입에 없는 새 테이블)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let brojQ = (supabase as any)
        .from("broj_daily_counts")
        .select("branch_name, member_entries, member_people, staff_people, app_member_people, staff_member_people, unlinked_people, rejected_entries, updated_at")
        .eq("day", kstToday());

      // 전체 관리자가 아니면 지점으로 한정 (RLS + branch_name 필터)
      if (!isSuperAdmin) {
        attendanceQ = attendanceQ.eq("branch_name", branchName);
        signupsQ = signupsQ.eq("branch_name", branchName);
        activeQ = activeQ.eq("branch_name", branchName);
        weekQ = weekQ.eq("branch_name", branchName);
        brojQ = brojQ.eq("branch_name", branchName);
      }

      const [attRes, signupRes, activeRes, weekRes, brojRes] = await Promise.all([
        attendanceQ,
        signupsQ,
        activeQ,
        weekQ,
        brojQ,
      ]);

      // 앱 출석은 회원만 — 코치(지도진) 계정의 출근·회원권 입장은 뺀다(브로제이 회원 수와 같은 기준).
      const allRows = (attRes.data ?? []) as { user_id: string }[];
      const ids = [...new Set(allRows.map((r) => r.user_id))];
      const staffIds = new Set<string>();
      for (let i = 0; i < ids.length; i += 300) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sp } = await (supabase as any)
          .from("public_profiles").select("user_id, is_staff").in("user_id", ids.slice(i, i + 300));
        for (const p of (sp ?? []) as { user_id: string; is_staff: boolean | null }[]) {
          if (p.is_staff === true) staffIds.add(p.user_id);
        }
      }
      const rows = allRows.filter((r) => !staffIds.has(r.user_id));
      const uniqueVisitors = new Set(rows.map((r) => r.user_id)).size;

      const brojRows = brojRes?.error
        ? []
        : ((brojRes?.data ?? []) as Record<string, unknown>[])
            .map(toBrojCounts)
            .sort((a, b) => a.branchName.localeCompare(b.branchName, "ko"));
      const broj: BrojDaily | null = brojRows.length > 0 ? { total: sumBroj(brojRows), branches: brojRows } : null;

      return {
        checkins: rows.length,
        uniqueVisitors,
        newSignups: signupRes.count ?? 0,
        activeNow: activeRes.count ?? 0,
        weekCheckins: weekRes.count ?? 0,
        broj,
      };
    },
  });
}
