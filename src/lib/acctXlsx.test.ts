import { describe, expect, it } from "vitest";
import { buildAcctWorkbook, colName, memberLines, payMethodLabel, planBucket, zipStore, type AcctInput, type AcctMonth } from "./acctXlsx";

// 시험 숫자는 지어낸 값이다(저장소 공개 — 실제 매출 · 비용은 넣지 않는다)

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

/** 시트 XML 에서 칸 하나 — 수식 · 값 */
function cell(xml: string, r: string): { f?: string; v?: string } {
  const m = xml.match(new RegExp(`<c r="${r}"[^>]*?(?:/>|>(.*?)</c>)`));
  if (!m) return {};
  const inner = m[1] ?? "";
  const f = inner.match(/<f>(.*?)<\/f>/)?.[1];
  const v = inner.match(/<v>(.*?)<\/v>/)?.[1] ?? inner.match(/<t[^>]*>(.*?)<\/t>/)?.[1];
  return { f, v };
}
const val = (xml: string, r: string) => Number(cell(xml, r).v);

const L = (label: string, value: number | null) => ({ label, value });
const month = (ym: string, over: Partial<AcctMonth> = {}): AcctMonth => ({
  ym,
  left: [
    { title: "월 누적 신규등록회원", unit: "명", lines: [L("1개월", 3), L("3개월", 1)] },
    { title: "월 누적 재등록회원", unit: "명", lines: [L("1개월", 5), L("3개월", 2)] },
  ],
  income: { title: "누적매출", lines: [L("일반 수강권", 800_000), L("PT", 200_000)] },
  otherIncome: { title: "기타수입", lines: [L("지원금", null), L("기타", 50_000)] },
  info: [{ title: "결제 수단 (참고)", lines: [L("카드", 900_000), L("계좌이체", 100_000)] }],
  fixed: { title: "고정 지출 운영비", lines: [L("임대료", 300_000), L("인건비", 200_000)] },
  variable: { title: "유동 지출", lines: [L("용품 · 장비", 50_000)] },
  ...over,
});

describe("acctXlsx 작성기", () => {
  it("열 이름", () => {
    expect([colName(1), colName(19), colName(26), colName(27), colName(52)]).toEqual(["A", "S", "Z", "AA", "AZ"]);
  });

  it("ZIP 머리 · CRC 가 맞다", () => {
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }], new Date(2026, 10, 11));
    const dv = new DataView(z.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(14, true)).toBe(0x3610a686); // crc32("hello")
    expect(unzipStore(z).get("a.txt")).toBe("hello");
  });

  it("사업 양식 — 총수입 · 총지출 · 순수익 · 배분 · 정산(수식 + 캐시 값)", () => {
    const inp: AcctInput = { profile: "business", title: "시험점 회계관리", year: 2026, months: [month("2026-03")] };
    const files = unzipStore(buildAcctWorkbook(inp, new Date(2026, 10, 11)));
    expect([...files.keys()]).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]),
    );
    expect(files.get("xl/workbook.xml")).toContain('name="3월"');
    expect(files.get("xl/workbook.xml")).toContain('name="설정"');
    const x = files.get("xl/worksheets/sheet1.xml")!;
    // 회원 총
    expect(cell(x, "B5")).toEqual({ f: "SUM(B3:B4)", v: "4" });
    expect(val(x, "B10")).toBe(7);
    // 총수입 = 누적매출 총 + 기타수입 총
    expect(cell(x, "B15").f).toBe("F5+F10");
    expect(val(x, "B15")).toBe(1_050_000);
    expect(val(x, "B16")).toBe(550_000);
    expect(cell(x, "B17").f).toBe("B15-B16");
    expect(val(x, "B17")).toBe(500_000);
    expect(cell(x, "A18").v).toBe("예비비5%");
    expect(val(x, "B18")).toBeCloseTo(25_000);
    expect(val(x, "B19")).toBeCloseTo(125_000);
    expect(val(x, "B20")).toBeCloseTo(5_000);
    expect(cell(x, "B22").f).toBe("B17-B18-B19-B20");
    expect(val(x, "B22")).toBeCloseTo(345_000);
    // 3월 줄(1~12월 표 4번째 줄)은 칸을 가리킨다
    expect(cell(x, "N4").f).toBe("B15");
    expect(cell(x, "P4").f).toBe("N4-O4");
    expect(val(x, "N14")).toBe(1_050_000);
  });

  it("순이익이 0보다 적으면 배분 0 · 총 정산 = 순이익", () => {
    const inp: AcctInput = {
      profile: "business",
      title: "시험점",
      year: 2026,
      months: [month("2026-01", { income: { title: "누적매출", lines: [L("일반 수강권", 100_000)] }, otherIncome: null })],
    };
    const x = unzipStore(buildAcctWorkbook(inp)).get("xl/worksheets/sheet1.xml")!;
    expect(val(x, "B17")).toBe(-450_000);
    expect(val(x, "B18")).toBe(0);
    expect(val(x, "B22")).toBe(-450_000);
  });

  it("정산 나누기 · 운영비 받는 분", () => {
    const inp: AcctInput = {
      profile: "business",
      title: "시험점",
      year: 2026,
      months: [month("2026-02")],
      partners: [
        { name: "가", share: 0.7, ops: true },
        { name: "나", share: 0.3 },
      ],
    };
    const files = unzipStore(buildAcctWorkbook(inp));
    const x = files.get("xl/worksheets/sheet1.xml")!;
    const xml = x.replace(/&quot;/g, '"');
    // 정산 칸 = 둘째 칸, 기타수입 다음
    const partnerRow = xml.match(/<c r="(E\d+)"[^>]*t="str"><f>IF\('설정'!\$A\$11=""/)?.[1];
    expect(partnerRow).toBeTruthy();
    const r = Number(partnerRow!.slice(1));
    expect(cell(x, `E${r}`).v).toBe("가");
    expect(val(x, `F${r}`)).toBeCloseTo(345_000 * 0.7);
    expect(val(x, `F${r + 1}`)).toBeCloseTo(345_000 * 0.3);
    // 2명 + 빈 줄 1 → 총은 r+3, 운영비+가 는 r+5
    expect(val(x, `F${r + 3}`)).toBeCloseTo(345_000);
    expect(cell(x, `E${r + 5}`).v).toBe("운영비+가");
    expect(val(x, `F${r + 5}`)).toBeCloseTo(125_000 + 345_000 * 0.7);
    // 설정 시트에 비율 · 이름
    const set = files.get("xl/worksheets/sheet2.xml")!;
    expect(set).toContain(">가<");
    expect(cell(set, "B5").v).toBe("0.05");
    expect(cell(set, "C11").v).toBe("O");
  });

  it("가계부 개인 양식 — 헌금 · 저축 · 남은 돈", () => {
    const inp: AcctInput = {
      profile: "household",
      title: "가계부",
      year: 2026,
      months: [
        {
          ym: "2026-05",
          left: [{ title: "헌금", lines: [L("십일조", 300_000), L("감사헌금", 50_000)] }],
          income: { title: "수입", lines: [L("급여", 3_000_000)] },
          fixed: { title: "고정 지출", lines: [L("관리비", 200_000)] },
          variable: { title: "생활 지출", lines: [L("식비", 500_000)] },
          offering: 350_000,
          saving: 1_000_000,
        },
      ],
    };
    const files = unzipStore(buildAcctWorkbook(inp));
    expect(files.has("xl/worksheets/sheet2.xml")).toBe(false); // 설정 시트 없음
    const x = files.get("xl/worksheets/sheet1.xml")!;
    expect(val(x, "B15")).toBe(3_000_000);
    expect(val(x, "B16")).toBe(700_000);
    expect(val(x, "B17")).toBe(2_300_000);
    expect(cell(x, "A18").v).toBe("헌금");
    expect(val(x, "B18")).toBe(350_000);
    expect(val(x, "B19")).toBe(1_000_000);
    expect(cell(x, "A21").v).toBe("남은 돈");
    expect(val(x, "B21")).toBe(950_000);
    expect(val(x, "S6")).toBe(950_000); // 5월 줄 남은 돈
  });

  it("글자 이스케이프 · 시트 이름", () => {
    const inp: AcctInput = { profile: "business", title: "A&B <점>", year: 2026, months: [month("2026-12")] };
    const files = unzipStore(buildAcctWorkbook(inp));
    expect(files.get("xl/worksheets/sheet1.xml")).toContain("A&amp;B &lt;점&gt;");
    expect(files.get("xl/workbook.xml")).toContain('name="12월"');
  });
});

describe("나누기 규칙", () => {
  it("상품 이름 → 기간 칸", () => {
    expect(planBucket("153복싱짐 프리미엄 무제한 3개월 수강권").label).toBe("3개월");
    expect(planBucket("퍼스널 트레이닝 10회권").label).toBe("PT");
    expect(planBucket("2026년 신년 이벤트 수강권 1개월").label).toBe("1개월");
    expect(planBucket("153복싱짐 일일 이용권").key).toBe("day");
    expect(planBucket("153 복싱짐 프리미엄 1년 무제한 회원권").label).toBe("12개월");
    expect(planBucket("무제한 이용권").label).toBe("기타");
    expect(planBucket(null).label).toBe("기타");
  });

  it("회원 줄 — 1개월 · 3개월은 늘, 나머지는 기간 순", () => {
    const m = new Map([
      ["pt", { label: "PT", order: 900, n: 2 }],
      ["m6", { label: "6개월", order: 6, n: 1 }],
    ]);
    expect(memberLines(m)).toEqual([
      { label: "1개월", value: 0 },
      { label: "3개월", value: 0 },
      { label: "6개월", value: 1 },
      { label: "PT", value: 2 },
    ]);
  });

  it("결제 수단 이름", () => {
    expect(payMethodLabel("이체 + 카드")).toBe("계좌이체 + 카드");
    expect(payMethodLabel("")).toBe("기타");
    expect(payMethodLabel("카드")).toBe("카드");
  });
});
