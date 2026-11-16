/**
 * 🛍 153 마켓 — 「우리 지점 마켓이 켜져 있나」만 가볍게 (전체 메뉴 · 기능 검색이 쓴다)
 *
 *   서버 market_on() = market_home 의 on (켠 지점의 승인된 회원 + 상품이 있거나 코치진 · 대표님 미리 보기).
 *   마켓 화면의 조각(lib/market153 · 예시 자료)을 첫 화면 묶음에 싣지 않으려고 따로 둔다 — 여기서는 그 파일들을 가져오지 않는다.
 *   서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 꺼진 것으로.
 *   예시 화면: 주소에 `?demo=1` 이 한 번 있었으면(마켓 화면 · 운영진 주문함) 이 창(탭)을 닫을 때까지 켜진 것으로 · `?demo=0` 으로 끔.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEMO_KEY = "153market:demo";

/** 예시 모드 — 주소에 ?demo=1 이 한 번이라도 있었으면 이 창(탭)을 닫을 때까지 */
export function isMarketDemo(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const q = params.get("demo");
  // 마켓 화면(회원 · 운영진 주문함)에서 본 demo 만 기억한다 — 다른 화면의 ?demo=1 과 섞이지 않게
  const here = /^\/market(\/|$)/.test(window.location.pathname) || params.get("tab") === "market";
  try {
    if (here && q === "1") window.sessionStorage.setItem(DEMO_KEY, "1");
    if (here && q === "0") window.sessionStorage.removeItem(DEMO_KEY);
    return window.sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return here && q === "1";
  }
}

export const MARKET_ON_KEY = ["153market", "on"] as const;

/** 우리 지점 마켓이 켜져 있나 — 전체 메뉴 「153 마켓」 칸 · 검색에 보일지 (못 읽으면 꺼진 것으로) */
export const useMarketOn = (): boolean => {
  const { user } = useAuth();
  const demo = isMarketDemo();
  const q = useQuery({
    queryKey: [...MARKET_ON_KEY, demo ? "demo" : (user?.id ?? "anon")],
    enabled: demo || !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<boolean> => {
      if (demo) return true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("market_on");
      return !error && data === true;
    },
  });
  return q.data === true;
};
