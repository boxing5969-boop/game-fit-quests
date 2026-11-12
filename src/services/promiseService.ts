/**
 * 🤝 153 운동 약속 · 코치 「오늘 만날 회원」 — 서버 함수 감싸기 (DB 20261112192617_promise_stage1.sql)
 *   get_my_promise · set_my_promise(_v2 — 2-2단계 알림 시각) · stop_my_promise · ops_meet_today
 *   서버 함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 화면은 지금 그대로(동기부여 1단계와 같은 결).
 *   캐시 키는 "153promise" 로 시작. 글 · 계산은 src/lib/promise153.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import {
  MEET_OFF,
  PROMISE_OFF,
  normalizeMeet,
  normalizePromiseState,
  promisePayload,
  type MeetToday,
  type PromiseDraft,
  type PromiseState,
} from "@/lib/promise153";

export const PROMISE_KEY = ["153promise"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

/** 내 운동 약속 — 켠 지점 회원이 아니면 {on:false} */
export function useMyPromise(enabled = true) {
  const { user } = useAuth();
  return useQuery<PromiseState>({
    queryKey: [...PROMISE_KEY, "me", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_promise");
      if (error) return PROMISE_OFF;
      return normalizePromiseState(data);
    },
  });
}

/** 약속 걸기 · 고치기 (+ 알림 시각 — set_my_promise_v2 · 2-2단계. v2 가 없는 DB 면 예전 함수로 알림 시각 없이) */
export function useSetPromise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: PromiseDraft): Promise<PromiseState> => {
      const payload = promisePayload(d);
      let { data, error } = await rpc("set_my_promise_v2", payload);
      if (error && (error.code === "PGRST202" || error.code === "42883")) {
        const { p_remind: _drop, ...v1 } = payload;
        ({ data, error } = await rpc("set_my_promise", v1));
      }
      if (error) throw new Error(translateError(error, "약속을 저장하지 못했어요"));
      return normalizePromiseState(data);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: PROMISE_KEY }),
  });
}

/** 약속 그만하기 (지우지 않고 멈춤) */
export function useStopPromise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await rpc("stop_my_promise");
      if (error) throw new Error(translateError(error, "약속을 멈추지 못했어요"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: PROMISE_KEY }),
  });
}

/** 코치 「오늘 만날 회원」 — 켠 지점 지도진 · 대표님만 (그 밖은 꺼짐) */
export function useMeetToday(branch: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery<MeetToday>({
    queryKey: [...PROMISE_KEY, "meet", branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("ops_meet_today", { p_branch: branch ?? null });
      if (error) return MEET_OFF;
      return normalizeMeet(data);
    },
  });
}
