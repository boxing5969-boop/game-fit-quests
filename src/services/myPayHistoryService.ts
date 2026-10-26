/**
 * 🧾 내 결제 · 마일리지 내역 — 회원 본인 (2026-10-27 대표님: "회원님들 마일리지 사용 내역이랑 결제 내역 등등 자세히 볼 수 있도록")
 *
 *   · 앱 결제 — payment_orders(본인 것만 읽힌다: RLS own orders select) + 항목 payment_order_items(수강권 · 운동복 · 락카 · 반영 기간)
 *     결제 완료 · 취소(환불) · 24시간 안에 만든 결제 대기(링크 이어서 결제). 예전 모의 시험 주문(TEST-…, 0원)은 뺀다.
 *   · 마일리지 — mileage_ledger(본인 것만 읽힌다: RLS own mileage read) 전체, 50줄씩 더 보기.
 *   데스크(브로제이 · 다짐) 결제는 회원 화면에 보여 주지 않는다 — 이름으로만 찾을 수 있는 지점이 있어 남의 기록이 섞일 수 있다.
 *   숫자 · 글은 여기 한 곳 (화면: components/membership/MyPayHistorySheet).
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { MileageKind } from "@/services/mileageService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PayStatus = "paid" | "canceled" | "sent";

export interface PayOrderItem {
  kind: "membership" | "sportswear" | "locker" | string;
  productName: string;
  months: number;
  amount: number;
  mileageUsed: number;
  startDate: string | null;
  endDate: string | null;
  reverted: boolean;
}

export interface PayOrder {
  id: string;
  productName: string;
  /** 실제 결제 금액 (마일리지 뺀 것) */
  amount: number;
  /** 할인 전 금액 */
  listPrice: number;
  mileageUsed: number;
  status: PayStatus;
  paidAt: string | null;
  createdAt: string;
  card: string | null;
  canceledAt: string | null;
  /** 결제 대기 — 결제선생 링크 (24시간 안에 만든 것만) */
  shortUrl: string | null;
  items: PayOrderItem[];
}

export interface MileageRow {
  id: string;
  amount: number;
  kind: MileageKind | string;
  reason: string;
  at: string;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** 결제 대기를 보여 주는 시간 — payssam-create-bill 의 같은 장바구니 링크 다시 쓰기(24시간)와 같게 */
export const PENDING_SHOW_MS = 24 * 3600 * 1000;

interface RawOrder {
  id: string;
  bill_id: string | null;
  product_name: string | null;
  amount: unknown;
  list_price: unknown;
  mileage_used: unknown;
  status: string;
  paid_at: string | null;
  created_at: string;
  appr_card: string | null;
  short_url: string | null;
  canceled_at: string | null;
}
interface RawItem {
  order_id: string;
  kind: string;
  product_name: string | null;
  months: unknown;
  amount: unknown;
  mileage_used: unknown;
  start_date: string | null;
  end_date: string | null;
  reverted_at: string | null;
}

/** 서버 줄 → 화면용 (보여 줄 것만 · 최신 먼저) */
export function shapeOrders(rows: readonly RawOrder[], items: readonly RawItem[], now = Date.now()): PayOrder[] {
  const byOrder = new Map<string, PayOrderItem[]>();
  for (const it of items) {
    const list = byOrder.get(it.order_id) ?? [];
    list.push({
      kind: it.kind,
      productName: it.product_name || "",
      months: Math.max(0, Math.trunc(num(it.months))),
      amount: num(it.amount),
      mileageUsed: num(it.mileage_used),
      startDate: str(it.start_date),
      endDate: str(it.end_date),
      reverted: !!it.reverted_at,
    });
    byOrder.set(it.order_id, list);
  }
  const order = { membership: 0, sportswear: 1, locker: 2 } as Record<string, number>;
  return rows
    .filter((r) => {
      if (r.bill_id && r.bill_id.startsWith("TEST-")) return false;
      if (num(r.amount) <= 0 && num(r.list_price) <= 0) return false;
      if (r.status === "paid" || r.status === "canceled") return true;
      return r.status === "sent" && !!r.short_url && now - Date.parse(r.created_at) < PENDING_SHOW_MS;
    })
    .map((r) => ({
      id: r.id,
      productName: r.product_name || "수강권",
      amount: num(r.amount),
      listPrice: num(r.list_price) || num(r.amount) + num(r.mileage_used),
      mileageUsed: num(r.mileage_used),
      status: r.status as PayStatus,
      paidAt: r.paid_at,
      createdAt: r.created_at,
      card: str(r.appr_card),
      canceledAt: str(r.canceled_at),
      shortUrl: r.status === "sent" ? str(r.short_url) : null,
      items: (byOrder.get(r.id) ?? []).sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9)),
    }))
    .sort((a, b) => Date.parse(b.paidAt || b.createdAt) - Date.parse(a.paidAt || a.createdAt));
}

/** 내 앱 결제 (최근 100건) */
export async function fetchMyPayOrders(userId: string): Promise<PayOrder[]> {
  const { data, error } = await sb
    .from("payment_orders")
    .select("id, bill_id, product_name, amount, list_price, mileage_used, status, paid_at, created_at, appr_card, short_url, canceled_at:raw->>_canceled_at")
    .eq("user_id", userId)
    .in("status", ["paid", "canceled", "sent"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(translateError(error));
  const rows = (data ?? []) as RawOrder[];
  const ids = rows.map((r) => r.id);
  let items: RawItem[] = [];
  if (ids.length) {
    const r = await sb
      .from("payment_order_items")
      .select("order_id, kind, product_name, months, amount, mileage_used, start_date, end_date, reverted_at")
      .in("order_id", ids);
    if (r.error) throw new Error(translateError(r.error));
    items = (r.data ?? []) as RawItem[];
  }
  return shapeOrders(rows, items);
}

export const MILEAGE_PAGE = 50;

/** 내 마일리지 원장 — before(시각) 이전 50줄 */
export async function fetchMyMileageRows(userId: string, before?: string | null): Promise<MileageRow[]> {
  let q = sb
    .from("mileage_ledger")
    .select("id, amount, kind, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MILEAGE_PAGE);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw new Error(translateError(error));
  return ((data ?? []) as Array<{ id: string; amount: unknown; kind: string; reason: string | null; created_at: string }>).map((r) => ({
    id: r.id,
    amount: Math.trunc(num(r.amount)),
    kind: r.kind,
    reason: r.reason || "",
    at: r.created_at,
  }));
}

/* ───────────── 화면 글 · 합계 ───────────── */

const KST = 9 * 3600 * 1000;
const kst = (iso: string) => new Date(Date.parse(iso) + KST);

/** '2026-10-27T…' → '10월 27일 07:21' (올해가 아니면 '2025년 10월 27일 07:21') */
export function kstDateTimeText(iso: string, now = Date.now()): string {
  const d = kst(iso);
  const y = d.getUTCFullYear();
  const thisYear = new Date(now + KST).getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y !== thisYear ? `${y}년 ` : ""}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${hh}:${mm}`;
}

/** 'YYYY-MM-DD' → '26.10.27' (기간 표시 — 관리자 '수강' 탭과 같은 모양) */
export const shortYmd = (ymd: string | null): string => (ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? `${ymd.slice(2, 4)}.${Number(ymd.slice(5, 7))}.${Number(ymd.slice(8, 10))}` : "");

/** 결제 항목 이름 — 수강권은 상품 이름, 운동복 · 락카는 'N개월' */
export function itemLabel(it: PayOrderItem): string {
  if (it.kind === "sportswear") return `운동복 ${it.months}개월`;
  if (it.kind === "locker") return `락카 ${it.months}개월`;
  return it.productName || "수강권";
}

export const PAY_STATUS_TEXT: Record<PayStatus, string> = { paid: "결제 완료", canceled: "취소 · 환불", sent: "결제 대기" };

/** 결제 합계 — 결제 완료만 (취소는 빼고) */
export function payTotals(orders: readonly PayOrder[]): { count: number; paid: number; saved: number } {
  const done = orders.filter((o) => o.status === "paid");
  return {
    count: done.length,
    paid: done.reduce((s, o) => s + o.amount, 0),
    saved: done.reduce((s, o) => s + o.mileageUsed, 0),
  };
}

/** 마일리지 줄 이름 — 종류별 (조정은 서버가 적은 사유 그대로) */
export function mileageRowTitle(r: Pick<MileageRow, "kind" | "reason" | "amount">): string {
  switch (r.kind) {
    case "attendance":
      return "출석";
    case "level_up":
      return "레벨업";
    case "title_match":
      return "타이틀매치 승급";
    case "record":
      return "153 기록";
    case "milestone":
      return "출석 기념";
    default:
      if (/결제 할인 사용/.test(r.reason)) return "결제 할인에 사용";
      if (/결제 취소로 돌려받음/.test(r.reason)) return "결제 취소로 돌려받음";
      return r.amount >= 0 ? "적립" : "사용";
  }
}

/** 마일리지 줄 아래 작은 글 — 사유 (제목과 같으면 생략) */
export function mileageRowSub(r: Pick<MileageRow, "kind" | "reason" | "amount">): string | null {
  const reason = r.reason.trim();
  // 출석은 날짜가 이미 줄 앞에 있다 — '출석 (10.26)'을 또 쓰지 않는다
  if (!reason || r.kind === "attendance") return null;
  const title = mileageRowTitle(r);
  const rest = reason.replace(/^결제 할인 사용 · |^결제 취소로 돌려받음 · /, "");
  if (rest === title || reason === title) return null;
  return rest;
}

/** 월별로 묶기 — [{ key:'2026-10', label:'2026년 10월', rows, plus, minus }] (최신 달 먼저) */
export function groupMileageByMonth(rows: readonly MileageRow[]): Array<{ key: string; label: string; rows: MileageRow[]; plus: number; minus: number }> {
  const map = new Map<string, MileageRow[]>();
  for (const r of rows) {
    const d = kst(r.at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label: `${Number(key.slice(0, 4))}년 ${Number(key.slice(5, 7))}월`,
      rows: list,
      plus: list.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
      minus: list.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0),
    }));
}
