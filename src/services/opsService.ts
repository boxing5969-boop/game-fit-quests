/**
 * 153운영본부 · 근무 — 서버 함수 감싸기 (2026-10-29, DB 20261029101624_ops_hq_work.sql)
 *   ops_me · ops_month · ops_candidates · ops_staff_save · ops_schedule_save · ops_entry_save · ops_entry_decide · ops_entry_cancel
 *   계산은 src/lib/opsWork.ts — 여기는 읽고 쓰기만.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { OpsCheckin, OpsEntry, OpsEntryKind, OpsKind, OpsPayType, OpsRule, OpsStaff } from "@/lib/opsWork";
import type { OpsPtEvent, OpsPtMember, OpsPtRate, OpsPtStatus } from "@/lib/opsPt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  return data as T;
}

export const OPS_KEY = ["ops"] as const;

export interface OpsMe {
  me?: string;
  hq?: boolean;
  /** 관리(시급 · 시간표 · 근무 고치기)할 수 있는 지점 */
  manage: string[];
  /** 내 근무자 카드 */
  mine: Array<{ id: string; branch: string; name: string }>;
}

export interface OpsMonthData {
  branch: string;
  month: string;
  manage: boolean;
  /** 돈(시급 · 월급 · 합계)을 보는가 — 대표님 · 회계매니저만. 없으면(예전 서버) manage 와 같다 (2026-10-29) */
  pay?: boolean;
  hq: boolean;
  today: string;
  now_hm: string;
  staff: OpsStaff[];
  rules: OpsRule[];
  entries: OpsEntry[];
  checkins: OpsCheckin[];
  colleagues: Array<{ id: string; name: string }>;
}

export const shortBranch = (b: string) => b.replace(/^153복싱짐\s*/, "");

export const useOpsMe = (enabled = true) =>
  useQuery({
    queryKey: [...OPS_KEY, "me"],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<OpsMe> => {
      const d = await call<Partial<OpsMe> | null>("ops_me", undefined, "근무 정보를 불러오지 못했어요");
      return {
        me: d?.me,
        hq: !!d?.hq,
        manage: Array.isArray(d?.manage) ? d!.manage! : [],
        mine: Array.isArray(d?.mine) ? d!.mine! : [],
      };
    },
  });

export const useOpsMonth = (branch: string | null, month: string, enabled = true) =>
  useQuery({
    queryKey: [...OPS_KEY, "month", branch, month],
    enabled: enabled && !!branch,
    staleTime: 20_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<OpsMonthData> => {
      const d = await call<OpsMonthData>("ops_month", { p_branch: branch, p_month: month }, "근무 자료를 불러오지 못했어요");
      return {
        ...d,
        staff: d?.staff ?? [],
        rules: d?.rules ?? [],
        entries: d?.entries ?? [],
        checkins: d?.checkins ?? [],
        colleagues: d?.colleagues ?? [],
      };
    },
  });

export const useOpsCandidates = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...OPS_KEY, "candidates", branch],
    enabled: enabled && !!branch,
    staleTime: 300_000,
    queryFn: async () =>
      (await call<Array<{ user_id: string; name: string; linked: boolean }> | null>(
        "ops_candidates",
        { p_branch: branch },
        "코치 목록을 불러오지 못했어요",
      )) ?? [],
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: OPS_KEY });
};

export interface OpsStaffInput {
  id?: string;
  branch: string;
  user_id: string | null;
  name: string;
  kind: OpsKind;
  pay_type: OpsPayType;
  hourly_wage: number | null;
  monthly_salary: number | null;
  pt_freelancer: boolean;
  checkin_required: boolean;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  note: string | null;
}

export const useOpsStaffSave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: OpsStaffInput) => call<string>("ops_staff_save", { p }, "근무자를 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useOpsScheduleSave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { staffId: string; rules: Array<{ weekday: number; start: string; end: string }>; from: string }) =>
      call<number>("ops_schedule_save", { p_staff: v.staffId, p_rules: v.rules, p_from: v.from }, "시간표를 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

export interface OpsEntryInput {
  staff_id: string;
  work_date: string;
  kind: OpsEntryKind;
  minutes?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  cover_staff_id?: string | null;
  reason?: string | null;
}

export const useOpsEntrySave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: OpsEntryInput) => call<string>("ops_entry_save", { p }, "저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useOpsEntryDecide = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; note?: string }) =>
      call<void>("ops_entry_decide", { p_id: v.id, p_approve: v.approve, p_note: v.note ?? null }, "처리하지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useOpsEntryCancel = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("ops_entry_cancel", { p_id: id }, "취소하지 못했어요"),
    onSuccess: invalidate,
  });
};

// ───────── PT (2026-10-29, DB 20261029130027_ops_pt.sql) ─────────
export interface OpsPtMonthData {
  branch: string;
  month: string;
  manage: boolean;
  /** 수당표(rates)를 받았는가 — 대표님 · 회계매니저 · PT 위탁 코치 본인 (2026-10-29) */
  pay?: boolean;
  me_staff: string | null;
  members: OpsPtMember[];
  events: OpsPtEvent[];
  /** 대표님 · 회계매니저 · 그 코치 본인만 — 지점장 화면은 빈 배열 */
  rates: OpsPtRate[];
}

/** 관리자 또는 그 지점 PT 위탁 코치만 — 그 밖은 서버가 막는다(enabled 로 미리 거른다) */
export const useOpsPtMonth = (branch: string | null, month: string, enabled = true) =>
  useQuery({
    queryKey: [...OPS_KEY, "pt", branch, month],
    enabled: enabled && !!branch,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<OpsPtMonthData> => {
      const d = await call<OpsPtMonthData>("ops_pt_month", { p_branch: branch, p_month: month }, "PT 자료를 불러오지 못했어요");
      return { ...d, members: d?.members ?? [], events: d?.events ?? [], rates: d?.rates ?? [] };
    },
  });

export const useOpsPtEventSet = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; status?: OpsPtStatus; coach_staff_id?: string | null; used?: number; work_date?: string; note?: string }) => {
      const { id, ...p } = v;
      return call<void>("ops_pt_event_set", { p_id: id, p }, "저장하지 못했어요");
    },
    onSuccess: invalidate,
  });
};

export const useOpsPtEventAdd = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: { branch: string; member_user_id?: string | null; member_name: string; ticket_name?: string | null; used: number; work_date: string; coach_staff_id?: string | null; note?: string }) =>
      call<string>("ops_pt_event_add", { p }, "저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 이 기기에 마지막으로 본 지점 */
const BRANCH_KEY = "153ops:branch";
export const readOpsBranch = (): string | null => {
  try {
    return window.localStorage.getItem(BRANCH_KEY);
  } catch {
    return null;
  }
};
export const saveOpsBranch = (b: string) => {
  try {
    window.localStorage.setItem(BRANCH_KEY, b);
  } catch {
    /* 무시 */
  }
};
