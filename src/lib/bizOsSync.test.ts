import { describe, expect, it } from "vitest";
import {
  buildOsMonth,
  excludeLabel,
  isEmptyMonth,
  isLedgerMemo,
  ledgerMemo,
  monthStart,
  payLabel,
  pickRule,
  sameMonth,
  type BizOsPayload,
  type OsRule,
} from "../../supabase/functions/biz-os-sync/logic.ts";

// 시험용 이름 · 금액은 모두 지어낸 것
const RULES: OsRule[] = [
  { keyword: "가지점장", kind: "labor", label: "지점장 급여", sort_order: 20 },
  { keyword: "나코치", kind: "labor", label: "코치 급여", sort_order: 21 },
  { keyword: "다코치", kind: "labor", label: "코치 급여(퇴사)", sort_order: 25 },
  { keyword: "대표님", kind: "exclude", label: "대표 이체", sort_order: 95 },
  { keyword: "카드사", kind: "exclude", label: "카드 환불(매출에 이미 반영)", sort_order: 80 },
  { keyword: "지방소득세", kind: "exclude", label: "종합소득세·지방소득세", sort_order: 81 },
  { keyword: "지로출금", kind: "exclude", label: "세금(종합소득세·원천세)", sort_order: 99 },
  { keyword: "가게결제", kind: "variable", label: "가게 구매", sort_order: 57 },
  { keyword: "건물주", kind: "rent", label: "임대료", sort_order: 10 },
];

describe("pickRule", () => {
  it("같은 kind 만 · sort_order 작은 것이 먼저", () => {
    expect(pickRule("지방세 지방소득세(종합소득) 지로출금", RULES, "exclude")?.label).toBe("종합소득세·지방소득세");
    expect(pickRule("국세청 신고분 지로출금", RULES, "exclude")?.label).toBe("세금(종합소득세·원천세)");
    expect(pickRule("가게결제 펌뱅킹출금", RULES, "exclude")).toBeNull();
    expect(pickRule("", RULES, "exclude")).toBeNull();
  });
  it("sort_order 가 같으면 긴 키워드", () => {
    const r: OsRule[] = [
      { keyword: "코치", kind: "labor", label: "짧은", sort_order: 1 },
      { keyword: "나코치", kind: "labor", label: "긴", sort_order: 1 },
    ];
    expect(pickRule("나코치", r, "labor")?.label).toBe("긴");
  });
  it("빈 키워드 · 빈 이름 규칙은 안 쓴다", () => {
    const r: OsRule[] = [
      { keyword: " ", kind: "labor", label: "빈 키워드", sort_order: 1 },
      { keyword: "나코치", kind: "labor", label: " ", sort_order: 1 },
    ];
    expect(pickRule("나코치", r, "labor")).toBeNull();
  });
});

describe("payLabel · excludeLabel", () => {
  it("급여 — 달 합계 · 이름 없음 · 규칙 · 규칙 없음", () => {
    expect(payLabel("월 합계", RULES)).toBe("급여(월 합계)");
    expect(payLabel("", RULES)).toBe("급여(월 합계)");
    expect(payLabel("가지점장", RULES)).toBe("지점장 급여");
    expect(payLabel("다코치", RULES)).toBe("코치 급여(퇴사)");
    expect(payLabel("새코치", RULES)).toBe("코치 급여");
  });
  it("뺀 돈 — 상대 이름 + 적요, 없으면 개인 사용", () => {
    expect(excludeLabel("대표님(지점", "출금", RULES)).toBe("제외: 대표 이체");
    expect(excludeLabel("카드사(주)", "출금", RULES)).toBe("제외: 카드 환불(매출에 이미 반영)");
    expect(excludeLabel("국세청 신고분", "지로출금", RULES)).toBe("제외: 세금(종합소득세·원천세)");
    expect(excludeLabel("동네 편의점", "체크카드결제", RULES)).toBe("제외: 개인 사용");
  });
  it("규칙이 없으면 회사로 보낸 이체는 법인 이체, 회사 가게 카드 결제는 개인 사용", () => {
    expect(excludeLabel("주식회사가나다", "출금", RULES)).toBe("제외: 법인 이체");
    expect(excludeLabel("가나다(주)", "오픈뱅킹", RULES)).toBe("제외: 법인 이체");
    expect(excludeLabel("㈜가나다", "펌뱅킹출금", RULES)).toBe("제외: 법인 이체");
    expect(excludeLabel("(주)놀이공원", "체크카드결제", RULES)).toBe("제외: 개인 사용");
    // 규칙이 먼저 — 회사 이름이어도 규칙에 걸리면 규칙 이름
    expect(excludeLabel("카드사(주)", "출금", RULES)).toBe("제외: 카드 환불(매출에 이미 반영)");
  });
});

const MONTH: BizOsPayload = {
  ok: true,
  live: true,
  branch: "시험 지점",
  month: "2026-10",
  n: 20,
  cats: [
    { cat: "brent", label: "임대료", amt: 2_000_000 },
    { cat: "butil", label: "공과금·렌탈", amt: 300_000 },
    { cat: "bins", label: "4대보험", amt: 50_000 },
    { cat: "bad", label: "광고·마케팅", amt: 700_000 },
    { cat: "brefund", label: "회원 환불(통장)", amt: 30_000 },
    { cat: "food", label: "식비", amt: 12_000 },
    { cat: "phone", label: "통신·구독", amt: 0 },
  ],
  pay: [
    { who: "가지점장", amt: 3_000_000 },
    { who: "나코치", amt: 500_000 },
    { who: "새코치", amt: 400_000 },
    { who: "다코치", amt: 100_000 },
  ],
  mv: [
    { party: "대표님(지점", memo: "출금", amt: 1_000_000 },
    { party: "동네 편의점", memo: "체크카드결제", amt: 5_000 },
    { party: "동네 식당", memo: "체크카드결제", amt: 15_000 },
    { party: "카드사(주)", memo: "출금", amt: 80_000 },
  ],
};

describe("buildOsMonth", () => {
  const m = buildOsMonth(MONTH, RULES);
  it("칸 합계 — 임대료 · 고정 · 유동 · 인건비 · 제외", () => {
    expect(m.rent).toBe(2_000_000);
    expect(m.fixed).toBe(350_000);
    expect(m.variable).toBe(742_000);
    expect(m.labor).toBe(4_000_000);
    expect(m.excluded).toBe(1_100_000);
  });
  it("줄 — 같은 이름은 합치고(코치 급여 = 나코치 + 새코치) 0원 줄은 뺀다", () => {
    const find = (label: string) => m.items.find((i) => i.label === label);
    expect(find("코치 급여")).toEqual({ group: "인건비", label: "코치 급여", amount: 900_000 });
    expect(find("임대료")?.group).toBe("고정");
    expect(find("식비")?.group).toBe("유동");
    expect(find("통신·구독")).toBeUndefined();
    expect(find("제외: 개인 사용")?.amount).toBe(20_000);
  });
  it("줄 순서 — 비용은 큰 금액부터, 제외 줄은 맨 뒤", () => {
    const labels = m.items.map((i) => i.label);
    expect(labels[0]).toBe("지점장 급여");
    const firstEx = labels.findIndex((l) => l.startsWith("제외: "));
    expect(labels.slice(firstEx).every((l) => l.startsWith("제외: "))).toBe(true);
    expect(labels.slice(0, firstEx).some((l) => l.startsWith("제외: "))).toBe(false);
  });
  it("칸 합계 = 줄 합계 (제외 빼고 · 임대료는 고정 줄에도 있음)", () => {
    const sumOf = (g: string) => m.items.filter((i) => i.group === g && !i.label.startsWith("제외: ")).reduce((s, i) => s + i.amount, 0);
    expect(sumOf("고정")).toBe(m.rent + m.fixed);
    expect(sumOf("유동")).toBe(m.variable);
    expect(sumOf("인건비")).toBe(m.labor);
  });
  it("인건비 항목(bpay)이 cats 로 와도 두 번 세지 않는다", () => {
    const again = buildOsMonth({ ...MONTH, cats: [...(MONTH.cats ?? []), { cat: "bpay", label: "인건비", amt: 4_000_000 }] }, RULES);
    expect(again.labor).toBe(4_000_000);
    expect(again.variable).toBe(742_000);
  });
  it("돌려받음이 더 큰 항목(음수)도 그대로 — 가계부와 같은 숫자", () => {
    const neg = buildOsMonth({ ok: true, cats: [{ cat: "bsupply", label: "용품·장비", amt: -20_000 }] }, RULES);
    expect(neg.variable).toBe(-20_000);
    expect(neg.items).toEqual([{ group: "유동", label: "용품·장비", amount: -20_000 }]);
  });
});

describe("isEmptyMonth · sameMonth", () => {
  it("빈 달", () => {
    expect(isEmptyMonth({ ok: true, cats: [], pay: [], mv: [] })).toBe(true);
    expect(isEmptyMonth({ ok: true })).toBe(true);
    expect(isEmptyMonth({ ok: true, mv: [{ party: "x", memo: "출금", amt: 1 }] })).toBe(false);
  });
  it("숫자 · 줄이 같으면 같다(줄 순서는 상관없음)", () => {
    const m = buildOsMonth(MONTH, RULES);
    const db = { ...m, items: [...m.items].reverse() };
    expect(sameMonth(m, db)).toBe(true);
    expect(sameMonth(m, { ...db, excluded: m.excluded + 1 })).toBe(false);
    expect(sameMonth(m, { ...db, items: db.items.slice(1) })).toBe(false);
    expect(sameMonth(m, null)).toBe(false);
  });
});

describe("메모 · 달", () => {
  it("메모 머리말로 우리 줄을 알아본다", () => {
    const memo = ledgerMemo(new Date("2026-11-28T03:41:00Z"));
    expect(memo).toContain("자동 맞춤 2026-11-28 12:41");
    expect(isLedgerMemo(memo)).toBe(true);
    expect(isLedgerMemo("마이복서153 사업자 가계부 기준(2026-11-28 맞춤)")).toBe(true);
    expect(isLedgerMemo("거래내역서 10월")).toBe(false);
    expect(isLedgerMemo(null)).toBe(false);
    expect(memo.length).toBeLessThanOrEqual(300);
  });
  it("monthStart", () => {
    expect(monthStart("2026-11")).toBe("2026-11-01");
    expect(monthStart("2026-11-01")).toBe("2026-11-01");
  });
});
