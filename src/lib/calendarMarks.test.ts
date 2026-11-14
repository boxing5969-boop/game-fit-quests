import { describe, expect, it } from "vitest";
import {
  GOAL_MAX,
  actIsGold,
  actText,
  actsOn,
  annivShort,
  annivText,
  ddayChip,
  ddayCount,
  ddayText,
  ddaysOn,
  focusDayOf,
  goalDayBounds,
  goalDraftError,
  goalPayload,
  nextDday,
  normalizeActs,
  normalizeAnnivs,
  normalizeDdays,
  normalizeNotes,
  noteError,
  noteWho,
  quickModeOf,
  sortDdays,
  swipeMonthDelta,
  topActOn,
  withAnnivMoments,
  type CalDday,
} from "./calendarMarks";
import type { DayMoment } from "./calendarMoments";

// 2026-11-13 = 금요일
const T = "2026-11-13";
const NEG = /못|안 했|놓쳤|빠졌|실패|늦었|떨어|탈락/;

describe("그날 한 일 — 서버 값 · 글", () => {
  const acts = normalizeActs([
    { day: "2026-11-10", kind: "pt", coach: "김코치" },
    { day: "2026-11-10", kind: "level", level: 6 },
    { day: "2026-11-09", kind: "pb", division: "open", first: true, best: true },
    { day: "2026-11-08", kind: "pb", division: "starter", first: false, best: true },
    { day: "2026-11-07", kind: "pb", division: "open", first: false, best: false },
    { day: "2026-11-06", kind: "title", passed: false, rank: "white" },
    { day: "2026-11-06", kind: "title", passed: true, rank: "white" },
    { day: "2026-11-05", kind: "pt" },
    { day: "bad", kind: "pt" },
    { day: "2026-11-05", kind: "dance" },
    { day: "2026-11-04", kind: "level", level: 99 },
  ]);

  it("잘못된 줄은 빼고 · 레벨은 1~40만", () => {
    expect(acts).toHaveLength(9);
    expect(acts.at(-1)).toMatchObject({ kind: "level", level: null });
  });

  it("그날 아이콘 하나 = 타이틀매치 > 레벨업 > 153 PB > PT", () => {
    expect(topActOn(acts, "2026-11-10")?.kind).toBe("level");
    expect(actsOn(acts, "2026-11-10").map((a) => a.kind)).toEqual(["level", "pt"]);
    expect(topActOn(acts, "2026-11-06")?.kind).toBe("title");
    expect(topActOn(acts, "2026-11-01")).toBeNull();
  });

  it("글 — 못한 말 없이 · 금색 = 통과 · 첫 기록 · 최고 기록", () => {
    expect(actText(acts[0])).toBe("PT 수업 · 김코치 코치님");
    expect(actText(acts[1])).toBe("레벨업 · Lv.6");
    expect(actText(acts[2])).toBe("153 PB 첫 기록 · 오픈");
    expect(actText(acts[3])).toBe("153 PB 최고 기록 · 스타터");
    expect(actText(acts[4])).toBe("153 PB를 쟀어요 · 오픈");
    expect(actText(acts[5])).toBe("화이트 타이틀매치에 도전했어요");
    expect(actText(acts[6])).toBe("화이트 타이틀매치 통과");
    expect(actText(acts[7])).toBe("PT 수업");
    expect(actText(acts[8])).toBe("레벨업");
    for (const a of acts) expect(actText(a)).not.toMatch(NEG);
    expect(acts.filter(actIsGold).map((a) => a.day)).toEqual(["2026-11-09", "2026-11-08", "2026-11-06"]);
  });
});

describe("코치 한마디", () => {
  it("서버 값 · 누가 · 검사(서버와 같은 말)", () => {
    const notes = normalizeNotes([
      { id: "n1", day: T, who: "김코치", title: "코치", body: "잽 거리가 딱 좋았어요" },
      { id: "n2", day: T, who: "이용희", title: "대표", body: "1년 고마워요" },
      { id: "n3", day: T, body: "" },
      { day: T, body: "id 없음" },
    ]);
    expect(notes.map((n) => noteWho(n))).toEqual(["김코치 코치님", "이용희 대표님"]);
    expect(noteError("   ")).toBe("한마디를 적어 주세요");
    expect(noteError("가".repeat(81))).toBe("한마디는 80자 안으로 적어 주세요");
    expect(noteError(" 가 ".repeat(40))).toBeNull(); // 빈칸은 하나로 줄여 센다
  });
});

describe("153 기념일", () => {
  it("이름 · 그날 한 줄 · 금색 도장(첫 도장 · 출석 축하가 먼저 · 안 온 날은 없음)", () => {
    expect(annivShort({ years: 1, basis: "reg" })).toBe("153 1주년");
    expect(annivShort({ years: 2, basis: "stamp" })).toBe("첫 도장 2주년");
    expect(annivText({ years: 1, basis: "reg" })).toBe("153과 함께한 지 1년이 된 날이에요");
    expect(annivText({ years: 1, basis: "reg" }, true)).toBe("오늘은 153과 함께한 지 1년이에요");
    expect(annivText({ years: 3, basis: "stamp" }, true)).toBe("오늘은 첫 도장을 찍은 지 3년이에요");
    const anniv = normalizeAnnivs([
      { day: "2026-11-01", years: 1, basis: "reg" },
      { day: "2026-11-02", years: 1, basis: "reg" },
      { day: "2026-11-03", years: 1, basis: "reg" },
      { day: "2026-11-04", years: 0, basis: "reg" },
      { day: "2026-11-05", years: 1, basis: "x" },
    ]);
    expect(anniv).toHaveLength(3);
    const base = new Map<string, DayMoment>([
      ["2026-11-02", { kind: "milestone", text: "출석 100회를 채운 날이에요", gold: true }],
      ["2026-11-03", { kind: "restart", text: "다시 시작한 날이에요", gold: false }],
    ]);
    const came = new Set(["2026-11-02", "2026-11-03"]);
    const m = withAnnivMoments(base, anniv, (d) => came.has(d));
    expect(m.get("2026-11-01")).toBeUndefined(); // 안 온 기념일은 말하지 않는다
    expect(m.get("2026-11-02")?.kind).toBe("milestone");
    expect(m.get("2026-11-03")).toEqual({ kind: "anniv", text: "153과 함께한 지 1년이 된 날이에요", gold: true });
    expect(base.get("2026-11-03")?.kind).toBe("restart"); // 받은 표는 그대로
  });
});

describe("153 D-day", () => {
  const dd = normalizeDdays([
    { kind: "goal", id: "g1", day: "2026-11-23", title: "바디프로필" },
    { kind: "pb", day: "2026-11-01" },
    { kind: "anniv", day: "2026-11-18", years: 1, basis: "reg" },
    { kind: "exam", id: "e1", day: "2026-11-16", title: "화이트 타이틀매치 심사" },
    { kind: "retry", day: "2026-11-20" },
    { kind: "goal", day: "2026-11-30", title: "id 없음" },
    { kind: "anniv", day: "2026-11-19" },
    { kind: "party", day: "2026-11-19" },
  ]);

  it("잘못된 줄은 빼고 · 가까운 날 순(지난 153 PB 는 오늘로)", () => {
    expect(dd).toHaveLength(5);
    expect(sortDdays(dd, T).map((d) => d.kind)).toEqual(["pb", "exam", "anniv", "retry", "goal"]);
    expect(nextDday(dd, T)?.kind).toBe("pb");
    expect(nextDday([], T)).toBeNull();
  });

  it("글 — D-n · 오늘 · 지난 153 PB 는 '지금' (늦었다는 말 없이)", () => {
    const pb = dd.find((d) => d.kind === "pb") as CalDday;
    expect(ddayCount(pb, T)).toBe("지금");
    expect(ddayText(pb, T)).toBe("153 PB 다시 잴 때예요");
    expect(ddayChip(pb, T)).toBe("지금 · 153 PB");
    expect(ddayText({ ...pb, day: "2026-11-20" }, T)).toBe("153 PB 다시 재는 날");
    const goal = dd.find((d) => d.kind === "goal") as CalDday;
    expect(ddayChip(goal, T)).toBe("D-10 · 바디프로필");
    expect(ddayChip(dd.find((d) => d.kind === "anniv") as CalDday, T)).toBe("D-5 · 153 1주년");
    expect(ddayText(dd.find((d) => d.kind === "exam") as CalDday, T)).toBe("승급 심사 · 화이트 타이틀매치 심사");
    expect(ddayChip(dd.find((d) => d.kind === "exam") as CalDday, T)).toBe("D-3 · 승급 심사");
    expect(ddayText(dd.find((d) => d.kind === "retry") as CalDday, T)).toBe("타이틀매치 다시 도전할 수 있는 날");
    expect(ddayCount({ day: T }, T)).toBe("오늘");
    for (const d of dd) expect(`${ddayChip(d, T)} ${ddayText(d, T)}`).not.toMatch(NEG);
  });

  it("달력 칸 — 그날 것만 · 지난 날짜는 찍지 않는다", () => {
    expect(ddaysOn(dd, "2026-11-23", T).map((d) => d.id)).toEqual(["g1"]);
    expect(ddaysOn(dd, "2026-11-01", T)).toEqual([]);
  });
});

describe("목표일 정하기 — 서버(set_my_goal_day)와 같은 말", () => {
  it("검사", () => {
    expect(goalDraftError({ title: "  ", day: "2026-11-20" }, T)).toBe("목표 이름을 적어 주세요");
    expect(goalDraftError({ title: "가".repeat(21), day: "2026-11-20" }, T)).toBe("목표 이름은 20자 안으로 적어 주세요");
    expect(goalDraftError({ title: "대회", day: "" }, T)).toBe("날짜를 골라 주세요");
    expect(goalDraftError({ title: "대회", day: T }, T)).toBe("목표일은 내일부터 골라 주세요");
    expect(goalDraftError({ title: "대회", day: "2028-11-13" }, T)).toBe("목표일은 2년 안으로 골라 주세요");
    expect(goalDraftError({ title: "대회", day: "2026-11-14" }, T, GOAL_MAX)).toBe("목표일은 3개까지 정할 수 있어요 · 하나를 빼면 새로 정할 수 있어요");
    expect(goalDraftError({ title: "대회", day: "2026-11-14" }, T, GOAL_MAX, true)).toBeNull();
    expect(goalDraftError({ title: " 바디  프로필 ", day: "2028-11-12" }, T)).toBeNull();
    expect(goalPayload({ title: " 바디  프로필 ", day: "2026-11-20" })).toEqual({ p_id: null, p_day: "2026-11-20", p_title: "바디 프로필" });
    expect(goalDayBounds(T)).toEqual({ min: "2026-11-14", max: "2028-11-12" });
  });
});

describe("밀기 · 길게 누르기 · 알림 링크", () => {
  it("좌우로 밀기 — 왼쪽 = 다음 달 · 세로 · 짧게 · 느리게는 없음", () => {
    expect(swipeMonthDelta(-80, 10, 300)).toBe(1);
    expect(swipeMonthDelta(90, -20, 300)).toBe(-1);
    expect(swipeMonthDelta(-40, 0, 200)).toBe(0);
    expect(swipeMonthDelta(-80, 70, 300)).toBe(0);
    expect(swipeMonthDelta(-120, 0, 1200)).toBe(0);
    expect(swipeMonthDelta(Number.NaN, 0, 100)).toBe(0);
  });

  it("길게 누른 날 — 오늘 · 6일 전까지 · 앞날 · 그 밖은 없음", () => {
    expect(quickModeOf(T, T)).toBe("today");
    expect(quickModeOf("2026-11-07", T)).toBe("past");
    expect(quickModeOf("2026-11-06", T)).toBeNull();
    expect(quickModeOf("2026-11-14", T)).toBe("future");
    expect(quickModeOf("2028-11-13", T)).toBeNull();
    expect(quickModeOf("x", T)).toBeNull();
  });

  it("'/home?cal=날짜' — 오늘까지 · 첫 기록 달부터", () => {
    expect(focusDayOf("2026-11-13", T, "2026-02-02")).toBe("2026-11-13");
    expect(focusDayOf("2026-11-14", T, "2026-02-02")).toBeNull();
    expect(focusDayOf("2026-01-20", T, "2026-02-02")).toBeNull();
    expect(focusDayOf("2026-02-01", T, "2026-02-02")).toBe("2026-02-01");
    expect(focusDayOf(null, T, null)).toBeNull();
    expect(focusDayOf("13-11-2026", T, null)).toBeNull();
    // (3-5) 내 일정 알림 링크 — 앞날도 aheadDays 안이면
    expect(focusDayOf("2026-11-20", T, "2026-02-02", 366)).toBe("2026-11-20");
    expect(focusDayOf("2028-01-01", T, "2026-02-02", 366)).toBeNull();
    expect(focusDayOf("2026-11-20", T, "2026-02-02")).toBeNull();
  });
});
