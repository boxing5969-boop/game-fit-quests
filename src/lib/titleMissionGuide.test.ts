import { describe, expect, it } from "vitest";
import {
  RED_TITLE_MITT_CHANCES,
  RED_TITLE_MITT_STREAK,
  RED_TITLE_PB_LIMIT_MIN,
  RED_TITLE_REST_MIN,
  TITLE_MISSION_COURSES,
  TITLE_MISSION_GUIDES,
  titleMissionCourseFor,
  titleMissionGuideFor,
  totalMoves,
} from "./titleMissionGuide";
import { TEST153_CAP_MS } from "./test153";

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

  it("레드는 동작 외우기가 아니라 도전 순서 · 블랙은 아직 없다", () => {
    expect(titleMissionGuideFor("red")).toBeNull();
    expect(titleMissionCourseFor("red")).not.toBeNull();
    expect(titleMissionGuideFor("black")).toBeNull();
    expect(titleMissionCourseFor("black")).toBeNull();
    expect(titleMissionCourseFor("white")).toBeNull();
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

  it("레드 = 레벨 30 · 153 PB 22분 → 1분 → 미트 치기 3연속 → 미트 받기 3연속 · 기회 3번 (대표님 2026-10-20)", () => {
    const c = titleMissionCourseFor("red")!;
    expect(c.level).toBe(30);
    expect(RED_TITLE_PB_LIMIT_MIN).toBe(22);
    expect(RED_TITLE_REST_MIN).toBe(1);
    // 22분은 153 PB 타임캡(25분) 안이어야 한다
    expect(RED_TITLE_PB_LIMIT_MIN * 60_000).toBeLessThan(TEST153_CAP_MS);
    expect(c.hero.value).toBe("22");
    expect(c.steps.map((s) => s.title)).toEqual([
      "153 PB 22분 안에 완주",
      "1분 쉬기",
      "미트 치기 — 연타 3번 연속 완벽히",
      "미트 받기 — 3번 연속 완벽히",
    ]);
    // 미트 치기 · 받기 = 기회 3번, 그 안에 3번 연속 완벽 성공이면 통과 (중간에 틀려도 됨)
    expect(RED_TITLE_MITT_CHANCES).toBe(3);
    expect(RED_TITLE_MITT_STREAK).toBe(3);
    expect(c.chances.title).toBe("도전 기회 3번");
    expect(c.chances.text).toContain("중간에 틀려도");
    expect(c.chances.text).toContain("3번 연속으로 완벽히");
    // 라운드당 평균 = 22분 ÷ 8라운드 = 2분 45초
    expect((22 * 60) / 8).toBe(165);
    expect(c.steps[0].detail).toContain("2분 45초");
    // 연타 동작은 아직 없다 — '준비 중'으로 보여 준다
    expect(c.steps[2].pending).toBeTruthy();
    // 파트너: 혼자도 함께도 되지만 미트 받아 줄 파트너는 꼭
    expect(c.partner).toContain("혼자 도전해도");
    expect(c.partner).toContain("함께 도전해도");
    expect(c.partner).toContain("꼭 있어야");
    const keys = c.sections.map((s) => s.key);
    for (const k of ["pb", "rest", "combo", "mitt", "partner", "judge"] as const) expect(keys).toContain(k);
    const judge = c.sections.find((s) => s.key === "judge")!.points.join(" ");
    expect(judge).toContain("22:00");
    expect(judge).toContain("1분 뒤");
    expect(judge).toContain("기회 3번");
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([TITLE_MISSION_GUIDES, TITLE_MISSION_COURSES]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
