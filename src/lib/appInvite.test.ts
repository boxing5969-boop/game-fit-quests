import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureInviteCodeFromUrl, clearStoredInviteCode, inviteLink, readStoredInviteCode } from "./appInvite";

const setUrl = (search: string) => window.history.replaceState(null, "", `/${search}`);

describe("초대 링크 코드 (2026-10-19)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUrl("");
  });
  afterEach(() => vi.useRealTimers());

  it("링크는 공식 주소 + ?inv=코드", () => {
    expect(inviteLink("ABCD1234")).toBe("https://myboxer153.com/?inv=ABCD1234");
    expect(inviteLink(null)).toBe("https://myboxer153.com/");
  });

  it("링크로 들어오면 코드를 대문자로 남긴다", () => {
    setUrl("?inv=abcd1234");
    captureInviteCodeFromUrl();
    expect(readStoredInviteCode()).toBe("ABCD1234");
  });

  it("이상한 코드는 남기지 않고, 원래 코드도 지우지 않는다", () => {
    setUrl("?inv=ABCD1234");
    captureInviteCodeFromUrl();
    setUrl("?inv=%3Cscript%3E");
    captureInviteCodeFromUrl();
    expect(readStoredInviteCode()).toBe("ABCD1234");
  });

  it("30일이 지나면 쓰지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    setUrl("?inv=ABCD1234");
    captureInviteCodeFromUrl();
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    expect(readStoredInviteCode()).toBeNull();
  });

  it("확인이 끝나면 지운다", () => {
    setUrl("?inv=ABCD1234");
    captureInviteCodeFromUrl();
    clearStoredInviteCode();
    expect(readStoredInviteCode()).toBeNull();
  });
});
