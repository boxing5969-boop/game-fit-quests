// 🧥 153 굿즈 사전예약 서버 호출 — 함수만 부른다(표는 anon · authenticated 모두 막힘).
// 서버: supabase/migrations/20261112202433_goods_preorder.sql · 화면 계산: lib/goodsPreorder.ts
import { supabase } from "@/integrations/supabase/client";
import type { GoodsCampaign, GoodsOrder, GoodsStatus } from "@/lib/goodsPreorder";

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as UntypedRpc)(fn, args);
  if (error) throw new Error(error.message || fn);
  return data as T;
}

export interface GoodsMyPage {
  ok: boolean;
  me: { name: string | null; phone: string | null; branch: string | null } | null;
  orders: GoodsOrder[];
}

export interface GoodsAdminList {
  ok: boolean;
  code?: string;
  scope: { all: boolean; branch: string | null };
  campaign: GoodsCampaign;
  orders: GoodsOrder[];
}

export const getGoodsCampaign = (slug: string) => call<GoodsCampaign>("goods_campaign_info", { p_slug: slug });

export const getGoodsMyPage = (slug: string) => call<GoodsMyPage>("goods_my_page", { p_slug: slug });

export const getGoodsAdminList = (slug: string, branch: string | null) =>
  call<GoodsAdminList>("goods_admin_orders", { p_slug: slug, p_branch: branch });

export interface GoodsAdminPatch {
  status?: GoodsStatus;
  color?: string;
  size?: string;
  qty?: number;
  memo?: string;
}

export const updateGoodsOrder = (id: string, patch: GoodsAdminPatch) =>
  call<{ ok: boolean; code?: string; order?: GoodsOrder }>("goods_admin_update", {
    p_order_id: id,
    p_status: patch.status ?? null,
    p_color: patch.color ?? null,
    p_size: patch.size ?? null,
    p_qty: patch.qty ?? null,
    p_memo: patch.memo ?? null,
  });
