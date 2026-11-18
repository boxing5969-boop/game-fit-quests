import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAppMenu, flatAppMenu, isMenuFolder } from "@/lib/appMenu";
import { FEATURES, visibleFor } from "@/lib/appSearch";
import { buildMenuView, canSee, menuCatalog, resolveEntries, type MenuViewer } from "@/lib/menuLayout";
import {
  MARKET_CATEGORIES,
  MARKET_SOURCE,
  MAX_OFF_LOWEST_PCT,
  MEMBER_STEPS,
  MIN_MARGIN_PCT,
  MIN_SAVE_PCT,
  NOTE_MAX,
  ORDER_STATUS_LABEL,
  WISH_EXAMPLES,
  WISH_MAX,
  boardGroups,
  boardTodoCount,
  categoriesOf,
  cleanText,
  compareEvidence,
  compareLong,
  compareOf,
  compareShort,
  compareShortParts,
  daysBetween,
  draftOfProduct,
  emptyProductDraft,
  headlineOrder,
  isFreshDay,
  isOpenOrder,
  marginFloor,
  marginOf,
  marginText,
  marketGuide,
  mdLabel,
  mdOfTime,
  normalizeMarketBoard,
  normalizeMarketHome,
  normalizeOrder,
  normalizeProduct,
  orderMemberLine,
  orderStepIndex,
  orderTitle,
  parseOptions,
  parseWon,
  placeError,
  priceFlags,
  priceFromLowest,
  productDraftError,
  productPayload,
  productTitle,
  purchaseList,
  purchaseText,
  purchaseTotals,
  rulePriceOf,
  sellerLines,
  staffActions,
  todayKst,
  wishError,
  won,
  type MarketOrder,
  type MarketOrderStatus,
  type MarketProduct,
} from "./market153";
import { applyMarketBoardDemo, applyMarketHomeDemo, buildMarketBoardSample, buildMarketHomeSample } from "./marketSample";

const SQL = readFileSync("supabase/migrations/20261117013411_market153.sql", "utf8");
const TODAY = "2026-11-17";

/** 지어낸 상품 — 숫자는 시험용 */
const product = (over: Partial<MarketProduct> = {}): MarketProduct => ({
  id: "p1",
  category: "glove",
  brand: "시험",
  name: "글러브 가",
  model: null,
  summary: null,
  image: null,
  options: ["10oz", "12oz"],
  optionLabel: "온스",
  price: 50_000,
  listPrice: 60_000,
  listOn: TODAY,
  comparePrice: 55_000,
  compareSource: "네이버 쇼핑",
  compareOn: TODAY,
  maxQty: 2,
  leadNote: null,
  soldOut: false,
  ...over,
});

const order = (id: string, status: MarketOrderStatus, over: Partial<MarketOrder> = {}): MarketOrder => ({
  id,
  orderNo: `M261117-${id.toUpperCase().padStart(4, "0").slice(-4)}`,
  productId: "p1",
  productName: "시험 글러브 가",
  option: "12oz",
  qty: 1,
  unitPrice: 50_000,
  amount: 50_000,
  status,
  note: null,
  createdAt: "2026-11-17T10:00:00+09:00",
  paidAt: null,
  orderedAt: null,
  arrivedAt: null,
  deliveredAt: null,
  canceledAt: null,
  cancelReason: null,
  ...over,
});

describe("153 마켓 — 날짜 · 금액", () => {
  it("한국 날짜 · 며칠 · 글", () => {
    expect(todayKst(Date.parse("2026-11-16T15:00:00Z"))).toBe("2026-11-17");
    expect(todayKst(Date.parse("2026-11-16T14:59:59Z"))).toBe("2026-11-16");
    expect(daysBetween("2026-11-03", TODAY)).toBe(14);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(mdLabel("2026-01-05")).toBe("1/5");
    expect(mdOfTime("2026-11-16T15:30:00Z")).toBe("11/17");
    expect(mdOfTime(null)).toBe("");
    expect(won(58000)).toBe("58,000원");
  });
});

describe("153 마켓 — 가격 비교는 근거가 있을 때만", () => {
  it("최근에 확인한 인터넷 최저가가 회원가보다 높으면 그것을 보여 준다", () => {
    const c = compareOf(product(), TODAY, 14);
    expect(c).toMatchObject({ kind: "lowest", price: 55_000, saving: 5_000, percent: 9, source: "네이버 쇼핑", on: TODAY });
    expect(compareShort(c!)).toBe("최저가보다 5,000원 저렴");
    // 좁은 상품 칸에서는 이 두 덩어리로 꺾인다 — 「저렴」만 혼자 내려가지 않게
    expect(compareShortParts(c!)).toEqual(["최저가보다", "5,000원 저렴"]);
    expect(compareLong(c!)).toBe("인터넷 최저가 55,000원");
    expect(compareEvidence(c!)).toBe("네이버 쇼핑 · 11/17 확인 · 배송비 포함");
  });

  it("인터넷 최저가가 회원가보다 높지 않으면 어떤 비교도 보여 주지 않는다 (공식몰 값이 더 높아도)", () => {
    expect(compareOf(product({ comparePrice: 50_000 }), TODAY, 14)).toBeNull();
    expect(compareOf(product({ comparePrice: 48_000, listPrice: 90_000 }), TODAY, 14)).toBeNull();
  });

  it("최저가가 없거나 확인한 지 오래됐으면 공식몰 판매가(최근 확인 · 회원가보다 높을 때)", () => {
    const noCompare = compareOf(product({ comparePrice: null, compareOn: null }), TODAY, 14);
    expect(noCompare).toMatchObject({ kind: "list", price: 60_000, saving: 10_000, percent: 16, source: "공식몰" });
    expect(compareShort(noCompare!)).toBe("공식몰보다 10,000원 저렴");
    expect(compareLong(noCompare!)).toBe("공식몰 판매가 60,000원");
    expect(compareEvidence(noCompare!)).toBe("11/17 확인");
    const stale = compareOf(product({ compareOn: "2026-11-02" }), TODAY, 14);
    expect(stale?.kind).toBe("list");
    expect(compareOf(product({ compareOn: "2026-11-02", listOn: "2026-11-02" }), TODAY, 14)).toBeNull();
    expect(compareOf(product({ comparePrice: null, listPrice: 50_000 }), TODAY, 14)).toBeNull();
  });

  it("확인한 날 — 14일째까지 · 앞날 날짜는 믿지 않는다", () => {
    expect(isFreshDay("2026-11-03", TODAY, 14)).toBe(true);
    expect(isFreshDay("2026-11-02", TODAY, 14)).toBe(false);
    expect(isFreshDay("2026-11-18", TODAY, 14)).toBe(false);
    expect(isFreshDay(null, TODAY, 14)).toBe(false);
    expect(isFreshDay("어제", TODAY, 14)).toBe(false);
    expect(compareOf(product({ compareOn: "2026-11-18", listOn: "2026-11-18" }), TODAY, 14)).toBeNull();
  });

  it("출처를 안 적었으면 '인터넷 검색'", () => {
    expect(compareOf(product({ compareSource: null }), TODAY, 14)?.source).toBe("인터넷 검색");
  });
});

describe("153 마켓 — 운영진 가격 점검", () => {
  const keys = (p: MarketProduct, boss: boolean) => priceFlags(p, TODAY, 14, boss).map((f) => `${f.key}:${f.tone}`);

  it("최저가 없음 · 오래됨 · 싸지 않음", () => {
    expect(keys(product({ comparePrice: null }), false)).toEqual(["no_compare:info"]);
    expect(keys(product({ compareOn: "2026-10-30" }), false)).toEqual(["stale:warn"]);
    expect(priceFlags(product({ compareOn: "2026-10-30" }), TODAY, 14, false)[0].text).toBe("최저가 확인한 지 18일 — 다시 확인해 주세요");
    expect(keys(product({ comparePrice: 50_000 }), false)).toEqual(["not_lower:warn"]);
    expect(keys(product(), false)).toEqual([]);
  });

  it("도매가 점검은 대표님 · 관리자 화면에서만", () => {
    expect(keys(product({ cost: null }), true)).toEqual(["no_cost:info"]);
    expect(keys(product({ cost: 52_000 }), true)).toEqual(["below_cost:warn"]);
    expect(keys(product({ cost: 40_000 }), true)).toEqual([]);
    expect(keys(product({ cost: 52_000 }), false)).toEqual([]);
  });

  it("남는 돈 — 도매가에 몇 % 얹은 셈인가", () => {
    expect(marginOf({ price: 50_000, cost: 40_000 })).toEqual({ amount: 10_000, percent: 25 });
    expect(marginOf({ price: 50_000, cost: null })).toBeNull();
    expect(marginOf({ price: 50_000 })).toBeNull();
    expect(marginOf({ price: 50_000, cost: 0 })).toEqual({ amount: 50_000, percent: 0 });
    expect(marginText(marginOf({ price: 54_700, cost: 49_700 })!)).toBe("5,000원 남아요 (도매가 +10%)");
    expect(marginText(marginOf({ price: 40_000, cost: 40_000 })!)).toBe("0원 남아요");
    expect(marginText(marginOf({ price: 38_000, cost: 40_000 })!)).toBe("2,000원 모자라요");
  });

  it("회원가 원칙 — 인터넷 최저가에서 최대 15%까지 낮게 (100원 단위 올림)", () => {
    expect(MAX_OFF_LOWEST_PCT).toBe(15);
    expect(priceFromLowest(10_000)).toBe(8_500); // 딱 15%
    expect(priceFromLowest(20_000)).toBe(17_000);
    expect(priceFromLowest(67_560)).toBe(57_500); // 57,426 → 올림
    expect(priceFromLowest(17_140)).toBe(14_600); // 14,569 → 올림
    expect(priceFromLowest(289_690)).toBe(246_300);
    expect(priceFromLowest(55_000, 0)).toBe(55_000);
    // 올림이라 낮추는 폭은 15% 를 넘지 않는다
    for (const lowest of [9_990, 13_000, 39_000, 109_000, 248_040]) {
      const price = priceFromLowest(lowest);
      expect((lowest - price) / lowest).toBeLessThanOrEqual(0.15);
      expect(price % 100).toBe(0);
    }
  });

  it("남는 돈 바닥 — 최저가 −15%가 도매가에 붙으면 도매가 +3%(최소 1,000원)에서 멈추고, 최저가보다 1% 넘게 싸야 올린다", () => {
    // 숫자는 모두 지어낸 값 (실제 도매가는 저장소에 두지 않는다)
    expect(MIN_MARGIN_PCT).toBe(3);
    expect(MIN_SAVE_PCT).toBe(1);
    expect(marginFloor(52_300)).toBe(53_900); // 53,869 → 올림
    expect(marginFloor(150_000)).toBe(154_500); // 딱 떨어지는 값은 그대로(소수 오차로 한 칸 올라가지 않게)
    expect(marginFloor(10_000)).toBe(11_000); // +1,000원이 더 큼
    expect(marginFloor(20_000)).toBe(21_000);
    // 최저가 −15%가 넉넉하면 그대로
    expect(rulePriceOf(90_000, 50_000)).toEqual({ price: 76_500, byFloor: false, ok: true });
    // 바닥에 걸리면 도매가 +3%
    expect(rulePriceOf(100_000, 90_000)).toEqual({ price: 92_700, byFloor: true, ok: true });
    // 바닥이 최저가의 99%를 넘으면 올리지 않는다
    expect(rulePriceOf(100_000, 97_000)).toEqual({ price: 100_000, byFloor: true, ok: false });
    expect(rulePriceOf(100_000, 95_100)).toEqual({ price: 98_000, byFloor: true, ok: true }); // 97,953 → 98,000 ≤ 99,000
    // 도매가를 모르면 −15%만
    expect(rulePriceOf(55_000, null)).toEqual({ price: 46_800, byFloor: false, ok: true });
  });

  it("원칙보다 더 싸면 대표님 · 관리자 화면에 한 줄 (info) — 딱 15% 는 괜찮다", () => {
    expect(keys(product({ price: 46_700, cost: 40_000 }), true)).toEqual(["too_low:info"]); // 최저가 55,000 → 원칙 46,800
    expect(priceFlags(product({ price: 46_700, cost: 40_000 }), TODAY, 14, true).find((f) => f.key === "too_low")?.text).toBe(
      "최저가보다 15% 넘게 싸요 — 원칙대로면 46,800원",
    );
    expect(keys(product({ price: 46_800, cost: 40_000 }), true)).toEqual([]);
    expect(keys(product({ price: 46_700 }), false)).toEqual([]); // 지점장 · 코치 화면에는 없음
    expect(keys(product({ price: 46_700, cost: 40_000, compareOn: "2026-10-30" }), true)).toEqual(["stale:warn"]); // 오래된 최저가로는 셈하지 않는다
    expect(keys(product({ price: 30_000, cost: 40_000 }), true)).toEqual(["below_cost:warn", "too_low:info"]);
  });
});

describe("153 마켓 — 주문 넣기 검사 (서버와 같은 말)", () => {
  it("품절 · 옵션 · 수량 · 메모", () => {
    const p = product();
    expect(placeError(product({ soldOut: true }), "12oz", 1, "")).toBe("지금은 품절이에요");
    expect(placeError(p, null, 1, "")).toBe("온스을(를) 골라 주세요");
    expect(placeError(p, "99oz", 1, "")).toBe("온스을(를) 골라 주세요");
    expect(placeError(product({ optionLabel: null }), null, 1, "")).toBe("옵션을(를) 골라 주세요");
    expect(placeError(p, "12oz", 3, "")).toBe("한 번에 2개까지 주문할 수 있어요");
    expect(placeError(p, "12oz", 0, "")).toBe("한 번에 2개까지 주문할 수 있어요");
    expect(placeError(p, "12oz", 1.5, "")).toBe("한 번에 2개까지 주문할 수 있어요");
    expect(placeError(p, "12oz", 1, "가".repeat(NOTE_MAX + 1))).toBe("메모는 100자까지 쓸 수 있어요");
    expect(placeError(p, "12oz", 2, "가".repeat(NOTE_MAX))).toBeNull();
    expect(placeError(product({ options: [] }), null, 1, "")).toBeNull();
  });

  it("찾는 용품 요청", () => {
    expect(wishError(" ")).toBe("찾는 용품을 적어 주세요");
    expect(wishError("가")).toBe("찾는 용품을 적어 주세요");
    expect(wishError("가".repeat(WISH_MAX + 1))).toBe("200자까지 쓸 수 있어요");
    expect(wishError("16온스   스파링 글러브")).toBeNull();
    expect(cleanText("  16온스   스파링\n글러브 ")).toBe("16온스 스파링 글러브");
    for (const ex of WISH_EXAMPLES) expect(wishError(ex)).toBeNull();
  });

  it("화면 말이 서버 함수 글과 같다", () => {
    for (const msg of [
      "지금은 품절이에요",
      "을(를) 골라 주세요",
      "개까지 주문할 수 있어요",
      `메모는 ${NOTE_MAX}자까지 쓸 수 있어요`,
      "찾는 용품을 적어 주세요",
      `${WISH_MAX}자까지 쓸 수 있어요`,
      "결제한 주문은 데스크에서 취소해 주세요",
      "지금 상태에서는 그렇게 바꿀 수 없어요",
      "옵션은 40개 · 한 줄 40자까지예요",
    ]) {
      expect(SQL, msg).toContain(msg);
    }
    // 화면 검사 한도 = 서버 제약
    expect(SQL).toContain(`char_length(v_note) > ${NOTE_MAX}`);
    expect(SQL).toContain(`char_length(v_text) > ${WISH_MAX}`);
    expect(SQL).toMatch(/price\s+integer not null check \(price between 500 and 3000000\)/);
    expect(SQL).toMatch(/compare_price\s+integer check \(compare_price is null or compare_price between 500 and 5000000\)/);
    expect(SQL).toMatch(/cost_price\s+integer check \(cost_price is null or cost_price between 0 and 5000000\)/);
  });
});

describe("153 마켓 — 주문 상태", () => {
  it("운영진이 누를 수 있는 것 = 서버가 받는 변화", () => {
    const server = new Map<string, string[]>();
    const re = /\(v_from = '(\w+)'\s+and p_status (?:in \(([^)]*)\)|= '(\w+)')\)/g;
    for (const m of SQL.matchAll(re)) {
      server.set(m[1], m[2] ? m[2].split(",").map((x) => x.trim().replace(/'/g, "")) : [m[3]]);
    }
    expect([...server.keys()].sort()).toEqual(["applied", "arrived", "canceled", "delivered", "ordered", "paid"]);
    for (const [from, to] of server) {
      expect(staffActions(from as MarketOrderStatus).map((a) => a.to).sort(), from).toEqual([...to].sort());
    }
  });

  it("다음 단계는 하나 · 취소는 어느 단계에서든 · 취소는 결제 전으로만 되돌린다", () => {
    const primary = (s: MarketOrderStatus) => staffActions(s).filter((a) => a.kind === "primary").map((a) => `${a.to}:${a.label}`);
    expect(primary("applied")).toEqual(["paid:결제 확인"]);
    expect(primary("paid")).toEqual(["ordered:발주했어요"]);
    expect(primary("ordered")).toEqual(["arrived:도착했어요"]);
    expect(primary("arrived")).toEqual(["delivered:전달했어요"]);
    expect(primary("delivered")).toEqual([]);
    for (const s of ["applied", "paid", "ordered", "arrived", "delivered"] as const) {
      expect(staffActions(s).some((a) => a.kind === "cancel" && a.to === "canceled"), s).toBe(true);
    }
    expect(staffActions("canceled")).toEqual([{ to: "applied", label: "취소 되돌리기", kind: "back" }]);
  });

  it("회원 진행 줄 · 한 줄", () => {
    expect(MEMBER_STEPS).toEqual(["주문", "결제", "도착", "받음"]);
    expect((["applied", "paid", "ordered", "arrived", "delivered", "canceled"] as const).map(orderStepIndex)).toEqual([0, 1, 1, 2, 3, -1]);
    expect(orderMemberLine(order("a", "applied"))).toBe("데스크에서 결제해 주세요 · 50,000원");
    expect(orderMemberLine(order("a", "arrived"))).toBe("도착했어요 · 데스크에서 받아 가세요");
    expect(orderMemberLine(order("a", "delivered", { deliveredAt: "2026-11-20T10:00:00+09:00" }))).toBe("11/20 받았어요");
    expect(orderMemberLine(order("a", "canceled", { cancelReason: "회원 취소" }))).toBe("취소했어요");
    expect(orderMemberLine(order("a", "canceled", { cancelReason: "품절" }))).toBe("취소됐어요 · 품절");
    expect(orderTitle(order("a", "applied", { qty: 2 }))).toBe("시험 글러브 가 · 12oz × 2");
    expect(orderTitle(order("a", "applied", { option: null }))).toBe("시험 글러브 가");
    expect(Object.keys(ORDER_STATUS_LABEL).sort()).toEqual(["applied", "arrived", "canceled", "delivered", "ordered", "paid"]);
  });

  it("맨 위에 보일 주문 — 받아 갈 것 → 결제할 것 → 기다리는 것", () => {
    expect(headlineOrder([])).toBeNull();
    expect(headlineOrder([order("a", "delivered"), order("b", "canceled")])).toBeNull();
    expect(headlineOrder([order("a", "ordered"), order("b", "applied"), order("c", "arrived")])?.id).toBe("c");
    expect(headlineOrder([order("a", "ordered"), order("b", "paid"), order("c", "applied")])?.id).toBe("c");
    expect(
      headlineOrder([order("a", "applied", { createdAt: "2026-11-16T10:00:00+09:00" }), order("b", "applied", { createdAt: "2026-11-17T09:00:00+09:00" })])?.id,
    ).toBe("b");
    expect(isOpenOrder(order("a", "arrived"))).toBe(true);
    expect(isOpenOrder(order("a", "delivered"))).toBe(false);
  });

  it("주문함 묶음 — 전달할 것 → 결제 기다림 → 발주할 것 → 도착 기다림 → 끝난 주문", () => {
    const orders = [order("a", "delivered"), order("b", "ordered"), order("c", "paid"), order("d", "applied"), order("e", "arrived"), order("f", "canceled")];
    const g = boardGroups(orders);
    expect(g.map((x) => `${x.key}:${x.label}:${x.orders.length}`)).toEqual([
      "arrived:전달할 것:1",
      "applied:결제 기다림:1",
      "paid:발주할 것:1",
      "ordered:도착 기다림:1",
      "closed:끝난 주문:2",
    ]);
    expect(boardGroups([order("a", "paid")]).map((x) => x.key)).toEqual(["paid"]);
    expect(boardTodoCount(orders)).toBe(3);
    expect(boardTodoCount([order("b", "ordered")])).toBe(0);
  });
});

describe("153 마켓 — 발주 목록", () => {
  const products = [product({ id: "p1", cost: 40_000, supplierRef: "1234" }), product({ id: "p2", name: "붕대", brand: null, cost: 9_000, options: [] })];
  const orders = [
    order("a", "paid", { productId: "p1", option: "12oz", qty: 1, memberName: "회원 가" }),
    order("b", "paid", { productId: "p1", option: "12oz", qty: 2, memberName: "회원 나" }),
    order("c", "paid", { productId: "p1", option: "10oz", qty: 1 }),
    order("d", "paid", { productId: "p2", productName: "붕대", option: null, qty: 3 }),
    order("e", "applied", { productId: "p2", productName: "붕대", option: null, qty: 5 }),
    order("f", "ordered", { productId: "p1", qty: 9 }),
  ];

  it("결제한(발주 전) 주문만 상품 · 옵션마다 모은다", () => {
    const lines = purchaseList(orders, products);
    expect(lines.map((l) => `${l.name}|${l.option ?? ""}|${l.qty}|${l.orders}|${l.cost}`)).toEqual([
      "붕대||3|1|9000",
      "시험 글러브 가|10oz|1|1|40000",
      "시험 글러브 가|12oz|3|2|40000",
    ]);
    expect(purchaseTotals(lines)).toEqual({ qty: 7, cost: 3 * 9_000 + 4 * 40_000 });
  });

  it("도매가를 모르는 줄이 있으면 합계 금액은 없다 (지점장 화면에는 도매가가 오지 않는다)", () => {
    const lines = purchaseList(orders, products.map(({ cost: _cost, ...rest }) => rest));
    expect(purchaseTotals(lines)).toEqual({ qty: 7, cost: null });
    expect(purchaseTotals([])).toEqual({ qty: 0, cost: null });
  });

  it("복사하는 글에는 금액 · 회원 이름이 없다", () => {
    const text = purchaseText(purchaseList(orders, products), TODAY);
    expect(text.split("\n")[0]).toBe("153 마켓 발주 목록 · 11/17 · 7개");
    expect(text).toContain("- 시험 글러브 가 · 12oz × 3 (상품 번호 1234)");
    expect(text).toContain("- 붕대 × 3");
    expect(text).not.toMatch(/원|회원/);
    expect(purchaseText([], TODAY)).toBe("");
  });
});

describe("153 마켓 — 상품 넣기 · 고치기 (대표님 · 관리자)", () => {
  const ok = () => ({ ...emptyProductDraft(TODAY), name: "글러브 가", price: "50,000", comparePrice: "55000", compareSource: "네이버 쇼핑", cost: "40000원" });

  it("숫자 · 옵션 읽기", () => {
    expect(parseWon("89,000")).toBe(89_000);
    expect(parseWon(" 89000원 ")).toBe(89_000);
    expect(parseWon("")).toBeNull();
    expect(Number.isNaN(parseWon("팔만"))).toBe(true);
    expect(parseOptions("10oz, 12oz\n14oz,,10oz ")).toEqual(["10oz", "12oz", "14oz"]);
    expect(parseOptions("")).toEqual([]);
  });

  it("저장 전 검사", () => {
    expect(productDraftError(ok())).toBeNull();
    expect(productDraftError({ ...ok(), name: " 가 " })).toBe("상품 이름을 적어 주세요");
    expect(productDraftError({ ...ok(), price: "" })).toBe("회원가를 넣어 주세요");
    expect(productDraftError({ ...ok(), price: "400" })).toBe("회원가는 500원 ~ 300만 원 사이 숫자로 넣어 주세요");
    expect(productDraftError({ ...ok(), price: "오만" })).toBe("회원가는 500원 ~ 300만 원 사이 숫자로 넣어 주세요");
    expect(productDraftError({ ...ok(), cost: "모름" })).toBe("도매가는 숫자로 넣어 주세요");
    expect(productDraftError({ ...ok(), cost: "0" })).toBeNull();
    expect(productDraftError({ ...ok(), comparePrice: "300" })).toBe("인터넷 최저가를 다시 확인해 주세요 (500원 ~ 500만 원)");
    expect(productDraftError({ ...ok(), listPrice: "6000000" })).toBe("공식몰 판매가를 다시 확인해 주세요 (500원 ~ 500만 원)");
    expect(productDraftError({ ...ok(), cost: "5000001" })).toBe("도매가를 다시 확인해 주세요 (500만 원까지)");
    expect(productDraftError({ ...ok(), maxQty: "21" })).toBe("한 번에 주문할 수 있는 수는 1 ~ 20이에요");
    expect(productDraftError({ ...ok(), compareOn: "" })).toBe("인터넷 최저가를 확인한 날을 넣어 주세요");
    expect(productDraftError({ ...ok(), listPrice: "60000", listOn: "" })).toBe("공식몰 판매가를 확인한 날을 넣어 주세요");
    expect(productDraftError({ ...ok(), optionsText: Array.from({ length: 41 }, (_, i) => `o${i}`).join(",") })).toBe("옵션은 40개 · 한 줄 40자까지예요");
  });

  it("서버에 보내는 값 — 서버 함수가 읽는 열쇠만", () => {
    const payload = productPayload({ ...ok(), brand: " 시험 ", optionsText: "10oz, 12oz", listPrice: "", active: true });
    expect(payload).toMatchObject({
      category: "glove",
      brand: "시험",
      name: "글러브 가",
      options: ["10oz", "12oz"],
      price: 50_000,
      list_price: null,
      list_on: null,
      compare_price: 55_000,
      compare_source: "네이버 쇼핑",
      compare_on: TODAY,
      cost: 40_000,
      max_qty: 2,
      active: true,
      sold_out: false,
      sort: 100,
    });
    expect("id" in payload).toBe(false);
    for (const key of Object.keys(payload)) expect(SQL, key).toContain(`p ->> '${key}'`.replace("p ->> 'options'", "p -> 'options'"));
    expect(productPayload({ ...ok(), id: "abc" }).id).toBe("abc");
  });

  it("고칠 때 — 지금 값이 그대로 채워진다", () => {
    const d = draftOfProduct(product({ cost: 40_000, active: true, sort: 30, supplierRef: "77" }), TODAY);
    expect(d).toMatchObject({ id: "p1", name: "글러브 가", price: "50000", cost: "40000", optionsText: "10oz, 12oz", active: true, sort: "30", supplierRef: "77" });
    expect(productDraftError(d)).toBeNull();
  });
});

describe("153 마켓 — 서버 값 읽기", () => {
  it("꺼져 있거나 모양이 다르면 꺼진 것으로", () => {
    expect(normalizeMarketHome(null).on).toBe(false);
    expect(normalizeMarketHome({ on: false, products: [{}] }).products).toEqual([]);
    expect(normalizeMarketBoard("x").on).toBe(false);
  });

  it("회원 화면 값에는 도매가 · 운영 칸이 없다 / 운영진 값에는 있다", () => {
    const member = normalizeProduct({ id: "p", name: "가나", price: 1000, category: "glove", max_qty: 99, image: "/market/a.webp" })!;
    expect("cost" in member).toBe(false);
    expect("active" in member).toBe(false);
    expect(member.maxQty).toBe(20);
    expect(member.image).toBe("/market/a.webp");
    const staff = normalizeProduct({ id: "p", name: "가나", price: 1000, active: true, sort: 5, cost: 700, branches: ["가 지점"] })!;
    expect(staff).toMatchObject({ active: true, sort: 5, cost: 700, branches: ["가 지점"], category: "etc" });
  });

  it("믿지 않는 값은 버린다", () => {
    expect(normalizeProduct({ id: "p", name: "가나", price: 0 })).toBeNull();
    expect(normalizeProduct({ id: "p", price: 1000 })).toBeNull();
    expect(normalizeProduct({ id: "p", name: "가나", price: 1000, image: "https://다른곳/a.jpg", list_on: "어제" })).toMatchObject({ image: null, listOn: null });
    expect(normalizeOrder({ id: "o", status: "이상", product_name: "가" })).toBeNull();
    const o = normalizeOrder({ id: "o", status: "paid", product_name: "가", qty: 2, unit_price: 500, member_name: "나", branch: "다" })!;
    expect(o).toMatchObject({ amount: 1000, memberName: "나", branch: "다" });
    const home = normalizeMarketHome({ on: true, today: TODAY, seller: { name: "시험 상호", biz_no: "000" }, products: [{ id: "p", name: "가나", price: 1000 }, { bad: 1 }], orders: [] });
    expect(home.products).toHaveLength(1);
    expect(sellerLines(home.seller)).toEqual(["상호 시험 상호", "사업자등록번호 000"]);
    expect(sellerLines(null)).toEqual([]);
  });

  it("분류 — 있는 것만, 정해 둔 순서로", () => {
    expect(categoriesOf([product({ category: "wear" }), product({ category: "glove" })]).map((c) => c.key)).toEqual(["glove", "wear"]);
    expect(MARKET_CATEGORIES.map((c) => c.key)).toEqual(["glove", "wrap", "guard", "shoes", "training", "wear", "etc"]);
    expect(productTitle({ brand: "시험", name: "글러브" })).toBe("시험 글러브");
    expect(productTitle({ brand: null, name: "글러브" })).toBe("글러브");
  });
});

describe("153 마켓 — 판매 안내 · 회원 화면 글", () => {
  it("가격 비교 기준에 확인 날짜 규칙이 적혀 있다", () => {
    const guide = marketGuide(14);
    expect(guide.map((g) => g.title)).toEqual(["어디서 사 오나요?", "결제", "받기", "취소", "교환 · 환불", "가격 비교"]);
    const compare = guide.find((g) => g.title === "가격 비교")!;
    expect(compare.body).toContain("14일");
    expect(compare.body).toContain("배송비 포함");
  });

  // 2026-11-18 대표님 「골든챔스에서 체육관 도매가로 구매해 싸게 판매하는 거라고 설명하자」 — 마켓 맨 위 줄 · 판매 안내 첫 칸 · 오삼 FAQ 가 같은 말
  it("어디서 사 오나 — 골든챔스 · 체육관 도매가를 세 곳이 같이 말한다", () => {
    const first = marketGuide(14)[0];
    const faq = readFileSync("src/data/osamiFaq.ts", "utf8");
    const faqMarket = faq.slice(faq.indexOf('e("mb-market"'), faq.indexOf('e("dt-what"'));
    for (const text of [MARKET_SOURCE.line, first.body, faqMarket]) {
      expect(text).toContain("골든챔스");
      expect(text).toContain("체육관 도매가");
    }
    expect(first.title).toBe("어디서 사 오나요?");
    // 화면 맨 위 줄은 한 줄짜리 — 짧게 · 근거 없는 말(인터넷보다 싸다 · 정품 보장) 없이
    expect(MARKET_SOURCE.line.length).toBeLessThanOrEqual(22);
    expect(MARKET_SOURCE.sub.length).toBeLessThanOrEqual(16);
    for (const banned of ["최저가", "보장", "정품", "무조건", "—"]) {
      expect(`${MARKET_SOURCE.line} ${MARKET_SOURCE.sub} ${first.body}`, banned).not.toContain(banned);
    }
  });

  it("근거 없이 쓰면 안 되는 말이 없다", () => {
    const words = [
      ...marketGuide(14).flatMap((g) => [g.title, g.body]),
      ...Object.values(ORDER_STATUS_LABEL),
      ...(["applied", "paid", "ordered", "arrived", "delivered", "canceled"] as const).map((s) => orderMemberLine(order("a", s))),
      compareShort(compareOf(product(), TODAY, 14)!),
      compareLong(compareOf(product(), TODAY, 14)!),
    ].join(" ");
    for (const banned of ["최저가 보장", "무조건", "국내 최저", "업계 최저", "100%", "노쇼"]) expect(words, banned).not.toContain(banned);
  });
});

describe("153 마켓 — 예시 화면 (서버를 부르지 않는다)", () => {
  it("회원 예시에는 도매가 · 운영 칸이 없고, 비교는 회원가보다 높을 때만 보인다", () => {
    const home = buildMarketHomeSample(TODAY);
    expect(home.on).toBe(true);
    expect(home.products.length).toBeGreaterThan(5);
    for (const p of home.products) {
      expect("cost" in p, p.name).toBe(false);
      expect("active" in p, p.name).toBe(false);
      const c = compareOf(p, home.today, home.staleDays);
      if (c) expect(c.price, p.name).toBeGreaterThan(p.price);
    }
    expect(headlineOrder(home.orders)?.status).toBe("arrived");
  });

  it("주문 → 취소 (서버와 같은 순서 · 같은 말)", () => {
    const home = buildMarketHomeSample(TODAY);
    const glove = home.products.find((p) => p.options.length > 0 && !p.soldOut)!;
    const noOption = applyMarketHomeDemo(home, { type: "place", productId: glove.id, option: null, qty: 1, note: "" });
    expect(noOption).toMatchObject({ ok: false, message: `${glove.optionLabel}을(를) 골라 주세요` });
    const soldOut = home.products.find((p) => p.soldOut)!;
    expect(applyMarketHomeDemo(home, { type: "place", productId: soldOut.id, option: soldOut.options[0], qty: 1, note: "" }).message).toBe("지금은 품절이에요");
    expect(applyMarketHomeDemo(home, { type: "place", productId: "없는", option: null, qty: 1, note: "" }).message).toBe("지금은 주문할 수 없는 상품이에요");

    const placed = applyMarketHomeDemo(home, { type: "place", productId: glove.id, option: glove.options[0], qty: 2, note: " 금요일  저녁 " });
    expect(placed.ok).toBe(true);
    expect(placed.order).toMatchObject({ status: "applied", qty: 2, amount: glove.price * 2, note: "금요일 저녁", option: glove.options[0] });
    expect(placed.order!.orderNo).toMatch(/^M261117-[0-9A-F]{4}$/);
    expect(placed.next.orders).toHaveLength(home.orders.length + 1);

    const canceled = applyMarketHomeDemo(placed.next, { type: "cancel", id: placed.order!.id });
    expect(canceled.order).toMatchObject({ status: "canceled", cancelReason: "회원 취소" });
    const arrived = home.orders[0];
    expect(applyMarketHomeDemo(home, { type: "cancel", id: arrived.id })).toMatchObject({ ok: false, message: "결제한 주문은 데스크에서 취소해 주세요" });
  });

  it("진행 중인 주문이 한도에 차면 더 못 넣는다", () => {
    let home = { ...buildMarketHomeSample(TODAY), maxOpen: 2 };
    const p = home.products.find((x) => x.options.length === 0 && !x.soldOut)!;
    const first = applyMarketHomeDemo(home, { type: "place", productId: p.id, option: null, qty: 1, note: "" });
    expect(first.ok).toBe(true);
    home = first.next;
    expect(applyMarketHomeDemo(home, { type: "place", productId: p.id, option: null, qty: 1, note: "" }).message).toBe(
      "진행 중인 주문이 2건이에요. 받은 뒤에 다시 주문해 주세요",
    );
  });

  it("운영진 예시 — 단계마다 주문이 있고, 누르면 다음 단계로", () => {
    const board = buildMarketBoardSample(TODAY);
    expect(board.boss).toBe(true);
    expect(board.products.every((p) => typeof p.cost === "number" && p.active === true)).toBe(true);
    expect(boardGroups(board.orders).map((g) => g.key)).toEqual(["arrived", "applied", "paid", "ordered", "closed"]);
    expect(buildMarketBoardSample(TODAY, false).products.every((p) => !("cost" in p))).toBe(true);

    const applied = board.orders.find((o) => o.status === "applied")!;
    const paid = applyMarketBoardDemo(board, { type: "order", id: applied.id, status: "paid" });
    expect(paid.order).toMatchObject({ status: "paid" });
    expect(paid.order!.paidAt).toBeTruthy();
    expect(applyMarketBoardDemo(board, { type: "order", id: applied.id, status: "arrived" })).toMatchObject({
      ok: false,
      message: "지금 상태에서는 그렇게 바꿀 수 없어요",
    });
    const refund = applyMarketBoardDemo(paid.next, { type: "order", id: applied.id, status: "canceled" });
    expect(refund.order).toMatchObject({ status: "canceled", cancelReason: "취소 · 환불" });
    const plainCancel = applyMarketBoardDemo(board, { type: "order", id: applied.id, status: "canceled", reason: " 품절 " });
    expect(plainCancel.order).toMatchObject({ status: "canceled", cancelReason: "품절" });
    const memo = applyMarketBoardDemo(board, { type: "order", id: applied.id, memo: " 금요일 결제 " });
    expect(memo.order).toMatchObject({ status: "applied", staffMemo: "금요일 결제" });
  });

  it("상품 넣기 · 고치기", () => {
    const board = buildMarketBoardSample(TODAY);
    const added = applyMarketBoardDemo(board, {
      type: "product",
      draft: { ...emptyProductDraft(TODAY), name: "새 글러브", price: "45000", cost: "38000", sort: "5", active: true },
    });
    expect(added.ok).toBe(true);
    expect(added.next.products).toHaveLength(board.products.length + 1);
    expect(added.next.products[0]).toMatchObject({ name: "새 글러브", price: 45_000, cost: 38_000, active: true });
    const first = board.products[0];
    const edited = applyMarketBoardDemo(board, { type: "product", draft: { ...draftOfProduct(first, TODAY), price: "1000", soldOut: true } });
    expect(edited.next.products.find((p) => p.id === first.id)).toMatchObject({ price: 1000, soldOut: true });
    expect(edited.next.products).toHaveLength(board.products.length);
  });
});

describe("153 마켓 — 전체 메뉴 · 검색 (우리 지점 마켓이 켜져 있을 때만)", () => {
  const member: MenuViewer = { diet: false, staff: false, office: false, dm: true, manager: false, admin: false };

  it("꺼져 있으면 메뉴에 없다 — 켜지면 수강권 바로 다음 칸", () => {
    expect(flatAppMenu({ diet: false }).map((m) => m.path)).not.toContain("/market");
    const paths = buildAppMenu({ diet: false, market: true }).map((e) => (isMenuFolder(e) ? e.folder : e.path));
    expect(paths[paths.indexOf("/membership") + 1]).toBe("/market");
    expect(canSee("market", member)).toBe(false);
    expect(canSee("market", { ...member, market: true })).toBe(true);
    const ids = (v: MenuViewer) => buildMenuView(resolveEntries(null), v).map((e) => e.id);
    expect(ids(member)).not.toContain("/market");
    expect(ids({ ...member, market: true })).toContain("/market");
  });

  it("바로가기 목록 — 주문함은 관리자 화면에 들어가는 분만", () => {
    const { map } = menuCatalog();
    expect(map.get("/market")).toMatchObject({ label: "153 마켓", requires: "market", source: "menu" });
    expect(map.get("/manager?tab=market")).toMatchObject({ requires: "manager" });
    expect(map.get("/market?orders=1")).toMatchObject({ requires: "market" });
  });

  it("검색 — 마켓이 꺼진 지점 회원에게는 안 나온다", () => {
    const market = FEATURES.filter((e) => e.id.startsWith("f:market"));
    expect(market.map((e) => e.id)).toEqual(["f:market", "f:market-orders", "f:market-admin"]);
    const off = { staff: false, diet: false, dm: true };
    expect(market.filter((e) => visibleFor(e, off))).toEqual([]);
    expect(market.filter((e) => visibleFor(e, { ...off, market: true })).map((e) => e.id)).toEqual(["f:market", "f:market-orders"]);
    expect(market.filter((e) => visibleFor(e, { ...off, staff: true, market: true }))).toHaveLength(3);
    expect(market.filter((e) => visibleFor(e, { ...off, staff: true }))).toEqual([]);
  });
});
