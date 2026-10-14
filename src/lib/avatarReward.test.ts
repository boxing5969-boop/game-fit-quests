import { describe, expect, it } from "vitest";
import {
  claimSettles,
  parseAvatarRewardClaim,
  parseAvatarRewardState,
  rewardDoneKey,
  rewardHint,
  rewardSettled,
  rewardText,
  shouldAutoClaim,
  type AvatarRewardState,
} from "./avatarReward";

const st = (over: Partial<AvatarRewardState> = {}): AvatarRewardState => ({
  amount: 5000, eligible: true, claimed: false, hasPhoto: false, open: true, ...over,
});

describe("avatarReward", () => {
  it("서버 응답 읽기 — 모양이 틀리면 null · 빠진 값은 안전하게", () => {
    expect(parseAvatarRewardState(null)).toBeNull();
    expect(parseAvatarRewardState({ amount: 5000, eligible: true, claimed: false, hasPhoto: true, open: true })).toEqual(st({ hasPhoto: true }));
    expect(parseAvatarRewardState({ amount: 0, eligible: true, claimed: false, hasPhoto: true, open: false })).toEqual(st({ amount: 0, hasPhoto: true, open: false }));
    expect(parseAvatarRewardState({})).toEqual({ amount: 0, eligible: false, claimed: false, hasPhoto: false, open: true });
    expect(parseAvatarRewardClaim({ granted: false, reason: "not_open", amount: 0 })).toEqual({ granted: false, reason: "not_open", amount: 0 });
    expect(parseAvatarRewardClaim({ granted: true, reason: "granted", amount: 5000 })).toEqual({ granted: true, reason: "granted", amount: 5000 });
    expect(parseAvatarRewardClaim({ granted: true, reason: "weird" })).toBeNull();
    expect(parseAvatarRewardClaim(undefined)).toBeNull();
  });

  it("금색 알약 — 사진 없고 · 대상이고 · 안 받았을 때만", () => {
    expect(rewardHint(st(), false)).toBe("+5,000");
    expect(rewardHint(st(), true)).toBeNull(); // 이미 사진 있음
    expect(rewardHint(st({ claimed: true }), false)).toBeNull();
    expect(rewardHint(st({ eligible: false }), false)).toBeNull(); // 지도진·관리 계정
    expect(rewardHint(st({ amount: 0 }), false)).toBeNull();
    expect(rewardHint(null, false)).toBeNull();
    expect(rewardHint(st({ open: false }), false)).toBeNull(); // 아직 안 열린 지점 (잠실·역삼)
    expect(rewardHint(st({ open: false, amount: 0 }), false)).toBeNull();
  });

  it("자동 받기 — 이 기능 전에 사진을 올려 둔 회원만", () => {
    expect(shouldAutoClaim(st({ hasPhoto: true }), true)).toBe(true);
    expect(shouldAutoClaim(st({ hasPhoto: false }), true)).toBe(false); // 서버가 사진을 못 찾음
    expect(shouldAutoClaim(st({ hasPhoto: true, claimed: true }), true)).toBe(false);
    expect(shouldAutoClaim(st({ hasPhoto: true, eligible: false }), true)).toBe(false);
    expect(shouldAutoClaim(st({ hasPhoto: true }), false)).toBe(false);
    expect(shouldAutoClaim(undefined, true)).toBe(false);
    expect(shouldAutoClaim(st({ hasPhoto: true, open: false }), true)).toBe(false);
  });

  it("끝난 상태 · 문구 · 기억 키", () => {
    expect(rewardSettled(st({ claimed: true }))).toBe(true);
    expect(rewardSettled(st({ eligible: false }))).toBe(true);
    expect(rewardSettled(st())).toBe(false);
    expect(rewardSettled(st({ open: false, amount: 0 }))).toBe(false); // 지점이 열리면 받아야 하니 끝난 게 아니다
    expect(claimSettles({ granted: true, reason: "granted", amount: 5000 })).toBe(true);
    expect(claimSettles({ granted: false, reason: "already", amount: 5000 })).toBe(true);
    expect(claimSettles({ granted: false, reason: "not_eligible", amount: 0 })).toBe(true);
    expect(claimSettles({ granted: false, reason: "no_photo", amount: 5000 })).toBe(false);
    expect(claimSettles({ granted: false, reason: "not_open", amount: 0 })).toBe(false);
    expect(claimSettles(null)).toBe(false);
    expect(rewardText(5000)).toBe("챔피언 머니 +5,000");
    expect(rewardDoneKey("u1")).toBe("153photo:reward-done:u1");
    for (const bad of ["벨트", "계급", "무조건", "확정 혜택", "파이트 머니"]) expect(rewardText(5000)).not.toContain(bad);
  });
});
