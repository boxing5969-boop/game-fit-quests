import { describe, expect, it } from "vitest";
import type { OpsDay } from "./opsWork";
import {
  applyDutyDemo,
  buildDutySample,
  dutyDefaultAt,
  dutyDraftError,
  dutyKindText,
  dutyMinutesLine,
  dutyMissingDays,
  dutyPayload,
  dutyProposedMinutes,
  dutyTodayNudge,
  type DutyReport,
} from "./opsDuty";

const day = (date: string, segs: Array<[string, string]>, extra: Partial<OpsDay> = {}): OpsDay => ({
  date,
  weekday: 0,
  segs: segs.map(([start, end]) => ({ start, end })),
  scheduledMin: 0,
  checkin: null,
  creditedMin: 0,
  overtimeMin: 0,
  status: "missing",
  adjust: null,
  pending: [],
  givenAway: [],
  ...extra,
});

const rep = (p: Partial<DutyReport>): DutyReport => ({
  id: "r1",
  staff_id: "s1",
  staff_name: "코치",
  work_date: "2026-11-12",
  kind: "here",
  at_time: "18:05",
  minutes: 180,
  note: null,
  status: "open",
  created_at: "2026-11-12T10:00:00+09:00",
  mine: true,
  decided_at: null,
  decide_note: null,
  ...p,
});

describe("인정 시간 제안", () => {
  const split = day("2026-11-12", [["09:00", "12:00"], ["18:00", "21:00"]]);
  it("10분 안에 왔으면 시간표대로", () => {
    expect(dutyProposedMinutes(split, "here", "09:10")).toBe(360);
    expect(dutyProposedMinutes(split, "here", "08:40")).toBe(360);
  });
  it("늦게 왔으면 온 시각부터", () => {
    expect(dutyProposedMinutes(split, "here", "09:30")).toBe(150 + 180);
    expect(dutyProposedMinutes(split, "here", "13:00")).toBe(180); // 낮 구간이 끝나고 왔으면 저녁만
    expect(dutyProposedMinutes(split, "here", "18:30")).toBe(150);
  });
  it("일찍 퇴근 = 시작부터 나간 시각까지", () => {
    expect(dutyProposedMinutes(split, "early", "20:00")).toBe(180 + 120);
    expect(dutyProposedMinutes(split, "early", "11:00")).toBe(120);
    expect(dutyProposedMinutes(split, "early", "08:00")).toBe(0);
  });
  it("쉬는 날 0 · 시간표 없으면 · 시각이 이상하면 null", () => {
    expect(dutyProposedMinutes(split, "off", null)).toBe(0);
    expect(dutyProposedMinutes(day("2026-11-12", []), "here", "09:00")).toBeNull();
    expect(dutyProposedMinutes(split, "here", "9:00")).toBeNull();
    expect(dutyProposedMinutes(split, "here", "24:10")).toBeNull();
  });
  it("한마디", () => {
    expect(dutyMinutesLine(180, 180)).toBe("인정 3시간 · 시간표대로");
    expect(dutyMinutesLine(150, 180)).toBe("인정 2시간 30분 · 시간표 3시간");
    expect(dutyMinutesLine(null, 180)).toBe("시간표 3시간 · 인정 시간은 지점장님이 정해요");
  });
});

describe("보내기 검사 — 서버와 같은 말", () => {
  const ctx = { today: "2026-11-12", nowHm: "18:20", checkedIn: false };
  const d = { kind: "here" as const, date: "2026-11-12", at: "18:05", note: "" };
  it("통과", () => expect(dutyDraftError(d, ctx)).toBeNull());
  it("종류 · 날짜 · 미래 · 14일", () => {
    expect(dutyDraftError({ ...d, kind: null }, ctx)).toBe("무엇을 알릴지 골라 주세요");
    expect(dutyDraftError({ ...d, date: "" }, ctx)).toBe("날짜를 골라 주세요");
    expect(dutyDraftError({ ...d, date: "2026-11-13" }, ctx)).toBe("아직 오지 않은 날은 신고할 수 없어요");
    expect(dutyDraftError({ ...d, date: "2026-10-28" }, ctx)).toBe("14일이 지난 날은 지점장님께 말씀해 주세요");
    expect(dutyDraftError({ ...d, date: "2026-10-29" }, ctx)).toBeNull();
  });
  it("시각 · 아직 안 온 시각(5분 여유)", () => {
    expect(dutyDraftError({ ...d, at: "" }, ctx)).toBe("시각을 넣어 주세요");
    expect(dutyDraftError({ ...d, at: "18:25" }, ctx)).toBeNull();
    expect(dutyDraftError({ ...d, at: "18:26" }, ctx)).toBe("아직 오지 않은 시각이에요");
    expect(dutyDraftError({ ...d, date: "2026-11-11", at: "23:00" }, ctx)).toBeNull();
  });
  it("얼굴 출근이 찍힌 날 here 막힘 · 쉬는 날은 시각 없이", () => {
    expect(dutyDraftError(d, { ...ctx, checkedIn: true })).toMatch(/얼굴 출근이 찍혀/);
    expect(dutyDraftError({ ...d, kind: "early" }, { ...ctx, checkedIn: true })).toBeNull();
    expect(dutyDraftError({ ...d, kind: "off", at: "" }, ctx)).toBeNull();
  });
  it("보낼 모양 — 쉬는 날은 시각 · 시간 없이 · 메모 공백 정리", () => {
    expect(dutyPayload("s1", { ...d, note: "  인식 안 됨 " }, 150)).toEqual({
      staff_id: "s1", work_date: "2026-11-12", kind: "here", at_time: "18:05", minutes: 150, note: "인식 안 됨",
    });
    expect(dutyPayload("s1", { ...d, kind: "off", note: " " }, 150)).toEqual({
      staff_id: "s1", work_date: "2026-11-12", kind: "off", at_time: null, minutes: null, note: null,
    });
  });
  it("신고 한 줄", () => {
    expect(dutyKindText("here", "18:05")).toBe("와 있었어요 18:05(얼굴 인식 안 됨)");
    expect(dutyKindText("early", "20:30")).toBe("일찍 퇴근 20:30");
    expect(dutyKindText("off", null)).toBe("쉬는 날이에요");
  });
});

describe("코치 화면 — 오늘 · 지난 날", () => {
  const today = day("2026-11-12", [["18:00", "21:00"]], { status: "today" });
  const base = { nowHm: "18:20", afterMin: 15, reports: [] as DutyReport[], staffId: "s1" };
  it("시작 15분이 지나야", () => {
    expect(dutyTodayNudge(today, { ...base, nowHm: "18:14" })).toBeNull();
    expect(dutyTodayNudge(today, base)).toEqual({ start: "18:00" });
  });
  it("찍었거나 · 고쳤거나 · 쉰 날 · 신고했으면 없음", () => {
    expect(dutyTodayNudge({ ...today, checkin: "18:02" }, base)).toBeNull();
    expect(dutyTodayNudge({ ...today, status: "off", segs: [] }, base)).toBeNull();
    expect(dutyTodayNudge({ ...today, adjust: { id: "e", staff_id: "s1", work_date: "2026-11-12", kind: "adjust", status: "approved", minutes: 60, start_time: null, end_time: null, cover_staff_id: null, reason: null } }, base)).toBeNull();
    expect(dutyTodayNudge(today, { ...base, reports: [rep({})] })).toBeNull();
    expect(dutyTodayNudge(today, { ...base, reports: [rep({ status: "rejected" })] })).toEqual({ start: "18:00" });
    expect(dutyTodayNudge(today, { ...base, reports: [rep({ staff_id: "s2" })] })).toEqual({ start: "18:00" });
  });
  it("지난 누락 날 — 14일 안 · 신고 안 한 날 · 최근 먼저", () => {
    const days = [
      day("2026-10-28", [["09:00", "12:00"]]),
      day("2026-11-01", [["09:00", "12:00"]]),
      day("2026-11-05", [["09:00", "12:00"]]),
      day("2026-11-10", [["09:00", "12:00"]], { status: "ok", checkin: "08:58" }),
      day("2026-11-11", [["09:00", "12:00"]]),
      today,
    ];
    const got = dutyMissingDays(days, { today: "2026-11-12", reports: [rep({ work_date: "2026-11-05" })], staffId: "s1" });
    expect(got.map((d) => d.date)).toEqual(["2026-11-11", "2026-11-01"]);
  });
  it("처음 시각", () => {
    const d = day("2026-11-12", [["18:00", "21:00"]]);
    expect(dutyDefaultAt("here", d, "2026-11-12", "18:20")).toBe("18:20");
    expect(dutyDefaultAt("here", d, "2026-11-12", "17:50")).toBe("18:00");
    expect(dutyDefaultAt("here", { ...d, date: "2026-11-11" }, "2026-11-12", "18:20")).toBe("18:00");
    expect(dutyDefaultAt("early", d, "2026-11-12", "20:10")).toBe("20:10");
    expect(dutyDefaultAt("early", { ...d, date: "2026-11-11" }, "2026-11-12", "20:10")).toBe("21:00");
  });
});

describe("예시 화면", () => {
  it("관리자 = 열린 2 + 처리 1 · 코치 = 내 것만", () => {
    const m = buildDutySample("2026-11-12", true);
    expect(m.reports.filter((r) => r.status === "open")).toHaveLength(2);
    expect(buildDutySample("2026-11-12", false).reports.every((r) => r.mine)).toBe(true);
  });
  it("보내기 · 두 번 누름 · 처리 · 취소", () => {
    const now = "2026-11-12T19:00:00+09:00";
    let d = buildDutySample("2026-11-12", false);
    const p = dutyPayload("demo-duty-me", { kind: "here", date: "2026-11-12", at: "18:05", note: "" }, 180);
    d = applyDutyDemo(d, { type: "send", p, staffName: "나" }, now);
    d = applyDutyDemo(d, { type: "send", p: { ...p, at_time: "18:07", minutes: 175 }, staffName: "나" }, now);
    const mine = d.reports.filter((r) => r.work_date === "2026-11-12");
    expect(mine).toHaveLength(1);
    expect(mine[0].at_time).toBe("18:07");
    d = applyDutyDemo(d, { type: "decide", id: mine[0].id, approve: true, minutes: 170, note: "확인" }, now);
    expect(d.reports.find((r) => r.id === mine[0].id)).toMatchObject({ status: "approved", minutes: 170, decide_note: "확인" });
    d = applyDutyDemo(d, { type: "cancel", id: mine[0].id }, now);
    expect(d.reports.find((r) => r.id === mine[0].id)?.status).toBe("approved"); // 처리된 것은 취소 안 됨
  });
});
