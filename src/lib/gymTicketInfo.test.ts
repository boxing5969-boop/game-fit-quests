import { describe, expect, it } from "vitest";
import { asOfLabel, lockerNumberText, lockerView, ptTicketView, ymdText } from "./gymTicketInfo";

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
