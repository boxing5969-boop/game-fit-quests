/**
 * 🧭 관장님 리드 가이드 · 관장님 이해 카드 — 훅 (["coach153", "lead", …] — 153 기준 캐시와 같이 새로 읽힌다)
 *   서버: coach_lead_state · coach_lead_share_set · 오삼코치 Edge Function coach-lead(team · pair)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { CoachLeadState, LeadGuide, LeaderCard } from "@/lib/coachLead";
import { COACH153_KEY } from "@/services/coachGrowthService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

export const useCoachLeadState = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...COACH153_KEY, "lead", branch],
    enabled,
    staleTime: 20_000,
    retry: 1,
    queryFn: async (): Promise<CoachLeadState> => {
      const { data, error } = await rpc("coach_lead_state", { p_branch: branch });
      // 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 조용히 숨긴다
      if (error) {
        if (error.code === "PGRST202" || /coach_lead_state/.test(error.message ?? "")) return { staff: false };
        throw new Error(translateError(error, "리드 가이드를 불러오지 못했어요"));
      }
      return (data ?? { staff: false }) as CoachLeadState;
    },
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COACH153_KEY });
};

export const useLeadShare = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async (v: { lead?: boolean; team?: boolean }) => {
      const { data, error } = await rpc("coach_lead_share_set", { p_lead: v.lead ?? null, p_team: v.team ?? null });
      if (error) throw new Error(translateError(error, "바꾸지 못했어요"));
      return data as { share_lead: boolean; share_team: boolean };
    },
    onSuccess: done,
  });
};

async function lead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("coach-lead", { body });
  if (error) throw new Error("오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요");
  const d = (data ?? {}) as { ok?: boolean; error?: string } & T;
  if (!d.ok) throw new Error(d.error || "오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요");
  return d;
}

export const useMakeTeamCard = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (branch: string | null) => lead<{ card: LeaderCard; stale?: boolean }>({ action: "team", branch }),
    onSettled: done,
  });
};

export const useMakeLeadGuide = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { coach: string; branch: string | null }) => lead<{ guide: LeadGuide }>({ action: "pair", coach_id: v.coach, branch: v.branch }),
    onSettled: done,
  });
};
