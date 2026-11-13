import { describe, expect, it } from "vitest";
import {
  ddayLabel,
  draftError,
  draftForScope,
  draftFromPlan,
  draftPayload,
  draftPreview,
  mergeWeeks,
  moveFollowing,
  moveFollowingLabel,
  newDraft,
  occursOn,
  planColorHex,
  planRange,
  planRepeatLabel,
  type OpsPlan,
  type PlansWeek,
} from "./opsPlans";

const SL = "153복싱짐 선릉역점";
const today = "2026-11-13";

const plan = (over: Partial<OpsPlan>): OpsPlan => ({
  id: "p",
  user_id: "u",
  branch: SL,
  kind: "class",
  title: "저녁반",
  memo: null,
  masked: false,
  private: false,
  start_on: "2026-11-17",
  end_on: "2026-11-17",
  repeat_weekdays: [],
  until_on: null,
  skip_dates: [],
  all_day: false,
  start_time: "19:00",
  end_time: "20:00",
  mine: true,
  rrule: null,
  color: null,
  location: null,
  reminders: [],
  series_id: null,
  ...over,
});

describe("3-2 넣기 — 반복 규칙 · 알림 · 색 · 장소", () => {
  it("새 일정은 알림 10분 전부터 (대표님 결정 6) · 색 없음", () => {
    const d = newDraft(SL, today, "class", { start: "10:00", end: "11:00" });
    expect(d.reminders).toEqual([10]);
    expect(d.color).toBeNull();
    expect(d.start_time).toBe("10:00");
    expect(d.all_day).toBe(false);
  });

  it("매월 마지막 금요일 · 3번 → 규칙 글 · 요일 칸 비움 · 끝 없음(서버가 계산)", () => {
    const d = { ...newDraft(SL, "2026-11-27"), repeat: true, freq: "MONTHLY" as const, monthMode: "lastWd" as const, endMode: "count" as const, count: 3 };
    expect(draftError(d, today)).toBeNull();
    expect(draftPayload(d)).toMatchObject({ rrule: "FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", repeat_weekdays: [], until_on: null, end_on: "2026-11-27" });
    expect(draftPreview(d)).toEqual(["2026-11-27", "2026-12-25", "2027-01-29"]);
  });

  it("2주마다 화 · 목 · 12/31까지 → 매주 규칙 + 요일 칸(예전 화면용)", () => {
    const d = { ...newDraft(SL, "2026-11-17"), repeat: true, freq: "WEEKLY" as const, interval: 2, repeat_weekdays: [4, 2], endMode: "until" as const, until_on: "2026-12-31" };
    expect(draftPayload(d)).toMatchObject({ rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH", repeat_weekdays: [2, 4], until_on: "2026-12-31" });
  });

  it("검사 말 — 서버와 같은 글", () => {
    const d = { ...newDraft(SL, "2026-11-17"), repeat: true, freq: "WEEKLY" as const };
    expect(draftError({ ...d, endMode: "until", until_on: "" }, today)).toBe("반복이 끝나는 날을 골라 주세요");
    expect(draftError({ ...d, endMode: "count", count: 0 }, today)).toBe("횟수는 1 ~ 200번이에요");
    expect(draftError({ ...d, freq: "YEARLY", interval: 5, endMode: "count", count: 4, start_on: "2027-02-28" }, today)).toBe(
      "반복 횟수를 줄여 주세요 — 10년 안에서 반복해요",
    );
    expect(draftError({ ...d, location: "가".repeat(81) }, today)).toBe("장소는 80자까지예요");
    expect(draftError({ ...d, reminders: [0, 5, 10, 15, 30] }, today)).toBe("알림을 다시 골라 주세요");
    expect(draftError({ ...d, reminders: [7] }, today)).toBe("알림을 다시 골라 주세요");
    // 하루 종일이면 알림은 안 본다 · 보낼 때 비운다
    expect(draftError({ ...d, all_day: true, reminders: [7] }, today)).toBeNull();
    expect(draftPayload({ ...d, all_day: true, reminders: [10] }).reminders).toEqual([]);
  });

  it("고치기 — 이 일정만 = 그날 · 한 번 / 이후 모두 = 그날부터(횟수는 끝나는 날로) / 전체 = 원래 시작", () => {
    const p = plan({ id: "s", start_on: "2026-11-17", rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=4", repeat_weekdays: [2], until_on: "2026-12-08", reminders: [30] });
    const base = draftFromPlan(p);
    expect(base).toMatchObject({ repeat: true, freq: "WEEKLY", endMode: "count", count: 4, reminders: [30] });
    const one = draftForScope(base, p, "one", "2026-11-24");
    expect(draftPayload({ ...one, start_time: "20:00", end_time: "21:00" }, "one", "2026-11-24")).toMatchObject({
      id: "s",
      scope: "one",
      only_date: "2026-11-24",
      rrule: null,
      repeat_weekdays: [],
      start_on: "2026-11-24",
      reminders: [30],
    });
    const fol = draftForScope(base, p, "following", "2026-11-24");
    expect(fol).toMatchObject({ start_on: "2026-11-24", endMode: "until", until_on: "2026-12-08" });
    expect(draftPayload(fol, "following", "2026-11-24")).toMatchObject({ scope: "following", only_date: "2026-11-24", rrule: "FREQ=WEEKLY;BYDAY=TU", until_on: "2026-12-08" });
    const all = draftForScope(fol, p, "all", "2026-11-24");
    expect(draftPayload(all, "all", "2026-11-24")).toMatchObject({ scope: "all", start_on: "2026-11-17", rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=4" });
    expect(draftPayload(all, "all", "2026-11-24")).not.toHaveProperty("only_date");
  });

  it("예전 매주 일정(rrule 없이 요일만)도 규칙으로 읽는다", () => {
    const p = plan({ repeat_weekdays: [2, 4], until_on: "2026-12-31" });
    expect(draftFromPlan(p)).toMatchObject({ repeat: true, freq: "WEEKLY", repeat_weekdays: [2, 4], endMode: "until", until_on: "2026-12-31" });
    expect(planRepeatLabel(p)).toBe("매주 화 · 목 · 12월 31일까지");
    expect(occursOn(p, "2026-11-19")).toBe(true);
    expect(occursOn(p, "2026-11-20")).toBe(false);
  });

  it("매월 · 횟수 · 빼는 날 · 색", () => {
    const p = plan({ start_on: "2026-11-27", rrule: "FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", until_on: "2027-01-29", skip_dates: ["2026-12-25"], color: "grape" });
    expect(planRepeatLabel(p)).toBe("매월 마지막 금요일 · 3번");
    expect(occursOn(p, "2026-12-25")).toBe(false);
    expect(occursOn(p, "2027-01-29")).toBe(true);
    expect(occursOn(p, "2027-02-26")).toBe(false);
    expect(planColorHex(p.color)).toBe("#8E24AA");
    expect(planColorHex("pink")).toBeNull();
  });
});

describe("3-2 보기 범위 · D-day · 주 합치기", () => {
  it("보기마다 받을 범위", () => {
    expect(planRange("mine", "month", "day", "2026-11-13", "2026-11")).toEqual({ from: "2026-11-13", to: "2026-11-13" });
    expect(planRange("mine", "month", "3day", "2026-11-13", "2026-11")).toEqual({ from: "2026-11-13", to: "2026-11-15" });
    expect(planRange("mine", "month", "week", "2026-11-13", "2026-11")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(planRange("mine", "month", "month", "2026-11-13", "2026-11")).toEqual({ from: "2026-10-26", to: "2026-12-06" });
    expect(planRange("mine", "month", "list", "2026-11-13", "2026-11")).toEqual({ from: "2026-11-13", to: "2027-01-11" });
    expect(planRange("mine", "month", "year", "2026-11-13", "2026-11")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(planRange("team", "week", "list", "2026-11-13", "2026-11")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(planRange("team", "month", "day", "2026-11-13", "2026-11")).toEqual({ from: "2026-10-26", to: "2026-12-06" });
  });
  it("D-day", () => {
    expect(ddayLabel("2026-11-13", today)).toBe("D-day");
    expect(ddayLabel("2026-11-16", today)).toBe("D-3");
    expect(ddayLabel("2026-11-12", today)).toBeNull();
  });
  it("주를 합치면 생일도 한 번씩", () => {
    const w = (from: string, b: PlansWeek["birthdays"]): PlansWeek => ({
      branch: SL, branches: [], manage: false, hq: false, me: "u", from, to: from, today, now_hm: "10:00",
      members: [], plans: [], shifts: [], offs: [], recent: [], birthdays: b,
    });
    const m = mergeWeeks([w("2026-11-09", [{ date: "2026-11-13", user_id: "a", name: "에이" }]), w("2026-11-16", [{ date: "2026-11-13", user_id: "a", name: "에이" }, { date: "2026-11-18", user_id: "b", name: "비" }])]);
    expect(m?.birthdays?.map((b) => b.user_id)).toEqual(["a", "b"]);
  });
});

describe("3-2 끌어 옮기기 「이후 모두」 — 나누는 날 · 새 반복", () => {
  const pay = (p: OpsPlan, from: string, to: string, start: string, end: string) => {
    const f = moveFollowing(p, from, to, start, end);
    return { ...draftPayload(f.draft, "following", f.split), label: moveFollowingLabel(f.draft) };
  };
  const wk = plan({ id: "w", start_on: "2026-11-17", rrule: "FREQ=WEEKLY;BYDAY=TU,TH", repeat_weekdays: [2, 4] });

  it("매주 화 · 목의 목요일을 금요일로 → 화 · 금 · 끈 날에서 나눔", () => {
    expect(pay(wk, "2026-11-19", "2026-11-20", "19:30", "20:30")).toMatchObject({
      scope: "following",
      only_date: "2026-11-19",
      start_on: "2026-11-19",
      rrule: "FREQ=WEEKLY;BYDAY=TU,FR",
      label: "매주 화 · 금 · 19:30~20:30",
    });
  });

  it("같은 주에서 미루면 그사이 다른 요일 회차가 남게 끈 날부터 (화 → 금 = 목 · 금)", () => {
    expect(pay(wk, "2026-11-17", "2026-11-20", "19:00", "20:00")).toMatchObject({ only_date: "2026-11-17", start_on: "2026-11-17", rrule: "FREQ=WEEKLY;BYDAY=TH,FR" });
  });

  it("이미 있는 요일로 앞당기면 합쳐지고, 놓은 날에서 나눔(그날이 두 번 보이지 않게)", () => {
    expect(pay(wk, "2026-11-19", "2026-11-17", "19:00", "20:00")).toMatchObject({ only_date: "2026-11-17", start_on: "2026-11-17", rrule: "FREQ=WEEKLY;BYDAY=TU" });
  });

  it("매일 — 미루면 새 시작은 놓은 날 · 끝나는 날 그대로", () => {
    const daily = plan({ id: "d", kind: "work", start_on: "2026-11-09", rrule: "FREQ=DAILY", until_on: "2026-11-30", start_time: "07:00", end_time: "07:30" });
    expect(pay(daily, "2026-11-17", "2026-11-18", "08:00", "08:30")).toMatchObject({
      only_date: "2026-11-17",
      start_on: "2026-11-18",
      rrule: "FREQ=DAILY",
      until_on: "2026-11-30",
      label: "매일 · 11월 30일까지 · 08:00~08:30",
    });
  });

  it("매월 마지막 금요일 · 3번 → 새 날 기준(마지막이면 마지막 · 아니면 n번째) · 횟수는 끝나는 날로", () => {
    const m = plan({ id: "m", start_on: "2026-11-27", rrule: "FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", until_on: "2027-01-29", start_time: "19:30", end_time: "21:00" });
    // 12/31(목)은 12월 마지막 목요일
    expect(pay(m, "2026-12-25", "2026-12-31", "19:30", "21:00")).toMatchObject({
      only_date: "2026-12-25",
      start_on: "2026-12-31",
      rrule: "FREQ=MONTHLY;BYDAY=-1TH",
      until_on: "2027-01-29",
    });
    // 12/24(목)은 마지막이 아니라 넷째 목요일 (12/31 이 있다)
    expect(pay(m, "2026-12-25", "2026-12-24", "19:30", "21:00")).toMatchObject({ only_date: "2026-12-24", start_on: "2026-12-24", rrule: "FREQ=MONTHLY;BYDAY=4TH" });
  });

  it("2주마다 토요일 → 금요일 · 같은 주라 박자 그대로", () => {
    const kids = plan({ id: "k", start_on: "2026-11-14", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;COUNT=6", repeat_weekdays: [6], until_on: "2027-01-23", start_time: "11:00", end_time: "12:00" });
    expect(pay(kids, "2026-11-28", "2026-11-27", "11:00", "12:00")).toMatchObject({
      only_date: "2026-11-27",
      start_on: "2026-11-27",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR",
      until_on: "2027-01-23",
    });
  });

  it("시각만 바꾸면(같은 날) 규칙 그대로", () => {
    expect(pay(wk, "2026-11-19", "2026-11-19", "18:00", "19:00")).toMatchObject({ only_date: "2026-11-19", start_on: "2026-11-19", rrule: "FREQ=WEEKLY;BYDAY=TU,TH" });
  });
});
