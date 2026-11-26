/**
 * 📊 오삼코치 관장 모드 — 「이 계정이 관장 모드를 쓰나 · 오늘 몇 번 남았나」 (2026-11-27 관장님 앱 ③ · docs/features/69)
 *   서버 owner_ai_scope() — 본사(super_admin · admin)는 켠 지점(내 지점 먼저) · 지점장은 자기 지점(켠 지점일 때)만. 코치 · 회원은 꺼짐.
 *   앱 권한이 지점장 이상인 분만 묻는다(회원 · 코치님은 서버에 묻지도 않는다). 서버에 함수가 없으면(옛 DB) 꺼진 것으로.
 *   오삼코치 창(ChatAssistant)과 관장님 숫자 칸(OwnerKpiCard)이 같은 열쇠로 나눠 쓴다.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeOwnerAiScope, OWNER_AI_OFF, type OwnerAiScope } from "@/lib/ownerAsk";

export const OWNER_AI_SCOPE_KEY = ["owner-ai", "scope"] as const;

const LEADER_ROLES = new Set(["branch_manager", "super_admin", "admin"]);

/** 관장 모드 범위 — enabled 가 꺼져 있거나 지점장 미만이면 묻지 않고 꺼짐 */
export const useOwnerAiScope = (enabled = true) => {
  const { user, role } = useAuth();
  const allowed = enabled && !!user && !!role && LEADER_ROLES.has(role);
  return useQuery({
    queryKey: [...OWNER_AI_SCOPE_KEY, user?.id ?? "anon"],
    enabled: allowed,
    staleTime: 2 * 60_000,
    retry: false,
    queryFn: async (): Promise<OwnerAiScope> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("owner_ai_scope", { p_branch: null });
      if (error) return OWNER_AI_OFF;
      return normalizeOwnerAiScope(data);
    },
  });
};

/** 질문 하나가 끝나면 남은 횟수를 다시 읽는다 */
export const useRefreshOwnerAiScope = () => {
  const qc = useQueryClient();
  return useCallback(() => void qc.invalidateQueries({ queryKey: OWNER_AI_SCOPE_KEY }), [qc]);
};
