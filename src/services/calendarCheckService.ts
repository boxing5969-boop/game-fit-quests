/**
 * ✅ 운동 달력 2-1단계 — 서버 함수 감싸기 (DB 20261112211833_calendar_checks_stage21.sql)
 *   get_my_calendar · set_my_check_item · remove_my_check_item · set_my_check_done · set_my_day_sticker
 *   서버 함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 달력은 지금 그대로(운동 약속과 같은 결).
 *   캐시 키는 "153cal2" 로 시작 — 한 줄 쓰기 · 응원 보내기를 마치면 이 키를 다시 읽는다. 계산 · 글은 src/lib/calendarChecks.ts.
 *   (2-2 · DB 20261113001417_calendar_stage22.sql) get_my_calendar 가 153 일정 · 저요 한 모집 · 저녁 독려도 함께 보낸다 ·
 *   저녁 독려 켜기 · 끄기 = set_my_calendar_prefs (useSetCalendarNudge).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  CAL_OFF,
  applyDone,
  applySticker,
  checkItemPayload,
  normalizeCalendar,
  type CalState,
  type CheckItemDraft,
  type StickerKey,
} from "@/lib/calendarChecks";

export const CAL2_KEY = ["153cal2"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

/** 보이는 날짜(달력 한 화면)의 체크 · 한 줄 · 스티커 + 나만의 체크 — 승인 전 계정 · 함수 없음이면 꺼짐 */
export function useMyCalendar(from: string | null, to: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<CalState>({
    queryKey: [...CAL2_KEY, user?.id ?? "anon", from, to],
    enabled: enabled && !!user?.id && !!from && !!to,
    staleTime: 60_000,
    retry: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_calendar", { p_from: from, p_to: to });
      if (error) return CAL_OFF;
      return normalizeCalendar(data);
    },
  });
}

/** 같은 사람의 달력 캐시를 모두 고친다 (보이는 범위가 여러 개일 수 있어서) */
function patchAll(qc: ReturnType<typeof useQueryClient>, fn: (s: CalState) => CalState) {
  for (const [key, val] of qc.getQueriesData<CalState>({ queryKey: CAL2_KEY })) {
    if (val?.on) qc.setQueryData(key, fn(val));
  }
}

/** 나만의 체크 했어요 · 취소 — 누르는 순간 바로 보이고, 실패하면 되돌린다 */
export function useSetCheckDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { day: string; itemId: string; done: boolean }) => {
      const { error } = await rpc("set_my_check_done", { p_day: v.day, p_item: v.itemId, p_done: v.done });
      if (error) throw new Error(translateError(error, "체크를 저장하지 못했어요"));
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: CAL2_KEY });
      const snapshot = qc.getQueriesData<CalState>({ queryKey: CAL2_KEY });
      patchAll(qc, (s) => applyDone(s, v.day, v.itemId, v.done));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
  });
}

/** 그날 기분 스티커 (null = 빼기) */
export function useSetDaySticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { day: string; sticker: StickerKey | null }) => {
      const { error } = await rpc("set_my_day_sticker", { p_day: v.day, p_sticker: v.sticker });
      if (error) throw new Error(translateError(error, "스티커를 저장하지 못했어요"));
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: CAL2_KEY });
      const snapshot = qc.getQueriesData<CalState>({ queryKey: CAL2_KEY });
      patchAll(qc, (s) => applySticker(s, v.day, v.sticker));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
  });
}

/** 나만의 체크 만들기 · 고치기 (3개까지) */
export function useSaveCheckItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { draft: CheckItemDraft; id?: string | null }) => {
      const { error } = await rpc("set_my_check_item", checkItemPayload(v.draft, v.id));
      if (error) throw new Error(translateError(error, "체크를 저장하지 못했어요"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
  });
}

/** 나만의 체크 빼기 (지난 날 기록은 그대로) */
export function useRemoveCheckItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("remove_my_check_item", { p_id: id });
      if (error) throw new Error(translateError(error, "체크를 빼지 못했어요"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
  });
}

/** (2-2) 저녁 독려 켜기 · 끄기 — 누르는 순간 바뀌고 실패하면 되돌린다 */
export function useSetCalendarNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await rpc("set_my_calendar_prefs", { p_evening_nudge: on });
      if (error) throw new Error(translateError(error, "알림 설정을 저장하지 못했어요"));
    },
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: CAL2_KEY });
      const snapshot = qc.getQueriesData<CalState>({ queryKey: CAL2_KEY });
      patchAll(qc, (s) => ({ ...s, nudge: { ...s.nudge, on } }));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
  });
}
