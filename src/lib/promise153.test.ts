import { describe, expect, it } from "vitest";
import {
  draftFromPromise,
  draftHint,
  isPromisedDay,
  kstHm,
  meetReasons,
  meetSummary,
  nextPromisedDay,
  normalizeMeet,
  normalizePromiseState,
  promiseDraftError,
  promisePayload,
  promiseSentence,
  promiseStatus,
  sortMeetRows,
  toggleDay,
  weekKept,
  weekdayOfYmd,
  weekdaysLabel,
  remindLabel,
  draftChanged,
  type MeetRow,
  type Promise153,
} from "./promise153";

// 2026-11-12 = 목요일
const P: Promise153 = { weekdays: [2, 4], timeSlot: "evening", planB: null, notify: true, remind: null, startedOn: "2026-11-02" };

describe("운동 약속 — 서버 값 읽기", () => {
  it("켜지 않은 지점은 꺼짐 · 약속 정리(요일 겹침 · 잘못된 값 빼기)", () => {
    expect(normalizePromiseState({ on: false }).on).toBe(false);
    expect(normalizePromiseState(null).on).toBe(false);
    const s = normalizePromiseState({
      on: true,
      branch: "153복싱짐 선릉역점",
      today: "2026-11-12",
      return_bonus: 5000,
      promise: { weekdays: [4, 2, 2, 9], time_slot: "evening", plan_b: " 늦게 끝나면 30분만 ", notify: true, started_on: "2026-11-02" },
    });
    expect(s.on).toBe(true);
    expect(s.returnBonus).toBe(5000);
    expect(s.promise).toEqual({ weekdays: [2, 4], timeSlot: "evening", planB: "늦게 끝나면 30분만", notify: true, remind: null, startedOn: "2026-11-02" });
    expect(normalizePromiseState({ on: true, promise: null }).promise).toBeNull();
    expect(normalizePromiseState({ on: true, promise: { weekdays: [], started_on: "2026-11-02" } }).promise).toBeNull();
    expect(normalizePromiseState({ on: true, promise: { weekdays: [1], time_slot: "x", started_on: "2026-11-02" } }).promise?.timeSlot).toBeNull();
  });
});

describe("운동 약속 — 날짜", () => {
  it("요일 번호는 서버와 같다(0 = 일) · 기기 시간대와 상관없이", () => {
    expect(weekdayOfYmd("2026-11-12")).toBe(4);
    expect(weekdayOfYmd("2026-11-15")).toBe(0);
  });

  it("약속한 날 — 약속을 건 날부터", () => {
    expect(isPromisedDay(P, "2026-11-12")).toBe(true); // 목
    expect(isPromisedDay(P, "2026-11-13")).toBe(false); // 금
    expect(isPromisedDay(P, "2026-10-29")).toBe(false); // 목이지만 약속 전
    expect(isPromisedDay(null, "2026-11-12")).toBe(false);
  });

  it("다음 약속 — 오늘은 빼고 · 이번 주 지킨 수(월 ~ 오늘)", () => {
    expect(nextPromisedDay(P, "2026-11-12")).toBe("2026-11-17"); // 다음 화
    expect(nextPromisedDay(P, "2026-11-11")).toBe("2026-11-12");
    const att = new Set(["2026-11-10", "2026-11-12", "2026-11-11"]);
    expect(weekKept(P, "2026-11-12", att)).toBe(2); // 화 · 목 (수는 약속한 날이 아님)
    expect(weekKept(P, "2026-11-16", att)).toBe(0); // 다음 주 월요일 — 새 주
  });
});

describe("운동 약속 — 글", () => {
  it("요일 · 약속 문장", () => {
    expect(weekdaysLabel([4, 2])).toBe("화 · 목");
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe("평일");
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("매일");
    expect(weekdaysLabel([0, 6])).toBe("토 · 일");
    expect(promiseSentence(P, "선릉역점")).toBe("매주 화 · 목 저녁, 선릉역점에서 운동해요");
    expect(promiseSentence({ weekdays: [1, 2, 3, 4, 5], timeSlot: null })).toBe("평일 운동해요");
  });

  it("카드 한 줄 — 잘한 것과 다음 한 걸음만, 놓친 약속 · 0번은 말하지 않는다", () => {
    // 오늘(목) 약속 · 아직
    expect(promiseStatus(P, "2026-11-12", new Set())).toEqual({ text: "오늘이 약속한 날이에요 · 저녁에 만나요", tone: "today" });
    // 오늘 약속 지킴
    expect(promiseStatus(P, "2026-11-12", new Set(["2026-11-12"]))).toEqual({
      text: "오늘 약속 지켰어요 · 다음 약속 화요일 저녁",
      tone: "done",
    });
    // 금요일 — 이번 주 화 · 목 중 화만 옴
    expect(promiseStatus(P, "2026-11-13", new Set(["2026-11-10"]))).toEqual({
      text: "이번 주 약속 1번 지켰어요 · 다음 약속 화요일 저녁",
      tone: "done",
    });
    // 금요일 — 이번 주 약속을 하나도 못 지켰어도 다음 약속만
    const s = promiseStatus(P, "2026-11-13", new Set());
    expect(s).toEqual({ text: "다음 약속 화요일 저녁", tone: "next" });
    for (const t of [s?.text ?? ""]) expect(t).not.toMatch(/놓|못|0번|빠/);
    expect(promiseStatus(null, "2026-11-12", new Set())).toBeNull();
  });
});

describe("운동 약속 — 걸기 · 고치기", () => {
  it("검사는 서버와 같은 말 · 보낼 값 정리", () => {
    const d = draftFromPromise(null);
    expect(promiseDraftError(d)).toBe("약속할 요일을 하나 이상 골라 주세요");
    expect(promiseDraftError({ ...d, weekdays: [7] })).toBe("요일을 다시 골라 주세요");
    expect(promiseDraftError({ ...d, weekdays: [2], planB: "가".repeat(61) })).toBe("대비책은 60자 안으로 적어 주세요");
    expect(promiseDraftError({ ...d, weekdays: [2, 4] })).toBeNull();
    expect(promisePayload({ weekdays: [4, 2, 4], timeSlot: "evening", planB: "  늦게   끝나면  ", notify: false, remind: "eve" })).toEqual({
      p_weekdays: [2, 4],
      p_time_slot: "evening",
      p_plan_b: "늦게 끝나면",
      p_notify: false,
      p_remind: "eve",
    });
    expect(promisePayload({ weekdays: [1], timeSlot: null, planB: "  ", notify: true, remind: "08:30" }).p_plan_b).toBeNull();
    expect(draftFromPromise(P)).toEqual({ weekdays: [2, 4], timeSlot: "evening", planB: "", notify: true, remind: "08:30" });
  });

  it("요일 넣고 빼기 · 횟수 안내(못한다는 말 없이)", () => {
    expect(toggleDay([2], 4)).toEqual([2, 4]);
    expect(toggleDay([2, 4], 2)).toEqual([4]);
    expect(draftHint(0)).toBe("주 2번부터 시작해 보세요");
    expect(draftHint(2)).toContain("첫 4주 8번");
    for (const n of [0, 1, 2, 3, 7]) expect(draftHint(n)).not.toMatch(/부족|못|적어요/);
  });
});

describe("코치 — 오늘 만날 회원", () => {
  const row = (o: Partial<MeetRow>): MeetRow => ({
    userId: "u",
    name: "회원",
    avatarUrl: null,
    cameAt: null,
    promised: false,
    timeSlot: null,
    starterDay: null,
    starterCount: null,
    gapDays: null,
    daysLeft: null,
    partnerCall: false,
    annivYears: null,
    annivBasis: null,
    milestone: null,
    notes: [],
    ...o,
  });

  it("서버 값 읽기 — 켜지 않은 지점 · 잘못된 줄 빼기", () => {
    expect(normalizeMeet({ on: false, branch: "153복싱짐 칠금점" })).toEqual({
      on: false,
      branch: "153복싱짐 칠금점",
      today: null,
      rows: [],
      others: [],
      canNote: false,
    });
    const m = normalizeMeet({
      on: true,
      branch: "153복싱짐 선릉역점",
      today: "2026-11-12",
      rows: [
        { user_id: "a", name: "새내기", came_at: "2026-11-12T09:30:00Z", starter_day: 1, starter_count: 1, promised: false },
        { name: "이름만" },
        { user_id: "b", name: "민수", promised: true, time_slot: "evening", gap_days: null, days_left: 5, partner_call: true },
      ],
    });
    expect(m.rows).toHaveLength(2);
    expect(m.rows[1]).toMatchObject({ userId: "b", promised: true, timeSlot: "evening", daysLeft: 5, partnerCall: true, gapDays: null });
  });

  it("왜 오늘 만나나 — 첫 출석 · 첫 4주 · 다시 온 · 약속 · 수강권 · 모집, 할 말 한 가지씩", () => {
    expect(meetReasons(row({ cameAt: "2026-11-12T09:30:00Z", starterDay: 1, starterCount: 1 }))).toEqual([
      { key: "starter", label: "첫 출석", say: "이름을 불러 주고 먼저 인사해 주세요" },
    ]);
    expect(meetReasons(row({ cameAt: "x", starterDay: 9, starterCount: 3 }))[0].label).toBe("첫 4주 3번째");
    expect(meetReasons(row({ cameAt: "x", gapDays: 23 }))[0]).toMatchObject({ key: "back", label: "23일 만에" });
    expect(meetReasons(row({ promised: true, timeSlot: "evening" }))[0]).toMatchObject({ label: "약속한 날 · 저녁", say: expect.stringContaining("오면") });
    expect(meetReasons(row({ promised: true, cameAt: "x" }))[0].say).toBe("'약속 지키러 오셨네요' 하고 반겨 주세요");
    expect(meetReasons(row({ cameAt: "x", daysLeft: 5 }))[0].label).toBe("수강권 5일");
    expect(meetReasons(row({ cameAt: "x", partnerCall: true }))[0].key).toBe("partner");
    const many = meetReasons(row({ cameAt: "x", gapDays: 20, promised: true, daysLeft: 3 }));
    expect(many.map((r) => r.key)).toEqual(["back", "promise", "expiring"]);
    for (const r of many) expect(r.say).not.toMatch(/왜 안|빠졌|결석/);
  });

  it("순서 — 온 회원 먼저(늦게 온 순), 아직 안 온 약속 회원은 시간대 순 · 머리 한 줄", () => {
    const rows = [
      row({ userId: "p-evening", name: "다", promised: true, timeSlot: "evening" }),
      row({ userId: "came-early", name: "가", cameAt: "2026-11-12T00:00:00Z", gapDays: 20 }),
      row({ userId: "p-dawn", name: "나", promised: true, timeSlot: "dawn" }),
      row({ userId: "came-late", name: "라", cameAt: "2026-11-12T10:00:00Z", daysLeft: 3 }),
      row({ userId: "p-none", name: "마", promised: true }),
    ];
    expect(sortMeetRows(rows).map((r) => r.userId)).toEqual(["came-late", "came-early", "p-dawn", "p-evening", "p-none"]);
    expect(meetSummary(rows)).toBe("온 회원 2명 · 아직 안 온 약속 3명");
    expect(meetSummary([])).toBe("");
    expect(kstHm("2026-11-12T10:04:00Z")).toBe("19:04");
    expect(kstHm(null)).toBeNull();
  });

  it("(2-3) 오늘 n주년 · 출석 축하 칩 · 코치 한마디 · 오늘 온 다른 회원", () => {
    const m = normalizeMeet({
      on: true,
      can_note: true,
      rows: [
        {
          user_id: "f",
          name: "일년",
          came_at: "2026-11-13T09:00:00Z",
          anniv_years: 1,
          anniv_basis: "reg",
          notes: [{ id: "n1", who: "김코치", title: "코치", body: "1년 동안 고마워요", mine: true }, { id: "bad" }],
        },
        { user_id: "k", name: "도장", came_at: "x", anniv_years: 2, anniv_basis: "stamp", milestone: 100 },
        { user_id: "z", name: "아님", anniv_years: 0, milestone: 0 },
      ],
      others: [{ user_id: "o", name: "그냥", came_at: "2026-11-13T10:00:00Z", notes: [] }, { name: "이름만" }],
    });
    expect(m.canNote).toBe(true);
    expect(m.rows[0]).toMatchObject({ annivYears: 1, annivBasis: "reg", milestone: null });
    expect(m.rows[0].notes).toEqual([{ id: "n1", who: "김코치", title: "코치", body: "1년 동안 고마워요", mine: true }]);
    expect(m.rows[2]).toMatchObject({ annivYears: null, annivBasis: null, milestone: null, notes: [] });
    expect(m.others).toEqual([{ userId: "o", name: "그냥", cameAt: "2026-11-13T10:00:00Z", notes: [] }]);
    expect(meetReasons(m.rows[0])[0]).toEqual({ key: "anniv", label: "오늘 1주년", say: "'153과 함께한 1년 고마워요' 하고 축하해 주세요" });
    expect(meetReasons(m.rows[1]).map((r) => r.label)).toEqual(["첫 도장 2주년", "출석 100번째"]);
    // 첫 출석이 기념일보다 먼저 · 기념일이 약속보다 먼저
    expect(meetReasons(row({ cameAt: "x", starterDay: 1, starterCount: 1, milestone: 50, promised: true })).map((r) => r.key)).toEqual([
      "starter",
      "milestone",
      "promise",
    ]);
    for (const r of meetReasons(m.rows[1])) expect(r.say).not.toMatch(/왜 안|빠졌|결석/);
  });
});

describe("운동 약속 — (2-2) 알림 시각 · 휴관일", () => {
  it("알림 시각 읽기 · 이름", () => {
    const s = normalizePromiseState({
      on: true,
      today: "2026-11-13",
      eve_at: "20:00",
      promise: { weekdays: [5], remind: "eve", started_on: "2026-11-01" },
    });
    expect(s.eveAt).toBe("20:00");
    expect(s.promise?.remind).toBe("eve");
    expect(normalizePromiseState({ on: true, promise: { weekdays: [5], remind: "09:00", started_on: "2026-11-01" } }).promise?.remind).toBeNull();
    expect(normalizePromiseState({ on: true }).eveAt).toBe("20:00");
    expect(remindLabel("eve", "20:00")).toBe("전날 저녁 8시");
    expect(remindLabel("07:00")).toBe("아침 7시");
    expect(remindLabel(null)).toBe("아침 8시 30분");
    expect(remindLabel("12:00")).toBe("낮 12시");
    expect(remindLabel("17:00")).toBe("오후 5시");
  });

  it("휴관일은 약속한 날로 치지 않는다 (온 날은 센다)", () => {
    // 2026-11-12 목 · 화 · 목 약속
    const skip = new Set(["2026-11-12"]);
    expect(promiseStatus(P, "2026-11-12", new Set(), skip)).toEqual({ text: "다음 약속 화요일 저녁", tone: "next" });
    expect(promiseStatus(P, "2026-11-12", new Set(["2026-11-12"]), skip)?.tone).toBe("done");
    expect(nextPromisedDay(P, "2026-11-16", new Set(["2026-11-17"]))).toBe("2026-11-19");
    expect(nextPromisedDay(P, "2026-11-16")).toBe("2026-11-17");
  });

  it("고친 것이 있나", () => {
    const d = draftFromPromise(P);
    expect(draftChanged(d, P)).toBe(false);
    expect(draftChanged({ ...d, remind: "eve" }, P)).toBe(true);
    expect(draftChanged({ ...d, weekdays: [4, 2] }, P)).toBe(false);
    expect(draftChanged({ ...d, planB: "  " }, P)).toBe(false);
    expect(draftChanged(d, null)).toBe(true);
  });
});
