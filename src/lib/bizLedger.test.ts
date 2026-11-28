import { describe, expect, it } from "vitest";

import {
  bankFp,
  bizCatLabel,
  catsForKind,
  classifyBankRows,
  cleanParty,
  matchBizFilter,
  matchRule,
  parseBankCsv,
  parseBankTable,
  parseGagyebuBook,
  prevMonth,
  sha1Hex,
  summarizeMonth,
  toWon,
  whtOf,
  type BizEntry,
  type BizRule,
} from "./bizLedger";

// 모두 지어낸 자료 (실제 통장 · 이름 아님)

describe("sha1Hex", () => {
  it("표준 값과 같다", () => {
    expect(sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1Hex("가계부")).toBe("1770eeb9fbdd38d80abd6b9f61d305bce3e1dc3a");
    expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });
});

describe("bankFp", () => {
  it("거래 일시 · 금액 · 잔액이 같으면 같은 지문 (서버에 넣어 둔 줄과 같은 공식)", () => {
    expect(bankFp("2026-01-02 10:00:00", -12345, 678900, "아무개")).toBe("tb45829f4731baa7ad47c6");
    expect(bankFp("2026-01-02 10:00:00", 50000, 728900, "")).toBe("tb86ceb7840d7d41f83fee");
  });
  it("잔액이 없으면 상대 이름 · 같은 줄은 번호로 나눈다", () => {
    const a = bankFp("2026-01-02", -1000, null, "가게");
    expect(a).not.toBe(bankFp("2026-01-02", -1000, null, "다른 가게"));
    expect(a).not.toBe(bankFp("2026-01-02", -1000, null, "가게", 2));
  });
});

describe("whtOf — 3.3%", () => {
  it("소득세 3% + 지방소득세 0.3%, 10원 미만 버림", () => {
    expect(whtOf(1_000_000)).toEqual({ tax: 33_000, net: 967_000 });
    expect(whtOf(123_456)).toEqual({ tax: 4_070, net: 119_386 }); // 3,700 + 370
  });
  it("소득세가 1,000원이 안 되면 떼지 않는다", () => {
    expect(whtOf(30_000)).toEqual({ tax: 0, net: 30_000 });
  });
});

describe("cleanParty", () => {
  it("카드사 정산의 가맹점 번호를 빼고 이름으로", () => {
    expect(cleanParty("KB12345678")).toBe("카드 매출 정산(KB국민)");
    expect(cleanParty("현123456789")).toBe("카드 매출 정산(현대)");
    expect(cleanParty("123456789B")).toBe("카드 매출 정산(BC)");
    expect(cleanParty("0123456789")).toBe("카드 매출 정산");
  });
  it("그 밖의 긴 숫자만 뺀다", () => {
    expect(cleanParty("LGU+98765432")).toBe("LGU+");
    expect(cleanParty("  홍길동  ")).toBe("홍길동");
    expect(cleanParty("11월전기료")).toBe("11월전기료");
  });
});

describe("toWon", () => {
  it("여러 모양의 금액", () => {
    expect(toWon("1,234")).toBe(1234);
    expect(toWon("-1,234원")).toBe(-1234);
    expect(toWon("−500")).toBe(-500);
    expect(toWon("(2,000)")).toBe(-2000);
    expect(Number.isNaN(toWon(""))).toBe(true);
  });
});

describe("parseBankTable", () => {
  it("토스뱅크 모양 — 금액 한 칸(부호) · 잔액 · 적요 · 계좌번호는 읽지 않음", () => {
    const t = [
      ["거래내역서"],
      ["거래 일시", "적요", "거래 유형", "거래 기관", "계좌번호", "거래 금액", "거래 후 잔액", "메모"],
      ["2026.01.10 09:30:00", "홍길동", "출금", "가나은행", "000-0000-0000", "-500,000", "1,500,000", ""],
      ["2026.01.10 12:00:05", "KB12345678", "입금", "", "", "300,000", "1,800,000", ""],
      ["합계", "", "", "", "", "", "", ""],
    ];
    const r = parseBankTable(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ dt: "2026-01-10 09:30:00", amount: -500000, balance: 1500000, party: "홍길동", type: "출금" });
    expect(r.rows[1]).toMatchObject({ amount: 300000, party: "카드 매출 정산(KB국민)" });
    expect(JSON.stringify(r.rows)).not.toContain("000-0000-0000");
    expect(r.skipped).toBe(1);
  });
  it("입금 · 출금 두 칸 · 날짜와 시간이 따로", () => {
    const csv = "거래일자,거래시간,적요,출금액,입금액,잔액\n2026-02-03,14:05,가게,12000,,88000\n2026-02-04,09:00:30,손님,,50000,138000\n";
    const r = parseBankCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toMatchObject({ dt: "2026-02-03 14:05:00", amount: -12000, balance: 88000 });
    expect(r.rows[1]).toMatchObject({ dt: "2026-02-04 09:00:30", amount: 50000 });
  });
  it("금액에 부호가 없으면 거래 유형으로 나간 돈을 알아본다", () => {
    const r = parseBankTable([
      ["거래일시", "구분", "거래금액", "잔액", "내용"],
      ["2026-03-01 10:00:00", "체크카드결제", "9,900", "90,100", "편의점"],
      ["2026-03-02 10:00:00", "입금", "10,000", "100,100", "손님"],
    ]);
    expect(r.ok && r.rows.map((x) => x.amount)).toEqual([-9900, 10000]);
  });
  it("통장 파일이 아니면 알려 준다", () => {
    const r = parseBankTable([["이름", "전화"], ["가", "010"]]);
    expect(r.ok).toBe(false);
  });
});

const RULES: BizRule[] = [
  { keyword: "홍길동", kind: "out", cat: "bpay", staff_id: "s1" },
  { keyword: "전기료", kind: "out", cat: "butil", staff_id: null },
  { keyword: "카드 매출 정산", kind: "in", cat: "sales", staff_id: null },
  { keyword: "대표", kind: "move", cat: "move", staff_id: null },
  { keyword: "대표_페이", kind: "out", cat: "bsend", staff_id: null },
];

describe("matchRule", () => {
  it("가장 긴 낱말 · 방향이 맞는 규칙", () => {
    expect(matchRule(RULES, "대표_페이 결제", false)?.cat).toBe("bsend");
    expect(matchRule(RULES, "대표 이체", true)?.kind).toBe("move");
    expect(matchRule(RULES, "홍길동", true)).toBeNull(); // 지출 규칙은 들어온 돈에 안 맞는다
    expect(matchRule(RULES, "모르는 곳", false)).toBeNull();
  });
});

describe("classifyBankRows", () => {
  const rows = [
    { dt: "2026-04-10 10:00:00", day: "2026-04-10", amount: -2_000_000, balance: 5_000_000, party: "홍길동", type: "출금", note: "" },
    { dt: "2026-04-20 10:00:00", day: "2026-04-20", amount: -300_000, balance: 4_700_000, party: "홍길동", type: "출금", note: "" },
    { dt: "2026-04-25 10:00:00", day: "2026-04-25", amount: -80_000, balance: 4_620_000, party: "4월전기료", type: "지로출금", note: "" },
    { dt: "2026-04-26 10:00:00", day: "2026-04-26", amount: 500_000, balance: 5_120_000, party: "카드 매출 정산(KB국민)", type: "입금", note: "" },
    { dt: "2026-04-27 10:00:00", day: "2026-04-27", amount: -7_000, balance: 5_113_000, party: "처음 보는 가게", type: "체크카드결제", note: "" },
  ];
  const out = classifyBankRows(rows, RULES, { account: "테스트 통장", payAccrual: true });
  it("1~15일 급여는 지난달 몫 · 16일 뒤는 그 달", () => {
    expect(out[0]).toMatchObject({ kind: "out", cat: "bpay", month: "2026-03", staff_id: "s1" });
    expect(out[1]).toMatchObject({ cat: "bpay", month: "2026-04" });
  });
  it("규칙 · 들어온 돈 · 모르는 나간 돈(기타 · 확인 필요)", () => {
    expect(out[2]).toMatchObject({ kind: "out", cat: "butil", review: false });
    expect(out[3]).toMatchObject({ kind: "in", cat: "sales" });
    expect(out[4]).toMatchObject({ kind: "out", cat: "etc", review: true });
    expect(out[4].memo).toContain("확인 필요");
    expect(out.every((r) => r.account === "테스트 통장" && r.amount > 0 && r.fp.startsWith("tb"))).toBe(true);
  });
  it("급여를 일한 달로 안 하면 보낸 달", () => {
    expect(classifyBankRows(rows.slice(0, 1), RULES, { account: "", payAccrual: false })[0].month).toBe("2026-04");
  });
  it("같은 파일을 다시 읽어도 지문이 같다", () => {
    const again = classifyBankRows(rows, RULES, { account: "다른 이름", payAccrual: true });
    expect(again.map((r) => r.fp)).toEqual(out.map((r) => r.fp));
  });
});

describe("parseGagyebuBook", () => {
  const csv = [
    "날짜,구분,카테고리,헌금 종류,금액,메모,십일조 대상,십일조 기준 금액,귀속 월,고정비,장부,매장,통장,이동 종류,확인 필요",
    "2026-05-03,지출,임대료,,-1000000,5월 월세,,,,고정,사업,가나점,사업 통장,,",
    "2026-05-10,지출,인건비,,-500000,4월 급여,,,2026-04,,사업,가나점,사업 통장,,",
    "2026-05-11,돌려받음,용품·장비,,30000,반품,,,,,사업,,사업 통장,,",
    "2026-05-12,지출,식비,,-12000,점심,,,,,개인,,,,",
    "2026-05-13,지출,식비,,-12000,점심,,,,,개인,,,,",
  ].join("\n");
  it("사업 장부만 · 귀속 월 · 돌려받음", () => {
    const r = parseGagyebuBook(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ kind: "out", cat: "brent", month: "2026-05", amount: 1_000_000, party: "5월 월세" });
    expect(r.rows[1]).toMatchObject({ cat: "bpay", month: "2026-04" });
    expect(r.rows[2]).toMatchObject({ kind: "back", cat: "bsupply", amount: 30_000 });
    expect(r.storeOf).toEqual(["가나점", "가나점", ""]);
    expect(r.stores).toEqual([{ name: "가나점", n: 2 }]);
    expect(r.noStore).toBe(1);
    expect(new Set(r.rows.map((x) => x.fp)).size).toBe(3);
  });
  it("가계부 파일이 아니면 알려 준다", () => {
    expect(parseGagyebuBook("이름,전화\n가,010").ok).toBe(false);
  });
});

const E = (p: Partial<BizEntry>): BizEntry => ({
  id: Math.random().toString(36).slice(2),
  day: "2026-06-01",
  month: "2026-06",
  kind: "out",
  cat: "etc",
  amount: 0,
  n: 1,
  party: "",
  memo: "",
  account: "",
  staff_id: null,
  staff_name: null,
  wht: null,
  source: "manual",
  ...p,
});

describe("summarizeMonth", () => {
  const entries = [
    E({ cat: "bpay", amount: 2_000_000, staff_name: "코치가" }),
    E({ cat: "bpay", amount: 500_000, party: "코치나" }),
    E({ cat: "bpay", amount: 300_000, staff_name: "코치가" }),
    E({ cat: "brent", amount: 1_000_000 }),
    E({ kind: "back", cat: "bsupply", amount: 30_000 }),
    E({ cat: "bsupply", amount: 100_000 }),
    E({ kind: "in", cat: "sales", amount: 9_000_000 }),
    E({ kind: "move", cat: "move", amount: 700_000, memo: "체크카드결제 · 확인 필요" }),
    E({ cat: "bad", amount: 120_000, n: 3, source: "summary" }),
  ];
  const s = summarizeMonth(entries);
  it("비용 = 지출 − 돌려받음 · 수입 · 이동은 따로", () => {
    expect(s.cost).toBe(2_000_000 + 500_000 + 300_000 + 1_000_000 - 30_000 + 100_000 + 120_000);
    expect(s.inn).toBe(9_000_000);
    expect(s.move).toBe(700_000);
    expect(s.review).toBe(1);
  });
  it("항목 큰 것부터 · 인건비 사람별", () => {
    expect(s.cats[0]).toMatchObject({ k: "bpay", amount: 2_800_000, count: 3 });
    expect(s.cats.find((c) => c.k === "bsupply")).toMatchObject({ amount: 70_000, count: 1 });
    expect(s.cats.find((c) => c.k === "bad")?.count).toBe(3);
    expect(s.pay).toEqual([
      { name: "코치가", amount: 2_300_000, count: 2 },
      { name: "코치나", amount: 500_000, count: 1 },
    ]);
  });
});

describe("작은 도우미", () => {
  it("지난달 · 항목 이름 · 구분별 항목 · 거르기", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-11")).toBe("2026-10");
    expect(bizCatLabel("bad")).toBe("광고·마케팅");
    expect(bizCatLabel("zzz")).toBe("기타");
    expect(catsForKind("in").map((c) => c.k)).toEqual(["etc", "sales", "subsidy"]);
    expect(catsForKind("move").map((c) => c.k)).toEqual(["move"]);
    expect(matchBizFilter({ kind: "back", memo: "" }, "out")).toBe(true);
    expect(matchBizFilter({ kind: "move", memo: "확인 필요" }, "review")).toBe(true);
  });
});
