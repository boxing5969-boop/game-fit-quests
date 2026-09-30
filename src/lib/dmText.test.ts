import { describe, expect, it } from "vitest";
import { isEmojiOnly } from "./dmText";

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
