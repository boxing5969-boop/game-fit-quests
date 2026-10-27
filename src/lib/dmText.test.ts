import { describe, expect, it } from "vitest";
import { isEmojiOnly, splitDmLinks } from "./dmText";

describe("splitDmLinks — 153 선물 주소만 눌러서 열림", () => {
  it("153 선물 주소는 링크로", () => {
    const parts = splitDmLinks("▼ 선물 열어보기\nhttps://153-boxing-os.pages.dev/v/e94904ba84304ee8\n\n할인권 번호");
    expect(parts).toEqual([
      { text: "▼ 선물 열어보기\n" },
      { text: "https://153-boxing-os.pages.dev/v/e94904ba84304ee8", href: "https://153-boxing-os.pages.dev/v/e94904ba84304ee8" },
      { text: "\n\n할인권 번호" },
    ]);
  });
  it("다른 주소는 그냥 글자", () => {
    expect(splitDmLinks("여기 https://evil.example.com/v/abc 눌러")).toEqual([{ text: "여기 https://evil.example.com/v/abc 눌러" }]);
    expect(splitDmLinks("http://153-boxing-os.pages.dev/v/abc")).toEqual([{ text: "http://153-boxing-os.pages.dev/v/abc" }]);
    expect(splitDmLinks("https://153-boxing-os.pages.dev.evil.com/v/abc")).toEqual([{ text: "https://153-boxing-os.pages.dev.evil.com/v/abc" }]);
  });
  it("주소 끝 마침표·한글은 빼고", () => {
    expect(splitDmLinks("https://153-boxing-os.pages.dev/g/abc12.")).toEqual([
      { text: "https://153-boxing-os.pages.dev/g/abc12", href: "https://153-boxing-os.pages.dev/g/abc12" },
      { text: "." },
    ]);
    expect(splitDmLinks("https://153-boxing-os.pages.dev/v/abc에서")[0]).toEqual({ text: "https://153-boxing-os.pages.dev/v/abc", href: "https://153-boxing-os.pages.dev/v/abc" });
  });
  it("주소 없으면 한 덩어리", () => {
    expect(splitDmLinks("안녕하세요")).toEqual([{ text: "안녕하세요" }]);
    expect(splitDmLinks("")).toEqual([{ text: "" }]);
  });
});

describe("isEmojiOnly — 이모지만 1~3개면 크게", () => {
  it("이모지만", () => {
    expect(isEmojiOnly("🥊")).toBe(true);
    expect(isEmojiOnly(" 💪🔥 ")).toBe(true);
    expect(isEmojiOnly("👍🏻")).toBe(true); // 피부색
    expect(isEmojiOnly("❤️")).toBe(true); // 변형 선택자
    expect(isEmojiOnly("👨‍👩‍👧")).toBe(true); // ZWJ 가족 = 1 덩어리
    expect(isEmojiOnly("🇰🇷")).toBe(true); // 국기
    expect(isEmojiOnly("1\ufe0f\u20e3")).toBe(true); // 키캡 1️⃣
  });
  it("글자·숫자가 섞이면 말풍선", () => {
    expect(isEmojiOnly("좋아요 👍")).toBe(false);
    expect(isEmojiOnly("123")).toBe(false);
    // 숫자 + 이모지 — 말풍선 (검수: "2🥊", "10🔥" 가 크게 보였다)
    expect(isEmojiOnly("2🥊")).toBe(false);
    expect(isEmojiOnly("10🔥")).toBe(false);
    expect(isEmojiOnly("#1🥊")).toBe(false);
    expect(isEmojiOnly("ㅋㅋ")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
    expect(isEmojiOnly("   ")).toBe(false);
  });
  it("4개부터는 말풍선", () => {
    expect(isEmojiOnly("🥊🥊🥊")).toBe(true);
    expect(isEmojiOnly("🥊🥊🥊🥊")).toBe(false);
  });
});
