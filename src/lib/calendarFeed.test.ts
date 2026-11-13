import { describe, expect, it } from "vitest";
import {
  buildFeedIcs,
  emptyFeed,
  feedFileName,
  feedNote,
  normalizeFeedData,
  parseFeedPath,
  type FeedData,
} from "../../supabase/functions/calendar-feed/feed.ts";
import { buildPromiseIcs } from "../../supabase/functions/calendar-ics/ics.ts";
import {
  branchFeedUrl,
  feedDevice,
  feedDownloadUrl,
  feedHttpsUrl,
  feedWebcalUrl,
  fetchedAgo,
  fetchedLine,
  googleAddUrl,
  normalizeFeedState,
  unavailableFeed,
} from "./calendarFeed";

const STAMP = "20261113T030000Z";
const TOKEN = "0123456789abcdef".repeat(4);
const enc = new TextEncoder();
const unfold = (s: string) => s.replace(/\r\n /g, "");
/** VEVENT 하나의 줄들 (UID 로) */
const veventOf = (ics: string, uid: string): string[] => {
  const lines = unfold(ics).split("\r\n");
  const i = lines.indexOf(`UID:${uid}@myboxer153.com`);
  if (i < 0) return [];
  const end = lines.indexOf("END:VEVENT", i);
  return lines.slice(i - 1, end + 1);
};

const STAFF: unknown = {
  kind: "staff",
  name: "153 운영본부 일정",
  events: [
    // 매주 화 · 목 저녁 수업 (11/10 = 화) · 12/31 까지 · 빼는 날은 그 요일 · 범위 안만
    {
      uid: "plan-aaa",
      title: "수업 · 저녁반",
      day: "2026-11-10",
      end_day: "2026-11-10",
      start: "19:00",
      end: "20:00",
      weekly: [4, 2, 2],
      until: "2026-12-31",
      exdates: ["2026-11-19", "2026-11-18", "2027-01-05", "2026-11-19"],
      busy: true,
      updated: "2026-11-12T03:04:05.123+00:00",
    },
    // 여러 날 시각 일정 = 날마다 같은 시각
    { uid: "plan-bbb", title: "외부 · 대회 인솔", day: "2026-11-20", end_day: "2026-11-22", start: "09:00", end: "18:00", busy: true },
    // 하루 종일 여러 날
    { uid: "plan-ccc", title: "휴무", day: "2026-11-24", end_day: "2026-11-25", busy: false },
    // 자정까지 근무 (24:00)
    { uid: "shift-s1-20261113-2200", title: "근무", day: "2026-11-13", end_day: "2026-11-13", start: "22:00", end: "24:00", busy: true, location: "153복싱짐 선릉역점" },
    // 매주 월 정기 회의 · 다음 한 번 쉬기 · 줌 링크
    {
      uid: "meeting-m1",
      title: "회의 · 주간 회의",
      day: "2026-11-02",
      end_day: "2026-11-02",
      start: "10:00",
      end: "11:00",
      weekly: [1],
      exdates: ["2026-11-16"],
      busy: true,
      url: "https://zoom.us/j/123?pwd=x",
      location: "153복싱짐 선릉역점",
    },
    // 끝난 반복 — 그리지 않음
    { uid: "plan-old", title: "끝난 반복", day: "2026-10-01", weekly: [3], until: "2026-09-30" },
    // 같은 UID · UID 없음 · 틀린 날짜 — 버림
    { uid: "plan-aaa", title: "겹침", day: "2026-11-11" },
    { day: "2026-11-11", title: "UID 없음" },
    { uid: "plan-bad", day: "2026-13-45" },
    // 제목의 쉼표 · 세미콜론
    { uid: "plan-esc", title: "업무 · 상담, 오픈; 마감", day: "2026-11-14", start: "11:00", end: "11:30", busy: true },
  ],
};

const MEMBER: unknown = {
  kind: "member",
  name: "153 운동 달력",
  events: [
    {
      uid: "promise-0123456789abcdef",
      promise: { weekdays: [2, 4], slot: "evening", remind: "08:30", notify: true },
      day: "2026-11-13",
      exdates: ["2026-11-17", "2026-11-18", "2026-11-19"],
      location: "153복싱짐 선릉역점",
      updated: "2026-11-12T10:00:00+00:00",
    },
    { uid: "event-e1", title: "휴관 · 내부 공사", day: "2026-11-17", end_day: "2026-11-17", location: "153복싱짐 선릉역점" },
    { uid: "dday-goal-g1", title: "목표일 · 첫 스파링", day: "2026-12-01", end_day: "2026-12-01" },
  ],
};

describe("calendar-feed — 주소 읽기", () => {
  it("토큰 · 지점 코드 · 물음표 주소", () => {
    expect(parseFeedPath(`/calendar-feed/${TOKEN}.ics`, new URLSearchParams())).toEqual({ token: TOKEN });
    expect(parseFeedPath(`/functions/v1/calendar-feed/${TOKEN.toUpperCase()}.ICS`, new URLSearchParams())).toEqual({ token: TOKEN });
    expect(parseFeedPath(`/calendar-feed/${TOKEN}`, new URLSearchParams())).toEqual({ token: TOKEN });
    expect(parseFeedPath("/functions/v1/calendar-feed/branch/sunreung.ics", new URLSearchParams())).toEqual({ branch: "sunreung" });
    expect(parseFeedPath("/calendar-feed", new URLSearchParams({ t: TOKEN }))).toEqual({ token: TOKEN });
    expect(parseFeedPath("/calendar-feed", new URLSearchParams({ b: "chilgeum" }))).toEqual({ branch: "chilgeum" });
  });

  it("틀린 주소는 null", () => {
    expect(parseFeedPath("/calendar-feed", new URLSearchParams())).toBeNull();
    expect(parseFeedPath(`/calendar-feed/${TOKEN.slice(1)}.ics`, new URLSearchParams())).toBeNull();
    expect(parseFeedPath("/calendar-feed/branch/x.ics", new URLSearchParams())).toBeNull();
    expect(parseFeedPath("/calendar-feed/branch/<script>.ics", new URLSearchParams())).toBeNull();
    expect(parseFeedPath("/calendar-feed/%E0%A4%A.ics", new URLSearchParams())).toBeNull();
  });
});

describe("calendar-feed — 자료 다듬기", () => {
  it("틀린 일정은 버리고 빈칸은 채운다", () => {
    const d = normalizeFeedData(STAFF) as FeedData;
    expect(d.kind).toBe("staff");
    expect(d.events.map((e) => e.uid)).toEqual(["plan-aaa", "plan-bbb", "plan-ccc", "shift-s1-20261113-2200", "meeting-m1", "plan-old", "plan-aaa", "plan-esc"]);
    expect(d.events[0].weekly).toEqual([2, 4]);
    expect(d.events[2].start).toBeNull();
    expect(normalizeFeedData(null)).toBeNull();
    expect(normalizeFeedData([])).toBeNull();
    expect(normalizeFeedData({ events: "x" })).toEqual({ kind: "member", name: "153 일정", events: [] });
  });

  it("약속 — 모르는 시간대 · 알림은 기본값, 알림 끔은 그대로", () => {
    const d = normalizeFeedData({
      kind: "member",
      name: "x",
      events: [
        { uid: "promise-a", day: "2026-11-13", promise: { weekdays: [9, 1], slot: "midnight", remind: "09:00", notify: false } },
        { uid: "promise-b", day: "2026-11-13", promise: { weekdays: [] } },
      ],
    }) as FeedData;
    expect(d.events).toHaveLength(1);
    expect(d.events[0].promise).toEqual({ weekdays: [1], slot: null, remind: "08:30", notify: false });
  });

  it("링크는 https 만 · 시각 칸은 'HH:MM' 만", () => {
    const d = normalizeFeedData({
      events: [{ uid: "meeting-x", day: "2026-11-13", start: "25:00", end: "x", url: "javascript:alert(1)" }],
    }) as FeedData;
    expect(d.events[0].url).toBeNull();
    expect(d.events[0].start).toBeNull();
  });
});

describe("calendar-feed — .ics 만들기 (코치진)", () => {
  const ics = buildFeedIcs(normalizeFeedData(STAFF) as FeedData, STAMP);

  it("머리 · CRLF · 75바이트 접기", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
    for (const l of ics.split("\r\n")) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    const u = unfold(ics);
    for (const want of [
      "X-WR-CALNAME:153 운영본부 일정",
      "X-WR-TIMEZONE:Asia/Seoul",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Seoul",
    ])
      expect(u).toContain(want);
  });

  it("매주 반복 — 첫 날 · UNTIL(UTC) · EXDATE(그 요일 · 범위 안 · 같은 시각)", () => {
    const v = veventOf(ics, "plan-aaa");
    expect(v).toContain("DTSTART;TZID=Asia/Seoul:20261110T190000");
    expect(v).toContain("DTEND;TZID=Asia/Seoul:20261110T200000");
    expect(v).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T145959Z");
    expect(v).toContain("EXDATE;TZID=Asia/Seoul:20261119T190000");
    expect(v).toContain("LAST-MODIFIED:20261112T030405Z");
    expect(v).toContain(`DTSTAMP:${STAMP}`);
    expect(v).toContain("SUMMARY:수업 · 저녁반");
    expect(v).toContain("TRANSP:OPAQUE");
    expect(v).toContain("URL:https://myboxer153.com/office?tab=plan");
  });

  it("여러 날 시각 = 날마다 같은 시각 · 하루 종일 여러 날 · 자정까지", () => {
    expect(veventOf(ics, "plan-bbb")).toEqual(
      expect.arrayContaining(["DTSTART;TZID=Asia/Seoul:20261120T090000", "DTEND;TZID=Asia/Seoul:20261120T180000", "RRULE:FREQ=DAILY;COUNT=3"]),
    );
    expect(veventOf(ics, "plan-ccc")).toEqual(
      expect.arrayContaining(["DTSTART;VALUE=DATE:20261124", "DTEND;VALUE=DATE:20261126", "TRANSP:TRANSPARENT"]),
    );
    const s = veventOf(ics, "shift-s1-20261113-2200");
    expect(s).toEqual(expect.arrayContaining(["DTSTART;TZID=Asia/Seoul:20261113T220000", "DTEND;TZID=Asia/Seoul:20261114T000000", "LOCATION:153복싱짐 선릉역점"]));
    expect(s).toContain("URL:https://myboxer153.com/office?tab=work");
    expect(s.some((l) => l.startsWith("RRULE"))).toBe(false);
  });

  it("정기 회의 — 매주 · 쉬는 한 번 · 회의 링크", () => {
    const v = veventOf(ics, "meeting-m1");
    expect(v).toContain("DTSTART;TZID=Asia/Seoul:20261102T100000");
    expect(v).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(v).toContain("EXDATE;TZID=Asia/Seoul:20261116T100000");
    expect(v).toContain("URL:https://zoom.us/j/123?pwd=x");
    expect(v).toContain("DESCRIPTION:지점 회의 · 회의 링크\\nhttps://zoom.us/j/123?pwd=x");
  });

  it("끝난 반복은 없고 · 같은 UID 는 한 번 · 글 칸 이스케이프", () => {
    expect(veventOf(ics, "plan-old")).toEqual([]);
    expect(unfold(ics).split("UID:plan-aaa@myboxer153.com").length - 1).toBe(1);
    expect(veventOf(ics, "plan-esc")).toContain("SUMMARY:업무 · 상담\\, 오픈\\; 마감");
    expect(unfold(ics).split("BEGIN:VEVENT").length - 1).toBe(6);
  });
});

describe("calendar-feed — .ics 만들기 (회원)", () => {
  const ics = buildFeedIcs(normalizeFeedData(MEMBER) as FeedData, STAMP);

  it("운동 약속 — 2-2 '한 번 받기'와 같은 시각 · 제목 · 알림 + 휴관일 빼기", () => {
    const v = veventOf(ics, "promise-0123456789abcdef");
    const all = unfold(
      buildPromiseIcs({ weekdays: [2, 4], slot: "evening", start: "2026-11-17", remind: "08:30", branch: "153복싱짐 선릉역점" }, STAMP),
    ).split("\r\n");
    const one = all.slice(all.indexOf("BEGIN:VEVENT"));
    for (const prefix of ["DTSTART", "DTEND", "SUMMARY", "TRIGGER", "RRULE"]) {
      const a = v.find((l) => l.startsWith(prefix));
      const b = one.find((l) => l.startsWith(prefix));
      expect(a, prefix).toBe(b);
    }
    expect(v).toContain("EXDATE;TZID=Asia/Seoul:20261117T190000,20261119T190000");
    expect(v).toContain("TRIGGER:-PT10H30M");
    expect(v).toContain("TRANSP:TRANSPARENT");
    expect(v).toContain("URL:https://myboxer153.com/home");
  });

  it("알림을 끈 약속은 VALARM 없음 · 하루 종일 약속은 날짜로 빼기", () => {
    const d = normalizeFeedData({
      kind: "member",
      name: "x",
      events: [{ uid: "promise-z", day: "2026-11-13", exdates: ["2026-11-16", "2026-11-17"], promise: { weekdays: [1], slot: null, remind: "eve", notify: false } }],
    }) as FeedData;
    const v = veventOf(buildFeedIcs(d, STAMP), "promise-z");
    expect(v).toContain("DTSTART;VALUE=DATE:20261116");
    expect(v).toContain("DTEND;VALUE=DATE:20261117");
    expect(v).toContain("EXDATE;VALUE=DATE:20261116");
    expect(v.some((l) => l === "BEGIN:VALARM")).toBe(false);
  });

  it("153 일정 · D-day = 하루 종일 · 그날 달력 링크", () => {
    expect(veventOf(ics, "event-e1")).toEqual(
      expect.arrayContaining(["DTSTART;VALUE=DATE:20261117", "DTEND;VALUE=DATE:20261118", "SUMMARY:휴관 · 내부 공사", "URL:https://myboxer153.com/home?cal=2026-11-17"]),
    );
    expect(veventOf(ics, "dday-goal-g1")).toContain("URL:https://myboxer153.com/home?cal=2026-12-01");
  });

  it("끊긴 주소 = 일정 없는 달력 (VTIMEZONE 만)", () => {
    const e = buildFeedIcs(emptyFeed(), STAMP);
    expect(e).toContain("BEGIN:VTIMEZONE");
    expect(e).not.toContain("BEGIN:VEVENT");
    expect(feedFileName("staff")).toBe("153-ops.ics");
    expect(feedFileName("member")).toBe("153-calendar.ics");
    expect(feedFileName("branch")).toBe("153-branch.ics");
  });

  it("일정 종류마다 설명 · 링크", () => {
    expect(feedNote({ uid: "event-1", day: "2026-11-17", url: null }, "branch").link).toBe("https://myboxer153.com");
    expect(feedNote({ uid: "event-1", day: "2026-11-17", url: null }, "staff").link).toBe("https://myboxer153.com/office?tab=plan");
    expect(feedNote({ uid: "meeting-1", day: "2026-11-17", url: null }, "staff")).toEqual({
      note: "지점 회의 · 153운영본부 사무실",
      link: "https://myboxer153.com/office",
    });
  });
});

describe("구독 주소 — 화면 쪽", () => {
  const BASE = "https://abc.supabase.co/";
  it("주소 만들기", () => {
    const u = feedHttpsUrl(BASE, TOKEN) as string;
    expect(u).toBe(`https://abc.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics`);
    expect(feedWebcalUrl(u)).toBe(`webcal://abc.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics`);
    expect(googleAddUrl(u)).toBe(`https://calendar.google.com/calendar/render?cid=webcal://abc.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics`);
    expect(feedDownloadUrl(u)).toBe(`${u}?download=1`);
    expect(feedHttpsUrl(BASE, "nope")).toBeNull();
    expect(feedHttpsUrl(null, TOKEN)).toBeNull();
    expect(branchFeedUrl(BASE, "sunreung")).toBe("https://abc.supabase.co/functions/v1/calendar-feed/branch/sunreung.ics");
    expect(branchFeedUrl(BASE, null)).toBeNull();
    expect(branchFeedUrl(BASE, "../x")).toBeNull();
  });

  it("서버 답 다듬기", () => {
    expect(normalizeFeedState({ can: true, on: true, token: TOKEN, last_fetched_at: "2026-11-13T02:00:00Z", fetch_count: 3 }, "staff")).toMatchObject({
      available: true,
      can: true,
      on: true,
      token: TOKEN,
      fetchCount: 3,
    });
    // 토큰이 틀리면 꺼진 것으로
    expect(normalizeFeedState({ can: true, on: true, token: "x" }, "member")).toMatchObject({ on: false, token: null });
    expect(normalizeFeedState(null, "member")).toMatchObject({ can: false, on: false });
    expect(unavailableFeed("staff")).toMatchObject({ available: false, can: false });
  });

  it("기기 고르기", () => {
    expect(feedDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("apple");
    expect(feedDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("apple");
    expect(feedDevice("Mozilla/5.0 (Linux; Android 15; SM-S928N)")).toBe("android");
    expect(feedDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
    expect(feedDevice("", true)).toBe("apple");
  });

  it("마지막으로 읽어 간 때", () => {
    const now = new Date("2026-11-13T03:00:00Z");
    expect(fetchedAgo(null, now)).toBeNull();
    expect(fetchedAgo("2026-11-13T02:59:30Z", now)).toBe("방금");
    expect(fetchedAgo("2026-11-13T02:48:00Z", now)).toBe("12분 전");
    expect(fetchedAgo("2026-11-13T00:00:00Z", now)).toBe("3시간 전");
    expect(fetchedAgo("2026-11-11T03:00:00Z", now)).toBe("2일 전");
    expect(fetchedLine({ lastFetchedAt: "2026-11-13T02:59:30Z" }, now)).toBe("캘린더가 방금 읽어 갔어요 — 잘 연결됐어요");
    expect(fetchedLine({ lastFetchedAt: "2026-11-13T02:48:00Z" }, now)).toBe("캘린더가 12분 전에 읽어 갔어요 — 잘 연결됐어요");
    expect(fetchedLine({ lastFetchedAt: null }, now)).toContain("아직 읽어 간 캘린더가 없어요");
  });
});
