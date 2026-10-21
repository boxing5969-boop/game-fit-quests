/**
 * ⚖️ 내 신체 · 운동 정보 (키 · 몸무게 · 한 번 운동 시간) — 본인만
 *   (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자" · "운동 시간 평균도 입력할 수 있게, 기준은 60분")
 *   서버: get_my_body_info · save_my_fitness_info
 *     (supabase/migrations/20261021225716_member_body_logs.sql · 20261021233204_member_session_minutes.sql)
 *   지우기는 본인 줄만 지울 수 있는 RLS 로 바로 지운다. 캐시 키 "153body" — 다른 도메인과 겹치지 않게.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBodyInfo, type BodyInfo } from "@/lib/achievement153";

export const BODY_INFO_KEY = ["153body", "me"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useMyBodyInfo(enabled = true) {
  const { user } = useAuth();
  return useQuery<BodyInfo>({
    queryKey: [...BODY_INFO_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_my_body_info");
      if (error) throw error;
      return normalizeBodyInfo(data);
    },
  });
}

export function useSaveBodyInfo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<BodyInfo, unknown, { heightCm: number | null; weightKg: number | null; sessionMinutes: number | null }>({
    mutationFn: async ({ heightCm, weightKg, sessionMinutes }) => {
      const { data, error } = await sb.rpc("save_my_fitness_info", {
        p_height_cm: heightCm,
        p_weight_kg: weightKg,
        p_session_minutes: sessionMinutes,
      });
      if (error) throw error;
      return normalizeBodyInfo(data);
    },
    onSuccess: (info) => {
      qc.setQueryData([...BODY_INFO_KEY, user?.id ?? "anon"], info);
    },
  });
}

/** 내 신체 · 운동 정보 전부 지우기 (키 · 몸무게 기록 + 운동 시간) */
export function useClearBodyInfo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      if (!user?.id) throw new Error("not_authenticated");
      const { error } = await sb.from("member_body_logs").delete().eq("user_id", user.id);
      if (error) throw error;
      const { error: e2 } = await sb.from("member_workout_settings").delete().eq("user_id", user.id);
      if (e2) throw e2;
    },
    // 하나만 지워지고 실패해도 화면은 서버 값으로 다시 읽는다
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...BODY_INFO_KEY, user?.id ?? "anon"] });
    },
  });
}
