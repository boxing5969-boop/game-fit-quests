/**
 * ✅ 운동 달력 2-1단계 — 서버 함수 감싸기 (DB 20261112211833_calendar_checks_stage21.sql)
 *   get_my_calendar · set_my_check_item · remove_my_check_item · set_my_check_done · set_my_day_sticker
 *   서버 함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 달력은 지금 그대로(운동 약속과 같은 결).
 *   캐시 키는 "153cal2" 로 시작 — 한 줄 쓰기 · 응원 보내기를 마치면 이 키를 다시 읽는다. 계산 · 글은 src/lib/calendarChecks.ts.
 *   (2-2 · DB 20261113001417_calendar_stage22.sql) get_my_calendar 가 153 일정 · 저요 한 모집 · 저녁 독려도 함께 보낸다 ·
 *   저녁 독려 켜기 · 끄기 = set_my_calendar_prefs (useSetCalendarNudge).
 *   (2-3 · DB 20261113012729_calendar_stage23.sql) get_my_calendar 가 그날 한 일 · 코치 한마디 · 기념일 · 153 D-day 도 함께 보낸다 ·
 *   목표일 정하기 · 빼기 = set_my_goal_day · remove_my_goal_day (useSaveGoalDay · useRemoveGoalDay — 글 · 검사는 lib/calendarMarks.ts).
 *   (2-4 · DB 20261113111423_calendar_stage24.sql) get_my_calendar 가 주간 돌아보기 알림(recap) · 운동 짝꿍(partner)도 함께 보낸다 ·
 *   일요일 주간 돌아보기 알림 켜기 · 끄기 = set_my_weekly_recap (useSetWeeklyRecap).
 *   (3-4 · DB 20261114005029_calendar_stage34.sql) 주 n번 = set_my_check_goal(체크를 저장한 뒤 한 번 더) ·
 *   나만의 체크 시트의 이번 주 · 이어 간 주 · 할 일 = get_my_habits (useMyHabits — 캐시 키 "153habits", 달력 키와 따로) ·
 *   마감 있는 할 일 = set_my_todo · set_my_todo_done · remove_my_todo (useSaveTodo · useSetTodoDone · useRemoveTodo).
 *   함수가 없는 DB 면 습관은 꺼짐(시트는 예전 그대로) · 주 n번 저장은 '아직 쓸 수 없어요'.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  CAL_OFF,
  applyDone,
  applySticker,
  checkGoalOf,
  checkItemPayload,
  normalizeCalendar,
  type CalState,
  type CheckItemDraft,
  type StickerKey,
} from "@/lib/calendarChecks";
import { HABITS_OFF, applyTodoDone, normalizeHabits, todoPayload, type Habits } from "@/lib/memberHabits";
import { goalPayload, normalizeDdays, type GoalDraft } from "@/lib/calendarMarks";

export const CAL2_KEY = ["153cal2"] as const;
/** (3-4) 나만의 체크 시트 — 이번 주 · 이어 간 주 · 할 일 (달력 캐시와 모양이 달라 따로) */
export const HABITS_KEY = ["153habits"] as const;

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

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
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CAL2_KEY });
      void qc.invalidateQueries({ queryKey: HABITS_KEY });
    },
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

/**
 * 나만의 체크 만들기 · 고치기 (3개까지) — (3-4) 저장한 뒤 주 n번을 맞춘다(set_my_check_goal).
 *   새로 만들 때는 저장 전 목록(prevIds)에 없던 항목이 새 항목. 주 n번 · 매일이면 요일은 비워서 보낸다(lib checkItemPayload).
 *   예전 항목에 주 n번이 없었고 지금도 아니면(hadGoal=false) 두 번째 부름은 하지 않는다.
 */
export function useSaveCheckItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { draft: CheckItemDraft; id?: string | null; prevIds?: readonly string[]; hadGoal?: boolean }) => {
      const { data, error } = await rpc("set_my_check_item", checkItemPayload(v.draft, v.id));
      if (error) throw new Error(translateError(error, "잠시 뒤 다시 해 주세요"));
      const goal = checkGoalOf(v.draft);
      if (goal == null && !v.hadGoal) return;
      let id = v.id ?? null;
      if (!id) {
        const prev = new Set(v.prevIds ?? []);
        const items = Array.isArray((data as { items?: unknown[] } | null)?.items) ? ((data as { items: Array<{ id?: string }> }).items) : [];
        id = items.map((i) => i.id).find((x): x is string => !!x && !prev.has(x)) ?? null;
      }
      if (!id) return;
      const r = await rpc("set_my_check_goal", { p_id: id, p_goal: goal });
      if (r.error) {
        if (isMissingFn(r.error)) {
          if (goal != null) throw new Error("주 n번은 아직 쓸 수 없어요 — 요일로 정해 주세요");
          return;
        }
        throw new Error(translateError(r.error, "잠시 뒤 다시 해 주세요"));
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CAL2_KEY });
      void qc.invalidateQueries({ queryKey: HABITS_KEY });
    },
  });
}

/** (3-4) 나만의 체크 시트 — 체크마다 이번 주 · 이어 가는 주 · 가장 길게 + 마감 있는 할 일 (함수 없음 · 승인 전 = 꺼짐) */
export function useMyHabits(enabled = true) {
  const { user } = useAuth();
  return useQuery<Habits>({
    queryKey: [...HABITS_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    retry: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_habits");
      if (error) return HABITS_OFF;
      return normalizeHabits(data);
    },
  });
}

const invalidateBoth = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: CAL2_KEY });
  void qc.invalidateQueries({ queryKey: HABITS_KEY });
};

/** (3-4) 할 일 넣기 · 고치기 */
export function useSaveTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { title: string; due: string; id?: string | null }) => {
      const { error } = await rpc("set_my_todo", todoPayload(v.title, v.due, v.id));
      if (error) throw new Error(translateError(error, "잠시 뒤 다시 해 주세요"));
    },
    onSettled: () => invalidateBoth(qc),
  });
}

/** (3-4) 할 일 끝냈어요 · 되돌리기 — 누르는 순간 바뀌고 실패하면 되돌린다 */
export function useSetTodoDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; done: boolean; today: string }) => {
      const { error } = await rpc("set_my_todo_done", { p_id: v.id, p_done: v.done });
      if (error) throw new Error(translateError(error, "잠시 뒤 다시 해 주세요"));
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: HABITS_KEY });
      await qc.cancelQueries({ queryKey: CAL2_KEY });
      const habits = qc.getQueriesData<Habits>({ queryKey: HABITS_KEY });
      const cals = qc.getQueriesData<CalState>({ queryKey: CAL2_KEY });
      for (const [key, val] of habits) if (val?.on) qc.setQueryData(key, applyTodoDone(val, v.id, v.done, v.today));
      patchAll(qc, (s) => ({ ...s, todos: s.todos.map((t) => (t.id === v.id ? { ...t, done: v.done } : t)) }));
      return { habits, cals };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.habits ?? []) qc.setQueryData(key, val);
      for (const [key, val] of ctx?.cals ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => invalidateBoth(qc),
  });
}

/** (3-4) 할 일 빼기 (지우지 않고) */
export function useRemoveTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("remove_my_todo", { p_id: id });
      if (error) throw new Error(translateError(error, "잠시 뒤 다시 해 주세요"));
    },
    onSettled: () => invalidateBoth(qc),
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
    onSuccess: () => invalidateBoth(qc),
  });
}

/** (2-3) 목표일 정하기 · 고치기 (내일부터 2년 안 · 3개까지) — 답 = 새 D-day 목록, 달력 캐시에 바로 넣고 다시 읽는다 */
export function useSaveGoalDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { draft: GoalDraft; id?: string | null }) => {
      const { data, error } = await rpc("set_my_goal_day", goalPayload(v.draft, v.id));
      if (error) throw new Error(translateError(error, "목표일을 저장하지 못했어요"));
      return normalizeDdays(data);
    },
    onSuccess: (ddays) => {
      patchAll(qc, (s) => ({ ...s, ddays }));
      void qc.invalidateQueries({ queryKey: CAL2_KEY });
    },
  });
}

/** (2-3) 목표일 빼기 (지우지 않고) */
export function useRemoveGoalDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await rpc("remove_my_goal_day", { p_id: id });
      if (error) throw new Error(translateError(error, "목표일을 빼지 못했어요"));
      return normalizeDdays(data);
    },
    onSuccess: (ddays) => {
      patchAll(qc, (s) => ({ ...s, ddays }));
      void qc.invalidateQueries({ queryKey: CAL2_KEY });
    },
  });
}

/** (2-4) 일요일 주간 돌아보기 알림 켜기 · 끄기 — 누르는 순간 바뀌고 실패하면 되돌린다 */
export function useSetWeeklyRecap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await rpc("set_my_weekly_recap", { p_on: on });
      if (error) throw new Error(translateError(error, "알림 설정을 저장하지 못했어요"));
    },
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: CAL2_KEY });
      const snapshot = qc.getQueriesData<CalState>({ queryKey: CAL2_KEY });
      patchAll(qc, (s) => ({ ...s, recap: { ...s.recap, on } }));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: CAL2_KEY }),
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
