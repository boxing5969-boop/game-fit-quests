/**
 * 🧠 마음 능력치 — 훅 · 뮤테이션 (캐시 "153mind" — 다른 도메인과 겹치지 않게)
 *   서버: mind_state · mind_consent · mind_check_save · mind_clear · mind_remind_set (supabase/migrations/20261114105414_mind_checks.sql)
 *   서버에 함수가 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) null → 카드는 예시(?demo=1)만 보인다.
 *   모든 뮤테이션은 서버가 돌려준 상태로 캐시를 바로 바꾼다(저장 직후 결과 화면이 같은 숫자를 쓴다).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { normalizeMindState, type MindState } from "@/lib/mind153";

export const MIND_KEY = ["153mind"] as const;

interface RpcError {
  code?: string;
  message?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: RpcError | null }>;

export const isMissingMindFn = (e: RpcError | null | undefined) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

async function call(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<unknown> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data;
}

/** 내 마음 체크 상태 — 함수가 없는 DB 면 null */
export function useMindState(enabled = true) {
  const { user } = useAuth();
  return useQuery<MindState | null>({
    queryKey: [...MIND_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await rpc("mind_state");
      if (error) {
        if (isMissingMindFn(error)) return null;
        throw new Error(translateError(error, "마음 능력치를 불러오지 못했어요"));
      }
      return normalizeMindState(data);
    },
  });
}

const useSetState = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return (s: MindState) => qc.setQueryData<MindState | null>([...MIND_KEY, user?.id ?? "anon"], s);
};

/** 동의 — 만 14세 확인과 함께 (끄기는 useClearMind) */
export function useMindConsent() {
  const setState = useSetState();
  return useMutation<MindState, Error, { adult: boolean }>({
    mutationFn: async ({ adult }) =>
      normalizeMindState(await call("mind_consent", { p_on: true, p_adult: adult }, "동의를 저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요")),
    onSuccess: (s) => setState(s),
  });
}

export interface MindSaveResult {
  replaced: boolean;
  conf: number;
  vital: number;
  habit: number;
  state: MindState;
}

/** 저장 — 답은 척도 원래 번호 그대로 (점수는 서버가 센다) */
export function useSaveMindCheck() {
  const setState = useSetState();
  return useMutation<MindSaveResult, Error, { conf: number[]; vital: number[]; habit: number[] }>({
    mutationFn: async (v) => {
      const d = (await call("mind_check_save", { p_conf: v.conf, p_vital: v.vital, p_habit: v.habit }, "저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요")) as Record<
        string,
        unknown
      >;
      return {
        replaced: d.replaced === true,
        conf: Number(d.conf),
        vital: Number(d.vital),
        habit: Number(d.habit),
        state: normalizeMindState(d.state),
      };
    },
    onSuccess: (r) => setState(r.state),
  });
}

/** 지우기 — 답 · 점수를 비우고 동의도 거둔다 */
export function useClearMind() {
  const setState = useSetState();
  return useMutation<MindState, Error, void>({
    mutationFn: async () => {
      const d = (await call("mind_clear", undefined, "지우지 못했어요 — 잠시 뒤 다시 눌러 주세요")) as Record<string, unknown>;
      return normalizeMindState(d.state);
    },
    onSuccess: (s) => setState(s),
  });
}

/** 4주 알림 켜고 끄기 */
export function useMindRemind() {
  const setState = useSetState();
  return useMutation<MindState, Error, boolean>({
    mutationFn: async (on) => normalizeMindState(await call("mind_remind_set", { p_on: on }, "알림 설정을 저장하지 못했어요")),
    onSuccess: (s) => setState(s),
  });
}
