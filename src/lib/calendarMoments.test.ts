import { describe, expect, it } from "vitest";
import { dayMoments, freshStartLine, monthMinutes, monthRecap } from "./calendarMoments";
import type { AttendanceDay, MonthCount } from "./attendanceHistory";

const day = (d: string, minutes = 66, measured = false): AttendanceDay => ({
  day: d,
  at: `${d}T10:04:00Z`,
  end: measured ? `${d}T12:00:00Z` : null,
  endSource: measured ? "checkout_scan" : null,
  minutes,
  method: "qr",
  branch: "153복싱짐 선릉역점",
});
const ms = (milestone: number, reachedOn: string | null) => ({ milestone, reachedOn, gems: 0, mileage: 0 });

describe("운동 달력 — 그날의 의미", () => {
  // 최근 순 (서버 list 와 같은 순서)
  const list = [
    day("2026-11-11", 95, true),
    day("2026-11-09"),
    day("2026-11-06"),
    day("2026-11-04", 80, true),
    day("2026-10-12"),
    day("2026-09-30"),
    day("2026-09-28"),
  ];

  it("첫 도장 · 출석 축하는 금색, 다시 시작 · 가장 길게는 글만", () => {
    const m = dayMoments({ list, milestones: [ms(50, "2026-11-06"), ms(100, null)] }, "2026-11-12");
    expect(m.get("2026-09-28")).toEqual({ kind: "first", text: "첫 도장을 찍은 날이에요", gold: true });
    expect(m.get("2026-11-06")).toEqual({ kind: "milestone", text: "출석 50회를 채운 날이에요", gold: true });
    // 10/12 → 11/4 는 23일 만 — 쉰 기간은 말하지 않고 '다시 시작'
    expect(m.get("2026-11-04")).toEqual({ kind: "restart", text: "다시 시작한 날이에요", gold: false });
    // 11월 4번 중 실제로 잰 95분이 뚜렷이 가장 길다 — 이번 달이면 '이번 달'
    expect(m.get("2026-11-11")).toEqual({ kind: "longest", text: "이번 달 가장 길게 운동한 날이에요", gold: false });
    // 9/30 → 10/12 는 12일 — 14일이 안 되면 아무 말도 없다
    expect(m.has("2026-10-12")).toBe(false);
    expect(m.has("2026-11-09")).toBe(false);
  });

  it("가장 길게 운동한 날 — 지난 달은 달 이름으로, 기본 시간만 있는 달 · 3번이 안 되는 달 · 같은 시간이 둘이면 말하지 않는다", () => {
    const oct = [day("2026-10-05", 120, true), day("2026-10-07"), day("2026-10-09"), day("2026-10-01")];
    expect(dayMoments({ list: oct, milestones: [] }, "2026-11-12").get("2026-10-05")?.text).toBe("10월에 가장 길게 운동한 날이에요");
    const flat = [day("2026-10-05"), day("2026-10-07"), day("2026-10-09"), day("2026-10-01")];
    expect([...dayMoments({ list: flat, milestones: [] }, "2026-11-12").values()].map((x) => x.kind)).toEqual(["first"]);
    const two = [day("2026-10-05", 120, true), day("2026-10-01")];
    expect(dayMoments({ list: two, milestones: [] }, "2026-11-12").has("2026-10-05")).toBe(false);
    const tie = [day("2026-10-09", 120, true), day("2026-10-07", 120, true), day("2026-10-05"), day("2026-10-01")];
    expect(dayMoments({ list: tie, milestones: [] }, "2026-11-12").has("2026-10-09")).toBe(false);
  });

  it("같은 날이면 첫 도장 > 출석 축하 > 다시 시작 > 가장 길게 · 기록이 없으면 빈 지도 · 잘못된 날짜는 건너뜀", () => {
    const m = dayMoments({ list: [day("2026-11-04"), day("bad")], milestones: [ms(1, "2026-11-04")] }, "2026-11-12");
    expect(m.get("2026-11-04")?.kind).toBe("first");
    expect(m.size).toBe(1);
    expect(dayMoments({ list: [], milestones: [ms(50, "2026-11-06")] }, "2026-11-12").size).toBe(0);
  });

  it("어떤 글에도 못한 것(빠진 · 쉰 · 줄어든 · 밖에)이 없다", () => {
    const m = dayMoments({ list, milestones: [ms(50, "2026-11-06")] }, "2026-11-12");
    for (const v of m.values()) expect(v.text).not.toMatch(/빠진|쉰|쉬었|줄|밖에|못/);
  });
});

describe("운동 달력 — 달 돌아보기", () => {
  const monthly: MonthCount[] = [
    { month: "2026-09", days: 8, minutes: 600 },
    { month: "2026-10", days: 10, minutes: 852 },
    { month: "2026-11", days: 4, minutes: 300 },
  ];
  const data = { list: [day("2026-08-20", 70)], monthly };

  it("그 달 운동 시간 — 서버 월별 값이 먼저, 없으면 날마다 목록", () => {
    expect(monthMinutes(data, "2026-10")).toBe(852);
    expect(monthMinutes(data, "2026-08")).toBe(70);
    expect(monthMinutes(data, "2026-07")).toBe(0);
  });

  it("지난 달 한 줄 — 앞 달보다 늘었을 때만 비교, 줄었으면 비교 없이", () => {
    expect(monthRecap(data, "2026-10")).toEqual({
      month: "2026-10",
      minutes: 852,
      text: "10월 · 14시간 12분 운동했어요",
      gain: "9월보다 +4시간 12분",
    });
    // 11월(300분)은 10월(852분)보다 적다 — 줄어든 것은 말하지 않는다
    expect(monthRecap(data, "2026-11")?.gain).toBeNull();
    // 앞 달 기록이 없으면 비교 없음 · 운동하지 않은 달은 줄 자체가 없다
    expect(monthRecap(data, "2026-08")?.gain).toBeNull();
    expect(monthRecap(data, "2026-07")).toBeNull();
    // 5분 차이는 늘었다고 하지 않는다 (0.1시간 미만)
    expect(monthRecap({ list: [], monthly: [{ month: "2026-01", days: 1, minutes: 100 }, { month: "2026-02", days: 1, minutes: 105 }] }, "2026-02")?.gain).toBeNull();
  });

  it("새 달 첫 7일 — 지난달 한 줄과 다음 한 걸음, 8일부터 · 지난달 기록이 없으면 없음", () => {
    expect(freshStartLine(data, "2026-11-03")).toBe("지난달 14시간 12분 운동했어요 · 11월도 이어 가요");
    expect(freshStartLine(data, "2026-11-07")).not.toBeNull();
    expect(freshStartLine(data, "2026-11-08")).toBeNull();
    expect(freshStartLine({ list: [], monthly: [] }, "2026-11-03")).toBeNull();
    // 해가 바뀌어도 — 1월 첫 주에는 12월
    expect(freshStartLine({ list: [], monthly: [{ month: "2026-12", days: 3, minutes: 200 }] }, "2027-01-02")).toBe(
      "지난달 3시간 20분 운동했어요 · 1월도 이어 가요",
    );
  });
});
