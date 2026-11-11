/**
 * 153 회계관리 엑셀 — 의존성 없는 .xlsx 작성기 + 「회계관리」 양식
 * (2026-11-11 대표님 「마이복서 153 · 153가계부 · 일일 경영 리포트 모두 이렇게 정리해서 엑셀로 다운받을수있는 기능 만들어줘」
 *  — 대표님 「점프윙스 칠금점 회계관리」 표와 같은 모양: 회원 · 누적매출 · 기타수입 · 고정/유동 지출 · 순수익 · 예비비 · 운영비 · 기부금 · 정산
 *  · 1~12월 표 · 연도 표 · 예비비 사용)
 *
 *  ⚠ 세 앱이 같은 파일을 쓴다 — 마이복서153 src/lib/acctXlsx.ts · 일일 경영 리포트 src/lib/acctXlsx.ts · 153가계부 site/xlsx153.js(이 파일을
 *    자바스크립트로 옮긴 것). 고치면 세 곳을 같이 고친다.
 *
 *  - 달마다 시트 하나(「1월」 …) + 「설정」 시트(사업 양식 — 예비비 · 운영비 · 기부금 비율 · 정산 나누기). 합계 · 순수익 · 배분은
 *    엑셀 수식이라 숫자를 고치면 다시 계산된다(캐시 값도 같이 넣어 휴대폰 미리보기에서도 맞게 보임).
 *  - 라이브러리 없이 OOXML 을 직접 쓰고 ZIP(저장 방식)으로 묶는다 — 앱 크기를 늘리지 않고, 가계부처럼 바깥 연결이 막힌 앱에서도 된다.
 */

// ───────────────────────── xlsx 작성기 ─────────────────────────

export interface XStyle {
  /** 굵게 */
  b?: boolean;
  /** 글씨 크기(pt, 기본 11) */
  sz?: number;
  /** 글씨 색 RRGGBB */
  color?: string;
  /** 칸 색 RRGGBB */
  fill?: string;
  /** 얇은 테두리(네 변) */
  border?: boolean;
  h?: "left" | "center" | "right";
  wrap?: boolean;
  /** int = #,##0 · pct = 0% */
  fmt?: "int" | "pct";
}

export type XFormula = { f: string; v?: number | string | null };
export type XVal = number | string | null | undefined | XFormula;

const FONT_NAME = "맑은 고딕";
const NUMFMT: Record<NonNullable<XStyle["fmt"]>, number> = { int: 3, pct: 9 };

const escXml = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 1 → A, 19 → S, 27 → AA */
export function colName(c: number): string {
  let s = "";
  let n = c;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export const ref = (r: number, c: number) => `${colName(c)}${r}`;
/** 절대 참조 $B$5 */
export const aref = (r: number, c: number) => `$${colName(c)}$${r}`;

class StyleBook {
  private fonts: string[] = [];
  private fills: string[] = [];
  private borders: string[] = [];
  private xfs: string[] = [];
  private fontIdx = new Map<string, number>();
  private fillIdx = new Map<string, number>();
  private xfIdx = new Map<string, number>();

  constructor() {
    this.font({});
    this.fills.push('<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>');
    this.borders.push("<border><left/><right/><top/><bottom/><diagonal/></border>");
    this.borders.push(
      '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right>' +
        '<top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>',
    );
    this.id({});
  }

  private font(s: XStyle): number {
    const key = `${s.b ? 1 : 0}|${s.sz ?? 11}|${s.color ?? ""}`;
    const hit = this.fontIdx.get(key);
    if (hit !== undefined) return hit;
    const xml =
      `<font>${s.b ? "<b/>" : ""}<sz val="${s.sz ?? 11}"/>` +
      `${s.color ? `<color rgb="FF${s.color.toUpperCase()}"/>` : '<color theme="1"/>'}` +
      `<name val="${FONT_NAME}"/><family val="3"/><charset val="129"/></font>`;
    this.fonts.push(xml);
    this.fontIdx.set(key, this.fonts.length - 1);
    return this.fonts.length - 1;
  }

  private fill(rgb?: string): number {
    if (!rgb) return 0;
    const key = rgb.toUpperCase();
    const hit = this.fillIdx.get(key);
    if (hit !== undefined) return hit;
    this.fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${key}"/><bgColor indexed="64"/></patternFill></fill>`);
    this.fillIdx.set(key, this.fills.length - 1);
    return this.fills.length - 1;
  }

  /** 같은 모양이면 같은 번호 */
  id(s: XStyle | undefined): number {
    const st = s ?? {};
    const fontId = this.font(st);
    const fillId = this.fill(st.fill);
    const borderId = st.border ? 1 : 0;
    const numId = st.fmt ? NUMFMT[st.fmt] : 0;
    const key = `${fontId}|${fillId}|${borderId}|${numId}|${st.h ?? ""}|${st.wrap ? 1 : 0}`;
    const hit = this.xfIdx.get(key);
    if (hit !== undefined) return hit;
    const align = st.h || st.wrap ? `<alignment${st.h ? ` horizontal="${st.h}"` : ""} vertical="center"${st.wrap ? ' wrapText="1"' : ""}/>` : '<alignment vertical="center"/>';
    this.xfs.push(
      `<xf numFmtId="${numId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
        `${numId ? ' applyNumberFormat="1"' : ""} applyFont="1"${fillId ? ' applyFill="1"' : ""}${borderId ? ' applyBorder="1"' : ""} applyAlignment="1">${align}</xf>`,
    );
    this.xfIdx.set(key, this.xfs.length - 1);
    return this.xfs.length - 1;
  }

  xml(): string {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
      "</styleSheet>"
    );
  }
}

interface XCell {
  v: XVal;
  s: number;
}

export class XSheet {
  readonly name: string;
  private cells = new Map<number, Map<number, XCell>>();
  private merges: string[] = [];
  private widths = new Map<number, number>();
  private heights = new Map<number, number>();
  /** 엑셀 기본 줄 높이(pt) */
  defaultRowHeight = 20.25;
  landscape = true;
  selected = false;

  constructor(
    name: string,
    private readonly styles: StyleBook,
  ) {
    this.name = name;
  }

  set(r: number, c: number, v: XVal, s?: XStyle): void {
    let row = this.cells.get(r);
    if (!row) this.cells.set(r, (row = new Map()));
    row.set(c, { v, s: this.styles.id(s) });
  }

  /** 합친 칸 — 테두리를 그리려면 합친 범위의 칸마다 같은 모양을 넣는다 */
  merge(r1: number, c1: number, r2: number, c2: number, s?: XStyle): void {
    this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`);
    if (s) {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) {
          if (r === r1 && c === c1) continue;
          if (!this.cells.get(r)?.get(c)) this.set(r, c, null, s);
        }
    }
  }

  width(c: number, w: number): void {
    this.widths.set(c, w);
  }

  height(r: number, h: number): void {
    this.heights.set(r, h);
  }

  private cellXml(r: number, c: number, cell: XCell): string {
    const at = `r="${ref(r, c)}"${cell.s ? ` s="${cell.s}"` : ""}`;
    const v = cell.v;
    if (v === null || v === undefined || v === "") return `<c ${at}/>`;
    if (typeof v === "number") return Number.isFinite(v) ? `<c ${at}><v>${v}</v></c>` : `<c ${at}/>`;
    if (typeof v === "string") return `<c ${at} t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
    const f = `<f>${escXml(v.f)}</f>`;
    if (typeof v.v === "string") return `<c ${at} t="str">${f}<v>${escXml(v.v)}</v></c>`;
    if (typeof v.v === "number" && Number.isFinite(v.v)) return `<c ${at}>${f}<v>${v.v}</v></c>`;
    return `<c ${at}>${f}</c>`;
  }

  xml(): string {
    const rows = [...this.cells.keys()].sort((a, b) => a - b);
    let maxR = 1;
    let maxC = 1;
    const body = rows
      .map((r) => {
        const row = this.cells.get(r)!;
        const cols = [...row.keys()].sort((a, b) => a - b);
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, cols[cols.length - 1] ?? 1);
        const h = this.heights.get(r);
        return `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ""}>${cols.map((c) => this.cellXml(r, c, row.get(c)!)).join("")}</row>`;
      })
      .join("");
    const cols = [...this.widths.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([c, w]) => `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`)
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      `<dimension ref="A1:${ref(maxR, maxC)}"/>` +
      `<sheetViews><sheetView workbookViewId="0"${this.selected ? ' tabSelected="1"' : ""}/></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="${this.defaultRowHeight}" customHeight="1"/>` +
      (cols ? `<cols>${cols}</cols>` : "") +
      `<sheetData>${body}</sheetData>` +
      (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
      '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>' +
      `<pageSetup paperSize="9" orientation="${this.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>` +
      "</worksheet>"
    );
  }
}

export class XWorkbook {
  private styles = new StyleBook();
  readonly sheets: XSheet[] = [];
  title = "";

  addSheet(name: string): XSheet {
    const clean = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `시트${this.sheets.length + 1}`;
    const ws = new XSheet(clean, this.styles);
    this.sheets.push(ws);
    return ws;
  }

  /** 엑셀 파일 바이트 */
  toBytes(now: Date = new Date()): Uint8Array {
    if (!this.sheets.length) this.addSheet("시트1");
    let active = this.sheets.findIndex((s) => s.selected);
    if (active < 0) {
      active = 0;
      this.sheets[0].selected = true;
    }
    const iso = now.toISOString().replace(/\.\d+Z$/, "Z");
    const n = this.sheets.length;
    const files: Array<{ name: string; data: string }> = [
      {
        name: "[Content_Types].xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          this.sheets
            .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
            .join("") +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
          '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
          "</Types>",
      },
      {
        name: "_rels/.rels",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
          '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
          "</Relationships>",
      },
      {
        name: "docProps/core.xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
          'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          `<dc:title>${escXml(this.title)}</dc:title><dc:creator>153</dc:creator>` +
          `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
          "</cp:coreProperties>",
      },
      {
        name: "docProps/app.xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
          "<Application>Microsoft Excel</Application></Properties>",
      },
      {
        name: "xl/workbook.xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15600" activeTab="${active}"/></bookViews>` +
          `<sheets>${this.sheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
          '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
          "</workbook>",
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          this.sheets
            .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
            .join("") +
          `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          "</Relationships>",
      },
    ];
    this.sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml() }));
    files.push({ name: "xl/styles.xml", data: this.styles.xml() });
    const enc = new TextEncoder();
    return zipStore(
      files.map((f) => ({ name: f.name, data: enc.encode(f.data) })),
      now,
    );
  }
}

// ── ZIP(저장 방식 — 압축 없이 묶기) ──
let CRC_TABLE: Uint32Array | null = null;
function crc32(buf: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipStore(files: Array<{ name: string; data: Uint8Array }>, now: Date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31);
  const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local, f.data);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + size;
  }
  const cdSize = central.reduce((t, c) => t + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...parts, ...central, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

// ───────────────────────── 「회계관리」 양식 ─────────────────────────

export interface AcctLine {
  label: string;
  /** null = 빈칸(엑셀에서 직접 적는 칸) */
  value: number | null;
}

export interface AcctBlock {
  title: string;
  lines: AcctLine[];
  /** 단위 칸 글자 — 기본 '원' */
  unit?: string;
  /** 맨 아래 '총' 줄 (기본 true) */
  total?: boolean;
}

export interface AcctMonth {
  /** YYYY-MM */
  ym: string;
  /** 왼쪽 주황 칸 — 사업: 월 누적 신규등록회원 · 재등록회원(명) / 가계부 개인: 헌금 · 십일조 */
  left: AcctBlock[];
  /** 누적매출(사업) · 수입(가계부) — 총수입에 들어간다 */
  income: AcctBlock;
  /** 기타수입 — 총수입에 들어간다(엑셀에서 적는 빈 줄을 둘 수 있음) */
  otherIncome?: AcctBlock | null;
  /** 참고 칸(총수입에 안 들어감) — 결제 수단 등 */
  info?: AcctBlock[];
  /** 고정 지출 */
  fixed: AcctBlock;
  /** 유동 지출(가계부: 생활 지출) */
  variable: AcctBlock;
  /** 이 달 퇴직금 적립(사업 표 '퇴직금누적' 칸) */
  retirement?: number | null;
  /** 가계부 개인: 이 달 헌금 · 저축 · 투자(실제) */
  offering?: number;
  saving?: number;
}

/** 1~12월 표 · 연도 표에 쓰는 합계 (자세한 시트가 없는 달 · 지난해) */
export interface AcctTotals {
  income: number;
  expense: number;
  retirement?: number | null;
  offering?: number;
  saving?: number;
}

export interface AcctPartner {
  name: string;
  /** 0~1 */
  share: number;
  /** 운영비를 받는 분 — '운영비+이름' 줄 */
  ops?: boolean;
}

export interface AcctInput {
  /** business = 매장 회계(예비비 · 운영비 · 기부금 · 정산) · household = 가계부 개인(헌금 · 저축) */
  profile: "business" | "household";
  /** '153복싱짐 선릉역점 회계관리' */
  title: string;
  year: number;
  /** 시트로 만들 달(오래된 달부터) */
  months: AcctMonth[];
  /** 처음 열릴 시트(YYYY-MM) — 없으면 마지막 달 */
  activeYm?: string;
  /** 그해 1~12월 합계(키 = 달 1~12) — 시트가 없는 달도 1~12월 표에 */
  monthTotals?: Record<number, AcctTotals>;
  /** 지난해들 합계 */
  prevYears?: Array<{ year: number } & AcctTotals>;
  /** 사업: 예비비 · 운영비 · 기부금 비율(0~1) — 기본 5% · 25% · 1% (대표님 점프윙스 표) */
  rates?: { reserve: number; ops: number; donation: number };
  /** 사업: 정산 나누기 — 기본 '대표' 100% */
  partners?: AcctPartner[];
  /** 사업: 예비비 사용 기록 */
  reserveUse?: Array<{ date: string; item: string; amount: number }>;
  /** 시트 맨 아래 작은 글씨(자료 출처 · 기준 시각) */
  notes?: string[];
}

export const ACCT_DEFAULT_RATES = { reserve: 0.05, ops: 0.25, donation: 0.01 };

// 대표님 표의 색
const C_ORANGE = "F4B183";
const C_BLUE = "BDD7EE";
const C_GREEN = "C6E0B4";
const C_GREEN_LIGHT = "E2EFDA";
const C_GOLD = "FFD966";
const C_YELLOW = "FFFF00";
const C_PINK = "FCE4D6";
const C_CREAM = "FFF2CC";
const C_GREY = "E7E6E6";
const C_INPUT = "FFF2CC";

const S_TITLE: XStyle = { b: true, sz: 13, h: "center" };
const head = (fill: string): XStyle => ({ fill, border: true, h: "center", b: true });
const lab = (fill?: string): XStyle => ({ border: true, h: "left", fill });
const labC = (fill?: string): XStyle => ({ border: true, h: "center", fill });
const num = (fill?: string): XStyle => ({ border: true, h: "right", fmt: "int", fill });
const unitS = (fill?: string): XStyle => ({ border: true, h: "center", fill });
const S_NOTE: XStyle = { sz: 9, color: "7F7F7F" };

const pctText = (r: number) => `${Math.round(r * 1000) / 10}%`;
const sum = (xs: Array<number | null | undefined>) => xs.reduce<number>((t, x) => t + (typeof x === "number" && Number.isFinite(x) ? x : 0), 0);
const yearLabel = (y: number) => `${String(y).slice(2)}년도`;

/** 칸 묶음 하나(머리 · 줄 · 총) — 왼쪽 위 (r0, c0), 세 칸(이름 · 값 · 단위) */
function drawBlock(
  ws: XSheet,
  r0: number,
  c0: number,
  b: AcctBlock,
  fill: string,
  opts: { totalFill?: string } = {},
): { next: number; totalRef: string | null; total: number; lineRefs: string[] } {
  const unit = b.unit ?? "원";
  ws.set(r0, c0, b.title, head(fill));
  ws.merge(r0, c0, r0, c0 + 2, head(fill));
  let r = r0 + 1;
  const lineRefs: string[] = [];
  for (const ln of b.lines) {
    ws.set(r, c0, ln.label, lab());
    ws.set(r, c0 + 1, ln.value, num());
    ws.set(r, c0 + 2, unit, unitS());
    lineRefs.push(ref(r, c0 + 1));
    r++;
  }
  const total = sum(b.lines.map((l) => l.value));
  let totalRef: string | null = null;
  if (b.total !== false) {
    const tf = opts.totalFill;
    ws.set(r, c0, "총", labC(tf));
    ws.set(r, c0 + 1, b.lines.length ? { f: `SUM(${ref(r0 + 1, c0 + 1)}:${ref(r - 1, c0 + 1)})`, v: total } : 0, num(tf));
    ws.set(r, c0 + 2, unit, unitS(tf));
    totalRef = ref(r, c0 + 1);
    r++;
  }
  return { next: r, totalRef, total, lineRefs };
}

const COLS = { A: 1, B: 2, C: 3, E: 5, F: 6, G: 7, I: 9, J: 10, K: 11, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19 };
const SET = "'설정'";
const SET_ROWS = { reserve: 5, ops: 6, donation: 7, partner0: 11, partners: 4 };

function setupWidths(ws: XSheet): void {
  const w: Array<[number, number]> = [
    [1, 16], [2, 14], [3, 4.5], [4, 2], [5, 20], [6, 15], [7, 4.5], [8, 2], [9, 22], [10, 14], [11, 4.5], [12, 2],
    [13, 13], [14, 15], [15, 15], [16, 14], [17, 13], [18, 13], [19, 13],
  ];
  for (const [c, v] of w) ws.width(c, v);
}

/** 1~12월 · 연도 표에 쓰는 한 줄 값 */
interface RowNums {
  income: number;
  expense: number;
  retirement: number | null;
  offering: number;
  saving: number;
}

function monthSheet(wb: XWorkbook, inp: AcctInput, mon: AcctMonth): XSheet {
  const biz = inp.profile === "business";
  const mNum = Number(mon.ym.slice(5, 7));
  const ws = wb.addSheet(`${mNum}월`);
  setupWidths(ws);
  const rates = inp.rates ?? ACCT_DEFAULT_RATES;

  // 1줄 — 제목 · 달
  ws.set(1, COLS.A, inp.title, S_TITLE);
  ws.merge(1, COLS.A, 1, COLS.G);
  ws.set(1, COLS.I, `${inp.year}년 ${mNum}월`, S_TITLE);
  ws.merge(1, COLS.I, 1, COLS.K);
  ws.height(1, 24);

  // ── 셋째 칸(I~K): 고정 · 유동 지출 → 누적 지출 ──
  let ri = 2;
  const fx = drawBlock(ws, ri, COLS.I, mon.fixed, C_GREEN);
  ri = fx.next;
  const vr = drawBlock(ws, ri, COLS.I, mon.variable, C_GREEN);
  ri = vr.next + 1;
  const sumTitle = biz ? "누적 지출 운영비" : "누적 지출";
  ws.set(ri, COLS.I, sumTitle, head(C_GREEN));
  ws.merge(ri, COLS.I, ri, COLS.K, head(C_GREEN));
  const varLab = biz ? "유동" : "생활";
  ws.set(ri + 1, COLS.I, "고정", labC());
  ws.set(ri + 1, COLS.J, fx.totalRef ? { f: fx.totalRef, v: fx.total } : fx.total, num());
  ws.set(ri + 1, COLS.K, "원", unitS());
  ws.set(ri + 2, COLS.I, varLab, labC());
  ws.set(ri + 2, COLS.J, vr.totalRef ? { f: vr.totalRef, v: vr.total } : vr.total, num());
  ws.set(ri + 2, COLS.K, "원", unitS());
  const expense = fx.total + vr.total;
  ws.set(ri + 3, COLS.I, "총", labC());
  ws.set(ri + 3, COLS.J, { f: `${ref(ri + 1, COLS.J)}+${ref(ri + 2, COLS.J)}`, v: expense }, num());
  ws.set(ri + 3, COLS.K, "원", unitS());
  const expenseRef = ref(ri + 3, COLS.J);

  // ── 둘째 칸(E~G) 앞부분: 누적매출 · 기타수입 ──
  let re = 2;
  const inc = drawBlock(ws, re, COLS.E, mon.income, C_BLUE);
  re = inc.next + 1;
  let oth: ReturnType<typeof drawBlock> | null = null;
  if (mon.otherIncome) {
    oth = drawBlock(ws, re, COLS.E, mon.otherIncome, C_BLUE);
    re = oth.next + 1;
  }
  const income = inc.total + (oth?.total ?? 0);

  // ── 첫째 칸(A~C): 회원(헌금) 칸 → 총 수입 지출 ──
  let ra = 2;
  for (const b of mon.left) {
    const res = drawBlock(ws, ra, COLS.A, b, C_ORANGE);
    ra = res.next + 1;
  }
  ra = Math.max(ra, mon.left.length ? 14 : 2);
  ws.set(ra, COLS.A, "총 수입 지출", head(C_GREEN));
  ws.merge(ra, COLS.A, ra, COLS.C, head(C_GREEN));
  const rIncome = ra + 1;
  const rExpense = ra + 2;
  const rProfit = ra + 3;
  const incomeF = [inc.totalRef ?? "0", oth?.totalRef].filter(Boolean).join("+");
  ws.set(rIncome, COLS.A, "총수입", labC());
  ws.set(rIncome, COLS.B, { f: incomeF, v: income }, num());
  ws.set(rIncome, COLS.C, "원", unitS());
  ws.set(rExpense, COLS.A, "총지출", labC());
  ws.set(rExpense, COLS.B, { f: expenseRef, v: expense }, num());
  ws.set(rExpense, COLS.C, "원", unitS());
  const profit = income - expense;
  ws.set(rProfit, COLS.A, biz ? "총 순수익" : "쓰고 남은 돈", labC(C_GREEN_LIGHT));
  ws.set(rProfit, COLS.B, { f: `${ref(rIncome, COLS.B)}-${ref(rExpense, COLS.B)}`, v: profit }, num(C_GREEN_LIGHT));
  ws.set(rProfit, COLS.C, "원", unitS(C_GREEN_LIGHT));
  const P = ref(rProfit, COLS.B);

  let rSettle: number;
  let settle: number;
  let reserve = 0;
  let ops = 0;
  let donation = 0;
  const rReserve = rProfit + 1;
  const rOps = rProfit + 2;
  const rDon = rProfit + 3;
  if (biz) {
    const pos = Math.max(0, profit);
    reserve = pos * rates.reserve;
    ops = pos * rates.ops;
    donation = pos * rates.donation;
    ws.set(rReserve, COLS.A, { f: `"예비비"&TEXT(${SET}!${aref(SET_ROWS.reserve, 2)},"0%")`, v: `예비비${pctText(rates.reserve)}` }, labC());
    ws.set(rReserve, COLS.B, { f: `MAX(0,${P})*${SET}!${aref(SET_ROWS.reserve, 2)}`, v: reserve }, num());
    ws.set(rReserve, COLS.C, "원", unitS());
    ws.set(rOps, COLS.A, { f: `"운영비"&TEXT(${SET}!${aref(SET_ROWS.ops, 2)},"0%")`, v: `운영비${pctText(rates.ops)}` }, labC());
    ws.set(rOps, COLS.B, { f: `MAX(0,${P})*${SET}!${aref(SET_ROWS.ops, 2)}`, v: ops }, num());
    ws.set(rOps, COLS.C, "원", unitS());
    ws.set(rDon, COLS.A, { f: `"기부금"&TEXT(${SET}!${aref(SET_ROWS.donation, 2)},"0%")`, v: `기부금${pctText(rates.donation)}` }, labC());
    ws.set(rDon, COLS.B, { f: `MAX(0,${P})*${SET}!${aref(SET_ROWS.donation, 2)}`, v: donation }, num());
    ws.set(rDon, COLS.C, "원", unitS());
    rSettle = rDon + 2;
    settle = profit - reserve - ops - donation;
    ws.set(rDon + 1, COLS.A, null, labC());
    ws.set(rDon + 1, COLS.B, null, num());
    ws.set(rDon + 1, COLS.C, null, unitS());
    ws.set(rSettle, COLS.A, "총 정산", labC(C_YELLOW));
    ws.set(rSettle, COLS.B, { f: `${P}-${ref(rReserve, COLS.B)}-${ref(rOps, COLS.B)}-${ref(rDon, COLS.B)}`, v: settle }, num(C_YELLOW));
    ws.set(rSettle, COLS.C, "원", unitS(C_YELLOW));
  } else {
    const offering = mon.offering ?? 0;
    const saving = mon.saving ?? 0;
    // 헌금 칸이 왼쪽에 있으면 그 총을, 없으면 값
    ws.set(rReserve, COLS.A, "헌금", labC());
    ws.set(rReserve, COLS.B, offering, num());
    ws.set(rReserve, COLS.C, "원", unitS());
    ws.set(rOps, COLS.A, "저축 · 투자", labC());
    ws.set(rOps, COLS.B, saving, num());
    ws.set(rOps, COLS.C, "원", unitS());
    rSettle = rOps + 2;
    settle = profit - offering - saving;
    ws.set(rOps + 1, COLS.A, null, labC());
    ws.set(rOps + 1, COLS.B, null, num());
    ws.set(rOps + 1, COLS.C, null, unitS());
    ws.set(rSettle, COLS.A, "남은 돈", labC(C_YELLOW));
    ws.set(rSettle, COLS.B, { f: `${P}-${ref(rReserve, COLS.B)}-${ref(rOps, COLS.B)}`, v: settle }, num(C_YELLOW));
    ws.set(rSettle, COLS.C, "원", unitS(C_YELLOW));
  }
  const settleRef = ref(rSettle, COLS.B);

  // ── 둘째 칸 뒷부분: 정산(사업) · 참고 칸 ──
  if (biz) {
    ws.set(re, COLS.E, "정산", head(C_GOLD));
    ws.merge(re, COLS.E, re, COLS.G, head(C_GOLD));
    const partners = (inp.partners?.length ? inp.partners : [{ name: "대표", share: 1 }]).slice(0, SET_ROWS.partners);
    // 정산 줄 = 나누는 분 수 + 빈 줄 하나('설정'에 한 분 더 적을 자리) · 2~4줄
    const nRows = Math.min(SET_ROWS.partners, Math.max(2, partners.length + 1));
    const pr0 = re + 1;
    for (let i = 0; i < nRows; i++) {
      const p = partners[i];
      const sr = SET_ROWS.partner0 + i;
      const r = pr0 + i;
      ws.set(r, COLS.E, { f: `IF(${SET}!${aref(sr, 1)}="","",${SET}!${aref(sr, 1)})`, v: p ? p.name : "" }, lab());
      ws.set(r, COLS.F, { f: `IF(${SET}!${aref(sr, 1)}="","",${settleRef}*${SET}!${aref(sr, 2)})`, v: p ? settle * p.share : "" }, num());
      ws.set(r, COLS.G, { f: `IF(${SET}!${aref(sr, 1)}="","","원")`, v: p ? "원" : "" }, unitS());
    }
    const rTot = pr0 + nRows;
    const shareSum = sum(partners.slice(0, nRows).map((p) => p.share));
    ws.set(rTot, COLS.E, "총", labC(C_YELLOW));
    ws.set(rTot, COLS.F, { f: `SUM(${ref(pr0, COLS.F)}:${ref(rTot - 1, COLS.F)})`, v: settle * shareSum }, num(C_YELLOW));
    ws.set(rTot, COLS.G, "원", unitS(C_YELLOW));
    // 운영비 받는 분 — 운영비 + 그분 정산
    const rOpsP = rTot + 2;
    const opsIdx = partners.slice(0, nRows).findIndex((p) => p.ops);
    const nameRange = `${SET}!${aref(SET_ROWS.partner0, 1)}:${aref(SET_ROWS.partner0 + nRows - 1, 1)}`;
    const flagRange = `${SET}!${aref(SET_ROWS.partner0, 3)}:${aref(SET_ROWS.partner0 + nRows - 1, 3)}`;
    const valRange = `${ref(pr0, COLS.F)}:${ref(rTot - 1, COLS.F)}`;
    const opsName = opsIdx >= 0 ? `운영비+${partners[opsIdx].name}` : "";
    const opsVal = opsIdx >= 0 ? ops + settle * partners[opsIdx].share : "";
    const pink = opsIdx >= 0 ? C_PINK : undefined;
    ws.set(rOpsP, COLS.E, { f: `IFERROR("운영비+"&INDEX(${nameRange},MATCH("O",${flagRange},0)),"")`, v: opsName }, lab(pink));
    ws.set(rOpsP, COLS.F, { f: `IFERROR(${ref(rOps, COLS.B)}+INDEX(${valRange},MATCH("O",${flagRange},0)),"")`, v: opsVal }, num(pink));
    ws.set(rOpsP, COLS.G, { f: `IF(${ref(rOpsP, COLS.E)}="","","원")`, v: opsIdx >= 0 ? "원" : "" }, unitS(pink));
    re = rOpsP + 2;
  }
  for (const b of mon.info ?? []) {
    const res = drawBlock(ws, re, COLS.E, b, C_GREY);
    re = res.next + 1;
  }

  // 작은 글씨 — 왼쪽 세 칸 묶음이 모두 끝난 아래(글이 옆 칸에 잘리지 않게)
  let rn = Math.max(rSettle + 2, re, ri + 5);
  const notes = [
    ...(inp.notes ?? []),
    biz
      ? "숫자를 고치면 합계 · 순수익 · 배분이 다시 계산돼요. 비율 · 정산 나누기는 '설정' 시트에서."
      : "숫자를 고치면 합계가 다시 계산돼요.",
  ];
  for (const t of notes) {
    ws.set(rn, COLS.A, t, S_NOTE);
    rn++;
  }

  // ── 넷째 칸(M~S): 1~12월 · 연도 · 예비비 사용 ──
  const hdr = biz
    ? ["", "수입", "지출", "순수익", { f: `TEXT(${SET}!${aref(SET_ROWS.reserve, 2)},"0%")&"예비비"`, v: `${pctText(rates.reserve)}예비비` }, "퇴직금누적", "기부금"]
    : ["", "수입", "지출", "쓰고 남은 돈", "헌금", "저축 · 투자", "남은 돈"];
  hdr.forEach((h, i) => ws.set(1, COLS.M + i, h as XVal, i === 0 ? labC() : head(C_GREY)));

  const totals = new Map<number, RowNums>();
  for (let m = 1; m <= 12; m++) {
    const t = inp.monthTotals?.[m];
    if (t) totals.set(m, { income: t.income, expense: t.expense, retirement: t.retirement ?? null, offering: t.offering ?? 0, saving: t.saving ?? 0 });
  }
  // 이 시트 달은 칸 값으로
  totals.set(mNum, {
    income,
    expense,
    retirement: mon.retirement ?? totals.get(mNum)?.retirement ?? null,
    offering: mon.offering ?? 0,
    saving: mon.saving ?? 0,
  });

  const colTot = { N: 0, O: 0, P: 0, Q: 0, R: 0, S: 0 };
  for (let m = 1; m <= 12; m++) {
    const r = 1 + m;
    ws.set(r, COLS.M, `${m}월`, labC());
    const t = totals.get(m);
    const cream = biz ? C_CREAM : undefined;
    if (!t) {
      for (let c = COLS.N; c <= COLS.S; c++) ws.set(r, c, null, num(c === COLS.S ? cream : undefined));
      continue;
    }
    const own = m === mNum;
    const N = ref(r, COLS.N);
    const O = ref(r, COLS.O);
    const Pm = ref(r, COLS.P);
    ws.set(r, COLS.N, own ? { f: ref(rIncome, COLS.B), v: t.income } : t.income, num());
    ws.set(r, COLS.O, own ? { f: ref(rExpense, COLS.B), v: t.expense } : t.expense, num());
    const pm = t.income - t.expense;
    ws.set(r, COLS.P, { f: `${N}-${O}`, v: pm }, num());
    colTot.N += t.income;
    colTot.O += t.expense;
    colTot.P += pm;
    if (biz) {
      const resv = Math.max(0, pm) * rates.reserve;
      const don = Math.max(0, pm) * rates.donation;
      ws.set(r, COLS.Q, own ? { f: ref(rReserve, COLS.B), v: reserve } : { f: `MAX(0,${Pm})*${SET}!${aref(SET_ROWS.reserve, 2)}`, v: resv }, num());
      ws.set(r, COLS.R, t.retirement ?? null, num());
      ws.set(r, COLS.S, own ? { f: ref(rDon, COLS.B), v: donation } : { f: `MAX(0,${Pm})*${SET}!${aref(SET_ROWS.donation, 2)}`, v: don }, num(cream));
      colTot.Q += own ? reserve : resv;
      colTot.R += t.retirement ?? 0;
      colTot.S += own ? donation : don;
    } else {
      ws.set(r, COLS.Q, own ? { f: ref(rReserve, COLS.B), v: t.offering } : t.offering, num());
      ws.set(r, COLS.R, own ? { f: ref(rOps, COLS.B), v: t.saving } : t.saving, num());
      const left = pm - t.offering - t.saving;
      ws.set(r, COLS.S, { f: `${Pm}-${ref(r, COLS.Q)}-${ref(r, COLS.R)}`, v: left }, num());
      colTot.Q += t.offering;
      colTot.R += t.saving;
      colTot.S += left;
    }
  }
  const rTotal = 14;
  ws.set(rTotal, COLS.M, "총", labC());
  (["N", "O", "P", "Q", "R", "S"] as const).forEach((k) => {
    const c = COLS[k];
    ws.set(rTotal, c, { f: `SUM(${ref(2, c)}:${ref(13, c)})`, v: colTot[k] }, num(biz && k === "S" ? C_CREAM : undefined));
  });

  // 연도 표
  const rYh = 16;
  const yHdr = biz ? ["", "총수입", "총지출", "순수익", "예비비", "퇴직금누적"] : ["", "총수입", "총지출", "쓰고 남은 돈", "헌금", "저축 · 투자", "남은 돈"];
  yHdr.forEach((h, i) => ws.set(rYh, COLS.M + i, h, i === 0 ? labC() : head(C_GREY)));
  const years = [...(inp.prevYears ?? [])].filter((y) => y.year < inp.year).sort((a, b) => a.year - b.year);
  let ry = rYh + 1;
  const yRows: number[] = [];
  let yTot = { Q: 0, R: 0 };
  for (const y of years) {
    const pm = y.income - y.expense;
    ws.set(ry, COLS.M, yearLabel(y.year), labC());
    ws.set(ry, COLS.N, y.income, num());
    ws.set(ry, COLS.O, y.expense, num());
    ws.set(ry, COLS.P, { f: `${ref(ry, COLS.N)}-${ref(ry, COLS.O)}`, v: pm }, num());
    if (biz) {
      const resv = Math.max(0, pm) * rates.reserve;
      ws.set(ry, COLS.Q, { f: `MAX(0,${ref(ry, COLS.P)})*${SET}!${aref(SET_ROWS.reserve, 2)}`, v: resv }, num());
      ws.set(ry, COLS.R, y.retirement ?? null, num());
      yTot = { Q: yTot.Q + resv, R: yTot.R + (y.retirement ?? 0) };
    } else {
      ws.set(ry, COLS.Q, y.offering ?? 0, num());
      ws.set(ry, COLS.R, y.saving ?? 0, num());
      ws.set(ry, COLS.S, { f: `${ref(ry, COLS.P)}-${ref(ry, COLS.Q)}-${ref(ry, COLS.R)}`, v: pm - (y.offering ?? 0) - (y.saving ?? 0) }, num());
    }
    yRows.push(ry);
    ry++;
  }
  // 올해 — 1~12월 표의 총
  ws.set(ry, COLS.M, `${yearLabel(inp.year)}`, labC());
  const yCols = biz ? (["N", "O", "P", "Q", "R"] as const) : (["N", "O", "P", "Q", "R", "S"] as const);
  for (const k of yCols) ws.set(ry, COLS[k], { f: ref(rTotal, COLS[k]), v: colTot[k] }, num());
  yTot = { Q: yTot.Q + colTot.Q, R: yTot.R + colTot.R };
  yRows.push(ry);
  ry++;

  if (biz) {
    // 총예비비 · 예비비잔액 · 현재 예+퇴
    const rAll = ry;
    const rLeft = ry + 1;
    const firstY = yRows[0];
    const lastY = yRows[yRows.length - 1];
    const use = inp.reserveUse ?? [];
    const useRows = Math.max(6, use.length);
    const rUseHead = rLeft + 2;
    const rUse0 = rUseHead + 1;
    const rUseTot = rUse0 + useRows;
    const useTotal = sum(use.map((u) => u.amount));
    ws.set(rAll, COLS.P, "총예비비", labC(C_YELLOW));
    ws.set(rAll, COLS.Q, { f: `SUM(${ref(firstY, COLS.Q)}:${ref(lastY, COLS.Q)})`, v: yTot.Q }, num(C_YELLOW));
    ws.set(rAll, COLS.R, { f: `SUM(${ref(firstY, COLS.R)}:${ref(lastY, COLS.R)})`, v: yTot.R }, num(C_YELLOW));
    ws.set(rAll, COLS.S, "현재 예+퇴", labC(C_GREEN_LIGHT));
    ws.set(rLeft, COLS.P, "예비비잔액", labC());
    ws.set(rLeft, COLS.Q, { f: `${ref(rAll, COLS.Q)}-${ref(rUseTot, COLS.O)}`, v: yTot.Q - useTotal }, num());
    ws.set(rLeft, COLS.S, { f: `${ref(rLeft, COLS.Q)}+${ref(rAll, COLS.R)}`, v: yTot.Q - useTotal + yTot.R }, num(C_GREEN_LIGHT));
    // 예비비 사용
    ws.set(rUseHead, COLS.M, "예비비사용", head(C_GREY));
    ws.merge(rUseHead, COLS.M, rUseHead, COLS.O, head(C_GREY));
    for (let i = 0; i < useRows; i++) {
      const u = use[i];
      ws.set(rUse0 + i, COLS.M, u ? u.date : null, labC());
      ws.set(rUse0 + i, COLS.N, u ? u.item : null, labC());
      ws.set(rUse0 + i, COLS.O, u ? u.amount : null, num());
    }
    ws.set(rUseTot, COLS.M, "총지출", labC());
    ws.set(rUseTot, COLS.N, null, labC());
    ws.set(rUseTot, COLS.O, { f: `SUM(${ref(rUse0, COLS.O)}:${ref(rUseTot - 1, COLS.O)})`, v: useTotal }, num());
  }
  return ws;
}

function settingsSheet(wb: XWorkbook, inp: AcctInput): XSheet {
  const ws = wb.addSheet("설정");
  ws.landscape = false;
  ws.width(1, 18);
  ws.width(2, 12);
  ws.width(3, 16);
  ws.width(4, 40);
  const rates = inp.rates ?? ACCT_DEFAULT_RATES;
  ws.set(1, 1, "설정", { b: true, sz: 13 });
  ws.set(2, 1, "여기 숫자를 바꾸면 모든 달 시트의 예비비 · 운영비 · 기부금 · 정산이 다시 계산돼요.", S_NOTE);
  ws.set(4, 1, "배분 비율", head(C_GREEN));
  ws.merge(4, 1, 4, 2, head(C_GREEN));
  const rateRows: Array<[number, string, number, string]> = [
    [SET_ROWS.reserve, "예비비", rates.reserve, "순이익 × 비율 — 따로 모아 두는 돈"],
    [SET_ROWS.ops, "운영비", rates.ops, "순이익 × 비율 — 운영하는 분 몫"],
    [SET_ROWS.donation, "기부금", rates.donation, "순이익 × 비율"],
  ];
  for (const [r, l, v, d] of rateRows) {
    ws.set(r, 1, l, lab());
    ws.set(r, 2, v, { border: true, h: "right", fmt: "pct", fill: C_INPUT });
    ws.set(r, 4, d, S_NOTE);
  }
  const p0 = SET_ROWS.partner0;
  ws.set(p0 - 2, 1, "정산 나누기", head(C_GOLD));
  ws.merge(p0 - 2, 1, p0 - 2, 3, head(C_GOLD));
  ws.set(p0 - 1, 1, "이름", labC(C_GREY));
  ws.set(p0 - 1, 2, "비율", labC(C_GREY));
  ws.set(p0 - 1, 3, "운영비 받음(O)", labC(C_GREY));
  const partners = (inp.partners?.length ? inp.partners : [{ name: "대표", share: 1 }]).slice(0, SET_ROWS.partners);
  for (let i = 0; i < SET_ROWS.partners; i++) {
    const p = partners[i];
    ws.set(p0 + i, 1, p ? p.name : null, { border: true, h: "left", fill: C_INPUT });
    ws.set(p0 + i, 2, p ? p.share : null, { border: true, h: "right", fmt: "pct", fill: C_INPUT });
    ws.set(p0 + i, 3, p?.ops ? "O" : null, { border: true, h: "center", fill: C_INPUT });
  }
  const r = p0 + SET_ROWS.partners + 1;
  const help = [
    "총 정산 = 순이익 − 예비비 − 운영비 − 기부금 (순이익이 0보다 적은 달은 예비비 · 운영비 · 기부금 0)",
    "정산 = 총 정산 × 비율 · 비율 합계는 100%가 되게 적어 주세요",
    "운영비 받음에 O 를 적은 분은 달 시트 '운영비+이름' 줄에 운영비 + 그분 정산이 나와요",
    "달 시트의 정산 줄은 지금 적힌 분 수 + 한 줄이에요 — 더 많이 나누려면 앱에서 다시 받아 주세요",
    "예비비잔액 = 연도 표의 예비비 합계 − 예비비 사용 합계",
  ];
  help.forEach((t, i) => ws.set(r + i, 1, t, S_NOTE));
  return ws;
}

/** 회계관리 엑셀 파일(바이트) */
export function buildAcctWorkbook(inp: AcctInput, now: Date = new Date()): Uint8Array {
  const wb = new XWorkbook();
  wb.title = inp.title;
  const months = [...inp.months].sort((a, b) => a.ym.localeCompare(b.ym));
  const sheets = months.map((m) => monthSheet(wb, inp, m));
  if (inp.profile === "business") settingsSheet(wb, inp);
  const want = inp.activeYm ?? months[months.length - 1]?.ym;
  const idx = Math.max(0, months.findIndex((m) => m.ym === want));
  if (sheets[idx]) sheets[idx].selected = true;
  return wb.toBytes(now);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** 파일 이름에 못 쓰는 글자 빼기 */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

// ───────────────────────── 앱들이 같이 쓰는 나누기 규칙 ─────────────────────────

/** 상품 이름 → 기간 칸('1개월' · '3개월' · '12개월' · 'PT' · '기타') — 회원 칸(신규 · 재등록) */
export function planBucket(product: string | null | undefined): { key: string; label: string; order: number } {
  const t = String(product ?? "");
  if (/PT|피티|퍼스널|개인\s*레슨/i.test(t)) return { key: "pt", label: "PT", order: 900 };
  const mo = t.match(/(\d{1,2})\s*개월/);
  if (mo) {
    const n = Number(mo[1]);
    if (n >= 1 && n <= 36) return { key: `m${n}`, label: `${n}개월`, order: n };
  }
  const yr = t.match(/(?:^|[^\d])([1-3])\s*년/);
  if (yr) {
    const n = Number(yr[1]) * 12;
    return { key: `m${n}`, label: `${n}개월`, order: n };
  }
  if (/일일|원데이|1일/.test(t)) return { key: "day", label: "일일권", order: 0.5 };
  return { key: "etc", label: "기타", order: 950 };
}

/** 회원 칸 줄 — 늘 1개월 · 3개월을 먼저 두고(대표님 표), 나머지는 있는 것만 */
export function memberLines(counts: Map<string, { label: string; order: number; n: number }>): AcctLine[] {
  const base = new Map(counts);
  if (!base.has("m1")) base.set("m1", { label: "1개월", order: 1, n: 0 });
  if (!base.has("m3")) base.set("m3", { label: "3개월", order: 3, n: 0 });
  return [...base.values()].sort((a, b) => a.order - b.order).map((x) => ({ label: x.label, value: x.n }));
}

/** 결제 수단 이름 다듬기 — '이체' → '계좌이체', 빈칸 → '기타' */
export function payMethodLabel(m: string | null | undefined): string {
  const t = String(m ?? "").trim();
  if (!t || t === "-") return "기타";
  return t
    .split(/\s*\+\s*/)
    .map((x) => (x === "이체" ? "계좌이체" : x))
    .join(" + ");
}
