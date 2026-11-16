/**
 * 🛍 153 마켓 예시 자료 — 서버를 부르지 않는 예시 화면용 (`/market?demo=1` · 운영진 주문함 `?demo=1`)
 *
 *   · 상품 이름과 「공식몰 판매가」는 2026-11-17 에 골든챔스 공식몰(goldenchamps.co.kr) 공개 화면에서 본 값이다.
 *   · **회원가 · 인터넷 최저가 · 도매가는 지어낸 숫자**다(실제 도매가 아님 — 실제 값은 DB 에만 둔다). 화면에 「예시」라고 띄운다.
 *   · 회원 이름도 지어낸 것.
 *   · 예시에서 누른 것(주문 · 취소 · 상태 바꾸기 · 상품 고치기)은 이 기기 화면에서만 바뀐다 — 서버 규칙과 같은 순서로.
 */
import {
  cleanText,
  parseOptions,
  parseWon,
  placeError,
  productTitle,
  staffActions,
  todayKst,
  type MarketBoard,
  type MarketHome,
  type MarketOrder,
  type MarketOrderStatus,
  type MarketProduct,
  type ProductDraft,
} from "@/lib/market153";

/** 공식몰 판매가를 본 날 */
const LIST_SEEN_ON = "2026-11-17";

interface Seed {
  id: string;
  category: MarketProduct["category"];
  brand: string;
  name: string;
  model?: string;
  summary: string;
  options?: string[];
  optionLabel?: string;
  /** 공식몰 판매가 (공개 화면 값) */
  list: number;
  /** 예시 회원가 */
  price: number;
  /** 예시 인터넷 최저가 */
  compare?: number;
  maxQty?: number;
  soldOut?: boolean;
}

const OZ = ["8oz", "10oz", "12oz", "14oz", "16oz"];

const SEEDS: readonly Seed[] = [
  { id: "demo-glove-1", category: "glove", brand: "아디다스", name: "파워 100 트레이닝 글러브", model: "PWR100TG", summary: "입문 · 샌드백 · 미트", options: OZ, optionLabel: "온스", list: 69_000, price: 58_000, compare: 62_500 },
  { id: "demo-glove-2", category: "glove", brand: "아디다스", name: "스피드 175 글러브", model: "ADISBG175", summary: "가죽 · 손목 고정이 단단한 편", options: OZ.slice(1), optionLabel: "온스", list: 109_000, price: 92_000 },
  { id: "demo-glove-3", category: "glove", brand: "라이벌", name: "RB5 백글러브", summary: "샌드백 전용 · 얇고 가벼움", options: ["M", "L", "XL"], optionLabel: "사이즈", list: 78_000, price: 66_000 },
  { id: "demo-glove-4", category: "glove", brand: "라이벌", name: "RS4V 스파링 글러브", summary: "스파링용 · 벨크로", options: ["14oz", "16oz"], optionLabel: "온스", list: 132_000, price: 112_000 },
  { id: "demo-wrap-1", category: "wrap", brand: "라이벌", name: "멕시칸 핸드랩 150", summary: "신축성 있는 붕대 · 한 쌍", list: 19_000, price: 15_000, compare: 17_500, maxQty: 5 },
  { id: "demo-guard-1", category: "guard", brand: "아디다스", name: "풀 프로텍션 헤드기어", model: "ADIBHGF01", summary: "볼 · 턱 보호 · 스파링 입문", options: ["S", "M", "L", "XL"], optionLabel: "사이즈", list: 179_000, price: 152_000 },
  { id: "demo-shoes-1", category: "shoes", brand: "아디다스", name: "스피덱스 23 복싱화", summary: "발목 지지 · 가벼운 밑창", options: ["250", "255", "260", "265", "270", "275", "280"], optionLabel: "사이즈", list: 269_000, price: 229_000 },
  { id: "demo-shoes-2", category: "shoes", brand: "나이키", name: "풋스윕 2 복싱화", summary: "입문용 복싱화", options: ["250", "260", "270", "280"], optionLabel: "사이즈", list: 189_000, price: 161_000, soldOut: true },
  { id: "demo-training-1", category: "training", brand: "아디다스", name: "스피드 50 포커스 미트", model: "SPD50FM", summary: "짝 연습 · 한 쌍", list: 99_000, price: 84_000 },
  { id: "demo-wear-1", category: "wear", brand: "아디다스", name: "커뮤니티라인 후드", summary: "운동 전후 걸치는 후드", options: ["S", "M", "L", "XL", "2XL"], optionLabel: "사이즈", list: 39_000, price: 33_000 },
  { id: "demo-etc-1", category: "etc", brand: "에어링", name: "글러브 탈취제", summary: "운동 뒤 글러브 안에 넣어 두기", list: 10_000, price: 8_500, maxQty: 5 },
];

/** 지어낸 도매가 — 공식몰 판매가의 70% 남짓으로 꾸민 숫자(실제 값 아님) */
const fakeCost = (list: number) => Math.round((list * 0.72) / 100) * 100;

const productOf = (s: Seed, today: string, staff: boolean, boss: boolean, i: number): MarketProduct => {
  const p: MarketProduct = {
    id: s.id,
    category: s.category,
    brand: s.brand,
    name: s.name,
    model: s.model ?? null,
    summary: s.summary,
    image: null,
    options: s.options ?? [],
    optionLabel: s.optionLabel ?? null,
    price: s.price,
    listPrice: s.list,
    listOn: LIST_SEEN_ON <= today ? LIST_SEEN_ON : today,
    comparePrice: s.compare ?? null,
    compareSource: s.compare ? "예시" : null,
    compareOn: s.compare ? today : null,
    maxQty: s.maxQty ?? 2,
    leadNote: "결제 뒤 3~5일",
    soldOut: s.soldOut === true,
  };
  if (staff) {
    p.active = true;
    p.sort = (i + 1) * 10;
    p.supplier = "goldenchamps";
    p.supplierRef = null;
    p.branches = null;
    p.updatedAt = `${today}T09:00:00+09:00`;
  }
  if (boss) p.cost = fakeCost(s.list);
  return p;
};

const iso = (day: string, hm: string) => `${day}T${hm}:00+09:00`;
const addDays = (day: string, n: number) => todayKst(Date.parse(`${day}T12:00:00+09:00`) + n * 86_400_000);

const orderOf = (
  id: string,
  seed: Seed,
  option: string | null,
  qty: number,
  status: MarketOrderStatus,
  day: string,
  member?: string,
): MarketOrder => {
  const o: MarketOrder = {
    id,
    orderNo: `M${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${id.slice(-4).toUpperCase().padStart(4, "0")}`,
    productId: seed.id,
    productName: productTitle(seed),
    option,
    qty,
    unitPrice: seed.price,
    amount: seed.price * qty,
    status,
    note: null,
    createdAt: iso(day, "19:20"),
    paidAt: status === "applied" || status === "canceled" ? null : iso(day, "20:05"),
    orderedAt: ["ordered", "arrived", "delivered"].includes(status) ? iso(addDays(day, 1), "10:10") : null,
    arrivedAt: ["arrived", "delivered"].includes(status) ? iso(addDays(day, 3), "14:30") : null,
    deliveredAt: status === "delivered" ? iso(addDays(day, 4), "19:40") : null,
    canceledAt: status === "canceled" ? iso(day, "21:00") : null,
    cancelReason: status === "canceled" ? "회원 취소" : null,
  };
  if (member) {
    o.memberName = member;
    o.branch = "153복싱짐 선릉역점";
    o.staffMemo = null;
  }
  return o;
};

const seed = (id: string) => SEEDS.find((s) => s.id === id) as Seed;

/** 회원 예시 — 도착한 주문 하나가 있는 모습 */
export function buildMarketHomeSample(today: string = todayKst()): MarketHome {
  return {
    on: true,
    branch: "153복싱짐 선릉역점",
    staff: false,
    preview: false,
    today,
    staleDays: 14,
    maxOpen: 10,
    seller: null,
    products: SEEDS.map((s, i) => productOf(s, today, false, false, i)),
    orders: [orderOf("demo-order-a1b2", seed("demo-wrap-1"), null, 2, "arrived", addDays(today, -4))],
  };
}

/** 운영진 예시 — 단계마다 주문이 하나씩 있는 모습 (대표님 화면: 도매가 칸이 보인다) */
export function buildMarketBoardSample(today: string = todayKst(), boss = true): MarketBoard {
  return {
    on: true,
    scope: boss ? "all" : "branch",
    branch: boss ? null : "153복싱짐 선릉역점",
    branches: ["153복싱짐 선릉역점"],
    boss,
    today,
    staleDays: 14,
    products: SEEDS.map((s, i) => productOf(s, today, true, boss, i)),
    orders: [
      orderOf("demo-order-c3d4", seed("demo-glove-1"), "12oz", 1, "applied", today, "예시 회원 가"),
      orderOf("demo-order-e5f6", seed("demo-glove-2"), "14oz", 1, "paid", addDays(today, -1), "예시 회원 나"),
      orderOf("demo-order-a7b8", seed("demo-wrap-1"), null, 3, "paid", addDays(today, -1), "예시 회원 다"),
      orderOf("demo-order-c9d0", seed("demo-shoes-1"), "265", 1, "ordered", addDays(today, -2), "예시 회원 라"),
      orderOf("demo-order-a1b2", seed("demo-wrap-1"), null, 2, "arrived", addDays(today, -4), "예시 회원 마"),
      orderOf("demo-order-e1f2", seed("demo-guard-1"), "M", 1, "delivered", addDays(today, -9), "예시 회원 바"),
    ],
    wishes: [
      { id: "demo-wish-1", body: "16온스 스파링 글러브도 넣어 주세요", memberName: "예시 회원 사", branch: "153복싱짐 선릉역점", createdAt: iso(addDays(today, -1), "21:10") },
      { id: "demo-wish-2", body: "아이 글러브 6온스", memberName: "예시 회원 아", branch: "153복싱짐 선릉역점", createdAt: iso(addDays(today, -3), "18:40") },
    ],
  };
}

// ── 예시에서 누른 것 ────────────────────────────────────────

export type MarketHomeDemoAction =
  | { type: "place"; productId: string; option: string | null; qty: number; note: string }
  | { type: "cancel"; id: string };

export interface DemoResult<T> {
  next: T;
  ok: boolean;
  message?: string;
  order?: MarketOrder;
}

let demoSeq = 0;
const demoId = () => {
  demoSeq += 1;
  return `demo-order-${Date.now().toString(16)}${demoSeq.toString(16).padStart(2, "0")}`;
};

/** 회원 예시 — 주문 · 취소 (서버 market_order_place · market_order_cancel 과 같은 순서) */
export function applyMarketHomeDemo(home: MarketHome, a: MarketHomeDemoAction): DemoResult<MarketHome> {
  if (a.type === "place") {
    const p = home.products.find((x) => x.id === a.productId);
    if (!p) return { next: home, ok: false, message: "지금은 주문할 수 없는 상품이에요" };
    const option = p.options.length ? a.option : null;
    const err = placeError(p, option, a.qty, a.note);
    if (err) return { next: home, ok: false, message: err };
    const open = home.orders.filter((o) => ["applied", "paid", "ordered", "arrived"].includes(o.status)).length;
    if (open >= home.maxOpen) return { next: home, ok: false, message: `진행 중인 주문이 ${home.maxOpen}건이에요. 받은 뒤에 다시 주문해 주세요` };
    const id = demoId();
    const now = new Date().toISOString();
    const order: MarketOrder = {
      id,
      orderNo: `M${home.today.slice(2, 4)}${home.today.slice(5, 7)}${home.today.slice(8, 10)}-${id.slice(-4).toUpperCase()}`,
      productId: p.id,
      productName: productTitle(p),
      option,
      qty: a.qty,
      unitPrice: p.price,
      amount: p.price * a.qty,
      status: "applied",
      note: cleanText(a.note) || null,
      createdAt: now,
      paidAt: null,
      orderedAt: null,
      arrivedAt: null,
      deliveredAt: null,
      canceledAt: null,
      cancelReason: null,
    };
    return { next: { ...home, orders: [order, ...home.orders] }, ok: true, order };
  }
  const o = home.orders.find((x) => x.id === a.id);
  if (!o) return { next: home, ok: false, message: "주문을 찾을 수 없어요" };
  if (o.status === "canceled") return { next: home, ok: true, order: o };
  if (o.status !== "applied") return { next: home, ok: false, message: "결제한 주문은 데스크에서 취소해 주세요" };
  const canceled: MarketOrder = { ...o, status: "canceled", canceledAt: new Date().toISOString(), cancelReason: "회원 취소" };
  return { next: { ...home, orders: home.orders.map((x) => (x.id === o.id ? canceled : x)) }, ok: true, order: canceled };
}

export type MarketBoardDemoAction =
  | { type: "order"; id: string; status?: MarketOrderStatus | null; memo?: string | null; reason?: string | null }
  | { type: "product"; draft: ProductDraft };

/** 운영진 예시 — 주문 상태 · 메모 · 상품 넣기/고치기 (서버 market_admin_order_set · market_admin_product_save 와 같은 순서) */
export function applyMarketBoardDemo(board: MarketBoard, a: MarketBoardDemoAction): DemoResult<MarketBoard> {
  if (a.type === "order") {
    const o = board.orders.find((x) => x.id === a.id);
    if (!o) return { next: board, ok: false, message: "주문을 찾을 수 없어요" };
    let n: MarketOrder = { ...o };
    if (a.memo != null) n.staffMemo = cleanText(a.memo).slice(0, 200) || null;
    const to = a.status;
    if (to && to !== o.status) {
      if (!staffActions(o.status).some((x) => x.to === to)) return { next: board, ok: false, message: "지금 상태에서는 그렇게 바꿀 수 없어요" };
      const now = new Date().toISOString();
      const from = o.status;
      n = {
        ...n,
        status: to,
        paidAt: to === "applied" ? null : to === "paid" && from === "applied" ? now : n.paidAt,
        orderedAt: to === "applied" || to === "paid" ? null : to === "ordered" && from === "paid" ? now : n.orderedAt,
        arrivedAt: ["applied", "paid", "ordered"].includes(to) ? null : to === "arrived" && from === "ordered" ? now : n.arrivedAt,
        deliveredAt: to === "delivered" ? now : to === "canceled" ? n.deliveredAt : null,
        canceledAt: to === "canceled" ? now : null,
        cancelReason: to === "canceled" ? cleanText(a.reason ?? "") || (from === "applied" ? "운영진 취소" : "취소 · 환불") : null,
      };
    }
    return { next: { ...board, orders: board.orders.map((x) => (x.id === o.id ? n : x)) }, ok: true, order: n };
  }
  const d = a.draft;
  const price = parseWon(d.price);
  if (price == null || Number.isNaN(price)) return { next: board, ok: false, message: "값을 다시 확인해 주세요" };
  const clean = (v: string) => cleanText(v) || null;
  const numOrNull = (v: string) => {
    const n = parseWon(v);
    return n == null || Number.isNaN(n) ? null : n;
  };
  const listPrice = numOrNull(d.listPrice);
  const comparePrice = numOrNull(d.comparePrice);
  const base = d.id ? board.products.find((p) => p.id === d.id) : undefined;
  const next: MarketProduct = {
    id: d.id ?? `demo-product-${Date.now().toString(16)}`,
    category: d.category,
    brand: clean(d.brand),
    name: cleanText(d.name),
    model: clean(d.model),
    summary: clean(d.summary),
    image: base?.image ?? null,
    options: parseOptions(d.optionsText),
    optionLabel: clean(d.optionLabel),
    price,
    listPrice,
    listOn: listPrice != null ? d.listOn : null,
    comparePrice,
    compareSource: comparePrice != null ? clean(d.compareSource) : null,
    compareOn: comparePrice != null ? d.compareOn : null,
    maxQty: numOrNull(d.maxQty) ?? 2,
    leadNote: clean(d.leadNote),
    soldOut: d.soldOut,
    active: d.active,
    sort: numOrNull(d.sort) ?? 100,
    supplier: base?.supplier ?? "goldenchamps",
    supplierRef: clean(d.supplierRef),
    branches: base?.branches ?? null,
    updatedAt: new Date().toISOString(),
    cost: numOrNull(d.cost),
  };
  const products = base ? board.products.map((p) => (p.id === next.id ? next : p)) : [...board.products, next];
  products.sort((x, y) => (x.sort ?? 100) - (y.sort ?? 100) || x.name.localeCompare(y.name, "ko"));
  return { next: { ...board, products }, ok: true };
}
