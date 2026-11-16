/**
 * 153운영본부 「오늘 청소」 1단계 — 서버 함수 감싸기 (2026-11-16)
 *   DB 20261116211742_ops_clean_stage1.sql: ops_clean_day · ops_clean_check · ops_clean_start · ops_clean_finish
 *   함수가 없는 DB(적용 전 · 미리보기 옛 DB)면 available=false — 입구 · 홈 카드를 숨긴다.
 *   계산 · 글은 src/lib/opsClean.ts — 여기는 읽고 쓰기만. 캐시 키 ["ops", "clean", …].
 *   체크는 누르는 순간 화면에 먼저(실패하면 되돌림) — 잇달아 눌러도 깜빡이지 않게 마지막 요청이 끝난 뒤에만 다시 읽는다.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { CLEAN_OFF, normalizeCleanDay, withItemState, type CleanDay, type CleanState } from "@/lib/opsClean";
import { OPS_KEY } from "@/services/opsService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

export const CLEAN_KEY = [...OPS_KEY, "clean"] as const;
const DAY_KEY = [...CLEAN_KEY, "day"] as const;
const CHECK_KEY = [...CLEAN_KEY, "check"] as const;

/**
 * 그날 청소 — 지점 · 날짜를 비우면 서버가 내 지점 · 오늘로.
 *   live: 화면을 보고 있는 동안 45초마다 다시 읽는다(다른 분 체크 · 인수인계).
 */
export const useOpsCleanDay = (branch: string | null, date: string | null, enabled = true, live = false) =>
  useQuery<CleanDay>({
    queryKey: [...DAY_KEY, branch ?? "", date ?? ""],
    enabled,
    staleTime: 15_000,
    refetchInterval: live ? 45_000 : false,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await rpc("ops_clean_day", { p_branch: branch, p_date: date });
      if (error) {
        if (isMissingFn(error)) return CLEAN_OFF;
        throw new Error(translateError(error, "오늘 청소를 불러오지 못했어요"));
      }
      return normalizeCleanDay(data);
    },
  });

export interface CleanCheckInput {
  itemId: string;
  date: string;
  state: CleanState | null;
  note: string | null;
}

/** 체크(완료 · 보류 · 문제 · 풀기) · 시작 · 끝내기 */
export const useOpsCleanActions = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: CLEAN_KEY });

  const check = useMutation({
    mutationKey: CHECK_KEY,
    mutationFn: (v: CleanCheckInput) =>
      call<void>("ops_clean_check", { p_item: v.itemId, p_date: v.date, p_state: v.state ?? "", p_note: v.note }, "체크하지 못했어요"),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: DAY_KEY });
      const snapshot = qc.getQueriesData<CleanDay>({ queryKey: DAY_KEY });
      const at = new Date().toISOString();
      for (const [key, val] of snapshot) {
        if (val?.on && val.date === v.date) qc.setQueryData(key, withItemState(val, v.itemId, v.state, v.note, "나", at));
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => {
      // 잇달아 누른 체크가 아직 가는 중이면 그 요청이 끝난 뒤에 한 번만 다시 읽는다
      if (qc.isMutating({ mutationKey: CHECK_KEY }) <= 1) void invalidate();
    },
  });

  const start = useMutation({
    mutationFn: (v: { branch: string; date: string; slot: string }) =>
      call<void>("ops_clean_start", { p_branch: v.branch, p_date: v.date, p_slot: v.slot }, "시작하지 못했어요"),
    onSettled: () => void invalidate(),
  });

  const finish = useMutation({
    mutationFn: (v: { branch: string; date: string; slot: string; note: string | null }) =>
      call<void>("ops_clean_finish", { p_branch: v.branch, p_date: v.date, p_slot: v.slot, p_note: v.note }, "끝내지 못했어요"),
    onSettled: () => void invalidate(),
  });

  return { check, start, finish };
};
