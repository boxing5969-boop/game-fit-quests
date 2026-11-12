/**
 * 153운영본부 · PT 기록 「오류 신고」 — 서버 함수 감싸기 (2026-11-12, DB 20261112192419_ops_pt_reports.sql)
 *   ops_pt_reports · ops_pt_report_send · ops_pt_report_resolve. 글 · 판단은 src/lib/opsPtReport.ts.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) 신고가 없는 것으로 보고
 *   단추도 숨긴다(available=false). 예시 화면(`?demo=1`)은 서버를 부르지 않고 이 기기 안에서만 바뀐다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  applyPtReportDemo,
  buildPtReportSample,
  type PtReport,
  type PtReportDemoAction,
  type PtReportPayload,
  type PtReportStatus,
} from "@/lib/opsPtReport";
import { PT_SAMPLE_COACH } from "@/lib/opsPtRecordSample";
import { OPS_KEY } from "./opsService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

export interface PtReportList {
  /** 서버에 신고 함수가 있다(없으면 단추를 숨긴다) */
  available: boolean;
  reports: PtReport[];
}

const keyOf = (branch: string | null, demo: boolean, demoManage: boolean) =>
  demo ? ([...OPS_KEY, "pt-report", "demo", demoManage] as const) : ([...OPS_KEY, "pt-report", branch] as const);

export interface PtReportOpts {
  enabled?: boolean;
  demo?: boolean;
  demoManage?: boolean;
}

/** 관리자 = 지점 전체 · PT 위탁 코치 = 본인이 보낸 것 + 본인 담당 */
export const useOpsPtReports = (branch: string | null, { enabled = true, demo = false, demoManage = false }: PtReportOpts = {}) =>
  useQuery({
    queryKey: keyOf(branch, demo, demoManage),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 60_000,
    retry: false,
    queryFn: async (): Promise<PtReportList> => {
      if (demo) return { available: true, reports: buildPtReportSample(kstToday(), demoManage, PT_SAMPLE_COACH) };
      const { data, error } = await rpc("ops_pt_reports", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return { available: false, reports: [] };
        throw new Error(translateError(error, "오류 신고를 불러오지 못했어요"));
      }
      return { available: true, reports: Array.isArray(data) ? (data as PtReport[]) : [] };
    },
  });

/** 보내기 · 처리 — 예시 화면에서는 이 기기 안의 예시만 바꾼다 */
export const useOpsPtReportActions = (branch: string | null, { demo = false, demoManage = false }: PtReportOpts = {}) => {
  const qc = useQueryClient();
  const key = keyOf(branch, demo, demoManage);
  const done = () => (demo ? undefined : qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-report"] }));
  const demoApply = (a: PtReportDemoAction) => {
    const cur = qc.getQueryData<PtReportList>(key);
    if (cur) qc.setQueryData(key, { ...cur, reports: applyPtReportDemo(cur.reports, a, { manage: demoManage, coachId: PT_SAMPLE_COACH }) });
  };

  const send = useMutation({
    mutationFn: async (v: { p: PtReportPayload; memberName: string }): Promise<{ id: string; dup: boolean }> => {
      if (demo) {
        demoApply({ type: "send", p: v.p, memberName: v.memberName });
        return { id: "demo", dup: false };
      }
      const { data, error } = await rpc("ops_pt_report_send", { p: v.p });
      if (error) throw new Error(translateError(error, "신고를 보내지 못했어요"));
      const d = (data ?? {}) as { id?: string; dup?: boolean };
      return { id: d.id ?? "", dup: !!d.dup };
    },
    onSuccess: done,
  });
  const resolve = useMutation({
    mutationFn: async (v: { id: string; status: Exclude<PtReportStatus, "open">; reply: string }) => {
      if (demo) return demoApply({ type: "resolve", ...v });
      const { error } = await rpc("ops_pt_report_resolve", { p_id: v.id, p_status: v.status, p_reply: v.reply });
      if (error) throw new Error(translateError(error, "처리하지 못했어요"));
    },
    onSuccess: done,
  });
  return { send, resolve };
};
