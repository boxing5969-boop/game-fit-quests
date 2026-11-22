import { beforeEach, describe, expect, it } from "vitest";
import { clearLinkTicket, hasLoggedInBefore, lookupStatusOf, markLoggedIn, peekLinkTicket, saveLinkTicket } from "./memberEntry";

describe("첫 사용 순서", () => {
  beforeEach(() => localStorage.clear());
  it("로그인한 적이 있는 기기는 첫 질문을 건너뛴다", () => {
    expect(hasLoggedInBefore()).toBe(false);
    markLoggedIn();
    expect(hasLoggedInBefore()).toBe(true);
  });
  it("이어받기 표는 10분 동안만 살아 있다", () => {
    saveLinkTicket("abc", 0);
    expect(peekLinkTicket(1000)).toBe("abc");
    expect(peekLinkTicket(10 * 60_000 + 1)).toBeNull();
    expect(peekLinkTicket(1000)).toBeNull(); // 지난 표는 지워졌다
    saveLinkTicket("def");
    clearLinkTicket();
    expect(peekLinkTicket()).toBeNull();
  });
  it("찾기 결과를 아는 말로만 읽는다", () => {
    expect(lookupStatusOf({ status: "existing" })).toBe("existing");
    expect(lookupStatusOf({ status: "registered" })).toBe("registered");
    expect(lookupStatusOf({ status: "weird" })).toBe("error");
    expect(lookupStatusOf(null)).toBe("error");
  });
});
