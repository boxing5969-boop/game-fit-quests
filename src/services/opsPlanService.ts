/**
 * 153운영본부 · 「일정」 탭 — 서버 함수 감싸기 (2026-11-02, DB 20261102135002_ops_team_plans.sql)
 *   ops_plans_week · ops_plan_save · ops_plan_skip · ops_plan_remove
 *   펼치기 · 하루 정리는 src/lib/opsPlans.ts — 여기는 읽고 쓰기만.
 */
import { useMemo, useRef } from "react";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { mergeWeeks, monthMondays, type PlansWeek } from "@/lib/opsPlans";
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

const fetchWeek = async (branch: string | null, monday: string): Promise<PlansWeek> => {
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
};

/** 한 주 읽기 설정 — 주 보기 · 달력이 같은 캐시를 쓴다 */
const weekQuery = (branch: string | null, monday: string, enabled: boolean) => ({
  queryKey: [...PLAN_KEY, "week", branch ?? "", monday],
  enabled,
  staleTime: 20_000,
  refetchInterval: 120_000,
  retry: false,
  queryFn: () => fetchWeek(branch, monday),
});

/** 한 주(월~일) — branch 가 없으면 서버가 내 지점을 고른다 */
export const useOpsPlansWeek = (branch: string | null, monday: string, enabled = true) =>
  useQuery({ ...weekQuery(branch, monday, enabled), placeholderData: keepPreviousData });

const combineWeeks = (results: UseQueryResult<PlansWeek>[]) => ({
  data: results.length > 0 && results.every((r) => r.data) ? mergeWeeks(results.map((r) => r.data as PlansWeek)) : null,
  isLoading: results.some((r) => r.isLoading),
  error: (results.find((r) => r.error)?.error as Error | null | undefined) ?? null,
  refetch: () => Promise.all(results.map((r) => r.refetch())),
});

/**
 * 한 달 달력 (2026-11-12) — 달력에 보이는 주(4~6주)를 주마다 받아 합친다. 서버 함수는 그대로(ops_plans_week).
 * 다른 달로 넘기는 동안은 앞 달을 흐리게 그대로 보여 준다(주 보기의 keepPreviousData 와 같은 결).
 */
export const useOpsPlansMonth = (branch: string | null, ym: string, enabled = true) => {
  const mondays = useMemo(() => monthMondays(ym), [ym]);
  const res = useQueries({ queries: mondays.map((m) => weekQuery(branch, m, enabled)), combine: combineWeeks });
  const last = useRef<PlansWeek | null>(null);
  if (res.data) last.current = res.data;
  const data = res.data ?? last.current ?? undefined;
  return {
    data,
    isLoading: res.isLoading && !data,
    isPlaceholderData: !res.data && !!data,
    error: res.error,
    refetch: res.refetch,
  };
};

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
