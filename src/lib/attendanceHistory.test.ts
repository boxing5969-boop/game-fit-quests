import { describe, expect, it } from "vitest";
import {
  dayLabel, groupByMonth, kstTime, methodLabel, monthLabel, normalizeAttendanceHistory, sessionMinutes, topHourBucket, topWeekday, weeklyAverage,
} from "./attendanceHistory";

const RAW = {
  total: 107, month: 8, last_month: 9, weeks8: 19, first_day: "2026-02-02", last_day: "2026-10-19", records_since: "2026-02-01",
  monthly: ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-10"].map((m, i) => ({ month: m, days: i })),
  weekday: [26, 23, 21, 22, 14, 0, 1],
  hours: { dawn: 0, morning: 0, noon: 0, afternoon: 0, evening: 95, night: 12 },
  list: [
    { day: "2026-09-30", at: "2026-09-30T10:31:00Z", end: null, method: "broj", branch: "153복싱짐 선릉역점" },
    { day: "2026-10-19", at: "2026-10-19T10:05:00Z", end: "2026-10-19T11:00:00Z", method: "qr_manual", branch: "153복싱짐 선릉역점" },
    { day: "bad", at: "x" },
  ],
  milestones: [{ milestone: 100, reached_on: "2026-10-01", gems: 2000, mileage: 1000 }, { milestone: 50, reached_on: "2026-05-13", gems: 1000, mileage: 1000 }],
};

describe("normalizeAttendanceHistory", () => {
  it("서버 값을 읽고 기록 시작(2월) 전 달은 뺀다", () => {
    const h = normalizeAttendanceHistory(RAW);
    expect(h.total).toBe(107);
    expect(h.monthly.map((m) => m.month)).toEqual(["2026-02", "2026-03", "2026-10"]);
    expect(h.weekday).toEqual([26, 23, 21, 22, 14, 0, 1]);
    expect(h.list.map((d) => d.day)).toEqual(["2026-10-19", "2026-09-30"]);
    expect(h.milestones.map((m) => m.milestone)).toEqual([50, 100]);
  });
  it("빈 응답이면 0 · 빈 배열 (요일은 7칸)", () => {
    const h = normalizeAttendanceHistory(null);
    expect(h.total).toBe(0);
    expect(h.weekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(h.list).toEqual([]);
    expect(topHourBucket(h.hours)).toBeNull();
    expect(topWeekday(h.weekday)).toBe(-1);
  });
});

describe("helpers", () => {
  it("주 평균 · 가장 많은 요일 · 시간대", () => {
    expect(weeklyAverage(19)).toBe(2.4);
    expect(weeklyAverage(0)).toBe(0);
    expect(topWeekday([26, 23, 21, 22, 14, 0, 1])).toBe(0);
    expect(topHourBucket({ dawn: 0, morning: 0, noon: 0, afternoon: 0, evening: 95, night: 12 })?.label).toBe("저녁");
  });
  it("달별로 묶기 — 최근 달 먼저", () => {
    const h = normalizeAttendanceHistory(RAW);
    const g = groupByMonth(h.list);
    expect(g.map((x) => [x.month, x.items.length])).toEqual([["2026-10", 1], ["2026-09", 1]]);
  });
  it("날짜 · 시각 · 이름", () => {
    expect(monthLabel("2026-10")).toBe("2026년 10월");
    expect(monthLabel("2026-02", true)).toBe("2월");
    expect(dayLabel("2026-10-21")).toBe("10.21 (수)");
    expect(dayLabel("2026-10-19")).toBe("10.19 (월)");
    expect(kstTime("2026-10-19T10:05:00Z")).toBe("19:05");
    expect(kstTime("2026-10-19T15:30:00Z")).toBe("00:30");
    expect(methodLabel("qr_manual")).toBe("QR 출석");
    expect(methodLabel("broj")).toBe("얼굴 인식");
  });
  it("운동 시간 — 10분~10시간만", () => {
    expect(sessionMinutes({ day: "2026-10-19", at: "2026-10-19T10:05:00Z", end: "2026-10-19T11:00:00Z", method: "", branch: null })).toBe(55);
    expect(sessionMinutes({ day: "2026-10-19", at: "2026-10-19T10:05:00Z", end: null, method: "", branch: null })).toBeNull();
    expect(sessionMinutes({ day: "2026-10-19", at: "2026-10-19T10:05:00Z", end: "2026-10-19T10:08:00Z", method: "", branch: null })).toBeNull();
  });
});
