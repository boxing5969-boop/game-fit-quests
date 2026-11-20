/**
 * 🛒 앱 결제 장바구니 — 수강권 + 운동복 + 락카를 결제선생 링크 1개로 (2026-10-26 대표님 보고서, 10/27 "나머진 니추천대로")
 *
 *   · 수강권을 고르면 운동복 · 락카를 같이 쓸지 묻는다. 담으면 수강권과 같은 개월로 들어가고 줄일 수 있다(1개월까지).
 *   · 수강권 없이 락카 · 운동복만 연장하는 결제도 된다(1~12개월).
 *   · 가격 = 렌탈 상품(운동복 (1개월) · 개인 락카 (1개월)) 한 달 가격 × 개월 — 무료 없음.
 *   · 마일리지는 수강권 금액의 10%까지 — 수강권이 없으면 합계의 10%까지.
 *   · 남아 있는 기간이 있으면 그 뒤로 이어 붙인다.
 *   · 수강권은 시작일을 고를 수 있다 (2026-11-20 — 아래 「시작일 고르기」). 끝나는 날 = 시작일 + N개월 − 1일.
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

/**
 * 지난번에 고른 운동복 · 락카 기억 (2026-10-27 대표님: "링크를 한번 만들었다가 취소하고 다시 결제하려고 하니까 운동복 락카 선택이 꺼졌어")
 *   0 = 안 씀 · -1 = 수강권과 같은 개월 · n = n개월. 다른 수강권을 열면 그 수강권 개월에 맞춰 줄인다.
 */
export const rememberRental = (months: number, maxMonths: number): number =>
  months <= 0 ? 0 : months >= maxMonths ? -1 : Math.floor(months);
export const recallRental = (memory: number | null | undefined, maxMonths: number): number =>
  !memory ? 0 : memory < 0 ? maxMonths : Math.min(Math.floor(memory), maxMonths);

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

/** 'YYYY-MM-DD' 로 시작하는 진짜 날짜면 그 10글자, 아니면 null (2026-02-30 같은 날도 null) */
export const validYmd = (s: string | null | undefined): string | null => {
  const d = typeof s === "string" ? s.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = ymdToUtc(d);
  return Number.isFinite(t) && ymd(t) === d ? d : null;
};

export const addDays = (d: string, n: number): string => ymd(ymdToUtc(d) + n * DAY);

/** 날짜 + N개월 — Postgres `date + interval 'N months'` 와 같다 (없는 날은 그 달 마지막 날: 1/31 + 1개월 = 2/28) */
export function addMonths(d: string, months: number): string {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  const total = y * 12 + (m - 1) + Math.trunc(months);
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // 0 = 1월
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

// ── 시작일 고르기 (2026-11-20 대표님: "회원님들이 수강권 결제할때 시작일을 지정할수있게하자.
//    미리등록하려는분들도있고 신규인데 다음주부터 하고싶은 사람도 있으니까") ──
//   · 기본 시작일 = 이어서 — 지금 것이 오늘까지라도 남아 있으면 끝난 다음 날, 없거나 끝났으면 오늘.
//   · 고를 수 있는 날 = 기본 시작일부터 START_AHEAD_DAYS(30)일 안 — 남은 기간과 겹치게는 못 고른다.
//   · 끝나는 날 = 시작일 + N개월 − 1일 — 브로제이(데스크 · 출입문)와 같은 식 (11/27 시작 1개월 → 12/26까지).
//     153OS 이용권도 같은 날로 옮긴다(payssam-callback → 153OS app_set_paid_membership_start) — 앱 · 데스크 · 153OS 가 같은 날.
//   · 같이 산 운동복 · 락카도 고른 날부터 (자기 남은 기간이 더 길면 그 뒤로). 기본 시작일이면 예전처럼 자기 남은 기간 뒤로.
//   서버(payssam-create-bill 검사 · DB apply_payment_order · _pass_period)와 같은 식 — 바꾸면 세 곳을 같이.
export const START_AHEAD_DAYS = 30;

/** 기본 시작일 — 지금 것이 오늘까지라도 남아 있으면 끝난 다음 날, 없거나 끝났으면 오늘 (DB _pass_period 와 같은 식) */
export function continueFrom(currentEnd: string | null | undefined, today: string): string {
  const cur = validYmd(currentEnd);
  return cur && cur >= today ? addDays(cur, 1) : today;
}

export interface StartBounds {
  /** 기본 시작일 = 고를 수 있는 첫날 */
  min: string;
  /** 고를 수 있는 마지막 날 (기본 시작일 + 30일) */
  max: string;
  /** 지금 이용 중인 수강권이 끝나는 날 (없거나 끝났으면 null) */
  currentEnd: string | null;
}

export function startBounds(currentEnd: string | null | undefined, today: string): StartBounds {
  const cur = validYmd(currentEnd);
  const min = continueFrom(cur, today);
  return { min, max: addDays(min, START_AHEAD_DAYS), currentEnd: cur && cur >= today ? cur : null };
}

/** 고를 수 있는 날 목록 (기본 시작일부터 31일) */
export function startDays(b: StartBounds): string[] {
  const out: string[] = [];
  for (let d = b.min; d <= b.max; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 서버에 보낼 시작일 — 기본 시작일이면 null (결제할 때 다시 셈), 범위 밖이면 null */
export function requestedStart(picked: string | null | undefined, b: StartBounds): string | null {
  const d = validYmd(picked);
  return d && d > b.min && d <= b.max ? d : null;
}

/** 개월로 세는 항목인가 — 개월이 있고 28일 이상 (2주권 같은 날 단위 상품은 일수로 센다) · DB _pass_period 와 같은 기준 */
export const isMonthBased = (months: number, days: number): boolean => months > 0 && days >= 28;

/**
 * 결제하면 이 항목의 이용 기간 — DB apply_payment_order(_pass_period)와 같은 식.
 *   start = 기본 시작일과 고른 날 중 늦은 날 · end = start + N개월 − 1일 (날 단위 상품은 start + 일수 − 1일)
 */
export function itemPeriod(p: {
  currentEnd: string | null | undefined;
  today: string;
  months: number;
  days: number;
  start?: string | null;
}): { start: string; end: string } {
  const cont = continueFrom(p.currentEnd, p.today);
  const req = validYmd(p.start);
  const start = req && req > cont ? req : cont;
  const months = Math.trunc(p.months || 0);
  const days = Math.floor(p.days || 0);
  const end = isMonthBased(months, days) ? addDays(addMonths(start, months), -1) : addDays(start, Math.max(1, days) - 1);
  return { start, end };
}

const WEEK = "일월화수목금토";
/** 요일 한 글자 ("2026-11-27" → "목") */
export const weekdayOf = (d: string): string => WEEK.charAt(new Date(ymdToUtc(d)).getUTCDay());

/** "2026-11-27" → "11월 27일(금)" · 올해가 아니면 "2027년 1월 2일(토)" */
export function dayText(d: string, today: string): string {
  return `${endText(d, today)}(${weekdayOf(d)})`;
}

/** 시작일 고르기 아래 회색 한 줄 (고른 날 · 지금 수강권) */
export function startHint(b: StartBounds, picked: string, today: string): string {
  if (b.currentEnd) {
    if (picked <= b.min) return "지금 수강권이 끝나면 다음 날부터 이어져요";
    const gap = Math.round((ymdToUtc(picked) - ymdToUtc(b.min)) / DAY);
    return `지금 수강권은 ${endText(b.currentEnd, today)}까지라 사이 ${gap}일은 비어요`;
  }
  return picked <= today ? "결제하면 오늘부터 바로 다닐 수 있어요" : "기간은 고른 날부터 세요";
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
