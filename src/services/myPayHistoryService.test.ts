import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  groupMileageByMonth,
  itemLabel,
  kstDateTimeText,
  mileageRowSub,
  mileageRowTitle,
  payTotals,
  shapeOrders,
  shortYmd,
} from "./myPayHistoryService";

const NOW = Date.parse("2026-10-27T00:00:00Z"); // KST 09:00

const order = (o: Partial<Record<string, unknown>> & { id: string; status: string }) => ({
  bill_id: "mbxxx",
  product_name: "주5회 기간권 1개월",
  amount: 220000,
  list_price: 220000,
  mileage_used: 0,
  paid_at: "2026-10-26T22:21:06Z",
  created_at: "2026-10-26T22:20:41Z",
  appr_card: "신한카드",
  short_url: null,
  canceled_at: null,
  ...o,
});

describe("내 결제 내역 — 보여 줄 것만", () => {
  it("결제 완료 · 취소는 보이고, 24시간 지난 결제 대기 · 모의 시험(TEST-) · 0원은 뺀다", () => {
    const rows = [
      order({ id: "a", status: "paid" }),
      order({ id: "b", status: "canceled", canceled_at: "2026-10-26T22:34:00Z" }),
      order({ id: "c", status: "sent", paid_at: null, created_at: "2026-10-26T21:00:00Z", short_url: "https://x" }),
      order({ id: "d", status: "sent", paid_at: null, created_at: "2026-10-25T21:00:00Z", short_url: "https://y" }),
      order({ id: "e", status: "paid", bill_id: "TEST-SYNC-001", amount: 0, list_price: 0 }),
      order({ id: "f", status: "failed" }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = shapeOrders(rows as any, [], NOW);
    expect(out.map((o) => o.id).sort()).toEqual(["a", "b", "c"]);
    expect(out.find((o) => o.id === "c")?.shortUrl).toBe("https://x");
    expect(out.find((o) => o.id === "a")?.shortUrl).toBeNull();
    expect(out.find((o) => o.id === "b")?.canceledAt).toBe("2026-10-26T22:34:00Z");
  });

  it("항목은 수강권 → 운동복 → 락카 순서 · 이름", () => {
    const rows = [order({ id: "a", status: "paid", amount: 218000, list_price: 240000, mileage_used: 22000 })];
    const items = [
      { order_id: "a", kind: "locker", product_name: "개인 락카 (1개월)", months: 1, amount: 10000, mileage_used: 0, start_date: "2026-10-27", end_date: "2026-11-26", reverted_at: null },
      { order_id: "a", kind: "membership", product_name: "주5회 기간권 1개월", months: 1, amount: 198000, mileage_used: 22000, start_date: "2026-10-27", end_date: "2026-11-26", reverted_at: null },
      { order_id: "a", kind: "sportswear", product_name: "운동복 (1개월)", months: 1, amount: 10000, mileage_used: 0, start_date: "2026-10-27", end_date: "2026-11-26", reverted_at: null },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [o] = shapeOrders(rows as any, items as any, NOW);
    expect(o.items.map(itemLabel)).toEqual(["주5회 기간권 1개월", "운동복 1개월", "락카 1개월"]);
    expect(o.listPrice).toBe(240000);
    expect(o.mileageUsed).toBe(22000);
    expect(shortYmd(o.items[0].startDate)).toBe("26.10.27");
  });

  it("합계는 결제 완료만 — 취소는 빼고, 마일리지로 아낀 금액", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = shapeOrders([order({ id: "a", status: "paid", mileage_used: 22000, amount: 198000 }), order({ id: "b", status: "canceled" })] as any, [], NOW);
    expect(payTotals(out)).toEqual({ count: 1, paid: 198000, saved: 22000 });
  });

  it("날짜 글자 (KST)", () => {
    expect(kstDateTimeText("2026-10-26T22:21:06Z", NOW)).toBe("10월 27일 07:21");
    expect(kstDateTimeText("2025-12-31T16:00:00Z", NOW)).toBe("2026년 1월 1일 01:00".replace("2026년 ", ""));
    expect(kstDateTimeText("2025-05-01T00:00:00Z", NOW)).toBe("2025년 5월 1일 09:00");
  });
});

describe("마일리지 내역 — 이름 · 월별", () => {
  it("종류별 이름 · 결제 사용/돌려받음은 사유에서", () => {
    expect(mileageRowTitle({ kind: "attendance", reason: "출석 (10.23)", amount: 500 })).toBe("출석");
    expect(mileageRowTitle({ kind: "adjust", reason: "결제 할인 사용 · 주5회 기간권 1개월", amount: -22000 })).toBe("결제 할인에 사용");
    expect(mileageRowSub({ kind: "adjust", reason: "결제 할인 사용 · 주5회 기간권 1개월", amount: -22000 })).toBe("주5회 기간권 1개월");
    expect(mileageRowTitle({ kind: "adjust", reason: "결제 취소로 돌려받음 · 주5회", amount: 22000 })).toBe("결제 취소로 돌려받음");
    expect(mileageRowSub({ kind: "attendance", reason: "출석 (10.23)", amount: 500 })).toBeNull();
    expect(mileageRowSub({ kind: "level_up", reason: "레벨업 (블루 Lv.3)", amount: 500 })).toBe("레벨업 (블루 Lv.3)");
  });

  it("월별로 묶고 들어온 것 · 쓴 것 합계", () => {
    const g = groupMileageByMonth([
      { id: "1", amount: 500, kind: "attendance", reason: "", at: "2026-10-26T01:00:00Z" },
      { id: "2", amount: -22000, kind: "adjust", reason: "결제 할인 사용 · x", at: "2026-10-26T22:21:00Z" },
      { id: "3", amount: 500, kind: "attendance", reason: "", at: "2026-09-30T16:30:00Z" }, // KST 10월 1일
      { id: "4", amount: 500, kind: "attendance", reason: "", at: "2026-09-29T01:00:00Z" },
    ]);
    expect(g.map((m) => [m.key, m.plus, m.minus])).toEqual([
      ["2026-10", 1000, -22000],
      ["2026-09", 500, 0],
    ]);
    expect(g[0].label).toBe("2026년 10월");
  });
});
