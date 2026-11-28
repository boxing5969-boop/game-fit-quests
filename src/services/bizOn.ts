/**
 * 사업자 가계부 — 「쓸 수 있나」만 가볍게 (전체 메뉴 칸 · 운영본부 매출 탭이 쓴다 · 2026-11-28 · 문서 73)
 *
 *   서버 biz_home — 대표님 · 회계매니저만 답한다(그 밖은 거절 → 꺼진 것으로). 함수가 없어도(옛 DB 미리보기) 꺼진 것으로.
 *   순이익 연결을 켠 사업자의 지점 → 사업자 id 도 함께(순이익 카드의 '가계부 보기').
 *   화면 조각 · 계산(lib/bizLedger)을 첫 화면 묶음에 싣지 않으려고 따로 둔다.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const BIZ_ACCESS_KEY = ["biz", "access"] as const;

export const useBizAccess = (enabled: boolean) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...BIZ_ACCESS_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user,
    staleTime: 300_000,
    retry: false,
    queryFn: async (): Promise<{ on: boolean; linked: Record<string, string> }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("biz_home", { p_month: null });
      if (error || !data) return { on: false, linked: {} };
      const books = (data as { books?: unknown }).books;
      const linked: Record<string, string> = {};
      if (Array.isArray(books)) {
        for (const b of books as Array<Record<string, unknown>>) {
          if (b.costs_live === true && typeof b.branch === "string") linked[b.branch] = String(b.id);
        }
      }
      return { on: true, linked };
    },
  });
};

/** 전체 메뉴 「사업자 가계부」 칸 — 쓸 수 있을 때만 */
export const useBizOn = (enabled: boolean): boolean => useBizAccess(enabled).data?.on === true;
