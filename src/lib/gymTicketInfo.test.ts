import { describe, expect, it } from "vitest";
import {
  asOfLabel,
  daysUntil,
  leftText,
  lockerNumberText,
  lockerView,
  ptTicketView,
  rentalUseRows,
  termStateOf,
  ymdText,
} from "./gymTicketInfo";

const TODAY = "2026-10-19";

describe("PT 남은 횟수 (2026-10-19)", () => {
  it("PT 회원이면 수업권 이름·남은 횟수·기한·확인 시각", () => {
    const v = ptTicketView(
      {
        pt_until: "2026-10-26",
        pt_ticket: "  퍼스널 트레이닝   20회권 ",
        pt_remaining: 19,
        pt_end_date: "2027-02-11",
        pt_checked_at: "2026-10-19T05:40:28.017Z",
      },
      TODAY,
    );
    expect(v).toEqual({ ticket: "퍼스널 트레이닝 20회권", remaining: 19, endDate: "2027-02-11", asOf: "2026-10-19T05:40:28.017Z" });
  });

  it("PT 기간이 지났거나 없으면 null — 회원카드 파란 배지와 같은 기준", () => {
    expect(ptTicketView({ pt_until: "2026-10-18", pt_remaining: 3 }, TODAY)).toBeNull();
    expect(ptTicketView({ pt_remaining: 3 }, TODAY)).toBeNull();
    expect(ptTicketView(null, TODAY)).toBeNull();
  });

  it("남은 횟수가 이상하면 모름(null) — 0회는 0회", () => {
    expect(ptTicketView({ pt_until: TODAY, pt_remaining: null }, TODAY)?.remaining).toBeNull();
    expect(ptTicketView({ pt_until: TODAY, pt_remaining: -1 }, TODAY)?.remaining).toBeNull();
    expect(ptTicketView({ pt_until: TODAY, pt_remaining: 0 }, TODAY)?.remaining).toBe(0);
  });
});

describe("락카 번호 (2026-10-19)", () => {
  it("브로제이 '개인락카 / 11' → 11번 · 개인락카", () => {
    const l = lockerView({ locker_label: "개인락카 / 11", locker_updated_at: "2026-10-19T05:40:28Z" });
    expect(l).toEqual({ number: "11", area: "개인락카", asOf: "2026-10-19T05:40:28Z" });
    expect(lockerNumberText(l!)).toBe("11번");
  });

  it("번호만 · '번' 붙은 것 · 이름도 받는다", () => {
    expect(lockerView({ locker_label: "106" })).toMatchObject({ number: "106", area: null });
    expect(lockerView({ locker_label: "54번" })).toMatchObject({ number: "54", area: null });
    const named = lockerView({ locker_label: "여자 락카 / A-3" });
    expect(named).toMatchObject({ number: "A-3", area: "여자 락카" });
    expect(lockerNumberText(named!)).toBe("A-3");
  });

  it("비어 있거나 '없음'이면 null", () => {
    for (const v of [null, "", "  ", "-", "없음", "미배정"]) expect(lockerView({ locker_label: v })).toBeNull();
    expect(lockerView(null)).toBeNull();
  });
});

describe("확인 시각 글 (KST)", () => {
  const now = Date.parse("2026-10-19T11:00:00Z"); // 20:00 KST
  it("오늘 · 어제 · 그 전", () => {
    expect(asOfLabel("2026-10-19T05:40:28Z", now)).toBe("오늘 오후 2:40 기준");
    expect(asOfLabel("2026-10-18T21:40:24Z", now)).toBe("오늘 오전 6:40 기준");
    expect(asOfLabel("2026-10-18T13:40:32Z", now)).toBe("어제 오후 10:40 기준");
    expect(asOfLabel("2026-10-16T03:00:00Z", now)).toBe("10월 16일 기준");
  });
  it("자정·정오", () => {
    expect(asOfLabel("2026-10-18T15:05:00Z", now)).toBe("오늘 오전 12:05 기준");
    expect(asOfLabel("2026-10-19T03:00:00Z", now)).toBe("오늘 오후 12:00 기준");
  });
  it("값이 없거나 이상하면 null", () => {
    expect(asOfLabel(null, now)).toBeNull();
    expect(asOfLabel("어제", now)).toBeNull();
  });
});

it("날짜 모양은 수강권 카드와 같다", () => {
  expect(ymdText("2027-02-11")).toBe("2027. 2. 11.");
});

describe("락카 · 운동복 남은 기간 (2026-10-27)", () => {
  const T = "2026-10-26";
  it("남은 날 = 끝나는 날 − 오늘 (오늘 끝나면 0 '오늘까지')", () => {
    expect(daysUntil("2027-01-25", T)).toBe(91);
    expect(daysUntil("2026-10-26T15:00:00+09:00", T)).toBe(0);
    expect(daysUntil(null, T)).toBeNull();
    expect([leftText(91), leftText(0), leftText(-3), leftText(null)]).toEqual(["91일 남음", "오늘까지", "끝남", ""]);
  });
  it("7일 이하 주황(soon) · 지나면 끝남", () => {
    expect([termStateOf(8), termStateOf(7), termStateOf(0), termStateOf(-1), termStateOf(null)]).toEqual([
      "ok", "soon", "soon", "ended", "unknown",
    ]);
  });
  it("보고서 예시: 락카 12번 · 1월 25일까지 · 운동복 11월 25일까지", () => {
    const rows = rentalUseRows({ locker_label: "12", locker_end: "2027-01-25", sportswear_end: "2026-11-25" }, T);
    expect(rows).toEqual([
      { kind: "locker", label: "락카", sub: "12번", end: "2027-01-25", left: 91, state: "ok" },
      { kind: "sportswear", label: "운동복", sub: null, end: "2026-11-25", left: 30, state: "ok" },
    ]);
  });
  it("번호만 있는 락카(끝나는 날 모름)도 보이고, 끝난 지 30일 넘은 운동복은 뺀다", () => {
    expect(rentalUseRows({ locker_label: "개인락카 / 11" }, T)).toEqual([
      { kind: "locker", label: "락카", sub: "개인락카 11번", end: null, left: null, state: "unknown" },
    ]);
    expect(rentalUseRows({ sportswear_end: "2026-09-25" }, T)).toEqual([]);
    expect(rentalUseRows({ sportswear_end: "2026-10-20" }, T)[0]).toMatchObject({ state: "ended", left: -6 });
    // 번호가 남아 있으면 오래전에 끝난 락카도 '끝남 · 연장하기'로 보여 준다
    expect(rentalUseRows({ locker_label: "7", locker_end: "2026-01-01" }, T)[0]).toMatchObject({ state: "ended" });
    expect(rentalUseRows({ locker_end: "2026-01-01" }, T)).toEqual([]);
    expect(rentalUseRows(null, T)).toEqual([]);
  });
});
