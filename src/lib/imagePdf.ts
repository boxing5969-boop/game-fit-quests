/**
 * JPEG 그림 여러 장 → A4 PDF 한 파일 (2026-11-03 계약서 PDF — 외부 PDF 라이브러리 없이)
 *   쪽마다 그림 하나를 쪽 크기 그대로 깐다(글자는 그림 속). 계약서 사본 · 인쇄용.
 *   PDF 1.4 최소 구조: 목록(Catalog) · 쪽 묶음(Pages) · 정보(Info) + 쪽마다 [쪽 · 그림(DCTDecode) · 그리기 명령].
 */

export interface PdfPageImage {
  /** JPEG 파일 그대로 */
  jpeg: Uint8Array;
  /** 그림 크기(픽셀) */
  width: number;
  height: number;
}

/** A4 (pt) */
export const A4_PT = { w: 595.28, h: 841.89 } as const;

const enc = new TextEncoder();

/** PDF 글 — UTF-16BE(앞에 FEFF) 16진수 — 한글 제목도 그대로 */
export const pdfTextHex = (s: string): string => {
  let hex = "FEFF";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
    } else hex += cp.toString(16).padStart(4, "0");
  }
  return `<${hex.toUpperCase()}>`;
};

const num = (n: number) => String(Math.round(n * 100) / 100);

export function buildImagePdf(pages: PdfPageImage[], opts: { title?: string; pageW?: number; pageH?: number } = {}): Uint8Array {
  if (pages.length === 0) throw new Error("쪽이 없어요");
  const W = opts.pageW ?? A4_PT.w;
  const H = opts.pageH ?? A4_PT.h;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(u);
    offset += u.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  const pageObj = (i: number) => 4 + i * 3;
  const imgObj = (i: number) => 5 + i * 3;
  const contObj = (i: number) => 6 + i * 3;
  const total = 4 + pages.length * 3;

  // 머리 — 둘째 줄의 128 넘는 바이트는 '이진 파일'이라는 표시
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  obj(3, () => push(`<< /Title ${pdfTextHex(opts.title ?? "")} /Producer (MY BOXER 153) >>`));
  pages.forEach((p, i) => {
    obj(pageObj(i), () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(W)} ${num(H)}] ` +
          `/Resources << /XObject << /Im${i} ${imgObj(i)} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contObj(i)} 0 R >>`,
      ),
    );
    obj(imgObj(i), () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      push(p.jpeg);
      push("\nendstream");
    });
    const draw = `q ${num(W)} 0 0 ${num(H)} 0 0 cm /Im${i} Do Q`;
    obj(contObj(i), () => push(`<< /Length ${enc.encode(draw).length} >>\nstream\n${draw}\nendstream`));
  });

  const xref = offset;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/**
 * 쪽 나누기 — 긴 그림을 쪽 높이(usable)로 자르되, 블록(조항 · 서명란) 가운데를 자르지 않는다.
 *   blocks = 자르면 안 되는 덩어리의 위 · 아래(같은 단위). 들어갈 수 있는 가장 아래 블록의 '윗변'에서 자른다
 *   — 아랫변에서 자르면 그림으로 뜬 글자(html2canvas 는 글자를 몇 px 아래에 그린다)의 꼬리가 다음 쪽으로 넘어간다.
 *   한 블록이 한 쪽보다 길면(또는 30% 도 못 채우면) 그냥 쪽 높이에서 자른다.
 */
export function pageCuts(blocks: Array<{ top: number; bottom: number }>, totalH: number, usable: number): Array<[number, number]> {
  const cuts: Array<[number, number]> = [];
  if (!(totalH > 0) || !(usable > 0)) return cuts;
  const crosses = (y: number) => blocks.some((b) => b.top < y - 0.5 && b.bottom > y + 0.5);
  const candidates = [...new Set(blocks.map((b) => b.top))].sort((a, b) => a - b);
  let start = 0;
  let guard = 0;
  while (start < totalH - 0.5 && guard++ < 200) {
    const limit = start + usable;
    if (limit >= totalH) {
      cuts.push([start, totalH]);
      break;
    }
    let cut = -1;
    for (const y of candidates) if (y > start + usable * 0.3 && y <= limit && !crosses(y)) cut = y;
    if (cut < 0) cut = limit;
    cuts.push([start, cut]);
    start = cut;
  }
  return cuts;
}
