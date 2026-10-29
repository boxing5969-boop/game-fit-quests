import { describe, expect, it } from "vitest";
import { myRankLine, officialUpLines, rankingResetLabel, type MyRankingPositions } from "./rankingHelp";

const RULES = [
  { rank: "white", firstLevel: 1, lastLevel: 10, visitsPerLevel: 3, minDaysPerLevel: 0, autoAdvance: true },
  { rank: "blue", firstLevel: 11, lastLevel: 20, visitsPerLevel: 5, minDaysPerLevel: 0, autoAdvance: true },
  { rank: "red", firstLevel: 21, lastLevel: 30, visitsPerLevel: 8, minDaysPerLevel: 0, autoAdvance: false },
  { rank: "black", firstLevel: 31, lastLevel: 40, visitsPerLevel: 20, minDaysPerLevel: 45, autoAdvance: false },
];

describe("officialUpLines", () => {
  it("레벨업 규칙에서 글을 만든다", () => {
    const lines = officialUpLines(RULES);
    expect(lines[0]).toBe("체육관에 오면 레벨이 올라요 — 화이트는 3번, 블루는 5번 올 때마다 1레벨");
    expect(lines[1]).toBe("레드는 8번, 블랙은 20번(최소 45일)을 채우면 심사를 거쳐 1레벨");
  });
  it("규칙을 못 읽으면 기본 글", () => {
    expect(officialUpLines(null)[0]).toContain("화이트는 3번");
  });
});

describe("rankingResetLabel (한국 시간)", () => {
  it("일요일 낮 = 오늘 밤 12시", () => {
    // 2026-11-01(일) 13:00 KST = 04:00 UTC
    expect(rankingResetLabel("weekly", new Date("2026-11-01T04:00:00Z"))).toContain("오늘 밤 12시");
  });
  it("목요일 = 월요일까지 4일", () => {
    // 2026-10-29(목) 23:30 KST
    expect(rankingResetLabel("weekly", new Date("2026-10-29T14:30:00Z"))).toBe("월요일 0시에 모두 0에서 다시 시작해요 · 4일 남음");
  });
  it("월요일 0시 막 지나면 7일", () => {
    // 2026-11-02(월) 00:10 KST = 11-01 15:10 UTC
    expect(rankingResetLabel("weekly", new Date("2026-11-01T15:10:00Z"))).toContain("7일 남음");
  });
  it("이번 달 마지막 날 = 오늘 밤 12시", () => {
    // 2026-10-31 20:00 KST
    expect(rankingResetLabel("monthly", new Date("2026-10-31T11:00:00Z"))).toContain("오늘 밤 12시");
  });
  it("10월 29일 = 3일 남음", () => {
    expect(rankingResetLabel("monthly", new Date("2026-10-29T03:00:00Z"))).toContain("3일 남음");
  });
  it("다른 칩은 없음", () => {
    expect(rankingResetLabel("official")).toBeNull();
    expect(rankingResetLabel("streak")).toBeNull();
  });
});

describe("myRankLine", () => {
  const base: MyRankingPositions = {
    eligible: true,
    official: { pos: 12, n: 651, me: { lv: 12, bosses: 1, xp: 900 }, above: { lv: 13, bosses: 1, xp: 800 } },
    weekly: { pos: 13, n: 79, me: 63, above: 66 },
    monthly: { pos: null, n: 129, me: 0, above: 6 },
    streak: { pos: 1, n: 43, me: 40, above: null },
    boss: { pos: 3, n: 5, me: 1, above: 2 },
  };
  it("전체: 레벨 차이가 먼저", () => {
    expect(myRankLine("official", base)).toEqual({ pos: 12, line: "앞 사람까지 레벨 1" });
  });
  it("전체: 같은 레벨이면 타이틀매치 → XP", () => {
    const d = { ...base, official: { pos: 5, n: 10, me: { lv: 10, bosses: 0, xp: 749 }, above: { lv: 10, bosses: 0, xp: 779 } } };
    expect(myRankLine("official", d)?.line).toBe("앞 사람까지 30 XP");
  });
  it("전체: 모두 같으면", () => {
    const d = { ...base, official: { pos: 5, n: 10, me: { lv: 1, bosses: 0, xp: 10 }, above: { lv: 1, bosses: 0, xp: 10 } } };
    expect(myRankLine("official", d)?.line).toBe("앞 사람과 점수가 같아요");
  });
  it("이번 주: 앞 사람까지 XP", () => {
    expect(myRankLine("weekly", base)).toEqual({ pos: 13, line: "앞 사람까지 3 XP" });
  });
  it("상승: 순위 없음 = 할 일", () => {
    expect(myRankLine("monthly", base)).toEqual({ pos: null, line: "출석하면 이번 달 순위에 바로 들어가요" });
  });
  it("출석일 1위", () => {
    expect(myRankLine("streak", base)).toEqual({ pos: 1, line: "1위예요" });
  });
  it("타이틀매치: 번", () => {
    expect(myRankLine("boss", base)?.line).toBe("앞 사람까지 1번");
  });
  it("코치님 · 운영진은 카드 없음", () => {
    expect(myRankLine("weekly", { eligible: false })).toBeNull();
    expect(myRankLine("weekly", null)).toBeNull();
  });
});
