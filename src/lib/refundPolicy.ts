// ─────────────────────────────────────────────────────────────
// 환불 정책 — 정상가 재산정(할인 회수) 방식.
// 할인받아 결제한 장기계약을 중도 해지하면, 이용한 기간을 '할인 전 정상가'로
// 재산정해 차감한다. → 조기 환불 시 할인 혜택이 사라져 회원에게 손해가 되는 구조
// (환불 억제). 최초 결제 화면과 환불 신청 화면에서 공통으로 사용한다.
//
// ⚠️ 소비자분쟁해결기준보다 회원에게 불리할 수 있어, 최초 결제 시 '중도해지=정상가
//    재산정'을 명시·동의받는 전제로 운용한다(약관·결제 전 확인 모달).
// ─────────────────────────────────────────────────────────────

export const PENALTY_RATE = 0.1; // 위약금 10%
export const NORMAL_MONTHLY_DEFAULT = 300000; // 정상 1개월 이용요금 기준(주5회 정상가). 상품 정상가 미상 시 기준.

export interface RefundBreakdown {
  paid: number; // 결제(할인)금액
  normalDailyRate: number; // 정상 일요금
  elapsedDays: number; // 이용일수
  usedNormal: number; // 정상가 기준 이용분 차감
  penalty: number; // 위약금
  refund: number; // 최종 환불액
  loss: number; // 손해액 = 결제금액 − 환불액
}

// 정상 일요금: 상품 정상가/기간 우선, 없으면 월 기준 상수.
export function normalDailyRate(normalPrice: number | null | undefined, durationDays: number): number {
  if (normalPrice && normalPrice > 0 && durationDays > 0) return normalPrice / durationDays;
  return NORMAL_MONTHLY_DEFAULT / 30;
}

// 정상가 재산정 환불: 결제액 − (정상 일요금 × 이용일수) − 위약금.
export function calcRefund(opts: {
  paid: number;
  normalDaily: number;
  elapsedDays: number;
  penaltyRate?: number;
}): RefundBreakdown {
  const paid = Math.max(0, Math.round(opts.paid || 0));
  const rate = opts.penaltyRate ?? PENALTY_RATE;
  const elapsed = Math.max(0, Math.round(opts.elapsedDays || 0));
  const usedNormal = Math.max(0, Math.round((opts.normalDaily || 0) * elapsed));
  const penalty = Math.round(paid * rate);
  const refund = Math.max(0, paid - usedNormal - penalty);
  return { paid, normalDailyRate: opts.normalDaily || 0, elapsedDays: elapsed, usedNormal, penalty, refund, loss: paid - refund };
}

// 결제 전 시뮬레이션용 시점(개월). 약정 기간 안에서만 노출.
export const SIM_MONTHS = [1, 3, 6] as const;

export const wonKR = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
