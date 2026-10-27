import { describe, expect, it } from "vitest";
import {
  clockLabel,
  dayLabel,
  nextLabel,
  nextOccurrence,
  remindChip,
  remindLabel,
  repeatLabel,
  scheduleDraftError,
  soonLabel,
  startsSoon,
  whenLabel,
} from "./officeSchedule";

/** 한국 시각 → Date */
const kst = (s: string) => new Date(`${s}+09:00`);

describe("정기 회의 — 다음 시작 시각 (서버 _office_next_at 과 같은 답)", () => {
  const tueNight = kst("2026-10-27T22:00:00");

  it("매주 월 · 수 10:00 — 화요일 밤이면 수요일 아침", () => {
    expect(nextOccurrence([1, 3], null, "10:00", tueNight)?.toISOString()).toBe("2026-10-28T01:00:00.000Z");
  });

  it("딱 그 시각이면 그 차례, 1분 지나면 다음 차례(월요일)", () => {
    expect(nextOccurrence([1, 3], null, "10:00", kst("2026-10-28T10:00:00"))?.toISOString()).toBe("2026-10-28T01:00:00.000Z");
    expect(nextOccurrence([1, 3], null, "10:00", kst("2026-10-28T10:01:00"))?.toISOString()).toBe("2026-11-02T01:00:00.000Z");
  });

  it("같은 요일이면 오늘 남은 시간 또는 다음 주", () => {
    expect(nextOccurrence([2], null, "23:30", tueNight)?.toISOString()).toBe("2026-10-27T14:30:00.000Z");
    expect(nextOccurrence([2], null, "21:00", tueNight)?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });

  it("한 번만 — 지났으면 없음", () => {
    expect(nextOccurrence([], "2026-10-27", "21:00", tueNight)).toBeNull();
    expect(nextOccurrence([], "2026-10-29", "15:00", tueNight)?.toISOString()).toBe("2026-10-29T06:00:00.000Z");
  });

  it("요일 · 시간이 없으면 없음", () => {
    expect(nextOccurrence([], null, "10:00", tueNight)).toBeNull();
    expect(nextOccurrence([1], null, "25:00", tueNight)).toBeNull();
  });
});

describe("정기 회의 — 화면 글 (서버 _office_schedule_when 과 같은 글)", () => {
  it("반복 · 시간", () => {
    expect(whenLabel([3, 1, 3], null, "10:00")).toBe("매주 월 · 수 오전 10:00");
    expect(whenLabel([0, 6], null, "12:30")).toBe("매주 토 · 일 오후 12:30");
    expect(whenLabel([1, 2, 3, 4, 5], null, "09:05")).toBe("평일 오전 9:05");
    expect(whenLabel([0, 1, 2, 3, 4, 5, 6], null, "00:00")).toBe("매일 오전 12:00");
    expect(whenLabel([], "2026-10-28", "15:00")).toBe("10월 28일 (수) 오후 3:00");
  });

  it("시계 · 날짜 · 알림", () => {
    expect(clockLabel("15:05")).toBe("오후 3:05");
    expect(clockLabel("12:30")).toBe("오후 12:30");
    expect(dayLabel("2026-11-02")).toBe("11월 2일 (월)");
    expect(repeatLabel([5], null)).toBe("매주 금");
    expect(remindLabel(10)).toBe("10분 전 알림");
    expect(remindLabel(60)).toBe("1시간 전 알림");
    expect(remindLabel(0)).toBe("알림 안 함");
    expect(remindChip(60)).toBe("1시간 전");
  });

  it("다음 회의 — 오늘 · 내일 · 날짜", () => {
    const now = kst("2026-10-27T23:00:00");
    expect(nextLabel("2026-10-27T14:30:00Z", now)).toBe("오늘 오후 11:30");
    expect(nextLabel("2026-10-28T01:00:00Z", now)).toBe("내일 오전 10:00");
    expect(nextLabel("2026-11-02T01:00:00Z", now)).toBe("11월 2일 (월) 오전 10:00");
  });

  it("곧 시작 — 1시간 안만, 지난 것은 아님", () => {
    const now = kst("2026-10-28T09:12:00");
    expect(startsSoon("2026-10-28T01:00:00Z", now)).toBe(true);
    expect(soonLabel("2026-10-28T01:00:00Z", now)).toBe("48분 뒤");
    expect(startsSoon("2026-10-28T01:00:00Z", kst("2026-10-28T08:59:00"))).toBe(false);
    expect(startsSoon("2026-10-28T01:00:00Z", kst("2026-10-28T10:01:00"))).toBe(false);
    expect(soonLabel("2026-10-28T01:00:00Z", kst("2026-10-28T09:00:00"))).toBe("1시간 뒤");
  });
});

describe("정기 회의 — 저장 전 검사", () => {
  const now = kst("2026-10-27T23:00:00");
  const base = { title: "주간 회의", mode: "weekly" as const, weekdays: [1], onceOn: "", at: "10:00" };

  it("이름 · 요일 · 시간", () => {
    expect(scheduleDraftError(base, now)).toBeNull();
    expect(scheduleDraftError({ ...base, title: "  " }, now)).toBe("회의 이름을 적어 주세요");
    expect(scheduleDraftError({ ...base, weekdays: [] }, now)).toBe("요일을 하나 이상 골라 주세요");
    expect(scheduleDraftError({ ...base, at: "" }, now)).toBe("시간을 골라 주세요");
  });

  it("한 번만 — 날짜가 있어야 하고 지난 시간은 안 된다", () => {
    expect(scheduleDraftError({ ...base, mode: "once", onceOn: "" }, now)).toBe("날짜를 골라 주세요");
    expect(scheduleDraftError({ ...base, mode: "once", onceOn: "2026-10-27", at: "21:00" }, now)).toMatch(/이미 지난 시간/);
    expect(scheduleDraftError({ ...base, mode: "once", onceOn: "2026-10-28", at: "15:00" }, now)).toBeNull();
  });
});
