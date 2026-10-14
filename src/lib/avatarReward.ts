/**
 * 📸 프로필 사진 첫 등록 보상 — 챔피언 머니(예전 파이트 머니) (2026-10-14 대표님: "사진을 올리면 파이트머니 많이 보상하자").
 *
 * 정본은 DB — get_my_avatar_reward() · claim_avatar_photo_reward() · avatar_photo_reward() (금액).
 * 한 사람에 한 번, 진짜로 올린 사진(avatars/{내 id}/…)만, 지도진·관리 계정은 0.
 * 여기는 화면이 쓰는 순수 판정만 둔다 (테스트: avatarReward.test.ts).
 */

export interface AvatarRewardState {
  /** 보상 금액 (서버 값) */
  amount: number;
  /** 받을 수 있는 사람인가 — 지도진·관리 계정이면 false */
  eligible: boolean;
  /** 이미 받았나 */
  claimed: boolean;
  /** 서버가 확인한 내 사진이 있나 */
  hasPhoto: boolean;
}

export type ClaimReason = "granted" | "already" | "no_photo" | "not_eligible";

export interface AvatarRewardClaim {
  granted: boolean;
  reason: ClaimReason;
  amount: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function parseAvatarRewardState(raw: unknown): AvatarRewardState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    amount: num(r.amount),
    eligible: r.eligible === true,
    claimed: r.claimed === true,
    hasPhoto: r.hasPhoto === true,
  };
}

const REASONS: readonly ClaimReason[] = ["granted", "already", "no_photo", "not_eligible"];

export function parseAvatarRewardClaim(raw: unknown): AvatarRewardClaim | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reason = REASONS.find((x) => x === r.reason);
  if (!reason) return null;
  return { granted: r.granted === true, reason, amount: num(r.amount) };
}

/** 사진 위 금색 알약 — 아직 사진이 없고, 받을 수 있고, 안 받았을 때만 ("+5,000") */
export function rewardHint(state: AvatarRewardState | null | undefined, hasAvatarUrl: boolean): string | null {
  if (!state || hasAvatarUrl || !state.eligible || state.claimed || state.amount <= 0) return null;
  return `+${state.amount.toLocaleString("ko-KR")}`;
}

/** 이미 사진이 있는데 아직 못 받았으면 앱을 열 때 한 번 받는다 (이 기능 전에 올린 회원) */
export function shouldAutoClaim(state: AvatarRewardState | null | undefined, hasAvatarUrl: boolean): boolean {
  return !!state && hasAvatarUrl && state.eligible && !state.claimed && state.hasPhoto && state.amount > 0;
}

/** 다 끝났으면(받았거나 대상이 아님) 이 기기에서는 다시 묻지 않는다 */
export const rewardSettled = (state: AvatarRewardState | null | undefined): boolean =>
  !!state && (state.claimed || !state.eligible);

/** 이 기기 기억 키 — 사람마다 (다른 화면 캐시와 겹치지 않게 153photo:) */
export const rewardDoneKey = (userId: string) => `153photo:reward-done:${userId}`;

/** "챔피언 머니 +5,000" */
export const rewardText = (amount: number) => `챔피언 머니 +${Math.max(0, amount).toLocaleString("ko-KR")}`;
