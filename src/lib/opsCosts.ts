/**
 * 153운영본부 「매출」 · 순이익 — 153가계부 CSV → 달 · 항목별 사업 비용 (2026-11-04 대표님
 * "153가계부랑 연동해서 선릉역점 통장내역 올리면 순이익도 계산하자" → 「가계부에 올리기」 · 「매출 − 사업 비용」)
 *
 *   153가계부(153-gagyebu.pages.dev)는 10/29 판부터 기록을 그 기기 안에만 둔다(서버 연결 없음).
 *   가계부 › 설정 › '엑셀용 CSV'(전체 내역 내보내기) 파일을 매출 탭에 올리면, 이 화면이 파일을 읽어
 *   사업 장부 · 고른 매장의 지출만 달 · 항목별로 더한다 → 합계만 서버(ops_costs_save)에 저장. 거래 하나하나 · 개인 장부는 서버로 안 간다.
 *
 *   CSV 모양(가계부 exportCsv): 날짜 · 구분(지출 · 수입 · 이동 · 헌금 · 돌려받음) · 카테고리 · 헌금 종류 · 금액(지출은 −) · 메모 ·
 *   십일조 대상 · 십일조 기준 금액 · 귀속 월 · 고정비 · 장부(개인 · 사업) · 매장 · 통장 · 이동 종류 · 확인 필요
 *   비용 = 사업 장부의 '지출'(− 금액) − '돌려받음'(환불) · '이동'(내 통장끼리 · 개인으로 가져간 돈) · '수입'은 비용이 아니다.
 *   달 = 귀속 월이 있으면 그 달, 없으면 날짜의 달.
 */

/** 가계부 카테고리 이름 → 키 (가계부 app.js OUT_CATS 와 같은 이름) */
export const GB_CAT_KEY: Record<string, string> = {
  인건비: "bpay",
  임대료: "brent",
  "용품·장비": "bsupply",
  "공과금·렌탈": "butil",
  "세무·수수료": "bfee",
  카드대금: "card",
  간편결제: "epay",
  "대출·금융": "loan",
  "세금·공과금": "tax",
  "통신·구독": "phone",
  보험: "insure",
  "교통·차량": "car",
  식비: "food",
  기타: "etc",
  "카페·간식": "cafe",
  "생활·마트": "living",
  "주거·관리비": "house",
  "의료·건강": "health",
  "자녀·교육": "kids",
  "경조사·선물": "gift",
  "쇼핑·의류": "shop",
  "여가·여행": "fun",
  "저축·투자": "save",
};

/** 늘 빼는 항목 — 저축 · 투자는 비용이 아니다 */
export const ALWAYS_SKIP = ["save"];
/** 처음엔 빼 두는 항목 — 대출 원금은 비용이 아니다(이자만 비용이지만 가계부에서 나뉘지 않음) */
export const DEFAULT_SKIP = ["loan"];

export interface GbRow {
  d: string; // YYYY-MM-DD
  kind: string; // 지출 · 수입 · 이동 · 헌금 · 돌려받음
  cat: string; // 가계부 카테고리 이름
  amount: number; // 가계부 그대로(지출은 −)
  fm: string; // 귀속 월 YYYY-MM 또는 ''
  book: string; // 개인 · 사업
  store: string; // 매장
}

export interface CostCat {
  k: string;
  label: string;
  amount: number;
  count: number;
}

export interface CostMonth {
  month: string; // YYYY-MM
  total: number;
  cats: CostCat[];
}

export type GbParse =
  | { ok: true; rows: GbRow[]; biz: number; total: number }
  | { ok: false; error: string };

/** 따옴표 · "" · 줄바꿈 · CRLF · BOM 을 아는 CSV 읽기 */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

/** 엑셀이 붙인 수식 막이 ' 와 띄어쓰기 · 원 · 쉼표 빼기 */
const clean = (v: string | undefined) => (v ?? "").replace(/^'(?=[=+\-@])/, "").trim();
const toAmount = (v: string | undefined): number => {
  const s = clean(v).replace(/[,\s원₩]/g, "");
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(Number(s));
};
/** 2026-10-05 · 2026.10.05 · 2026/10/5 → 2026-10-05 */
const toDay = (v: string | undefined): string => {
  const m = clean(v).match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return "";
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  return `${m[1]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};
const toMonth = (v: string | undefined): string => {
  const m = clean(v).match(/^(\d{4})[-./](\d{1,2})$/);
  if (!m) return "";
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12 ? `${m[1]}-${String(mm).padStart(2, "0")}` : "";
};

const NEED = ["날짜", "구분", "카테고리", "금액", "장부", "매장"] as const;

/** 가계부 CSV 글 → 줄. 가계부에서 내보낸 파일이 아니면 ok:false */
export function parseGagyebuCsv(text: string): GbParse {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, error: "빈 파일이에요" };
  const head = table[0].map((h) => clean(h));
  const col = Object.fromEntries(head.map((h, i) => [h, i])) as Record<string, number>;
  if (NEED.some((n) => col[n] === undefined)) return { ok: false, error: "153가계부에서 '엑셀용 CSV'로 내보낸 파일을 골라 주세요" };
  const rows: GbRow[] = [];
  for (const r of table.slice(1)) {
    const d = toDay(r[col["날짜"]]);
    const amount = toAmount(r[col["금액"]]);
    if (!d || !Number.isFinite(amount) || amount === 0) continue;
    rows.push({
      d,
      kind: clean(r[col["구분"]]),
      cat: clean(r[col["카테고리"]]),
      amount,
      fm: col["귀속 월"] !== undefined ? toMonth(r[col["귀속 월"]]) : "",
      book: clean(r[col["장부"]]),
      store: clean(r[col["매장"]]).slice(0, 24),
    });
  }
  if (!rows.length) return { ok: false, error: "파일에 기록이 없어요" };
  return { ok: true, rows, biz: rows.filter((x) => x.book === "사업").length, total: rows.length };
}

/** 파일 → 글 (가계부는 UTF-8. 엑셀에서 다시 저장한 파일은 EUC-KR 일 수 있다) */
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

/** '153복싱짐 선릉역점' → '선릉' (매장 이름 맞추기) */
export const branchKey = (branch: string) =>
  branch
    .replace(/^153\s*복싱짐\s*/, "")
    .replace(/\s+/g, "")
    .replace(/(역점|점)$/, "");

const normStore = (s: string) => s.replace(/\s+/g, "");

/** 사업 장부에 나온 매장(기록 수 많은 것부터). 매장을 안 적은 사업 지출은 noStore */
export function bizStores(rows: GbRow[]): { stores: Array<{ name: string; n: number }>; noStore: number } {
  const map = new Map<string, number>();
  let noStore = 0;
  for (const r of rows) {
    if (r.book !== "사업" || (r.kind !== "지출" && r.kind !== "돌려받음")) continue;
    if (!r.store) noStore++;
    else map.set(r.store, (map.get(r.store) ?? 0) + 1);
  }
  const stores = [...map.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  return { stores, noStore };
}

/** 이 지점 매장으로 보이는 것 (예: 선릉역점 ← '153복싱짐 선릉역점' · '선릉점' · '선릉') */
export const defaultStores = (stores: Array<{ name: string }>, branch: string): string[] => {
  const key = branchKey(branch);
  return key ? stores.filter((s) => normStore(s.name).includes(key)).map((s) => s.name) : [];
};

const catKey = (label: string) => GB_CAT_KEY[label] ?? "etc";
const LABEL_OF: Record<string, string> = Object.fromEntries(Object.entries(GB_CAT_KEY).map(([label, k]) => [k, label]));
/** 항목 키 → 가계부 이름 (모르는 것은 기타) */
export const catLabel = (k: string) => LABEL_OF[k] ?? "기타";

/** 사업 장부 · 고른 매장의 달 · 항목별 비용(최근 달부터) */
export function costsByMonth(
  rows: GbRow[],
  opt: { stores: string[]; noStore: boolean; skip: string[] },
): CostMonth[] {
  const pick = new Set(opt.stores);
  const skip = new Set([...ALWAYS_SKIP, ...opt.skip]);
  const months = new Map<string, Map<string, CostCat>>();
  for (const r of rows) {
    if (r.book !== "사업") continue;
    if (r.store ? !pick.has(r.store) : !opt.noStore) continue;
    const out = r.kind === "지출";
    const back = r.kind === "돌려받음";
    if (!out && !back) continue;
    const k = catKey(r.cat);
    if (skip.has(k)) continue;
    const month = r.fm || r.d.slice(0, 7);
    const cats = months.get(month) ?? new Map<string, CostCat>();
    const c = cats.get(k) ?? { k, label: catLabel(k), amount: 0, count: 0 };
    if (out) {
      c.amount += Math.abs(r.amount);
      c.count += 1;
    } else c.amount -= Math.abs(r.amount);
    cats.set(k, c);
    months.set(month, cats);
  }
  return [...months.entries()]
    .map(([month, cats]) => {
      const list = [...cats.values()].filter((c) => c.amount !== 0 || c.count > 0).sort((a, b) => b.amount - a.amount);
      return { month, total: list.reduce((t, c) => t + c.amount, 0), cats: list };
    })
    .filter((m) => m.cats.length > 0)
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 서버로 보낼 모양 */
export const toSavePayload = (months: CostMonth[]) =>
  months.map((m) => ({
    month: m.month,
    cats: m.cats.map((c) => ({ k: c.k, label: c.label, amount: c.amount, count: c.count })),
  }));

/** 처음에 고를 달 — 끝난 달(지난달까지) · 최근 12개월. 이번 달은 아직 덜 찼으니 고르면 넣는다 */
export const defaultMonths = (months: CostMonth[], thisMonth: string, n = 12): string[] =>
  months
    .map((m) => m.month)
    .filter((m) => m < thisMonth)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, n);

/** 서버에 저장된 비용 */
export interface SavedCostMonth {
  month: string;
  total: number;
  /** 어디서 왔나 — 가계부 CSV(기본) · 통장 내역서(클로드가 정리, 2026-11-04) */
  source?: "gagyebu_csv" | "bank_statement";
  stores: string[];
  no_store: boolean;
  /** 가계부 = 뺀 항목 키(loan …) · 통장 내역서 = 뺀 묶음 이름(큰 것부터) */
  excluded: string[];
  saved_at: string;
  saved_by: string | null;
}

/** 순이익 카드 아래 줄 — 어디서 왔나 · 뺀 것. savedDay = '11월 4일' */
export const costSourceLine = (
  meta: Pick<SavedCostMonth, "source" | "stores" | "no_store" | "excluded">,
  savedDay: string,
): string => {
  if (meta.source === "bank_statement") {
    const ex = meta.excluded.filter((x) => x.trim() !== "");
    const tail = ex.length === 0 ? "" : ex.length === 1 ? ` · ${ex[0]} 뺌` : ` · ${ex[0]} 등 ${ex.length}가지 뺌`;
    return `통장 내역 ${savedDay} 정리${tail}`;
  }
  const short = (s: string) => s.replace(/^153\s*복싱짐\s*/, "");
  const stores = [...meta.stores.map(short), ...(meta.no_store ? ["매장 없음"] : [])];
  return `가계부 ${savedDay} 올림${stores.length ? ` · ${stores.join(", ")}` : ""}${meta.excluded.includes("loan") ? " · 대출 뺌" : ""}`;
};
export interface SavedCosts {
  months: SavedCostMonth[];
  rows: Array<{ month: string; k: string; label: string; amount: number; count: number }>;
}

/** 순이익 = 매출 − 비용, 매출 대비 % (매출이 0 이하이면 null) */
export const profitOf = (sales: number, cost: number) => {
  const profit = sales - cost;
  return { profit, pct: sales > 0 ? Math.round((profit / sales) * 100) : null };
};

/** 항목 목록 — 위 n개 + 나머지는 '그 밖 N개' 한 줄 */
export const topCats = <T extends { amount: number }>(cats: T[], n = 6) => {
  const sorted = [...cats].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  return { top, rest: rest.length ? { n: rest.length, amount: rest.reduce((t, c) => t + c.amount, 0) } : null };
};
