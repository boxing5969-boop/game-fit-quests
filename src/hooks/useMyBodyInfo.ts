/**
 * ⚖️ 내 신체 · 운동 정보 (키 · 몸무게 · 한 번 복싱 시간) — 본인이 넣고 고친다 (관리자 · 지점장은 회원 내정보에서 읽기만)
 *   (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자" · "운동 시간 평균도 입력할 수 있게, 기준은 60분")
 *   서버: get_my_body_info · save_my_fitness_info
 *     (supabase/migrations/20261021225716_member_body_logs.sql · 20261021233204_member_session_minutes.sql)
 *   지우기는 본인 줄만 지울 수 있는 RLS 로 바로 지운다. 캐시 키 "153body" — 다른 도메인과 겹치지 않게.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBodyInfo, type BodyInfo } from "@/lib/achievement153";
import { normalizeFitnessExtra, type FitnessExtra, type Gender } from "@/lib/fitnessProfile153";
import type { FitnessProfile, MeasureKind } from "@/lib/test153Profile";
import { fetchFitnessProfile, saveFitnessMeasure } from "@/services/test153Service";

export const BODY_INFO_KEY = ["153body", "me"] as const;
/** 성별 · 출생 연도 · 체지방률 (2026-10-22) — 같은 "153body" 접두어라 지우기 · 새로 읽기가 같이 된다 */
export const FITNESS_EXTRA_KEY = ["153body", "extra"] as const;
/** 153 체력 프로필 (2026-10-25) — 153 PB 기록 · 악력 · 허리둘레 · 안정시 심박 */
export const FITNESS_PROFILE_KEY = ["153body", "pb-profile"] as const;

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

/**
 * 관리자 · 같은 지점 지점장이 회원 내정보를 볼 때 — 회원이 넣은 키 · 몸무게 · 복싱 시간 (2026-10-22 대표님: "안내 문구를 아예 넣지 말자")
 *   서버: get_member_body_info (supabase/migrations/20261022013219_member_body_info_staff.sql)
 *   '나만 볼 수 있어요' 안내를 보고 넣은 값은 서버가 빼고 준다.
 */
export function useMemberBodyInfo(userId: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery<BodyInfo>({
    queryKey: ["153body", "member", userId ?? "none", user?.id ?? "anon"],
    enabled: enabled && !!userId && !!user?.id,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_member_body_info", { p_user_id: userId });
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

/**
 * 내 성별 · 출생 연도 · 체지방률 (2026-10-22 대표님: "고객 데이터를 상세하게 기록할수록 정확도는 올라간다")
 *   서버: get_my_fitness_extra · save_my_fitness_extra (supabase/migrations/20261022103930_member_fitness_extra.sql)
 *   성별 · 출생 연도는 내가 넣은 값 → 없으면 지점 등록 정보(profiles)를 읽기만 한다.
 */
export function useMyFitnessExtra(enabled = true) {
  const { user } = useAuth();
  return useQuery<FitnessExtra>({
    queryKey: [...FITNESS_EXTRA_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_my_fitness_extra");
      if (error) throw error;
      return normalizeFitnessExtra(data);
    },
  });
}

export function useSaveFitnessExtra() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<FitnessExtra, unknown, { gender: Gender | null; birthYear: number | null; bodyFatPct: number | null }>({
    mutationFn: async ({ gender, birthYear, bodyFatPct }) => {
      const { data, error } = await sb.rpc("save_my_fitness_extra", {
        p_gender: gender,
        p_birth_year: birthYear,
        p_body_fat_pct: bodyFatPct,
      });
      if (error) throw error;
      return normalizeFitnessExtra(data);
    },
    onSuccess: (extra) => {
      qc.setQueryData([...FITNESS_EXTRA_KEY, user?.id ?? "anon"], extra);
    },
  });
}

/**
 * 153 체력 프로필 (2026-10-25 · 1단계 '내 체력 보기') — 내 신체 정보 시트 맨 위 카드
 *   서버: get_my_fitness_profile (supabase/migrations/20261025130557_fitness_profile_153.sql)
 *   공식 기록은 코치님이 재서 넣는다 — 회원은 읽기만 (허리둘레 · 안정시 심박만 본인이 넣는다)
 */
export function useMyFitnessProfile(enabled = true) {
  const { user } = useAuth();
  return useQuery<FitnessProfile>({
    queryKey: [...FITNESS_PROFILE_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchFitnessProfile(null),
  });
}

/** 내 허리둘레 · 안정시 심박 저장 — 바꾼 칸만 보낸다 (오늘 날짜 한 줄, 같은 날 다시 넣으면 고친다) */
export function useSaveMyMeasures() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, unknown, Partial<Record<MeasureKind, number>>>({
    mutationFn: async (values) => {
      for (const [kind, value] of Object.entries(values) as [MeasureKind, number | undefined][]) {
        if (value != null) await saveFitnessMeasure(null, kind, value);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...FITNESS_PROFILE_KEY, user?.id ?? "anon"] });
    },
  });
}

/** 내 신체 · 운동 정보 전부 지우기 (키 · 몸무게 기록 + 운동 시간 + 성별 · 출생 연도 · 체지방률 + 악력 · 허리둘레 · 안정시 심박) */
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
      const { error: e3 } = await sb.from("member_body_fat_logs").delete().eq("user_id", user.id);
      if (e3) throw e3;
      const { error: e4 } = await sb.from("member_fitness_profile").delete().eq("user_id", user.id);
      if (e4) throw e4;
      // 153 PB 공식 기록은 그대로 둔다 (코치님이 잰 기록 · 순위) — 악력 · 허리둘레 · 안정시 심박만 지운다
      const { error: e5 } = await sb.from("member_fitness_measures").delete().eq("user_id", user.id);
      if (e5) throw e5;
    },
    // 하나만 지워지고 실패해도 화면은 서버 값으로 다시 읽는다
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...BODY_INFO_KEY, user?.id ?? "anon"] });
      void qc.invalidateQueries({ queryKey: [...FITNESS_EXTRA_KEY, user?.id ?? "anon"] });
      void qc.invalidateQueries({ queryKey: [...FITNESS_PROFILE_KEY, user?.id ?? "anon"] });
    },
  });
}
