import { describe, expect, it } from "vitest";
import {
  addMonths,
  cartLines,
  cartOrderName,
  cartTotal,
  continueFrom,
  dayText,
  daysLeft,
  endText,
  isMonthBased,
  itemPeriod,
  membershipMonths,
  mileageBase,
  recallRental,
  rememberRental,
  rentalDays,
  rentalKindOf,
  requestedStart,
  startBounds,
  startDays,
  startHint,
  validYmd,
  weekdayOf,
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

  it("지난번 고른 것 기억 — 같은 개월(-1)은 다른 수강권에서도 그 개월, 줄인 개월은 그대로(넘치면 줄임)", () => {
    expect([rememberRental(0, 3), rememberRental(3, 3), rememberRental(2, 3), rememberRental(5, 3)]).toEqual([0, -1, 2, -1]);
    expect([recallRental(-1, 5), recallRental(-1, 1), recallRental(2, 5), recallRental(4, 1), recallRental(0, 3), recallRental(null, 3)]).toEqual([5, 1, 2, 1, 0, 0]);
  });

  it("렌탈 상품 이름 → 종류", () => {
    expect(rentalKindOf("운동복 (1개월)")).toBe("sportswear");
    expect(rentalKindOf("개인 락카 (1개월)")).toBe("locker");
    expect(rentalKindOf("개인락커 3개월")).toBe("locker");
    expect(rentalKindOf("12온스 글러브")).toBeNull();
  });
});

describe("남은 기간 뒤로 이어 붙이기 · 시작일 고르기 (DB apply_payment_order · _pass_period 와 같은 식, 2026-11-20)", () => {
  const today = "2026-11-20";

  it("날짜 + N개월 — 없는 날은 그 달 마지막 날 (Postgres date + interval 과 같다)", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29"); // 윤년
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2026-11-27", 1)).toBe("2026-12-27");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-08-31", 5)).toBe("2027-01-31");
  });

  it("진짜 날짜만 — 없는 날 · 모양이 틀린 글자는 null", () => {
    expect(validYmd("2026-11-27")).toBe("2026-11-27");
    expect(validYmd("2026-11-27T10:00:00+09:00")).toBe("2026-11-27");
    expect(validYmd("2026-02-30")).toBeNull();
    expect(validYmd("2026-13-01")).toBeNull();
    expect(validYmd("11/27")).toBeNull();
    expect(validYmd(null)).toBeNull();
  });

  it("기본 시작일 = 이어서 — 남아 있으면(오늘 끝나도) 끝난 다음 날, 없거나 끝났으면 오늘", () => {
    expect(continueFrom("2026-12-10", today)).toBe("2026-12-11");
    expect(continueFrom(today, today)).toBe("2026-11-21"); // 오늘 끝나는 수강권 — 내일부터
    expect(continueFrom("2026-11-19", today)).toBe(today);
    expect(continueFrom(null, today)).toBe(today);
    expect(continueFrom("엉뚱한 값", today)).toBe(today);
  });

  it("고를 수 있는 날 = 기본 시작일부터 30일 (31칸) · 지금 수강권", () => {
    const fresh = startBounds(null, today);
    expect(fresh).toEqual({ min: today, max: "2026-12-20", currentEnd: null });
    expect(startDays(fresh)).toHaveLength(31);
    const renew = startBounds("2026-12-10", today);
    expect(renew).toEqual({ min: "2026-12-11", max: "2027-01-10", currentEnd: "2026-12-10" });
    expect(startBounds("2026-11-01", today).currentEnd).toBeNull();
  });

  it("서버에 보낼 시작일 — 기본 시작일이면 null, 범위 밖이면 null", () => {
    const b = startBounds(null, today);
    expect(requestedStart(today, b)).toBeNull();
    expect(requestedStart("2026-11-27", b)).toBe("2026-11-27");
    expect(requestedStart("2026-12-20", b)).toBe("2026-12-20");
    expect(requestedStart("2026-12-21", b)).toBeNull();
    expect(requestedStart("2026-11-19", b)).toBeNull();
    expect(requestedStart(null, b)).toBeNull();
  });

  it("이용 기간 — 끝나는 날 = 시작일 + N개월 − 1일 (브로제이와 같은 식)", () => {
    // 신규 · 다음 주부터 1개월
    expect(itemPeriod({ currentEnd: null, today, months: 1, days: 30, start: "2026-11-27" })).toEqual({ start: "2026-11-27", end: "2026-12-26" });
    // 신규 · 오늘부터 (고르지 않음)
    expect(itemPeriod({ currentEnd: null, today, months: 1, days: 30 })).toEqual({ start: today, end: "2026-12-19" });
    // 미리 결제(이어서) — 지금 수강권 끝난 다음 날부터 5개월 (11/09 실제 결제와 같은 모양)
    expect(itemPeriod({ currentEnd: "2026-11-10", today: "2026-11-09", months: 5, days: 150 })).toEqual({ start: "2026-11-11", end: "2027-04-10" });
    // 사이를 두고 시작
    expect(itemPeriod({ currentEnd: "2026-11-25", today, months: 3, days: 90, start: "2026-12-05" })).toEqual({ start: "2026-12-05", end: "2027-03-04" });
    // 고른 날이 그사이 늘어난 기간보다 앞이면 이어서(늦은 날)
    expect(itemPeriod({ currentEnd: "2026-12-31", today, months: 1, days: 30, start: "2026-12-05" })).toEqual({ start: "2027-01-01", end: "2027-01-31" });
    // 1년 무제한 (365일 · 12개월)
    expect(itemPeriod({ currentEnd: null, today, months: 12, days: 365 })).toEqual({ start: today, end: "2027-11-19" });
    // 운동복 · 락카 (수강권 없이 · 고른 날 없음)
    expect(itemPeriod({ currentEnd: "2026-11-27", today, months: 1, days: 30 })).toEqual({ start: "2026-11-28", end: "2026-12-27" });
  });

  it("날 단위 상품(28일 아래)은 시작일 + 일수 − 1일", () => {
    expect(isMonthBased(1, 30)).toBe(true);
    expect(isMonthBased(1, 14)).toBe(false);
    expect(isMonthBased(0, 90)).toBe(false);
    expect(itemPeriod({ currentEnd: null, today, months: 1, days: 14, start: "2026-11-27" })).toEqual({ start: "2026-11-27", end: "2026-12-10" });
    expect(itemPeriod({ currentEnd: null, today, months: 0, days: 0 })).toEqual({ start: today, end: today });
  });

  it("요일 · 날짜 글자 · 아래 한 줄", () => {
    expect(weekdayOf("2026-11-27")).toBe("금");
    expect(weekdayOf("2026-11-22")).toBe("일");
    expect(dayText("2026-11-27", today)).toBe("11월 27일(금)");
    expect(dayText("2027-01-02", today)).toBe("2027년 1월 2일(토)");
    const fresh = startBounds(null, today);
    expect(startHint(fresh, today, today)).toBe("결제하면 오늘부터 바로 다닐 수 있어요");
    expect(startHint(fresh, "2026-11-27", today)).toBe("기간은 고른 날부터 세요");
    const renew = startBounds("2026-11-25", today);
    expect(startHint(renew, "2026-11-26", today)).toBe("지금 수강권이 끝나면 다음 날부터 이어져요");
    expect(startHint(renew, "2026-12-05", today)).toBe("지금 수강권은 11월 25일까지라 사이 9일은 비어요");
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
