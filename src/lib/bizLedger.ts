/**
 * 사업자 가계부 — 화면 없는 계산 (2026-11-28 대표님 「전체 메뉴에 사업자 별로 153복싱짐 칠금점 153복싱짐 선릉역점 등등
 * 사업자 가계부 내역을 만들고 따로 관리할수있는 도록 메뉴 만들어줘」 · 문서 docs/features/73-사업자-가계부.md)
 *
 *   DB 20261128100610_biz_ledger.sql — 사업자(biz_books) · 줄(biz_entries) · 자동 분류(biz_rules).
 *   여기: 항목 이름 · 3.3% 원천세 · 통장 파일(엑셀 · CSV) 읽기 · 같은 거래 알아보는 지문 · 자동 분류 · 달 정리. 시험 bizLedger.test.ts
 *
 *   비용 = 지출 − 돌려받음 (항목마다). 수입 · 이동(내 통장끼리 · 개인)은 비용이 아니다. 달 = 귀속 월.
 *   급여는 일한 달로 — 1~15일에 보낸 급여는 지난달 몫(2026-11-28 선릉역점 통장 정리와 같은 기준).
 *   계좌번호는 읽지도 저장하지도 않는다. 상대 이름의 긴 숫자(가맹점 · 고객 번호)도 뺀다.
 */
import { GB_CAT_KEY, parseCsv } from "@/lib/opsCosts";

export type BizKind = "out" | "in" | "back" | "move";

export const BIZ_KIND_LABEL: Record<BizKind, string> = {
  out: "지출",
  in: "수입",
  back: "돌려받음",
  move: "이동 · 개인",
};

type CatGroup = "biz" | "life" | "in" | "move";

/** 항목 — 이름은 DB _biz_cat_label 과 같게 (키는 153가계부 · 운영본부 순이익과 같은 것) */
export const BIZ_CATS: ReadonlyArray<{ k: string; label: string; group: CatGroup }> = [
  { k: "bpay", label: "인건비", group: "biz" },
  { k: "brent", label: "임대료", group: "biz" },
  { k: "butil", label: "공과금·렌탈", group: "biz" },
  { k: "bfee", label: "세무·수수료", group: "biz" },
  { k: "bins", label: "4대보험", group: "biz" },
  { k: "insure", label: "보험", group: "biz" },
  { k: "tax", label: "세금", group: "biz" },
  { k: "bclean", label: "청소·세탁·방역", group: "biz" },
  { k: "bad", label: "광고·마케팅", group: "biz" },
  { k: "bsupply", label: "용품·장비", group: "biz" },
  { k: "brefund", label: "회원 환불(통장)", group: "biz" },
  { k: "bsend", label: "인건비·시설(개인 송금)", group: "biz" },
  { k: "house", label: "숙소·관리비", group: "biz" },
  { k: "phone", label: "통신·구독", group: "biz" },
  { k: "etc", label: "기타", group: "biz" },
  { k: "car", label: "교통·차량", group: "life" },
  { k: "food", label: "식비", group: "life" },
  { k: "card", label: "카드대금", group: "life" },
  { k: "epay", label: "간편결제", group: "life" },
  { k: "loan", label: "대출·금융", group: "life" },
  { k: "cafe", label: "카페·간식", group: "life" },
  { k: "living", label: "생활·마트", group: "life" },
  { k: "health", label: "의료·건강", group: "life" },
  { k: "kids", label: "자녀·교육", group: "life" },
  { k: "gift", label: "경조사·선물", group: "life" },
  { k: "shop", label: "쇼핑·의류", group: "life" },
  { k: "fun", label: "여가·여행", group: "life" },
  { k: "save", label: "저축·투자", group: "life" },
  { k: "sales", label: "매출 입금", group: "in" },
  { k: "subsidy", label: "지원금", group: "in" },
  { k: "move", label: "내 통장 · 개인", group: "move" },
];

const LABEL = new Map(BIZ_CATS.map((c) => [c.k, c.label]));
/** 항목 키 → 이름 (모르는 것은 기타) */
export const bizCatLabel = (k: string): string => LABEL.get(k) ?? "기타";

/** 이 구분에서 고를 수 있는 항목 */
export const catsForKind = (kind: BizKind): ReadonlyArray<{ k: string; label: string; group: CatGroup }> =>
  kind === "in"
    ? BIZ_CATS.filter((c) => c.group === "in" || c.k === "etc")
    : kind === "move"
      ? BIZ_CATS.filter((c) => c.group === "move")
      : BIZ_CATS.filter((c) => c.group === "biz" || c.group === "life");

/** 이 구분의 첫 항목 */
export const defaultCat = (kind: BizKind): string => (kind === "in" ? "sales" : kind === "move" ? "move" : "etc");

/** 'YYYY-MM' → 지난달 'YYYY-MM' */
export const prevMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/** 'YYYY-MM' → 다음 달 */
export const nextMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/**
 * 프리랜서(사업소득) 3.3% — 소득세 3%(10원 미만 버림, 1,000원 미만이면 안 뗌) + 지방소득세(소득세의 10%, 10원 미만 버림).
 * gross = 세전 금액 → { tax: 뗄 돈, net: 실제로 보낼 돈 }
 */
export const whtOf = (gross: number): { tax: number; net: number } => {
  const g = Math.max(0, Math.round(gross));
  let income = Math.floor((g * 0.03) / 10) * 10;
  if (income < 1000) income = 0;
  const local = Math.floor((income * 0.1) / 10) * 10;
  const tax = income + local;
  return { tax, net: g - tax };
};

// ── 상대 이름 정리 · 지문 ─────────────────────────────────────

const CARD_CO: Record<string, string> = { KB: "KB국민", 현: "현대", 하나: "하나", 신한: "신한", 롯데: "롯데", 우: "우리", NH: "NH농협", 삼성: "삼성" };

/** 통장 적요 → 상대 이름. 카드사 정산(카드사 + 가맹점 번호)은 '카드 매출 정산(카드사)', 그 밖의 긴 숫자는 뺀다 */
export const cleanParty = (raw: string): string => {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  const card = s.match(/^(KB|현|하나|신한|롯데|우|NH|삼성)(\d{5,})$/);
  if (card) return `카드 매출 정산(${CARD_CO[card[1]]})`;
  if (/^\d{5,}B$/.test(s)) return "카드 매출 정산(BC)";
  if (/^\d{5,}$/.test(s)) return "카드 매출 정산";
  return s.replace(/\d{5,}/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
};

/** SHA-1 (글 → 16진수) — 지문용. 브라우저 · 시험에서 똑같이, 기다리지 않고 */
export function sha1Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const words = new Uint32Array((((len + 8) >> 6) + 1) * 16);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[words.length - 1] = len * 8;
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let b = 0; b < words.length; b += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[b + t];
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0;
    let bb = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = rotl(bb, 30) >>> 0;
      bb = a;
      a = tmp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + bb) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, "0")).join("");
}

const SEP = "\u001f";

/**
 * 통장 줄 지문 — 거래 일시 · 금액(나간 돈은 −) · 잔액. 잔액이 없는 파일은 상대 이름으로.
 * 한 파일 안에 똑같은 줄이 또 있으면 n(2, 3 …)을 붙인다. 같은 통장 파일을 두 번 올려도 한 번만 들어간다.
 */
export const bankFp = (dt: string, amount: number, balance: number | null, party: string, n = 1): string =>
  "tb" + sha1Hex([dt, String(amount), balance === null ? `p:${party}` : String(balance)].join(SEP) + (n > 1 ? `${SEP}#${n}` : "")).slice(0, 20);

// ── 통장 파일 읽기 ───────────────────────────────────────────

export interface BankRow {
  /** 'YYYY-MM-DD HH:MM:SS' (시간이 없는 파일은 'YYYY-MM-DD') */
  dt: string;
  day: string;
  /** 들어온 돈 +, 나간 돈 − */
  amount: number;
  balance: number | null;
  party: string;
  /** 거래 유형(입금 · 출금 · 체크카드결제 …) */
  type: string;
  /** 파일의 메모 칸 */
  note: string;
}

export type BankParse = { ok: true; rows: BankRow[]; skipped: number } | { ok: false; error: string };

const norm = (h: string) => (h ?? "").replace(/\(.*?\)/g, "").replace(/[\s_·/]/g, "").trim();
const cell = (v: unknown) => String(v ?? "").replace(/^'(?=[=+\-@])/, "").trim();

/** 1,000 · −1,000 · (1,000) · 1000원 → 숫자 (빈칸 · 글자는 NaN) */
export const toWon = (v: string): number => {
  let s = cell(v).replace(/[,\s원₩]/g, "").replace(/[−–]/g, "-");
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Math.round(Number(s));
  return neg ? -n : n;
};

/** 2026.11.27 14:03:22 · 2026-11-27 14:03 · 2026/11/27 · 2026년 11월 27일 → { day, time } */
const toDateTime = (v: string): { day: string; time: string } | null => {
  const s = cell(v);
  const m =
    s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?:\s*일)?(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/) ?? null;
  if (!m) return null;
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const day = `${m[1]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const time = m[4] ? `${m[4].padStart(2, "0")}:${m[5]}:${(m[6] ?? "00").padStart(2, "0")}` : "";
  return { day, time };
};
const toTime = (v: string): string => {
  const m = cell(v).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}:${(m[3] ?? "00").padStart(2, "0")}` : "";
};

const HEAD = {
  date: ["거래일시", "거래일자", "거래일", "일시", "일자", "날짜", "거래날짜", "date"],
  time: ["거래시간", "시간", "시각"],
  amount: ["거래금액", "금액", "거래액"],
  inn: ["입금", "입금액", "입금금액", "맡기신금액", "들어온돈"],
  out: ["출금", "출금액", "출금금액", "찾으신금액", "지급액", "나간돈"],
  balance: ["거래후잔액", "잔액", "잔고", "거래후잔고"],
  party: ["적요", "내용", "거래내용", "기재내용", "받는분보낸분", "받는분", "보낸분", "상대방", "거래처", "통장표시내용", "의뢰인수취인", "거래처명"],
  type: ["거래유형", "거래구분", "구분", "유형"],
  note: ["메모"],
};
const findCol = (head: string[], names: string[]) => {
  for (const n of names) {
    const i = head.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
};

/** 표(줄 · 칸) → 통장 줄. 머리글 줄은 위쪽 30줄 안에서 찾는다 (계좌번호 칸은 읽지 않는다) */
export function parseBankTable(table: string[][]): BankParse {
  if (!table.length) return { ok: false, error: "빈 파일이에요" };
  let hi = -1;
  let col: Record<keyof typeof HEAD, number> | null = null;
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const head = table[i].map((h) => norm(String(h ?? "")));
    const c = Object.fromEntries(Object.entries(HEAD).map(([k, names]) => [k, findCol(head, names)])) as Record<keyof typeof HEAD, number>;
    if (c.date >= 0 && (c.amount >= 0 || (c.inn >= 0 && c.out >= 0))) {
      hi = i;
      col = c;
      break;
    }
  }
  if (!col) return { ok: false, error: "거래 일시 · 금액 칸을 찾지 못했어요. 은행 앱에서 받은 거래내역 엑셀(또는 CSV)을 골라 주세요" };
  const rows: BankRow[] = [];
  let skipped = 0;
  for (const r of table.slice(hi + 1)) {
    const dt = toDateTime(String(r[col.date] ?? ""));
    if (!dt) {
      if (r.some((x) => cell(String(x ?? "")) !== "")) skipped++;
      continue;
    }
    let amount = NaN;
    if (col.amount >= 0) amount = toWon(String(r[col.amount] ?? ""));
    if (!Number.isFinite(amount) || amount === 0) {
      const i = col.inn >= 0 ? toWon(String(r[col.inn] ?? "")) : NaN;
      const o = col.out >= 0 ? toWon(String(r[col.out] ?? "")) : NaN;
      if (Number.isFinite(i) && i !== 0) amount = Math.abs(i);
      else if (Number.isFinite(o) && o !== 0) amount = -Math.abs(o);
    }
    if (!Number.isFinite(amount) || amount === 0) {
      skipped++;
      continue;
    }
    const type = col.type >= 0 ? cell(String(r[col.type] ?? "")).slice(0, 20) : "";
    // 금액 칸 하나에 부호가 없는 은행 — 거래 유형으로 나간 돈을 알아본다
    if (col.amount >= 0 && col.inn < 0 && amount > 0 && /출금|지급|결제|이체출|자동이체|송금/.test(type) && !/입금/.test(type)) amount = -amount;
    const time = dt.time || (col.time >= 0 ? toTime(String(r[col.time] ?? "")) : "");
    const bal = col.balance >= 0 ? toWon(String(r[col.balance] ?? "")) : NaN;
    rows.push({
      dt: time ? `${dt.day} ${time}` : dt.day,
      day: dt.day,
      amount,
      balance: Number.isFinite(bal) ? bal : null,
      party: col.party >= 0 ? cleanParty(String(r[col.party] ?? "")) : "",
      type,
      note: col.note >= 0 && col.note !== col.party ? cell(String(r[col.note] ?? "")).slice(0, 100) : "",
    });
  }
  if (!rows.length) return { ok: false, error: "파일에 거래가 없어요" };
  return { ok: true, rows, skipped };
}

/** CSV 글 → 통장 줄 */
export const parseBankCsv = (text: string): BankParse => parseBankTable(parseCsv(text));

// ── 자동 분류 ───────────────────────────────────────────────

export interface BizRule {
  id?: string;
  keyword: string;
  kind: BizKind;
  cat: string;
  staff_id: string | null;
  staff_name?: string | null;
}

/**
 * 받는 · 보낸 이름(+ 메모)에 낱말이 들어 있는 규칙 중 가장 긴 것.
 * 나간 돈은 지출 · 이동 규칙만, 들어온 돈은 수입 · 돌려받음 · 이동 규칙만 맞춘다.
 */
export function matchRule(rules: readonly BizRule[], text: string, incoming: boolean): BizRule | null {
  const t = text.toLowerCase();
  let best: BizRule | null = null;
  for (const r of rules) {
    const kw = r.keyword.trim().toLowerCase();
    if (!kw || !t.includes(kw)) continue;
    const ok = r.kind === "move" || (incoming ? r.kind === "in" || r.kind === "back" : r.kind === "out");
    if (!ok) continue;
    if (!best || kw.length > best.keyword.trim().length) best = r;
  }
  return best;
}

/** 서버로 보내는 한 줄 (biz_import) */
export interface BizImportRow {
  day: string;
  month: string;
  kind: BizKind;
  cat: string;
  amount: number;
  party: string;
  memo: string;
  account: string;
  staff_id: string | null;
  fp: string;
  /** 규칙에 안 걸린 나간 돈 — 보고 고쳐 주세요 */
  review: boolean;
}

export const REVIEW_TAG = "확인 필요";

/**
 * 통장 줄 → 가계부 줄. 규칙에 안 걸린 들어온 돈 = 매출 입금, 나간 돈 = 기타 지출(확인 필요).
 * 급여(인건비)를 1~15일에 보냈으면 지난달 몫(payAccrual).
 */
export function classifyBankRows(
  rows: readonly BankRow[],
  rules: readonly BizRule[],
  opt: { account: string; payAccrual: boolean },
): BizImportRow[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const incoming = r.amount > 0;
    const rule = matchRule(rules, `${r.party} ${r.note}`, incoming);
    const kind: BizKind = rule ? rule.kind : incoming ? "in" : "out";
    const cat = rule ? rule.cat : incoming ? "sales" : "etc";
    const review = !rule && !incoming;
    let month = r.day.slice(0, 7);
    if (kind === "out" && cat === "bpay" && opt.payAccrual && Number(r.day.slice(8, 10)) <= 15) month = prevMonth(month);
    const base = [r.dt, r.amount, r.balance, r.balance === null ? r.party : ""].join(SEP);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const memo = [r.type, r.note, review ? REVIEW_TAG : ""].filter(Boolean).join(" · ").slice(0, 200);
    return {
      day: r.day,
      month,
      kind,
      cat,
      amount: Math.abs(r.amount),
      party: r.party,
      memo,
      account: opt.account.slice(0, 30),
      staff_id: rule?.staff_id ?? null,
      fp: bankFp(r.dt, r.amount, r.balance, r.party, n),
      review,
    };
  });
}

// ── 153가계부 CSV ────────────────────────────────────────────

const GB_KIND: Record<string, BizKind> = { 지출: "out", 수입: "in", 돌려받음: "back", 이동: "move", 헌금: "move" };

export type GbBookParse =
  | { ok: true; rows: BizImportRow[]; storeOf: string[]; stores: Array<{ name: string; n: number }>; noStore: number }
  | { ok: false; error: string };

/**
 * 153가계부 '엑셀용 CSV' → 사업 장부 줄. storeOf[i] = rows[i] 의 매장(고른 매장만 넣는 건 화면이 거른다).
 * 지출 → 지출 · 돌려받음 → 돌려받음 · 수입 → 수입 · 이동 · 헌금 → 이동. 달 = 귀속 월(없으면 날짜의 달).
 */
export function parseGagyebuBook(text: string): GbBookParse {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, error: "빈 파일이에요" };
  const head = table[0].map((h) => cell(h));
  const c = (n: string) => head.indexOf(n);
  if (["날짜", "구분", "카테고리", "금액", "장부"].some((n) => c(n) < 0)) {
    return { ok: false, error: "153가계부에서 '엑셀용 CSV'로 내보낸 파일이 아니에요" };
  }
  const rows: BizImportRow[] = [];
  const storeOf: string[] = [];
  const stores = new Map<string, number>();
  let noStore = 0;
  const seen = new Map<string, number>();
  for (const r of table.slice(1)) {
    if (cell(r[c("장부")]) !== "사업") continue;
    const dt = toDateTime(r[c("날짜")] ?? "");
    const amount = toWon(r[c("금액")] ?? "");
    const kind = GB_KIND[cell(r[c("구분")])];
    if (!dt || !Number.isFinite(amount) || amount === 0 || !kind) continue;
    const store = c("매장") >= 0 ? cell(r[c("매장")]).slice(0, 24) : "";
    if (store) stores.set(store, (stores.get(store) ?? 0) + 1);
    else noStore++;
    const label = cell(r[c("카테고리")]);
    const cat = kind === "in" ? "sales" : kind === "move" ? "move" : GB_CAT_KEY[label] ?? "etc";
    const fmRaw = c("귀속 월") >= 0 ? cell(r[c("귀속 월")]) : "";
    const fm = /^\d{4}[-./]\d{1,2}$/.test(fmRaw) ? `${fmRaw.slice(0, 4)}-${fmRaw.split(/[-./]/)[1].padStart(2, "0")}` : "";
    const memo = c("메모") >= 0 ? cell(r[c("메모")]) : "";
    const account = c("통장") >= 0 ? cell(r[c("통장")]).slice(0, 30) : "";
    const base = [dt.day, kind, cat, Math.abs(amount), memo, store].join(SEP);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({
      day: dt.day,
      month: fm || dt.day.slice(0, 7),
      kind,
      cat,
      amount: Math.abs(amount),
      party: memo.slice(0, 60),
      memo: ["153가계부", label].filter(Boolean).join(" · ").slice(0, 200),
      account,
      staff_id: null,
      fp: "gb" + sha1Hex(base + (n > 1 ? `${SEP}#${n}` : "")).slice(0, 20),
      review: false,
    });
    storeOf.push(store);
  }
  if (!rows.length) return { ok: false, error: "사업 장부 기록이 없어요" };
  return {
    ok: true,
    rows,
    storeOf,
    stores: [...stores.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    noStore,
  };
}

// ── 달 정리 ─────────────────────────────────────────────────

export interface BizEntry {
  id: string;
  day: string;
  month: string;
  kind: BizKind;
  cat: string;
  amount: number;
  n: number;
  party: string;
  memo: string;
  account: string;
  staff_id: string | null;
  staff_name: string | null;
  wht: number | null;
  source: "manual" | "gagyebu_csv" | "bank_file" | "summary";
}

export interface BizMonthSummary {
  /** 비용 = 지출 − 돌려받음 */
  cost: number;
  inn: number;
  move: number;
  /** 항목별 비용(큰 것부터) */
  cats: Array<{ k: string; label: string; amount: number; count: number }>;
  /** 인건비 · 사람별 */
  pay: Array<{ name: string; amount: number; count: number }>;
  /** 확인 필요 줄 */
  review: number;
}

export function summarizeMonth(entries: readonly BizEntry[]): BizMonthSummary {
  const cats = new Map<string, { k: string; label: string; amount: number; count: number }>();
  const pay = new Map<string, { name: string; amount: number; count: number }>();
  let inn = 0;
  let move = 0;
  let review = 0;
  for (const e of entries) {
    if (e.memo.includes(REVIEW_TAG)) review++;
    if (e.kind === "in") inn += e.amount;
    else if (e.kind === "move") move += e.amount;
    else {
      const sign = e.kind === "out" ? 1 : -1;
      const c = cats.get(e.cat) ?? { k: e.cat, label: bizCatLabel(e.cat), amount: 0, count: 0 };
      c.amount += sign * e.amount;
      if (e.kind === "out") c.count += e.n;
      cats.set(e.cat, c);
      if (e.cat === "bpay") {
        const name = e.staff_name || e.party || "이름 없음";
        const p = pay.get(name) ?? { name, amount: 0, count: 0 };
        p.amount += sign * e.amount;
        if (e.kind === "out") p.count += e.n;
        pay.set(name, p);
      }
    }
  }
  const list = [...cats.values()].filter((c) => c.amount !== 0).sort((a, b) => b.amount - a.amount);
  return {
    cost: list.reduce((t, c) => t + c.amount, 0),
    inn,
    move,
    cats: list,
    pay: [...pay.values()].filter((p) => p.amount !== 0).sort((a, b) => b.amount - a.amount),
    review,
  };
}

/** 줄 거르기 */
export type BizFilter = "all" | "out" | "in" | "move" | "review";
export const matchBizFilter = (e: Pick<BizEntry, "kind" | "memo">, f: BizFilter): boolean =>
  f === "all"
    ? true
    : f === "review"
      ? e.memo.includes(REVIEW_TAG)
      : f === "out"
        ? e.kind === "out" || e.kind === "back"
        : e.kind === f;
