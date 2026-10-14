import { describe, expect, it } from "vitest";
import {
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
  amount: 5000, eligible: true, claimed: false, hasPhoto: false, ...over,
});

describe("avatarReward", () => {
  it("서버 응답 읽기 — 모양이 틀리면 null · 빠진 값은 안전하게", () => {
    expect(parseAvatarRewardState(null)).toBeNull();
    expect(parseAvatarRewardState({ amount: 5000, eligible: true, claimed: false, hasPhoto: true })).toEqual(st({ hasPhoto: true }));
    expect(parseAvatarRewardState({})).toEqual({ amount: 0, eligible: false, claimed: false, hasPhoto: false });
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
  });

  it("자동 받기 — 이 기능 전에 사진을 올려 둔 회원만", () => {
    expect(shouldAutoClaim(st({ hasPhoto: true }), true)).toBe(true);
    expect(shouldAutoClaim(st({ hasPhoto: false }), true)).toBe(false); // 서버가 사진을 못 찾음
    expect(shouldAutoClaim(st({ hasPhoto: true, claimed: true }), true)).toBe(false);
    expect(shouldAutoClaim(st({ hasPhoto: true, eligible: false }), true)).toBe(false);
    expect(shouldAutoClaim(st({ hasPhoto: true }), false)).toBe(false);
    expect(shouldAutoClaim(undefined, true)).toBe(false);
  });

  it("끝난 상태 · 문구 · 기억 키", () => {
    expect(rewardSettled(st({ claimed: true }))).toBe(true);
    expect(rewardSettled(st({ eligible: false }))).toBe(true);
    expect(rewardSettled(st())).toBe(false);
    expect(rewardText(5000)).toBe("챔피언 머니 +5,000");
    expect(rewardDoneKey("u1")).toBe("153photo:reward-done:u1");
    for (const bad of ["벨트", "계급", "무조건", "확정 혜택", "파이트 머니"]) expect(rewardText(5000)).not.toContain(bad);
  });
});
