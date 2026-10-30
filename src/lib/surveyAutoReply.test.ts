import { describe, expect, it } from "vitest";
import { classify, composeReply, kstHour, type AnswerIn } from "../../supabase/functions/survey-auto-reply/logic.ts";

const rating = (question: string, score: number): AnswerIn => ({ type: "rating", question, text: null, score, max: 5 });
const choice = (text: string): AnswerIn => ({ type: "multiple_choice", question: "가장 먼저 개선됐으면 하는 것", text, score: 1, max: null });
const yn = (question: string, text: "예" | "아니오"): AnswerIn => ({ type: "yes_no", question, text, score: null, max: null });
const memo = (text: string): AnswerIn => ({ type: "text", question: "하고 싶은 말씀", text, score: null, max: null });

const happy = [rating("전반적으로 얼마나 만족", 5), rating("코치의 지도는 어떠신가요?", 5), choice("특별히 없습니다"), yn("주변에 추천하실 의향", "예")];

describe("만족도 조사 자동 답변 · 의견 알림 (2026-10-30 대표님)", () => {
  it("긍정만 — 4·5점 · 특별히 없습니다 · 글 없음 · 추천 예", () => {
    expect(classify(happy)).toEqual({ kind: "positive", recommend: true, coachTop: true, comeback: false });
    expect(classify([...happy, memo("없어요")]).kind).toBe("positive");
    expect(classify([...happy, memo("  - ")]).kind).toBe("positive");
    expect(classify([rating("전반", 4), choice("특별히 없습니다")]).kind).toBe("positive");
  });

  it("의견 — 개선 보기 · 3점 이하 · 적은 글 · 추천 아니오 · 만료 회원 이유는 대표님께", () => {
    expect(classify([...happy.slice(0, 2), choice("샤워실·탈의실")])).toMatchObject({ kind: "opinion", reasons: ["선택: 샤워실·탈의실"] });
    expect(classify([rating("전반", 3)]).kind).toBe("opinion");
    expect(classify([...happy, memo("코치님 최고예요")]).kind).toBe("opinion");
    expect(classify([rating("전반", 5), yn("주변에 추천", "아니오")]).kind).toBe("opinion");
    expect(classify([{ type: "multiple_choice", question: "이어가지 않으신 이유", text: "시간이 잘 맞지 않아서", score: 1, max: null }]).kind).toBe("opinion");
  });

  it("QR · 예전 응답은 보기 글 없이 번호만 — 보기에서 찾아 판정 (코치의 개인 케어 = 5번)", () => {
    const choices = ["수업 시간대·스케줄", "기구·장비 상태", "샤워실·탈의실", "청결·환기", "코치의 개인 케어", "수업 인원(혼잡도)", "특별히 없습니다"];
    expect(classify([rating("전반", 5), { type: "multiple_choice", question: "개선", text: null, score: 5, max: null, choices }])).toMatchObject({
      kind: "opinion",
      reasons: ["선택: 코치의 개인 케어"],
    });
    expect(classify([rating("전반", 5), { type: "multiple_choice", question: "개선", text: null, score: 7, max: null, choices }]).kind).toBe("positive");
  });

  it("만료 회원 설문 — 개인 사정 · 높은 점수 · 다시 이용 예 = 긍정(다시 오시면 반갑게)", () => {
    const v = classify([
      { type: "multiple_choice", question: "이어가지 않으신 이유", text: "개인 사정(이사·부상·직장 등)", score: 7, max: null },
      rating("다니시는 동안 만족", 5),
      yn("나중에 여건이 되면 다시 이용하실 의향", "예"),
    ]);
    expect(v).toMatchObject({ kind: "positive", comeback: true });
  });

  it("답변 — 건강·행복 + 노력하는 체육관이 늘 들어가고, 응답마다 달라지고, 같은 응답은 같은 문장", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const texts = ids.map((id) => composeReply(id, { recommend: true, coachTop: false }));
    for (const t of texts) {
      expect(t).toMatch(/건강/);
      expect(t).toMatch(/노력/);
      expect(t).not.toMatch(/AI|자동/);
      expect(t.length).toBeLessThan(120);
    }
    expect(new Set(texts).size).toBeGreaterThan(25);
    expect(composeReply(ids[0], { recommend: true, coachTop: false })).toBe(texts[0]);
    expect(composeReply(ids[0], { recommend: true, coachTop: false }, 1)).not.toBe(texts[0]);
  });

  it("한국 시각", () => {
    expect(kstHour(new Date("2026-10-30T00:00:00Z"))).toBe(9);
    expect(kstHour(new Date("2026-10-30T15:30:00Z"))).toBe(0);
  });
});
