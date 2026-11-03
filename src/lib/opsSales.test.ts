import { describe, expect, it } from "vitest";
import {
  dedupeApp,
  fromApp,
  fromBroj,
  fromDagym,
  groupOf,
  isPtName,
  kstDay,
  monthRange,
  summarize,
  trendOf,
  type SalesRow,
} from "../../supabase/functions/ops-sales/logic.ts";
import { fmtMan, fmtManParts, matchFilter, otherParts, sharePct, syncedText } from "./opsSales";

describe("매출 나누기 — 실제 상품 이름으로", () => {
  it("브로제이(선릉) — 수강권 안에서 PT · 일일권 · 일반, 물품은 락카/운동복 · 용품", () => {
    expect(groupOf("broj", "수강권", "퍼스널 트레이닝 20회권")).toBe("pt");
    expect(groupOf("broj", "수강권", "퍼스널 트레이닝 10회권")).toBe("pt");
    expect(groupOf("broj", "수강권", "팀수업 4인 PT")).toBe("pt");
    expect(groupOf("broj", "수강권", "153복싱짐 일일 이용권")).toBe("daily");
    expect(groupOf("broj", "수강권", "153복싱짐 프리미엄 무제한 3개월 수강권")).toBe("membership");
    expect(groupOf("broj", "수강권", "153복싱짐 프리미엄 무제한 5개월 수강권+운동복5개월 서비스")).toBe("membership");
    expect(groupOf("broj", "수강권", "153복싱짐 시설 8개월 이용권")).toBe("membership");
    expect(groupOf("broj", "물품", "운동복 1개월권")).toBe("rental");
    expect(groupOf("broj", "물품", "개인락커 1개월권")).toBe("rental");
    expect(groupOf("broj", "물품", "오픈형 락카")).toBe("rental");
    expect(groupOf("broj", "물품", "복싱 12온스 글러브")).toBe("goods");
    expect(groupOf("broj", "기타", "생활체육진흥회 정산")).toBe("etc");
  });

  it("다짐(칠금) — general 안에서 PT · 일일권, 양도는 매출 아님", () => {
    expect(groupOf("dagym", "general", "복싱 퍼스널 트레이닝 1:1 PT 10회")).toBe("pt");
    expect(groupOf("dagym", "general", "153boxing gym class 1개월")).toBe("membership");
    expect(groupOf("dagym", "general", "Exercise voucher 1개월")).toBe("membership");
    expect(groupOf("dagym", "general", "일일권 1개월")).toBe("daily");
    expect(groupOf("dagym", "daily", "원데이 클레스 1회")).toBe("daily");
    expect(groupOf("dagym", "etc", "복싱붕대 1회")).toBe("goods");
    expect(groupOf("dagym", "rentalLocker", "개인락카 3개월")).toBe("rental");
    expect(groupOf("dagym", "rentalSportsWear", "운동복 렌탈&세탁 서비스 1개월")).toBe("rental");
    expect(groupOf("dagym", "transferMembership", "양도")).toBeNull();
  });

  it("PT 낱말 — 글자 속 pt 는 아님", () => {
    expect(isPtName("pt수업 10회")).toBe(true);
    expect(isPtName("1:1 PT")).toBe(true);
    expect(isPtName("Optimal class")).toBe(false);
    expect(isPtName("Capture 3개월")).toBe(false);
    expect(isPtName("OPTION 1개월")).toBe(false);
  });
});

describe("원본 → 매출 줄", () => {
  it("브로제이 — 음수는 환불, 0원은 뺀다", () => {
    const rows = fromBroj([
      { id: "1", sale_date: "2026-11-02", member_name: "김 회원", category: "수강권", product: "퍼스널 트레이닝 20회권", payment_method: "카드", amount: 990000 },
      { id: "2", sale_date: "2026-11-02", member_name: "이회원", category: "수강권", product: "153복싱짐 주3회 기간권 3개월", payment_method: "카드", amount: -480000 },
      { id: "3", sale_date: "2026-11-02", member_name: "박회원", category: "물품", product: "운동복 1개월권", payment_method: "카드", amount: 0 },
    ]);
    expect(rows.map((r) => [r.id, r.group, r.refund, r.amount])).toEqual([
      ["b:1", "pt", false, 990000],
      ["b:2", "membership", true, -480000],
    ]);
  });

  it("다짐 — 나눠 낸 결제는 한 건(결제수단 합침), 환불 줄은 따로, 양도 · 사라진 줄 빼기", () => {
    const rows = fromDagym([
      { row_id: "a1", sale_id: "s1", sale_date: "2026-10-05", member_name: "최회원", sale_category: "general", sale_name: "복싱 퍼스널 트레이닝 1:1 PT 10회", income: 200000, payment_method: "카드", status: "paid" },
      { row_id: "a2", sale_id: "s1", sale_date: "2026-10-05", member_name: "최회원", sale_category: "general", sale_name: "복싱 퍼스널 트레이닝 1:1 PT 10회", income: 100000, payment_method: "이체", status: "paid" },
      { row_id: "a3", sale_id: "s2", sale_date: "2026-10-07", member_name: "정회원", sale_category: "general", sale_name: "153boxing gym class 3개월", income: -379000, payment_method: "카드", status: "refunded" },
      { row_id: "a4", sale_id: "s3", sale_date: "2026-10-07", member_name: "정회원", sale_category: "transferMembership", sale_name: "양도", income: 0, payment_method: "-", status: "paid" },
      { row_id: "a5", sale_id: "s4", sale_date: "2026-10-08", member_name: "한회원", sale_category: "general", sale_name: "153boxing gym class 1개월", income: 189000, payment_method: "카드", status: "missing" },
    ]);
    expect(rows).toHaveLength(2);
    const pt = rows.find((r) => r.id === "d:s1")!;
    expect(pt).toMatchObject({ amount: 300000, method: "카드 + 이체", group: "pt", refund: false, day: "2026-10-05" });
    expect(rows.find((r) => r.id === "r:a3")).toMatchObject({ amount: -379000, group: "membership", refund: true });
  });

  it("앱 결제 — 항목마다(락카 · 운동복 · 수강권), 항목이 없으면 주문 하나 · 한국 날짜", () => {
    const names = new Map([["u1", "김회원"]]);
    const rows = fromApp(
      [
        { id: "o1", user_id: "u1", product_name: "주3회 기간권 3개월", amount: 500000, paid_at: "2026-10-31T15:30:00Z", items: [
          { kind: "membership", product_name: "주3회 기간권 3개월", amount: 480000 },
          { kind: "locker", product_name: "락카 3개월", amount: 20000 },
        ] },
        { id: "o2", user_id: "u9", product_name: "운동복 (1개월)", amount: 10000, paid_at: "2026-10-21T03:00:00Z", items: [] },
      ],
      names,
    );
    expect(rows.map((r) => [r.id, r.day, r.group, r.amount, r.member])).toEqual([
      ["a:o1:0", "2026-11-01", "membership", 480000, "김회원"],
      ["a:o1:1", "2026-11-01", "rental", 20000, "김회원"],
      ["a:o2:0", "2026-10-21", "rental", 10000, ""],
    ]);
  });

  it("앱 결제 중복 빼기 — 같은 사람 · 같은 금액 · 브로제이 날짜가 하루 전 ~ 사흘 뒤면 브로제이 것만", () => {
    const row = (over: Partial<SalesRow>): SalesRow => ({
      id: "x", day: "2026-10-13", at: null, member: "김회원", product: "주3회 기간권 3개월", amount: 480000, method: "카드", src: "broj", group: "membership", refund: false, ...over,
    });
    const crm = [row({ id: "b:1", day: "2026-10-14", member: "김 회원" })];
    const app = [
      row({ id: "a:1", src: "app", day: "2026-10-13" }), // 브로제이 10/14 에 있음 → 뺌
      row({ id: "a:2", src: "app", day: "2026-10-13" }), // 같은 금액 두 번째 — 짝지을 줄이 없음 → 남김
      row({ id: "a:3", src: "app", day: "2026-10-13", amount: 220000 }), // 금액이 다름 → 남김
      row({ id: "a:4", src: "app", day: "2026-10-20", member: "" }), // 이름 모름 → 남김
      row({ id: "a:5", src: "app", day: "2026-10-09" }), // 브로제이 날짜가 사흘보다 뒤 → 남김
    ];
    expect(dedupeApp(app, crm).map((r) => r.id).sort()).toEqual(["a:2", "a:3", "a:4", "a:5"]);
    // 환불 줄과는 짝짓지 않는다
    expect(dedupeApp([app[0]], [row({ id: "b:2", day: "2026-10-14", amount: 480000, refund: true })]).map((r) => r.id)).toEqual(["a:1"]);
  });
});

describe("합계 · 흐름", () => {
  const r = (id: string, day: string, group: SalesRow["group"], amount: number): SalesRow => ({
    id, day, at: null, member: "", product: "", amount, method: "", src: "broj", group, refund: amount < 0,
  });
  const rows = [
    r("1", "2026-11-01", "membership", 480000),
    r("2", "2026-11-02", "pt", 990000),
    r("3", "2026-11-02", "membership", -180000),
    r("4", "2026-11-03", "rental", 10000),
    r("5", "2026-10-30", "pt", 350000),
  ];

  it("고른 달 — 순액 · 판매 건수 · 환불", () => {
    const s = summarize(rows.filter((x) => x.day.startsWith("2026-11")));
    expect(s.total).toBe(1300000);
    expect(s.count).toBe(3);
    expect([s.refund, s.refunds]).toEqual([-180000, 1]);
    expect(s.groups.membership).toEqual({ amount: 300000, count: 1, refund: -180000, refunds: 1 });
    expect(s.groups.pt).toEqual({ amount: 990000, count: 1, refund: 0, refunds: 0 });
    expect(s.groups.rental.amount).toBe(10000);
  });

  it("달마다 일반 · PT · 그 밖", () => {
    expect(trendOf(rows, ["2026-10", "2026-11"])).toEqual([
      { month: "2026-10", membership: 0, pt: 350000, other: 0, total: 350000 },
      { month: "2026-11", membership: 300000, pt: 990000, other: 10000, total: 1300000 },
    ]);
  });

  it("기간 · 한국 날짜", () => {
    expect(monthRange("2026-11", 6)).toEqual({
      from: "2026-06-01",
      to: "2026-11-30",
      months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"],
    });
    expect(monthRange("2027-02", 1)).toEqual({ from: "2027-02-01", to: "2027-02-28", months: ["2027-02"] });
    expect(monthRange("2027-01", 3).months).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(kstDay("2026-10-31T15:30:00Z")).toBe("2026-11-01");
    expect(kstDay(null)).toBe("");
  });
});

describe("화면 글", () => {
  it("만 원 · 몫 · 기준 시각", () => {
    expect(fmtMan(19_800_000)).toBe("1,980만 원");
    expect(fmtMan(525_000)).toBe("52.5만 원");
    expect(fmtMan(1_000_000)).toBe("100만 원");
    expect(fmtMan(9_000)).toBe("9,000원");
    expect(fmtMan(-480_000)).toBe("-48만 원");
    expect(fmtManParts(20_107_500)).toEqual({ num: "2,011", unit: "만 원" });
    expect(fmtManParts(9_000)).toEqual({ num: "9,000", unit: "원" });
    expect(fmtManParts(-525_000)).toEqual({ num: "-52.5", unit: "만 원" });
    expect(sharePct(300, 1000)).toBe(30);
    expect(sharePct(-5, 1000)).toBe(0);
    expect(sharePct(5, 0)).toBe(0);
    expect(syncedText("2026-11-02T15:05:48Z")).toBe("11월 3일 00:05");
  });

  it("거르기 · 그 밖 한 줄", () => {
    const base = { id: "", day: "", at: null, member: "", product: "", method: "", src: "broj" as const };
    expect(matchFilter({ ...base, amount: 1, group: "daily", refund: false }, "other")).toBe(true);
    expect(matchFilter({ ...base, amount: -1, group: "pt", refund: true }, "refund")).toBe(true);
    expect(matchFilter({ ...base, amount: 1, group: "pt", refund: false }, "membership")).toBe(false);
    const g = (amount: number, count: number) => ({ amount, count, refund: 0, refunds: 0 });
    expect(
      otherParts({ membership: g(1, 1), pt: g(1, 1), daily: g(0, 0), rental: g(20000, 2), goods: g(10000, 1), etc: g(0, 0) }).map((o) => o.label),
    ).toEqual(["락카 · 운동복", "용품"]);
  });
});
