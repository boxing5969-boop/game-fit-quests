import { describe, expect, it } from "vitest";
import { clampMileageUse, maxMileageUse, mileageBlockReason, parseMileageInput } from "./mileagePay";

describe("maxMileageUse — 서버 mileage_max_use 와 같은 식", () => {
  it("보유와 결제 금액 10% 중 작은 쪽, 1,000 단위 내림", () => {
    expect(maxMileageUse(2500, 220000)).toBe(2000);
    expect(maxMileageUse(25500, 220000)).toBe(22000);
    expect(maxMileageUse(25500, 1580000)).toBe(25000);
    expect(maxMileageUse(100000, 690000)).toBe(69000);
  });
  it("1만 원 미만 · 1,000점 미만이면 0", () => {
    expect(maxMileageUse(5000, 9999)).toBe(0);
    expect(maxMileageUse(999, 500000)).toBe(0);
    expect(maxMileageUse(5000, 10000)).toBe(1000);
  });
  it("부동소수 오차로 덜 나오지 않는다 (금액 × 0.1 대신 정수 계산)", () => {
    for (const price of [10000, 20000, 30000, 50000, 70000, 180000, 220000, 480000, 540000, 690000, 700000, 790000, 1000000, 1580000]) {
      expect(maxMileageUse(10_000_000, price)).toBe(Math.floor(price / 10000) * 1000);
    }
  });
  it("음수 · NaN 은 0", () => {
    expect(maxMileageUse(-5000, 220000)).toBe(0);
    expect(maxMileageUse(Number.NaN, 220000)).toBe(0);
    expect(maxMileageUse(5000, Number.NaN)).toBe(0);
  });
});

describe("clampMileageUse / parseMileageInput", () => {
  it("1,000 단위로 내리고 최대를 넘지 않는다", () => {
    expect(clampMileageUse(2500, 22000)).toBe(2000);
    expect(clampMileageUse(30000, 22000)).toBe(22000);
    expect(clampMileageUse(999, 22000)).toBe(0);
    expect(clampMileageUse(-1000, 22000)).toBe(0);
    expect(clampMileageUse(5000, 0)).toBe(0);
  });
  it("입력칸 글자는 숫자만 · 최대값까지", () => {
    expect(parseMileageInput("12,500", 22000)).toBe(12500);
    expect(parseMileageInput("99999", 22000)).toBe(22000);
    expect(parseMileageInput("", 22000)).toBe(0);
    expect(parseMileageInput("abc", 22000)).toBe(0);
  });
});

describe("mileageBlockReason — 못 쓰는 이유", () => {
  it("쓸 수 있으면 null", () => {
    expect(mileageBlockReason({ balance: 2500, price: 220000, isStaff: false })).toBeNull();
  });
  it("1,000점 미만 — 회원은 low_balance, 지도진은 staff", () => {
    expect(mileageBlockReason({ balance: 500, price: 220000, isStaff: false })).toBe("low_balance");
    expect(mileageBlockReason({ balance: 0, price: 220000, isStaff: true })).toBe("staff");
  });
  it("점수는 있는데 1만 원 미만 상품이면 low_price", () => {
    expect(mileageBlockReason({ balance: 5000, price: 5000, isStaff: false })).toBe("low_price");
  });
});
