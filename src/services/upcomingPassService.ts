/**
 * 결제했지만 아직 시작 전인 수강권 (2026-11-20 시작일 고르기) — 수강권 카드 「시작까지 D-n」 · 「다음 시작」.
 *   내 결제(payment_orders · status paid) 항목 중 반영된(applied) · 되돌리지 않은 수강권 줄 가운데 시작일이 오늘보다 뒤인 가장 이른 것.
 *   RLS: 회원은 자기 주문 항목만 읽힌다(own order items select) — 지도진은 같은 지점 회원 줄도 읽히므로 user_id 로 꼭 거른다.
 *   못 읽으면(표가 없는 옛 DB · 오류) null — 카드는 예전처럼 남은 기간만.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { UpcomingPassItem } from "@/lib/gymTicketInfo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export async function fetchUpcomingPass(userId: string, today: string): Promise<UpcomingPassItem | null> {
  const { data, error } = await sb
    .from("payment_order_items")
    .select("start_date, end_date, prev_end, payment_orders!inner(user_id, status)")
    .eq("kind", "membership")
    .eq("payment_orders.user_id", userId)
    .eq("payment_orders.status", "paid")
    .not("applied_at", "is", null)
    .is("reverted_at", null)
    .gt("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1);
  if (error) return null;
  const row = ((data ?? []) as Array<UpcomingPassItem>)[0];
  return row ? { start_date: row.start_date ?? null, end_date: row.end_date ?? null, prev_end: row.prev_end ?? null } : null;
}

export function useUpcomingPass(today: string, enabled = true) {
  const uid = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ["membership", "upcoming-start", uid, today],
    enabled: !!uid && enabled,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: () => fetchUpcomingPass(uid as string, today),
  });
}
