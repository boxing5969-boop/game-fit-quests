/**
 * 🛍 153 마켓 1단계 — 서버 함수 감싸기 (DB supabase/migrations/20261117013411_market153.sql)
 *   회원: market_home · market_order_place · market_order_cancel · market_wish_add
 *   운영진: market_admin_board · market_admin_order_set · market_admin_product_save(대표님 · 관리자)
 *   계산 · 글은 src/lib/market153.ts — 여기는 읽고 쓰기만.
 *
 *   서버에 함수가 아직 없으면(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기) 꺼진 것으로 본다(메뉴 칸도 안 보인다).
 *   예시 화면은 서버를 부르지 않는다 — 주소에 `?demo=1` 이 한 번 있었으면 이 창(탭)을 닫을 때까지 · `?demo=0` 으로 끔.
 *     예시 자료(lib/marketSample)는 예시일 때만 따로 받는다.
 *   캐시 열쇠는 "153market" — 다른 도메인과 겹치지 않게.
 *   전체 메뉴 · 검색의 「켜져 있나」는 services/marketOn(가벼운 market_on) — 이 파일을 첫 화면 묶음에 싣지 않는다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { translateError } from "@/lib/errorMessages";
import {
  MARKET_BOARD_OFF,
  MARKET_HOME_OFF,
  normalizeMarketBoard,
  normalizeMarketHome,
  normalizeOrder,
  productPayload,
  todayKst,
  type MarketBoard,
  type MarketHome,
  type MarketOrder,
  type MarketOrderStatus,
  type ProductDraft,
} from "@/lib/market153";
import { MARKET_ON_KEY, isMarketDemo } from "@/services/marketOn";

export { isMarketDemo };
export const MARKET_KEY = ["153market"] as const;

/** 예시 자료 — 예시 화면에서만 받는 조각 */
const sample = () => import("@/lib/marketSample");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
/** 서버에 함수가 없다 — DB 적용 전 · 옛 DB 미리보기 */
const isMissingFn = (e: RpcError) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

interface ServerResult {
  ok?: boolean;
  code?: string;
  message?: string;
  again?: boolean;
  order?: unknown;
  product?: unknown;
}

async function act(name: string, args: Record<string, unknown>, fallback: string): Promise<ServerResult> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(isMissingFn(error) ? "아직 준비 중이에요" : translateError(error, fallback));
  const r = (data ?? {}) as ServerResult;
  if (r.ok !== true) throw new Error(r.message || fallback);
  return r;
}

// ───────────────────────── 회원 ─────────────────────────

const homeKey = (uid: string | null | undefined, demo: boolean) => [...MARKET_KEY, "home", demo ? "demo" : (uid ?? "anon")] as const;

/** 마켓 첫 화면 — 상품 · 내 주문. 전체 메뉴의 「153 마켓」 칸도 이 값(on)으로 보인다 */
export const useMarketHome = (enabled = true) => {
  const { user } = useAuth();
  const demo = isMarketDemo();
  return useQuery({
    queryKey: homeKey(user?.id, demo),
    enabled: demo || (enabled && !!user),
    staleTime: demo ? Infinity : 60_000,
    retry: false,
    queryFn: async (): Promise<MarketHome> => {
      if (demo) return (await sample()).buildMarketHomeSample();
      const { data, error } = await rpc("market_home");
      if (error) {
        if (isMissingFn(error)) return { ...MARKET_HOME_OFF, today: todayKst() };
        throw new Error(translateError(error, "마켓을 불러오지 못했어요"));
      }
      return normalizeMarketHome(data);
    },
  });
};

export interface PlaceInput {
  productId: string;
  option: string | null;
  qty: number;
  note: string;
}

export const useMarketActions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isMarketDemo();
  const key = homeKey(user?.id, demo);
  const patchOrder = (order: MarketOrder | null) => {
    if (!order) return;
    qc.setQueryData<MarketHome>(key, (h) =>
      h ? { ...h, orders: [order, ...h.orders.filter((o) => o.id !== order.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) } : h,
    );
  };
  const refresh = () => {
    if (!demo) void qc.invalidateQueries({ queryKey: key });
  };

  const place = useMutation({
    mutationFn: async (input: PlaceInput): Promise<{ order: MarketOrder | null; again: boolean }> => {
      if (demo) {
        const { applyMarketHomeDemo, buildMarketHomeSample } = await sample();
        const home = qc.getQueryData<MarketHome>(key) ?? buildMarketHomeSample();
        const r = applyMarketHomeDemo(home, { type: "place", ...input });
        if (!r.ok) throw new Error(r.message ?? "주문하지 못했어요");
        qc.setQueryData(key, r.next);
        return { order: r.order ?? null, again: false };
      }
      const r = await act(
        "market_order_place",
        { p_product: input.productId, p_option: input.option, p_qty: input.qty, p_note: input.note || null },
        "주문하지 못했어요",
      );
      return { order: normalizeOrder(r.order), again: r.again === true };
    },
    onSuccess: (r) => {
      if (!demo) patchOrder(r.order);
      refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string): Promise<MarketOrder | null> => {
      if (demo) {
        const { applyMarketHomeDemo, buildMarketHomeSample } = await sample();
        const home = qc.getQueryData<MarketHome>(key) ?? buildMarketHomeSample();
        const r = applyMarketHomeDemo(home, { type: "cancel", id });
        if (!r.ok) throw new Error(r.message ?? "취소하지 못했어요");
        qc.setQueryData(key, r.next);
        return r.order ?? null;
      }
      const r = await act("market_order_cancel", { p_id: id }, "취소하지 못했어요");
      return normalizeOrder(r.order);
    },
    onSuccess: (order) => {
      if (!demo) patchOrder(order);
      refresh();
    },
  });

  const wish = useMutation({
    mutationFn: async (text: string): Promise<void> => {
      if (demo) return;
      await act("market_wish_add", { p_text: text }, "보내지 못했어요");
    },
  });

  return { place, cancel, wish, demo };
};

// ───────────────────────── 운영진 ─────────────────────────

const boardKey = (uid: string | null | undefined, branch: string | null, demo: boolean) =>
  [...MARKET_KEY, "board", demo ? "demo" : (uid ?? "anon"), branch ?? "*"] as const;

/** 주문함 · 상품 · 요청 — 대표님 · 관리자는 지점 고르기(null = 전 지점), 지점 운영진은 자기 지점 */
export const useMarketBoard = (branch: string | null, enabled = true) => {
  const { user } = useAuth();
  const demo = isMarketDemo();
  return useQuery({
    queryKey: boardKey(user?.id, branch, demo),
    enabled: demo || (enabled && !!user),
    staleTime: demo ? Infinity : 20_000,
    refetchInterval: demo ? false : 2 * 60_000,
    retry: false,
    queryFn: async (): Promise<MarketBoard & { available: boolean }> => {
      if (demo) return { ...(await sample()).buildMarketBoardSample(), available: true };
      const { data, error } = await rpc("market_admin_board", { p_branch: branch });
      if (error) {
        if (isMissingFn(error)) return { ...MARKET_BOARD_OFF, today: todayKst(), available: false };
        throw new Error(translateError(error, "주문함을 불러오지 못했어요"));
      }
      return { ...normalizeMarketBoard(data), available: true };
    },
  });
};

export interface OrderSetInput {
  id: string;
  status?: MarketOrderStatus | null;
  memo?: string | null;
  reason?: string | null;
  /** 결제 확인 때 함께 쓸 153 마일리지(1,000점 단위 · 주문 금액의 5%까지) */
  mileage?: number | null;
}

export const useMarketAdminActions = (branch: string | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isMarketDemo();
  const key = boardKey(user?.id, branch, demo);
  type Board = MarketBoard & { available: boolean };

  const setOrder = useMutation({
    mutationFn: async (input: OrderSetInput): Promise<MarketOrder | null> => {
      if (demo) {
        const { applyMarketBoardDemo, buildMarketBoardSample } = await sample();
        const board = qc.getQueryData<Board>(key) ?? { ...buildMarketBoardSample(), available: true };
        const r = applyMarketBoardDemo(board, { type: "order", ...input });
        if (!r.ok) throw new Error(r.message ?? "바꾸지 못했어요");
        qc.setQueryData<Board>(key, { ...r.next, available: true });
        return r.order ?? null;
      }
      const r = await act(
        "market_admin_order_set",
        {
          p_id: input.id,
          p_status: input.status ?? null,
          p_memo: input.memo ?? null,
          p_reason: input.reason ?? null,
          ...(input.mileage && input.mileage > 0 ? { p_mileage: input.mileage } : {}),
        },
        "바꾸지 못했어요",
      );
      return normalizeOrder(r.order);
    },
    onSuccess: (order) => {
      if (demo) return;
      if (order) {
        qc.setQueryData<Board>(key, (b) => (b ? { ...b, orders: b.orders.map((o) => (o.id === order.id ? order : o)) } : b));
      }
      void qc.invalidateQueries({ queryKey: [...MARKET_KEY, "board"] });
    },
  });

  const saveProduct = useMutation({
    mutationFn: async (draft: ProductDraft): Promise<void> => {
      if (demo) {
        const { applyMarketBoardDemo, buildMarketBoardSample } = await sample();
        const board = qc.getQueryData<Board>(key) ?? { ...buildMarketBoardSample(), available: true };
        const r = applyMarketBoardDemo(board, { type: "product", draft });
        if (!r.ok) throw new Error(r.message ?? "저장하지 못했어요");
        qc.setQueryData<Board>(key, { ...r.next, available: true });
        return;
      }
      await act("market_admin_product_save", { p: productPayload(draft) }, "저장하지 못했어요");
    },
    onSuccess: () => {
      if (demo) return;
      void qc.invalidateQueries({ queryKey: [...MARKET_KEY, "board"] });
      void qc.invalidateQueries({ queryKey: [...MARKET_KEY, "home"] });
      void qc.invalidateQueries({ queryKey: MARKET_ON_KEY });
    },
  });

  /** 켜기 · 품절 · 확인한 날처럼 몇 칸만 바꿀 때 */
  const patchProduct = useMutation({
    mutationFn: async (patch: { id: string } & Record<string, unknown>): Promise<void> => {
      if (demo) {
        qc.setQueryData<Board>(key, (b) =>
          b
            ? {
                ...b,
                products: b.products.map((p) =>
                  p.id === patch.id
                    ? {
                        ...p,
                        ...("active" in patch ? { active: patch.active === true } : {}),
                        ...("sold_out" in patch ? { soldOut: patch.sold_out === true } : {}),
                        ...("compare_on" in patch ? { compareOn: String(patch.compare_on) } : {}),
                        ...("list_on" in patch ? { listOn: String(patch.list_on) } : {}),
                      }
                    : p,
                ),
              }
            : b,
        );
        return;
      }
      await act("market_admin_product_save", { p: patch }, "저장하지 못했어요");
    },
    onSuccess: () => {
      if (demo) return;
      void qc.invalidateQueries({ queryKey: [...MARKET_KEY, "board"] });
      void qc.invalidateQueries({ queryKey: [...MARKET_KEY, "home"] });
      void qc.invalidateQueries({ queryKey: MARKET_ON_KEY });
    },
  });

  return { setOrder, saveProduct, patchProduct, demo };
};
