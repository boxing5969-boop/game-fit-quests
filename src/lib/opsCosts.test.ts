import { describe, expect, it } from "vitest";
import {
  bizStores,
  branchKey,
  catLabel,
  costsByMonth,
  costSourceLine,
  defaultMonths,
  defaultStores,
  parseCsv,
  parseGagyebuCsv,
  profitOf,
  toSavePayload,
  topCats,
} from "./opsCosts";

// 153가계부 exportCsv 와 같은 모양 — BOM · CRLF · 쉼표 든 칸은 따옴표 · 글자 칸이 =+-@ 로 시작하면 ' 를 붙임
const HEAD = "날짜,구분,카테고리,헌금 종류,금액,메모,십일조 대상,십일조 기준 금액,귀속 월,고정비,장부,매장,통장,이동 종류,확인 필요";
const CSV =
  "﻿" +
  [
    HEAD,
    "2026-10-01,지출,임대료,,-5500000,10월 월세,,,,O,사업,153복싱짐 선릉역점,기업,,",
    '2026-10-05,지출,인건비,,-1650000,"김코치, 9월 급여",,,2026-09,,사업,153복싱짐 선릉역점,기업,,',
    "2026-10-05,지출,인건비,,-1200000,이코치,,,,,사업,153복싱짐 선릉역점,기업,,",
    "2026-10-07,지출,용품·장비,,-120000,글러브,,,,,사업,153복싱짐 선릉역점,기업,,",
    "2026-10-08,돌려받음,용품·장비,,30000,글러브 반품,,,,,사업,153복싱짐 선릉역점,기업,,",
    "2026-10-10,지출,카드대금,,-800000,,,,,,사업,선릉점,기업,,",
    "2026-10-11,지출,대출·금융,,-1000000,대출 상환,,,,,사업,153복싱짐 선릉역점,기업,,",
    "2026-10-12,이동,돈 이동,,-3000000,개인 통장으로,,,,,사업,,기업,사업↔개인,",
    "2026-10-15,수입,매장 매출,,2500000,카드 정산,O,,,,사업,153복싱짐 선릉역점,기업,,",
    "2026-10-20,지출,임대료,,-2000000,칠금 월세,,,,,사업,153복싱짐 칠금점,농협,,",
    "2026-10-21,지출,식비,,-15000,점심,,,,,개인,,,,",
    "2026-10-22,지출,세무·수수료,,-55000,'=카드 수수료,,,,,사업,,기업,,",
    "2026-11-02,지출,공과금·렌탈,,-210000,\"전기, 가스\",,,,,사업,153복싱짐 선릉역점,기업,,확인 필요",
  ].join("\r\n");

describe("가계부 CSV 읽기", () => {
  it("따옴표 · 쉼표 · CRLF · BOM", () => {
    expect(parseCsv('﻿a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2", "3"],
    ]);
    expect(parseCsv('x,"줄\n바꿈"\r\n')).toEqual([["x", "줄\n바꿈"]]);
  });

  it("가계부 파일 → 줄, 다른 파일은 안내", () => {
    const p = parseGagyebuCsv(CSV);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.total).toBe(13);
    expect(p.biz).toBe(12);
    expect(p.rows[1]).toMatchObject({ d: "2026-10-05", kind: "지출", cat: "인건비", amount: -1650000, fm: "2026-09", book: "사업", store: "153복싱짐 선릉역점" });
    expect(parseGagyebuCsv("이름,전화\n김,010").ok).toBe(false);
    expect(parseGagyebuCsv("").ok).toBe(false);
    // 엑셀에서 금액에 쉼표 · 날짜 점
    const ex = parseGagyebuCsv(`${HEAD}\n2026.10.3,지출,임대료,,"-1,000,000",,,,,,사업,선릉역점,,,`);
    expect(ex.ok && ex.rows[0]).toMatchObject({ d: "2026-10-03", amount: -1000000 });
  });
});

describe("매장 고르기", () => {
  const p = parseGagyebuCsv(CSV);
  const rows = p.ok ? p.rows : [];

  it("지점 이름 → 매장 낱말", () => {
    expect(branchKey("153복싱짐 선릉역점")).toBe("선릉");
    expect(branchKey("153복싱짐 칠금점")).toBe("칠금");
  });

  it("사업 지출의 매장 · 매장 없는 지출 · 이 지점으로 보이는 매장", () => {
    const s = bizStores(rows);
    expect(s.stores.map((x) => [x.name, x.n])).toEqual([
      ["153복싱짐 선릉역점", 7],
      ["153복싱짐 칠금점", 1],
      ["선릉점", 1],
    ]);
    expect(s.noStore).toBe(1); // 이동은 세지 않는다
    expect(defaultStores(s.stores, "153복싱짐 선릉역점")).toEqual(["153복싱짐 선릉역점", "선릉점"]);
    expect(defaultStores(s.stores, "153복싱짐 칠금점")).toEqual(["153복싱짐 칠금점"]);
  });
});

describe("달 · 항목별 비용", () => {
  const p = parseGagyebuCsv(CSV);
  const rows = p.ok ? p.rows : [];
  const stores = ["153복싱짐 선릉역점", "선릉점"];

  it("사업 · 고른 매장의 지출 − 돌려받음, 이동 · 수입 · 다른 매장 · 개인 · 대출은 빼고, 귀속 월", () => {
    const m = costsByMonth(rows, { stores, noStore: false, skip: ["loan"] });
    expect(m.map((x) => [x.month, x.total])).toEqual([
      ["2026-11", 210000],
      ["2026-10", 7590000],
      ["2026-09", 1650000],
    ]);
    expect(m[1].cats.map((c) => [c.k, c.label, c.amount, c.count])).toEqual([
      ["brent", "임대료", 5500000, 1],
      ["bpay", "인건비", 1200000, 1],
      ["card", "카드대금", 800000, 1],
      ["bsupply", "용품·장비", 90000, 1],
    ]);
  });

  it("매장 없는 지출 넣기 · 대출 넣기", () => {
    const m = costsByMonth(rows, { stores, noStore: true, skip: [] });
    const oct = m.find((x) => x.month === "2026-10")!;
    expect(oct.total).toBe(7590000 + 55000 + 1000000);
    expect(oct.cats.find((c) => c.k === "loan")?.label).toBe("대출·금융");
    expect(oct.cats.find((c) => c.k === "bfee")?.amount).toBe(55000);
  });

  it("저장 모양 · 처음 고를 달 · 순이익 · 위 항목", () => {
    const m = costsByMonth(rows, { stores, noStore: false, skip: ["loan"] });
    expect(toSavePayload(m)[1]).toEqual({
      month: "2026-10",
      cats: [
        { k: "brent", label: "임대료", amount: 5500000, count: 1 },
        { k: "bpay", label: "인건비", amount: 1200000, count: 1 },
        { k: "card", label: "카드대금", amount: 800000, count: 1 },
        { k: "bsupply", label: "용품·장비", amount: 90000, count: 1 },
      ],
    });
    expect(defaultMonths(m, "2026-11")).toEqual(["2026-10", "2026-09"]); // 이번 달(11월)은 처음엔 빼 둔다
    expect(defaultMonths(m, "2026-12", 1)).toEqual(["2026-11"]);
    expect(profitOf(20_000_000, 7_590_000)).toEqual({ profit: 12_410_000, pct: 62 });
    expect(profitOf(0, 100)).toEqual({ profit: -100, pct: null });
    expect(catLabel("bpay")).toBe("인건비");
    expect(catLabel("zzz")).toBe("기타");
    const t = topCats(
      [
        { label: "a", amount: 1 },
        { label: "b", amount: 5 },
        { label: "c", amount: 3 },
      ],
      2,
    );
    expect(t.top.map((x) => x.label)).toEqual(["b", "c"]);
    expect(t.rest).toEqual({ n: 1, amount: 1 });
  });
});

describe("순이익 카드 아래 줄", () => {
  const base = { stores: [] as string[], no_store: false, excluded: [] as string[] };
  it("가계부 CSV — 매장 · 매장 없음 · 대출 뺌 (예전 그대로)", () => {
    expect(costSourceLine({ ...base, stores: ["153복싱짐 선릉역점"], no_store: true, excluded: ["loan", "save"] }, "11월 4일")).toBe(
      "가계부 11월 4일 올림 · 선릉역점, 매장 없음 · 대출 뺌",
    );
    expect(costSourceLine({ ...base, source: "gagyebu_csv" }, "11월 4일")).toBe("가계부 11월 4일 올림");
  });
  it("통장 내역서 — 뺀 묶음은 가장 큰 것 하나 + 가짓수", () => {
    expect(costSourceLine({ ...base, source: "bank_statement" }, "11월 4일")).toBe("통장 내역 11월 4일 정리");
    expect(costSourceLine({ ...base, source: "bank_statement", excluded: ["카드 대금"] }, "11월 4일")).toBe("통장 내역 11월 4일 정리 · 카드 대금 뺌");
    expect(costSourceLine({ ...base, source: "bank_statement", excluded: ["카드 대금", "법무법인", " "] }, "11월 4일")).toBe(
      "통장 내역 11월 4일 정리 · 카드 대금 등 2가지 뺌",
    );
  });
});
