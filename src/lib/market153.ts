/**
 * 🛍 153 마켓 1단계 — 화면 계산 · 글 한 곳 (2026-11-17 대표님 「앱에 마켓 기능도 넣어서 인터넷 최저가 보다 저렴하게」 ·
 *   「골든 챔스라는 사이트에서 파는 물품을 관장님도매가로 사서 드릴거야」)
 *
 *   흐름: 앱에서 주문 → 체육관 데스크에서 결제(카드 · 계좌이체) → 결제한 주문만 발주 → 도착 알림 → 체육관에서 받기.
 *   서버: supabase/migrations/20261117013411_market153.sql (표는 함수로만 · 도매가는 대표님 · 관리자에게만 보낸다)
 *   읽고 쓰기: src/services/marketService.ts · 예시: src/lib/marketSample.ts
 *
 *   가격 비교는 정직하게 —
 *     · 「인터넷 최저가」(배송비 포함)와 「공식몰 판매가」는 확인한 날과 함께 보여 주고, 확인한 지 staleDays(14일)가 지나면 숨긴다.
 *     · 인터넷 최저가가 회원가보다 높지 않으면 어떤 비교도 보여 주지 않는다(운영진 화면에는 「가격 확인」으로 뜬다).
 */

// ── 타입 ────────────────────────────────────────────────────

export type MarketCategory = "glove" | "wrap" | "guard" | "shoes" | "training" | "wear" | "etc";

/** 분류 — 순서 = 화면 칩 순서. icon = 153 입체 아이콘 이름(lib/emoji3d icon3dSrc) — 상품 그림이 없을 때 */
export const MARKET_CATEGORIES: readonly { key: MarketCategory; label: string; icon: string }[] = [
  { key: "glove", label: "글러브", icon: "glove_mint" },
  { key: "wrap", label: "핸드랩", icon: "handwrap" },
  { key: "guard", label: "보호구", icon: "headgear" },
  { key: "shoes", label: "복싱화", icon: "sneaker" },
  { key: "training", label: "훈련용품", icon: "mitt" },
  { key: "wear", label: "의류", icon: "tshirt" },
  { key: "etc", label: "그 밖", icon: "box" },
];

const CATEGORY_KEYS = new Set<string>(MARKET_CATEGORIES.map((c) => c.key));
export const categoryMeta = (key: MarketCategory) => MARKET_CATEGORIES.find((c) => c.key === key) ?? MARKET_CATEGORIES[6];

export type MarketOrderStatus = "applied" | "paid" | "ordered" | "arrived" | "delivered" | "canceled";
const STATUS_KEYS = new Set<string>(["applied", "paid", "ordered", "arrived", "delivered", "canceled"]);

export interface MarketProduct {
  id: string;
  category: MarketCategory;
  brand: string | null;
  name: string;
  model: string | null;
  summary: string | null;
  /** /market/….webp — public 폴더 그림. 없으면 분류 아이콘 */
  image: string | null;
  options: string[];
  optionLabel: string | null;
  /** 회원가 */
  price: number;
  /** 공식몰 판매가 · 확인한 날 */
  listPrice: number | null;
  listOn: string | null;
  /** 인터넷 최저가(배송비 포함) · 어디서 · 확인한 날 */
  comparePrice: number | null;
  compareSource: string | null;
  compareOn: string | null;
  maxQty: number;
  leadNote: string | null;
  soldOut: boolean;
  // ── 운영진에게만 온다 ──
  active?: boolean;
  sort?: number;
  supplier?: string | null;
  supplierRef?: string | null;
  branches?: string[] | null;
  updatedAt?: string | null;
  // ── 대표님 · 관리자에게만 온다 ──
  cost?: number | null;
}

export interface MarketOrder {
  id: string;
  orderNo: string;
  productId: string | null;
  productName: string;
  option: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
  /** 결제 확인 때 쓴 153 마일리지(점 · 1점 = 1원) — 데스크에서 받을 돈 = amount − mileageUsed */
  mileageUsed?: number;
  status: MarketOrderStatus;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  orderedAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  // ── 운영진에게만 온다 ──
  memberName?: string;
  branch?: string;
  staffMemo?: string | null;
}

export interface MarketSeller {
  name: string | null;
  owner: string | null;
  bizNo: string | null;
  address: string | null;
  tel: string | null;
  mailOrderNo: string | null;
}

export interface MarketHome {
  on: boolean;
  branch: string | null;
  /** 코치님 · 지점장 · 운영진 — 주문함으로 가는 줄을 보여 준다 */
  staff: boolean;
  /** 대표님 · 관리자가 다른 지점 화면을 미리 보는 중 — 주문은 못 한다 */
  preview: boolean;
  today: string;
  staleDays: number;
  maxOpen: number;
  seller: MarketSeller | null;
  products: MarketProduct[];
  orders: MarketOrder[];
}

export interface MarketWish {
  id: string;
  body: string;
  memberName: string;
  branch: string;
  createdAt: string;
}

export interface MarketBoard {
  on: boolean;
  scope: "all" | "branch";
  branch: string | null;
  /** 켠 지점들 — 대표님 지점 고르기 */
  branches: string[];
  /** 도매가를 보고 상품을 고치는 분(대표님 · 관리자) */
  boss: boolean;
  today: string;
  staleDays: number;
  orders: MarketOrder[];
  products: MarketProduct[];
  wishes: MarketWish[];
}

// ── 날짜 · 금액 ─────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;

/** 한국 날짜(YYYY-MM-DD) — 서버가 today 를 안 보냈을 때만 */
export const todayKst = (now: number = Date.now()): string => new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);

/** from 에서 to 까지 며칠 (같은 날 0) */
export const daysBetween = (from: string, to: string): number => Math.round(dayNum(to) - dayNum(from));

/** 11/17 */
export const mdLabel = (d: string): string => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

/** 시각(ISO) → 한국 날짜 11/17 */
export const mdOfTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? mdLabel(todayKst(t)) : "";
};

export const won = (n: number): string => `${Math.round(n).toLocaleString("ko-KR")}원`;

/**
 * 153마켓 용품 마일리지 할인 — 주문 금액의 5%까지 · 1,000점 단위 (2026-11-23 대표님 「153마켓 용품은 5%까지만 · 체육관 도매가에 드리고 있어서」)
 *   수강료 · 운동복 · 락카는 그대로 10%. 서버 market_admin_order_set · admin_use_mileage(p_kind 'market') 가 다시 검사한다(보유 점수도).
 */
export const MARKET_MILEAGE_PCT = 5;
export const marketMileageMax = (amount: number): number =>
  Math.max(0, Math.floor(Math.max(0, Math.round(amount)) / (1000 * (100 / MARKET_MILEAGE_PCT))) * 1000);

// ── 서버 값 읽기 (믿지 않고 다듬는다) ────────────────────────

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => (typeof v === "string" && DAY_RE.test(v) ? v : null);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];

export function normalizeProduct(raw: unknown): MarketProduct | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  const price = num(raw.price);
  if (!id || !name || price == null || price <= 0) return null;
  const category = (typeof raw.category === "string" && CATEGORY_KEYS.has(raw.category) ? raw.category : "etc") as MarketCategory;
  const image = str(raw.image);
  const p: MarketProduct = {
    id,
    category,
    brand: str(raw.brand),
    name,
    model: str(raw.model),
    summary: str(raw.summary),
    image: image && /^\/market\/[a-z0-9/_-]+\.(webp|jpg|png)$/.test(image) ? image : null,
    options: strList(raw.options),
    optionLabel: str(raw.option_label),
    price,
    listPrice: num(raw.list_price),
    listOn: day(raw.list_on),
    comparePrice: num(raw.compare_price),
    compareSource: str(raw.compare_source),
    compareOn: day(raw.compare_on),
    maxQty: Math.min(20, Math.max(1, Math.round(num(raw.max_qty) ?? 2))),
    leadNote: str(raw.lead_note),
    soldOut: raw.sold_out === true,
  };
  if ("active" in raw) {
    p.active = raw.active === true;
    p.sort = num(raw.sort) ?? 100;
    p.supplier = str(raw.supplier);
    p.supplierRef = str(raw.supplier_ref);
    p.branches = Array.isArray(raw.branches) ? strList(raw.branches) : null;
    p.updatedAt = str(raw.updated_at);
  }
  if ("cost" in raw) p.cost = num(raw.cost);
  return p;
}

export function normalizeOrder(raw: unknown): MarketOrder | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const status = typeof raw.status === "string" && STATUS_KEYS.has(raw.status) ? (raw.status as MarketOrderStatus) : null;
  const productName = str(raw.product_name);
  if (!id || !status || !productName) return null;
  const qty = Math.max(1, Math.round(num(raw.qty) ?? 1));
  const unitPrice = num(raw.unit_price) ?? 0;
  const o: MarketOrder = {
    id,
    orderNo: str(raw.order_no) ?? "",
    productId: str(raw.product_id),
    productName,
    option: str(raw.option),
    qty,
    unitPrice,
    amount: num(raw.amount) ?? unitPrice * qty,
    mileageUsed: Math.max(0, num(raw.mileage_used) ?? 0),
    status,
    note: str(raw.note),
    createdAt: str(raw.created_at) ?? "",
    paidAt: str(raw.paid_at),
    orderedAt: str(raw.ordered_at),
    arrivedAt: str(raw.arrived_at),
    deliveredAt: str(raw.delivered_at),
    canceledAt: str(raw.canceled_at),
    cancelReason: str(raw.cancel_reason),
  };
  if ("member_name" in raw) {
    o.memberName = str(raw.member_name) ?? "회원";
    o.branch = str(raw.branch) ?? "";
    o.staffMemo = str(raw.staff_memo);
  }
  return o;
}

const normalizeSeller = (raw: unknown): MarketSeller | null => {
  if (!isObj(raw)) return null;
  const s: MarketSeller = {
    name: str(raw.name),
    owner: str(raw.owner),
    bizNo: str(raw.biz_no),
    address: str(raw.address),
    tel: str(raw.tel),
    mailOrderNo: str(raw.mail_order_no),
  };
  return Object.values(s).some(Boolean) ? s : null;
};

const list = <T>(v: unknown, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null) : [];

export const MARKET_HOME_OFF: MarketHome = {
  on: false,
  branch: null,
  staff: false,
  preview: false,
  today: "",
  staleDays: 14,
  maxOpen: 10,
  seller: null,
  products: [],
  orders: [],
};

export function normalizeMarketHome(raw: unknown): MarketHome {
  if (!isObj(raw) || raw.on !== true) return { ...MARKET_HOME_OFF, today: todayKst() };
  return {
    on: true,
    branch: str(raw.branch),
    staff: raw.staff === true,
    preview: raw.preview === true,
    today: day(raw.today) ?? todayKst(),
    staleDays: Math.max(1, Math.round(num(raw.stale_days) ?? 14)),
    maxOpen: Math.max(1, Math.round(num(raw.max_open) ?? 10)),
    seller: normalizeSeller(raw.seller),
    products: list(raw.products, normalizeProduct),
    orders: list(raw.orders, normalizeOrder),
  };
}

export const MARKET_BOARD_OFF: MarketBoard = {
  on: false,
  scope: "branch",
  branch: null,
  branches: [],
  boss: false,
  today: "",
  staleDays: 14,
  orders: [],
  products: [],
  wishes: [],
};

export function normalizeMarketBoard(raw: unknown): MarketBoard {
  if (!isObj(raw) || raw.on !== true) return { ...MARKET_BOARD_OFF, today: todayKst() };
  return {
    on: true,
    scope: raw.scope === "all" ? "all" : "branch",
    branch: str(raw.branch),
    branches: strList(raw.branches),
    boss: raw.boss === true,
    today: day(raw.today) ?? todayKst(),
    staleDays: Math.max(1, Math.round(num(raw.stale_days) ?? 14)),
    orders: list(raw.orders, normalizeOrder),
    products: list(raw.products, normalizeProduct),
    wishes: list(raw.wishes, (w) => {
      if (!isObj(w)) return null;
      const id = str(w.id);
      const body = str(w.body);
      return id && body
        ? { id, body, memberName: str(w.member_name) ?? "회원", branch: str(w.branch) ?? "", createdAt: str(w.created_at) ?? "" }
        : null;
    }),
  };
}

// ── 상품 글 ─────────────────────────────────────────────────

/** 아디다스 스피드 틸트 150 글러브 */
export const productTitle = (p: Pick<MarketProduct, "brand" | "name">): string => (p.brand ? `${p.brand} ${p.name}` : p.name);

/** 화면에 있는 분류만, 정해 둔 순서로 */
export const categoriesOf = (products: readonly MarketProduct[]) =>
  MARKET_CATEGORIES.filter((c) => products.some((p) => p.category === c.key));

// ── 가격 비교 ───────────────────────────────────────────────

export interface PriceCompare {
  /** lowest: 인터넷 최저가(배송비 포함) · list: 공식몰 판매가 */
  kind: "lowest" | "list";
  price: number;
  saving: number;
  percent: number;
  source: string;
  on: string;
}

/** 확인한 날이 오늘까지 staleDays 안인가 (앞날 날짜는 믿지 않는다) */
export const isFreshDay = (on: string | null, today: string, staleDays: number): on is string => {
  if (!on || !DAY_RE.test(on) || !DAY_RE.test(today)) return false;
  const d = daysBetween(on, today);
  return d >= 0 && d <= staleDays;
};

/**
 * 회원에게 보여 줄 가격 비교 — 없으면 null(회원가만 보인다).
 *   ① 인터넷 최저가를 최근에 확인했고 회원가보다 높으면 그것
 *   ② 인터넷 최저가를 최근에 확인했는데 회원가보다 높지 않으면 아무 비교도 안 보여 준다 (더 싼 곳이 있는데 「저렴」이라고 하지 않는다)
 *   ③ 인터넷 최저가가 없거나 오래됐으면 공식몰 판매가(최근 확인 · 회원가보다 높을 때)
 */
export function compareOf(
  p: Pick<MarketProduct, "price" | "listPrice" | "listOn" | "comparePrice" | "compareSource" | "compareOn">,
  today: string,
  staleDays: number,
): PriceCompare | null {
  if (p.comparePrice != null && isFreshDay(p.compareOn, today, staleDays)) {
    if (p.comparePrice <= p.price) return null;
    const saving = p.comparePrice - p.price;
    return {
      kind: "lowest",
      price: p.comparePrice,
      saving,
      percent: Math.floor((saving / p.comparePrice) * 100),
      source: p.compareSource ?? "인터넷 검색",
      on: p.compareOn,
    };
  }
  if (p.listPrice != null && isFreshDay(p.listOn, today, staleDays) && p.listPrice > p.price) {
    const saving = p.listPrice - p.price;
    return { kind: "list", price: p.listPrice, saving, percent: Math.floor((saving / p.listPrice) * 100), source: "공식몰", on: p.listOn };
  }
  return null;
}

/** 타일 한 줄 — 최저가보다 10,000원 저렴 */
export const compareShortParts = (c: PriceCompare): [string, string] => [
  `${c.kind === "lowest" ? "최저가" : "공식몰"}보다`,
  `${won(c.saving)} 저렴`,
];
export const compareShort = (c: PriceCompare): string => compareShortParts(c).join(" ");

/** 상품 창 — 인터넷 최저가 99,000원 */
export const compareLong = (c: PriceCompare): string =>
  `${c.kind === "lowest" ? "인터넷 최저가" : "공식몰 판매가"} ${won(c.price)}`;

/** 근거 한 줄 — 네이버 쇼핑 · 11/17 확인 · 배송비 포함 */
export const compareEvidence = (c: PriceCompare): string =>
  c.kind === "lowest" ? `${c.source} · ${mdLabel(c.on)} 확인 · 배송비 포함` : `${mdLabel(c.on)} 확인`;

// ── 운영진: 가격 점검 ───────────────────────────────────────

/** 회원가 원칙 (2026-11-17 22시 대표님 「인터넷 최저가보다 최대 15% 낮게 팔자」) — 최저가에서 이만큼까지만 낮춘다 */
export const MAX_OFF_LOWEST_PCT = 15;

/** 인터넷 최저가에서 pct% 낮춘 회원가 — 100원 단위로 올림(그래서 낮추는 폭은 pct% 를 넘지 않는다) */
export const priceFromLowest = (lowest: number, pct: number = MAX_OFF_LOWEST_PCT): number =>
  Math.ceil((lowest * (100 - pct)) / 10_000) * 100;

/** 남는 돈 바닥 (2026-11-18 대표님 「남는 돈이 있으면 모두 올려」) — 최저가 −15%가 도매가에 너무 붙으면
 *  도매가 +3%(최소 1,000원)에서 멈춘다. 카드 수수료를 내고도 남게. */
export const MIN_MARGIN_PCT = 3;
export const MIN_MARGIN_WON = 1_000;
/** 그렇게 정한 회원가가 최저가보다 이만큼(%) 넘게 싸야 「최저가보다 저렴」으로 올린다 — 값이 조금만 움직여도 거짓말이 되지 않게 */
export const MIN_SAVE_PCT = 1;

/** 도매가 바닥 — 도매가 +3% 와 +1,000원 중 큰 쪽, 100원 단위 올림 (정수 셈 — 소수 오차 없이) */
export const marginFloor = (cost: number): number =>
  Math.ceil(Math.max(cost * (100 + MIN_MARGIN_PCT), (cost + MIN_MARGIN_WON) * 100) / 10_000) * 100;

/** 원칙대로 정한 회원가 — 최저가 −15%, 도매가를 알면 바닥 아래로는 안 내림.
 *  ok=false 면 최저가보다 1% 넘게 싸게 못 판다(올리지 않는 게 원칙) */
export function rulePriceOf(lowest: number, cost: number | null): { price: number; byFloor: boolean; ok: boolean } {
  const off = priceFromLowest(lowest);
  const floor = cost != null && cost > 0 ? marginFloor(cost) : 0;
  const price = Math.max(off, floor);
  return { price, byFloor: floor > off, ok: price * 100 <= lowest * (100 - MIN_SAVE_PCT) };
}

export interface PriceFlag {
  key: "not_lower" | "stale" | "no_compare" | "below_cost" | "no_cost" | "too_low";
  text: string;
  /** warn: 회원에게 한 약속(최저가보다 저렴)이 흔들리는 것 · info: 채우면 좋은 것 */
  tone: "warn" | "info";
}

/** 운영진 상품 줄에 붙는 점검 — boss 면 도매가 점검까지 */
export function priceFlags(p: MarketProduct, today: string, staleDays: number, boss: boolean): PriceFlag[] {
  const out: PriceFlag[] = [];
  if (p.comparePrice == null) {
    out.push({ key: "no_compare", text: "인터넷 최저가를 아직 안 넣었어요", tone: "info" });
  } else if (!isFreshDay(p.compareOn, today, staleDays)) {
    const d = p.compareOn && DAY_RE.test(p.compareOn) ? daysBetween(p.compareOn, today) : null;
    out.push({
      key: "stale",
      text: d != null && d > 0 ? `최저가 확인한 지 ${d}일 — 다시 확인해 주세요` : "최저가 확인한 날을 다시 넣어 주세요",
      tone: "warn",
    });
  } else if (p.comparePrice <= p.price) {
    out.push({ key: "not_lower", text: `인터넷 최저가(${won(p.comparePrice)})보다 싸지 않아요`, tone: "warn" });
  }
  if (boss) {
    if (p.cost == null) out.push({ key: "no_cost", text: "도매가를 아직 안 넣었어요", tone: "info" });
    else if (p.price < p.cost) out.push({ key: "below_cost", text: "회원가가 도매가보다 낮아요", tone: "warn" });
    // 회원가 원칙(최저가 −15%까지)보다 더 낮으면 알려만 준다 — 회원에게 한 약속은 그대로라 info
    if (p.comparePrice != null && isFreshDay(p.compareOn, today, staleDays) && p.comparePrice > p.price) {
      const floor = priceFromLowest(p.comparePrice);
      if (p.price < floor) {
        out.push({ key: "too_low", text: `최저가보다 ${MAX_OFF_LOWEST_PCT}% 넘게 싸요 — 원칙대로면 ${won(floor)}`, tone: "info" });
      }
    }
  }
  return out;
}

/** 대표님 · 관리자: 한 개 팔 때 남는 돈 · 도매가에 몇 % 얹은 셈인가 (도매가를 모르면 null) */
export const marginOf = (p: Pick<MarketProduct, "price" | "cost">): { amount: number; percent: number } | null =>
  p.cost == null ? null : { amount: p.price - p.cost, percent: p.cost > 0 ? Math.round(((p.price - p.cost) / p.cost) * 100) : 0 };

/** 한 개에 5,000원 남아요 (도매가 +10%) · 모자라면 「2,000원 모자라요」 */
export const marginText = (m: { amount: number; percent: number }): string =>
  m.amount < 0 ? `${won(-m.amount)} 모자라요` : `${won(m.amount)} 남아요${m.amount > 0 ? ` (도매가 +${m.percent}%)` : ""}`;

// ── 주문 ────────────────────────────────────────────────────

export const OPEN_STATUSES: readonly MarketOrderStatus[] = ["applied", "paid", "ordered", "arrived"];
export const isOpenOrder = (o: Pick<MarketOrder, "status">): boolean => OPEN_STATUSES.includes(o.status);

/** 아디다스 스피드 틸트 150 글러브 · 12oz × 2 */
export const orderTitle = (o: Pick<MarketOrder, "productName" | "option" | "qty">): string =>
  `${o.productName}${o.option ? ` · ${o.option}` : ""}${o.qty > 1 ? ` × ${o.qty}` : ""}`;

export const ORDER_STATUS_LABEL: Record<MarketOrderStatus, string> = {
  applied: "결제 전",
  paid: "결제 완료",
  ordered: "주문 넣음",
  arrived: "도착",
  delivered: "받음",
  canceled: "취소",
};

/** 회원 진행 줄 네 칸 */
export const MEMBER_STEPS = ["주문", "결제", "도착", "받음"] as const;

/** 지금 몇 번째 칸까지 왔나 (0~3) — 취소는 -1 */
export const orderStepIndex = (status: MarketOrderStatus): number =>
  status === "applied" ? 0 : status === "paid" || status === "ordered" ? 1 : status === "arrived" ? 2 : status === "delivered" ? 3 : -1;

/** 회원에게 보이는 한 줄 — 다음에 할 일 하나 */
export function orderMemberLine(o: MarketOrder): string {
  switch (o.status) {
    case "applied":
      return `데스크에서 결제해 주세요 · ${won(o.amount)}`;
    case "paid":
      return "결제 확인 · 주문을 넣을게요";
    case "ordered":
      return "주문을 넣었어요 · 도착하면 알려 드려요";
    case "arrived":
      return "도착했어요 · 데스크에서 받아 가세요";
    case "delivered":
      return o.deliveredAt ? `${mdOfTime(o.deliveredAt)} 받았어요` : "받았어요";
    case "canceled":
      if (o.cancelReason === "회원 취소") return "취소했어요";
      return o.cancelReason ? `취소됐어요 · ${o.cancelReason}` : "취소됐어요";
  }
}

const HEADLINE_RANK: Record<MarketOrderStatus, number> = { arrived: 0, applied: 1, paid: 2, ordered: 3, delivered: 9, canceled: 9 };

/** 맨 위에 보여 줄 진행 중 주문 하나 — 받아 갈 것 → 결제할 것 → 기다리는 것 */
export function headlineOrder(orders: readonly MarketOrder[]): MarketOrder | null {
  const open = orders.filter(isOpenOrder);
  if (!open.length) return null;
  return [...open].sort((a, b) => HEADLINE_RANK[a.status] - HEADLINE_RANK[b.status] || b.createdAt.localeCompare(a.createdAt))[0];
}

export const NOTE_MAX = 100;
export const WISH_MAX = 200;

/** 앞뒤 빈칸을 떼고 이어진 빈칸은 하나로 (서버와 같은 다듬기) */
export const cleanText = (s: string): string => (s ?? "").replace(/\s+/g, " ").trim();

/** 주문 넣기 전 검사 — 서버 market_order_place 와 같은 말 */
export function placeError(
  p: Pick<MarketProduct, "options" | "optionLabel" | "maxQty" | "soldOut">,
  option: string | null,
  qty: number,
  note: string,
): string | null {
  if (p.soldOut) return "지금은 품절이에요";
  if (p.options.length > 0 && (!option || !p.options.includes(option))) return `${p.optionLabel ?? "옵션"}을(를) 골라 주세요`;
  if (!Number.isInteger(qty) || qty < 1 || qty > p.maxQty) return `한 번에 ${p.maxQty}개까지 주문할 수 있어요`;
  if (cleanText(note).length > NOTE_MAX) return `메모는 ${NOTE_MAX}자까지 쓸 수 있어요`;
  return null;
}

/** 「이 용품도 넣어 주세요」 검사 — 서버 market_wish_add 와 같은 말 */
export function wishError(text: string): string | null {
  const t = cleanText(text);
  if ([...t].length < 2) return "찾는 용품을 적어 주세요";
  if ([...t].length > WISH_MAX) return `${WISH_MAX}자까지 쓸 수 있어요`;
  return null;
}

export const WISH_EXAMPLES = ["16온스 스파링 글러브", "아이 글러브 6온스", "복싱화 250", "줄넘기", "마우스피스"] as const;

/** 판매자 정보 줄 — 설정에 넣은 칸만 */
export function sellerLines(s: MarketSeller | null): string[] {
  if (!s) return [];
  return [
    s.name ? `상호 ${s.name}` : null,
    s.owner ? `대표 ${s.owner}` : null,
    s.bizNo ? `사업자등록번호 ${s.bizNo}` : null,
    s.mailOrderNo ? `통신판매업 신고 ${s.mailOrderNo}` : null,
    s.address ? `주소 ${s.address}` : null,
    s.tel ? `전화 ${s.tel}` : null,
  ].filter((x): x is string => !!x);
}

/**
 * 어디서 사 오나 — 마켓 맨 위 한 줄 · 상품 창 가격 아래 한 줄 · 판매 안내 첫 칸 (2026-11-18 대표님 「골든챔스에서 체육관 도매가로 구매해 싸게 판매하는 거라고 설명하자」).
 * 공급처가 골든챔스 하나일 때의 글이다 — 다른 공급처 상품을 넣으면 이 글과 회원 화면 값(공급처)을 같이 바꾼다. 오삼 FAQ mb-market 도 같은 말.
 */
export const MARKET_SOURCE = {
  line: "골든챔스에서 체육관 도매가로 사 와요",
  sub: "그래서 싸게 드릴 수 있어요",
} as const;

/** 판매 안내(접힌 칸) — 어디서 사 오나 · 결제 · 받기 · 취소 · 교환/환불 · 가격 비교 기준. 운영 방식이 바뀌면 이 글도 같이 */
export const marketGuide = (staleDays: number): { title: string; body: string }[] => [
  {
    title: "어디서 사 오나요?",
    body: "153이 복싱 · 격투기 용품 쇼핑몰 골든챔스에서 체육관 도매가로 사 와요. 그래서 싸게 드릴 수 있어요. 골든챔스에서 파는 것과 같은 새 상품이에요.",
  },
  { title: "결제", body: "체육관 데스크에서 카드나 계좌이체로 결제해요. 153 마일리지는 주문 금액의 5%까지 할인으로 쓸 수 있어요. 결제가 확인된 것만 골든챔스에 주문해요." },
  { title: "받기", body: "도착하면 앱 알림으로 알려 드려요. 체육관 데스크에서 받아 가세요. 택배로 보내 드리지는 않아요." },
  { title: "취소", body: "결제 전에는 「내 주문」에서 바로 취소할 수 있어요. 결제한 뒤에는 데스크에 말씀해 주세요." },
  { title: "교환 · 환불", body: "받은 날부터 7일 안에 데스크에 말씀해 주세요. 쓰거나 훼손된 상품은 교환 · 환불이 어려울 수 있어요." },
  {
    title: "가격 비교",
    body: `「최저가보다 저렴」은 같은 모델을 인터넷에서 찾은 가장 낮은 값(배송비 포함)과 견준 거예요. 확인한 날을 함께 적고, 확인한 지 ${staleDays}일이 지나면 표시를 내려요. 「공식몰보다 저렴」은 브랜드 공식몰 판매가와 견준 거예요.`,
  },
];

// ── 운영진: 주문함 ──────────────────────────────────────────

export interface StaffAction {
  to: MarketOrderStatus;
  label: string;
  /** primary: 다음 단계 · back: 잘못 눌렀을 때 한 칸 뒤로 · cancel: 취소(결제 뒤면 환불 · 반품) */
  kind: "primary" | "back" | "cancel";
}

/** 지금 상태에서 누를 수 있는 것 — 서버 market_admin_order_set 의 허용 변화와 같다 */
export function staffActions(status: MarketOrderStatus): StaffAction[] {
  switch (status) {
    case "applied":
      return [
        { to: "paid", label: "결제 확인", kind: "primary" },
        { to: "canceled", label: "취소", kind: "cancel" },
      ];
    case "paid":
      return [
        { to: "ordered", label: "발주했어요", kind: "primary" },
        { to: "applied", label: "결제 전으로", kind: "back" },
        { to: "canceled", label: "취소 · 환불", kind: "cancel" },
      ];
    case "ordered":
      return [
        { to: "arrived", label: "도착했어요", kind: "primary" },
        { to: "paid", label: "발주 전으로", kind: "back" },
        { to: "canceled", label: "취소 · 환불", kind: "cancel" },
      ];
    case "arrived":
      return [
        { to: "delivered", label: "전달했어요", kind: "primary" },
        { to: "ordered", label: "도착 전으로", kind: "back" },
        { to: "canceled", label: "취소 · 환불", kind: "cancel" },
      ];
    case "delivered":
      return [
        { to: "arrived", label: "전달 전으로", kind: "back" },
        { to: "canceled", label: "반품 · 환불", kind: "cancel" },
      ];
    case "canceled":
      return [{ to: "applied", label: "취소 되돌리기", kind: "back" }];
  }
}

export type BoardGroupKey = "applied" | "paid" | "ordered" | "arrived" | "closed";

export interface BoardGroup {
  key: BoardGroupKey;
  /** 운영진이 할 일로 읽히는 이름 */
  label: string;
  orders: MarketOrder[];
}

const GROUP_LABEL: Record<BoardGroupKey, string> = {
  arrived: "전달할 것",
  applied: "결제 기다림",
  paid: "발주할 것",
  ordered: "도착 기다림",
  closed: "끝난 주문",
};

/** 주문함 묶음 — 전달할 것 → 결제 기다림 → 발주할 것 → 도착 기다림 → 끝난 주문(받음 · 취소). 빈 묶음은 뺀다 */
export function boardGroups(orders: readonly MarketOrder[]): BoardGroup[] {
  const by = (keys: MarketOrderStatus[]) =>
    orders.filter((o) => keys.includes(o.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: BoardGroup[] = [
    { key: "arrived", label: GROUP_LABEL.arrived, orders: by(["arrived"]) },
    { key: "applied", label: GROUP_LABEL.applied, orders: by(["applied"]) },
    { key: "paid", label: GROUP_LABEL.paid, orders: by(["paid"]) },
    { key: "ordered", label: GROUP_LABEL.ordered, orders: by(["ordered"]) },
    { key: "closed", label: GROUP_LABEL.closed, orders: by(["delivered", "canceled"]) },
  ];
  return groups.filter((g) => g.orders.length > 0);
}

/** 할 일 숫자 — 전달할 것 + 결제 기다림 + 발주할 것 (도착 기다림은 기다리는 것이라 안 센다) */
export const boardTodoCount = (orders: readonly MarketOrder[]): number =>
  orders.filter((o) => o.status === "arrived" || o.status === "applied" || o.status === "paid").length;

// ── 운영진: 발주 목록 ───────────────────────────────────────

export interface PurchaseLine {
  key: string;
  productId: string | null;
  name: string;
  option: string | null;
  qty: number;
  /** 몇 건의 주문을 모은 줄인가 */
  orders: number;
  supplierRef: string | null;
  /** 도매가(대표님 · 관리자 화면에서만 값이 있다) */
  cost: number | null;
}

/** 결제 완료(아직 발주 전) 주문을 상품 · 옵션마다 모은다 — 골든챔스에 넣을 목록 */
export function purchaseList(orders: readonly MarketOrder[], products: readonly MarketProduct[]): PurchaseLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const map = new Map<string, PurchaseLine>();
  for (const o of orders) {
    if (o.status !== "paid") continue;
    const key = `${o.productId ?? o.productName}|${o.option ?? ""}`;
    const p = o.productId ? byId.get(o.productId) : undefined;
    const line = map.get(key);
    if (line) {
      line.qty += o.qty;
      line.orders += 1;
    } else {
      map.set(key, {
        key,
        productId: o.productId,
        name: o.productName,
        option: o.option,
        qty: o.qty,
        orders: 1,
        supplierRef: p?.supplierRef ?? null,
        cost: p?.cost ?? null,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko") || (a.option ?? "").localeCompare(b.option ?? "", "ko"));
}

/** 발주 합계 — 도매가를 모르는 줄이 하나라도 있으면 금액은 null */
export function purchaseTotals(lines: readonly PurchaseLine[]): { qty: number; cost: number | null } {
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const cost = lines.every((l) => l.cost != null) && lines.length > 0 ? lines.reduce((s, l) => s + (l.cost ?? 0) * l.qty, 0) : null;
  return { qty, cost };
}

/** 복사해서 보낼 발주 목록 — 금액 · 회원 이름은 넣지 않는다 */
export function purchaseText(lines: readonly PurchaseLine[], today: string): string {
  if (!lines.length) return "";
  const head = `153 마켓 발주 목록 · ${mdLabel(today)} · ${lines.reduce((s, l) => s + l.qty, 0)}개`;
  const rows = lines.map((l) => `- ${l.name}${l.option ? ` · ${l.option}` : ""} × ${l.qty}${l.supplierRef ? ` (상품 번호 ${l.supplierRef})` : ""}`);
  return [head, ...rows].join("\n");
}

// ── 대표님 · 관리자: 상품 넣기 · 고치기 ─────────────────────

export interface ProductDraft {
  id: string | null;
  category: MarketCategory;
  brand: string;
  name: string;
  model: string;
  summary: string;
  /** 쉼표 · 줄바꿈으로 나눈 옵션 글 */
  optionsText: string;
  optionLabel: string;
  price: string;
  listPrice: string;
  listOn: string;
  comparePrice: string;
  compareSource: string;
  compareOn: string;
  cost: string;
  supplierRef: string;
  maxQty: string;
  leadNote: string;
  active: boolean;
  soldOut: boolean;
  sort: string;
}

export const emptyProductDraft = (today: string): ProductDraft => ({
  id: null,
  category: "glove",
  brand: "",
  name: "",
  model: "",
  summary: "",
  optionsText: "",
  optionLabel: "",
  price: "",
  listPrice: "",
  listOn: today,
  comparePrice: "",
  compareSource: "",
  compareOn: today,
  cost: "",
  supplierRef: "",
  maxQty: "2",
  leadNote: "",
  active: false,
  soldOut: false,
  sort: "100",
});

const numText = (n: number | null | undefined): string => (n == null ? "" : String(n));

export const draftOfProduct = (p: MarketProduct, today: string): ProductDraft => ({
  id: p.id,
  category: p.category,
  brand: p.brand ?? "",
  name: p.name,
  model: p.model ?? "",
  summary: p.summary ?? "",
  optionsText: p.options.join(", "),
  optionLabel: p.optionLabel ?? "",
  price: numText(p.price),
  listPrice: numText(p.listPrice),
  listOn: p.listOn ?? today,
  comparePrice: numText(p.comparePrice),
  compareSource: p.compareSource ?? "",
  compareOn: p.compareOn ?? today,
  cost: numText(p.cost),
  supplierRef: p.supplierRef ?? "",
  maxQty: numText(p.maxQty),
  leadNote: p.leadNote ?? "",
  active: p.active === true,
  soldOut: p.soldOut,
  sort: numText(p.sort ?? 100),
});

/** "89,000" · "89000원" → 89000 · 빈칸 → null · 숫자가 아니면 NaN */
export const parseWon = (s: string): number | null => {
  const t = (s ?? "").replace(/[,\s원]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
};

/** 옵션 글 → 목록 (쉼표 · 줄바꿈 · 겹친 것 빼기) */
export const parseOptions = (s: string): string[] => {
  const out: string[] = [];
  for (const raw of (s ?? "").split(/[,\n]/)) {
    const v = raw.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
};

/** 저장 전 검사 — 걸리는 첫 번째 말 (서버 제약과 같은 범위) */
export function productDraftError(d: ProductDraft): string | null {
  const name = cleanText(d.name);
  if ([...name].length < 2) return "상품 이름을 적어 주세요";
  if ([...name].length > 80) return "상품 이름은 80자까지예요";
  const price = parseWon(d.price);
  if (price == null) return "회원가를 넣어 주세요";
  if (Number.isNaN(price) || price < 500 || price > 3_000_000) return "회원가는 500원 ~ 300만 원 사이 숫자로 넣어 주세요";
  // 서버 제약: 공식몰 판매가 · 인터넷 최저가 500원 ~ 500만 원 · 도매가 0 ~ 500만 원
  for (const [label, v, min] of [
    ["공식몰 판매가", d.listPrice, 500],
    ["인터넷 최저가", d.comparePrice, 500],
    ["도매가", d.cost, 0],
  ] as const) {
    const n = parseWon(v);
    if (n == null) continue;
    if (Number.isNaN(n)) return `${label}는 숫자로 넣어 주세요`;
    if (n < min || n > 5_000_000) return `${label}를 다시 확인해 주세요 (${min > 0 ? "500원 ~ 500만 원" : "500만 원까지"})`;
  }
  const opts = parseOptions(d.optionsText);
  if (opts.length > 40 || opts.some((o) => [...o].length > 40)) return "옵션은 40개 · 한 줄 40자까지예요";
  const maxQty = parseWon(d.maxQty);
  if (maxQty == null || Number.isNaN(maxQty) || maxQty < 1 || maxQty > 20) return "한 번에 주문할 수 있는 수는 1 ~ 20이에요";
  const compare = parseWon(d.comparePrice);
  if (compare != null && !Number.isNaN(compare) && !DAY_RE.test(d.compareOn)) return "인터넷 최저가를 확인한 날을 넣어 주세요";
  const listP = parseWon(d.listPrice);
  if (listP != null && !Number.isNaN(listP) && !DAY_RE.test(d.listOn)) return "공식몰 판매가를 확인한 날을 넣어 주세요";
  return null;
}

/** 서버 market_admin_product_save 에 보낼 값 */
export function productPayload(d: ProductDraft): Record<string, unknown> {
  const listPrice = parseWon(d.listPrice);
  const comparePrice = parseWon(d.comparePrice);
  return {
    ...(d.id ? { id: d.id } : {}),
    category: d.category,
    brand: cleanText(d.brand),
    name: cleanText(d.name),
    model: cleanText(d.model),
    summary: cleanText(d.summary),
    options: parseOptions(d.optionsText),
    option_label: cleanText(d.optionLabel),
    price: parseWon(d.price),
    list_price: listPrice,
    list_on: listPrice != null ? d.listOn : null,
    compare_price: comparePrice,
    compare_source: comparePrice != null ? cleanText(d.compareSource) : "",
    compare_on: comparePrice != null ? d.compareOn : null,
    cost: parseWon(d.cost),
    supplier_ref: cleanText(d.supplierRef),
    max_qty: parseWon(d.maxQty),
    lead_note: cleanText(d.leadNote),
    active: d.active,
    sold_out: d.soldOut,
    sort: parseWon(d.sort) ?? 100,
  };
}
