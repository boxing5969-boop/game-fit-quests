/**
 * 📅 운동 달력 2-2단계 — 153운영본부 「일정」 탭 '회원 달력' 153 일정 (DB 20261113001417_calendar_stage22.sql)
 *   ops_cal_events · ops_cal_event_save · ops_cal_event_remove
 *   서버 함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 카드를 그리지 않는다.
 *   저장 · 빼기 뒤에는 회원 달력 캐시("153cal2")도 다시 읽는다(운영진도 자기 운동 달력을 본다). 글 · 검사는 src/lib/calendarEvents.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { OPS_CAL_OFF, eventPayload, normalizeOpsCal, type EventDraft, type OpsCalState } from "@/lib/calendarEvents";
import { CAL2_KEY } from "@/services/calendarCheckService";

export const OPS_CAL_KEY = ["153opscal"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

/** 그 지점 회원 달력 153 일정 — 그 지점 지도진 · 대표님만 (그 밖은 꺼짐) */
export function useOpsCalEvents(branch: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery<OpsCalState>({
    queryKey: [...OPS_CAL_KEY, branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    retry: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await rpc("ops_cal_events", { p_branch: branch ?? null });
      if (error) return OPS_CAL_OFF;
      return normalizeOpsCal(data);
    },
  });
}

const refresh = (qc: ReturnType<typeof useQueryClient>, branch: string | null, next: OpsCalState) => {
  for (const [key] of qc.getQueriesData<OpsCalState>({ queryKey: OPS_CAL_KEY })) {
    if (key[1] === branch || key[1] === next.branch) qc.setQueryData(key, next);
  }
  void qc.invalidateQueries({ queryKey: OPS_CAL_KEY });
  void qc.invalidateQueries({ queryKey: CAL2_KEY });
};

/** 회원 달력에 올리기 · 고치기 */
export function useSaveOpsCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { draft: EventDraft; branch: string | null; id?: string | null }): Promise<OpsCalState> => {
      const { data, error } = await rpc("ops_cal_event_save", eventPayload(v.draft, v.branch, v.id));
      if (error) throw new Error(translateError(error, "회원 달력에 올리지 못했어요"));
      return normalizeOpsCal(data);
    },
    onSuccess: (next, v) => refresh(qc, v.branch, next),
  });
}

/** 회원 달력에서 빼기 (지우지 않고 removed_at — 아직 안 간 알림도 안 감) */
export function useRemoveOpsCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; branch: string | null }): Promise<OpsCalState> => {
      const { data, error } = await rpc("ops_cal_event_remove", { p_id: v.id });
      if (error) throw new Error(translateError(error, "회원 달력에서 빼지 못했어요"));
      return normalizeOpsCal(data);
    },
    onSuccess: (next, v) => refresh(qc, v.branch, next),
  });
}
