/**
 * 153운영본부 · 근무 — 출근 확정(코치 신고 → 지점장 승인 · 출근 알림 설정) 서버 함수 감싸기
 *   (2026-11-12, DB 20261112225136_ops_work_stage1.sql — ops_duty_reports · ops_duty_report_send · _decide · _cancel · ops_duty_setting_set)
 *   글 · 판단은 src/lib/opsDuty.ts.
 *
 *   서버에 함수가 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) available=false 로 보고 신고 단추 · 목록을 숨긴다.
 *   예시 화면(`?demo=1`)은 서버를 부르지 않고 이 기기 안에서만 바뀐다.
 *   승인하면 그날 인정 시간이 바뀌므로 근무 자료(ops_month)도 다시 읽는다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  DUTY_DEFAULT_SETTING,
  applyDutyDemo,
  buildDutySample,
  type DutyData,
  type DutyDemoAction,
  type DutyPayload,
  type DutyReport,
} from "@/lib/opsDuty";
import { OPS_KEY } from "./opsService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

export interface DutyOpts {
  enabled?: boolean;
  demo?: boolean;
  demoManage?: boolean;
}

const keyOf = (branch: string | null, demo: boolean, demoManage: boolean) =>
  demo ? ([...OPS_KEY, "duty", "demo", demoManage] as const) : ([...OPS_KEY, "duty", branch] as const);

const emptyData = (branch: string | null): DutyData => ({
  available: false,
  branch: branch ?? "",
  manage: false,
  can_set: false,
  today: kstToday(),
  setting: DUTY_DEFAULT_SETTING,
  reports: [],
});

/** 관리자 = 지점 전체 신고 · 코치 = 내 근무자 카드 신고 + 출근 알림 설정 */
export const useOpsDuty = (branch: string | null, { enabled = true, demo = false, demoManage = false }: DutyOpts = {}) =>
  useQuery({
    queryKey: keyOf(branch, demo, demoManage),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 60_000,
    retry: false,
    queryFn: async (): Promise<DutyData> => {
      if (demo) return buildDutySample(kstToday(), demoManage);
      const { data, error } = await rpc("ops_duty_reports", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return emptyData(branch);
        throw new Error(translateError(error, "출근 신고를 불러오지 못했어요"));
      }
      const d = (data ?? {}) as Partial<DutyData>;
      return {
        available: true,
        branch: d.branch ?? branch ?? "",
        manage: !!d.manage,
        can_set: !!d.can_set,
        today: d.today ?? kstToday(),
        setting: { ...DUTY_DEFAULT_SETTING, ...(d.setting ?? {}) },
        reports: Array.isArray(d.reports) ? (d.reports as DutyReport[]) : [],
      };
    },
  });

/** 보내기 · 처리 · 취소 · 출근 알림 설정 — 예시 화면에서는 이 기기 안의 예시만 바꾼다 */
export const useOpsDutyActions = (branch: string | null, { demo = false, demoManage = false }: DutyOpts = {}) => {
  const qc = useQueryClient();
  const key = keyOf(branch, demo, demoManage);
  // 승인 = 그날 인정 시간이 바뀐다 → 근무 자료까지 다시 읽는다
  const done = () => (demo ? undefined : qc.invalidateQueries({ queryKey: OPS_KEY }));
  const demoApply = (a: DutyDemoAction) => {
    const cur = qc.getQueryData<DutyData>(key);
    if (cur) qc.setQueryData(key, applyDutyDemo(cur, a, new Date().toISOString()));
  };

  const send = useMutation({
    mutationFn: async (v: { p: DutyPayload; staffName: string }): Promise<{ id: string; updated: boolean }> => {
      if (demo) {
        demoApply({ type: "send", p: v.p, staffName: v.staffName });
        return { id: "demo", updated: false };
      }
      const { data, error } = await rpc("ops_duty_report_send", { p: v.p });
      if (error) throw new Error(translateError(error, "신고를 보내지 못했어요"));
      const d = (data ?? {}) as { id?: string; updated?: boolean };
      return { id: d.id ?? "", updated: !!d.updated };
    },
    onSuccess: done,
  });
  const decide = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; minutes?: number | null; note?: string | null }) => {
      if (demo) return demoApply({ type: "decide", id: v.id, approve: v.approve, minutes: v.minutes ?? null, note: v.note ?? null });
      const { error } = await rpc("ops_duty_report_decide", {
        p_id: v.id,
        p_approve: v.approve,
        p_minutes: v.minutes ?? null,
        p_note: v.note?.trim() || null,
      });
      if (error) throw new Error(translateError(error, "처리하지 못했어요"));
    },
    onSuccess: done,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return demoApply({ type: "cancel", id });
      const { error } = await rpc("ops_duty_report_cancel", { p_id: id });
      if (error) throw new Error(translateError(error, "취소하지 못했어요"));
    },
    onSuccess: done,
  });
  const setting = useMutation({
    mutationFn: async (v: { on: boolean }) => {
      if (demo) return demoApply({ type: "setting", on: v.on });
      const { error } = await rpc("ops_duty_setting_set", { p_branch: branch, p_on: v.on });
      if (error) throw new Error(translateError(error, "바꾸지 못했어요"));
    },
    onSuccess: done,
  });
  return { send, decide, cancel, setting };
};

export type DutyActions = ReturnType<typeof useOpsDutyActions>;
