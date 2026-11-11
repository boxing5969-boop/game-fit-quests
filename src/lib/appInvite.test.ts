import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appLinkLabel,
  appShareText,
  captureInviteCodeFromUrl,
  clearStoredInviteCode,
  copyAppLink,
  copyText,
  inviteLink,
  readStoredInviteCode,
  shareAppLink,
} from "./appInvite";

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

describe("설정 › 마이복서153 공유하기 (2026-11-12)", () => {
  const nav = navigator as Navigator & { share?: unknown };
  const realShare = nav.share;
  const realClipboard = navigator.clipboard;
  const setClipboard = (v: unknown) =>
    Object.defineProperty(navigator, "clipboard", { value: v, configurable: true, writable: true });
  const setShare = (v: unknown) => Object.defineProperty(navigator, "share", { value: v, configurable: true, writable: true });

  afterEach(() => {
    setShare(realShare);
    setClipboard(realClipboard);
    vi.restoreAllMocks();
  });

  it("소개 글은 153 브랜드 기준 — 서명 그대로 · 긴 줄표 · 금칙어 없음 · 보상 말 없음", () => {
    const text = appShareText();
    expect(text).toContain("153 건강과 행복. 153복싱짐");
    expect(text).toContain("마이복서153");
    expect(text).not.toMatch(/—|국가대표|최고|프리미엄|무조건|보장|벨트|계급|잽부터|오삼코치/);
    expect(text).not.toMatch(/챔피언 머니|보상|1,000/);
  });

  it("화면용 링크 글은 https:// 를 뺀다", () => {
    expect(appLinkLabel("ABCD1234")).toBe("myboxer153.com/?inv=ABCD1234");
    expect(appLinkLabel(undefined)).toBe("myboxer153.com/");
  });

  it("공유 창이 있으면 소개 글 + 내 코드 링크로 연다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    await expect(shareAppLink("ABCD1234")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "마이복서153", text: appShareText(), url: "https://myboxer153.com/?inv=ABCD1234" });
  });

  it("공유 창을 닫으면 아무것도 복사하지 않는다", async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(shareAppLink("ABCD1234")).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("공유 창이 없으면 소개 글 + 링크를 복사한다", async () => {
    setShare(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(shareAppLink(null)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${appShareText()}\nhttps://myboxer153.com/`);
  });

  it("클립보드가 막혀 있으면 숨긴 칸으로 복사하고, 그것도 안 되면 실패", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true, writable: true });
    await expect(copyAppLink("ABCD1234")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelectorAll("textarea").length).toBe(0); // 숨긴 칸은 치운다
    exec.mockReturnValue(false);
    await expect(copyText("x")).resolves.toBe(false);
  });
});
