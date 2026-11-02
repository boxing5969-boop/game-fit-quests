/**
 * 153운영본부 · 「일정」 탭 — 서버 함수 감싸기 (2026-11-02, DB 20261102135002_ops_team_plans.sql)
 *   ops_plans_week · ops_plan_save · ops_plan_skip · ops_plan_remove
 *   펼치기 · 하루 정리는 src/lib/opsPlans.ts — 여기는 읽고 쓰기만.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { PlansWeek } from "@/lib/opsPlans";
import { OPS_KEY } from "@/services/opsService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  return data as T;
}

export const PLAN_KEY = [...OPS_KEY, "plans"] as const;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** 한 주(월~일) — branch 가 없으면 서버가 내 지점을 고른다 */
export const useOpsPlansWeek = (branch: string | null, monday: string, enabled = true) =>
  useQuery({
    queryKey: [...PLAN_KEY, "week", branch ?? "", monday],
    enabled,
    staleTime: 20_000,
    refetchInterval: 120_000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PlansWeek> => {
      const d = await call<PlansWeek>("ops_plans_week", { p_branch: branch, p_from: monday }, "일정을 불러오지 못했어요");
      return {
        ...d,
        branches: arr(d?.branches),
        members: arr(d?.members),
        plans: arr<PlansWeek["plans"][number]>(d?.plans).map((p) => ({
          ...p,
          repeat_weekdays: arr<number>(p.repeat_weekdays),
          skip_dates: arr<string>(p.skip_dates),
        })),
        shifts: arr(d?.shifts),
        offs: arr(d?.offs),
        recent: arr<PlansWeek["recent"][number]>(d?.recent).map((r) => ({ ...r, repeat_weekdays: arr<number>(r.repeat_weekdays) })),
      };
    },
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PLAN_KEY });
};

export const useOpsPlanSave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Record<string, unknown>) => call<string>("ops_plan_save", { p }, "일정을 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 반복 일정에서 그날 하나만 빼기 */
export const useOpsPlanSkip = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; date: string }) => call<void>("ops_plan_skip", { p_id: v.id, p_date: v.date }, "빼지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 일정 지우기 (반복이면 반복 전체) */
export const useOpsPlanRemove = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("ops_plan_remove", { p_id: id }, "지우지 못했어요"),
    onSuccess: invalidate,
  });
};
