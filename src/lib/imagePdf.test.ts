import { describe, expect, it } from "vitest";
import { buildImagePdf, pageCuts, pdfTextHex } from "./imagePdf";

const latin1 = (u: Uint8Array) => Array.from(u, (b) => String.fromCharCode(b)).join("");

describe("그림 PDF (계약서 사본)", () => {
  it("쪽 · 그림 · 상호 참조표가 맞다", () => {
    const fake = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => (i * 7) % 256));
    const bytes = buildImagePdf(
      [
        { jpeg: fake(300), width: 1588, height: 2246 },
        { jpeg: fake(120), width: 1588, height: 2246 },
      ],
      { title: "근로계약서 · 김코치" },
    );
    const s = latin1(bytes);
    expect(s.startsWith("%PDF-1.4\n")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Count 2");
    expect(s).toContain("/Filter /DCTDecode /Length 300");
    expect(s).toContain(`/Title ${pdfTextHex("근로계약서 · 김코치")}`);
    // startxref 가 가리키는 곳에 xref
    const startxref = Number(s.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    // 표의 각 줄(20바이트)이 'n 0 obj' 를 가리킨다
    const total = Number(s.match(/xref\n0 (\d+)\n/)?.[1]);
    expect(total).toBe(10);
    const tableStart = s.indexOf("0000000000 65535 f \n", startxref);
    for (let k = 1; k < total; k++) {
      const line = s.slice(tableStart + k * 20, tableStart + (k + 1) * 20);
      expect(line).toMatch(/^\d{10} 00000 n \n$/);
      const off = Number(line.slice(0, 10));
      expect(s.slice(off, off + `${k} 0 obj`.length)).toBe(`${k} 0 obj`);
    }
  });

  it("한글 제목은 UTF-16BE", () => {
    expect(pdfTextHex("가A")).toBe("<FEFFAC000041>");
    expect(pdfTextHex("😀")).toBe("<FEFFD83DDE00>");
  });

  it("쪽 나누기 — 블록 가운데를 자르지 않고, 너무 긴 블록은 쪽 높이에서", () => {
    const blocks = [
      { top: 0, bottom: 300 },
      { top: 320, bottom: 700 },
      { top: 720, bottom: 1000 },
      { top: 1020, bottom: 1400 },
    ];
    const cuts = pageCuts(blocks, 1400, 1000);
    expect(cuts[0][0]).toBe(0);
    expect(cuts.at(-1)?.[1]).toBe(1400);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i][0]).toBe(cuts[i - 1][1]);
    for (const [, y] of cuts.slice(0, -1)) expect(blocks.some((b) => b.top < y - 0.5 && b.bottom > y + 0.5)).toBe(false);
    // 블록 아랫변(1000)이 아니라 다음 블록 윗변(720)에서 — 글자 꼬리가 넘어가지 않게
    expect(cuts).toEqual([
      [0, 720],
      [720, 1400],
    ]);
    // 한 블록이 쪽보다 길다 → 쪽 높이에서
    expect(pageCuts([{ top: 0, bottom: 2500 }], 2500, 1000)).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ]);
    expect(pageCuts([], 500, 1000)).toEqual([[0, 500]]);
  });
});
