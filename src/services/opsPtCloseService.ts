/**
 * 153운영본부 · PT 월 마감 — 서버 함수 감싸기 (2026-11-16, DB 20261116155618_ops_pt_close.sql)
 *   ops_pt_close_list · ops_pt_close_confirm(코치 확정) · ops_pt_close_approve(승인 = 잠금) · ops_pt_close_reopen(승인 취소)
 *   · ops_pt_statement_head(2-3 명세서의 「지급하는 곳」)
 *   줄 만들기 · 견줌은 src/lib/opsPtClose.ts — 여기는 읽고 쓰기만.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) available=false — 마감 화면을 그리지 않는다
 *   (2-1 수당 카드 그대로). 예시 화면(`?demo=1`)은 서버를 부르지 않는다 — 예시 자료(opsPtCloseSample)를 이 기기 안에서만 바꾼다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { PtCloseConfirm, PtCloseData, PtCloseHold, PtCloseLine, PtEmployer, PtStatementHead } from "@/lib/opsPtClose";
import { PT_SAMPLE_HEAD, applyPtCloseDemo, buildPtCloseSample, type PtCloseDemoAction } from "@/lib/opsPtCloseSample";
import { OPS_KEY } from "./opsService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
/** 서버에 함수가 없다 — DB 적용 전 · 옛 DB 미리보기 */
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

const keyOf = (branch: string | null, demo: boolean) => (demo ? ([...OPS_KEY, "pt-close", "demo"] as const) : ([...OPS_KEY, "pt-close", branch] as const));

export interface PtCloseOpts {
  enabled?: boolean;
  /** 예시 화면 — 서버를 부르지 않는다 */
  demo?: boolean;
}

/** 관리자 또는 그 지점 PT 위탁 코치만 — 그 밖은 서버가 막는다(enabled 로 미리 거른다) */
export const useOpsPtCloses = (branch: string | null, { enabled = true, demo = false }: PtCloseOpts = {}) =>
  useQuery({
    queryKey: keyOf(branch, demo),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    retry: false,
    queryFn: async (): Promise<PtCloseData> => {
      if (demo) return buildPtCloseSample(kstToday());
      const off: PtCloseData = { branch: branch ?? "", on: false, available: false, manage: false, pay: false, me_staff: null };
      const { data, error } = await rpc("ops_pt_close_list", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return off;
        throw new Error(translateError(error, "PT 수당 마감을 불러오지 못했어요"));
      }
      const d = (data ?? {}) as Partial<PtCloseData>;
      return {
        ...off,
        ...d,
        on: !!d.on,
        available: true,
        coaches: d.coaches ?? [],
        closes: d.closes ?? [],
      };
    },
  });

/**
 * PT 명세서의 「지급하는 곳」(2-3 · DB ops_pt_statement_head) — 돈을 보는 분과 그 지점 PT 코치 본인만.
 *   서버에 함수가 없거나 볼 수 없는 계정이면 employer=null — 명세서에는 지점 이름만 나온다(막지 않는다).
 */
export const useOpsPtStatementHead = (branch: string | null, { enabled = true, demo = false }: PtCloseOpts = {}) =>
  useQuery({
    queryKey: demo ? ([...OPS_KEY, "pt-statement-head", "demo"] as const) : ([...OPS_KEY, "pt-statement-head", branch] as const),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 300_000,
    retry: false,
    queryFn: async (): Promise<PtStatementHead> => {
      if (demo) return PT_SAMPLE_HEAD;
      const { data, error } = await rpc("ops_pt_statement_head", { p_branch: branch });
      if (error) return { available: !isMissingFn(error), employer: null };
      const e = ((data ?? {}) as { employer?: Partial<PtEmployer> | null }).employer;
      return {
        available: true,
        employer: e
          ? { biz_name: e.biz_name ?? "", owner_name: e.owner_name ?? "", biz_number: e.biz_number ?? "", address: e.address ?? "", phone: e.phone ?? "" }
          : null,
      };
    },
  });

export interface PtCloseSnapshotPayload {
  lines: PtCloseLine[];
  holds: PtCloseHold[];
  hold: number;
}

/** 쓰기 — 예시 화면에서는 이 기기 안의 예시 자료만 바꾼다 */
export const useOpsPtCloseActions = (branch: string | null, { demo = false }: PtCloseOpts = {}) => {
  const qc = useQueryClient();
  const key = keyOf(branch, demo);
  const done = () => (demo ? undefined : qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-close"] }));
  const demoApply = (a: PtCloseDemoAction) => {
    const cur = qc.getQueryData<PtCloseData>(key);
    if (cur) qc.setQueryData(key, applyPtCloseDemo(cur, a));
  };

  /** 코치 확정 — 달이 끝난 뒤 · 본인 것만 */
  const confirm = useMutation({
    mutationFn: async (p: { coachId: string; month: string; summary: PtCloseConfirm }) => {
      if (demo) return demoApply({ type: "confirm", ...p });
      await call("ops_pt_close_confirm", { p_branch: branch, p_month: p.month, p_summary: p.summary }, "확정하지 못했어요");
    },
    onSuccess: done,
  });
  /** 승인 = 잠금 — 대표님 · 회계매니저 */
  const approve = useMutation({
    mutationFn: async (p: { coachId: string; month: string; snapshot: PtCloseSnapshotPayload }) => {
      if (demo) return demoApply({ type: "approve", ...p });
      await call("ops_pt_close_approve", { p_branch: branch, p_coach: p.coachId, p_month: p.month, p_snapshot: p.snapshot }, "승인하지 못했어요");
    },
    onSuccess: done,
  });
  /** 승인 취소 — 대표님만 · 뒤 달이 승인되기 전에만 */
  const reopen = useMutation({
    mutationFn: async (p: { id: string; reason: string }) => {
      if (demo) return demoApply({ type: "reopen", ...p });
      await call("ops_pt_close_reopen", { p_id: p.id, p_reason: p.reason }, "승인을 취소하지 못했어요");
    },
    onSuccess: done,
  });
  return { confirm, approve, reopen };
};
