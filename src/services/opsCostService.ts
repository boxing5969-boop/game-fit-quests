/**
 * 153운영본부 「매출」 · 순이익 — 서버 부르기 (2026-11-04, DB 20261104004636_ops_branch_costs.sql)
 *   ops_costs(지점, 기간) — 달별 비용(항목) · 올린 정보 / ops_costs_save — 가계부 CSV 에서 화면이 더한 합계만 / ops_costs_clear — 한 달 지우기
 *   돈을 보는 분(대표님 · 회계매니저)만. 나누기 · 더하기는 src/lib/opsCosts.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { SavedCosts } from "@/lib/opsCosts";
import { OPS_KEY } from "./opsService";

const KEY = [...OPS_KEY, "costs"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);
async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

/** 'YYYY-MM' 부터 'YYYY-MM' 까지의 비용 (함수가 아직 없으면 빈 것 — 화면은 '가계부 CSV 올리기'만) */
export const useOpsCosts = (branch: string | null, fromMonth: string, toMonth: string) =>
  useQuery({
    queryKey: [...KEY, branch, fromMonth, toMonth],
    enabled: !!branch && !!fromMonth && !!toMonth,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<SavedCosts> => {
      const last = new Date(Date.UTC(Number(toMonth.slice(0, 4)), Number(toMonth.slice(5, 7)), 0)).getUTCDate();
      const { data, error } = await rpc("ops_costs", { p_branch: branch, p_from: `${fromMonth}-01`, p_to: `${toMonth}-${String(last).padStart(2, "0")}` });
      if (error) return { months: [], rows: [] };
      const d = (data ?? {}) as Partial<SavedCosts>;
      return {
        months: Array.isArray(d.months) ? d.months.map((m) => ({ ...m, total: Number(m.total) || 0 })) : [],
        rows: Array.isArray(d.rows) ? d.rows.map((r) => ({ ...r, amount: Number(r.amount) || 0, count: Number(r.count) || 0 })) : [],
      };
    },
  });

export interface CostSaveInput {
  branch: string;
  months: Array<{ month: string; cats: Array<{ k: string; label: string; amount: number; count: number }> }>;
  meta: { stores: string[]; no_store: boolean; excluded: string[] };
}

export const useSaveOpsCosts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CostSaveInput) =>
      call<{ ok: boolean; months: number }>("ops_costs_save", { p_branch: p.branch, p_months: p.months, p_meta: p.meta }, "비용을 저장하지 못했어요"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useClearOpsCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { branch: string; month: string }) =>
      call<{ ok: boolean }>("ops_costs_clear", { p_branch: p.branch, p_month: `${p.month}-01` }, "지우지 못했어요"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
};
