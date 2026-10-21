import { describe, expect, it } from "vitest";
import {
  bestMonthAllTime, bestMonthByMinutes, dayLabel, durationLabel, groupByMonth, kstTime, measuredDay, methodLabel, monthLabel, normalizeAttendanceHistory, topHourBucket, topWeekday,
} from "./attendanceHistory";

const RAW = {
  total: 107, month: 8, last_month: 9, weeks8: 19, first_day: "2026-02-02", last_day: "2026-10-19", records_since: "2026-02-01",
  total_minutes: 7300, month_minutes: 600, last_month_minutes: 594,
  monthly: ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-10"].map((m, i) => ({ month: m, days: i, minutes: i * 66 })),
  weekday: [26, 23, 21, 22, 14, 0, 1],
  hours: { dawn: 0, morning: 0, noon: 0, afternoon: 0, evening: 95, night: 12 },
  list: [
    { day: "2026-09-30", at: "2026-09-30T10:31:00Z", end: null, end_source: null, minutes: 66, method: "broj", branch: "153복싱짐 선릉역점" },
    { day: "2026-10-19", at: "2026-10-19T10:05:00Z", end: "2026-10-19T11:45:00Z", end_source: "checkout_scan", minutes: 100, method: "qr_manual", branch: "153복싱짐 선릉역점" },
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
    expect([h.totalMinutes, h.monthMinutes, h.lastMonthMinutes]).toEqual([7300, 600, 594]);
    expect(h.monthly.map((m) => m.minutes)).toEqual([198, 264, 330]);
    expect(h.list.map((d) => [d.minutes, d.endSource])).toEqual([[100, "checkout_scan"], [66, null]]);
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
  it("가장 많은 요일 · 시간대", () => {
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
  it("운동 시간 — 잰 날(두 번째 체크 · 운동 종료) · 시간 글자 · 가장 많이 한 달", () => {
    const h = normalizeAttendanceHistory(RAW);
    expect(h.list.map(measuredDay)).toEqual([true, false]);
    expect(durationLabel(100)).toBe("1시간 40분");
    expect(durationLabel(66)).toBe("1시간 6분");
    expect(durationLabel(180)).toBe("3시간");
    expect(durationLabel(45)).toBe("45분");
    expect(bestMonthByMinutes(h.monthly)?.month).toBe("2026-10");
    expect(bestMonthByMinutes([])).toBeNull();
    expect(bestMonthByMinutes([{ month: "2026-09", days: 3, minutes: 200 }, { month: "2026-10", days: 2, minutes: 200 }])?.month).toBe("2026-10");
  });
  it("잰 날 표시는 기본(66분)보다 길게 친 날만 — 66분 안에 누른 종료 · 4시간 넘어 기본으로 돌아간 날은 '기본'", () => {
    const day = { day: "2026-10-20", at: "2026-10-20T10:00:00Z", method: "broj", branch: null };
    expect(measuredDay({ ...day, end: "2026-10-20T11:30:00Z", endSource: "checkout_scan", minutes: 90 })).toBe(true);
    expect(measuredDay({ ...day, end: "2026-10-20T10:40:00Z", endSource: "member_app", minutes: 66 })).toBe(false);
    expect(measuredDay({ ...day, end: "2026-10-20T15:00:00Z", endSource: "member_app", minutes: 66 })).toBe(false);
    expect(measuredDay({ ...day, end: null, endSource: null, minutes: 66 })).toBe(false);
  });
  it("지금까지 가장 많이 운동한 달 — 날마다 목록 전체에서 (같으면 최근 달)", () => {
    const d = (day: string, minutes: number) => ({ day, at: `${day}T10:00:00Z`, end: null, endSource: null, minutes, method: "broj", branch: null });
    expect(bestMonthAllTime([d("2025-03-02", 180), d("2025-03-05", 180), d("2026-10-01", 66)])).toEqual({ month: "2025-03", days: 2, minutes: 360 });
    expect(bestMonthAllTime([d("2026-09-02", 132), d("2026-10-01", 66), d("2026-10-03", 66)])?.month).toBe("2026-10");
    expect(bestMonthAllTime([])).toBeNull();
  });
});
