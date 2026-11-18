import { describe, expect, it } from "vitest";
import {
  FLEECE_FALLBACK,
  basisStatuses,
  daysLeft,
  ddayLabel,
  deadlineLabel,
  formatPhone,
  goodsPopupSessionKey,
  goodsPopupTodayKey,
  hasActiveGoodsOrder,
  hasGoodsSample,
  isAccepting,
  isSoldOut,
  kstDateOf,
  listPriceOf,
  matchesQuery,
  nextActions,
  printColorsText,
  shortBranch,
  shouldShowGoodsPopup,
  stockLabel,
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

  it("list price and first-come stock", () => {
    expect(FLEECE_FALLBACK.price).toBe(25000);
    expect(listPriceOf({ price: 25000, list_price: 35000 })).toBe(35000);
    expect(listPriceOf({ price: 25000, list_price: null })).toBeNull();
    expect(listPriceOf({ price: 25000, list_price: 25000 })).toBeNull(); // 같거나 낮으면 줄 긋지 않는다
    expect(stockLabel({ stock_limit: 50, stock_left: 50, sold_out: false })).toBe("선착순 50벌");
    expect(stockLabel({ stock_limit: 50, stock_left: 12, sold_out: false })).toBe("선착순 50벌 · 남은 12벌");
    expect(stockLabel({ stock_limit: 50, stock_left: 0, sold_out: true })).toBe("선착순 50벌 마감");
    expect(stockLabel({ stock_limit: null, stock_left: null, sold_out: false })).toBe("");
    // 서버가 sold_out 을 안 보낸 옛 응답이어도 남은 수로
    expect(isSoldOut({ stock_limit: 50, stock_left: 0 })).toBe(true);
    expect(isSoldOut({ stock_limit: null, stock_left: null })).toBe(false);
    expect(isAccepting({ ok: true, open: true, stock_limit: 50, stock_left: 3, sold_out: false })).toBe(true);
    expect(isAccepting({ ok: true, open: true, stock_limit: 50, stock_left: 0, sold_out: true })).toBe(false);
    expect(isAccepting({ ok: true, open: false, stock_limit: 50, stock_left: 9, sold_out: false })).toBe(false);
  });

  it("size samples only where they are", () => {
    expect(hasGoodsSample("153복싱짐 선릉역점")).toBe(true);
    expect(hasGoodsSample(" 153복싱짐 선릉역점 ")).toBe(true);
    expect(hasGoodsSample("153복싱짐 칠금점")).toBe(false); // 샘플이 없는 지점 TV 에는 말하지 않는다
    expect(hasGoodsSample("")).toBe(false);
    expect(hasGoodsSample(undefined)).toBe(false);
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

  describe("홈 팝업 (2026-11-18 대표님 「팝업창하나 · 오늘하루동안 뜨지않게」)", () => {
    const OPEN = { ...FLEECE_FALLBACK, stock_left: 44, stock_used: 6 };

    it("한국 날짜 — 기기 시간대와 상관없이 한국 자정에 바뀐다", () => {
      expect(kstDateOf(new Date("2026-11-18T14:59:59Z"))).toBe("2026-11-18"); // 한국 23:59:59
      expect(kstDateOf(new Date("2026-11-18T15:00:00Z"))).toBe("2026-11-19"); // 한국 00:00
      expect(kstDateOf(Date.UTC(2026, 0, 4, 3))).toBe("2026-01-04"); // 한 자리 달 · 날도 두 자리
    });

    it("「오늘 하루 보지 않기」 칸은 계정 · 상품 · 한국 날짜마다, 「닫기」 칸은 날짜 없이", () => {
      const a = goodsPopupTodayKey("fleece-2026", "u1", new Date("2026-11-18T14:59:59Z"));
      expect(a).toBe("153goods:popup:fleece-2026:u1:2026-11-18");
      expect(goodsPopupTodayKey("fleece-2026", "u1", new Date("2026-11-18T15:00:00Z"))).not.toBe(a); // 다음 날엔 다시 뜬다
      expect(goodsPopupTodayKey("fleece-2026", "u2", new Date("2026-11-18T14:59:59Z"))).not.toBe(a); // 다른 계정은 따로
      expect(goodsPopupSessionKey("fleece-2026", "u1")).toBe("153goods:popup:fleece-2026:u1:closed");
    });

    it("신청 받는 중 · 아직 신청 전일 때만 — 취소만 있으면 다시 알린다", () => {
      expect(shouldShowGoodsPopup(OPEN, [])).toBe(true);
      expect(shouldShowGoodsPopup(OPEN, undefined)).toBe(true);
      expect(shouldShowGoodsPopup(OPEN, [order("white", "L", 1, "canceled")])).toBe(true);
      for (const st of ["applied", "paid", "delivered"] as const) {
        expect(hasActiveGoodsOrder([order("white", "L", 1, st)])).toBe(true);
        expect(shouldShowGoodsPopup(OPEN, [order("gray", "M", 1, "canceled"), order("white", "L", 1, st)])).toBe(false);
      }
    });

    it("마감 · 꺼짐 · 선착순이 다 차면 안 뜬다", () => {
      expect(shouldShowGoodsPopup({ ...OPEN, open: false }, [])).toBe(false);
      expect(shouldShowGoodsPopup({ ...OPEN, ok: false }, [])).toBe(false);
      expect(shouldShowGoodsPopup({ ...OPEN, stock_left: 0 }, [])).toBe(false);
      expect(shouldShowGoodsPopup({ ...OPEN, sold_out: true }, [])).toBe(false);
      expect(shouldShowGoodsPopup(null, [])).toBe(false);
      expect(shouldShowGoodsPopup({ ...OPEN, stock_limit: null, stock_left: null }, [])).toBe(true); // 제한 없음
    });

    it("인쇄 색 이름만", () => {
      expect(printColorsText(FLEECE_FALLBACK)).toBe("흰색 · 진회색");
      expect(printColorsText({ colors: [] })).toBe("");
      expect(printColorsText(null)).toBe("");
    });
  });
});
