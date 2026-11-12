import { describe, expect, it } from "vitest";
import {
  EVENT_KIND_META,
  OPS_CAL_OFF,
  callLine,
  callsOn,
  closedDaySet,
  draftFromEvent,
  eventDot,
  eventDraftError,
  eventPayload,
  eventRange,
  eventUntil,
  eventsOn,
  hmLabel,
  isClosedDay,
  mdw,
  newEventDraft,
  normalizeCalls,
  normalizeEvents,
  normalizeOpsCal,
  noticeStatus,
  sendHint,
  upcomingEvents,
  type CalEvent,
  type OpsCalEvent,
} from "./calendarEvents";

// 2026-11-13 = 금요일
const CLOSED: CalEvent = { id: "c", kind: "closed", title: "추석 연휴 휴관", startOn: "2026-11-14", endOn: "2026-11-16" };
const CLASS: CalEvent = { id: "k", kind: "class", title: "미트 특강 저녁 8시", startOn: "2026-11-15", endOn: "2026-11-15" };

describe("153 일정 — 서버 값 읽기", () => {
  it("잘못된 줄 빼기 · 끝날 없으면 하루", () => {
    const ev = normalizeEvents([
      { id: "a", kind: "closed", title: " 휴관 ", start_on: "2026-11-14", end_on: "2026-11-16" },
      { id: "b", kind: "party", title: "x", start_on: "2026-11-14" },
      { id: "c", kind: "event", title: "", start_on: "2026-11-14" },
      { id: "d", kind: "event", title: "마감", start_on: "2026-11-20" },
      { id: "e", kind: "match", title: "거꾸로", start_on: "2026-11-20", end_on: "2026-11-19" },
      null,
    ]);
    expect(ev.map((e) => e.id)).toEqual(["a", "d"]);
    expect(ev[0]).toEqual({ id: "a", kind: "closed", title: "휴관", startOn: "2026-11-14", endOn: "2026-11-16" });
    expect(ev[1].endOn).toBe("2026-11-20");
    expect(normalizeEvents(null)).toEqual([]);
  });

  it("운동 모집 — 시각 · 수 정리", () => {
    const c = normalizeCalls([
      { id: "1", day: "2026-11-13", hour: 19, purpose: "mitt", mine: true, host: "에이", joiners: 2, done: false, now: false },
      { id: "2", day: "2026-11-13", hour: 99, purpose: null, mine: false, host: "", joiners: -3, done: true, now: true },
      { id: "3", day: "bad" },
    ]);
    expect(c).toHaveLength(2);
    expect(c[1]).toMatchObject({ hour: null, purpose: "together", host: "동료", joiners: 0, done: true, now: true });
  });

  it("운영본부 목록 — 꺼짐 · 알림 칸 · 시각", () => {
    expect(normalizeOpsCal({ on: false, branch: "153복싱짐 칠금점" })).toEqual({ ...OPS_CAL_OFF, branch: "153복싱짐 칠금점" });
    const s = normalizeOpsCal({
      on: true,
      branch: "153복싱짐 선릉역점",
      today: "2026-11-13",
      can_edit: true,
      audience: 150,
      morning_at: "08:30",
      eve_at: "bad",
      events: [
        {
          id: "c",
          kind: "closed",
          title: "추석 연휴 휴관",
          start_on: "2026-11-14",
          end_on: "2026-11-16",
          notify_morning: true,
          notify_eve: true,
          eve_sent_at: "2026-11-13T10:00:00Z",
          eve_sent_n: 150,
          by: "지점장",
        },
      ],
    });
    expect(s).toMatchObject({ on: true, canEdit: true, audience: 150, morningAt: "08:30", eveAt: "19:00", quietAfter: "21:00" });
    expect(s.events[0]).toMatchObject({ notifyEve: true, eveSentN: 150, morningSentAt: null, by: "지점장" });
  });
});

describe("153 일정 — 날짜 · 휴관일", () => {
  it("그날 일정 · 모집 · 휴관", () => {
    expect(eventsOn([CLOSED, CLASS], "2026-11-15").map((e) => e.id)).toEqual(["c", "k"]);
    expect(eventsOn([CLOSED, CLASS], "2026-11-13")).toEqual([]);
    expect(isClosedDay([CLOSED], "2026-11-16")).toBe(true);
    expect(isClosedDay([CLOSED], "2026-11-17")).toBe(false);
    expect([...closedDaySet([CLOSED, CLASS])]).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(eventDot([CLOSED, CLASS], "2026-11-15")).toBe("closed"); // 휴관이 먼저
    expect(eventDot([CLASS], "2026-11-15")).toBe("event");
    expect(eventDot([CLASS], "2026-11-14")).toBeNull();
    const calls = normalizeCalls([
      { id: "b", day: "2026-11-13", hour: 20 },
      { id: "a", day: "2026-11-13", hour: 7 },
      { id: "x", day: "2026-11-14", hour: 7 },
    ]);
    expect(callsOn(calls, "2026-11-13").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("글 — 날짜 · 사이 날 · 모집 한 줄", () => {
    expect(mdw("2026-11-13")).toBe("11/13(금)");
    expect(eventRange(CLOSED)).toBe("11/14(토) ~ 11/16(월)");
    expect(eventRange(CLASS)).toBe("11/15(일)");
    expect(eventUntil(CLOSED, "2026-11-14")).toBe("11/16(월)까지");
    expect(eventUntil(CLOSED, "2026-11-16")).toBeNull();
    const [mine, other, now] = normalizeCalls([
      { id: "1", day: "2026-11-13", hour: 19, purpose: "mitt", mine: true, joiners: 2 },
      { id: "2", day: "2026-11-13", hour: 20, purpose: "together", mine: false, host: "민준" },
      { id: "3", day: "2026-11-13", hour: null, purpose: "mitt", mine: true, joiners: 0, now: true },
    ]);
    expect(callLine(mine)).toBe("오후 7시 미트 · 내 모집 · 저요 2명");
    expect(callLine(other)).toBe("오후 8시 같이 운동 · 민준님");
    expect(callLine(now)).toBe("지금 미트 · 내 모집");
  });

  it("시각 이름 · 알림 한 줄", () => {
    expect(hmLabel("08:30")).toBe("아침 8시 30분");
    expect(hmLabel("19:00")).toBe("저녁 7시");
    expect(hmLabel("12:00")).toBe("낮 12시");
    expect(hmLabel("17:00")).toBe("오후 5시");
    expect(hmLabel("05:00")).toBe("새벽 5시");
    const st = { morningAt: "08:30", eveAt: "19:00" };
    const base: OpsCalEvent = {
      ...CLOSED,
      notifyMorning: true,
      notifyEve: true,
      morningSentAt: null,
      morningSentN: null,
      eveSentAt: null,
      eveSentN: null,
      by: null,
    };
    expect(noticeStatus(base, st)).toBe("하루 전 저녁 7시 · 그날 아침 8시 30분");
    expect(noticeStatus({ ...base, eveSentAt: "x", eveSentN: 1500 }, st)).toBe("하루 전 보냄 · 1,500명 · 그날 아침 8시 30분");
    expect(noticeStatus({ ...base, notifyMorning: false, notifyEve: false }, st)).toBe("알림 없음");
  });
});

describe("153 일정 — 올리기 검사 (서버와 같은 말)", () => {
  const T = "2026-11-13";
  it("검사 9가지", () => {
    const d = newEventDraft(T);
    expect(d).toMatchObject({ kind: "closed", multi: false, notifyMorning: true, notifyEve: true });
    expect(newEventDraft(T, "class").notifyEve).toBe(false);
    expect(eventDraftError(d, T)).toBe("한 줄 설명을 적어 주세요");
    expect(eventDraftError({ ...d, kind: "x" as never, title: "휴관" }, T)).toBe("종류를 골라 주세요");
    expect(eventDraftError({ ...d, title: "가".repeat(41) }, T)).toBe("한 줄 설명은 40자 안으로 적어 주세요");
    expect(eventDraftError({ ...d, title: "휴관", startOn: "" }, T)).toBe("날짜를 골라 주세요");
    expect(eventDraftError({ ...d, title: "휴관", multi: true, startOn: "2026-11-16", endOn: "2026-11-14" }, T)).toBe(
      "끝나는 날을 시작하는 날 뒤로 골라 주세요",
    );
    expect(eventDraftError({ ...d, title: "휴관", multi: true, endOn: "2026-12-14" }, T)).toBe("기간은 31일 안으로 골라 주세요");
    expect(eventDraftError({ ...d, title: "휴관", startOn: "2026-11-10" }, T)).toBe("지난 날짜에는 올릴 수 없어요");
    expect(eventDraftError({ ...d, title: "휴관", startOn: "2027-12-20" }, T)).toBe("1년 안의 날짜로 골라 주세요");
    // 하루 일정이면 끝날은 보지 않는다
    expect(eventDraftError({ ...d, title: "휴관", multi: false, endOn: "2026-11-01" }, T)).toBeNull();
    expect(eventDraftError({ ...d, title: "휴관", multi: true, endOn: "2026-12-13" }, T)).toBeNull(); // 시작 포함 31일
  });

  it("보낼 값 · 고치기", () => {
    const d = { ...newEventDraft(T, "short"), title: "  10시~18시만   열어요 ", startOn: "2026-11-14", endOn: "2026-11-20" };
    expect(eventPayload(d, "153복싱짐 선릉역점")).toEqual({
      p_id: null,
      p_branch: "153복싱짐 선릉역점",
      p_kind: "short",
      p_title: "10시~18시만 열어요",
      p_start: "2026-11-14",
      p_end: "2026-11-14",
      p_notify_morning: true,
      p_notify_eve: true,
    });
    expect(eventPayload({ ...d, multi: true }, "153복싱짐 선릉역점", "id1")).toMatchObject({ p_id: "id1", p_branch: null, p_end: "2026-11-20" });
    const e: OpsCalEvent = {
      ...CLOSED,
      notifyMorning: false,
      notifyEve: true,
      morningSentAt: null,
      morningSentN: null,
      eveSentAt: null,
      eveSentN: null,
      by: null,
    };
    expect(draftFromEvent(e)).toEqual({
      kind: "closed",
      title: "추석 연휴 휴관",
      startOn: "2026-11-14",
      endOn: "2026-11-16",
      multi: true,
      notifyMorning: false,
      notifyEve: true,
    });
    expect(upcomingEvents([CLOSED, { ...CLASS, endOn: "2026-11-12", startOn: "2026-11-12" }], T).map((x) => x.id)).toEqual(["c"]);
  });

  it("지금 올리면 언제 알림이 가나", () => {
    const st = { morningAt: "08:30", eveAt: "19:00", quietAfter: "21:00" };
    const today = { ...newEventDraft(T, "class"), title: "특강" };
    expect(sendHint(today, st, T, "10:00")).toBe("오늘 일정이라 올리면 10분 안에 알려요");
    expect(sendHint(today, st, T, "07:00")).toBeNull();
    expect(sendHint(today, st, T, "22:00")).toBe("오늘 알림 시간이 지나서 그날 아침 알림은 안 가요");
    const tomorrow = { ...newEventDraft("2026-11-14", "closed"), title: "휴관" };
    expect(sendHint(tomorrow, st, T, "19:30")).toBe("내일 일정이라 올리면 10분 안에 알려요");
    expect(sendHint(tomorrow, st, T, "18:00")).toBeNull();
    expect(sendHint({ ...tomorrow, notifyEve: false }, st, T, "19:30")).toBeNull();
  });

  it("종류마다 이름 · 칩 · 예시가 있다", () => {
    for (const m of Object.values(EVENT_KIND_META)) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.placeholder.length).toBeGreaterThan(0);
    }
  });
});
