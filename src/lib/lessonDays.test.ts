import { describe, expect, it } from "vitest";
import {
  dayStatus,
  groupByLevel,
  indexByDayNo,
  leagueOf,
  levelLong,
  levelShort,
  normalizeDay,
  normalizeStep,
  normalizeToday,
  resolveDay,
  shortAmount,
  todayHeadline,
  type LessonToday,
} from "./lessonDays";

const row = (dayNo: number, level: number, dayInLevel: number, extra: Record<string, unknown> = {}) => ({
  id: `id-${dayNo}`,
  level,
  day_in_level: dayInLevel,
  day_no: dayNo,
  title: `${dayNo}일차 제목`,
  goal: "",
  repeat_of_day: null,
  steps: [{ kind: "warmup", name: "워밍업 · 줄넘기", amount: "2분 × 3라운드", how: ["줄넘기"] }],
  note: "",
  ...extra,
});

const today = (p: Partial<LessonToday>): LessonToday => ({
  currentLevel: 1,
  level: 1,
  dayInLevel: 1,
  dayNo: 1,
  attendedToday: false,
  promotedToday: false,
  daysInLevel: 0,
  ...p,
});

describe("normalizeStep", () => {
  it("DB 칸을 화면용으로 바꾼다", () => {
    const s = normalizeStep({
      kind: "punch", name: " 원투 ", amount: "4라운드", is_new: true,
      how: ["하나", "", 3, " 둘 "], watch: ["중심"], tip: "  ", video_mission_id: "abc",
    });
    expect(s).toEqual({
      kind: "punch", name: "원투", amount: "4라운드", isNew: true,
      how: ["하나", "둘"], watch: ["중심"], tip: null, videoMissionId: "abc",
    });
  });
  it("이름이 없거나 모양이 틀리면 버린다", () => {
    expect(normalizeStep({ kind: "punch", amount: "1라운드" })).toBeNull();
    expect(normalizeStep(null)).toBeNull();
    expect(normalizeStep(["x"])).toBeNull();
    expect(normalizeStep("원투")).toBeNull();
  });
  it("모르는 kind 는 punch, 영상 null 은 없음", () => {
    const s = normalizeStep({ kind: "??", name: "잽", amount: "1R", video_mission_id: null });
    expect(s?.kind).toBe("punch");
    expect(s?.videoMissionId).toBeNull();
    expect(s?.isNew).toBe(false);
  });
});

describe("normalizeDay / normalizeToday", () => {
  it("필수 숫자가 없으면 null", () => {
    expect(normalizeDay({ ...row(1, 1, 1), day_no: null })).toBeNull();
    expect(normalizeDay(undefined)).toBeNull();
  });
  it("깨진 단계만 빼고 살린다", () => {
    const d = normalizeDay(row(1, 1, 1, { steps: [{ name: "잽", amount: "1R" }, { amount: "x" }, 7] }));
    expect(d?.steps.map((s) => s.name)).toEqual(["잽"]);
  });
  it("서버 오늘 응답", () => {
    const t = normalizeToday({ current_level: 2, level: 1, day_in_level: 3, day_no: 3, attended_today: true, promoted_today: true, days_in_level: 0 });
    expect(t).toEqual({ currentLevel: 2, level: 1, dayInLevel: 3, dayNo: 3, attendedToday: true, promotedToday: true, daysInLevel: 0 });
    expect(normalizeToday({ current_level: 5, level: null, day_no: null })?.level).toBeNull();
  });
});

describe("resolveDay", () => {
  const days = [
    normalizeDay(row(1, 1, 1))!,
    normalizeDay(row(2, 1, 2, { steps: [], repeat_of_day: 1 }))!,
    normalizeDay(row(3, 1, 3, { steps: [], repeat_of_day: 2 }))!,
    normalizeDay(row(4, 2, 1, { steps: [], repeat_of_day: 9 }))!,
  ];
  const idx = indexByDayNo(days);
  it("반복하는 날은 앞날 내용을 빌린다", () => {
    const r = resolveDay(days[1], idx);
    expect(r.steps).toBe(days[0].steps);
    expect(r.repeatOf?.dayNo).toBe(1);
  });
  it("반복의 반복도 따라간다 — 표시는 바로 가리킨 날", () => {
    const r = resolveDay(days[2], idx);
    expect(r.steps).toBe(days[0].steps);
    expect(r.repeatOf?.dayNo).toBe(2);
  });
  it("가리킨 날이 없으면 빈 수업", () => {
    expect(resolveDay(days[3], idx)).toEqual({ steps: [], repeatOf: null });
  });
  it("보통 날은 그대로", () => {
    expect(resolveDay(days[0], idx).repeatOf).toBeNull();
  });
});

describe("레벨 표기", () => {
  it("전역 레벨 → 리그", () => {
    expect(leagueOf(1)).toEqual({ league: "white", n: 1 });
    expect(leagueOf(10)).toEqual({ league: "white", n: 10 });
    expect(leagueOf(11)).toEqual({ league: "blue", n: 1 });
    expect(leagueOf(40)).toEqual({ league: "black", n: 10 });
    expect(leagueOf(0)).toEqual({ league: "white", n: 1 });
    expect(leagueOf(99)).toEqual({ league: "black", n: 10 });
  });
  it("153 표기 — 벨트·계급 없이 리그·레벨", () => {
    expect(levelLong(2)).toBe("화이트 리그 · 레벨 2");
    expect(levelShort(12)).toBe("블루 L2");
  });
});

describe("오늘 카드", () => {
  it("머리말", () => {
    expect(todayHeadline(today({ attendedToday: true }))).toBe("오늘 수업");
    expect(todayHeadline(today({ daysInLevel: 0, dayNo: 1 }))).toBe("다음 수업");
    expect(todayHeadline(today({ daysInLevel: 1, dayNo: 2 }))).toBe("다음 수업");
    expect(todayHeadline(today({ level: 2, daysInLevel: 0, dayNo: 4 }))).toBe("다음 수업");
  });
  it("목록 표시", () => {
    const d = (n: number, lv: number) => normalizeDay(row(n, lv, ((n - 1) % 3) + 1))!;
    const t = today({ dayNo: 4, level: 2, currentLevel: 2 });
    expect([1, 3, 4, 5].map((n) => dayStatus(d(n, n <= 3 ? 1 : 2), t))).toEqual(["done", "done", "current", "upcoming"]);
    const high = today({ currentLevel: 5, level: null, dayNo: null });
    expect(dayStatus(d(6, 2), high)).toBe("done");
    expect(dayStatus(d(6, 2), null)).toBe("none");
  });
});

describe("groupByLevel / shortAmount", () => {
  it("레벨 순 · 일차 순", () => {
    const g = groupByLevel([normalizeDay(row(5, 2, 2))!, normalizeDay(row(1, 1, 1))!, normalizeDay(row(4, 2, 1))!]);
    expect(g.map((x) => [x.level, x.days.map((d) => d.dayNo)])).toEqual([[1, [1]], [2, [4, 5]]]);
  });
  it("칩용 짧은 분량", () => {
    expect(shortAmount("2분 × 3라운드")).toBe("2분×3R");
    expect(shortAmount("2라운드 (최대 3라운드)")).toBe("2R");
    expect(shortAmount("보통 2라운드 (최대 3라운드)")).toBe("2R");
    expect(shortAmount("3~5라운드 정도")).toBe("3~5R");
    expect(shortAmount("1라운드 정도")).toBe("1R");
    expect(shortAmount("3~5라운드")).toBe("3~5R");
    expect(shortAmount("20개 × 3세트")).toBe("20×3");
  });
});
