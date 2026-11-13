import { describe, expect, it } from "vitest";
import { KR_HOLIDAY_YEARS, holidayOn, holidaysBetween, isHoliday } from "./krHolidays";

describe("공휴일 (한국천문연구원 월력요항 2026 ~ 2028)", () => {
  it("대체공휴일 · 선거일 · 겹친 날", () => {
    expect(holidayOn("2026-03-02")).toBe("대체공휴일");
    expect(holidayOn("2026-06-03")).toBe("지방선거");
    expect(holidayOn("2026-10-05")).toBe("대체공휴일");
    expect(holidayOn("2027-02-07")).toBe("설날");
    expect(holidayOn("2027-02-09")).toBe("대체공휴일");
    expect(holidayOn("2027-05-01")).toBe("노동절");
    expect(holidayOn("2028-04-12")).toBe("국회의원 선거");
    expect(holidayOn("2028-10-03")).toBe("추석 · 개천절");
    expect(holidayOn("2028-10-05")).toBe("대체공휴일");
  });
  it("평일 · 표 밖의 해는 없음", () => {
    expect(holidayOn("2026-11-13")).toBeNull();
    expect(isHoliday("2029-01-01")).toBe(false);
    expect(KR_HOLIDAY_YEARS).toEqual([2026, 2027, 2028]);
  });
  it("범위 — 날짜 순", () => {
    const sept = holidaysBetween("2026-09-01", "2026-10-31").map(([d]) => d);
    expect(sept).toEqual(["2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09"]);
  });
  it("해마다 16 ~ 24 날 (설 · 추석 사흘 · 대체공휴일 포함)", () => {
    for (const y of KR_HOLIDAY_YEARS) {
      const n = holidaysBetween(`${y}-01-01`, `${y}-12-31`).length;
      expect(n).toBeGreaterThanOrEqual(16);
      expect(n).toBeLessThanOrEqual(24);
    }
  });
});
