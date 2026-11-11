import { describe, expect, it } from "vitest";
import { attendanceByDay, monthBounds, monthOf, monthWeeks, shiftMonth, weekOf } from "./attendanceCalendar";
import type { AttendanceDay } from "./attendanceHistory";

const day = (d: string, at: string): AttendanceDay => ({
  day: d,
  at,
  end: null,
  endSource: null,
  minutes: 66,
  method: "qr",
  branch: "153복싱짐 선릉역점",
});

describe("운동 달력 날짜 계산", () => {
  it("달 넘기기 — 해가 바뀌어도 맞다", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", -10)).toBe("2026-01");
    expect(shiftMonth("잘못된 값", 1)).toBe("잘못된 값");
  });

  it("이번 주 = 월요일부터 일요일까지 7칸", () => {
    expect(weekOf("2026-11-12")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    // 일요일은 그 주의 마지막 칸
    expect(weekOf("2026-11-15")[0]).toBe("2026-11-09");
    expect(weekOf("엉뚱한 날")).toEqual([]);
  });

  it("2026년 11월 — 1일이 일요일이라 6줄, 앞뒤 달 날짜는 inMonth=false", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toEqual({ day: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ day: "2026-11-01", inMonth: true });
    expect(weeks[5][0]).toEqual({ day: "2026-11-30", inMonth: true });
    expect(weeks[5][6]).toEqual({ day: "2026-12-06", inMonth: false });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("2027년 2월 — 월요일에 시작하는 28일은 딱 4줄", () => {
    const weeks = monthWeeks("2027-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].day).toBe("2027-02-01");
    expect(weeks[3][6].day).toBe("2027-02-28");
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });

  it("넘겨 볼 수 있는 달 — 첫 기록 달 ~ 이번 달", () => {
    expect(monthBounds("2026-02-02", "2026-11-12")).toEqual({ min: "2026-02", max: "2026-11" });
    expect(monthBounds(null, "2026-11-12")).toEqual({ min: "2026-11", max: "2026-11" });
    // 미래 날짜 · 잘못된 값은 이번 달만
    expect(monthBounds("2027-01-01", "2026-11-12")).toEqual({ min: "2026-11", max: "2026-11" });
    expect(monthOf("2026-11-12")).toBe("2026-11");
  });

  it("같은 날 두 줄이면 먼저 들어온 출석", () => {
    const map = attendanceByDay([
      day("2026-11-11", "2026-11-11T10:04:00Z"),
      day("2026-11-11", "2026-11-11T09:30:00Z"),
      day("2026-11-09", "2026-11-09T11:00:00Z"),
      day("bad", "2026-11-09T11:00:00Z"),
    ]);
    expect(map.size).toBe(2);
    expect(map.get("2026-11-11")?.at).toBe("2026-11-11T09:30:00Z");
  });
});
