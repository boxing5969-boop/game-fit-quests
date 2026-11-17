import { describe, expect, it } from "vitest";

import { withholding33, type OpsPtEvent, type OpsPtRate } from "./opsPt";
import {
  ptPayBasis,
  ptPayDiffNotes,
  ptPayFirstRecordMonth,
  ptPayHoldText,
  ptPayLinesAll,
  ptPayMonth,
  ptPayMonthCovered,
  ptTeamKey,
  ptTeamTag,
  PT_PAY_BY_RECORD_FROM,
} from "./opsPtPay";
import { PT_NO_ENTRY_MONTH_LIMIT, matchPtRecord, type PtRecAttendance, type PtRecMember, type PtRecSession, type PtRecordData } from "./opsPtRecord";

// ───────── 지어낸 자료 (실제 회원 · 금액 아님 — 수당표는 DB 에만) ─────────
const COACH = "coach-1";
const COACH2 = "coach-2";
const T20 = "퍼스널 트레이닝 20회권";
const TEAM = "팀PT 4인 10회";
const rates: OpsPtRate[] = [
  { team_size: 1, sessions: 10, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 1, sessions: 20, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 4, sessions: 10, session_rate: 80000, valid_from: "2026-01-01" },
];
let seq = 0;
const member = (id: string, name: string): PtRecMember => ({
  user_id: id, name, label: null, tail: "", ticket: T20, remaining: 10, end_date: null, checked_at: null,
});
const ses = (m: string | null, date: string, kind: PtRecSession["kind"] = "lesson", more: Partial<PtRecSession> = {}): PtRecSession => ({
  id: `s${(seq += 1)}`, member_user_id: m, member_name: m ?? "이름만", ticket_name: T20, coach_staff_id: COACH, session_date: date, kind,
  uses: 1, moved_to: null, no_entry_reason: null, note: null, late: false, reviewed_at: null, created_at: `${date}T20:00:00+09:00`, ...more,
});
const ev = (m: string | null, date: string, used = 1, more: Partial<OpsPtEvent> = {}): OpsPtEvent => ({
  id: `e${(seq += 1)}`, member_user_id: m, member_name: m ?? "이름만", ticket_name: T20, before: null, after: null, used, kind: "used",
  status: "auto", coach_staff_id: COACH, work_date: date, detected_at: `${date}T10:40:00+09:00`, note: null, ...more,
});
const came = (m: string, date: string, hm = "19:00"): PtRecAttendance => ({ user_id: m, date, at: `${date}T${hm}:00+09:00` });
const data = (today: string, more: Partial<PtRecordData>): PtRecordData => ({
  branch: "예시 지점", on: true, started_on: "2026-11-12", today, manage: true, me_staff: null,
  members: [member("a", "가온"), member("b", "나래"), member("c", "다솜"), member("d", "라온"), member("e", "마루")],
  sessions: [], events: [], attendance: [], ...more,
});
/** 짝짓고 한 달을 셈한다 */
const pay = (d: PtRecordData, month: string, opt: { coach?: string | null; rates?: OpsPtRate[] | null; monthEvents?: OpsPtEvent[] } = {}) =>
  ptPayMonth(matchPtRecord(d), d.events ?? [], opt.rates === undefined ? rates : opt.rates, month, opt.coach === undefined ? COACH : opt.coach, opt.monthEvents);

describe("수당 기준이 바뀌는 달", () => {
  it("전사 전환 달은 2026-12 · PT 기록을 켠 달은 그다음 달부터(1일에 켰으면 그 달부터)", () => {
    expect(PT_PAY_BY_RECORD_FROM).toBe("2026-12");
    expect(ptPayFirstRecordMonth("2026-11-12")).toBe("2026-12");
    expect(ptPayFirstRecordMonth("2026-10-01")).toBe("2026-12");
    expect(ptPayFirstRecordMonth("2027-01-15")).toBe("2027-02");
    expect(ptPayFirstRecordMonth("2027-02-01")).toBe("2027-02");
    expect(ptPayFirstRecordMonth("2026-12-20")).toBe("2027-01");
  });

  it("11월은 차감 기준 · 12월부터 기록 기준 · PT 기록을 안 켠 지점은 늘 차감 기준", () => {
    expect(ptPayBasis("2026-11-01", "2026-11-12")).toBe("deduct");
    expect(ptPayBasis("2026-12-01", "2026-11-12")).toBe("record");
    expect(ptPayBasis("2027-03-01", "2026-11-12")).toBe("record");
    expect(ptPayBasis("2026-12-01", null)).toBe("deduct");
  });
});

describe("받은 자료에 그 달 기록이 다 있는가", () => {
  it("서버는 최근 넉 달만 보낸다 — 창이 잘렸고 그 달이 창보다 앞에서 시작하면 셈하지 않는다", () => {
    // 켠 지 얼마 안 됨 — 창이 켠 날 14일 앞에서 시작(잘리지 않음): 어느 달이든 받은 것이 전부다
    const fresh = { from: "2026-10-29", started_on: "2026-11-12" };
    expect(ptPayMonthCovered("2026-11-01", fresh)).toBe(true);
    expect(ptPayMonthCovered("2026-10-01", fresh)).toBe(true);
    expect(ptPayMonthCovered("2026-12-01", fresh)).toBe(true);
    // 넉 달 넘게 씀 — 창이 2026-12-18 에서 시작: 12월은 일부만 있다
    const clipped = { from: "2026-12-18", started_on: "2026-11-12" };
    expect(ptPayMonthCovered("2026-12-01", clipped)).toBe(false);
    expect(ptPayMonthCovered("2026-11-01", clipped)).toBe(false);
    expect(ptPayMonthCovered("2027-01-01", clipped)).toBe(true);
    expect(ptPayMonthCovered("2027-04-01", clipped)).toBe(true);
    // 창이 그 달 1일에서 시작하면 다 있다
    expect(ptPayMonthCovered("2027-01-01", { from: "2027-01-01", started_on: "2026-11-12" })).toBe(true);
    // 예전 서버(창 정보 없음) · 예시 자료
    expect(ptPayMonthCovered("2026-12-01", {})).toBe(true);
  });
});

describe("한 달 셈 — 기록 + 차감", () => {
  it("기록과 차감이 맞은 수업만 지급 대상 — 회원별 · 합계 · 3.3%", () => {
    const d = data("2026-12-20", {
      sessions: [ses("a", "2026-12-03"), ses("b", "2026-12-05"), ses("a", "2026-12-10")],
      events: [ev("a", "2026-12-04"), ev("b", "2026-12-05"), ev("a", "2026-12-11")],
      attendance: [came("a", "2026-12-03"), came("b", "2026-12-05"), came("a", "2026-12-10")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.basis).toBe("record");
    expect(p.paidUses).toBe(3);
    expect(p.gross).toBe(90000);
    expect(p.net).toBe(withholding33(90000).net);
    expect(p.unpriced).toBe(0);
    expect(p.hold.total).toBe(0);
    expect(p.byDeduct).toEqual({ uses: 3, gross: 90000 });
    expect(p.diff).toEqual({ prevLesson: 0, nextMonth: 0, carryOut: 0, extra: 0, held: 0, preStart: 0, team: { classes: 0, deducts: 0 } });
    expect(ptPayDiffNotes(p)).toEqual([]);
    expect(p.members).toEqual([
      { key: "a", name: "가온", uses: 2, pay: 60000 },
      { key: "b", name: "나래", uses: 1, pay: 30000 },
    ]);
    expect(p.lines.map((l) => [l.date, l.name, l.state, l.deductDate, l.rate])).toEqual([
      ["2026-12-03", "가온", "paid", "2026-12-04", 30000],
      ["2026-12-05", "나래", "paid", "2026-12-05", 30000],
      ["2026-12-10", "가온", "paid", "2026-12-11", 30000],
    ]);
  });

  it("수업한 달에 든다 — 12/31 수업의 차감이 1/1 에 잡혀도 12월 몫, 1월에는 두 번 세지 않는다", () => {
    const d = data("2027-01-10", {
      sessions: [ses("a", "2026-12-31"), ses("a", "2027-01-05")],
      events: [ev("a", "2027-01-01"), ev("a", "2027-01-06")],
      attendance: [came("a", "2026-12-31"), came("a", "2027-01-05")],
    });
    const dec = pay(d, "2026-12-01");
    expect(dec.paidUses).toBe(1);
    expect(dec.lines[0]).toMatchObject({ date: "2026-12-31", deductDate: "2027-01-01", state: "paid", carry: false });
    expect(dec.byDeduct.uses).toBe(0);
    expect(dec.diff.nextMonth).toBe(1);
    expect(ptPayDiffNotes(dec)).toEqual(["이 달 수업인데 차감이 다음 달에 잡힌 1회 — 수업한 이 달에 넣어요"]);

    const jan = pay(d, "2027-01-01");
    expect(jan.paidUses).toBe(1);
    expect(jan.lines.map((l) => l.date)).toEqual(["2027-01-05"]);
    expect(jan.byDeduct.uses).toBe(2);
    expect(jan.diff.prevLesson).toBe(1);
    expect(jan.carryUses).toBe(0);
    expect(ptPayDiffNotes(jan)).toEqual(["지난달 수업의 차감 1회 — 수업한 달 몫이에요"]);
  });

  it("전환 달 경계 — 11월(차감 기준) 수업인데 차감이 12월에 잡히면 12월에 「지난달 수업」으로 지급한다", () => {
    const d = data("2026-12-10", {
      sessions: [ses("a", "2026-11-30"), ses("b", "2026-12-02")],
      events: [ev("a", "2026-12-01"), ev("b", "2026-12-02")],
      attendance: [came("a", "2026-11-30"), came("b", "2026-12-02")],
    });
    // 11월은 차감 기준 — 그 달에 잡힌 차감이 없어 예전 방식으로는 0회(이 수업이 빠진다). 미리 보기에도 넣지 않는다 — 12월 몫이다
    const nov = pay(d, "2026-11-01");
    expect(nov.basis).toBe("deduct");
    expect(nov.byDeduct.uses).toBe(0);
    expect(nov.lines).toEqual([]);
    expect(nov.diff.carryOut).toBe(1);
    expect(ptPayDiffNotes(nov)).toEqual(["이 달 수업인데 차감이 다음 달에 잡힌 1회 — 다음 달에 「지난달 수업」으로 지급해요"]);
    // 12월은 기록 기준 — 그 수업을 12월에 얹는다
    const dec = pay(d, "2026-12-01");
    expect(dec.basis).toBe("record");
    expect(dec.paidUses).toBe(2);
    expect(dec.carryUses).toBe(1);
    expect(dec.gross).toBe(60000);
    expect(dec.lines.map((l) => [l.date, l.carry, l.deductDate, l.payYm])).toEqual([
      ["2026-11-30", true, "2026-12-01", "2026-12"],
      ["2026-12-02", false, "2026-12-02", "2026-12"],
    ]);
    expect(dec.byDeduct.uses).toBe(2);
    expect(ptPayDiffNotes(dec)).toEqual(["지난달 수업인데 차감이 이 달에 잡힌 1회 — 이 달에 「지난달 수업」으로 지급해요"]);
  });

  it("보류 — 차감 대기 · 차감 확인 중 · 늦은 기록 확인 전 · 사유 없는 출석 없음 · 기록 없는 차감", () => {
    const d = data("2026-12-20", {
      sessions: [
        ses("a", "2026-12-10"), // 차감이 열흘째 없다
        ses("b", "2026-12-19"), // 어제 수업 — 차감 확인 중
        ses("c", "2026-12-08", "lesson", { late: true }), // 늦은 기록 — 확인 전
        ses("d", "2026-12-12"), // 출석 체크 없음 · 사유 없음
      ],
      events: [ev("c", "2026-12-09"), ev("d", "2026-12-13"), ev("e", "2026-12-15")],
      attendance: [came("a", "2026-12-10"), came("b", "2026-12-19"), came("c", "2026-12-08")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.paidUses).toBe(0);
    expect(p.gross).toBe(0);
    expect(p.hold).toEqual({ pending: 1, wait: 1, check: 0, review: 1, reason: 1, member: 0, extra: 1, total: 5 });
    expect(p.lines.map((l) => [l.name, l.state])).toEqual([
      ["다솜", "review"],
      ["가온", "wait"],
      ["라온", "reason"],
      ["나래", "pending"],
    ]);
    expect(p.extras.map((x) => [x.name, x.workDate, x.count])).toEqual([["마루", "2026-12-15", 1]]);
    expect(p.diff).toEqual({ prevLesson: 0, nextMonth: 0, carryOut: 0, extra: 1, held: 2, preStart: 0, team: { classes: 0, deducts: 0 } });
    expect(ptPayHoldText(p.hold)).toBe("차감 대기 1 · 차감 확인 중 1 · 늦은 기록 확인 전 1 · 사유 필요 1 · 기록 없는 차감 1");
    expect(ptPayDiffNotes(p)).toEqual([
      "기록 없는 차감 1회 — 수업 기록이 생길 때까지 보류해요",
      "차감은 맞았지만 확인 · 사유를 기다리는 기록 2회 — 풀리면 지급 대상이 돼요",
    ]);
  });

  it("수업권이 끝나 지점장 확인을 기다리는 차감 — 「차감 대기」가 아니라 「수업권 끝남 · 확인 중」으로 보류, 확인하면 지급 대상", () => {
    const base = {
      sessions: [ses("a", "2026-12-10")],
      attendance: [came("a", "2026-12-10")],
    };
    const held = pay(data("2026-12-20", { ...base, events: [ev("a", "2026-12-11", 1, { kind: "ended", status: "check" })] }), "2026-12-01");
    expect(held.paidUses).toBe(0);
    expect(held.lines.map((l) => l.state)).toEqual(["check"]);
    expect(held.hold).toEqual({ pending: 0, wait: 0, check: 1, review: 0, reason: 0, member: 0, extra: 0, total: 1 });
    expect(ptPayHoldText(held.hold)).toBe("수업권 끝남 확인 중 1");
    // 확인 전 차감은 차감 기준에도 들지 않는다
    expect(held.byDeduct.uses).toBe(0);

    const ok = pay(data("2026-12-20", { ...base, events: [ev("a", "2026-12-11", 1, { kind: "ended", status: "confirmed" })] }), "2026-12-01");
    expect(ok.paidUses).toBe(1);
    expect(ok.hold.total).toBe(0);
  });

  it("전환 달 경계로 얹은 줄이 확인을 기다려도 「지난달 수업」으로 센다(수업한 달 몫이라고 하지 않는다)", () => {
    const d = data("2026-12-10", {
      sessions: [ses("a", "2026-11-30", "lesson", { late: true })],
      events: [ev("a", "2026-12-01")],
      attendance: [came("a", "2026-11-30")],
    });
    const dec = pay(d, "2026-12-01");
    expect(dec.paidUses).toBe(0);
    expect(dec.carryUses).toBe(0);
    expect(dec.lines.map((l) => [l.date, l.state, l.carry])).toEqual([["2026-11-30", "review", true]]);
    expect(dec.hold.review).toBe(1);
    expect(ptPayDiffNotes(dec)).toEqual([
      "지난달 수업인데 차감이 이 달에 잡힌 1회 — 이 달에 「지난달 수업」으로 지급해요",
      "차감은 맞았지만 확인 · 사유를 기다리는 기록 1회 — 풀리면 지급 대상이 돼요",
    ]);
  });

  it("늦은 기록은 확인하면, 출석 체크 없는 수업은 사유가 있으면 지급 대상", () => {
    const d = data("2026-12-20", {
      sessions: [
        ses("c", "2026-12-08", "lesson", { late: true, reviewed_at: "2026-12-10T09:00:00+09:00" }),
        ses("d", "2026-12-12", "lesson", { no_entry_reason: "door_open" }),
      ],
      events: [ev("c", "2026-12-09"), ev("d", "2026-12-13")],
      attendance: [came("c", "2026-12-08")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.paidUses).toBe(2);
    expect(p.hold.total).toBe(0);
    expect(p.noEntry).toBe(1);
    expect(p.noEntryOver).toBe(false);
    expect(p.lines.find((l) => l.name === "라온")).toMatchObject({ noEntry: true, state: "paid" });
  });

  it("출석 체크 없는 수업이 한 달 3회를 넘으면 표시한다(지급은 그대로)", () => {
    const days = ["2026-12-01", "2026-12-03", "2026-12-08", "2026-12-10"];
    const d = data("2026-12-20", {
      sessions: days.map((x) => ses("a", x, "lesson", { no_entry_reason: "manual" })),
      events: days.map((x) => ev("a", x)),
    });
    const p = pay(d, "2026-12-01");
    expect(p.noEntry).toBe(PT_NO_ENTRY_MONTH_LIMIT + 1);
    expect(p.noEntryOver).toBe(true);
    expect(p.paidUses).toBe(4);
  });

  it("연속 2회 수업은 두 줄 — 차감이 1회만 잡혔으면 한 줄만 지급 대상 · 노쇼 · 당일취소도 1회", () => {
    const d = data("2026-12-20", {
      sessions: [ses("a", "2026-12-03", "lesson", { uses: 2 }), ses("b", "2026-12-04", "noshow"), ses("c", "2026-12-05", "late_cancel"), ses("d", "2026-12-06", "moved", { moved_to: "2026-12-09" })],
      events: [ev("a", "2026-12-04", 1), ev("b", "2026-12-04"), ev("c", "2026-12-06")],
      attendance: [came("a", "2026-12-03")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.lines.map((l) => [l.name, l.kind, l.state])).toEqual([
      ["가온", "lesson", "paid"],
      ["가온", "lesson", "wait"],
      ["나래", "noshow", "paid"],
      ["다솜", "late_cancel", "paid"],
    ]);
    expect(p.paidUses).toBe(3);
    expect(p.hold.wait).toBe(1);
    expect(p.gross).toBe(90000);
  });

  it("단가 — 팀 수업권은 팀 1회 수당 그대로(단체 PT 결정 6) · 수당표에 없는 수업권은 금액 없이 따로 센다 · 수당표를 못 받으면 금액 없음", () => {
    const d = data("2026-12-20", {
      sessions: [ses("a", "2026-12-03", "lesson", { ticket_name: TEAM }), ses("b", "2026-12-04", "lesson", { ticket_name: "체험 3회권" }), ses("c", "2026-12-05")],
      events: [ev("a", "2026-12-03", 1, { ticket_name: TEAM }), ev("b", "2026-12-04", 1, { ticket_name: "체험 3회권" }), ev("c", "2026-12-05")],
      attendance: [came("a", "2026-12-03"), came("b", "2026-12-04"), came("c", "2026-12-05")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.lines.map((l) => l.rate)).toEqual([80000, null, 30000]);
    expect(p.paidUses).toBe(3);
    expect(p.unpriced).toBe(1);
    expect(p.gross).toBe(110000);

    const blind = pay(d, "2026-12-01", { rates: null });
    expect(blind.paidUses).toBe(3);
    expect(blind.gross).toBeNull();
    expect(blind.net).toBeNull();
    expect(blind.unpriced).toBe(0);
    expect(blind.byDeduct).toEqual({ uses: 3, gross: null });
    expect(blind.lines.every((l) => l.rate === null)).toBe(true);
    expect(blind.members.every((m) => m.pay === null)).toBe(true);
  });

  it("코치마다 따로 — 다른 코치의 기록 · 차감 · 기록 없는 차감은 섞이지 않는다", () => {
    const d = data("2026-12-20", {
      sessions: [ses("a", "2026-12-03"), ses("b", "2026-12-04", "lesson", { coach_staff_id: COACH2 })],
      events: [ev("a", "2026-12-03"), ev("b", "2026-12-04", 1, { coach_staff_id: COACH2 }), ev("e", "2026-12-07", 1, { coach_staff_id: COACH2 })],
      attendance: [came("a", "2026-12-03"), came("b", "2026-12-04")],
    });
    const mine = pay(d, "2026-12-01");
    expect(mine.paidUses).toBe(1);
    expect(mine.hold.extra).toBe(0);
    expect(mine.byDeduct.uses).toBe(1);
    const other = pay(d, "2026-12-01", { coach: COACH2 });
    expect(other.paidUses).toBe(1);
    expect(other.hold.extra).toBe(1);
    expect(other.byDeduct.uses).toBe(2);
    const all = pay(d, "2026-12-01", { coach: null });
    expect(all.paidUses).toBe(2);
    expect(all.byDeduct.uses).toBe(3);
  });

  it("켠 날 앞 수업 — 차감이 없으면 맞춰 보지 않고, 켠 뒤에 차감이 잡혔으면 그 달 미리 보기에 든다 · 자동 기록 표시", () => {
    const d = data("2026-11-16", {
      sessions: [ses("a", "2026-11-05"), ses("b", "2026-11-11"), ses("c", "2026-11-13", "lesson", { source: "auto" })],
      events: [ev("b", "2026-11-12"), ev("c", "2026-11-14")],
      attendance: [came("b", "2026-11-11"), came("c", "2026-11-13")],
    });
    // 그 달 차감 전체(켠 날 앞 포함)를 따로 주면 차감 기준 견줌에 쓴다
    const monthEvents = [...(d.events ?? []), ev("a", "2026-11-06"), ev("e", "2026-11-03", 2)];
    const p = pay(d, "2026-11-01", { monthEvents });
    expect(p.basis).toBe("deduct");
    expect(p.lines.map((l) => [l.name, l.date, l.state, l.auto])).toEqual([
      ["나래", "2026-11-11", "paid", false],
      ["다솜", "2026-11-13", "paid", true],
    ]);
    expect(p.hold.total).toBe(0);
    expect(p.byDeduct).toEqual({ uses: 5, gross: 150000 });
    // 켜기 전 차감 3회(11/3 2회 · 11/6 1회)는 기록이 없어 견줄 수 없다
    expect(p.diff.preStart).toBe(3);
    expect(ptPayDiffNotes(p)).toEqual(["PT 기록을 켜기 전에 잡힌 차감 3회 — 기록이 없어 차감 기준으로만 셈해요"]);
  });

  it("이틀을 넘겨 잡힌 차감(늦은 차감)도 수업한 달에 지급 대상 — 줄에 표시만", () => {
    const d = data("2026-12-28", {
      sessions: [ses("a", "2026-12-03")],
      events: [ev("a", "2026-12-20")],
      attendance: [came("a", "2026-12-03")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.lines[0]).toMatchObject({ state: "paid", lateDeduct: true, deductDate: "2026-12-20" });
    expect(p.paidUses).toBe(1);
  });
});

describe("단체 PT — 수업 1회당 고정, 참석 인원과 무관 (3단계 · 결정 6)", () => {
  // 팀 수업권 기록은 팀원마다 한 줄 — 같은 코치 · 같은 날 · 같은 정원은 수업 하나(팀 1회 수당 80,000 · 지어낸 금액)
  const team = (m: string, date: string, kind: PtRecSession["kind"] = "lesson", more: Partial<PtRecSession> = {}) =>
    ses(m, date, kind, { ticket_name: TEAM, ...more });
  const tev = (m: string, date: string, used = 1, more: Partial<OpsPtEvent> = {}) => ev(m, date, used, { ticket_name: TEAM, ...more });
  const at = (m: string, date: string, hm: string) => came(m, date, hm);

  it("셋이 온 4인 팀 수업 = 한 줄 · 팀 1회 수당 그대로 — 안 온 팀원(기록 없음)이 있어도 같다", () => {
    const d = data("2026-12-20", {
      sessions: [
        team("a", "2026-12-03", "lesson", { created_at: "2026-12-03T20:00:00+09:00" }),
        team("b", "2026-12-03", "lesson", { created_at: "2026-12-03T20:01:00+09:00" }),
        team("c", "2026-12-03", "lesson", { created_at: "2026-12-03T20:02:00+09:00" }),
      ],
      events: [tev("a", "2026-12-03"), tev("b", "2026-12-03"), tev("c", "2026-12-04")],
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:05"), at("c", "2026-12-03", "19:12")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({
      name: "가온 외 2명",
      kind: "lesson",
      state: "paid",
      rate: 80000,
      deductDate: "2026-12-03",
      team: { size: 4, names: ["가온", "나래", "다솜"], paid: 3, deducts: 3, mixed: false, key: "2026-12-03|4" },
    });
    // 대표 줄 = 먼저 적은 기록(가온) — 월 마감 서버가 이 기록으로 확인한다
    expect(p.lines[0].id).toBe(`${d.sessions?.[0].id}:0`);
    expect(p.paidUses).toBe(1);
    expect(p.gross).toBe(80000);
    expect(p.net).toBe(withholding33(80000).net);
    expect(p.members).toEqual([{ key: "team:4:10", name: "4인 팀 수업", uses: 1, pay: 80000 }]);
    // 차감 기준(예전) = 팀원 1명 = 팀 1회 ÷ 정원 → 3회 · 60,000 — 왜 다른지 한 줄
    expect(p.byDeduct).toEqual({ uses: 3, gross: 60000 });
    expect(p.diff.team).toEqual({ classes: 1, deducts: 3 });
    expect(ptPayDiffNotes(p)).toEqual([
      "단체 PT 수업 1회 · 팀원 차감 3회 — 수업 한 번에 팀 1회 수당이라 차감 기준(팀원 1명 = 팀 1회 ÷ 정원)과 달라요",
    ]);
    // 한 명만 온 날도 팀 1회 수당
    const one = data("2026-12-20", { sessions: [team("d", "2026-12-10")], events: [tev("d", "2026-12-10")], attendance: [at("d", "2026-12-10", "19:00")] });
    expect(pay(one, "2026-12-01").lines.map((l) => [l.name, l.rate, l.team?.paid])).toEqual([["라온", 80000, 1]]);
  });

  it("미참석 · 당일 취소 팀원이 있어도 수업 한 번 · 모두 미참석이어도 차감이 맞으면 1회(1:1 미참석과 같다)", () => {
    const d = data("2026-12-20", {
      sessions: [team("a", "2026-12-03"), team("b", "2026-12-03", "noshow"), team("c", "2026-12-03", "late_cancel"), team("a", "2026-12-05", "noshow"), team("b", "2026-12-05", "noshow")],
      events: [tev("a", "2026-12-03"), tev("b", "2026-12-03"), tev("c", "2026-12-03"), tev("a", "2026-12-05"), tev("b", "2026-12-05")],
      attendance: [at("a", "2026-12-03", "19:00")],
    });
    const p = pay(d, "2026-12-01");
    expect(p.lines.map((l) => [l.date, l.kind, l.state, l.rate, l.team?.paid])).toEqual([
      ["2026-12-03", "lesson", "paid", 80000, 3],
      ["2026-12-05", "noshow", "paid", 80000, 2],
    ]);
    expect(p.paidUses).toBe(2);
    expect(p.noEntry).toBe(0);
  });

  it("차감이 아직이면 수업 한 줄로 보류 — 팀원 한 명이라도 차감이 맞으면 지급 대상", () => {
    const sessions = [team("a", "2026-12-10"), team("b", "2026-12-10", "lesson", { created_at: "2026-12-10T20:05:00+09:00" })];
    const attendance = [at("a", "2026-12-10", "19:00"), at("b", "2026-12-10", "19:02")];
    const wait = pay(data("2026-12-20", { sessions, attendance }), "2026-12-01");
    expect(wait.lines.map((l) => [l.name, l.state, l.rate])).toEqual([["가온 외 1명", "wait", 80000]]);
    expect(wait.hold).toMatchObject({ wait: 1, total: 1 });
    expect(wait.paidUses).toBe(0);
    // 나래 차감만 잡힘 → 나래가 대표 줄로 지급 대상
    const d = data("2026-12-20", { sessions, attendance, events: [tev("b", "2026-12-11")] });
    const ok = pay(d, "2026-12-01");
    expect(ok.lines.map((l) => [l.id, l.state, l.rate, l.team?.paid])).toEqual([[`${sessions[1].id}:0`, "paid", 80000, 1]]);
    expect(ok.hold.total).toBe(0);
  });

  it("같은 날 두 팀 수업 — 함께 들어온 무리가 90분 넘게 떨어지면 따로 · 한 명뿐인 무리(하루 두 번 입장)는 가까운 수업에", () => {
    const two = data("2026-12-20", {
      sessions: [team("a", "2026-12-03"), team("b", "2026-12-03"), team("c", "2026-12-03"), team("d", "2026-12-03"), team("e", "2026-12-03")],
      events: ["a", "b", "c", "d", "e"].map((m) => tev(m, "2026-12-03")),
      attendance: [at("a", "2026-12-03", "10:00"), at("b", "2026-12-03", "10:05"), at("c", "2026-12-03", "19:00"), at("d", "2026-12-03", "19:10"), at("e", "2026-12-03", "07:30")],
    });
    const p = pay(two, "2026-12-01");
    expect(p.lines.map((l) => l.team?.names)).toEqual([
      ["가온", "나래", "마루"],
      ["다솜", "라온"],
    ]);
    expect(p.paidUses).toBe(2);
    expect(p.gross).toBe(160000);
    // 한 수업인데 한 명이 아침에도 들어왔다 — 두 수업으로 나누지 않는다
    const once = data("2026-12-20", {
      sessions: [team("a", "2026-12-03"), team("b", "2026-12-03"), team("c", "2026-12-03")],
      events: ["a", "b", "c"].map((m) => tev(m, "2026-12-03")),
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:04"), at("c", "2026-12-03", "07:10")],
    });
    expect(pay(once, "2026-12-01").lines.map((l) => [l.team?.names.length, l.rate])).toEqual([[3, 80000]]);
  });

  it("연속 2회 팀 수업은 두 줄(둘째 칸 따로) · 다른 코치 · 1:1 수업권은 묶지 않는다", () => {
    const d = data("2026-12-20", {
      sessions: [team("a", "2026-12-03", "lesson", { uses: 2 }), team("b", "2026-12-03", "lesson", { uses: 2 }), team("c", "2026-12-03", "lesson", { coach_staff_id: COACH2 }), ses("d", "2026-12-03")],
      events: [tev("a", "2026-12-03", 2), tev("b", "2026-12-03", 2), tev("c", "2026-12-03", 1, { coach_staff_id: COACH2 }), ev("d", "2026-12-03")],
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:01"), at("c", "2026-12-03", "19:02"), at("d", "2026-12-03", "18:00")],
    });
    const mine = pay(d, "2026-12-01");
    expect(mine.lines.map((l) => [l.id.slice(l.id.lastIndexOf(":")), l.name, l.rate])).toEqual([
      [":0", "가온 외 1명", 80000],
      [":1", "가온 외 1명", 80000],
      [":0", "라온", 30000],
    ]);
    expect(mine.gross).toBe(190000);
    const all = pay(d, "2026-12-01", { coach: null });
    expect(all.lines.filter((l) => l.team).map((l) => l.name)).toEqual(["가온 외 1명", "가온 외 1명", "다솜"]);
  });

  it("한 팀에 10회권 · 20회권이 섞이면 많은 쪽 수업권의 팀 1회 수당 — 두 줄로 나누지 않는다(같으면 먼저 적은 기록 쪽)", () => {
    const T4_20 = "팀PT 4인 20회";
    const mixedRates = [...rates, { team_size: 4, sessions: 20, session_rate: 70000, valid_from: "2026-01-01" }];
    const d = data("2026-12-20", {
      sessions: [team("a", "2026-12-03", "lesson", { ticket_name: T4_20 }), team("b", "2026-12-03", "lesson", { ticket_name: T4_20 }), team("c", "2026-12-03")],
      events: [tev("a", "2026-12-03", 1, { ticket_name: T4_20 }), tev("b", "2026-12-03", 1, { ticket_name: T4_20 }), tev("c", "2026-12-03")],
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:01"), at("c", "2026-12-03", "19:02")],
    });
    const p = pay(d, "2026-12-01", { rates: mixedRates });
    expect(p.lines.map((l) => [l.ticket, l.rate, l.team?.mixed])).toEqual([[T4_20, 70000, true]]);
    const tie = data("2026-12-20", {
      sessions: [team("a", "2026-12-03"), team("b", "2026-12-03", "lesson", { ticket_name: T4_20, created_at: "2026-12-03T20:30:00+09:00" })],
      events: [tev("a", "2026-12-03"), tev("b", "2026-12-03", 1, { ticket_name: T4_20 })],
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:01")],
    });
    expect(pay(tie, "2026-12-01", { rates: mixedRates }).lines.map((l) => [l.ticket, l.rate])).toEqual([[TEAM, 80000]]);
  });

  it("전환 달 경계 — 11월 팀 수업의 차감이 12월에 잡힌 줄(지난달 수업)은 묶지 않고 차감 기준대로(팀원 1명 = 팀 1회 ÷ 정원)", () => {
    const d = data("2026-12-20", {
      sessions: [team("a", "2026-11-30"), team("b", "2026-11-30")],
      events: [tev("a", "2026-11-30"), tev("b", "2026-12-01")],
      attendance: [at("a", "2026-11-30", "19:00"), at("b", "2026-11-30", "19:03")],
    });
    const dec = pay(d, "2026-12-01");
    expect(dec.lines.map((l) => [l.name, l.carry, l.rate, !!l.team])).toEqual([["나래", true, 20000, false]]);
    expect(dec.carryUses).toBe(1);
    expect(dec.gross).toBe(20000);
  });

  it("장부에 지급한 대표 줄이 있으면 그 줄이 대표 — 먼저 적은 기록이 새로 생겨도 바뀌지 않는다 · 열쇠 · 표시 글", () => {
    const d = data("2026-12-20", {
      sessions: [team("a", "2026-12-03", "lesson", { created_at: "2026-12-03T21:00:00+09:00" }), team("b", "2026-12-03", "lesson", { created_at: "2026-12-03T20:00:00+09:00" })],
      events: [tev("a", "2026-12-03"), tev("b", "2026-12-03")],
      attendance: [at("a", "2026-12-03", "19:00"), at("b", "2026-12-03", "19:01")],
    });
    const res = matchPtRecord(d);
    const [aId, bId] = [d.sessions?.[0].id, d.sessions?.[1].id];
    expect(ptPayLinesAll(res, d.events ?? [], rates, COACH).map((l) => l.id)).toEqual([`${bId}:0`]);
    expect(ptPayLinesAll(res, d.events ?? [], rates, COACH, undefined, new Set([`${aId}:0`])).map((l) => l.id)).toEqual([`${aId}:0`]);
    expect(ptTeamKey("2026-12-03", TEAM)).toBe("2026-12-03|4");
    expect(ptTeamKey("2026-12-03", T20)).toBeNull();
    expect(ptTeamTag(TEAM)).toBe("4인 팀");
    expect(ptTeamTag("5:1 PT 20회")).toBe("5인 팀");
    expect(ptTeamTag(T20)).toBe("");
  });
});
