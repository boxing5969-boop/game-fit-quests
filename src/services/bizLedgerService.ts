/**
 * 사업자 가계부 — 서버 부르기 (2026-11-28, DB 20261128100610_biz_ledger.sql · 문서 docs/features/73-사업자-가계부.md)
 *   biz_home(달) — 사업자 카드 · 더할 수 있나 · 이을 수 있는 지점 / biz_month(사업자, 달) — 줄 · 12개월 · 근무자
 *   biz_book_save · biz_book_archive · biz_entry_save · biz_entry_delete · biz_import(3,000줄씩) · biz_rules · biz_rule_save · biz_rule_delete
 *   보는 분: 대표님 · 회계매니저(서버가 확인). 순이익 연결을 켠 사업자는 줄이 바뀔 때마다 서버가 운영본부 비용을 다시 맞춘다
 *   → 저장하면 운영본부 순이익(ops costs)도 새로 불러온다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { BizEntry, BizImportRow, BizKind, BizRule } from "@/lib/bizLedger";
import { OPS_KEY } from "./opsService";

export const BIZ_KEY = ["biz"] as const;
const OPS_COSTS_KEY = [...OPS_KEY, "costs"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);
async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}
const num = (v: unknown) => Number(v) || 0;

export interface BizBook {
  id: string;
  name: string;
  owner_name: string;
  kind: "personal" | "corp";
  branch: string | null;
  costs_live: boolean;
  accounts: string[];
}

export interface BizBookCard extends BizBook {
  /** 이 달 지출 · 돌려받음 · 수입 · 줄 수 */
  out: number;
  back: number;
  in: number;
  n: number;
  last_day: string | null;
}

export interface BizHome {
  month: string;
  can_add: boolean;
  books: BizBookCard[];
  branches: string[];
}

export interface BizStaff {
  id: string;
  name: string;
  kind: string;
  active: boolean;
}

export interface BizMonth {
  month: string;
  book: BizBook;
  entries: BizEntry[];
  trend: Array<{ month: string; cost: number; in: number; n: number }>;
  staff: BizStaff[];
}

const toBook = (b: Record<string, unknown>): BizBook => ({
  id: String(b.id),
  name: String(b.name ?? ""),
  owner_name: String(b.owner_name ?? ""),
  kind: b.kind === "corp" ? "corp" : "personal",
  branch: typeof b.branch === "string" ? b.branch : null,
  costs_live: b.costs_live === true,
  accounts: Array.isArray(b.accounts) ? b.accounts.map(String) : [],
});

/** 첫 화면 — month 'YYYY-MM' */
export const useBizHome = (month: string, enabled = true) =>
  useQuery({
    queryKey: [...BIZ_KEY, "home", month],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<BizHome> => {
      const d = await call<Record<string, unknown>>("biz_home", { p_month: month }, "사업자 가계부를 불러오지 못했어요");
      const books = Array.isArray(d.books) ? (d.books as Array<Record<string, unknown>>) : [];
      return {
        month: String(d.month ?? month),
        can_add: d.can_add === true,
        books: books.map((b) => ({ ...toBook(b), out: num(b.out), back: num(b.back), in: num(b.in), n: num(b.n), last_day: (b.last_day as string) ?? null })),
        branches: Array.isArray(d.branches) ? d.branches.map(String) : [],
      };
    },
  });

export const useBizMonth = (book: string | null, month: string) =>
  useQuery({
    queryKey: [...BIZ_KEY, "month", book, month],
    enabled: !!book,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<BizMonth> => {
      const d = await call<Record<string, unknown>>("biz_month", { p_book: book, p_month: month }, "가계부를 불러오지 못했어요");
      const entries = Array.isArray(d.entries) ? (d.entries as Array<Record<string, unknown>>) : [];
      return {
        month: String(d.month ?? month),
        book: toBook((d.book ?? {}) as Record<string, unknown>),
        entries: entries.map((e) => ({
          id: String(e.id),
          day: String(e.day ?? ""),
          month: String(e.month ?? month),
          kind: (["out", "in", "back", "move"].includes(String(e.kind)) ? e.kind : "out") as BizKind,
          cat: String(e.cat ?? "etc"),
          amount: num(e.amount),
          n: num(e.n) || 1,
          party: String(e.party ?? ""),
          memo: String(e.memo ?? ""),
          account: String(e.account ?? ""),
          staff_id: (e.staff_id as string) ?? null,
          staff_name: (e.staff_name as string) ?? null,
          wht: e.wht === null || e.wht === undefined ? null : num(e.wht),
          source: (["manual", "gagyebu_csv", "bank_file", "summary"].includes(String(e.source)) ? e.source : "manual") as BizEntry["source"],
        })),
        trend: Array.isArray(d.trend)
          ? (d.trend as Array<Record<string, unknown>>).map((t) => ({ month: String(t.month), cost: num(t.cost), in: num(t.in), n: num(t.n) }))
          : [],
        staff: Array.isArray(d.staff)
          ? (d.staff as Array<Record<string, unknown>>).map((s) => ({ id: String(s.id), name: String(s.name ?? ""), kind: String(s.kind ?? ""), active: s.active !== false }))
          : [],
      };
    },
  });

export const useBizRules = (book: string | null, enabled = true) =>
  useQuery({
    queryKey: [...BIZ_KEY, "rules", book],
    enabled: !!book && enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<BizRule[]> => {
      const d = await call<{ rules?: Array<Record<string, unknown>> }>("biz_rules", { p_book: book }, "자동 분류를 불러오지 못했어요");
      return (d.rules ?? []).map((r) => ({
        id: String(r.id),
        keyword: String(r.keyword ?? ""),
        kind: (["out", "in", "back", "move"].includes(String(r.kind)) ? r.kind : "out") as BizKind,
        cat: String(r.cat ?? "etc"),
        staff_id: (r.staff_id as string) ?? null,
        staff_name: (r.staff_name as string) ?? null,
      }));
    },
  });

/** 저장한 뒤 — 가계부 · 운영본부 순이익을 새로 */
const useRefresh = () => {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: BIZ_KEY });
    void qc.invalidateQueries({ queryKey: OPS_COSTS_KEY });
  };
};

export interface BookSaveInput {
  id?: string;
  name: string;
  owner_name: string;
  kind: "personal" | "corp";
  branch: string | null;
  costs_live: boolean;
  accounts: string[];
}

export const useBizBookSave = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (p: BookSaveInput) => call<{ ok: boolean; id: string }>("biz_book_save", { p }, "사업자를 저장하지 못했어요"),
    onSuccess: refresh,
  });
};

export const useBizBookArchive = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => call<{ ok: boolean }>("biz_book_archive", { p_id: id }, "보관하지 못했어요"),
    onSuccess: refresh,
  });
};

export interface EntrySaveInput {
  id?: string;
  book: string;
  day: string;
  month: string;
  kind: BizKind;
  cat: string;
  amount: number;
  party: string;
  memo: string;
  account: string;
  staff_id: string | null;
  wht: number | null;
  /** 받는 사람(곳) 이름을 다음부터 같은 항목으로 */
  rule?: boolean;
}

export const useBizEntrySave = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (p: EntrySaveInput) => call<{ ok: boolean; id: string }>("biz_entry_save", { p }, "저장하지 못했어요"),
    onSuccess: refresh,
  });
};

export const useBizEntryDelete = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => call<{ ok: boolean }>("biz_entry_delete", { p_id: id }, "지우지 못했어요"),
    onSuccess: refresh,
  });
};

/** 파일에서 여러 줄 — 3,000줄씩 나눠 보낸다. 같은 지문은 서버가 건너뛴다 */
export const useBizImport = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (p: { book: string; rows: BizImportRow[]; source: "bank_file" | "gagyebu_csv" }) => {
      let inserted = 0;
      let skipped = 0;
      const months = new Set<string>();
      for (let i = 0; i < p.rows.length; i += 3000) {
        const part = p.rows.slice(i, i + 3000).map((r) => ({
          day: r.day,
          month: r.month,
          kind: r.kind,
          cat: r.cat,
          amount: r.amount,
          party: r.party,
          memo: r.memo,
          account: r.account,
          staff_id: r.staff_id,
          fp: r.fp,
        }));
        const d = await call<{ inserted: number; skipped: number; months: string[] }>(
          "biz_import",
          { p_book: p.book, p_rows: part, p_meta: { source: p.source } },
          "파일 내용을 넣지 못했어요",
        );
        inserted += num(d.inserted);
        skipped += num(d.skipped);
        for (const m of d.months ?? []) months.add(m);
      }
      return { inserted, skipped, months: [...months].sort() };
    },
    onSuccess: refresh,
  });
};

export const useBizRuleSave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { book: string; keyword: string; kind: BizKind; cat: string; staff_id: string | null }) =>
      call<{ ok: boolean; id: string }>("biz_rule_save", { p }, "규칙을 저장하지 못했어요"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...BIZ_KEY, "rules"] }),
  });
};

export const useBizRuleDelete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<{ ok: boolean }>("biz_rule_delete", { p_id: id }, "규칙을 지우지 못했어요"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...BIZ_KEY, "rules"] }),
  });
};
