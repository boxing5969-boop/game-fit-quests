/**
 * 🧥 153 굿즈 사전예약 — 첫 상품 「153 플리스 집업」 (2026-11-12 대표님 「디자인 마무리 하고 모델에 입혀서 상세페이지 처럼 만들어줘
 *   마이복서에 올려서 회원님들에게 판매신청받고 … 유효 회원님들에게 전체 문자 보내서 판매하게 상세페이지 링크 만들어줘」)
 *
 *   · 상세페이지 = 정적 HTML `public/goods/fleece/index.html` (주소 /goods/fleece — 문자 · 카카오 링크 미리보기, 로그인 없이도 신청)
 *   · 홈 안내 카드 = components/goods/GoodsNudgeCard (열려 있는 동안 · 아직 신청 전이거나 결제 전일 때)
 *   · 운영진 = components/admin/GoodsOrdersPanel (전체관리자 대시보드 '굿즈' 탭 · 지점장/코치 홈 '굿즈 신청' 카드)
 *   · 서버 = supabase/migrations/20261112202433_goods_preorder.sql (goods_campaigns · goods_orders, 함수로만)
 *
 * 이 파일은 화면 계산만 한다(서버 호출 없음) — 상태 이름 · 다음 단계 단추 · 색×사이즈 집계 · 업체 발주 문구 · 마감 날짜.
 */

export const GOODS_FLEECE_SLUG = "fleece-2026";
/** 상세페이지(정적 HTML) — 앱 안 라우터가 아니라 주소로 연다 */
export const GOODS_FLEECE_PATH = "/goods/fleece";
export const GOODS_FLEECE_URL = "https://myboxer153.com/goods/fleece";

export type GoodsStatus = "applied" | "paid" | "delivered" | "canceled";

export const GOODS_STATUS_LABEL: Record<GoodsStatus, string> = {
  applied: "결제 전",
  paid: "결제 완료",
  delivered: "받음",
  canceled: "취소",
};

export interface GoodsColor {
  key: string;
  label: string;
}

export interface GoodsCampaign {
  ok: boolean;
  slug: string;
  title: string;
  price: number;
  colors: GoodsColor[];
  sizes: string[];
  max_qty: number;
  opens_at: string;
  closes_at: string;
  open: boolean;
  branches: string[];
  now?: string;
}

export interface GoodsOrder {
  id: string;
  order_no: string;
  color: string;
  size: string;
  qty: number;
  unit_price: number;
  amount: number;
  status: GoodsStatus;
  branch_name: string;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  can_cancel: boolean;
  // 운영진 목록에만
  name?: string;
  phone?: string;
  source?: "app" | "link";
  member_match?: "login" | "phone" | "none";
  user_id?: string | null;
  staff_memo?: string | null;
  cancel_reason?: string | null;
}

/** 서버에 닿지 않을 때(미리보기 주소 · 마이그레이션 적용 전) 쓰는 기본값 — DB 첫 줄과 같게 */
export const FLEECE_FALLBACK: GoodsCampaign = {
  ok: true,
  slug: GOODS_FLEECE_SLUG,
  title: "153 플리스 집업",
  price: 39000,
  colors: [
    { key: "white", label: "흰색 인쇄" },
    { key: "gray", label: "진회색 인쇄" },
  ],
  sizes: ["M", "L", "XL", "2XL"],
  max_qty: 3,
  opens_at: "2026-11-12T00:00:00+09:00",
  closes_at: "2026-11-26T23:59:59+09:00",
  open: true,
  branches: ["153복싱짐 선릉역점", "153복싱짐 역삼점", "153복싱짐 잠실점", "153복싱짐 칠금점"],
};

export const won = (n: number): string => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;

export const shortBranch = (b: string | null | undefined): string =>
  (b || "").replace(/^153복싱짐\s*/, "").trim() || "지점";

export const colorLabel = (c: Pick<GoodsCampaign, "colors"> | null | undefined, key: string): string =>
  c?.colors.find((x) => x.key === key)?.label ?? key;

/** 01012345678 → 010-1234-5678 */
export function formatPhone(v: string | null | undefined): string {
  const d = (v || "").replace(/[^0-9]/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

const KST_MS = 9 * 3600 * 1000;
const kstParts = (t: string | number | Date) => {
  const k = new Date(new Date(t).getTime() + KST_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), w: k.getUTCDay() };
};

/** '11월 26일(목)' (한국 날짜) */
export function deadlineLabel(closesAt: string): string {
  const k = kstParts(closesAt);
  return `${k.m + 1}월 ${k.d}일(${"일월화수목금토".charAt(k.w)})`;
}

/** 마감까지 남은 날(한국 날짜 기준) — 마감 날이면 0, 지났으면 음수 */
export function daysLeft(closesAt: string, now: Date | number = Date.now()): number {
  const a = kstParts(now);
  const b = kstParts(closesAt);
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400000);
}

/** 'D-3' · '오늘 마감' · '마감' */
export function ddayLabel(c: Pick<GoodsCampaign, "open" | "closes_at">, now: Date | number = Date.now()): string {
  const t = typeof now === "number" ? now : now.getTime();
  if (!c.open || new Date(c.closes_at).getTime() <= t) return "마감";
  const left = daysLeft(c.closes_at, now);
  return left <= 0 ? "오늘 마감" : `D-${left}`;
}

/** 운영진 단추 — 서버 goods_admin_update 의 허용 변화와 같아야 한다 */
export function nextActions(status: GoodsStatus): { to: GoodsStatus; label: string; tone: "primary" | "plain" | "danger" }[] {
  switch (status) {
    case "applied":
      return [
        { to: "paid", label: "결제 완료", tone: "primary" },
        { to: "canceled", label: "취소", tone: "danger" },
      ];
    case "paid":
      return [
        { to: "delivered", label: "받음", tone: "primary" },
        { to: "applied", label: "결제 되돌리기", tone: "plain" },
        { to: "canceled", label: "취소", tone: "danger" },
      ];
    case "delivered":
      return [{ to: "paid", label: "받음 되돌리기", tone: "plain" }];
    case "canceled":
      return [{ to: "applied", label: "다시 살리기", tone: "plain" }];
  }
}

export type GoodsBasis = "paid" | "all";
/** 결제 기준 = 결제 완료 + 받음, 신청 포함 = 결제 전까지 */
export const basisStatuses = (basis: GoodsBasis): GoodsStatus[] =>
  basis === "paid" ? ["paid", "delivered"] : ["applied", "paid", "delivered"];

export interface GoodsSummary {
  /** 색 → 사이즈 → 벌 수 */
  matrix: Record<string, Record<string, number>>;
  colorTotals: Record<string, number>;
  sizeTotals: Record<string, number>;
  pieces: number;
  orders: number;
  amount: number;
  byStatus: Record<GoodsStatus, { orders: number; pieces: number; amount: number }>;
}

export function summarize(orders: GoodsOrder[], c: Pick<GoodsCampaign, "colors" | "sizes">, basis: GoodsBasis): GoodsSummary {
  const use = new Set(basisStatuses(basis));
  const matrix: Record<string, Record<string, number>> = {};
  const colorTotals: Record<string, number> = {};
  const sizeTotals: Record<string, number> = {};
  const colorKeys = [...c.colors.map((x) => x.key)];
  const sizeKeys = [...c.sizes];
  for (const o of orders) {
    if (!colorKeys.includes(o.color)) colorKeys.push(o.color);
    if (!sizeKeys.includes(o.size)) sizeKeys.push(o.size);
  }
  for (const ck of colorKeys) {
    matrix[ck] = {};
    colorTotals[ck] = 0;
    for (const sk of sizeKeys) matrix[ck][sk] = 0;
  }
  for (const sk of sizeKeys) sizeTotals[sk] = 0;
  const byStatus: GoodsSummary["byStatus"] = {
    applied: { orders: 0, pieces: 0, amount: 0 },
    paid: { orders: 0, pieces: 0, amount: 0 },
    delivered: { orders: 0, pieces: 0, amount: 0 },
    canceled: { orders: 0, pieces: 0, amount: 0 },
  };
  let pieces = 0;
  let count = 0;
  let amount = 0;
  for (const o of orders) {
    const b = byStatus[o.status];
    if (b) {
      b.orders += 1;
      b.pieces += o.qty;
      b.amount += o.amount;
    }
    if (!use.has(o.status)) continue;
    matrix[o.color][o.size] += o.qty;
    colorTotals[o.color] += o.qty;
    sizeTotals[o.size] += o.qty;
    pieces += o.qty;
    count += 1;
    amount += o.amount;
  }
  return { matrix, colorTotals, sizeTotals, pieces, orders: count, amount, byStatus };
}

/** 업체에 보낼 발주 문구 (카톡에 그대로 붙여 넣는 모양) */
export function supplierText(
  c: Pick<GoodsCampaign, "title" | "colors" | "sizes">,
  orders: GoodsOrder[],
  basis: GoodsBasis,
): string {
  const s = summarize(orders, c, basis);
  const lines: string[] = [`${c.title} 발주 (${basis === "paid" ? "결제 완료 기준" : "신청 포함"})`];
  for (const color of Object.keys(s.matrix)) {
    const total = s.colorTotals[color];
    if (!total) continue;
    const parts = Object.entries(s.matrix[color])
      .filter(([, n]) => n > 0)
      .map(([size, n]) => `${size} ${n}`);
    lines.push(`${colorLabel(c, color)}: ${parts.join(" · ")} (${total}벌)`);
  }
  lines.push(`합계 ${s.pieces}벌`);
  return lines.join("\n");
}

/** 운영진 목록 거르기 — 이름 · 휴대폰(숫자) · 신청 번호 */
export function matchesQuery(o: GoodsOrder, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/[^0-9]/g, "");
  return (
    (o.name || "").toLowerCase().includes(t) ||
    o.order_no.toLowerCase().includes(t) ||
    (digits.length >= 3 && (o.phone || "").includes(digits))
  );
}
