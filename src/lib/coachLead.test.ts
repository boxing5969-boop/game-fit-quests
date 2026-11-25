import { describe, expect, it } from "vitest";
import { checkPair, checkTeam, leaderCall } from "../../supabase/functions/_shared/coachLead.ts";
import { leadRowLine, leaderCallOf } from "@/lib/coachLead";

const profile = { answers: { order: "conclusion", tone: "direct" }, note_power: "회원님이 웃으면서 다음 수업 예약할 때 정말 힘이 나요", note_know: null };

const team = {
  one_line: "짧게 말해도 화난 게 아니에요 — 결론부터 보고하면 잘 통해요",
  way: ["지시는 짧고 분명하게 해요", "계획은 미리 정해 두고 움직여요"],
  misread: [{ looks: "칭찬 없이 바로 고칠 점만 말할 때", really: "원래 핵심부터 말하는 방식이에요. 마음이 상해서가 아니에요" }],
  report: ["결론 한 줄 먼저, 이유는 뒤에 붙여요"],
  values: ["회원님 반응을 전해 주면 힘이 돼요"],
  tired: "바쁠 땐 짧은 메모로 남겨 두면 좋아요",
  open_line: "관장님, 오늘 수업 한 가지만 여쭤봐도 될까요",
};

const guide = {
  one_line: "이유 한 문장을 먼저 붙이면 바로 움직여요",
  delegate: ["분위기 띄우는 마무리 시간을 통째로 맡겨요"],
  motivate: ["회원 반응을 그날 바로 짚어 줘요"],
  feedback: ["잘한 것 한 줄", "이유", "바꿀 것 하나"],
  clash: [{ when: "내가 수업 중에 짧게 지적할 때", try: "수업 끝나고 잘한 것 한 줄부터 꺼내요" }],
  down: "말수가 줄면 재촉하지 말고 정리할 틈을 줘요",
  first_line: "오늘 마무리 분위기 좋았어요, 하나만 같이 맞춰 볼까요",
};

describe("관장님 이해 카드 검사", () => {
  it("모양이 맞으면 통과", () => {
    expect(checkTeam(team, profile).ok).toBe(true);
  });
  it("MBTI · 꼬리표 · 카드 답 옮기기 · 숫자 · 본인 글은 막는다", () => {
    expect(checkTeam({ ...team, way: ["ENTJ 라서 지시가 짧아요"] }, profile)).toMatchObject({ reason: "label" });
    expect(checkTeam({ ...team, way: ["외향적인 분이에요"] }, profile)).toMatchObject({ reason: "label" });
    expect(checkTeam({ ...team, one_line: "결론부터 듣는 걸 좋아하신다고 하셨어요" }, profile)).toMatchObject({ reason: "card" });
    expect(checkTeam({ ...team, tired: "3분 안에 끝내 주세요" }, profile)).toMatchObject({ reason: "digits" });
    expect(checkTeam({ ...team, values: ["회원님이 웃으면서 다음 수업 예약할 때"] }, profile)).toMatchObject({ reason: "echo" });
    expect(checkTeam({ ...team, report: [] }, profile)).toMatchObject({ reason: "empty" });
  });
  it("대표 = 대표님, 그 밖 = 관장님", () => {
    expect(leaderCall("대표")).toBe("대표님");
    expect(leaderCall("지점장")).toBe("관장님");
    expect(leaderCallOf("대표")).toBe("대표님");
  });
});

describe("리드 가이드 검사", () => {
  it("모양이 맞으면 통과", () => {
    expect(checkPair(guide, { leader: profile, coach: { answers: {} } }).ok).toBe(true);
  });
  it("엇갈리는 곳이 없거나 탓하는 말이 있으면 막는다", () => {
    expect(checkPair({ ...guide, clash: [] }, { leader: profile, coach: { answers: {} } })).toMatchObject({ reason: "empty" });
    expect(checkPair({ ...guide, down: "부족한 점을 짚어 줘요" }, { leader: profile, coach: { answers: {} } })).toMatchObject({ reason: "blame" });
  });
  it("줄 상태 글", () => {
    const base = { person: null, has_mind: true, allowed: false, guide: null, guide_at: null, stale: false };
    expect(leadRowLine({ ...base, has_mind: false }, false)).toBe("성향 카드가 아직 없어요");
    expect(leadRowLine(base, false)).toBe("코치님 허락을 기다려요");
    expect(leadRowLine({ ...base, allowed: true }, false)).toBe("가이드를 만들 수 있어요");
  });
});
