/**
 * 🪙 153 마일리지 결제 할인 — 앱 결제 확인 창의 계산 (2026-10-15 대표님 확정 규칙)
 *   1점 = 1원 · 한 번 결제에 결제 금액의 10%까지 · 1,000점 단위
 *
 *   서버가 정본이다: payssam-create-bill 이 DB mileage_max_use(보유 · 금액 10% · 1,000 단위)로 다시 검사하고,
 *   실제 차감은 결제가 끝날 때 트리거(payment_orders_mileage)가 한다. 여기 식은 그 식과 똑같이 맞춘다.
 *   (금액 10% 는 소수 곱셈 대신 정수 나눗셈으로 — 220000 * 0.1 같은 부동소수 오차로 1,000점이 덜 나오지 않게)
 *
 * 2026-10-21 대표님: "수강권 탭에서 결제하기 눌러도 마일리지 입력 탭이 없는데" →
 *   마일리지 칸을 항상 보여 주고(못 쓰면 이유를), 점수를 직접 넣을 수 있게, PT · 용품 결제에도.
 */

/** 마일리지는 이 단위로만 쓴다 */
export const MILEAGE_UNIT = 1000;

const toNonNegInt = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** 이번 결제에 쓸 수 있는 최대 점수 = min(보유, 결제 금액의 10%) 를 1,000 단위로 내림 — 서버 mileage_max_use 와 같은 식 */
export const maxMileageUse = (balance: number, price: number): number => {
  const byBalance = Math.floor(toNonNegInt(balance) / MILEAGE_UNIT) * MILEAGE_UNIT;
  const byPrice = Math.floor(toNonNegInt(price) / (MILEAGE_UNIT * 10)) * MILEAGE_UNIT; // = floor(price × 10% / 1,000) × 1,000
  return Math.max(0, Math.min(byBalance, byPrice));
};

/** 입력한 점수 → 실제로 쓸 점수 (1,000 단위로 내리고 0 ~ 최대 사이로) */
export const clampMileageUse = (input: number, max: number): number => {
  const cap = Math.floor(toNonNegInt(max) / MILEAGE_UNIT) * MILEAGE_UNIT;
  const v = Math.floor(toNonNegInt(input) / MILEAGE_UNIT) * MILEAGE_UNIT;
  return Math.min(v, cap);
};

/** 입력칸 글자 → 점수 (숫자만, 최대값을 넘으면 최대값) — 쓰는 도중엔 1,000 단위로 자르지 않는다 */
export const parseMileageInput = (raw: string, max: number): number => {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 9);
  const n = digits ? Number(digits) : 0;
  return Math.min(n, toNonNegInt(max));
};

/** 이번 결제에 마일리지를 못 쓰는 이유 — 쓸 수 있으면 null */
export type MileageBlock = "staff" | "low_balance" | "low_price";

export function mileageBlockReason(p: { balance: number; price: number; isStaff: boolean }): MileageBlock | null {
  if (maxMileageUse(p.balance, p.price) > 0) return null;
  if (toNonNegInt(p.balance) < MILEAGE_UNIT) return p.isStaff ? "staff" : "low_balance";
  return "low_price";
}

/** 못 쓰는 이유 안내 문구 */
export const MILEAGE_BLOCK_TEXT: Record<MileageBlock, string> = {
  staff: "지도진·관리자 계정은 마일리지가 쌓이지 않아요. 회원 계정에서는 여기에 점수를 넣어 할인받아요.",
  low_balance: "1,000점부터 쓸 수 있어요. 출석 · 레벨업 · 타이틀매치로 쌓여요.",
  low_price: "1만 원 이상 결제부터 쓸 수 있어요 (결제 금액의 10%까지).",
};
