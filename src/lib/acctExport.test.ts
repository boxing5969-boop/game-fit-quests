import { describe, expect, it } from "vitest";
import { costBlocks, memberBlocks, opsAcctWorkbook, salesBlocks, type CostRow, type RegRow } from "./acctExport";
import type { SalesReport, SalesRow } from "./opsSales";

/** 저장 방식 ZIP 풀기 — 이름 → 글 */
function unzipStore(bytes: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  let p = 0;
  while (p + 30 <= bytes.length && dv.getUint32(p, true) === 0x04034b50) {
    const size = dv.getUint32(p + 18, true);
    const nameLen = dv.getUint16(p + 26, true);
    const extra = dv.getUint16(p + 28, true);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    out.set(name, dec.decode(bytes.subarray(start, start + size)));
    p = start + size;
  }
  return out;
}

// 지어낸 숫자 · 이름(저장소 공개)
const BR = "153복싱짐 시험점";

const g = (amount: number, count = 1) => ({ amount, count, refund: 0, refunds: 0 });
const row = (over: Partial<SalesRow>): SalesRow => ({
  id: Math.random().toString(36).slice(2),
  day: "2026-03-05",
  at: null,
  member: "가",
  product: "1개월",
  amount: 100_000,
  method: "카드",
  src: "broj",
  group: "membership",
  refund: false,
  ...over,
});
const report = (month: string, rows: SalesRow[]): SalesReport => {
  const sum = (f: (r: SalesRow) => boolean) => rows.filter(f).reduce((t, r) => t + r.amount, 0);
  return {
    branch: BR,
    month,
    src: "broj",
    synced_at: null,
    app_added: 0,
    summary: {
      total: sum(() => true),
      count: rows.length,
      refund: sum((r) => r.refund),
      refunds: rows.filter((r) => r.refund).length,
      groups: {
        membership: g(sum((r) => r.group === "membership")),
        pt: g(sum((r) => r.group === "pt")),
        daily: g(0, 0),
        rental: g(sum((r) => r.group === "rental"), rows.filter((r) => r.group === "rental").length),
        goods: g(0, 0),
        etc: g(0, 0),
      },
    },
    trend: [],
    rows,
    truncated: false,
  };
};

describe("153운영본부 회계관리 엑셀", () => {
  it("회원 칸 — 신규 · 재등록 · 기간별, 일일권 · 다른 지점 · 다른 달 빼기", () => {
    const regs: RegRow[] = [
      { day: "2026-03-02", branch: BR, product: "프리미엄 무제한 1개월 수강권", kind: "new" },
      { day: "2026-03-03", branch: BR, product: "프리미엄 무제한 3개월 수강권", kind: "renew" },
      { day: "2026-03-04", branch: BR, product: "일일 이용권", kind: "new" },
      { day: "2026-03-04", branch: "다른점", product: "1개월", kind: "new" },
      { day: "2026-04-01", branch: BR, product: "1개월", kind: "new" },
      { day: "2026-03-09", branch: BR, product: "1개월", kind: "refund" },
    ];
    const [nw, re] = memberBlocks(regs, BR, "2026-03");
    expect(nw.lines).toEqual([
      { label: "1개월", value: 1 },
      { label: "3개월", value: 0 },
    ]);
    expect(re.lines).toEqual([
      { label: "1개월", value: 0 },
      { label: "3개월", value: 1 },
    ]);
    // 전체관리자가 아니면 빈칸
    expect(memberBlocks(null, BR, "2026-03")[0].lines.every((l) => l.value === null)).toBe(true);
  });

  it("누적매출 = 묶음별(환불 뺀 금액) · 결제 수단(참고)", () => {
    const rep = report("2026-03", [
      row({ amount: 200_000 }),
      row({ group: "pt", amount: 700_000, method: "이체" }),
      row({ group: "rental", amount: 10_000, product: "락커" }),
      row({ amount: -50_000, refund: true }),
    ]);
    const s = salesBlocks(rep);
    expect(s.income.lines).toEqual([
      { label: "일반 수강권", value: 150_000 },
      { label: "PT", value: 700_000 },
      { label: "락카 · 운동복", value: 10_000 },
    ]);
    expect(s.info[0].lines).toEqual([
      { label: "계좌이체", value: 700_000 },
      { label: "카드", value: 160_000 },
    ]);
  });

  it("비용 — 고정 / 유동 · 합계 차이 한 줄 · 자료 없는 달", () => {
    const rows: CostRow[] = [
      { month: "2026-03", k: "brent", label: "임대료", amount: 500_000 },
      { month: "2026-03", k: "bsupply", label: "용품·장비", amount: 30_000 },
      { month: "2026-03", k: "bins", label: "4대보험", amount: 90_000 },
      { month: "2026-02", k: "brent", label: "임대료", amount: 500_000 },
    ];
    const c = costBlocks(rows, "2026-03", 640_000);
    expect(c.fixed.lines.map((l) => l.label)).toEqual(["임대료", "4대보험"]);
    expect(c.variable.lines).toEqual([
      { label: "용품·장비", value: 30_000 },
      { label: "그 밖(항목 없이 올린 금액)", value: 20_000 },
    ]);
    expect(c.total).toBe(640_000);
    const none = costBlocks(rows, "2026-04", null);
    expect(none.fixed.lines).toEqual([{ label: "비용 자료 없음", value: null }]);
    expect(none.total).toBe(0);
  });

  it("그해 1월 ~ 고른 달 시트 · 빈 달 건너뛰기 · 파일 이름", () => {
    const { bytes, filename } = opsAcctWorkbook({
      branch: BR,
      month: "2026-03",
      sales: { "2026-01": report("2026-01", [row({ day: "2026-01-05" })]), "2026-02": report("2026-02", []), "2026-03": report("2026-03", [row({})]) },
      costRows: [{ month: "2026-03", k: "brent", label: "임대료", amount: 50_000 }],
      costMonths: [{ month: "2026-03", total: 50_000 }],
      prevSales: { "2025-12": 300_000 },
      regs: null,
      warnings: ["2025년 매출을 읽지 못해 연도 표에서 빠졌어요 — 다시 받아 주세요"],
      now: new Date(2026, 2, 31),
    });
    expect(filename).toBe("시험점 회계관리 2026년 3월.xlsx");
    const files = unzipStore(bytes);
    const wb = files.get("xl/workbook.xml")!;
    expect(wb).toContain('name="1월"');
    expect(wb).not.toContain('name="2월"'); // 매출 · 비용 없는 달
    expect(wb).toContain('name="3월"');
    expect(wb).toContain('activeTab="1"');
    const mar = files.get("xl/worksheets/sheet2.xml")!;
    expect(mar).toContain("25년도");
    expect(mar).toContain("비용을 아직 안 올린 달: 1월");
    expect(mar).toContain("2025년 매출을 읽지 못해");
  });
});
