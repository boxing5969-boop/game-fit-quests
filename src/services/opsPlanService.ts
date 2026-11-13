/**
 * 153운영본부 · 「일정」 탭 — 서버 함수 감싸기 (2026-11-02, DB 20261102135002_ops_team_plans.sql · 3-2 20261113145845_calendar_stage32.sql)
 *   ops_plans_week · ops_plans_range(3-2) · ops_plan_save · ops_plan_skip · ops_plan_remove · ops_plan_remove_scope(3-2) ·
 *   ops_plan_trash · ops_plan_restore · ops_plan_search · ops_plan_prefs_set (3-2)
 *   펼치기 · 하루 정리는 src/lib/opsPlans.ts(반복은 opsRecur.ts) — 여기는 읽고 쓰기만.
 *   3-2 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 범위 읽기는 주마다(예전 함수)로, 휴지통 · 검색 · 브리핑은 숨긴다(available=false).
 */
import { useMemo, useRef } from "react";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { addDays, mergeWeeks, mondayOf, monthMondays, type OpsPlan, type PlansWeek } from "@/lib/opsPlans";
import { OPS_KEY } from "@/services/opsService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

class MissingFn extends Error {}

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) {
    if (isMissingFn(error)) throw new MissingFn(name);
    throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  }
  return data as T;
}

export const PLAN_KEY = [...OPS_KEY, "plans"] as const;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** 서버 한 줄 → 화면 (모르는 칸은 비운 값으로) */
export const normalizePlan = (p: OpsPlan): OpsPlan => ({
  ...p,
  repeat_weekdays: arr<number>(p.repeat_weekdays),
  skip_dates: arr<string>(p.skip_dates),
  rrule: typeof p.rrule === "string" && p.rrule ? p.rrule : null,
  color: typeof p.color === "string" && p.color ? p.color : null,
  location: typeof p.location === "string" && p.location ? p.location : null,
  reminders: arr<number>(p.reminders).filter((n) => typeof n === "number"),
  series_id: typeof p.series_id === "string" ? p.series_id : null,
});

const normalizeWeek = (d: PlansWeek): PlansWeek => ({
  ...d,
  branches: arr(d?.branches),
  members: arr(d?.members),
  plans: arr<OpsPlan>(d?.plans).map(normalizePlan),
  shifts: arr(d?.shifts),
  offs: arr(d?.offs),
  recent: arr<PlansWeek["recent"][number]>(d?.recent).map((r) => ({ ...r, repeat_weekdays: arr<number>(r.repeat_weekdays) })),
  prefs: { brief_on: d?.prefs?.brief_on !== false },
  birthdays: arr<NonNullable<PlansWeek["birthdays"]>[number]>(d?.birthdays).filter((b) => b && typeof b.date === "string"),
});

const fetchWeek = async (branch: string | null, monday: string): Promise<PlansWeek> =>
  normalizeWeek(await call<PlansWeek>("ops_plans_week", { p_branch: branch, p_from: monday }, "일정을 불러오지 못했어요"));

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

/** 범위 — 3-2 함수가 없으면 그 범위의 주를 하나씩(예전 함수, 10주까지) 받아 합친다 */
const fetchRange = async (branch: string | null, from: string, to: string): Promise<PlansWeek & { rangeFn: boolean }> => {
  try {
    const d = await call<PlansWeek>("ops_plans_range", { p_branch: branch, p_from: from, p_to: to }, "일정을 불러오지 못했어요");
    return { ...normalizeWeek(d), rangeFn: true };
  } catch (e) {
    if (!(e instanceof MissingFn)) throw e;
    const mondays: string[] = [];
    for (let m = mondayOf(from); m <= to && mondays.length < 10; m = addDays(m, 7)) mondays.push(m);
    const weeks = await Promise.all(mondays.map((m) => fetchWeek(branch, m)));
    const merged = mergeWeeks(weeks) as PlansWeek;
    return { ...merged, from, to, rangeFn: false };
  }
};

/**
 * 3-2 — 「일정」 탭 내 일정 보기(일 · 3일 · 주 · 월 · 목록 · 연간)의 읽기. 넘기는 동안 앞 범위를 흐리게 그대로.
 * rangeFn=false = 3-2 함수가 없는 DB(연간 보기는 숨긴다).
 */
export const useOpsPlansRange = (branch: string | null, from: string, to: string, enabled = true) => {
  const q = useQuery({
    queryKey: [...PLAN_KEY, "range", branch ?? "", from, to],
    enabled,
    staleTime: 20_000,
    refetchInterval: 120_000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => fetchRange(branch, from, to),
  });
  return q;
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

/** 일정 지우기 (반복이면 반복 전체) — 예전 함수 */
export const useOpsPlanRemove = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("ops_plan_remove", { p_id: id }, "지우지 못했어요"),
    onSuccess: invalidate,
  });
};

/**
 * 3-2 — 지우기 세 범위(이 일정만 = 그날 빼기 · 이후 모두 = 그 전날까지 · 전체 = 휴지통, 같은 묶음 함께).
 * 3-2 함수가 없는 DB 면 예전 함수로(이 일정만 = 빼기, 그 밖 = 반복 전체 지우기).
 */
export const useOpsPlanRemoveScope = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; scope: "one" | "following" | "all"; date: string | null }) => {
      try {
        return await call<number>("ops_plan_remove_scope", { p_id: v.id, p_scope: v.scope, p_date: v.date }, "지우지 못했어요");
      } catch (e) {
        if (!(e instanceof MissingFn)) throw e;
        if (v.scope === "one" && v.date) await call<void>("ops_plan_skip", { p_id: v.id, p_date: v.date }, "빼지 못했어요");
        else await call<void>("ops_plan_remove", { p_id: v.id }, "지우지 못했어요");
        return 1;
      }
    },
    onSuccess: invalidate,
  });
};

export type TrashPlan = OpsPlan & { deleted_at: string };

/** 3-2 — 휴지통 (지운 지 30일 안) · 함수가 없으면 available=false */
export const useOpsPlanTrash = (enabled: boolean) =>
  useQuery({
    queryKey: [...PLAN_KEY, "trash"],
    enabled,
    staleTime: 10_000,
    retry: false,
    queryFn: async (): Promise<{ available: boolean; rows: TrashPlan[] }> => {
      try {
        const rows = await call<TrashPlan[]>("ops_plan_trash", {}, "휴지통을 불러오지 못했어요");
        return { available: true, rows: arr<TrashPlan>(rows).map((r) => ({ ...normalizePlan(r), deleted_at: r.deleted_at })) };
      } catch (e) {
        if (e instanceof MissingFn) return { available: false, rows: [] };
        throw e;
      }
    },
  });

export const useOpsPlanRestore = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<number>("ops_plan_restore", { p_id: id }, "되살리지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 3-2 — 검색 (제목 · 메모 · 장소, 50개까지) · 대표님 · 지점장님은 그 지점 팀의 공개 일정도 */
export const useOpsPlanSearch = (q: string, branch: string | null, enabled: boolean) =>
  useQuery({
    queryKey: [...PLAN_KEY, "search", branch ?? "", q],
    enabled: enabled && q.trim().length > 0,
    staleTime: 15_000,
    retry: false,
    queryFn: async (): Promise<{ available: boolean; rows: OpsPlan[] }> => {
      try {
        const rows = await call<OpsPlan[]>("ops_plan_search", { p_q: q.trim(), p_branch: branch }, "찾지 못했어요");
        return { available: true, rows: arr<OpsPlan>(rows).map(normalizePlan) };
      } catch (e) {
        if (e instanceof MissingFn) return { available: false, rows: [] };
        throw e;
      }
    },
  });

/** 3-2 — 아침 8시 브리핑 켜기 · 끄기 */
export const useOpsPlanPrefs = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (brief: boolean) => call<{ brief_on: boolean }>("ops_plan_prefs_set", { p_brief: brief }, "바꾸지 못했어요"),
    onSuccess: invalidate,
  });
};
