/**
 * 153운영본부 「오늘 청소」 2단계 — 현황 · 문제 처리 · 고치기 서버 함수 감싸기 (2026-11-17)
 *   DB 20261117105547_ops_clean_stage2.sql: ops_clean_report · ops_clean_issue_resolve · ops_clean_item_save · ops_clean_items_order · ops_clean_slot_save
 *   함수가 없는 DB(적용 전 · 미리보기 옛 DB)면 available=false — 「현황」 단추를 숨긴다.
 *   계산 · 글은 src/lib/opsCleanReport.ts — 여기는 읽고 쓰기만. 고치면 그날 청소(["ops","clean",…])도 다시 읽는다.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { REPORT_OFF, normalizeCleanReport, type CleanReport } from "@/lib/opsCleanReport";
import { CLEAN_KEY } from "@/services/opsCleanService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

export const CLEAN_REPORT_KEY = [...CLEAN_KEY, "report"] as const;

/** 현황 — 지점을 비우면 서버가 고른다 · 기간은 from ~ to (최대 62일) */
export const useOpsCleanReport = (branch: string | null, from: string | null, to: string | null, enabled = true) =>
  useQuery<CleanReport>({
    queryKey: [...CLEAN_REPORT_KEY, branch ?? "", from ?? "", to ?? ""],
    enabled,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await rpc("ops_clean_report", { p_branch: branch, p_from: from, p_to: to });
      if (error) {
        if (isMissingFn(error)) return REPORT_OFF;
        throw new Error(translateError(error, "청소 현황을 불러오지 못했어요"));
      }
      return normalizeCleanReport(data);
    },
  });

/** 문제 처리 · 항목 고치기 · 순서 · 시간대 — 끝나면 현황 · 그날 청소를 다시 읽는다 */
export const useOpsCleanReportActions = () => {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: CLEAN_KEY });
  const resolve = useMutation({
    mutationFn: (v: { itemId: string; date: string; note: string | null }) =>
      call<void>("ops_clean_issue_resolve", { p_item: v.itemId, p_date: v.date, p_note: v.note }, "문제를 처리하지 못했어요"),
    onSettled: refresh,
  });
  const saveItem = useMutation({
    mutationFn: (payload: Record<string, unknown>) => call<{ id: string }>("ops_clean_item_save", { p: payload }, "항목을 저장하지 못했어요"),
    onSettled: refresh,
  });
  const order = useMutation({
    mutationFn: (v: { slotId: string; ids: string[] }) => call<void>("ops_clean_items_order", { p_slot: v.slotId, p_ids: v.ids }, "순서를 바꾸지 못했어요"),
    onSettled: refresh,
  });
  const saveSlot = useMutation({
    mutationFn: (payload: Record<string, unknown>) => call<void>("ops_clean_slot_save", { p: payload }, "시간대를 저장하지 못했어요"),
    onSettled: refresh,
  });
  return { resolve, saveItem, order, saveSlot };
};
