import { describe, expect, it } from "vitest";
import { OFFLINE_PAY_BRANCHES, SIGNUP_BRANCHES, branchShortName, isOfflinePayBranch, offlinePayInfoFor } from "./branchPayment";

const CHIL = "153복싱짐 칠금점";
const SUN = "153복싱짐 선릉역점";

describe("지점별 수강권 결제 — 칠금점은 계좌이체 · 현장 결제만 (2026-10-21)", () => {
  it("칠금점만 데스크 결제 · 선릉역점은 앱 결제 그대로", () => {
    expect(OFFLINE_PAY_BRANCHES).toEqual([CHIL]);
    expect(isOfflinePayBranch(CHIL)).toBe(true);
    for (const b of [SUN, "153복싱짐 역삼점", "", null, undefined]) expect(isOfflinePayBranch(b)).toBe(false);
  });

  it("가입 신청 지점 — 선릉역점 · 칠금점", () => {
    expect(SIGNUP_BRANCHES.map((b) => b.name)).toEqual([SUN, CHIL]);
    expect(branchShortName(CHIL)).toBe("칠금점");
    expect(branchShortName(null)).toBe("지점");
  });

  it("계좌 — 은행 · 계좌 · 예금주가 다 있어야 보인다 (아니면 데스크 안내)", () => {
    const full = { [CHIL]: { bank: "OO은행", account: "123-45-678", holder: "153복싱짐" } };
    expect(offlinePayInfoFor(full, CHIL)).toEqual({ bank: "OO은행", account: "123-45-678", holder: "153복싱짐" });
    expect(offlinePayInfoFor(full, SUN)).toBeNull();
    expect(offlinePayInfoFor({ [CHIL]: { bank: "OO은행", account: "", holder: "153" } }, CHIL)).toBeNull();
    expect(offlinePayInfoFor(null, CHIL)).toBeNull();
    expect(offlinePayInfoFor("x", CHIL)).toBeNull();
    expect(offlinePayInfoFor({ [CHIL]: "문자열" }, CHIL)).toBeNull();
  });
});
