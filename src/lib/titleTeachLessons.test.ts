import { describe, expect, it } from "vitest";
import {
  TITLE_TEACH_LESSONS,
  chantChunks,
  fillWho,
  lessonFor,
  teachDayFromParam,
  titleTeachLink,
} from "./titleTeachLessons";
import { titleMatchLink } from "./titleMatchChallenge";
import { titleMissionGuideFor } from "./titleMissionGuide";

describe("titleTeachLessons", () => {
  it("1·2·3편이 순서대로 있고, 편마다 질문 · 답 · 연구 · 체육관 · 행동 하나 · 출처가 있다", () => {
    expect(TITLE_TEACH_LESSONS.map((l) => l.day)).toEqual([1, 2, 3]);
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.hook.endsWith("?")).toBe(true);
      expect(l.answer.length).toBeGreaterThan(5);
      expect(l.points.length).toBeGreaterThanOrEqual(2);
      expect(l.points.every((p) => p.text && p.by)).toBe(true);
      expect(l.gym.length).toBeGreaterThan(0);
      expect(l.action.text.length).toBeGreaterThan(5);
      // 연구 한 줄마다 출처 한 줄 (같은 연구를 두 번 적지 않는다)
      expect(l.sources.length).toBe(l.points.length);
    }
    expect(lessonFor(2).day).toBe(2);
  });

  it("알림 글은 휴대폰 두 줄에 들어갈 길이 · 몇 편인지 표시", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.notice.title.length).toBeLessThanOrEqual(40);
      expect(l.notice.body.length).toBeLessThanOrEqual(60);
      expect(l.notice.body.endsWith(`타이틀미션 이야기 ${l.day}/3`)).toBe(true);
    }
  });

  it("?why= 는 1~3 만", () => {
    expect(teachDayFromParam("1")).toBe(1);
    expect(teachDayFromParam("3")).toBe(3);
    expect(teachDayFromParam("0")).toBeNull();
    expect(teachDayFromParam("4")).toBeNull();
    expect(teachDayFromParam("x")).toBeNull();
    expect(teachDayFromParam(null)).toBeNull();
  });

  it("알림 링크는 DB title_match_link('white') || '&why=' 과 같은 모양", () => {
    expect(titleTeachLink(2)).toBe(`${titleMatchLink("white")}&why=2`);
  });

  it("외우는 말을 덩어리로 — 화이트 9동작", () => {
    const chant = titleMissionGuideFor("white")?.chant ?? "";
    expect(chantChunks(chant)).toEqual(["잽 잽 원투", "빠지고 꽂고", "돌고 원투", "빠지고 꽂고"]);
    expect(chantChunks("")).toEqual([]);
  });

  it("행동 글의 {who} 를 심사하는 사람으로", () => {
    expect(fillWho("{who}께 심사를 신청해요", "지점장님")).toBe("지점장님께 심사를 신청해요");
    expect(fillWho(lessonFor(3).action.text, "관장님")).toContain("관장님께");
  });
});
