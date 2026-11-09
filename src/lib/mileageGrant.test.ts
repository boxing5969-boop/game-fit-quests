import { describe, expect, it } from "vitest";
import {
  MILEAGE_GRANT_DEFAULT_REASON,
  MILEAGE_GRANT_MAX,
  formatGrantInput,
  grantAmountError,
  grantConfirmText,
  grantReason,
  newGrantRequestId,
  parseGrantAmount,
} from "./mileageGrant";

describe("parseGrantAmount / formatGrantInput — 입력칸", () => {
  it("숫자만 읽는다 (쉼표 · 글자 · 빈칸)", () => {
    expect(parseGrantAmount("50,000")).toBe(50000);
    expect(parseGrantAmount(" 5만 점")).toBe(5);
    expect(parseGrantAmount("")).toBe(0);
    expect(parseGrantAmount("abc")).toBe(0);
  });
  it("쓰는 동안 쉼표를 넣는다 · 0 이면 비운다", () => {
    expect(formatGrantInput("50000")).toBe("50,000");
    expect(formatGrantInput("1234567")).toBe("1,234,567");
    expect(formatGrantInput("0")).toBe("");
    expect(formatGrantInput("")).toBe("");
  });
  it("9자리까지만 읽는다", () => {
    expect(parseGrantAmount("12345678901")).toBe(123456789);
  });
});

describe("grantAmountError — 서버 admin_grant_mileage 와 같은 기준", () => {
  it("1 ~ 100,000 은 통과", () => {
    expect(grantAmountError(1)).toBeNull();
    expect(grantAmountError(50000)).toBeNull();
    expect(grantAmountError(MILEAGE_GRANT_MAX)).toBeNull();
  });
  it("0 · 음수 · NaN 은 점수를 넣으라고", () => {
    expect(grantAmountError(0)).toBe("줄 점수를 입력해 주세요");
    expect(grantAmountError(-100)).toBe("줄 점수를 입력해 주세요");
    expect(grantAmountError(Number.NaN)).toBe("줄 점수를 입력해 주세요");
  });
  it("100,000 을 넘으면 막는다", () => {
    expect(grantAmountError(MILEAGE_GRANT_MAX + 1)).toBe("한 번에 100,000점까지 줄 수 있어요");
  });
});

describe("grantReason / grantConfirmText", () => {
  it("사유를 비우면 기본 글", () => {
    expect(grantReason("  ")).toBe(MILEAGE_GRANT_DEFAULT_REASON);
    expect(grantReason(" 앱 활동 1등 축하 보상 ")).toBe("앱 활동 1등 축하 보상");
  });
  it("확인 창에 이름 · 점수 · 사유 · 알림 여부", () => {
    expect(grantConfirmText("봄", 50000, "앱 활동 1등 축하 보상", true)).toBe(
      "봄님께 마일리지 50,000점을 드릴까요?\n사유: 앱 활동 1등 축하 보상\n회원에게 알림이 함께 가요.",
    );
    expect(grantConfirmText("", 1000, "", false)).toBe(
      `회원님께 마일리지 1,000점을 드릴까요?\n사유: ${MILEAGE_GRANT_DEFAULT_REASON}\n알림은 보내지 않아요.`,
    );
  });
});

describe("newGrantRequestId", () => {
  it("uuid 모양 · 매번 다르다", () => {
    const a = newGrantRequestId();
    const b = newGrantRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
