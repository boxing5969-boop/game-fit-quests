import { describe, expect, it } from "vitest";
import { holidayOn } from "@/lib/krHolidays";
import {
  LUNAR_MAX_YEAR,
  LUNAR_MIN_YEAR,
  LUNAR_OCC_MAX,
  leapMonthOf,
  lunarAdjustNote,
  lunarDatesBetween,
  lunarLabel,
  lunarMonths,
  lunarOccurrences,
  lunarToSolar,
  solarToLunar,
} from "@/lib/lunar";

const add = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);

describe("음력 표", () => {
  it("달이 빈틈없이 이어지고 해마다 12 · 13달", () => {
    const ms = lunarMonths();
    for (let i = 1; i < ms.length; i++) expect(ms[i].start).toBe(add(ms[i - 1].start, ms[i - 1].days));
    for (let y = LUNAR_MIN_YEAR; y <= LUNAR_MAX_YEAR; y++) {
      const n = ms.filter((x) => x.y === y).length;
      expect(n).toBe(leapMonthOf(y) ? 13 : 12);
    }
    expect(ms[0]).toMatchObject({ y: 2025, m: 1, leap: false, start: "2025-01-29" });
  });

  it("윤달 — 2025 윤6월 · 2028 윤5월 · 2031 윤3월 · 2033 윤11월 · 2036 윤6월 (KASI)", () => {
    expect(lunarMonths().filter((x) => x.leap).map((x) => `${x.y}-${x.m}`)).toEqual(["2025-6", "2028-5", "2031-3", "2033-11", "2036-6"]);
    expect(lunarToSolar(2025, 6, 1, true)).toBe("2025-07-25");
    expect(lunarToSolar(2025, 6, 1, false)).toBe("2025-06-25");
  });

  it("설날 · 추석이 월력요항 공휴일(krHolidays)과 같다 — 2026 ~ 2028", () => {
    for (const y of [2026, 2027, 2028]) {
      const seol = lunarToSolar(y, 1, 1) as string;
      const chu = lunarToSolar(y, 8, 15) as string;
      for (const d of [add(seol, -1), seol, add(seol, 1)]) expect(holidayOn(d)).toContain("설날");
      for (const d of [add(chu, -1), chu, add(chu, 1)]) expect(holidayOn(d)).toContain("추석"); // 2028-10-03 = 추석 · 개천절
    }
    expect(lunarToSolar(2026, 1, 1)).toBe("2026-02-17");
    expect(lunarToSolar(2026, 8, 15)).toBe("2026-09-25");
  });

  it("양력 → 음력 → 양력이 하루도 어긋나지 않는다 (2025-02 ~ 2037-01)", () => {
    for (let d = "2025-02-01"; d <= "2037-01-31"; d = add(d, 1)) {
      const l = solarToLunar(d);
      expect(l).not.toBeNull();
      expect(lunarToSolar(l!.y, l!.m, l!.d, l!.leap)).toBe(d);
    }
    expect(solarToLunar("2024-12-31")).toBeNull();
    expect(solarToLunar("2040-01-01")).toBeNull();
  });

  it("한국 관습 — 윤달이 없는 해는 평달 · 30일이 없는 달은 29일", () => {
    expect(lunarToSolar(2026, 6, 1, true)).toBe(lunarToSolar(2026, 6, 1, false));
    const m29 = lunarMonths().find((x) => x.y === 2026 && x.days === 29 && !x.leap)!;
    expect(lunarToSolar(2026, m29.m, 30)).toBe(lunarToSolar(2026, m29.m, 29));
    expect(lunarAdjustNote(2026, 6, 1, true)).toBe("2026년에는 윤6월이 없어 6월 1일로 챙겨요");
    expect(lunarAdjustNote(2026, m29.m, 30, false)).toBe(`2026년 ${m29.m}월은 29일까지라 29일로 챙겨요`);
    expect(lunarAdjustNote(2026, 1, 1, false)).toBeNull();
    expect(lunarToSolar(2026, 13, 1)).toBeNull();
    expect(lunarToSolar(2026, 1, 31)).toBeNull();
    expect(lunarToSolar(2040, 1, 1)).toBeNull();
  });

  it("기념일 날들 — 해마다 하나 · 서버 범위(오늘 400일 전 ~ 3700일 뒤) · 12개까지", () => {
    const today = "2026-11-14";
    const occ = lunarOccurrences(3, 15, false, today);
    expect(occ.length).toBeGreaterThan(8);
    expect(occ.length).toBeLessThanOrEqual(LUNAR_OCC_MAX);
    expect(occ[0] >= add(today, -400)).toBe(true);
    expect(occ[occ.length - 1] <= add(today, 3700)).toBe(true);
    expect(new Set(occ.map((d) => d.slice(0, 4))).size).toBe(occ.length);
    for (const d of occ) expect(solarToLunar(d)).toMatchObject({ m: 3, d: 15, leap: false });
    // 윤달 기념일 — 윤달이 있는 해만 윤달 날 · 나머지는 평달
    const leapOcc = lunarDatesBetween(6, 1, true, "2025-01-01", "2036-12-31");
    expect(leapOcc).toContain("2025-07-25");
    expect(leapOcc).toContain(lunarToSolar(2026, 6, 1, false));
    expect(lunarOccurrences(3, 15, false, "bad")).toEqual([]);
  });

  it("글", () => {
    expect(lunarLabel({ m: 3, d: 15 })).toBe("음력 3월 15일");
    expect(lunarLabel({ m: 6, d: 1, leap: true })).toBe("음력 윤6월 1일");
  });
});
