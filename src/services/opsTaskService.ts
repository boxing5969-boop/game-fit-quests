/**
 * 153운영본부 · 「일정」 탭 「할 일」 — 서버 함수 감싸기 (캘린더 3-4단계 · 2026-11-14)
 *   11/08 DB 20261108230818_ops_tasks.sql: ops_tasks_day · ops_task_board · ops_task_save · ops_task_set_status ·
 *   ops_task_remove · ops_task_reply · ops_duty_check · ops_task_pref_set
 *   3-4 20261114005029_calendar_stage34.sql: ops_tasks_day 에 assigned(맡긴 일) · team(맡길 수 있는 팀) · 알림은 조용한 시간 · 할 일 보기 링크.
 *   함수가 없는 DB(적용 전 · 미리보기 옛 DB)면 available=false — 「할 일」 보기 · 달력 마감 점을 숨긴다.
 *   계산 · 글은 src/lib/opsTasks.ts — 여기는 읽고 쓰기만. 캐시 키 ["ops", "tasks", …].
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  TASKS_OFF,
  TASK_GUIDE_VERSION,
  normalizeBoard,
  normalizeTasksDay,
  type TaskBoard,
  type TaskStatus,
  type TasksDay,
} from "@/lib/opsTasks";
import { OPS_KEY } from "@/services/opsService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
const isMissingFn = (e: RpcError) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));
/** 할 일을 쓸 수 없는 계정(코치진 · 근무자 카드가 없는 분) — 보기를 숨긴다 */
const isNotStaff = (e: RpcError) => !!e && /할 일은 코치님/.test(e.message ?? "");

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

export const TASK_KEY = [...OPS_KEY, "tasks"] as const;

/** 그날 내 할 일 · 고정 업무 · 기본 목록 · (관리자) 맡긴 일 · 팀 */
export const useOpsTasksDay = (branch: string | null, date: string | null, enabled = true) =>
  useQuery<TasksDay>({
    queryKey: [...TASK_KEY, "day", branch ?? "", date ?? ""],
    enabled: enabled && !!branch,
    staleTime: 20_000,
    refetchInterval: 120_000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await rpc("ops_tasks_day", { p_branch: branch, p_date: date });
      if (error) {
        if (isMissingFn(error) || isNotStaff(error)) return TASKS_OFF;
        throw new Error(translateError(error, "할 일을 불러오지 못했어요"));
      }
      return normalizeTasksDay(data);
    },
  });

/** 지점 관리자 — 이번 주 팀 숫자 (월요일부터) */
export const useOpsTaskBoard = (branch: string | null, from: string, enabled: boolean) =>
  useQuery<TaskBoard | null>({
    queryKey: [...TASK_KEY, "board", branch ?? "", from],
    enabled: enabled && !!branch,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("ops_task_board", { p_branch: branch, p_from: from });
      if (error) {
        if (isMissingFn(error)) return null;
        throw new Error(translateError(error, "팀 할 일을 불러오지 못했어요"));
      }
      return normalizeBoard(data);
    },
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: TASK_KEY });
};

/** 그날 캐시들을 고친다 (누르는 순간 바뀌어 보이게) */
function patchDays(qc: ReturnType<typeof useQueryClient>, fn: (d: TasksDay) => TasksDay) {
  for (const [key, val] of qc.getQueriesData<TasksDay>({ queryKey: [...TASK_KEY, "day"] })) {
    if (val?.available) qc.setQueryData(key, fn(val));
  }
}

/** 넣기 · 고치기 · 맡기기 — 답 = 할 일 id */
export const useOpsTaskSave = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Record<string, unknown>) => call<string>("ops_task_save", { p }, "할 일을 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 상태 바꾸기 — 파랑 → 노랑 → 회색 (실패하면 되돌림) */
export const useOpsTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) => call<void>("ops_task_set_status", { p_id: v.id, p_status: v.status }, "상태를 바꾸지 못했어요"),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: TASK_KEY });
      const snapshot = qc.getQueriesData<TasksDay>({ queryKey: [...TASK_KEY, "day"] });
      const at = new Date().toISOString();
      patchDays(qc, (d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === v.id ? { ...t, status: v.status, done_at: v.status === "done" ? at : null } : t)),
        assigned: d.assigned.map((t) => (t.id === v.id ? { ...t, status: v.status, done_at: v.status === "done" ? at : null } : t)),
      }));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASK_KEY }),
  });
};

export const useOpsTaskRemove = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("ops_task_remove", { p_id: id }, "지우지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 받은 분의 답장 (맡긴 분께 알림) */
export const useOpsTaskReply = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; text: string }) => call<void>("ops_task_reply", { p_id: v.id, p_text: v.text }, "답장을 보내지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 고정 업무 체크 · 풀기 (실패하면 되돌림) */
export const useOpsDutyCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; date: string; on: boolean }) =>
      call<void>("ops_duty_check", { p_preset: v.id, p_date: v.date, p_on: v.on }, "체크하지 못했어요"),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: TASK_KEY });
      const snapshot = qc.getQueriesData<TasksDay>({ queryKey: [...TASK_KEY, "day"] });
      patchDays(qc, (d) =>
        d.date === v.date ? { ...d, duties: d.duties.map((x) => (x.id === v.id ? { ...x, checked: v.on, checked_at: v.on ? new Date().toISOString() : null } : x)) } : d,
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, val] of ctx?.snapshot ?? []) qc.setQueryData(key, val);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASK_KEY }),
  });
};

/** 처음 3장 안내 「읽었어요」 */
export const useOpsTaskGuideRead = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => call<void>("ops_task_pref_set", { p: { manual_version: TASK_GUIDE_VERSION } }, "저장하지 못했어요"),
    onSuccess: invalidate,
  });
};
