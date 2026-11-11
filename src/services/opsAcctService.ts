/**
 * 153운영본부 회계관리 엑셀 — 서버에서 모으기 (2026-11-11, 엑셀 모양 · 나누기는 src/lib/acctExport.ts)
 *   ops-sales(그해 1월 ~ 고른 달, 한 달씩 · 지난 두 해는 12달 흐름) · ops_costs(지난 두 해 ~ 고른 달) · registration-report(전체관리자만)
 *   매출 · 비용을 못 읽으면 파일을 만들지 않는다(틀린 순이익 · 배분이 나가지 않게). 지난해 흐름 · 회원 수가 모자라면 시트 아래에 적는다.
 */
import { supabase } from "@/integrations/supabase/client";
import { lastDayOf, ymOf, type CostRow, type OpsAcctData, type RegRow } from "@/lib/acctExport";
import { SALES_ERROR, type SalesReport } from "@/lib/opsSales";

async function salesOf(branch: string, month: string, months: number): Promise<SalesReport> {
  const { data, error } = await supabase.functions.invoke("ops-sales", { body: { branch, month, months } });
  if (error) throw new Error("인터넷 연결을 확인하고 다시 시도해 주세요");
  const r = data as ({ ok: true } & SalesReport) | { ok: false; code?: string } | null;
  if (!r || r.ok !== true) throw new Error(SALES_ERROR[(r as { code?: string } | null)?.code ?? ""] ?? "매출 자료를 읽지 못했어요");
  return { ...r, rows: r.rows ?? [], trend: r.trend ?? [] };
}

/** 회원 등록(전체관리자만) — 권한이 없거나 못 읽으면 null */
async function regsOf(from: string, to: string): Promise<{ rows: RegRow[]; truncated: boolean } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("registration-report", { body: { from, to } });
    const d = data as { rows?: RegRow[]; truncated?: boolean } | null;
    if (error || !Array.isArray(d?.rows)) return null;
    return { rows: d!.rows!, truncated: !!d!.truncated };
  } catch {
    return null;
  }
}

/** 한 번에 n개씩 */
async function inBatches<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

export async function collectOpsAcct(branch: string, month: string, onProgress?: (done: number, total: number) => void): Promise<OpsAcctData> {
  const year = Number(month.slice(0, 4));
  const last = Number(month.slice(5, 7));
  const keys = Array.from({ length: last }, (_, i) => ymOf(year, i + 1));
  const total = keys.length + 3;
  let done = 0;
  const tick = () => onProgress?.(++done, total);
  const warnings: string[] = [];

  const reports = await inBatches(keys, 3, async (k) => {
    const r = await salesOf(branch, k, 1);
    tick();
    return [k, r] as const;
  });
  const sales: Record<string, SalesReport | null> = Object.fromEntries(reports);

  // 비용 — 지난 두 해부터 고른 달까지(36개월 안). 못 읽으면 멈춘다(비용 0 → 순이익 · 배분이 부풀어 나가지 않게)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cd, error: ce } = await (supabase.rpc as any)("ops_costs", { p_branch: branch, p_from: `${year - 2}-01-01`, p_to: lastDayOf(month) });
  if (ce) throw new Error("비용 자료를 읽지 못했어요 — 잠시 후 다시 시도해 주세요");
  tick();
  const costData = (cd ?? {}) as { months?: Array<{ month: string; total: number }>; rows?: Array<{ month: string; k: string; label: string; amount: number }> };
  const costRows: CostRow[] = (costData.rows ?? []).map((r) => ({ month: String(r.month).slice(0, 7), k: r.k, label: r.label || r.k, amount: Number(r.amount) || 0 }));
  const costMonths = (costData.months ?? []).map((m) => ({ month: String(m.month).slice(0, 7), total: Number(m.total) || 0 }));

  // 지난해 매출 흐름(12월 기준 12달) — 자료가 없는 해는 0(연도 표에서 빠짐) · 못 읽은 해는 시트 아래에 적는다
  const prevSales: Record<string, number> = {};
  for (const y of [year - 2, year - 1]) {
    try {
      const r = await salesOf(branch, `${y}-12`, 12);
      for (const t of r.trend) prevSales[t.month] = t.total;
    } catch {
      warnings.push(`${y}년 매출을 읽지 못해 연도 표에서 빠졌어요 — 다시 받아 주세요`);
    }
  }
  tick();

  // 회원 등록 — 전체관리자만(아니면 빈칸). 한 번에 3,000건까지라 넘치면 달마다 다시 읽는다
  let regs: RegRow[] | null = null;
  const year1 = await regsOf(`${year}-01-01`, lastDayOf(month));
  if (year1 && !year1.truncated) regs = year1.rows;
  else if (year1) {
    const parts = await inBatches(keys, 3, (k) => regsOf(`${k}-01`, lastDayOf(k)));
    if (parts.every((p) => p)) {
      regs = parts.flatMap((p) => p!.rows);
      if (parts.some((p) => p!.truncated)) warnings.push("회원 수: 등록이 많은 달은 일부만 셌어요");
    } else warnings.push("회원 수를 읽지 못했어요 — 다시 받아 주세요");
  }
  tick();

  return { branch, month, sales, costRows, costMonths, prevSales, regs, warnings };
}
