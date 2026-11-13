import { describe, expect, it } from "vitest";
import {
  clipTitle,
  durationMin,
  itemPayload,
  itemSig,
  itemWhen,
  parseIcs,
  parseProp,
  planIcsImport,
  skippedLine,
  toKst,
  unescapeText,
  unfoldLines,
  veventToItem,
  type IcsPlanItem,
} from "./icsImport";

// 2026-11-13 = 금요일
const T = "2026-11-13";
const cal = (...events: string[][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.flatMap((e) => ["BEGIN:VEVENT", ...e, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
/** VEVENT 하나 → 바꾼 결과 */
const one = (...lines: string[]) => veventToItem(parseIcs(cal(lines))[0], T);
const item = (...lines: string[]): IcsPlanItem => {
  const b = one(...lines);
  if (!("item" in b)) throw new Error(`skip: ${b.skip}`);
  return b.item;
};

describe("ics 가져오기 — 파일 읽기", () => {
  it("접힌 줄 · 속성 · 따옴표 안 쌍점", () => {
    expect(unfoldLines("SUMMARY:가나\r\n 다라\r\n\tX\r\nUID:1")).toEqual(["SUMMARY:가나다라X", "UID:1"]);
    expect(parseProp('DTSTART;TZID="Asia/Seoul":20261117T190000')).toEqual({
      name: "DTSTART",
      params: { TZID: "Asia/Seoul" },
      value: "20261117T190000",
    });
    expect(parseProp('ATTENDEE;CN="Kim: Coach";ROLE=REQ-PARTICIPANT:mailto:a@b.c')?.params.CN).toBe("Kim: Coach");
    expect(parseProp("no colon")).toBeNull();
    expect(unescapeText("저녁 약속\\, 강남\\;\\n둘째 줄\\\\")).toBe("저녁 약속, 강남;\n둘째 줄\\");
  });

  it("VALARM 같은 안쪽 칸은 건너뛴다", () => {
    const evs = parseIcs(
      cal(["UID:a", "DTSTART:20261117T100000Z", "BEGIN:VALARM", "TRIGGER:-PT10M", "DESCRIPTION:알림", "END:VALARM", "SUMMARY:바깥"]),
    );
    expect(evs).toHaveLength(1);
    expect(evs[0].props.map((p) => p.name)).toEqual(["UID", "DTSTART", "SUMMARY"]);
  });

  it("시각 → 한국 시간", () => {
    expect(toKst("20261117", {})).toEqual({ day: "2026-11-17", hm: null });
    expect(toKst("20261117", { VALUE: "DATE" })).toEqual({ day: "2026-11-17", hm: null });
    expect(toKst("20261117T190000", { TZID: "Asia/Seoul" })).toEqual({ day: "2026-11-17", hm: "19:00" });
    expect(toKst("20261117T100000Z", {})).toEqual({ day: "2026-11-17", hm: "19:00" });
    expect(toKst("20261117T160000Z", {})).toEqual({ day: "2026-11-18", hm: "01:00" });
    // 뉴욕 11월 = UTC−5 → 09:00 = 14:00Z = 23:00 한국
    expect(toKst("20261117T090000", { TZID: "America/New_York" })).toEqual({ day: "2026-11-17", hm: "23:00" });
    // 뉴욕 7월 = 서머타임 UTC−4 → 09:00 = 13:00Z = 22:00 한국
    expect(toKst("20260715T090000", { TZID: "America/New_York" })).toEqual({ day: "2026-07-15", hm: "22:00" });
    expect(toKst("20261117T190000", { TZID: "Korea Standard Time" })).toEqual({ day: "2026-11-17", hm: "19:00" });
    expect(toKst("20261117T190000", { TZID: "Mars/Base" })).toEqual({ day: "2026-11-17", hm: "19:00" });
    expect(toKst("20261117T190000", {})).toEqual({ day: "2026-11-17", hm: "19:00" });
    expect(toKst("2026-11-17", {})).toBeNull();
    expect(toKst("20261317T190000", {})).toBeNull();
  });

  it("DURATION", () => {
    expect(durationMin("PT1H30M")).toBe(90);
    expect(durationMin("P1D")).toBe(1440);
    expect(durationMin("P1W")).toBe(10080);
    expect(durationMin("-PT15M")).toBe(-15);
    expect(durationMin("P")).toBeNull();
    expect(durationMin("PT")).toBeNull();
    expect(durationMin("1H")).toBeNull();
  });
});

describe("ics 가져오기 — 일정 하나 바꾸기", () => {
  it("시각 일정 · 제목 되돌리기 · 메모는 안 옮김", () => {
    const i = item("UID:a1", "DTSTART;TZID=Asia/Seoul:20261117T190000", "DTEND;TZID=Asia/Seoul:20261117T203000", "SUMMARY:저녁 약속\\, 강남", "DESCRIPTION:비밀 메모");
    expect(i).toMatchObject({
      title: "저녁 약속, 강남",
      start_on: "2026-11-17",
      end_on: "2026-11-17",
      all_day: false,
      start_time: "19:00",
      end_time: "20:30",
      repeat_weekdays: [],
      until_on: null,
      note: null,
    });
    expect(JSON.stringify(i)).not.toContain("비밀");
  });

  it("UTC · 다른 나라 시간대 · 자정을 넘는 일정", () => {
    expect(item("DTSTART:20261117T160000Z", "DTEND:20261117T170000Z")).toMatchObject({ start_on: "2026-11-18", start_time: "01:00", end_time: "02:00" });
    // 뉴욕 9 ~ 10시 = 한국 23:00 ~ 다음 날 00:00 → 23:59 까지(끝이 딱 자정이면 표시 없음)
    expect(item("DTSTART;TZID=America/New_York:20261117T090000", "DTEND;TZID=America/New_York:20261117T100000")).toMatchObject({
      start_on: "2026-11-17",
      start_time: "23:00",
      end_time: "23:59",
      note: null,
    });
    expect(item("DTSTART;TZID=Asia/Seoul:20261117T220000", "DTEND;TZID=Asia/Seoul:20261118T010000")).toMatchObject({
      end_time: "23:59",
      note: "자정을 넘는 일정은 23:59까지",
    });
  });

  it("끝이 없으면 DURATION · 그것도 없으면 1시간 · 하루 종일 하루", () => {
    expect(item("DTSTART;TZID=Asia/Seoul:20261117T190000", "DURATION:PT45M")).toMatchObject({ start_time: "19:00", end_time: "19:45" });
    expect(item("DTSTART;TZID=Asia/Seoul:20261117T190000")).toMatchObject({ start_time: "19:00", end_time: "20:00" });
    expect(item("DTSTART;VALUE=DATE:20261120")).toMatchObject({ all_day: true, start_on: "2026-11-20", end_on: "2026-11-20" });
    expect(item("DTSTART;VALUE=DATE:20261120", "DURATION:P3D")).toMatchObject({ end_on: "2026-11-22" });
  });

  it("하루 종일 여러 날 (끝 날짜는 빼고) · 하루 넘는 시각 일정 = 하루 종일", () => {
    expect(item("DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261123")).toMatchObject({ all_day: true, start_on: "2026-11-20", end_on: "2026-11-22" });
    expect(item("DTSTART;TZID=Asia/Seoul:20261120T100000", "DTEND;TZID=Asia/Seoul:20261122T120000")).toMatchObject({
      all_day: true,
      start_time: null,
      start_on: "2026-11-20",
      end_on: "2026-11-22",
      note: "하루 넘는 일정은 하루 종일로",
    });
  });

  it("매주 반복 — 지난 시작은 오늘부터의 첫 요일로 · UNTIL · 오늘부터의 빼는 날만", () => {
    const i = item(
      "UID:w1",
      "DTSTART;TZID=Asia/Seoul:20261103T190000",
      "DTEND;TZID=Asia/Seoul:20261103T200000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T145959Z",
      "EXDATE;TZID=Asia/Seoul:20261117T190000,20261119T190000",
      "EXDATE;TZID=Asia/Seoul:20261110T190000",
      "SUMMARY:저녁반",
    );
    expect(i).toMatchObject({ repeat_weekdays: [2, 4], start_on: "2026-11-17", end_on: "2026-11-17", until_on: "2026-12-31", skip_dates: ["2026-11-17", "2026-11-19"] });
  });

  it("COUNT · 매일 · UNTIL 이 그날 일정보다 이르면 하루 앞까지", () => {
    expect(item("DTSTART;TZID=Asia/Seoul:20261116T070000", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4")).toMatchObject({
      repeat_weekdays: [1, 3],
      until_on: "2026-11-25",
    });
    expect(item("DTSTART;VALUE=DATE:20261116", "RRULE:FREQ=DAILY;UNTIL=20261120")).toMatchObject({
      repeat_weekdays: [0, 1, 2, 3, 4, 5, 6],
      until_on: "2026-11-20",
      all_day: true,
    });
    expect(item("DTSTART;TZID=Asia/Seoul:20261117T190000", "RRULE:FREQ=WEEKLY;UNTIL=20261230T150000Z")).toMatchObject({
      repeat_weekdays: [2],
      until_on: "2026-12-30",
    });
  });

  it("매월 · 격주는 첫 번만 · 여러 날 반복은 하루씩", () => {
    expect(item("DTSTART;TZID=Asia/Seoul:20261120T190000", "RRULE:FREQ=MONTHLY;BYMONTHDAY=20")).toMatchObject({
      repeat_weekdays: [],
      note: "이 반복(매월 · 격주 등)은 첫 번만",
    });
    expect(item("DTSTART;TZID=Asia/Seoul:20261120T190000", "RRULE:FREQ=WEEKLY;INTERVAL=2")).toMatchObject({ repeat_weekdays: [] });
    expect(item("DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261122", "RRULE:FREQ=WEEKLY")).toMatchObject({
      repeat_weekdays: [5],
      end_on: "2026-11-20",
      note: "여러 날 반복은 하루씩",
    });
  });

  it("지난 · 취소 · 바뀐 하루 · 너무 먼 · 읽을 수 없는 일정은 뺀다", () => {
    expect(one("DTSTART;VALUE=DATE:20261112")).toEqual({ skip: "past" });
    expect(one("DTSTART;TZID=Asia/Seoul:20261103T190000", "RRULE:FREQ=WEEKLY;UNTIL=20261110T145959Z")).toEqual({ skip: "past" });
    expect(one("DTSTART;VALUE=DATE:20261120", "STATUS:CANCELLED")).toEqual({ skip: "canceled" });
    expect(one("DTSTART;VALUE=DATE:20261120", "RECURRENCE-ID;VALUE=DATE:20261120")).toEqual({ skip: "dup" });
    expect(one("DTSTART;VALUE=DATE:20271201")).toEqual({ skip: "far" });
    expect(one("DTSTART:어제")).toEqual({ skip: "bad" });
    expect(one("SUMMARY:날짜 없음")).toEqual({ skip: "bad" });
  });

  it("오늘에 걸친 일정은 오늘부터 · 여러 날은 두 달까지 · 제목은 40자까지", () => {
    expect(item("DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261121")).toMatchObject({ start_on: T, end_on: "2026-11-20" });
    expect(item("DTSTART;VALUE=DATE:20261114", "DTEND;VALUE=DATE:20270301")).toMatchObject({ end_on: "2027-01-15", note: "두 달까지만" });
    const long = "가".repeat(50);
    expect(clipTitle(long)).toBe(`${"가".repeat(39)}…`);
    expect([...item("DTSTART;VALUE=DATE:20261120", `SUMMARY:${long}`).title]).toHaveLength(40);
    expect(clipTitle("  여러   칸\n줄  ")).toBe("여러 칸 줄");
  });
});

describe("ics 가져오기 — 파일 하나", () => {
  const A = ["UID:a", "DTSTART;TZID=Asia/Seoul:20261117T190000", "DTEND;TZID=Asia/Seoul:20261117T200000", "SUMMARY:저녁"];

  it("같은 일정은 한 번 · 전에 넣은 일정 · 이미 있는 일정은 뺀다 · 날짜순", () => {
    const text = cal(
      ["UID:late", "DTSTART;VALUE=DATE:20261201", "SUMMARY:나중"],
      A,
      ["UID:a-copy", ...A.slice(1)],
      ["UID:old", "DTSTART;VALUE=DATE:20261001"],
      ["UID:c", "DTSTART;VALUE=DATE:20261121", "SUMMARY:있는 일정"],
    );
    const fresh = planIcsImport(text, T);
    expect(fresh.items.map((i) => i.title)).toEqual(["저녁", "있는 일정", "나중"]);
    expect(fresh.skipped).toMatchObject({ dup: 1, past: 1 });
    expect(fresh.total).toBe(5);

    const existing = new Set([
      itemSig({ title: "있는 일정", start_on: "2026-11-21", end_on: "2026-11-21", start_time: null, end_time: null, repeat_weekdays: [] }),
    ]);
    const again = planIcsImport(text, T, new Set(["a|20261117T190000"]), existing);
    expect(again.items.map((i) => i.title)).toEqual(["나중"]);
    expect(again.skipped.done).toBe(3); // 전에 넣은 a · 그와 같은 a-copy · 이미 있는 c
  });

  it("한 번에 200개까지", () => {
    const evs = Array.from({ length: 205 }, (_, k) => [`UID:n${k}`, `DTSTART;VALUE=DATE:2027${String(1 + Math.floor(k / 28)).padStart(2, "0")}${String(1 + (k % 28)).padStart(2, "0")}`]);
    const r = planIcsImport(cal(...evs), T);
    expect(r.items).toHaveLength(200);
    expect(r.skipped.over).toBe(5);
  });

  it("뺀 것 한 줄 · 보낼 값 · 미리 보기 글", () => {
    expect(skippedLine({ past: 12, canceled: 0, far: 0, dup: 0, done: 3, over: 0, bad: 0 })).toBe("이미 넣은 3 · 지난 일정 12개는 빼요");
    expect(skippedLine({ past: 0, canceled: 0, far: 0, dup: 0, done: 0, over: 0, bad: 0 })).toBeNull();

    const timed = item(...A);
    expect(itemPayload(timed, { branch: "153복싱짐 선릉역점", kind: "personal", private: true })).toEqual({
      branch: "153복싱짐 선릉역점",
      kind: "personal",
      title: "저녁",
      memo: "",
      start_on: "2026-11-17",
      end_on: "2026-11-17",
      repeat_weekdays: [],
      until_on: null,
      all_day: false,
      start_time: "19:00",
      end_time: "20:00",
      private: true,
    });
    expect(itemPayload(timed, { branch: "b", kind: "work", private: true })).toMatchObject({ kind: "work", private: false });
    expect(itemPayload(timed, { branch: "b", kind: "off", private: false })).toMatchObject({ all_day: true, start_time: null, end_time: null });

    expect(itemWhen(timed)).toBe("11/17(화) 19:00–20:00");
    expect(itemWhen(item("DTSTART;TZID=Asia/Seoul:20261117T190000", "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T145959Z"))).toBe(
      "매주 화 · 목 19:00–20:00 · 12/31(목)까지",
    );
    expect(itemWhen(item("DTSTART;VALUE=DATE:20261116", "RRULE:FREQ=DAILY"))).toBe("매일 하루 종일");
    expect(itemWhen(item("DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261123"))).toBe("11/20(금) – 11/22(일) 하루 종일");
  });
});
