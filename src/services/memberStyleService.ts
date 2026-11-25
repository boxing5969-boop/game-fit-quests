/**
 * 🧭 153 성향 검사 — 서버 부르기 (DB member_style_* · Edge Function member-style)
 *   함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 available=false → 화면은 아무것도 그리지 않는다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CoachCard, StyleAnswers, StyleScores } from "../../supabase/functions/_shared/memberStyle.ts";

export interface StyleProfile {
  answers: StyleAnswers | null;
  scores: StyleScores | null;
  card: CoachCard | null;
  card_at: string | null;
  consent_at: string | null;
  updated_at: string | null;
}

export interface StyleMe {
  available: boolean;
  on: boolean;
  profile: StyleProfile | null;
}

const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args ?? {});
const missingFn = (e: any) => e?.code === "PGRST202" || /Could not find the function/i.test(e?.message ?? "");

export function useMemberStyleMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["153style", "me", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<StyleMe> => {
      const { data, error } = await rpc("member_style_me");
      if (error) {
        if (missingFn(error)) return { available: false, on: false, profile: null };
        throw error;
      }
      return { available: true, on: !!data?.on, profile: (data?.profile ?? null) as StyleProfile | null };
    },
  });
}

/** 오삼코치 카드 만들기 — 본인(userId 없음) 또는 지도진이 회원 카드 */
export async function makeStyleCard(userId?: string): Promise<{ ok: boolean; error?: string; card?: CoachCard }> {
  const { data, error } = await supabase.functions.invoke("member-style", { body: userId ? { user_id: userId } : {} });
  if (error) return { ok: false, error: "인터넷 연결을 확인하고 다시 눌러 주세요" };
  return data ?? { ok: false, error: "잠시 뒤 다시 눌러 주세요" };
}

export function useSaveMemberStyle() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (answers: StyleAnswers): Promise<{ reward: number }> => {
      const { data, error } = await rpc("member_style_save", { p_answers: answers });
      if (error) throw new Error(error.message || "저장하지 못했어요");
      return { reward: Number(data?.reward ?? 0) };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["153style", "me", user?.id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useClearMemberStyle() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await rpc("member_style_clear");
      if (error) throw new Error(error.message || "지우지 못했어요");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["153style", "me", user?.id] }),
  });
}

export function useMemberStyleForCoach(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["153style", "coach", userId],
    enabled: !!userId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<{ ok: boolean; profile: StyleProfile | null }> => {
      const { data, error } = await rpc("member_style_for_coach", { p_user: userId });
      if (error) return { ok: false, profile: null };
      return { ok: !!data?.ok, profile: (data?.profile ?? null) as StyleProfile | null };
    },
  });
}
