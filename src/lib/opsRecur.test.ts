import { describe, expect, it } from "vitest";

import cases from "./opsRecur.cases.json";
import {
  RECUR_COUNT_MAX,
  countUntil,
  fillRule,
  firstOccurrence,
  monthModeLabel,
  monthModes,
  monthRule,
  nextOccurrence,
  occursOnRule,
  parseRrule,
  recurDates,
  ruleLabel,
  ruleOf,
  ruleText,
  type RecurSource,
} from "./opsRecur";

interface Case {
  id: number;
  note: string;
  start: string;
  rrule: string | null;
  days: number[] | null;
  end: string | null;
  until: string | null;
  skip: string[];
  frm: string;
  to: string;
  expect: string[];
}

/** 서버가 저장하는 모양으로 — 시작 = 규칙에 맞는 첫날 · COUNT 면 끝 = 마지막 날 · 규칙 글 = ruleText */
function storedFromCase(c: Pick<Case, "start" | "rrule" | "days" | "end" | "until" | "skip">): RecurSource {
  if (!c.rrule && !c.days) return { start_on: c.start, end_on: c.end ?? c.start, rrule: null, repeat_weekdays: [], until_on: null, skip_dates: [] };
  const rule = c.rrule ? fillRule((parseRrule(c.rrule) as NonNullable<ReturnType<typeof parseRrule>>).rule, c.start) : ruleOf({ rrule: null, repeat_weekdays: c.days ?? [], start_on: c.start });
  if (!rule) throw new Error("규칙 없음");
  const first = firstOccurrence(rule, c.start) as string;
  const until = rule.count != null ? countUntil(rule, first) : c.until;
  return {
    start_on: first,
    end_on: first,
    rrule: c.rrule ? ruleText(rule) : null,
    repeat_weekdays: rule.freq === "WEEKLY" ? rule.byDay : [],
    until_on: until,
    skip_dates: c.skip,
  };
}

describe("반복 규칙 — 같은 경우 40개 (기대값 = python dateutil)", () => {
  const list = (cases as { cases: Case[] }).cases;
  it("40개", () => expect(list).toHaveLength(40));
  for (const c of list) {
    it(`${c.id}. ${c.note}`, () => {
      expect(recurDates(storedFromCase(c), c.frm, c.to)).toEqual(c.expect);
    });
  }
});

describe("규칙 읽기 · 글", () => {
  it("모양을 정리한다 — 순서 · 소문자 · RRULE: · WKST=MO", () => {
    expect(ruleText(parseRrule("rrule:byday=th,tu;freq=weekly;wkst=MO")!.rule)).toBe("FREQ=WEEKLY;BYDAY=TU,TH");
    expect(ruleText(parseRrule("FREQ=MONTHLY;BYDAY=+1MO;INTERVAL=1")!.rule)).toBe("FREQ=MONTHLY;BYDAY=1MO");
    expect(ruleText(parseRrule("FREQ=MONTHLY;COUNT=10;BYMONTHDAY=-1;INTERVAL=2")!.rule)).toBe("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1;COUNT=10");
    expect(ruleText(parseRrule("FREQ=WEEKLY;BYDAY=SU,SA,MO")!.rule)).toBe("FREQ=WEEKLY;BYDAY=MO,SA,SU");
  });

  it("UNTIL — 날짜 · UTC 시각은 한국 날짜로", () => {
    expect(parseRrule("FREQ=DAILY;UNTIL=20261231")!.until).toBe("2026-12-31");
    expect(parseRrule("FREQ=DAILY;UNTIL=20261231T145959Z")!.until).toBe("2026-12-31");
    expect(parseRrule("FREQ=DAILY;UNTIL=20261231T150000Z")!.until).toBe("2027-01-01");
    expect(parseRrule("FREQ=DAILY;UNTIL=20261231T235959")!.until).toBe("2026-12-31");
  });

  it("받지 않는 모양은 null", () => {
    for (const bad of [
      "",
      "FREQ=HOURLY",
      "FREQ=WEEKLY;BYDAY=1MO",
      "FREQ=MONTHLY;BYDAY=MO",
      "FREQ=MONTHLY;BYDAY=6MO",
      "FREQ=MONTHLY;BYDAY=-2FR",
      "FREQ=MONTHLY;BYDAY=1MO,3MO",
      "FREQ=MONTHLY;BYMONTHDAY=32",
      "FREQ=MONTHLY;BYMONTHDAY=-2",
      "FREQ=MONTHLY;BYMONTHDAY=1,15",
      "FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=3",
      "FREQ=YEARLY;BYMONTH=3",
      "FREQ=YEARLY;BYDAY=MO",
      "FREQ=DAILY;BYMONTHDAY=3",
      "FREQ=DAILY;COUNT=3;UNTIL=20261231",
      "FREQ=DAILY;COUNT=0",
      `FREQ=DAILY;COUNT=${RECUR_COUNT_MAX + 1}`,
      "FREQ=DAILY;INTERVAL=31",
      "FREQ=WEEKLY;INTERVAL=13",
      "FREQ=WEEKLY;BYDAY=MO,MO",
      "FREQ=WEEKLY;WKST=SU",
      "FREQ=DAILY;FREQ=DAILY",
      "FREQ=DAILY;UNTIL=20260230",
      "FREQ=DAILY;BYSETPOS=1",
    ]) {
      expect(parseRrule(bad), bad).toBeNull();
    }
  });
});

describe("시작 날 · 횟수", () => {
  it("규칙에 맞는 첫날로 당긴다", () => {
    const r = fillRule(parseRrule("FREQ=MONTHLY;BYDAY=-1FR")!.rule, "2026-11-28");
    expect(firstOccurrence(r, "2026-11-28")).toBe("2026-12-25");
    expect(firstOccurrence(fillRule(parseRrule("FREQ=YEARLY")!.rule, "2026-02-28"), "2026-02-28")).toBe("2026-02-28");
  });
  it("10년 안에 다 못 채우는 횟수는 null", () => {
    const r = parseRrule("FREQ=YEARLY;INTERVAL=5;COUNT=4")!.rule;
    expect(countUntil(r, "2028-02-29")).toBeNull();
    expect(countUntil(parseRrule("FREQ=WEEKLY;BYDAY=MO;COUNT=3")!.rule, "2026-11-16")).toBe("2026-11-30");
  });
  it("저장 전(끝이 비어 있음)에도 횟수대로 보인다", () => {
    const p: RecurSource = { start_on: "2026-11-16", end_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=2", repeat_weekdays: [1], until_on: null, skip_dates: [] };
    expect(occursOnRule(p, "2026-11-23")).toBe(true);
    expect(occursOnRule(p, "2026-11-30")).toBe(false);
  });
  it("다음 날", () => {
    const p: RecurSource = { start_on: "2026-11-16", end_on: "2026-11-16", rrule: "FREQ=WEEKLY;BYDAY=MO", repeat_weekdays: [1], until_on: null, skip_dates: ["2026-11-23"] };
    expect(nextOccurrence(p, "2026-11-17")).toBe("2026-11-30");
    expect(nextOccurrence({ ...p, rrule: null, repeat_weekdays: [], end_on: "2026-11-18" }, "2026-11-19")).toBeNull();
  });
});

describe("화면 글", () => {
  const lab = (t: string, start: string, until?: string | null) => ruleLabel(fillRule(parseRrule(t)!.rule, start), start, until);
  it("규칙 한 줄", () => {
    expect(lab("FREQ=DAILY", "2026-11-13")).toBe("매일");
    expect(lab("FREQ=DAILY;INTERVAL=3", "2026-11-13")).toBe("3일마다");
    expect(lab("FREQ=WEEKLY;BYDAY=TU,TH", "2026-11-17", "2026-12-31")).toBe("매주 화 · 목 · 12월 31일까지");
    expect(lab("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-16")).toBe("매주 평일");
    expect(lab("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,SU", "2026-11-14")).toBe("2주마다 주말");
    expect(lab("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU", "2026-11-13")).toBe("매일");
    expect(lab("FREQ=MONTHLY;BYMONTHDAY=15", "2026-11-15")).toBe("매월 15일");
    expect(lab("FREQ=MONTHLY;BYMONTHDAY=-1", "2026-11-30")).toBe("매월 말일");
    expect(lab("FREQ=MONTHLY;BYDAY=3TU", "2026-11-17")).toBe("매월 셋째 화요일");
    expect(lab("FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR;COUNT=6", "2026-11-27")).toBe("2개월마다 마지막 금요일 · 6번");
    expect(lab("FREQ=YEARLY", "2026-11-13")).toBe("매년 11월 13일");
    expect(lab("FREQ=YEARLY;INTERVAL=2", "2026-11-13")).toBe("2년마다 11월 13일");
  });
  it("매월 고르기 — 시작 날로 고를 수 있는 모양", () => {
    expect(monthModes("2026-11-13")).toEqual(["day", "nth"]);
    expect(monthModes("2026-11-27")).toEqual(["day", "nth", "lastWd"]);
    expect(monthModes("2026-11-30")).toEqual(["day", "lastWd", "lastDay"]);
    expect(monthModeLabel("nth", "2026-11-13")).toBe("매월 둘째 금요일");
    expect(monthModeLabel("lastWd", "2026-11-30")).toBe("매월 마지막 월요일");
    expect(monthRule("lastDay", "2026-11-30")).toEqual({ nth: null, nthWd: null, monthDay: -1 });
  });
});

describe("끌어 옮기기 — 규칙도 그 날에 맞춤", () => {
  it("매주 = 끈 요일만 새 요일로 · 매월 n번째 · 말일 · 마지막 · 매년 그대로", async () => {
    const { shiftRule } = await import("./opsRecur");
    const wk = parseRrule("FREQ=WEEKLY;BYDAY=TU,TH")!.rule;
    // 화요일을 수요일로 → 수 · 목 (목요일은 그대로)
    expect(shiftRule(wk, "2026-11-17", "2026-11-18").byDay).toEqual([3, 4]);
    // 목요일을 금요일로 → 화 · 금
    expect(shiftRule(wk, "2026-11-19", "2026-11-20").byDay).toEqual([2, 5]);
    // 목요일을 이미 있는 화요일로 → 합쳐져 화
    expect(shiftRule(wk, "2026-11-19", "2026-11-17").byDay).toEqual([2]);
    // 같은 요일(다음 주 같은 요일 · 시각만) → 그대로
    expect(shiftRule(wk, "2026-11-17", "2026-11-24")).toBe(wk);
    expect(shiftRule(parseRrule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA")!.rule, "2026-11-14", "2026-11-13").byDay).toEqual([5]);
    const nth = fillRule(parseRrule("FREQ=MONTHLY;BYDAY=3TU")!.rule, "2026-11-17");
    expect(shiftRule(nth, "2026-11-17", "2026-11-13")).toMatchObject({ nth: 2, nthWd: 5 });
    expect(shiftRule(nth, "2026-11-17", "2026-11-30")).toMatchObject({ nth: -1, nthWd: 1 });
    const last = fillRule(parseRrule("FREQ=MONTHLY;BYMONTHDAY=-1")!.rule, "2026-11-30");
    expect(shiftRule(last, "2026-11-30", "2026-11-29").monthDay).toBe(29);
    const yr = parseRrule("FREQ=YEARLY")!.rule;
    expect(shiftRule(yr, "2026-11-13", "2026-11-20")).toBe(yr);
  });
});
