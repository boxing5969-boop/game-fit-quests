import { describe, expect, it } from "vitest";
import { FIRST_LETTER_MAX_SHOWS, firstLetterDue, firstLetterShownCount, parseShownCount } from "./letterSchedule";

describe("첫 로그인 편지 — 접속 3번까지 (2026-10-21)", () => {
  it("3번까지 — 처음 · 2번째 · 3번째 접속엔 뜨고, 4번째부터 안 뜬다", () => {
    expect(FIRST_LETTER_MAX_SHOWS).toBe(3);
    for (const n of [0, 1, 2]) expect(firstLetterDue({ storedCount: n, legacySeen: false, shownThisSession: false })).toBe(true);
    for (const n of [3, 4, 10]) expect(firstLetterDue({ storedCount: n, legacySeen: true, shownThisSession: false })).toBe(false);
  });

  it("같은 접속 안에서는 한 번만", () => {
    expect(firstLetterDue({ storedCount: 1, legacySeen: false, shownThisSession: true })).toBe(false);
  });

  it("예전에 한 번 본 계정은 1번 본 것으로 — 2번 더", () => {
    expect(firstLetterShownCount({ storedCount: null, legacySeen: true })).toBe(1);
    expect(firstLetterShownCount({ storedCount: null, legacySeen: false })).toBe(0);
    expect(firstLetterDue({ storedCount: null, legacySeen: true, shownThisSession: false })).toBe(true);
  });

  it("저장값 읽기 — 숫자가 아니면 없는 것으로", () => {
    expect(parseShownCount("2")).toBe(2);
    expect(parseShownCount(null)).toBeNull();
    expect(parseShownCount("")).toBeNull();
    expect(parseShownCount("abc")).toBeNull();
    expect(parseShownCount("-1")).toBeNull();
  });
});
