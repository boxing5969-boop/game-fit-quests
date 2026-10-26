/**
 * 🛒 앱 결제 장바구니 — 수강권 + 운동복 + 락카를 결제선생 링크 1개로 (2026-10-26 대표님 보고서, 10/27 "나머진 니추천대로")
 *
 *   · 수강권을 고르면 운동복 · 락카를 같이 쓸지 묻는다. 담으면 수강권과 같은 개월로 들어가고 줄일 수 있다(1개월까지).
 *   · 수강권 없이 락카 · 운동복만 연장하는 결제도 된다(1~12개월).
 *   · 가격 = 렌탈 상품(운동복 (1개월) · 개인 락카 (1개월)) 한 달 가격 × 개월 — 무료 없음.
 *   · 마일리지는 수강권 금액의 10%까지 — 수강권이 없으면 합계의 10%까지.
 *   · 남아 있는 기간이 있으면 그 뒤로 이어 붙인다.
 *
 *   서버(payssam-create-bill · DB apply_payment_order)가 정본이다 — 여기 식은 화면에 보여 줄 금액 · 날짜를 그 식과 똑같이 맞춘다.
 */

export type RentalKind = "sportswear" | "locker";

export const RENTAL_LABEL: Record<RentalKind, string> = { sportswear: "운동복", locker: "락카" };

/** 렌탈을 담을 수 있는 가장 긴 개월 (수강권 없이) */
export const MAX_RENTAL_MONTHS = 12;

/** 수강권 일수 → 개월 (30 → 1, 90 → 3, 150 → 5, 365 → 12) — 서버 membershipMonths 와 같은 식 */
export const membershipMonths = (days: number): number => (days >= 360 ? 12 : Math.max(1, Math.round(days / 30)));

/** 렌탈 개월 → 일수. 수강권과 같은 개월이면 수강권 일수를 그대로(끝나는 날이 같게) — 서버 rentalDays 와 같은 식 */
export const rentalDays = (months: number, membership?: { months: number; days: number } | null): number =>
  membership && membership.months === months ? membership.days : months === 12 ? 365 : months * 30;

/** 렌탈 상품 이름 → 종류 (운동복 (1개월) · 개인 락카 (1개월)) */
export const rentalKindOf = (name: string): RentalKind | null =>
  /운동복/.test(name) ? "sportswear" : /락카|락커/.test(name) ? "locker" : null;

export interface CartLine {
  kind: "membership" | RentalKind;
  label: string;
  months: number;
  amount: number;
  days: number;
}

export interface CartInput {
  membership?: { name: string; price: number; days: number } | null;
  sportswearMonths: number;
  lockerMonths: number;
  /** 렌탈 한 달 가격 */
  unitPrice: Record<RentalKind, number>;
}

/** 담은 것 → 결제 줄 (수강권 → 운동복 → 락카) */
export function cartLines(c: CartInput): CartLine[] {
  const lines: CartLine[] = [];
  const mem = c.membership ? { months: membershipMonths(c.membership.days), days: c.membership.days } : null;
  if (c.membership && mem) {
    lines.push({ kind: "membership", label: c.membership.name, months: mem.months, amount: c.membership.price, days: mem.days });
  }
  for (const kind of ["sportswear", "locker"] as const) {
    const months = Math.max(0, Math.floor(kind === "sportswear" ? c.sportswearMonths : c.lockerMonths));
    if (months <= 0) continue;
    lines.push({
      kind,
      label: `${RENTAL_LABEL[kind]} ${months}개월`,
      months,
      amount: (c.unitPrice[kind] || 0) * months,
      days: rentalDays(months, mem),
    });
  }
  return lines;
}

export const cartTotal = (lines: CartLine[]): number => lines.reduce((s, l) => s + l.amount, 0);

/** 마일리지 10% 기준 금액 — 수강권이 있으면 수강권 금액, 없으면 합계 */
export const mileageBase = (lines: CartLine[]): number => {
  const mem = lines.find((l) => l.kind === "membership");
  return mem ? mem.amount : cartTotal(lines);
};

/** 결제선생에 보낼 상품 이름 — 길면 "첫 항목 외 N건" (서버와 같은 식) */
export const cartOrderName = (lines: CartLine[], max = 40): string => {
  const labels = lines.map((l) => l.label);
  const all = labels.join(" + ");
  return all.length > max && labels.length > 1 ? `${labels[0]} 외 ${labels.length - 1}건` : all;
};

const DAY = 86400000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const ymdToUtc = (s: string) => Date.parse(`${s}T00:00:00Z`);

/** 결제 후 끝나는 날 — 남아 있으면 그 뒤로, 끝났으면 오늘부터 (DB apply_payment_order 와 같은 식) */
export function extendedEnd(currentEnd: string | null | undefined, days: number, today: string): string {
  const cur = currentEnd && /^\d{4}-\d{2}-\d{2}$/.test(currentEnd) ? currentEnd : null;
  const base = cur && cur > today ? cur : today;
  return ymd(ymdToUtc(base) + days * DAY);
}

/** 남은 날 (끝나는 날 포함, 오늘 끝나면 0) — 지났으면 음수 */
export function daysLeft(end: string | null | undefined, today: string): number | null {
  if (!end || !/^\d{4}-\d{2}-\d{2}/.test(end)) return null;
  return Math.round((ymdToUtc(end.slice(0, 10)) - ymdToUtc(today)) / DAY);
}

/** 날짜 글자 — "2026-11-25" → "11월 25일", 올해가 아니면 "2027년 1월 25일" */
export function endText(end: string, today: string): string {
  const [y, m, d] = end.slice(0, 10).split("-").map(Number);
  const ty = Number(today.slice(0, 4));
  return `${y !== ty ? `${y}년 ` : ""}${m}월 ${d}일`;
}
