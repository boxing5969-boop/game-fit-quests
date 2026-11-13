/**
 * 153운영본부 · 「일정」 탭 — 서버 함수 감싸기 (2026-11-02, DB 20261102135002_ops_team_plans.sql · 3-2 20261113145845_calendar_stage32.sql)
 *   ops_plans_week · ops_plans_range(3-2) · ops_plan_save · ops_plan_skip · ops_plan_remove · ops_plan_remove_scope(3-2) ·
 *   ops_plan_trash · ops_plan_restore · ops_plan_search · ops_plan_prefs_set (3-2)
 *   펼치기 · 하루 정리는 src/lib/opsPlans.ts(반복은 opsRecur.ts) — 여기는 읽고 쓰기만.
 *   3-2 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 범위 읽기는 주마다(예전 함수)로, 휴지통 · 검색 · 브리핑은 숨긴다(available=false).
 *   3-3(20261113184138_calendar_stage33.sql) — ops_plan_respond · ops_plan_find_times · ops_plan_prefs_save · ops_plan_insights ·
 *   첨부 저장소 ops-plan-files(비공개 · 10MB · 사진 · PDF · 내 폴더 <user_id>/). 함수가 없으면 그 기능을 숨긴다.
 */
import { useMemo, useRef } from "react";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  DEFAULT_CALS_OFF,
  PLAN_FILE_TYPES,
  REMINDER_DEFAULT,
  addDays,
  mergeWeeks,
  mondayOf,
  monthMondays,
  type CalKey,
  type GuestResponse,
  type InsightRow,
  type OpsPlan,
  type PlanAttachment,
  type PlanGuest,
  type PlansWeek,
  planFileError,
} from "@/lib/opsPlans";

export { planFileError };
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
  meet_url: typeof p.meet_url === "string" && p.meet_url ? p.meet_url : null,
  focus: p.focus === true,
  attachments: arr<PlanAttachment>(p.attachments).filter((a) => a && typeof a.path === "string"),
  guests: arr<PlanGuest>(p.guests)
    .filter((g) => g && typeof g.user_id === "string")
    .map((g) => ({ ...g, response: (["yes", "no", "maybe"].includes(g.response as string) ? g.response : null) as GuestResponse, auto: g.auto === true })),
  invited: p.invited === true,
  my_response: (["yes", "no", "maybe"].includes(p.my_response as string) ? p.my_response : null) as GuestResponse,
  owner_name: typeof p.owner_name === "string" ? p.owner_name : null,
  next_on: typeof p.next_on === "string" ? p.next_on : null,
});

const CAL_KEYS: readonly CalKey[] = ["mine", "invited", "team", "work", "events", "meetings", "pt", "todo"];

const normalizeWeek = (d: PlansWeek): PlansWeek => ({
  ...d,
  branches: arr(d?.branches),
  members: arr(d?.members),
  plans: arr<OpsPlan>(d?.plans).map(normalizePlan),
  shifts: arr(d?.shifts),
  offs: arr(d?.offs),
  recent: arr<PlansWeek["recent"][number]>(d?.recent).map((r) => ({ ...r, repeat_weekdays: arr<number>(r.repeat_weekdays) })),
  prefs: {
    brief_on: d?.prefs?.brief_on !== false,
    cals_off: Array.isArray(d?.prefs?.cals_off) ? d.prefs.cals_off.filter((k): k is CalKey => CAL_KEYS.includes(k)) : [...DEFAULT_CALS_OFF],
    remind_default: Array.isArray(d?.prefs?.remind_default)
      ? d.prefs.remind_default.filter((n) => typeof n === "number")
      : [...REMINDER_DEFAULT],
  },
  birthdays: arr<NonNullable<PlansWeek["birthdays"]>[number]>(d?.birthdays).filter((b) => b && typeof b.date === "string"),
  team: arr<NonNullable<PlansWeek["team"]>[number]>(d?.team).filter((t) => t && typeof t.user_id === "string"),
  busy: arr<NonNullable<PlansWeek["busy"]>[number]>(d?.busy).filter((b) => b && typeof b.user_id === "string" && typeof b.date === "string"),
  invites: arr<OpsPlan>(d?.invites).map(normalizePlan),
  together: Array.isArray(d?.prefs?.cals_off),
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

// ───────────────────────── 3-3 함께 쓰기 ─────────────────────────
/** 초대 응답 — 참석 · 못 가요 · 아마 + 메모 + 새 시간 제안 */
export const useOpsPlanRespond = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { plan: string; response: "yes" | "no" | "maybe"; note?: string | null; on?: string | null; start?: string | null; end?: string | null }) =>
      call<Record<string, unknown>>(
        "ops_plan_respond",
        { p_plan: v.plan, p_response: v.response, p_note: v.note ?? null, p_on: v.on ?? null, p_start: v.start ?? null, p_end: v.end ?? null },
        "답하지 못했어요",
      ),
    onSuccess: invalidate,
  });
};

export interface FindTimesResult {
  minutes: number;
  from: string;
  to: string;
  checked_at: string;
  slots: Array<{ date: string; start: string; end: string }>;
  people: Array<{ user_id: string; name: string; me: boolean; window: "shift" | "default" }>;
}

/** 시간 찾기 — 나 + 1 ~ 5명 · 30 / 60 / 90분 · 7일 · 근무 시간 안 · 안 겹치는 칸 3개 */
export const useOpsPlanFindTimes = () =>
  useMutation({
    mutationFn: async (v: { branch: string; users: string[]; minutes: number; from?: string | null }): Promise<FindTimesResult> => {
      const d = await call<FindTimesResult>(
        "ops_plan_find_times",
        { p_branch: v.branch, p_users: v.users, p_minutes: v.minutes, p_from: v.from ?? null },
        "시간을 찾지 못했어요",
      );
      return { ...d, slots: arr(d?.slots), people: arr(d?.people) };
    },
  });

/** 설정 — 아침 브리핑 · 꺼 둔 캘린더 · 기본 알림 (보낸 키만) */
export const useOpsPlanPrefsSave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: { brief_on?: boolean; cals_off?: CalKey[]; remind_default?: number[] }) =>
      call<{ brief_on: boolean; cals_off: CalKey[]; remind_default: number[] }>("ops_plan_prefs_save", { p }, "바꾸지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 시간 인사이트 — 그 주 수업 · PT · 업무 · 회의 · 외부 · 근무(분) · 함수가 없으면 available=false */
export const useOpsPlanInsights = (branch: string | null, monday: string, enabled: boolean) =>
  useQuery({
    queryKey: [...PLAN_KEY, "insights", branch ?? "", monday],
    enabled: enabled && !!branch,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<{ available: boolean; monday: string; manage: boolean; rows: InsightRow[] }> => {
      try {
        const d = await call<{ monday: string; manage: boolean; rows: InsightRow[] }>(
          "ops_plan_insights",
          { p_branch: branch, p_monday: monday },
          "시간을 불러오지 못했어요",
        );
        return { available: true, monday: d?.monday ?? monday, manage: d?.manage === true, rows: arr<InsightRow>(d?.rows) };
      } catch (e) {
        if (e instanceof MissingFn) return { available: false, monday, manage: false, rows: [] };
        throw e;
      }
    },
  });

// ───────────────────────── 3-3 첨부 (비공개 저장소) ─────────────────────────
export const PLAN_FILE_BUCKET = "ops-plan-files";

/** 내 폴더에 올리기 — 이름은 늘 새로(덮어쓰기 없음) · 저장은 일정 저장 때 서버가 확인한다 */
export async function uploadPlanFile(uid: string, file: File): Promise<PlanAttachment> {
  const err = planFileError(file);
  if (err) throw new Error(err);
  const extRaw = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const type = file.type || PLAN_FILE_TYPES[extRaw] || "application/octet-stream";
  const ext = extRaw || (type === "application/pdf" ? "pdf" : "jpg");
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${uid}/${rand}.${ext}`;
  const { error } = await supabase.storage.from(PLAN_FILE_BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (error) throw new Error(translateError(error, "파일을 올리지 못했어요 — 잠시 후 다시 해 주세요"));
  return { path, name: file.name.slice(0, 80) || "첨부 파일", size: file.size, type };
}

/** 첨부 보기 — 1시간 서명 주소 */
export async function planFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PLAN_FILE_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("파일을 열지 못했어요");
  return data.signedUrl;
}
