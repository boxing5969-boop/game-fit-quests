/**
 * 153운영본부 · PT 기록 — 서버 함수 감싸기 (2026-11-11, DB 20261111184433_ops_pt_record.sql)
 *   ops_pt_record · ops_pt_session_save · ops_pt_session_void · ops_pt_session_review · ops_pt_member_label_set · ops_pt_setting_set
 *   + 자동 기록 켜기 · 끄기 ops_pt_auto_set (2026-11-12 근무 1단계, DB 20261112225136_ops_work_stage1.sql)
 *   짝짓기 · 판정은 src/lib/opsPtRecord.ts — 여기는 읽고 쓰기만.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) 꺼진 것으로 본다(화면에 아무것도 안 나온다).
 *   예시 화면(`?demo=1`)은 서버를 부르지 않는다 — 예시 자료(opsPtRecordSample)를 이 기기 안에서만 고친다.
 *   예시는 자동 기록을 켠 지점 모습(근무 1단계) — 관리자 예시의 「자동 기록」 켜기 · 끄기는 코치 예시에도 같이 반영한다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { PtRecordData, PtSavePayload } from "@/lib/opsPtRecord";
import { applyPtDemo, buildPtSample, type PtDemoAction } from "@/lib/opsPtRecordSample";
import { OPS_KEY } from "./opsService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
/** 서버에 함수가 없다 — DB 적용 전 · 옛 DB 미리보기 */
const isMissingFn = (e: RpcError) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

const keyOf = (branch: string | null, demo: boolean, demoManage: boolean) =>
  demo ? ([...OPS_KEY, "pt-record", "demo", demoManage] as const) : ([...OPS_KEY, "pt-record", branch] as const);

export interface PtRecordOpts {
  enabled?: boolean;
  /** 예시 화면 — 서버를 부르지 않는다 */
  demo?: boolean;
  /** 예시를 관리자 화면 자료로 */
  demoManage?: boolean;
}

/** 관리자 또는 그 지점 PT 위탁 코치만 — 그 밖은 서버가 막는다(enabled 로 미리 거른다) */
export const useOpsPtRecord = (branch: string | null, { enabled = true, demo = false, demoManage = false }: PtRecordOpts = {}) =>
  useQuery({
    queryKey: keyOf(branch, demo, demoManage),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 60_000,
    retry: false,
    queryFn: async (): Promise<PtRecordData> => {
      if (demo) return buildPtSample(kstToday(), demoManage, { auto: true });
      const { data, error } = await rpc("ops_pt_record", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return { branch: branch ?? "", on: false, manage: false, me_staff: null };
        throw new Error(translateError(error, "PT 기록을 불러오지 못했어요"));
      }
      const d = (data ?? {}) as PtRecordData;
      return {
        ...d,
        on: !!d.on,
        coaches: d.coaches ?? [],
        members: d.members ?? [],
        sessions: d.sessions ?? [],
        events: d.events ?? [],
        attendance: d.attendance ?? [],
      };
    },
  });

/** 쓰기 — 예시 화면에서는 이 기기 안의 예시 자료만 바꾼다 */
export const useOpsPtRecordActions = (branch: string | null, { demo = false, demoManage = false }: PtRecordOpts = {}) => {
  const qc = useQueryClient();
  const key = keyOf(branch, demo, demoManage);
  const done = () => (demo ? undefined : qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-record"] }));
  const demoApply = (a: PtDemoAction) => {
    const cur = qc.getQueryData<PtRecordData>(key);
    if (cur) qc.setQueryData(key, applyPtDemo(cur, a));
  };

  const save = useMutation({
    mutationFn: async (p: PtSavePayload) => {
      if (demo) return demoApply({ type: "save", p });
      await call<string>("ops_pt_session_save", { p }, "저장하지 못했어요");
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: async (v: { id: string; reason: string }) => {
      if (demo) return demoApply({ type: "void", id: v.id });
      await call<void>("ops_pt_session_void", { p_id: v.id, p_reason: v.reason }, "지우지 못했어요");
    },
    onSuccess: done,
  });
  const review = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return demoApply({ type: "review", id });
      await call<void>("ops_pt_session_review", { p_id: id }, "확인하지 못했어요");
    },
    onSuccess: done,
  });
  const label = useMutation({
    mutationFn: async (v: { member: string; label: string }) => {
      if (demo) return demoApply({ type: "label", member: v.member, label: v.label });
      await call<void>("ops_pt_member_label_set", { p_branch: branch, p_member: v.member, p_label: v.label }, "이름표를 저장하지 못했어요");
    },
    onSuccess: done,
  });
  /** 켜기 · 끄기 — 대표님만 */
  const setting = useMutation({
    mutationFn: async (p: { record_on?: boolean; notify_on?: boolean; started_on?: string }) => {
      if (demo) return;
      await call<unknown>("ops_pt_setting_set", { p_branch: branch, p }, "바꾸지 못했어요");
    },
    onSuccess: done,
  });
  /** 자동 기록 켜기 · 끄기 — 대표님만 · PT 기록을 켠 지점. 켜면 서버가 바로 한 번 돌아 넣은 수(made)를 돌려준다 */
  const auto = useMutation({
    mutationFn: async (on: boolean): Promise<{ made: number }> => {
      if (demo) {
        for (const k of [keyOf(branch, true, true), keyOf(branch, true, false)]) {
          const cur = qc.getQueryData<PtRecordData>(k);
          if (cur) qc.setQueryData(k, applyPtDemo(cur, { type: "auto", on }));
        }
        return { made: 0 };
      }
      const r = await call<{ made?: number } | null>("ops_pt_auto_set", { p_branch: branch, p_on: on }, "바꾸지 못했어요");
      const made = Number(r?.made ?? 0);
      return { made: made > 0 ? made : 0 }; // 서버 안에서 넣기가 실패하면 -1 — 켜기는 된 것이니 0 으로
    },
    onSuccess: done,
  });
  return { save, remove, review, label, setting, auto };
};
