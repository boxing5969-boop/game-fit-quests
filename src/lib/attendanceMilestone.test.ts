import { describe, expect, it } from "vitest";
import { attendanceLetter, milestoneProgress, normalizeAttendanceStats, shortDate } from "./attendanceMilestone";

describe("normalizeAttendanceStats", () => {
  it("서버 값을 그대로 읽는다", () => {
    const s = normalizeAttendanceStats({
      total: 103, month: 9, last_month: 14, since: "2026-02-03", records_since: "2026-02-01", is_staff: false,
      step: 50, next: 150, next_gems: 3000, next_mileage: 1000,
      milestones: [
        { milestone: 100, reached_on: "2026-10-01", gems: 2000, mileage: 1000, seen: false },
        { milestone: 50, reached_on: "2026-06-12", gems: 1000, mileage: 1000, seen: true },
      ],
      unseen: { milestone: 100, count: 1, gems: 2000, mileage: 1000 },
    });
    expect(s.total).toBe(103);
    expect(s.month).toBe(9);
    expect(s.lastMonth).toBe(14);
    expect(s.next).toBe(150);
    expect(s.nextGems).toBe(3000);
    expect(s.milestones.map((m) => m.milestone)).toEqual([50, 100]);
    expect(s.unseen).toEqual({ milestone: 100, count: 1, gems: 2000, mileage: 1000 });
  });
  it("가장 많이 운동한 달 — 시간 기준 (2026-10-22)", () => {
    expect(normalizeAttendanceStats({ best_month_minutes: { month: "2026-04", minutes: 1080, days: 16 } }).bestMinutesMonth).toEqual({ month: "2026-04", minutes: 1080, days: 16 });
    expect(normalizeAttendanceStats({ best_month_minutes: null }).bestMinutesMonth).toBeNull();
    expect(normalizeAttendanceStats({ best_month_minutes: { month: "2026-04", minutes: 0, days: 3 } }).bestMinutesMonth).toBeNull();
    expect(normalizeAttendanceStats({}).bestMinutesMonth).toBeNull();
  });
  it("빈 응답 · 이상한 값은 0 · 빈 값", () => {
    const s = normalizeAttendanceStats(null);
    expect(s.total).toBe(0);
    expect(s.next).toBe(50);
    expect(s.milestones).toEqual([]);
    expect(s.unseen).toBeNull();
    expect(normalizeAttendanceStats({ total: "abc", unseen: { milestone: 0 } }).unseen).toBeNull();
    expect(normalizeAttendanceStats({ total: -5 }).total).toBe(0);
  });
});

describe("milestoneProgress", () => {
  it("다음 축하까지 남은 횟수 · 비율", () => {
    expect(milestoneProgress(0)).toEqual({ next: 50, left: 50, ratio: 0 });
    expect(milestoneProgress(37)).toEqual({ next: 50, left: 13, ratio: 37 / 50 });
    expect(milestoneProgress(50)).toEqual({ next: 100, left: 50, ratio: 0 });
    expect(milestoneProgress(149)).toEqual({ next: 150, left: 1, ratio: 49 / 50 });
  });
});

describe("attendanceLetter", () => {
  it("50 · 100 · 150 회 문구와 선물", () => {
    const a = attendanceLetter("펀치", { milestone: 50, count: 1, gems: 1000, mileage: 1000 });
    expect(a.title).toBe("출석 50회를 채운\n펀치님께");
    expect(a.body).toContain("처음 50번이 가장 어렵다고 해요");
    expect(a.body).toContain("챔피언 머니 +1,000 · 마일리지 +1,000점");
    expect(a.body).toContain("다음 100회에서 또 축하할게요");
    const b = attendanceLetter("펀치", { milestone: 100, count: 2, gems: 3000, mileage: 2000 });
    expect(b.body).toContain("세 자리 숫자의 출석");
    expect(b.body).toContain("챔피언 머니 +3,000 · 마일리지 +2,000점");
    const c = attendanceLetter("", { milestone: 150, count: 1, gems: 3000, mileage: 1000 });
    expect(c.title).toContain("복서님께");
    expect(c.body).toContain("150번.");
  });
  it("금지 표현이 없다", () => {
    for (const m of [50, 100, 150, 200]) {
      const l = attendanceLetter("펀치", { milestone: m, count: 1, gems: 1000, mileage: 1000 });
      expect(`${l.title}${l.body}${l.cta}`).not.toMatch(/벨트|계급|무조건|확정 혜택|자동 가산점/);
    }
  });
});

describe("shortDate", () => {
  it("'2026-07-12' → '7.12'", () => {
    expect(shortDate("2026-07-12")).toBe("7.12");
    expect(shortDate(null)).toBe("");
  });
});
