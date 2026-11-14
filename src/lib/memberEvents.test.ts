import { describe, expect, it } from "vitest";
import {
  CAL_VIEW_DEFAULT,
  LEAGUE_STAMP,
  birthdayOn,
  draftForScope,
  draftFromMyEvent,
  emptyMyEventDraft,
  layerOn,
  leagueStampOf,
  myDraftPreview,
  myEventDates,
  myEventDraftError,
  myEventHex,
  myEventNextDay,
  myEventOn,
  myEventPayload,
  myEventsOn,
  myRepeatLabel,
  mySubLine,
  myTimeLabel,
  normalizeCalSearch,
  normalizeCalView,
  normalizeMyEvent,
  normalizeMyEvents,
  reminderLabel,
  restDaySet,
  searchError,
  toggleLayer,
  type MyEvent,
  type MyEventDraft,
} from "@/lib/memberEvents";
import { agendaDays, listRange, monthMinutesLabel, yearBounds, yearLine, yearMonths } from "@/lib/calendarViews";
import { CAL_OFF, normalizeCalendar } from "@/lib/calendarChecks";
import { MEMBER_BANNED } from "@/lib/memberHabits";

const T = "2026-11-14"; // 토요일
const raw = (o: Record<string, unknown>) => ({
  id: "e1",
  kind: "plan",
  title: "팀 회식",
  start_on: "2026-11-16",
  end_on: "2026-11-16",
  all_day: true,
  start_time: null,
  end_time: null,
  rrule: null,
  until_on: null,
  skip_dates: [],
  lunar: null,
  occ_dates: [],
  reminders: [],
  color: null,
  location: null,
  memo: null,
  rest: false,
  series_id: null,
  ...o,
});
const ev = (o: Record<string, unknown> = {}) => normalizeMyEvent(raw(o)) as MyEvent;
const draft = (o: Partial<MyEventDraft> = {}): MyEventDraft => ({ ...emptyMyEventDraft("2026-11-16"), title: "회식", ...o });

describe("서버 값 읽기", () => {
  it("get_my_calendar mine 한 줄 → 일정", () => {
    const e = ev({ all_day: false, start_time: "19:00", end_time: "21:30", reminders: [60, 10, 10], color: "tomato", location: "강남역", rest: true });
    expect(e).toMatchObject({ allDay: false, startTime: "19:00", endTime: "21:30", reminders: [10, 60], color: "tomato", location: "강남역", rest: true });
    // 시각이 없으면 하루 종일로 · 모르는 색은 null · 기념일은 쉬어요 없음
    expect(ev({ all_day: false, start_time: null })).toMatchObject({ allDay: true, startTime: null });
    expect(ev({ color: "pink" }).color).toBeNull();
    expect(ev({ kind: "anniv", rest: true }).rest).toBe(false);
    expect(ev({ lunar: { m: 3, d: 15, leap: true }, occ_dates: ["2027-04-21", "2026-05-01", "bad"] })).toMatchObject({
      lunar: { m: 3, d: 15, leap: true },
      occDates: ["2026-05-01", "2027-04-21"],
    });
    expect(normalizeMyEvents([raw({}), { id: "x" }, null, raw({ id: "e2", start_on: "nope" })])).toHaveLength(1);
  });

  it("get_my_calendar 의 3-5 칸 — 없으면 예전 그대로", () => {
    const s = normalizeCalendar({
      on: true,
      today: T,
      mine: [raw({})],
      birthday: "05-20",
      league: "blue",
      view: { cals_off: ["153", "weather"], theme: "league" },
      days: [{ day: "2026-11-13", journal: { id: "j", content: "사진 세 장", photo_url: "u1", photos: ["u1", "u2", "u3", "u4"] } }],
    });
    expect(s.mine).toHaveLength(1);
    expect(s.birthday).toBe("05-20");
    expect(s.league).toBe("blue");
    expect(s.view).toEqual({ off: ["153"], theme: "league" });
    expect(s.days.get("2026-11-13")?.journal?.photos).toEqual(["u1", "u2", "u3"]);
    const old = normalizeCalendar({ on: true, today: T, days: [{ day: "2026-11-13", journal: { id: "j", content: "한 장", photo_url: "u1" } }] });
    expect(old.mine).toEqual([]);
    expect(old.view).toEqual(CAL_VIEW_DEFAULT);
    expect(old.birthday).toBeNull();
    expect(old.days.get("2026-11-13")?.journal?.photos).toEqual(["u1"]);
    expect(CAL_OFF.mine).toEqual([]);
  });
});

describe("그날 이 일정이 있나 — 서버 _my_cal_on 과 같은 식", () => {
  it("한 번 · 여러 날", () => {
    const e = ev({ start_on: "2026-11-20", end_on: "2026-11-22" });
    expect(["2026-11-19", "2026-11-20", "2026-11-22", "2026-11-23"].map((d) => myEventOn(e, d))).toEqual([false, true, true, false]);
    expect(myEventDates(e, "2026-11-21", "2026-11-30")).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("반복 — 매주 월 · 수 · 빼는 날 · 끝나는 날 · 횟수", () => {
    const e = ev({ start_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO,WE", skip_dates: ["2026-11-23"], until_on: "2026-12-02" });
    expect(myEventDates(e, "2026-11-14", "2026-12-31")).toEqual(["2026-11-16", "2026-11-18", "2026-11-25", "2026-11-30", "2026-12-02"]);
    const c = ev({ start_on: T, rrule: "FREQ=DAILY;INTERVAL=2;COUNT=3", until_on: "2026-11-18" });
    expect(myEventDates(c, T, "2026-11-30")).toEqual(["2026-11-14", "2026-11-16", "2026-11-18"]);
    expect(myRepeatLabel(e)).toBe("매주 월 · 수 · 12월 2일까지");
    expect(myRepeatLabel(c)).toBe("2일마다 · 3번");
  });

  it("기념일 — 양력 매년 · 음력은 앱이 계산한 날들(빼는 날 빼고)", () => {
    const solar = ev({ kind: "anniv", start_on: "2015-05-20", rrule: "FREQ=YEARLY" });
    expect(myEventOn(solar, "2026-05-20")).toBe(true);
    expect(myEventOn(solar, "2026-05-21")).toBe(false);
    expect(myRepeatLabel(solar)).toBe("매년 5월 20일");
    const lunar = ev({ kind: "anniv", start_on: "2026-11-17", lunar: { m: 10, d: 8, leap: false }, occ_dates: ["2026-11-17", "2027-11-06"], skip_dates: ["2027-11-06"] });
    expect(myEventOn(lunar, "2026-11-17")).toBe(true);
    expect(myEventOn(lunar, "2027-11-06")).toBe(false);
    expect(myRepeatLabel(lunar)).toBe("음력 10월 8일 · 매년");
    expect(myEventNextDay(lunar, T)).toBe("2026-11-17");
  });

  it("그날 순서 · 쉬어요 날 (기념일은 쉬어요가 아님)", () => {
    const a = ev({ id: "a", title: "저녁", all_day: false, start_time: "19:00", end_time: "20:00" });
    const b = ev({ id: "b", title: "아침", all_day: false, start_time: "07:00", end_time: "08:00" });
    const c = ev({ id: "c", title: "휴가", rest: true });
    expect(myEventsOn([a, b, c], "2026-11-16").map((e) => e.id)).toEqual(["c", "b", "a"]);
    const anniv = { ...ev({ id: "d", kind: "anniv", start_on: "2016-11-16", rrule: "FREQ=YEARLY" }), rest: true };
    expect([...restDaySet([a, c, anniv], ["2026-11-15", "2026-11-16"])]).toEqual(["2026-11-16"]);
    expect(myTimeLabel(a)).toBe("19:00~20:00");
    expect(mySubLine({ ...a, location: "강남역" })).toBe("19:00~20:00 · 강남역");
    expect(mySubLine(ev({ start_on: "2026-11-20", end_on: "2026-11-22" }))).toBe("11/20 ~ 11/22");
    expect(mySubLine(ev({ kind: "anniv", start_on: "2015-12-05", rrule: "FREQ=YEARLY" }))).toBe("매년 12월 5일");
    expect(mySubLine(ev({ kind: "anniv", lunar: { m: 10, d: 8, leap: false }, occ_dates: ["2026-11-16"] }))).toBe("음력 10월 8일 · 매년");
  });
});

describe("저장 검사 — 서버 set_my_cal_event 와 같은 말 (test35 2번)", () => {
  const cases: Array<[Partial<MyEventDraft>, string]> = [
    [{ title: " " }, "이름을 적어 주세요"],
    [{ title: "가".repeat(31) }, "이름은 30자 안으로 적어 주세요"],
    [{ startOn: "" }, "날짜를 골라 주세요"],
    [{ startOn: "2026-09-12" }, "날짜는 두 달 전부터 1년 안으로 골라 주세요"],
    [{ startOn: "2027-12-20" }, "날짜는 두 달 전부터 1년 안으로 골라 주세요"],
    [{ startOn: "2026-11-17", endOn: "2026-11-16" }, "끝나는 날이 시작보다 빨라요"],
    [{ startOn: "2026-11-16", endOn: "2026-12-17" }, "여러 날 일정은 한 달까지예요"],
    [{ allDay: false, startTime: "19:00", endTime: "18:00" }, "시작 · 끝 시각을 확인해 주세요"],
    [{ location: "가".repeat(61) }, "장소는 60자 안으로 적어 주세요"],
    [{ memo: "가".repeat(201) }, "메모는 200자 안으로 적어 주세요"],
    [{ reminders: [0, 1440, 10080] }, "알림은 2개까지예요"],
    [{ reminders: [10] }, "알림을 다시 골라 주세요"],
    [{ allDay: false, reminders: [10080] }, "알림을 다시 골라 주세요"],
    [{ repeat: true, freq: "WEEKLY", weekdays: [] }, "반복할 요일을 골라 주세요"],
    [{ repeat: true, freq: "WEEKLY", weekdays: [1], endMode: "until", untilOn: "2026-11-15" }, "반복이 끝나는 날이 시작보다 빨라요"],
    [{ repeat: true, freq: "WEEKLY", weekdays: [1], endMode: "until", untilOn: "" }, "반복이 끝나는 날을 골라 주세요"],
    [{ kind: "anniv", startOn: "1899-12-31" }, "날짜를 다시 골라 주세요"],
    [{ kind: "anniv", calendar: "lunar", lunarM: 13 }, "음력 날짜를 다시 골라 주세요"],
  ];
  for (const [patch, msg] of cases) {
    it(`${msg} — ${JSON.stringify(patch).slice(0, 60)}`, () => {
      expect(myEventDraftError(draft(patch), T)).toBe(msg);
    });
  }

  it("통과 — 하루 종일 · 시각 · 반복 · 기념일(음력 날들이 있으면)", () => {
    expect(myEventDraftError(draft(), T)).toBeNull();
    expect(myEventDraftError(draft({ allDay: false, reminders: [10, 1440] }), T)).toBeNull();
    expect(myEventDraftError(draft({ repeat: true, freq: "WEEKLY", weekdays: [1, 3], endMode: "count", count: 5 }), T)).toBeNull();
    expect(myEventDraftError(draft({ kind: "anniv", startOn: "1990-05-20", reminders: [0, 10080] }), T)).toBeNull();
    expect(myEventDraftError(draft({ kind: "anniv", calendar: "lunar", lunarM: 3, lunarD: 15 }), T)).toBe("음력 날짜를 다시 골라 주세요");
    expect(myEventDraftError(draft({ kind: "anniv", calendar: "lunar", lunarM: 3, lunarD: 15 }), T, { occDates: ["2027-04-21"] })).toBeNull();
  });
});

describe("보낼 값 — set_my_cal_event p", () => {
  it("한 번 · 시각 · 쉬어요 · 이름 정리", () => {
    const p = myEventPayload(draft({ title: "  팀   회식 ", allDay: false, reminders: [60, 10], location: " 강남역 ", rest: true }));
    expect(p).toEqual({
      kind: "plan",
      title: "팀 회식",
      color: null,
      location: "강남역",
      memo: "",
      start_on: "2026-11-16",
      end_on: "2026-11-16",
      all_day: false,
      start_time: "19:00",
      end_time: "20:00",
      rrule: null,
      until_on: null,
      reminders: [10, 60],
      rest: true,
    });
  });

  it("반복 — 규칙 글(끝 날은 until_on) · 횟수는 규칙 안 · 월 반복 모양", () => {
    expect(myEventPayload(draft({ repeat: true, freq: "WEEKLY", weekdays: [3, 1], endMode: "until", untilOn: "2026-12-31" }))).toMatchObject({
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
      until_on: "2026-12-31",
      end_on: "2026-11-16",
    });
    expect(myEventPayload(draft({ repeat: true, freq: "DAILY", interval: 2, endMode: "count", count: 3 }))).toMatchObject({
      rrule: "FREQ=DAILY;INTERVAL=2;COUNT=3",
      until_on: null,
    });
    expect(myEventPayload(draft({ repeat: true, freq: "MONTHLY", monthMode: "nth" })).rrule).toBe("FREQ=MONTHLY;BYDAY=3MO");
    expect(myDraftPreview(draft({ repeat: true, freq: "WEEKLY", weekdays: [1, 3] }))).toEqual(["2026-11-16", "2026-11-18", "2026-11-23"]);
  });

  it("고치기 범위 — 이 날만 = 그날 한 번 · 이후 모두 = 그날부터(횟수는 끝나는 날로) · 전체", () => {
    const e = ev({ id: "w", start_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=10", until_on: "2027-01-18" });
    const d0 = draftFromMyEvent(e);
    expect(d0).toMatchObject({ repeat: true, freq: "WEEKLY", weekdays: [1], endMode: "count", count: 10 });
    const one = draftForScope(d0, e, "one", "2026-11-23");
    expect(myEventPayload(one, { scope: "one", occurrence: "2026-11-23" })).toMatchObject({
      id: "w",
      scope: "one",
      only_date: "2026-11-23",
      start_on: "2026-11-23",
      end_on: "2026-11-23",
      rrule: null,
    });
    const following = draftForScope(d0, e, "following", "2026-11-30");
    expect(following).toMatchObject({ startOn: "2026-11-30", endMode: "until", untilOn: "2027-01-18" });
    expect(myEventPayload(following, { scope: "following", occurrence: "2026-11-30" })).toMatchObject({
      scope: "following",
      only_date: "2026-11-30",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      until_on: "2027-01-18",
    });
    const all = draftForScope(following, e, "all", "2026-11-30");
    expect(myEventPayload(all, { scope: "all", occurrence: "2026-11-30" })).toMatchObject({ scope: "all", start_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=10" });
    expect(myEventPayload(all, { scope: "all", occurrence: "2026-11-30" })).not.toHaveProperty("only_date");
  });

  it("기념일 — 양력은 그 날 · 음력은 날들(정렬) + 첫날 · 하루 종일 · 쉬어요 없음", () => {
    expect(myEventPayload(draft({ kind: "anniv", startOn: "2015-05-20", allDay: false, rest: true, reminders: [10080, 0] }))).toEqual({
      kind: "anniv",
      title: "회식",
      color: null,
      location: "",
      memo: "",
      start_on: "2015-05-20",
      all_day: true,
      reminders: [0, 10080],
      rest: false,
    });
    expect(myEventPayload(draft({ kind: "anniv", calendar: "lunar", lunarM: 8, lunarD: 1, lunarLeap: true }), { occDates: ["2027-09-01", "2026-09-11"] })).toMatchObject({
      start_on: "2026-09-11",
      lunar: { m: 8, d: 1, leap: true },
      occ_dates: ["2026-09-11", "2027-09-01"],
    });
    // 기념일은 늘 전체 — 범위를 보내지 않는다
    expect(myEventPayload({ ...draft({ kind: "anniv", startOn: "2015-05-20" }), id: "a" }, { scope: "one", occurrence: "2026-05-20" })).toMatchObject({ id: "a", scope: "all" });
  });
});

describe("검색 · 보기 · 생일 · 리그", () => {
  it("검색 결과 · 검사", () => {
    const r = normalizeCalSearch({ on: true, q: "회식", events: [raw({})], lines: [{ id: "l", day: "2026-11-01", content: "회식 전 운동", mood: null, photo_url: null }, { id: "x" }] });
    expect(r.events).toHaveLength(1);
    expect(r.lines).toEqual([{ id: "l", day: "2026-11-01", content: "회식 전 운동", mood: null, photoUrl: null }]);
    expect(normalizeCalSearch({ on: false }).on).toBe(false);
    expect(searchError(" ")).toBe("찾을 말을 적어 주세요");
    expect(searchError("가".repeat(31))).toBe("찾을 말은 30자 안으로 적어 주세요");
    expect(searchError(" 회식 ")).toBeNull();
  });

  it("켜고 끄기 · 리그 테마", () => {
    const v = normalizeCalView({ cals_off: ["mine", "x", "mine"], theme: "dark" });
    expect(v).toEqual({ off: ["mine"], theme: null });
    expect(layerOn(v, "mine")).toBe(false);
    expect(toggleLayer(v, "mine")).toEqual({ off: [], theme: null });
    expect(toggleLayer(CAL_VIEW_DEFAULT, "holiday").off).toEqual(["holiday"]);
    expect(leagueStampOf("blue", { off: [], theme: "league" })).toEqual(LEAGUE_STAMP.blue);
    expect(leagueStampOf("blue", CAL_VIEW_DEFAULT)).toBeNull();
    expect(leagueStampOf("gold", { off: [], theme: "league" })).toBeNull();
    expect(myEventHex({ color: null, kind: "plan" })).toBe("#3F51B5");
    expect(myEventHex({ color: "basil", kind: "anniv" })).toBe("#0B8043");
  });

  it("생일 — 2/29 는 평년 2/28", () => {
    expect(birthdayOn("05-20", "2026-05-20")).toBe(true);
    expect(birthdayOn("05-20", "2026-05-21")).toBe(false);
    expect(birthdayOn("02-29", "2026-02-28")).toBe(true);
    expect(birthdayOn("02-29", "2028-02-29")).toBe(true);
    expect(birthdayOn("02-29", "2028-02-28")).toBe(false);
    expect(birthdayOn(null, "2026-05-20")).toBe(false);
  });

  it("알림 글", () => {
    expect([0, 1440, 10080].map((m) => reminderLabel(m, true))).toEqual(["그날 아침 9시", "전날 아침 9시", "일주일 전 아침 9시"]);
    expect([0, 10, 30, 60, 120, 1440].map((m) => reminderLabel(m, false))).toEqual(["시작할 때", "10분 전", "30분 전", "1시간 전", "2시간 전", "하루 전"]);
  });
});

describe("목록 · 한 해 (lib/calendarViews)", () => {
  const cal = (o: Record<string, unknown> = {}) =>
    normalizeCalendar({
      on: true,
      today: T,
      mine: [
        raw({ id: "trip", title: "가족 여행", start_on: "2026-11-20", end_on: "2026-11-22", rest: true }),
        raw({ id: "swim", title: "수영", start_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO", all_day: false, start_time: "07:00", end_time: "08:00" }),
      ],
      birthday: "11-18",
      events: [{ id: "ev", kind: "event", title: "송년회", start_on: "2026-11-21", end_on: "2026-11-21" }],
      ...o,
    });

  it("오늘부터 30일 — 여러 날 일정은 첫날만 · 쉬어요 날은 약속한 날로 안 셈 · 다음 약속 하루만 · 공휴일이 맨 위", () => {
    const r = listRange(T);
    expect(r).toEqual({ from: T, to: "2026-12-14" });
    const promise = { weekdays: [1, 5, 6], timeSlot: null, planB: null, notify: true, remind: null, startedOn: "2026-11-01" };
    const g = agendaDays({ cal: cal(), view: CAL_VIEW_DEFAULT, from: r.from, to: r.to, today: T, promise });
    const day = (d: string) => g.find((x) => x.day === d)?.items.map((i) => i.kind) ?? [];
    expect(day("2026-11-14")).toEqual(["promise"]); // 오늘 토요일 약속 — 다음 약속은 이 하루만
    expect(g.find((x) => x.day === "2026-11-14")?.items[0].title).toBe("오늘 운동 약속한 날");
    expect(day("2026-11-16")).toEqual(["mine"]);
    expect(day("2026-11-18")).toEqual(["birthday"]);
    expect(day("2026-11-20")).toEqual(["mine"]); // 여행 첫날만
    expect(day("2026-11-21")).toEqual(["event"]); // 여행 둘째 날은 줄 없음
    // 오늘 이미 왔으면 — 쉬어요 날(금 · 토 여행)을 건너뛴 다음 약속 하루
    const g2 = agendaDays({ cal: cal(), view: CAL_VIEW_DEFAULT, from: r.from, to: r.to, today: T, promise, attended: new Set([T]) });
    expect(g2.flatMap((x) => x.items.filter((i) => i.kind === "promise").map(() => x.day))).toEqual(["2026-11-16"]);
    // 켜고 끄기 — 내 일정 끄면 일정 · 생일이 빠진다
    const off = agendaDays({ cal: cal(), view: { off: ["mine", "153"], theme: null }, from: r.from, to: r.to, today: T });
    expect(off.flatMap((x) => x.items.map((i) => i.kind))).not.toContain("mine");
    expect(off.flatMap((x) => x.items.map((i) => i.kind))).not.toContain("event");
    // 공휴일(2026-12-25 성탄절)이 맨 위
    const xmas = agendaDays({ cal: cal({ mine: [raw({ start_on: "2026-12-25" })] }), view: CAL_VIEW_DEFAULT, from: "2026-12-20", to: "2026-12-31", today: T });
    expect(xmas.find((x) => x.day === "2026-12-25")?.items.map((i) => i.kind)).toEqual(["holiday", "mine"]);
  });

  it("한 해 도장 — 달마다 운동 시간 · 온 날 (0 은 글로 쓰지 않는다)", () => {
    const list = [
      { day: "2026-01-05", minutes: 60 },
      { day: "2026-01-07", minutes: 90 },
      { day: "2026-03-02", minutes: 66 },
      { day: "2025-12-31", minutes: 60 },
    ].map((d) => ({ ...d, at: `${d.day}T10:00:00Z`, end: null, endSource: null, method: "qr", branch: null }));
    const m = yearMonths(2026, list);
    expect(m[0]).toMatchObject({ ym: "2026-01", minutes: 150 });
    expect([...m[0].days]).toEqual(["2026-01-05", "2026-01-07"]);
    expect(monthMinutesLabel(m[1])).toBeNull();
    expect(monthMinutesLabel(m[0])).toBe("2시간 30분");
    expect(yearLine(m)).toBe("3시간 36분 운동했어요");
    expect(yearLine(yearMonths(2024, list))).toBeNull();
    expect(yearBounds("2025-03-01", T)).toEqual({ min: 2025, max: 2026 });
    expect(yearBounds(null, T)).toEqual({ min: 2026, max: 2026 });
  });
});

describe("회원 화면 글 — 쓰지 않는 낱말 (못 · 빠진 · 밀린 · 실패)", () => {
  it("lib 글을 넓게 돌려 봐도 없다", () => {
    const out: string[] = [];
    for (const m of [0, 10, 30, 60, 120, 1440, 10080]) out.push(reminderLabel(m, true), reminderLabel(m, false));
    const e = ev({ rrule: "FREQ=WEEKLY;BYDAY=MO", until_on: "2026-12-31", location: "강남", rest: true });
    out.push(myRepeatLabel(e) ?? "", mySubLine(e), myTimeLabel(e));
    for (const p of [{}, { title: "" }, { startOn: "" }, { kind: "anniv" as const, calendar: "lunar" as const }, { reminders: [1, 2, 3] }])
      out.push(myEventDraftError(draft(p), T) ?? "");
    out.push(searchError("") ?? "");
    expect(out.filter((s) => MEMBER_BANNED.some((w) => s.includes(w)))).toEqual([]);
  });
});
