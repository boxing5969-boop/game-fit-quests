import { describe, expect, it } from "vitest";
import {
  cartLines,
  cartOrderName,
  cartTotal,
  daysLeft,
  endText,
  extendedEnd,
  membershipMonths,
  mileageBase,
  rentalDays,
  rentalKindOf,
} from "./cartPricing";

const unitPrice = { sportswear: 10000, locker: 10000 };
const mem3 = { name: "주5회 기간권 3개월", price: 540000, days: 90 };

describe("앱 결제 장바구니 — 수강권 + 운동복 + 락카 링크 1개 (2026-10-27)", () => {
  it("보고서 예시: 주5회 3개월 + 운동복 3개월 + 락카 3개월 = 600,000원", () => {
    const lines = cartLines({ membership: mem3, sportswearMonths: 3, lockerMonths: 3, unitPrice });
    expect(lines.map((l) => [l.label, l.amount])).toEqual([
      ["주5회 기간권 3개월", 540000],
      ["운동복 3개월", 30000],
      ["락카 3개월", 30000],
    ]);
    expect(cartTotal(lines)).toBe(600000);
    // 렌탈이 수강권과 같은 개월이면 끝나는 날도 같게(일수 같음)
    expect(lines.map((l) => l.days)).toEqual([90, 90, 90]);
  });

  it("1년 무제한은 12개월 · 365일 — 같이 담은 렌탈도 365일", () => {
    expect(membershipMonths(365)).toBe(12);
    const lines = cartLines({ membership: { name: "1년", price: 1580000, days: 365 }, sportswearMonths: 12, lockerMonths: 5, unitPrice });
    expect(lines.find((l) => l.kind === "sportswear")?.days).toBe(365);
    expect(lines.find((l) => l.kind === "locker")?.days).toBe(150);
  });

  it("개월 → 일수: 1·3·5개월 = 30·90·150일, 수강권 없이 12개월 = 365일", () => {
    expect([1, 3, 5].map((m) => rentalDays(m))).toEqual([30, 90, 150]);
    expect(rentalDays(12)).toBe(365);
    expect(membershipMonths(30)).toBe(1);
    expect(membershipMonths(150)).toBe(5);
  });

  it("0개월은 담지 않는다 · 락카만 연장도 된다", () => {
    const lines = cartLines({ membership: null, sportswearMonths: 0, lockerMonths: 2, unitPrice });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: "locker", label: "락카 2개월", amount: 20000, days: 60 });
  });

  it("마일리지 기준: 수강권이 있으면 수강권 금액, 없으면 합계", () => {
    expect(mileageBase(cartLines({ membership: mem3, sportswearMonths: 3, lockerMonths: 3, unitPrice }))).toBe(540000);
    expect(mileageBase(cartLines({ membership: null, sportswearMonths: 3, lockerMonths: 2, unitPrice }))).toBe(50000);
  });

  it("결제선생 상품 이름 — 40자 넘으면 '첫 항목 외 N건'", () => {
    const short = cartLines({ membership: mem3, sportswearMonths: 3, lockerMonths: 0, unitPrice });
    expect(cartOrderName(short)).toBe("주5회 기간권 3개월 + 운동복 3개월");
    const long = cartLines({ membership: { name: "153 복싱짐 프리미엄 1년 무제한 회원권", price: 1580000, days: 365 }, sportswearMonths: 12, lockerMonths: 12, unitPrice });
    expect(cartOrderName(long)).toBe("153 복싱짐 프리미엄 1년 무제한 회원권 외 2건");
  });

  it("렌탈 상품 이름 → 종류", () => {
    expect(rentalKindOf("운동복 (1개월)")).toBe("sportswear");
    expect(rentalKindOf("개인 락카 (1개월)")).toBe("locker");
    expect(rentalKindOf("개인락커 3개월")).toBe("locker");
    expect(rentalKindOf("12온스 글러브")).toBeNull();
  });
});

describe("남은 기간 뒤로 이어 붙이기 (DB apply_payment_order 와 같은 식)", () => {
  it("남아 있으면 그 뒤로", () => {
    expect(extendedEnd("2026-11-25", 90, "2026-10-27")).toBe("2027-02-23");
  });
  it("끝났거나 없으면 오늘부터", () => {
    expect(extendedEnd("2026-10-01", 30, "2026-10-27")).toBe("2026-11-26");
    expect(extendedEnd(null, 30, "2026-10-27")).toBe("2026-11-26");
    // 오늘 끝나는 것도 오늘부터 (서버: cur > today 일 때만 이어 붙임)
    expect(extendedEnd("2026-10-27", 30, "2026-10-27")).toBe("2026-11-26");
  });
  it("남은 날 · 날짜 글자", () => {
    expect(daysLeft("2027-01-25", "2026-10-26")).toBe(91);
    expect(daysLeft("2026-10-26", "2026-10-26")).toBe(0);
    expect(daysLeft("2026-10-20", "2026-10-26")).toBe(-6);
    expect(daysLeft(null, "2026-10-26")).toBeNull();
    expect(endText("2026-11-25", "2026-10-27")).toBe("11월 25일");
    expect(endText("2027-01-25", "2026-10-27")).toBe("2027년 1월 25일");
  });
});
