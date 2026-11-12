import { describe, expect, it } from "vitest";
import {
  FLEECE_FALLBACK,
  basisStatuses,
  daysLeft,
  ddayLabel,
  deadlineLabel,
  formatPhone,
  matchesQuery,
  nextActions,
  shortBranch,
  summarize,
  supplierText,
  won,
  type GoodsOrder,
  type GoodsStatus,
} from "./goodsPreorder";

let seq = 0;
const order = (color: string, size: string, qty: number, status: GoodsStatus, extra: Partial<GoodsOrder> = {}): GoodsOrder => ({
  id: `id-${++seq}`,
  order_no: `FL-${1000 + seq}`,
  color,
  size,
  qty,
  unit_price: 39000,
  amount: 39000 * qty,
  status,
  branch_name: "153복싱짐 선릉역점",
  created_at: "2026-11-13T01:00:00Z",
  paid_at: null,
  delivered_at: null,
  canceled_at: null,
  can_cancel: status === "applied",
  ...extra,
});

describe("goodsPreorder", () => {
  it("formats money, phone and branch", () => {
    expect(won(39000)).toBe("39,000원");
    expect(won(117000)).toBe("117,000원");
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone("0101234567")).toBe("010-123-4567");
    expect(formatPhone("010-12")).toBe("010-12");
    expect(shortBranch("153복싱짐 선릉역점")).toBe("선릉역점");
    expect(shortBranch("")).toBe("지점");
  });

  it("labels the deadline in KST", () => {
    expect(deadlineLabel("2026-11-26T23:59:59+09:00")).toBe("11월 26일(목)");
    // UTC 늦은 밤이 한국 날짜로는 다음 날
    expect(deadlineLabel("2026-11-26T16:00:00Z")).toBe("11월 27일(금)");
  });

  it("counts days left by KST date", () => {
    const close = "2026-11-26T23:59:59+09:00";
    expect(daysLeft(close, new Date("2026-11-12T11:00:00Z"))).toBe(14);
    expect(daysLeft(close, new Date("2026-11-26T00:30:00+09:00"))).toBe(0);
    expect(daysLeft(close, new Date("2026-11-27T00:01:00+09:00"))).toBe(-1);
    // 한국 자정 직후(UTC 로는 전날)도 한국 날짜로 센다
    expect(daysLeft(close, new Date("2026-11-24T15:30:00Z"))).toBe(1);
  });

  it("d-day label", () => {
    const c = { open: true, closes_at: "2026-11-26T23:59:59+09:00" };
    expect(ddayLabel(c, new Date("2026-11-12T11:00:00Z"))).toBe("D-14");
    expect(ddayLabel(c, new Date("2026-11-26T10:00:00+09:00"))).toBe("오늘 마감");
    expect(ddayLabel(c, new Date("2026-11-27T00:00:00+09:00"))).toBe("마감");
    expect(ddayLabel({ ...c, open: false }, new Date("2026-11-12T11:00:00Z"))).toBe("마감");
  });

  it("next actions mirror the server transitions", () => {
    const allowed: Record<GoodsStatus, GoodsStatus[]> = {
      applied: ["paid", "canceled"],
      paid: ["delivered", "applied", "canceled"],
      delivered: ["paid"],
      canceled: ["applied"],
    };
    for (const s of Object.keys(allowed) as GoodsStatus[]) {
      expect(nextActions(s).map((a) => a.to)).toEqual(allowed[s]);
    }
    expect(nextActions("applied")[0].label).toBe("결제 완료");
  });

  it("summarizes by basis", () => {
    const orders = [
      order("white", "L", 2, "paid"),
      order("white", "M", 1, "applied"),
      order("gray", "XL", 1, "delivered"),
      order("gray", "XL", 3, "canceled"),
      order("white", "L", 1, "paid"),
    ];
    const paid = summarize(orders, FLEECE_FALLBACK, "paid");
    expect(paid.pieces).toBe(4);
    expect(paid.orders).toBe(3);
    expect(paid.amount).toBe(39000 * 4);
    expect(paid.matrix.white.L).toBe(3);
    expect(paid.matrix.white.M).toBe(0);
    expect(paid.matrix.gray.XL).toBe(1);
    expect(paid.sizeTotals.XL).toBe(1);
    expect(paid.colorTotals.gray).toBe(1);
    const all = summarize(orders, FLEECE_FALLBACK, "all");
    expect(all.pieces).toBe(5);
    expect(all.matrix.white.M).toBe(1);
    expect(all.byStatus.canceled).toEqual({ orders: 1, pieces: 3, amount: 117000 });
    expect(all.byStatus.applied.pieces).toBe(1);
    expect(basisStatuses("paid")).toEqual(["paid", "delivered"]);
  });

  it("keeps unknown sizes/colors instead of dropping them", () => {
    const s = summarize([order("white", "S", 1, "paid")], FLEECE_FALLBACK, "paid");
    expect(s.matrix.white.S).toBe(1);
    expect(s.pieces).toBe(1);
  });

  it("writes the supplier order text", () => {
    const orders = [order("white", "L", 2, "paid"), order("white", "2XL", 1, "delivered"), order("gray", "M", 1, "applied")];
    expect(supplierText(FLEECE_FALLBACK, orders, "paid")).toBe(
      "153 플리스 집업 발주 (결제 완료 기준)\n흰색 인쇄: L 2 · 2XL 1 (3벌)\n합계 3벌",
    );
    expect(supplierText(FLEECE_FALLBACK, orders, "all")).toBe(
      "153 플리스 집업 발주 (신청 포함)\n흰색 인쇄: L 2 · 2XL 1 (3벌)\n진회색 인쇄: M 1 (1벌)\n합계 4벌",
    );
    expect(supplierText(FLEECE_FALLBACK, [], "paid")).toBe("153 플리스 집업 발주 (결제 완료 기준)\n합계 0벌");
  });

  it("searches by name, phone digits and order number", () => {
    const o = order("white", "L", 1, "applied", { name: "홍길동", phone: "01055556666", order_no: "FL-4821" });
    expect(matchesQuery(o, "")).toBe(true);
    expect(matchesQuery(o, "길동")).toBe(true);
    expect(matchesQuery(o, "5666")).toBe(true);
    expect(matchesQuery(o, "010-5555")).toBe(true);
    expect(matchesQuery(o, "fl-48")).toBe(true);
    expect(matchesQuery(o, "12")).toBe(false);
    expect(matchesQuery(o, "김")).toBe(false);
  });
});
