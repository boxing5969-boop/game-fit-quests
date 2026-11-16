import { describe, expect, it } from "vitest";
import { cardVoicePath, cardVoiceUrl, voiceHash, voiceText } from "./cardVoice";

const card = { id: "9fec2574-5132-4d6d-bdc7-09c6c635e5fe", name: "잽", summary: "앞손을 곧게 뻗는 기본 펀치", cues: ["턱은 당겨요", "153 방식으로 같은 길로 돌아와요"] };

describe("카드 설명 목소리 파일", () => {
  it("읽을 글 — 줄마다 문장 끝 · '153'은 '일오삼'", () => {
    const t = voiceText(card);
    expect(t).toContain("잽.");
    expect(t).toContain("포인트예요.");
    expect(t).toContain("일오삼 방식");
    expect(t).not.toContain("153");
    expect(t.endsWith(".")).toBe(true);
  });

  it("지문은 같은 글이면 늘 같고, 한 글자만 달라도 다르다", () => {
    expect(voiceHash("가나다")).toBe(voiceHash("가나다"));
    expect(voiceHash("가나다")).not.toBe(voiceHash("가나다."));
    expect(voiceHash("")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("목록의 지문이 지금 글과 맞을 때만 파일 주소 — 글을 고치면 휴대폰 목소리로", () => {
    const h = voiceHash(voiceText(card));
    const voices = { [card.id]: h };
    expect(cardVoiceUrl(card, voices)).toBe(cardVoicePath(card.id, h));
    expect(cardVoiceUrl({ ...card, summary: "고친 글" }, voices)).toBeNull();
    expect(cardVoiceUrl(card, {})).toBeNull();
  });
});
