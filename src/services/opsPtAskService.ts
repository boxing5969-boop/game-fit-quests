/**
 * 153운영본부 · PT 기록 「코치에게 물어보기」 — 서버 함수 감싸기 (2026-11-19, DB 20261119114451_ops_pt_asks.sql)
 *   ops_pt_asks · ops_pt_ask_send · ops_pt_ask_answer. 글 · 짝 찾기는 src/lib/opsPtAsk.ts.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) 질문이 없는 것으로 보고
 *   단추도 숨긴다(available=false). 예시 화면(`?demo=1`)은 서버를 부르지 않고 이 기기 안에서만 바뀐다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { applyPtAskDemo, buildPtAskSample, type PtAsk, type PtAskDemoAction, type PtAskPayload } from "@/lib/opsPtAsk";
import { PT_SAMPLE_COACH } from "@/lib/opsPtRecordSample";
import { OPS_KEY } from "./opsService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

export interface PtAskList {
  /** 서버에 물어보기 함수가 있다(없으면 단추를 숨긴다) */
  available: boolean;
  asks: PtAsk[];
}

const keyOf = (branch: string | null, demo: boolean, demoManage: boolean) =>
  demo ? ([...OPS_KEY, "pt-ask", "demo", demoManage] as const) : ([...OPS_KEY, "pt-ask", branch] as const);

export interface PtAskOpts {
  enabled?: boolean;
  demo?: boolean;
  demoManage?: boolean;
}

/** 관리자 = 지점 전체 · PT 위탁 코치 = 본인에게 온 것 */
export const useOpsPtAsks = (branch: string | null, { enabled = true, demo = false, demoManage = false }: PtAskOpts = {}) =>
  useQuery({
    queryKey: keyOf(branch, demo, demoManage),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 60_000,
    retry: false,
    queryFn: async (): Promise<PtAskList> => {
      if (demo) return { available: true, asks: buildPtAskSample(kstToday(), demoManage, PT_SAMPLE_COACH) };
      const { data, error } = await rpc("ops_pt_asks", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return { available: false, asks: [] };
        throw new Error(translateError(error, "질문을 불러오지 못했어요"));
      }
      return { available: true, asks: Array.isArray(data) ? (data as PtAsk[]) : [] };
    },
  });

/** 물어보기 · 답하기 — 예시 화면에서는 이 기기 안의 예시만 바꾼다 */
export const useOpsPtAskActions = (branch: string | null, { demo = false, demoManage = false }: PtAskOpts = {}) => {
  const qc = useQueryClient();
  const key = keyOf(branch, demo, demoManage);
  const done = () => (demo ? undefined : qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-ask"] }));
  const demoApply = (a: PtAskDemoAction) => {
    const cur = qc.getQueryData<PtAskList>(key);
    if (cur) qc.setQueryData(key, { ...cur, asks: applyPtAskDemo(cur.asks, a, { coachId: PT_SAMPLE_COACH }) });
  };

  const send = useMutation({
    mutationFn: async (p: PtAskPayload): Promise<{ id: string; dup: boolean }> => {
      if (demo) {
        demoApply({ type: "send", p });
        return { id: "demo", dup: false };
      }
      const { data, error } = await rpc("ops_pt_ask_send", { p });
      if (error) throw new Error(translateError(error, "보내지 못했어요"));
      const d = (data ?? {}) as { id?: string; dup?: boolean };
      return { id: d.id ?? "", dup: !!d.dup };
    },
    onSuccess: done,
  });
  const answer = useMutation({
    mutationFn: async (v: { id: string; answer: string }) => {
      if (demo) return demoApply({ type: "answer", ...v });
      const { error } = await rpc("ops_pt_ask_answer", { p_id: v.id, p_answer: v.answer });
      if (error) throw new Error(translateError(error, "답을 보내지 못했어요"));
    },
    onSuccess: done,
  });
  return { send, answer };
};
