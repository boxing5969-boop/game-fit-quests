// 사업자 가계부 → 153OS 월별 손익 정산판 — 나누기 규칙 (Edge Function biz-os-sync 와 시험 src/lib/bizOsSync.test.ts 가 같이 쓴다)
//
//   가계부가 정본: 금액 · 항목은 가계부 그대로(비용 = 지출 − 돌려받음 · 급여는 일한 달). 153OS 쪽 분류 규칙(branch_pl_rules)은
//   이름만 빌린다 — 급여 줄은 labor 규칙(사람 이름 → '지점장 급여' 같은 이름), 뺀 돈은 exclude 규칙(→ '제외: 대표 이체' 같은 이름).
//   153OS 표 칸: rent(임대료) · labor(인건비) · fixed(고정) · variable(유동) · excluded(제외 — 비용 아님) + items[{ group, label, amount }]
//   이름 · 금액은 로그에 찍지 않는다(부르는 쪽 몫).

export interface BizOsCat {
  cat: string;
  label: string;
  amt: number;
}
export interface BizOsPay {
  who: string;
  amt: number;
}
export interface BizOsMove {
  party: string;
  memo: string;
  amt: number;
}
/** 앱 DB biz_os_payload(사업자, 달) 의 답 */
export interface BizOsPayload {
  ok: boolean;
  live?: boolean;
  branch?: string | null;
  month?: string;
  n?: number;
  cats?: BizOsCat[];
  pay?: BizOsPay[];
  mv?: BizOsMove[];
}
export interface OsRule {
  keyword: string;
  kind: string;
  label: string;
  sort_order?: number | null;
}
export type OsGroup = "고정" | "인건비" | "유동";
export interface OsItem {
  group: OsGroup;
  label: string;
  amount: number;
}
export interface OsMonth {
  rent: number;
  labor: number;
  fixed: number;
  variable: number;
  excluded: number;
  items: OsItem[];
}

/** 고정비 항목 (임대료는 rent 칸 따로) — 나머지 비용 항목은 모두 유동 */
export const FIXED_CATS: ReadonlySet<string> = new Set(["butil", "bfee", "bins", "insure", "bclean", "house", "phone"]);
export const RENT_CAT = "brent";
export const PAY_CAT = "bpay";
/** 급여를 사람별이 아니라 달 합계로만 적은 줄(옛 달) */
export const PAY_SUMMARY_WHO = "월 합계";
export const PAY_SUMMARY_LABEL = "급여(월 합계)";
export const PAY_DEFAULT_LABEL = "코치 급여";
export const EXCLUDE_DEFAULT_LABEL = "개인 사용";
export const EXCLUDE_PREFIX = "제외: ";
/** 153OS 표 이름 칸 길이(PUT /pl 검사와 같게) */
const LABEL_MAX = 40;

const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};
const clip = (s: string): string => s.slice(0, LABEL_MAX);

/**
 * 글에 들어 있는 규칙 고르기 — 이 kind 의 규칙 가운데 키워드가 글에 있는 것: sort_order 작은 것 → 키워드 긴 것 → 가나다.
 * 대소문자 · 띄어쓰기는 그대로 본다(153OS 규칙 화면과 같은 글자).
 */
export function pickRule(text: string, rules: readonly OsRule[], kind: string): OsRule | null {
  const t = String(text ?? "");
  if (!t) return null;
  let best: OsRule | null = null;
  for (const r of rules) {
    if (r.kind !== kind) continue;
    const k = String(r.keyword ?? "").trim();
    if (!k || !t.includes(k) || !String(r.label ?? "").trim()) continue;
    if (!best) {
      best = r;
      continue;
    }
    const so = r.sort_order ?? 100;
    const bo = best.sort_order ?? 100;
    const bk = String(best.keyword).trim();
    if (so < bo || (so === bo && (k.length > bk.length || (k.length === bk.length && k < bk)))) best = r;
  }
  return best;
}

/** 급여 줄 이름 — 달 합계 줄 · 이름 없는 줄은 '급여(월 합계)', 규칙에 있으면 그 이름, 없으면 '코치 급여' */
export function payLabel(who: string, rules: readonly OsRule[]): string {
  const w = String(who ?? "").trim();
  if (!w || w === PAY_SUMMARY_WHO) return PAY_SUMMARY_LABEL;
  return clip(pickRule(w, rules, "labor")?.label.trim() ?? PAY_DEFAULT_LABEL);
}

/** 규칙이 없을 때 — 회사(주식회사 · (주) · ㈜)로 보낸 이체(카드 결제 말고)는 '법인 이체' */
export const CORP_LABEL = "법인 이체";
const CORP_PARTY = /주식회사|\(주\)|㈜/;
const CARD_MEMO = /카드/;

/** 뺀 돈 줄 이름 — 상대 이름 + 적요로 exclude 규칙 → 회사로 보낸 이체 → 나머지 '개인 사용' */
export function excludeLabel(party: string, memo: string, rules: readonly OsRule[]): string {
  const p = String(party ?? "").trim();
  const m = String(memo ?? "").trim();
  const rule = pickRule(`${p} ${m}`.trim(), rules, "exclude")?.label.trim();
  const label = rule ?? (CORP_PARTY.test(p) && !CARD_MEMO.test(m) ? CORP_LABEL : EXCLUDE_DEFAULT_LABEL);
  return clip(EXCLUDE_PREFIX + label);
}

function addTo(map: Map<string, number>, key: string, amt: number) {
  map.set(key, (map.get(key) ?? 0) + amt);
}

const byAmount = (a: OsItem, b: OsItem) => b.amount - a.amount || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);

/** 가계부 한 달 → 153OS 한 달 */
export function buildOsMonth(p: BizOsPayload, rules: readonly OsRule[]): OsMonth {
  const cost: OsItem[] = [];
  let rent = 0;
  let fixed = 0;
  let variable = 0;
  for (const c of p.cats ?? []) {
    const amt = int(c.amt);
    if (!amt || c.cat === PAY_CAT) continue;
    const label = clip(String(c.label ?? "").trim() || "기타");
    if (c.cat === RENT_CAT) {
      rent += amt;
      cost.push({ group: "고정", label, amount: amt });
    } else if (FIXED_CATS.has(c.cat)) {
      fixed += amt;
      cost.push({ group: "고정", label, amount: amt });
    } else {
      variable += amt;
      cost.push({ group: "유동", label, amount: amt });
    }
  }

  const pay = new Map<string, number>();
  for (const r of p.pay ?? []) {
    const amt = int(r.amt);
    if (amt) addTo(pay, payLabel(r.who, rules), amt);
  }
  let labor = 0;
  for (const [label, amount] of pay) {
    if (!amount) continue;
    labor += amount;
    cost.push({ group: "인건비", label, amount });
  }

  const ex = new Map<string, number>();
  for (const m of p.mv ?? []) {
    const amt = int(m.amt);
    if (amt) addTo(ex, excludeLabel(m.party, m.memo, rules), amt);
  }
  let excluded = 0;
  const exItems: OsItem[] = [];
  for (const [label, amount] of ex) {
    if (!amount) continue;
    excluded += amount;
    exItems.push({ group: "유동", label, amount });
  }

  // 같은 묶음 · 같은 이름은 한 줄로(이름이 40자에서 잘려 겹칠 때)
  const merged = new Map<string, OsItem>();
  for (const it of cost) {
    const k = `${it.group}\u0001${it.label}`;
    const prev = merged.get(k);
    if (prev) prev.amount += it.amount;
    else merged.set(k, { ...it });
  }
  const items = [...merged.values()].filter((i) => i.amount !== 0).sort(byAmount);
  exItems.sort(byAmount);
  return { rent, labor, fixed, variable, excluded, items: [...items, ...exItems] };
}

/** 가계부 쪽에 이 달 줄이 하나도 없나(지출 · 돌려받음 · 이동 모두 0) */
export const isEmptyMonth = (p: BizOsPayload): boolean =>
  (p.cats ?? []).every((c) => !int(c.amt)) && (p.pay ?? []).every((r) => !int(r.amt)) && (p.mv ?? []).every((m) => !int(m.amt));

/** 153OS 에 이미 있는 줄과 숫자 · 줄이 같나(같으면 다시 쓰지 않는다 — 고친 시각 · 기록을 아낀다) */
export function sameMonth(
  a: OsMonth,
  b: { rent?: unknown; labor?: unknown; fixed?: unknown; variable?: unknown; excluded?: unknown; items?: unknown } | null | undefined,
): boolean {
  if (!b) return false;
  if (int(b.rent) !== a.rent || int(b.labor) !== a.labor || int(b.fixed) !== a.fixed) return false;
  if (int(b.variable) !== a.variable || int(b.excluded) !== a.excluded) return false;
  const norm = (list: unknown): string =>
    (Array.isArray(list) ? list : [])
      .map((i) => `${String((i as OsItem)?.group ?? "")}\u0001${String((i as OsItem)?.label ?? "")}\u0001${int((i as OsItem)?.amount)}`)
      .sort()
      .join("\u0002");
  return norm(a.items) === norm(b.items);
}

/** 이 프로그램이 쓴 줄인지(메모 머리말) — 가계부에서 달을 통째로 지웠을 때 우리 줄만 지운다 */
export const LEDGER_MEMO_HEAD = "마이복서153 사업자 가계부";
export const isLedgerMemo = (memo: unknown): boolean => String(memo ?? "").startsWith(LEDGER_MEMO_HEAD);

/** 153OS 표 메모 — 머리말 + 맞춘 시각(한국) + 기준 */
export function ledgerMemo(now: Date): string {
  const k = new Date(now.getTime() + 9 * 3_600_000).toISOString();
  return `${LEDGER_MEMO_HEAD} 기준(자동 맞춤 ${k.slice(0, 10)} ${k.slice(11, 16)}) · 급여는 일한 달(1~15일에 보낸 급여 = 지난달) · 개인 사용 · 내 통장 이동은 제외`;
}

/** 'YYYY-MM' 또는 'YYYY-MM-DD' → 'YYYY-MM-01' */
export const monthStart = (m: string): string => `${String(m).slice(0, 7)}-01`;
