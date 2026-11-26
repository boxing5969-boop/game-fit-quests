/**
 * 📇 153OS CRM — 「CRM 을 볼 수 있나」만 가볍게 (전체 메뉴 · 153운영본부 탭이 쓴다 · 2026-11-27 관장님 앱 ②)
 *
 *   서버 crm_scope() — 본사(super_admin · admin)는 CRM 켠 지점 모두 · 지점장은 자기 지점(켠 지점일 때)만. 코치 · 회원은 꺼짐.
 *   화면 조각(lib/crm153 · 예시 자료)을 첫 화면 묶음에 싣지 않으려고 따로 둔다 — 여기서는 그 파일을 가져오지 않는다.
 *   서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 꺼진 것으로.
 *   예시 화면: /office?tab=crm&demo=1 — 서버를 부르지 않고 지어낸 자료(코치진 계정으로 들어왔을 때 · 미리보기 확인용).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CrmScopeLite {
  on: boolean;
  role: "admin" | "manager" | "none";
  branch: string | null;
  branches: string[];
}

export const CRM_SCOPE_KEY = ["crm", "scope"] as const;

/** 예시 모드 — 153운영본부 CRM 탭 주소에 ?demo=1 이 있을 때만 */
export function isCrmDemo(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  return /^\/office\/?$/.test(window.location.pathname) && p.get("tab") === "crm" && p.get("demo") === "1";
}

const DEMO_SCOPE: CrmScopeLite = { on: true, role: "admin", branch: "153복싱짐 선릉역점", branches: ["153복싱짐 선릉역점"] };
const OFF: CrmScopeLite = { on: false, role: "none", branch: null, branches: [] };

/** CRM 범위 — enabled 는 관장 · 지점장 · 본사로 보이는 분만(회원 · 코치님은 서버에 묻지도 않는다) */
export const useCrmScope = (enabled: boolean) => {
  const { user } = useAuth();
  const demo = isCrmDemo();
  return useQuery({
    queryKey: [...CRM_SCOPE_KEY, demo ? "demo" : (user?.id ?? "anon")],
    enabled: demo || (enabled && !!user),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<CrmScopeLite> => {
      if (demo) return DEMO_SCOPE;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("crm_scope", { p_branch: null });
      const d = (data ?? {}) as { on?: unknown; role?: unknown; branch?: unknown; branches?: unknown };
      if (error || d.on !== true || typeof d.branch !== "string") return OFF;
      return {
        on: true,
        role: d.role === "admin" ? "admin" : "manager",
        branch: d.branch,
        branches: Array.isArray(d.branches) ? d.branches.map(String) : [d.branch],
      };
    },
  });
};

/** 전체 메뉴 「153OS CRM」 칸 — 볼 수 있을 때만 */
export const useCrmOn = (enabled: boolean): boolean => useCrmScope(enabled).data?.on === true;
