import { describe, expect, it } from "vitest";
import { attendanceCheer, kstToday, monthGain, renewalBadge, renewalWindow } from "./attendanceCheer";

const base = { total: 37, month: 4, lastMonth: 9, weekStreak: 0, bestWeekStreak: 6, thisWeek: false, next: 50 };
const BANNED = /벨트|계급|무조건|확정 혜택|자동 가산점|손해|평균|줄었/;

describe("monthGain — 늘었을 때만", () => {
  it("늘면 차이, 줄거나 같거나 지난달 0이면 null", () => {
    expect(monthGain(12, 9)).toBe(3);
    expect(monthGain(4, 9)).toBeNull();
    expect(monthGain(9, 9)).toBeNull();
    expect(monthGain(5, 0)).toBeNull();
  });
});

describe("attendanceCheer — 늘 긍정적인 한 줄", () => {
  it("0회 — 첫 출석", () => expect(attendanceCheer({ ...base, total: 0 }).text).toContain("첫 출석"));
  it("축하까지 5번 이하가 가장 먼저", () => {
    expect(attendanceCheer({ ...base, total: 46, weekStreak: 8, thisWeek: true }).text).toBe("4번만 더 오면 출석 50회 축하예요");
  });
  it("3주 이상 연속 — 이번 주 아직이면 '이번 주도 이어 가요'", () => {
    expect(attendanceCheer({ ...base, weekStreak: 5, thisWeek: false }).text).toContain("5주 연속 출석 중 — 이번 주도 이어 가요");
    expect(attendanceCheer({ ...base, weekStreak: 6, bestWeekStreak: 6, thisWeek: true }).text).toContain("내 최고 기록");
    expect(attendanceCheer({ ...base, weekStreak: 3, bestWeekStreak: 10, thisWeek: true }).text).toContain("한 주도 안 빠졌어요");
  });
  it("지난달보다 늘었을 때", () => {
    expect(attendanceCheer({ ...base, month: 11, lastMonth: 9, weekStreak: 1, thisWeek: true }).text).toBe("이번 달 벌써 지난달보다 2번 더 왔어요");
  });
  it("이번 주 출석 · 연속 1~2주 · 한동안 못 왔을 때도 탓하지 않는다", () => {
    expect(attendanceCheer({ ...base, weekStreak: 1, thisWeek: true }).text).toContain("이번 주도 출석 완료");
    expect(attendanceCheer({ ...base, weekStreak: 2, thisWeek: false }).text).toContain("2주 연속 출석 중");
    const gap = attendanceCheer({ ...base, weekStreak: 0, thisWeek: false }).text;
    expect(gap).toContain("다시 연속 출석이 시작돼요");
  });
  it("어떤 경우에도 손해 · 평균 · 줄었다 · 금지 표현 없음", () => {
    for (const total of [0, 1, 37, 46, 107]) for (const ws of [0, 1, 2, 3, 8]) for (const tw of [true, false]) for (const [m, l] of [[0, 9], [4, 9], [12, 9], [3, 0]]) {
      expect(attendanceCheer({ total, month: m, lastMonth: l, weekStreak: ws, bestWeekStreak: 8, thisWeek: tw, next: 50 }).text).not.toMatch(BANNED);
    }
  });
});

describe("renewalWindow — 만료 21일 전 ~ 끝나고 14일", () => {
  it("범위 안 · 밖", () => {
    expect(renewalWindow("2026-11-11", "2026-10-21")).toEqual({ ddays: 21, ended: false });
    expect(renewalWindow("2026-11-12", "2026-10-21")).toBeNull();
    expect(renewalWindow("2026-10-21", "2026-10-21")).toEqual({ ddays: 0, ended: false });
    expect(renewalWindow("2026-10-07", "2026-10-21")).toEqual({ ddays: -14, ended: true });
    expect(renewalWindow("2026-10-06", "2026-10-21")).toBeNull();
    expect(renewalWindow(null, "2026-10-21")).toBeNull();
    expect(renewalWindow("bad", "2026-10-21")).toBeNull();
  });
  it("달이 바뀌어도 · 표시", () => {
    expect(renewalWindow("2026-11-03", "2026-10-28")?.ddays).toBe(6);
    expect(renewalBadge({ ddays: 7, ended: false })).toBe("D-7");
    expect(renewalBadge({ ddays: 0, ended: false })).toBe("오늘까지");
    expect(renewalBadge({ ddays: -3, ended: true })).toBe("끝난 지 3일");
  });
  it("KST 오늘 — UTC 15시 이후는 다음 날", () => {
    expect(kstToday(Date.UTC(2026, 9, 21, 14, 59))).toBe("2026-10-21");
    expect(kstToday(Date.UTC(2026, 9, 21, 15, 0))).toBe("2026-10-22");
  });
});
