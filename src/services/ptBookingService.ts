/**
 * PT 프리미엄 1단계 — PT 예약 서버 함수 감싸기 (2026-11-14 · DB 20261114150412_ops_pt_booking.sql)
 *   회원: pt_my_home · pt_open_slots · pt_book · pt_move · pt_cancel · pt_confirm_lesson
 *   코치 · 지점장 · 대표님: ops_pt_book_board · ops_pt_booking_save · ops_pt_booking_close · ops_pt_slots_save · ops_pt_book_setting_set
 *   계산 · 글은 src/lib/ptBooking.ts — 여기는 읽고 쓰기만.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) 꺼진 것으로 본다(화면에 아무것도 안 나온다).
 *   예시 화면은 서버를 부르지 않는다 — 회원 `/home?ptdemo=1`(이 창을 닫을 때까지 · `?ptdemo=0` 으로 끔) · 코치 `/office?tab=work&demo=1`.
 *   캐시 열쇠는 "153pt"(회원) · ["ops","pt-book"](예약판) — 다른 도메인과 겹치지 않게.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { translateError } from "@/lib/errorMessages";
import { MILEAGE_KEY } from "@/hooks/useMileage";
import {
  PT_HOME_OFF,
  PT_SLOTS_OFF,
  normalizePtBoard,
  normalizePtHome,
  normalizePtSlots,
  normalizeSaveResult,
  type PtBoard,
  type PtBoardSettings,
  type PtCloseKind,
  type PtHome,
  type PtOpenSlots,
  type PtSaveResult,
} from "@/lib/ptBooking";
import { applyPtBoardDemo, applyPtHomeDemo, buildPtBoardSample, buildPtHomeSample, buildPtSlotsSample, type PtBoardDemoAction } from "@/lib/ptBookingSample";
import { OPS_KEY } from "./opsService";

export const PT_KEY = ["153pt"] as const;
const DEMO_KEY = "153pt:demo";

/** 회원 예시 모드 — 주소에 ?ptdemo=1 이 한 번이라도 있었으면 이 창(탭)을 닫을 때까지 */
export function isPtDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("ptdemo");
    if (q === "1") window.sessionStorage.setItem(DEMO_KEY, "1");
    if (q === "0") window.sessionStorage.removeItem(DEMO_KEY);
    return window.sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("ptdemo") === "1";
  }
}

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

// ───────────────────────── 회원 ─────────────────────────
const homeKey = (uid: string | null | undefined, demo: boolean) => [...PT_KEY, "home", demo ? "demo" : (uid ?? "anon")] as const;
const slotsKey = (uid: string | null | undefined, demo: boolean) => [...PT_KEY, "slots", demo ? "demo" : (uid ?? "anon")] as const;

/** 홈 PT 카드 한 번에 — enabled 는 PT 수업권이 있는 회원만(그 밖의 회원은 서버를 부르지 않는다) */
export const usePtHome = (enabled = true) => {
  const { user } = useAuth();
  const demo = isPtDemo();
  return useQuery({
    queryKey: homeKey(user?.id, demo),
    enabled: demo || (enabled && !!user),
    staleTime: demo ? Infinity : 30_000,
    refetchInterval: demo ? false : 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<PtHome> => {
      if (demo) return buildPtHomeSample();
      const { data, error } = await rpc("pt_my_home");
      if (error) {
        if (isMissingFn(error)) return PT_HOME_OFF;
        throw new Error(translateError(error, "PT 일정을 불러오지 못했어요"));
      }
      return normalizePtHome(data);
    },
  });
};

/** 예약할 수 있는 칸 — 예약 · 시간 바꾸기 창을 열 때만 */
export const usePtOpenSlots = (enabled: boolean) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isPtDemo();
  return useQuery({
    queryKey: slotsKey(user?.id, demo),
    enabled: enabled && (demo || !!user),
    staleTime: 0,
    refetchInterval: enabled && !demo ? 60_000 : false,
    retry: false,
    queryFn: async (): Promise<PtOpenSlots> => {
      if (demo) return buildPtSlotsSample(qc.getQueryData<PtHome>(homeKey(user?.id, true)) ?? buildPtHomeSample());
      const { data, error } = await rpc("pt_open_slots");
      if (error) {
        if (isMissingFn(error)) return PT_SLOTS_OFF;
        throw new Error(translateError(error, "예약할 수 있는 시간을 불러오지 못했어요"));
      }
      return normalizePtSlots(data);
    },
  });
};

export interface PtCancelResult {
  result: "canceled" | "late_canceled";
  deducted: boolean;
}
export interface PtConfirmResult {
  mileage: number;
  again: boolean;
}

/** 회원 쓰기 — 예시 화면에서는 이 기기 안의 예시 자료만 바꾼다 */
export const usePtActions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isPtDemo();
  const done = () => {
    void qc.invalidateQueries({ queryKey: [...PT_KEY, "slots"] });
    if (!demo) void qc.invalidateQueries({ queryKey: [...PT_KEY, "home"] });
  };
  const demoApply = (a: Parameters<typeof applyPtHomeDemo>[1]) => {
    const key = homeKey(user?.id, true);
    const cur = qc.getQueryData<PtHome>(key) ?? buildPtHomeSample();
    qc.setQueryData(key, applyPtHomeDemo(cur, a));
  };

  const book = useMutation({
    mutationFn: async (at: string) => {
      if (demo) return demoApply({ type: "book", at });
      await call<string>("pt_book", { p_start: at }, "예약하지 못했어요");
    },
    onSuccess: done,
  });
  const move = useMutation({
    mutationFn: async (v: { id: string; at: string }) => {
      if (demo) return demoApply({ type: "move", id: v.id, at: v.at });
      await call<string>("pt_move", { p_id: v.id, p_start: v.at }, "시간을 바꾸지 못했어요");
    },
    onSuccess: done,
  });
  const cancel = useMutation({
    mutationFn: async (v: { id: string; lateOk: boolean }): Promise<PtCancelResult> => {
      if (demo) {
        demoApply({ type: "cancel", id: v.id, lateOk: v.lateOk });
        return { result: v.lateOk ? "late_canceled" : "canceled", deducted: v.lateOk };
      }
      const r = await call<{ result?: string; deducted?: boolean } | null>("pt_cancel", { p_id: v.id, p_late_ok: v.lateOk }, "취소하지 못했어요");
      return { result: r?.result === "late_canceled" ? "late_canceled" : "canceled", deducted: r?.deducted === true };
    },
    onSuccess: done,
  });
  const confirm = useMutation({
    mutationFn: async (id: string): Promise<PtConfirmResult> => {
      if (demo) {
        const cur = qc.getQueryData<PtHome>(homeKey(user?.id, true));
        demoApply({ type: "confirm", id });
        return { mileage: cur?.rules.mileage ?? 0, again: false };
      }
      const r = await call<{ mileage?: number; again?: boolean } | null>("pt_confirm_lesson", { p_id: id }, "기록하지 못했어요");
      return { mileage: Number(r?.mileage ?? 0) || 0, again: r?.again === true };
    },
    onSuccess: () => {
      done();
      if (!demo) void qc.invalidateQueries({ queryKey: MILEAGE_KEY });
    },
  });
  return { book, move, cancel, confirm, demo };
};

// ───────────────────────── 코치 · 지점장 · 대표님 ─────────────────────────
export interface PtBoardOpts {
  enabled?: boolean;
  /** 예시 화면 — 서버를 부르지 않는다 */
  demo?: boolean;
  /** 예시를 관리자 화면 자료로 */
  demoManage?: boolean;
}
const boardKey = (branch: string | null, demo: boolean, demoManage: boolean) =>
  demo ? ([...OPS_KEY, "pt-book", "demo", demoManage] as const) : ([...OPS_KEY, "pt-book", branch] as const);

const BOARD_OFF = (branch: string | null): PtBoard => normalizePtBoard({ on: false }, branch ?? "");

/** 관리자 또는 그 지점 PT 위탁 코치만 — 그 밖은 서버가 막는다(꺼진 것으로 본다) */
export const usePtBoard = (branch: string | null, { enabled = true, demo = false, demoManage = false }: PtBoardOpts = {}) =>
  useQuery({
    queryKey: boardKey(branch, demo, demoManage),
    enabled: demo || (enabled && !!branch),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 60_000,
    retry: false,
    queryFn: async (): Promise<PtBoard> => {
      if (demo) return buildPtBoardSample(Date.now(), demoManage);
      const { data, error } = await rpc("ops_pt_book_board", { p_branch: branch });
      if (error) {
        // 함수가 없거나(적용 전) 볼 수 없는 계정이면 조용히 꺼진 것으로
        if (isMissingFn(error) || /볼 수 없어요/.test(error.message ?? "")) return BOARD_OFF(branch);
        throw new Error(translateError(error, "PT 예약을 불러오지 못했어요"));
      }
      return normalizePtBoard(data, branch ?? "");
    },
  });

export interface PtBoardSavePayload {
  branch?: string;
  coach_staff_id?: string;
  members?: string[];
  start_at: string;
  weeks?: number;
  force?: boolean;
  join?: boolean;
  /** 있으면 그 예약의 시간 바꾸기 */
  id?: string;
}

export const usePtBoardActions = (branch: string | null, { demo = false, demoManage = false }: PtBoardOpts = {}) => {
  const qc = useQueryClient();
  const key = boardKey(branch, demo, demoManage);
  const done = () => {
    if (demo) return;
    void qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-book"] });
    void qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-record"] }); // 닫기가 PT 기록을 남긴다
  };
  const demoApply = (a: PtBoardDemoAction): PtSaveResult | undefined => {
    const cur = qc.getQueryData<PtBoard>(key) ?? buildPtBoardSample(Date.now(), demoManage);
    const { board, result } = applyPtBoardDemo(cur, a);
    qc.setQueryData(key, board);
    return result;
  };

  const save = useMutation({
    mutationFn: async (p: PtBoardSavePayload): Promise<PtSaveResult> => {
      if (demo) return demoApply({ type: "save", p }) ?? { made: 0, ids: [], skipped: [] };
      return normalizeSaveResult(await call<unknown>("ops_pt_booking_save", { p }, "예약을 넣지 못했어요"));
    },
    onSuccess: done,
  });
  const close = useMutation({
    mutationFn: async (v: { id: string; kind: PtCloseKind; note?: string | null }) => {
      if (demo) return void demoApply({ type: "close", id: v.id, kind: v.kind, note: v.note });
      await call<void>("ops_pt_booking_close", { p_id: v.id, p_kind: v.kind, p_note: v.note ?? null }, "처리하지 못했어요");
    },
    onSuccess: done,
  });
  const slots = useMutation({
    mutationFn: async (v: { coach: string; slots: { weekday: number; start_min: number; end_min: number }[] }) => {
      if (demo) return void demoApply({ type: "slots", coach: v.coach, slots: v.slots });
      await call<number>("ops_pt_slots_save", { p_branch: branch, p_coach: v.coach, p_slots: v.slots }, "저장하지 못했어요");
    },
    onSuccess: done,
  });
  /** 켜기 · 끄기 · 금액 — 대표님만 */
  const setting = useMutation({
    mutationFn: async (p: Partial<PtBoardSettings>) => {
      if (demo) return void demoApply({ type: "setting", p });
      await call<unknown>("ops_pt_book_setting_set", { p_branch: branch, p }, "바꾸지 못했어요");
    },
    onSuccess: done,
  });
  return { save, close, slots, setting };
};
