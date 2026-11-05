import { describe, expect, it } from "vitest";
import {
  TEACH_SERIES_TITLE,
  TITLE_TEACH_LESSONS,
  chantChunks,
  fillWho,
  lessonFor,
  teachDayFromParam,
  titleTeachLink,
} from "./titleTeachLessons";
import { titleMatchLink } from "./titleMatchChallenge";
import { titleMissionGuideFor } from "./titleMissionGuide";

// 대표님 11:24 "부정어를 줄이고 긍정어로" — 화면 글에 쓰지 않는 말
const NEGATIVE = ["손해", "실패", "못 ", "못해", "안 돼", "안돼", "아쉬", "어색", "틀린", "틀려"];

const allText = (l: (typeof TITLE_TEACH_LESSONS)[number]) =>
  [
    l.kicker,
    l.title,
    l.lead,
    l.stats?.note ?? "",
    ...(l.stats?.items.map((s) => s.label) ?? []),
    ...l.research.flatMap((r) => [r.text, r.detail ?? ""]),
    ...(l.steps?.items.flatMap((s) => [s.label, s.text]) ?? []),
    ...(l.stories?.items.flatMap((s) => [s.who, s.text]) ?? []),
    ...l.gym,
    l.action.text,
    l.closing?.line ?? "",
    l.notice.title,
    l.notice.body,
  ].join(" ");

describe("titleTeachLessons — 설계 노트 3편", () => {
  it("1·2·3편이 순서대로 있고, 편마다 머리말 · 제목 · 설명 · 연구 · 체육관 · 행동 하나 · 출처가 있다", () => {
    expect(TITLE_TEACH_LESSONS.map((l) => l.day)).toEqual([1, 2, 3]);
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.kicker.startsWith(`설계 노트 ${l.day}`)).toBe(true);
      expect(l.title.length).toBeGreaterThan(5);
      expect(l.lead.length).toBeGreaterThan(10);
      expect(l.research.length).toBeGreaterThanOrEqual(3);
      expect(l.research.every((r) => r.text && r.by)).toBe(true);
      expect(l.gym.length).toBeGreaterThan(0);
      expect(l.action.text.length).toBeGreaterThan(5);
      // 연구 · 이야기 · 단계마다 출처가 있다 (출처 이름이 있는 것만큼 출처 줄)
      const cited =
        l.research.length +
        (l.stories?.items.filter((s) => s.by).length ?? 0) +
        (l.steps?.items.filter((s) => s.by).length ?? 0);
      expect(l.sources.length).toBe(cited);
    }
    expect(lessonFor(2).day).toBe(2);
  });

  it("설득하는 질문 대신 설계를 설명한다 — 큰 제목은 질문이 아니다", () => {
    for (const l of TITLE_TEACH_LESSONS) expect(l.title.endsWith("?")).toBe(false);
    expect(lessonFor(1).notice.title).toContain(TEACH_SERIES_TITLE.replace(" · ", " · "));
  });

  it("부정어를 쓰지 않는다", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      const text = allText(l);
      for (const w of NEGATIVE) expect(text.includes(w), `${l.day}편에 '${w}'`).toBe(false);
    }
  });

  it("근거 없는 말은 쓰지 않는다 — 학습 피라미드 90% · 1만 시간 · 최적", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      const text = allText(l);
      expect(text).not.toMatch(/90%|1만 시간|만 시간의 법칙|최적/);
    }
  });

  it("알림 글은 휴대폰 두 줄에 들어갈 길이 · 몇 편인지 표시", () => {
    for (const l of TITLE_TEACH_LESSONS) {
      expect(l.notice.title.length).toBeLessThanOrEqual(40);
      expect(l.notice.body.length).toBeLessThanOrEqual(60);
      expect(l.notice.body.startsWith(`설계 노트 ${l.day}/3`)).toBe(true);
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
