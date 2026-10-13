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
// 정상 1개월 이용요금 = 선릉역점 1개월권 실판매가(무제한·주5회 220,000원). 상품 정상가 미상 시 기준.
// 경영리포트 환불계산기(REGULAR_MONTHLY_PRICES)·회원 이용계약서 제2조와 같은 값 — 바꾸면 함께.
export const NORMAL_MONTHLY_DEFAULT = 220000;

export interface RefundBreakdown {
  paid: number; // 결제(할인)금액
  normalDailyRate: number; // 정상 일요금
  elapsedDays: number; // 이용일수
  usedNormal: number; // 정상가 기준 이용분 차감
  penalty: number; // 위약금
  refund: number; // 최종 환불액
  loss: number; // 손해액 = 결제금액 − 환불액
}

// 정상 일요금 = 1개월 정상가 ÷ 30. 상품 정상가(기간 전체)가 있으면 개월수로 나눠 1개월 정상가를 구한다
// (365일 1년권도 12개월로 나눠 경영리포트·계약서와 같은 1일 금액이 되게). 없으면 월 기준 상수.
export function normalDailyRate(normalPrice: number | null | undefined, durationDays: number): number {
  if (normalPrice && normalPrice > 0 && durationDays > 0) {
    const months = Math.max(1, Math.round(durationDays / 30));
    return normalPrice / months / 30;
  }
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
