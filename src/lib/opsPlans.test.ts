import { describe, expect, it } from "vitest";
import {
  addDays,
  agoLabel,
  cellDots,
  dayItems,
  daySummary,
  draftError,
  draftFromPlan,
  draftPayload,
  dayMarks,
  marksLine,
  mergeWeeks,
  mondayOf,
  monthMondays,
  newDraft,
  planMonthLabel,
  presentMarks,
  occursOn,
  planWhenLabel,
  recentLine,
  repeatLabel,
  spanLabel,
  summaryLabel,
  weekDates,
  weekRangeLabel,
  type OpsPlan,
  type PlanShift,
  type PlansWeek,
} from "./opsPlans";

const SL = "153복싱짐 선릉역점";
const CG = "153복싱짐 칠금점";

const plan = (p: Partial<OpsPlan> & Pick<OpsPlan, "id" | "user_id" | "kind" | "start_on">): OpsPlan => ({
  branch: SL,
  title: null,
  memo: null,
  masked: false,
  private: false,
  end_on: p.start_on,
  repeat_weekdays: [],
  until_on: null,
  skip_dates: [],
  all_day: false,
  start_time: "19:00",
  end_time: "20:00",
  mine: false,
  ...p,
});

const shift = (p: Partial<PlanShift> & Pick<PlanShift, "key" | "weekday">): PlanShift => ({
  branch: SL,
  start_time: "18:00",
  end_time: "22:00",
  valid_from: "2026-10-01",
  valid_to: null,
  staff_start: null,
  staff_end: null,
  ...p,
});

describe("날짜", () => {
  it("월요일 · 한 주 · 날 더하기", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // 수 → 월
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // 일요일은 앞 주
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekDates("2026-11-02")).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
  });

  it("주 · 여러 날 글", () => {
    expect(weekRangeLabel("2026-11-02")).toBe("11월 2일 – 8일");
    expect(weekRangeLabel("2026-10-26")).toBe("10월 26일 – 11월 1일");
    expect(spanLabel("2026-11-03", "2026-11-03")).toBe("11월 3일 (화)");
    expect(spanLabel("2026-11-10", "2026-11-14")).toBe("11월 10일 – 14일");
  });

  it("반복 글", () => {
    expect(repeatLabel([4, 2])).toBe("매주 화 · 목");
    expect(repeatLabel([1, 2, 3, 4, 5])).toBe("매주 평일");
    expect(repeatLabel([0, 1, 2, 3, 4, 5, 6])).toBe("매일");
    expect(repeatLabel([6, 0], "2026-12-31")).toBe("매주 토 · 일 · 12월 31일까지");
  });
});

describe("일정 펼치기", () => {
  it("한 번 · 여러 날", () => {
    const p = plan({ id: "a", user_id: "u", kind: "off", start_on: "2026-11-06", end_on: "2026-11-07", all_day: true });
    expect(occursOn(p, "2026-11-05")).toBe(false);
    expect(occursOn(p, "2026-11-06")).toBe(true);
    expect(occursOn(p, "2026-11-07")).toBe(true);
    expect(occursOn(p, "2026-11-08")).toBe(false);
    expect(planWhenLabel(p)).toBe("11월 6일 – 7일");
  });

  it("매주 반복 — 시작 전 · 빼는 날 · 끝나는 날", () => {
    const p = plan({
      id: "b",
      user_id: "u",
      kind: "pt",
      start_on: "2026-11-04",
      repeat_weekdays: [2, 4],
      skip_dates: ["2026-11-12"],
      until_on: "2026-11-19",
    });
    expect(occursOn(p, "2026-11-03")).toBe(false); // 화요일이지만 시작 전
    expect(occursOn(p, "2026-11-05")).toBe(true); // 목
    expect(occursOn(p, "2026-11-06")).toBe(false); // 금
    expect(occursOn(p, "2026-11-10")).toBe(true); // 화
    expect(occursOn(p, "2026-11-12")).toBe(false); // 이 날만 빼기
    expect(occursOn(p, "2026-11-19")).toBe(true); // 끝나는 날 포함
    expect(occursOn(p, "2026-11-24")).toBe(false); // 끝난 뒤
    expect(planWhenLabel(p)).toBe("매주 화 · 목 · 11월 19일까지");
  });
});

describe("하루 정리", () => {
  const week: Pick<PlansWeek, "plans" | "shifts" | "offs"> = {
    plans: [
      plan({ id: "p1", user_id: "u1", kind: "pt", start_on: "2026-11-02", repeat_weekdays: [2, 4], start_time: "19:00", end_time: "20:00" }),
      plan({ id: "p2", user_id: "u1", kind: "personal", start_on: "2026-11-03", start_time: "10:00", end_time: "11:00" }),
      plan({ id: "p3", user_id: "u2", kind: "off", start_on: "2026-11-03", all_day: true, start_time: null, end_time: null }),
      plan({ id: "p4", user_id: "u3", kind: "out", start_on: "2026-11-03", all_day: true, start_time: null, end_time: null }),
    ],
    shifts: [
      shift({ key: "u1", weekday: 2 }),
      shift({ key: "u2", weekday: 2, start_time: "14:00", end_time: "18:00" }),
      shift({ key: "u3", weekday: 2, branch: CG }),
      shift({ key: "staff:x", weekday: 2, start_time: "10:00", end_time: "14:00" }),
      shift({ key: "staff:y", weekday: 2, staff_end: "2026-10-31" }), // 그만둔 분
    ],
    offs: [{ key: "staff:x", branch: SL, date: "2026-11-03" }],
  };
  const u1 = { key: "u1", user_id: "u1" };
  const u2 = { key: "u2", user_id: "u2" };
  const u3 = { key: "u3", user_id: "u3" };
  const sx = { key: "staff:x", user_id: null };
  const sy = { key: "staff:y", user_id: null };

  it("시간표 + 일정 — 시작 시각 순서", () => {
    const items = dayItems(week, u1, "2026-11-03");
    expect(items.map((i) => (i.type === "plan" ? `${i.kind} ${i.start}` : `${i.type} ${"start" in i ? i.start : ""}`))).toEqual([
      "personal 10:00",
      "shift 18:00",
      "pt 19:00",
    ]);
    expect(dayItems(week, u1, "2026-11-04")).toEqual([]); // 수요일 — 아무것도 없음
  });

  it("휴무가 맨 앞 · 승인된 쉰 날은 시간표 대신 · 그만둔 분은 빈칸", () => {
    expect(dayItems(week, u2, "2026-11-03").map((i) => i.type === "plan" ? i.kind : i.type)).toEqual(["off", "shift"]);
    expect(dayItems(week, sx, "2026-11-03").map((i) => i.type)).toEqual(["shiftOff"]);
    expect(dayItems(week, sy, "2026-11-03")).toEqual([]);
  });

  it("팀 한 줄 — 근무 · 휴무 · 외부", () => {
    const s = daySummary(week, [u1, u2, u3, sx, sy], "2026-11-03");
    expect(s).toEqual({ working: 2, off: 2, out: 1 }); // u1 · u3 근무(u3 는 외부도) / u2 · staff:x 휴무
    expect(summaryLabel(s)).toBe("근무 2명 · 휴무 2명 · 외부 1명");
    expect(summaryLabel({ working: 0, off: 0, out: 0 })).toBe("");
  });

  it("칸 점은 3개까지", () => {
    const items = dayItems(week, u1, "2026-11-03");
    expect(cellDots(items, 2)).toEqual({ dots: ["bg-slate-400", "bg-foreground/30"], more: 1 });
    expect(cellDots([])).toEqual({ dots: [], more: 0 });
  });
});

describe("넣기 · 고치기", () => {
  const today = "2026-11-02";

  it("새 일정 기본값 — 휴무는 하루 종일", () => {
    expect(newDraft(SL, "2026-11-03").all_day).toBe(false);
    expect(newDraft(SL, "2026-11-03", "off").all_day).toBe(true);
    expect(newDraft(SL, "2026-11-03").repeat_weekdays).toEqual([2]);
  });

  it("검사 — 서버와 같은 말", () => {
    const d = newDraft(SL, "2026-11-03");
    expect(draftError(d, today)).toBeNull();
    expect(draftError({ ...d, end_time: "18:00" }, today)).toBe("끝 시각이 시작보다 늦어야 해요");
    expect(draftError({ ...d, all_day: true, end_time: "18:00" }, today)).toBeNull();
    expect(draftError({ ...d, repeat: true, repeat_weekdays: [] }, today)).toBe("반복할 요일을 골라 주세요");
    expect(draftError({ ...d, repeat: true, endMode: "until" as const, until_on: "2026-11-01" }, today)).toBe("반복이 끝나는 날이 시작보다 빨라요");
    expect(draftError({ ...d, end_on: "2026-11-01" }, today)).toBe("끝나는 날이 시작보다 빨라요");
    expect(draftError({ ...d, end_on: "2027-01-10" }, today)).toBe("여러 날 일정은 두 달까지예요");
    expect(draftError({ ...d, start_on: "2026-08-01" }, today)).toBe("날짜를 다시 골라 주세요");
    expect(draftError({ ...d, title: "가".repeat(41) }, today)).toBe("제목은 40자까지예요");
    // 반복의 그날 하나만 바꾸기는 요일 검사 없이
    expect(draftError({ ...d, repeat: true, repeat_weekdays: [] }, today, "2026-11-03")).toBeNull();
  });

  it("보낼 값 — 반복이면 끝나는 날 없이 · 하루 종일이면 시각 없이 · 시간만 보이기는 개인만", () => {
    const d = { ...newDraft(SL, "2026-11-03", "pt"), repeat: true, repeat_weekdays: [4, 2, 2], end_on: "2026-11-05", private: true };
    expect(draftPayload(d)).toMatchObject({
      kind: "pt",
      start_on: "2026-11-03",
      end_on: "2026-11-03",
      repeat_weekdays: [2, 4],
      until_on: null,
      start_time: "19:00",
      private: false,
    });
    const off = { ...newDraft(SL, "2026-11-06", "off"), end_on: "2026-11-07" };
    expect(draftPayload(off)).toMatchObject({ end_on: "2026-11-07", repeat_weekdays: [], all_day: true, start_time: null, end_time: null });
    const mine = { ...newDraft(SL, "2026-11-05", "personal"), private: true };
    expect(draftPayload(mine).private).toBe(true);
  });

  it("반복의 그날 하나만 바꾸기 — only_date 를 붙이고 반복은 비운다", () => {
    const p = plan({ id: "p1", user_id: "u", kind: "pt", start_on: "2026-11-02", repeat_weekdays: [2, 4], until_on: "2026-12-31" });
    const d = { ...draftFromPlan(p), start_on: "2026-11-03", start_time: "20:00", end_time: "21:00" };
    expect(d.repeat).toBe(true);
    expect(draftPayload(d, "2026-11-03")).toMatchObject({
      id: "p1",
      only_date: "2026-11-03",
      repeat_weekdays: [],
      until_on: null,
      start_on: "2026-11-03",
      end_on: "2026-11-03",
    });
    expect(draftPayload(d)).not.toHaveProperty("only_date");
  });
});

describe("최근 바뀐 일정", () => {
  it("한 줄 · 얼마 전", () => {
    expect(
      recentLine({
        id: "r",
        user_id: "u",
        branch: SL,
        kind: "off",
        title: "연차",
        action: "new",
        at: "2026-11-02T03:00:00Z",
        start_on: "2026-11-06",
        end_on: "2026-11-07",
        repeat_weekdays: [],
        all_day: true,
        start_time: null,
        end_time: null,
      }),
    ).toBe("휴무 연차 · 11월 6일 – 7일 · 하루 종일");
    const now = new Date("2026-11-02T05:00:00Z");
    expect(agoLabel("2026-11-02T04:59:40Z", now)).toBe("방금");
    expect(agoLabel("2026-11-02T04:48:00Z", now)).toBe("12분 전");
    expect(agoLabel("2026-11-02T02:00:00Z", now)).toBe("3시간 전");
    expect(agoLabel("2026-10-31T05:00:00Z", now)).toBe("2일 전");
  });
});

describe("한 달 달력", () => {
  it("달력에 보이는 주 — 11월은 6주, 월요일에 시작하는 28일 2월은 4주", () => {
    expect(monthMondays("2026-11")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(monthMondays("2027-02")).toEqual(["2027-02-01", "2027-02-08", "2027-02-15", "2027-02-22"]);
    expect(monthMondays("2026-12")[0]).toBe("2026-11-30");
    expect(monthMondays("잘못")).toEqual([]);
  });

  it("달 이름 — 올해는 달만, 다른 해는 해까지", () => {
    expect(planMonthLabel("2026-11", "2026-11-12")).toBe("11월");
    expect(planMonthLabel("2027-01", "2026-11-12")).toBe("2027년 1월");
  });

  const base = {
    branch: SL,
    branches: [{ branch: SL, manage: true, mine: true }],
    manage: true,
    hq: true,
    me: "u1",
    today: "2026-11-12",
    now_hm: "10:00",
    recent: [],
  };
  const repeat = plan({ id: "rep", user_id: "u1", kind: "class", start_on: "2026-11-02", repeat_weekdays: [1, 3] });
  const w1: PlansWeek = {
    ...base,
    from: "2026-11-09",
    to: "2026-11-15",
    members: [
      { key: "u1", user_id: "u1", name: "가", title: "대표", me: true },
      { key: "u2", user_id: "u2", name: "나", title: "코치", me: false },
    ],
    plans: [repeat, plan({ id: "off1", user_id: "u2", kind: "off", start_on: "2026-11-13", all_day: true })],
    shifts: [shift({ key: "u2", weekday: 5 })],
    offs: [{ key: "u2", branch: SL, date: "2026-11-13" }],
  };
  const w0: PlansWeek = {
    ...base,
    from: "2026-11-02",
    to: "2026-11-08",
    members: [
      { key: "u1", user_id: "u1", name: "가", title: "대표", me: true },
      { key: "u3", user_id: "u3", name: "다", title: "코치", me: false },
    ],
    plans: [repeat, plan({ id: "out1", user_id: "u3", kind: "out", start_on: "2026-11-06", all_day: true })],
    shifts: [shift({ key: "u2", weekday: 5 })],
    offs: [],
  };

  it("주를 합치기 — 반복 일정 · 시간표는 하나만, 사람은 앞 주 순서부터, 기간은 처음 ~ 끝", () => {
    const m = mergeWeeks([w1, w0]);
    expect(m?.from).toBe("2026-11-02");
    expect(m?.to).toBe("2026-11-15");
    expect(m?.members.map((x) => x.key)).toEqual(["u1", "u3", "u2"]);
    expect(m?.plans.map((p) => p.id).sort()).toEqual(["off1", "out1", "rep"]);
    expect(m?.shifts).toHaveLength(1);
    expect(m?.offs).toHaveLength(1);
    expect(mergeWeeks([])).toBeNull();
  });

  it("칸 표시 — 팀은 근무 시간을 빼고 종류마다 몇 명, 휴무(승인된 쉰 날 포함)가 맨 앞", () => {
    const m = mergeWeeks([w0, w1]) as PlansWeek;
    const per = (d: string) => m.members.map((mem) => dayItems(m, mem, d));
    // 11/13(금) — 나(u2): 휴무 일정 + 승인된 쉰 날(시간표 대신) → 휴무 1명으로 한 번
    const fri = dayMarks(per("2026-11-13"), false);
    expect(fri.map((x) => [x.key, x.people])).toEqual([["off", 1]]);
    expect(marksLine(fri, true)).toBe("휴무 1명");
    // 11/11(수) — 가(u1) 매주 수업
    expect(dayMarks(per("2026-11-11"), false).map((x) => x.key)).toEqual(["class"]);
    // 11/6(금) — 다(u3) 외부 + 나(u2) 근무 시간(팀은 뺌 · 내 달력이면 넣음)
    expect(dayMarks(per("2026-11-06"), false).map((x) => x.key)).toEqual(["out"]);
    expect(dayMarks(per("2026-11-06"), true).map((x) => x.key)).toEqual(["out", "shift"]);
    expect(marksLine(dayMarks([dayItems(m, { key: "u2", user_id: "u2" }, "2026-11-06")], true), false)).toBe("근무 시간");
    expect(dayMarks(per("2026-11-10"), false)).toEqual([]);
  });

  it("색 이름표는 그 달에 쓰인 것만 (앞뒤 달 칸은 빼고)", () => {
    const byDay = new Map([
      ["2026-10-31", dayMarks([[{ type: "shiftOff", id: "x", date: "2026-10-31", allDay: true, start: null, end: null, branch: SL }]], false)],
      ["2026-11-06", [{ key: "out" as const, label: "외부", dot: "bg-amber-500", people: 1 }]],
      ["2026-11-11", [{ key: "class" as const, label: "수업", dot: "bg-primary", people: 1 }]],
    ]);
    expect(presentMarks(byDay, "2026-11")).toEqual(["out", "class"]);
    expect(presentMarks(new Map(), "2026-11")).toEqual([]);
  });
});
