import { describe, expect, it } from "vitest";
import {
  addMonths,
  computeAllRenew,
  computeLeaderKpi,
  isPassProduct,
  matchMembers,
  normName,
  productMonths,
  type RegRow,
} from "../../supabase/functions/_shared/leaderKpi.ts";

const A = "153복싱짐 선릉역점";
const row = (day: string, member: string, product: string, kind: string, amount = 220000, branch = A): RegRow => ({
  day,
  member,
  product,
  kind,
  amount,
  branch,
});

describe("productMonths · isPassProduct", () => {
  it("상품 이름에서 개월 수", () => {
    expect(productMonths("153복싱짐 프리미엄 무제한 3개월 수강권")).toBe(3);
    expect(productMonths("복싱3개월+1개월")).toBe(4);
    expect(productMonths("복싱6개월+2개월")).toBe(8);
    expect(productMonths("153복싱짐 주3회 횟수권 5개월 횟수권")).toBe(5);
    expect(productMonths("153복싱짐 일일 이용권")).toBe(0);
    expect(productMonths("vip창립 멤버쉽 회원권 15% 평생할인")).toBeNull();
  });
  it("PT · 락커 · 운동복은 수강권이 아니다", () => {
    expect(isPassProduct("퍼스널 트레이닝 20회권")).toBe(false);
    expect(isPassProduct("개인락커 1개월권")).toBe(false);
    expect(isPassProduct("운동복 1개월권")).toBe(false);
    expect(isPassProduct("153복싱짐 1개월 주3회 기간권")).toBe(true);
  });
  it("이름 · 달 계산", () => {
    expect(normName(" 김 철수 ")).toBe("김철수");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", -6)).toBe("2026-05");
  });
});

describe("computeLeaderKpi", () => {
  const rows: RegRow[] = [
    row("2026-05-01", "김철수", "153복싱짐 1개월 주3회 기간권", "new"),
    row("2026-06-10", "김 철수", "153복싱짐 프리미엄 무제한 3개월 수강권", "renew", 480000),
    row("2026-05-10", "이영희", "153복싱짐 1개월 주3회 기간권", "new"),
    row("2026-08-01", "이영희", "153복싱짐 1개월 주3회 기간권", "renew"),
    row("2026-06-01", "박민수", "153복싱짐 프리미엄 무제한 3개월 수강권", "new"),
    row("2026-06-01", "최지훈", "153복싱짐 1개월 주3회 기간권", "renew"),
    row("2026-10-20", "정하나", "153복싱짐 1개월 주3회 기간권", "new"),
    row("2026-11-03", "한별", "153복싱짐 1개월 주3회 기간권", "new"),
    row("2026-11-20", "한별", "153복싱짐 일일 이용권", "renew"),
    row("2026-06-02", "오지수", "퍼스널 트레이닝 20회권", "new", 1000000),
    row("2026-06-03", "윤서연", "153복싱짐 1개월 주3회 기간권", "refund", -220000),
    row("2026-05-01", "김철수", "153복싱짐 1개월 주3회 기간권", "new", 220000, "153복싱짐 칠금점"),
  ];
  const { kpi, members } = computeLeaderKpi(rows, A, "2026-11-26");

  it("최근 6개월 — 끝나고 30일 지난 신규만, 30일 안 재등록 비율", () => {
    // 김(5/31 끝 · 6/10 재등록 ✓) · 이(6/9 끝 · 8/1 재등록 — 30일 넘음) · 박(8/30 끝 · 재등록 없음) · 정(11/19 끝 — 아직 30일 안 지남)
    expect(kpi.recent.n).toBe(3);
    expect(kpi.recent.renewed30).toBe(1);
    expect(kpi.recent.rate).toBe(33.3);
  });

  it("달마다 — 이번 달 · 다음 달", () => {
    const may = kpi.months.find((m) => m.month === "2026-05");
    expect(may).toMatchObject({ n: 1, renewed30: 1, renewed: 1 });
    const jun = kpi.months.find((m) => m.month === "2026-06");
    expect(jun).toMatchObject({ n: 1, renewed30: 0, renewed: 1 });
    const aug = kpi.months.find((m) => m.month === "2026-08");
    expect(aug).toMatchObject({ n: 1, expiredOpen: 1 });
    expect(kpi.current).toMatchObject({ month: "2026-11", n: 1, open: 0, expiredOpen: 1 });
    // 한별 — 11/3 + 30일 = 12/3 끝 · 일일권은 재등록이 아니다
    expect(kpi.next).toMatchObject({ month: "2026-12", n: 1, open: 1, renewed: 0 });
    expect(kpi.months).toHaveLength(8);
  });

  it("다른 지점 · PT · 환불 · 일일권은 빼고, 첫 수강권 표시", () => {
    const by = Object.fromEntries(members.map((m) => [m.name, m]));
    expect(by["김철수"]).toMatchObject({ paidCount: 2, firstTerm: false });
    expect(by["박민수"]).toMatchObject({ paidCount: 1, firstTerm: true });
    expect(by["최지훈"]).toMatchObject({ firstTerm: false });
    expect(by["한별"]).toMatchObject({ paidCount: 1, firstTerm: true });
    expect(by["오지수"]).toBeUndefined();
    expect(by["윤서연"]).toBeUndefined();
    expect(kpi.avgRenewAmount).toBe(Math.round((480000 + 220000 + 220000) / 3));
  });
});

describe("computeAllRenew — 재등록률(전체 회원 · 관장님 홈)", () => {
  const P1 = "153복싱짐 1개월 주3회 기간권";
  const rows: RegRow[] = [
    // 갑 — 8/1 산 것이 8/31 끝 · 8/25 미리 연장(8/31 다음부터 → 9/30 끝) · 10/20 다시(11/19 끝)
    row("2026-08-01", "갑", P1, "new"),
    row("2026-08-25", "갑", P1, "renew"),
    row("2026-10-20", "갑", P1, "renew"),
    // 을 — 10/5 끝 · 다시 안 옴
    row("2026-09-05", "을", P1, "new"),
    // 병 — 같은 날 두 줄(1개월 + 1개월) = 2개월 → 11/14 끝
    row("2026-09-15", "병", P1, "new"),
    row("2026-09-15", "병", P1, "renew"),
    // 정 — 10/20 끝 · 11/25 늦게 다시(30일 넘음)
    row("2026-09-20", "정", P1, "new"),
    row("2026-11-25", "정", P1, "renew"),
    // 경 — 11/29 끝 · 아직 안 끝남
    row("2026-10-30", "경", P1, "new"),
    // 빼는 것 — PT · 다른 지점 · 환불
    row("2026-09-05", "기", "퍼스널 트레이닝 20회권", "new", 1000000),
    row("2026-09-05", "을", P1, "renew", 220000, "153복싱짐 칠금점"),
    row("2026-10-01", "을", P1, "refund", -220000),
  ];
  const all = computeAllRenew(rows, A, "2026-11-26");
  const by = Object.fromEntries(all.months.map((m) => [m.month, m]));

  it("미리 산 수강권은 앞 끝 다음부터 이어 붙이고, 30일 안 다시 결제를 센다", () => {
    expect(by["2026-08"]).toMatchObject({ n: 1, renewed30: 1, rate: 100, complete: true });
    expect(by["2026-09"]).toMatchObject({ n: 1, renewed30: 1, complete: true, settleOn: "2026-10-31" });
  });

  it("지난달 — 30일 넘긴 늦은 재등록은 놓친 것 · 확정 전이면 확정 날짜", () => {
    expect(all.prev).toMatchObject({ month: "2026-10", n: 2, renewed30: 0, renewed: 1, lost: 2, rate: 0, complete: false, settleOn: "2026-12-01" });
    expect(all.prev2.month).toBe("2026-09");
  });

  it("이번 달 — 같은 날 두 줄은 하나로 · 아직 안 끝남 / 끝나고 기다리는 중", () => {
    expect(all.current).toMatchObject({ month: "2026-11", n: 3, renewed30: 0, open: 1, waiting: 2, lost: 0 });
    for (const m of all.months) expect(m.renewed30 + m.open + m.waiting + m.lost).toBe(m.n);
    expect(all.months).toHaveLength(7);
    expect(all.months[0].month).toBe("2026-05");
  });
});

describe("matchMembers", () => {
  it("같은 지점에 이름이 하나뿐인 회원만 맞춘다", () => {
    const out = matchMembers(
      [
        { name: "김철수", firstPaid: "2026-05-01", lastPaid: "2026-06-10", paidCount: 2, firstTerm: false },
        { name: "박민수", firstPaid: "2026-06-01", lastPaid: "2026-06-01", paidCount: 1, firstTerm: true },
      ],
      [
        { user_id: "u1", name: "김 철수" },
        { user_id: "u2", name: "박민수" },
        { user_id: "u3", name: "박민수" },
      ],
    );
    expect(out).toEqual([{ userId: "u1", member: expect.objectContaining({ name: "김철수" }) }]);
  });
});
