// 153운영본부 「매출」 — 나누기 · 합치기 규칙 (Edge Function ops-sales 와 테스트 src/lib/opsSales.test.ts 가 같이 쓴다)
//
//   원본: 브로제이 지점 = 153OS sales_entries(category 수강권 · 물품 · 기타, 금액이 음수면 환불)
//         칠금점(다짐) = 153OS dagym_sales(general · daily · etc · rentalLocker · rentalSportsWear · transferMembership,
//                       한 판매를 여러 결제수단으로 나눈 줄은 sale_id 로 한 건, 환불 줄은 따로 — registration_report 와 같은 규칙)
//         앱 결제 = 앱 DB payment_orders(+ payment_order_items) — 브로제이에 같은 사람 · 같은 금액이 며칠 안에 있으면 빼고(중복),
//                   없을 때만 '앱 결제'로 더한다(직원이 브로제이에 다시 적기도 하고 안 적기도 한다).
//   나누기: 일반 수강권(membership) · PT(pt — 이름에 PT · 퍼스널 · 피티) · 일일권 · 락카/운동복 · 용품 · 기타. 0원 줄과 양도는 뺀다.

export type SalesGroup = "membership" | "pt" | "daily" | "rental" | "goods" | "etc";
export type SalesSrc = "broj" | "dagym" | "app";

export const SALES_GROUPS: SalesGroup[] = ["membership", "pt", "daily", "rental", "goods", "etc"];

export interface SalesRow {
  id: string;
  day: string; // YYYY-MM-DD (한국 날짜)
  at: string | null;
  member: string;
  product: string;
  amount: number; // 환불은 음수
  method: string;
  src: SalesSrc;
  group: SalesGroup;
  refund: boolean;
}

export interface GroupSum {
  amount: number; // 순액(환불 뺌)
  count: number; // 판매 건수(환불 제외)
  refund: number; // 환불 합계(음수)
  refunds: number; // 환불 건수
}

export interface SalesSummary {
  total: number;
  count: number;
  refund: number;
  refunds: number;
  groups: Record<SalesGroup, GroupSum>;
}

export interface TrendPoint {
  month: string; // YYYY-MM
  membership: number;
  pt: number;
  other: number;
  total: number;
}

/** PT — 'PT' 낱말(대소문자) · 퍼스널 · 피티 · personal ('OPTION' 같은 글자 속 pt 는 아님) */
const PT_RE = /(^|[^a-z])pt([^a-z]|$)|퍼스널|피티|personal/i;
const RENTAL_RE = /락커|락카|라커|운동복|사물함/;
const DAILY_RE = /일일|원데이|1일권/;

export const isPtName = (name: string | null | undefined) => PT_RE.test(name ?? "");

/** 원본 한 줄 → 묶음 (null = 매출에서 뺀다) */
export function groupOf(src: SalesSrc, category: string | null | undefined, name: string | null | undefined): SalesGroup | null {
  const n = (name ?? "").trim();
  const c = (category ?? "").trim();
  if (src === "broj") {
    if (c === "수강권") return isPtName(n) ? "pt" : DAILY_RE.test(n) ? "daily" : "membership";
    if (c === "물품") return RENTAL_RE.test(n) ? "rental" : "goods";
    return "etc";
  }
  if (src === "dagym") {
    if (c === "transferMembership") return null;
    if (c === "general") return isPtName(n) ? "pt" : DAILY_RE.test(n) ? "daily" : "membership";
    if (c === "daily") return "daily";
    if (c === "etc") return "goods";
    if (c === "rentalLocker" || c === "rentalSportsWear") return "rental";
    return "etc";
  }
  // 앱 결제 — 항목 종류(locker · sportswear · membership) 또는 이름
  if (c === "locker" || c === "sportswear") return "rental";
  if (RENTAL_RE.test(n)) return "rental";
  return isPtName(n) ? "pt" : "membership";
}

const num = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.round(x) : 0;
};
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** 이름 맞추기 — 띄어쓰기 · 대소문자 무시 */
export const normName = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toLowerCase();

/** ISO 시각 → 한국 날짜 YYYY-MM-DD */
export const kstDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
};

export const addDays = (day: string, n: number): string => {
  const t = Date.parse(`${day}T00:00:00Z`);
  return new Date(t + n * 86400_000).toISOString().slice(0, 10);
};

/** 'YYYY-MM' 과 개수 → 그 달까지 n달 (첫날 · 끝날 · 달 목록) */
export function monthRange(month: string, n: number): { from: string; to: string; months: string[] } {
  const [y, m] = month.split("-").map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${months[0]}-01`, to: `${month}-${String(last).padStart(2, "0")}`, months };
}

// ───────────────────────── 원본 → 줄 ─────────────────────────

export interface BrojEntry {
  id: string;
  sale_date: string;
  created_at?: string | null;
  member_name?: string | null;
  category?: string | null;
  product?: string | null;
  payment_method?: string | null;
  amount: number | string;
}

export function fromBroj(rows: BrojEntry[]): SalesRow[] {
  const out: SalesRow[] = [];
  for (const r of rows) {
    const amount = num(r.amount);
    if (amount === 0) continue;
    const group = groupOf("broj", r.category, r.product);
    if (!group) continue;
    out.push({
      id: `b:${r.id}`,
      day: r.sale_date,
      at: r.created_at ?? null,
      member: txt(r.member_name),
      product: txt(r.product),
      amount,
      method: txt(r.payment_method),
      src: "broj",
      group,
      refund: amount < 0,
    });
  }
  return out;
}

export interface DagymSale {
  row_id: string;
  sale_id: string;
  sale_date: string;
  income_at?: string | null;
  member_name?: string | null;
  sale_category?: string | null;
  sale_name?: string | null;
  income: number | string | null;
  payment_method?: string | null;
  status?: string | null;
}

/** 다짐 — 같은 판매(sale_id)를 나눠 낸 결제 줄은 한 건, 환불 줄(refunded · 음수)은 한 줄씩 */
export function fromDagym(rows: DagymSale[]): SalesRow[] {
  const out: SalesRow[] = [];
  const paid = new Map<string, DagymSale[]>();
  for (const r of rows) {
    if (r.status === "missing") continue;
    const income = num(r.income);
    if (r.status === "refunded" || income < 0) {
      if (income === 0) continue;
      const group = groupOf("dagym", r.sale_category, r.sale_name);
      if (!group) continue;
      out.push({
        id: `r:${r.row_id}`,
        day: r.sale_date,
        at: r.income_at ?? null,
        member: txt(r.member_name),
        product: txt(r.sale_name),
        amount: income,
        method: txt(r.payment_method),
        src: "dagym",
        group,
        refund: true,
      });
      continue;
    }
    if (r.status !== "paid") continue;
    const list = paid.get(r.sale_id) ?? [];
    list.push(r);
    paid.set(r.sale_id, list);
  }
  for (const [saleId, list] of paid) {
    const amount = list.reduce((s, x) => s + num(x.income), 0);
    if (amount === 0) continue;
    const first = [...list].sort((a, b) => a.sale_date.localeCompare(b.sale_date) || txt(a.income_at).localeCompare(txt(b.income_at)))[0];
    const group = groupOf("dagym", first.sale_category, first.sale_name);
    if (!group) continue;
    const methods = [...new Set(list.map((x) => txt(x.payment_method)).filter((m) => m && m !== "-"))];
    out.push({
      id: `d:${saleId}`,
      day: first.sale_date,
      at: first.income_at ?? null,
      member: txt(first.member_name),
      product: txt(first.sale_name),
      amount,
      method: methods.join(" + "),
      src: "dagym",
      group,
      refund: false,
    });
  }
  return out;
}

export interface AppOrder {
  id: string;
  user_id?: string | null;
  product_name?: string | null;
  amount: number | string;
  paid_at: string | null;
  items?: Array<{ kind?: string | null; product_name?: string | null; amount: number | string }> | null;
}

/** 앱 결제(결제선생) — 항목이 있으면 항목마다, 없으면 주문 하나 */
export function fromApp(orders: AppOrder[], names: Map<string, string>): SalesRow[] {
  const out: SalesRow[] = [];
  for (const o of orders) {
    const day = kstDay(o.paid_at);
    if (!day) continue;
    const member = names.get(o.user_id ?? "") ?? "";
    const parts = o.items?.length ? o.items.map((i, k) => ({ k, kind: i.kind, name: i.product_name, amount: num(i.amount) })) : [{ k: 0, kind: null, name: o.product_name, amount: num(o.amount) }];
    for (const p of parts) {
      if (p.amount <= 0) continue;
      const group = groupOf("app", p.kind ?? "", txt(p.name) || txt(o.product_name));
      if (!group) continue;
      out.push({
        id: `a:${o.id}:${p.k}`,
        day,
        at: o.paid_at,
        member,
        product: txt(p.name) || txt(o.product_name),
        amount: p.amount,
        method: "앱 결제",
        src: "app",
        group,
        refund: false,
      });
    }
  }
  return out;
}

/**
 * 앱 결제 중 CRM(브로제이)에도 적힌 것은 뺀다 — 같은 사람(이름) · 같은 금액 · CRM 날짜가 앱 결제 하루 전 ~ 사흘 뒤.
 * CRM 한 줄은 앱 결제 하나에만 짝지운다. 이름을 모르는 앱 결제는 그대로 둔다(맞출 수 없다).
 */
export function dedupeApp(app: SalesRow[], crm: SalesRow[]): SalesRow[] {
  const used = new Set<string>();
  const keep: SalesRow[] = [];
  const sorted = [...app].sort((a, b) => a.day.localeCompare(b.day));
  for (const a of sorted) {
    const name = normName(a.member);
    if (!name) {
      keep.push(a);
      continue;
    }
    const lo = addDays(a.day, -1);
    const hi = addDays(a.day, 3);
    const hit = crm
      .filter((c) => !used.has(c.id) && !c.refund && c.amount === a.amount && normName(c.member) === name && c.day >= lo && c.day <= hi)
      .sort((x, y) => Math.abs(Date.parse(x.day) - Date.parse(a.day)) - Math.abs(Date.parse(y.day) - Date.parse(a.day)))[0];
    if (hit) used.add(hit.id);
    else keep.push(a);
  }
  return keep;
}

// ───────────────────────── 합치기 ─────────────────────────

const emptyGroup = (): GroupSum => ({ amount: 0, count: 0, refund: 0, refunds: 0 });

export function summarize(rows: SalesRow[]): SalesSummary {
  const groups = Object.fromEntries(SALES_GROUPS.map((g) => [g, emptyGroup()])) as Record<SalesGroup, GroupSum>;
  const s: SalesSummary = { total: 0, count: 0, refund: 0, refunds: 0, groups };
  for (const r of rows) {
    const g = groups[r.group];
    g.amount += r.amount;
    s.total += r.amount;
    if (r.refund) {
      g.refund += r.amount;
      g.refunds += 1;
      s.refund += r.amount;
      s.refunds += 1;
    } else {
      g.count += 1;
      s.count += 1;
    }
  }
  return s;
}

/** 달마다 일반 수강권 · PT · 그 밖 (순액) */
export function trendOf(rows: SalesRow[], months: string[]): TrendPoint[] {
  const by = new Map(months.map((m) => [m, { month: m, membership: 0, pt: 0, other: 0, total: 0 }]));
  for (const r of rows) {
    const p = by.get(r.day.slice(0, 7));
    if (!p) continue;
    if (r.group === "membership") p.membership += r.amount;
    else if (r.group === "pt") p.pt += r.amount;
    else p.other += r.amount;
    p.total += r.amount;
  }
  return months.map((m) => by.get(m)!);
}

/** 최근 것부터 */
export const sortRows = (rows: SalesRow[]) =>
  [...rows].sort((a, b) => b.day.localeCompare(a.day) || (b.at ?? "").localeCompare(a.at ?? "") || a.id.localeCompare(b.id));
