/**
 * 153운영본부 「매출」 — 서버 부르기 (2026-11-03)
 *   ops_sales_scope() — 매출을 볼 수 있는 지점(돈을 보는 분: 대표님 · 회계매니저). 비어 있으면 탭이 없다.
 *   Edge Function ops-sales — 고른 지점 · 달의 매출(일반 수강권 · PT · 그 밖) · 최근 6달 흐름 · 내역.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SALES_ERROR, type SalesReport } from "@/lib/opsSales";
import { OPS_KEY } from "./opsService";

const KEY = [...OPS_KEY, "sales"] as const;

export const useOpsSalesScope = (enabled = true) =>
  useQuery({
    queryKey: [...KEY, "scope"],
    enabled,
    staleTime: 300_000,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("ops_sales_scope");
      if (error) return []; // 함수가 아직 없거나 권한이 없으면 탭을 숨긴다
      const b = (data as { branches?: unknown } | null)?.branches;
      return Array.isArray(b) ? (b as string[]) : [];
    },
  });

export const useOpsSales = (branch: string | null, month: string, months = 6) =>
  useQuery({
    queryKey: [...KEY, "report", branch, month, months],
    enabled: !!branch,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<SalesReport> => {
      const { data, error } = await supabase.functions.invoke("ops-sales", { body: { branch, month, months } });
      if (error) throw new Error("인터넷 연결을 확인하고 다시 시도해 주세요");
      const d = data as ({ ok: true } & SalesReport) | { ok: false; code?: string } | null;
      if (!d || d.ok !== true) throw new Error(SALES_ERROR[(d as { code?: string } | null)?.code ?? ""] ?? "매출 자료를 읽지 못했어요");
      return { ...d, rows: d.rows ?? [], trend: d.trend ?? [] };
    },
  });
