import { describe, expect, it } from "vitest";
import { GROWTH_LESSONS, todayLesson, type GrowthLesson } from "./growthLessons";

const mk = (id: string, from: string): GrowthLesson => ({
  id,
  from,
  theme: id,
  title: id,
  hook: id,
  story: [id],
  directions: [{ title: id, body: id }],
  pledge: id,
});

describe("오늘의 1분 성장 교육 — 어떤 교육을 보여 줄지", () => {
  it("시작 전이면 없음 · 시작한 날부터 가장 최근 교육", () => {
    const list = [mk("a", "2026-10-27")];
    expect(todayLesson("2026-10-26", list)).toBeNull();
    expect(todayLesson("2026-10-27", list)?.id).toBe("a");
    expect(todayLesson("2026-12-01", list)?.id).toBe("a");
  });

  it("새 교육은 7일 동안 오늘의 교육 · 그 뒤로는 날마다 돌아가며", () => {
    const list = [mk("new", "2026-11-03"), mk("old", "2026-10-27")];
    expect(todayLesson("2026-11-02", list)?.id).toBe("old");
    expect(todayLesson("2026-11-03", list)?.id).toBe("new");
    expect(todayLesson("2026-11-09", list)?.id).toBe("new");
    const after = ["2026-11-10", "2026-11-11", "2026-11-12"].map((d) => todayLesson(d, list)?.id);
    expect(new Set(after)).toEqual(new Set(["new", "old"]));
  });

  it("교육마다 이야기 · 방향 · 다짐이 있다", () => {
    for (const l of GROWTH_LESSONS) {
      expect(l.story.length).toBeGreaterThan(0);
      expect(l.directions.length).toBeGreaterThan(0);
      expect(l.pledge.length).toBeGreaterThan(0);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(l.from)).toBe(true);
    }
  });
});
