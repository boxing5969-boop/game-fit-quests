import { describe, expect, it } from "vitest";
import {
  alarmOffset,
  buildPromiseIcs,
  durationOf,
  escapeText,
  firstMatching,
  foldLine,
  icsStamp,
  kstDay,
  parseIcsQuery,
} from "../../supabase/functions/calendar-ics/ics.ts";
import { promiseIcsStart, promiseIcsUrl } from "./promiseIcs";
import type { Promise153 } from "./promise153";

// 2026-11-13 = 금요일
const T = "2026-11-13";
const enc = new TextEncoder();
const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("calendar-ics — 주소 인자 읽기", () => {
  it("요일 · 시간대 · 알림 · 지점 (정해 둔 것만)", () => {
    const q = new URLSearchParams({ w: "4,2,2", d: "2026-11-17", s: "evening", r: "eve", b: "선릉역점" });
    expect(parseIcsQuery(q, T)).toEqual({ weekdays: [2, 4], slot: "evening", start: "2026-11-17", remind: "eve", branch: "153복싱짐 선릉역점" });
    const odd = parseIcsQuery(new URLSearchParams({ w: "1", s: "midnight", r: "09:00", b: "<script>" }), T);
    expect(odd).toEqual({ weekdays: [1], slot: null, start: "2026-11-16", remind: "08:30", branch: null });
  });

  it("틀린 요일 · 먼 날짜 · 요일이 다른 첫 날", () => {
    expect(parseIcsQuery(new URLSearchParams({ w: "" }), T)).toEqual({ error: "요일을 다시 골라 주세요" });
    expect(parseIcsQuery(new URLSearchParams({ w: "7" }), T)).toEqual({ error: "요일을 다시 골라 주세요" });
    expect(parseIcsQuery(new URLSearchParams({ w: "1,x" }), T)).toEqual({ error: "요일을 다시 골라 주세요" });
    // 한 달 뒤 날짜 → 오늘부터 · 금(5)이면 오늘
    expect(parseIcsQuery(new URLSearchParams({ w: "5", d: "2026-12-20" }), T)).toMatchObject({ start: T });
    // 화요일만 약속인데 첫 날이 금요일 → 다음 화요일
    expect(firstMatching(T, [2])).toBe("2026-11-17");
    expect(firstMatching(T, [5, 2])).toBe(T);
  });
});

describe("calendar-ics — 알림 시각", () => {
  it("시각 있는 일정 · 하루 종일", () => {
    expect(alarmOffset({ slot: "evening", remind: "08:30" })).toBe(8 * 60 + 30 - 19 * 60); // 그날 8:30
    expect(alarmOffset({ slot: "evening", remind: "eve" })).toBe(-23 * 60); // 전날 20:00
    expect(alarmOffset({ slot: null, remind: "08:30" })).toBe(510);
    expect(alarmOffset({ slot: null, remind: "eve" })).toBe(-240);
    // 새벽 6시 운동에 아침 8:30 알림 → 1시간 전
    expect(alarmOffset({ slot: "dawn", remind: "08:30" })).toBe(-60);
    expect(alarmOffset({ slot: "morning", remind: "07:00" })).toBe(-60); // 7시 운동에 7시 알림 → 1시간 전
    expect(durationOf(-630)).toBe("-PT10H30M");
    expect(durationOf(510)).toBe("PT8H30M");
    expect(durationOf(-240)).toBe("-PT4H");
    expect(durationOf(-60)).toBe("-PT1H");
    expect(durationOf(0)).toBe("PT0M");
  });
});

describe("calendar-ics — 파일", () => {
  const stamp = icsStamp(new Date("2026-11-12T15:30:00.123Z"));
  it("매주 반복 · 한국 시간 · 알림 · 접기", () => {
    const ics = buildPromiseIcs({ weekdays: [2, 4], slot: "evening", start: "2026-11-17", remind: "08:30", branch: "153복싱짐 선릉역점" }, stamp);
    expect(stamp).toBe("20261112T153000Z");
    expect(ics.endsWith("\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    const u = unfold(ics);
    expect(u).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,TH");
    expect(u).toContain("DTSTART;TZID=Asia/Seoul:20261117T190000");
    expect(u).toContain("DTEND;TZID=Asia/Seoul:20261117T200000");
    expect(u).toContain("TZID:Asia/Seoul\r\nBEGIN:STANDARD");
    expect(u).toContain("SUMMARY:153 운동 약속 · 저녁");
    expect(u).toContain("LOCATION:153복싱짐 선릉역점");
    expect(u).toContain("DESCRIPTION:약속한 날 체육관에 오면 그날이 약속 지킨 날이에요.\\n약속은 마이복서153 운동 달력에서 고칠 수 있어요.");
    expect(u).toContain("TRIGGER:-PT10H30M");
    expect(u).toContain("UID:153-promise-24-evening-20261117@myboxer153.com");
    expect(u).toContain("TRANSP:TRANSPARENT");
    expect(u.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("하루 종일 · 전날 저녁 · 장소 없음", () => {
    const u = unfold(buildPromiseIcs({ weekdays: [1], slot: null, start: "2026-11-16", remind: "eve", branch: null }, stamp));
    expect(u).toContain("DTSTART;VALUE=DATE:20261116");
    expect(u).toContain("DTEND;VALUE=DATE:20261117");
    expect(u).toContain("TRIGGER:-PT4H");
    expect(u).toContain("DESCRIPTION:내일은 운동 약속한 날이에요");
    expect(u).toContain("SUMMARY:153 운동 약속\r\n");
    expect(u).not.toContain("LOCATION");
  });

  it("글 이스케이프 · 한글 접기는 글자 단위", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = "DESCRIPTION:" + "운동".repeat(40);
    const folded = foldLine(long);
    for (const line of folded.split("\r\n")) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(long);
    expect(foldLine("SHORT")).toBe("SHORT");
  });

  it("한국 날짜", () => {
    expect(kstDay(new Date("2026-11-12T15:30:00Z"))).toBe("2026-11-13");
    expect(kstDay(new Date("2026-11-12T14:59:00Z"))).toBe("2026-11-12");
  });
});

describe("휴대폰 캘린더 주소 (화면)", () => {
  const P: Promise153 = { weekdays: [4, 2], timeSlot: "evening", planB: "x", notify: true, remind: "eve", startedOn: "2026-11-01" };
  it("첫 날 = 오늘이 약속한 날이면 오늘, 아니면 다음 약속한 날", () => {
    expect(promiseIcsStart(P, T)).toBe("2026-11-17"); // 금 → 다음 화요일
    expect(promiseIcsStart({ ...P, weekdays: [5] }, T)).toBe(T);
  });
  it("주소 — 사람을 알아볼 값 없이", () => {
    const url = promiseIcsUrl("https://x.supabase.co/", P, T, "선릉역점");
    expect(url).toBe(
      `https://x.supabase.co/functions/v1/calendar-ics?w=2%2C4&d=2026-11-17&s=evening&r=eve&b=${encodeURIComponent("선릉역점")}`,
    );
    expect(url).not.toContain("plan");
    const plain = promiseIcsUrl("https://x.supabase.co", { ...P, timeSlot: null, remind: null }, T, null);
    expect(plain).toBe("https://x.supabase.co/functions/v1/calendar-ics?w=2%2C4&d=2026-11-17");
    expect(promiseIcsUrl("", P, T, null)).toBeNull();
    expect(promiseIcsUrl("https://x", null, T, null)).toBeNull();
    // 화면 주소를 함수가 그대로 읽는다
    const q = new URL(url as string).searchParams;
    expect(parseIcsQuery(q, T)).toEqual({ weekdays: [2, 4], slot: "evening", start: "2026-11-17", remind: "eve", branch: "153복싱짐 선릉역점" });
  });
});
