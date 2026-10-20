import { describe, expect, it } from "vitest";
import { TITLE_MISSION_GUIDES, titleMissionGuideFor, totalMoves } from "./titleMissionGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];

describe("타이틀 미션 동작 외우기", () => {
  it("화이트 = 레벨 10 · 9동작 (잽 잽 원투 · 백스텝 카운터 · 돌고 원투 · 백스텝 카운터)", () => {
    const g = titleMissionGuideFor("white")!;
    expect(g.level).toBe(10);
    expect(totalMoves(g)).toBe(9);
    expect(g.groups.flatMap((x) => x.moves.map((m) => m.name))).toEqual([
      "잽", "잽", "원투", "백스텝", "카운터 스트레이트", "돌기(피벗)", "원투", "백스텝", "카운터 스트레이트",
    ]);
  });

  it("블루 = 레벨 20 · 18동작 (영상 제목 '콤보 드릴 18동작'과 같다)", () => {
    const g = titleMissionGuideFor("blue")!;
    expect(g.level).toBe(20);
    expect(totalMoves(g)).toBe(18);
    expect(g.groups.map((x) => x.moves.length)).toEqual([8, 6, 4]);
  });

  it("레드 · 블랙은 아직 없다 (카드를 그리지 않는다)", () => {
    expect(titleMissionGuideFor("red")).toBeNull();
    expect(titleMissionGuideFor("black")).toBeNull();
  });

  it("허리와 다리 회전 · 가드 · 밸런스가 모두 있고 비어 있지 않다", () => {
    for (const g of TITLE_MISSION_GUIDES) {
      for (const key of ["rotation", "guard", "balance"] as const) {
        const sec = g.sections.find((s) => s.key === key);
        expect(sec, `${g.league} ${key}`).toBeTruthy();
        expect(sec!.points.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("심사에서 보는 것에 적힌 동작 수가 실제 동작 수와 같다", () => {
    for (const g of TITLE_MISSION_GUIDES) {
      const judge = g.sections.find((s) => s.key === "judge")!.points.join(" ");
      expect(judge).toContain(`${totalMoves(g)}동작`);
    }
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify(TITLE_MISSION_GUIDES);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
