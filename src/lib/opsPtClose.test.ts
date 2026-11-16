import { describe, expect, it } from "vitest";

import { withholding33, type OpsPtEvent, type OpsPtRate } from "./opsPt";
import {
  ptCloseBook,
  ptCloseConfirmSummary,
  ptCloseDueYm,
  ptCloseLedger,
  ptCloseSnapshot,
  ptCloseStartYm,
  ptCloseTodoText,
  ptCoachLabel,
  ptPayDate,
  ptStatement,
  ptStatementChip,
  ptStatementFileName,
  ptStatementFreshYm,
  ptStatementGroups,
  ptStatementStatusText,
  ptStatementTaxText,
  ptTicketText,
  type PtClose,
  type PtCloseData,
  type PtStatement,
} from "./opsPtClose";
import { applyPtCloseDemo, buildPtCloseSample } from "./opsPtCloseSample";
import { PT_SAMPLE_COACH, PT_SAMPLE_RATES, buildPtSample } from "./opsPtRecordSample";
import { matchPtRecord, type PtRecAttendance, type PtRecMember, type PtRecSession, type PtRecordData } from "./opsPtRecord";

// ───────── 지어낸 자료 (실제 회원 · 금액 아님 — 수당표는 DB 에만) ─────────
const COACH = "coach-1";
const COACH2 = "coach-2";
const T20 = "퍼스널 트레이닝 20회권";
const rates: OpsPtRate[] = [{ team_size: 1, sessions: 20, session_rate: 30000, valid_from: "2026-01-01" }];
let seq = 0;
const member = (id: string, name: string): PtRecMember => ({
  user_id: id,
  name,
  label: null,
  tail: "",
  ticket: T20,
  remaining: 10,
  end_date: null,
  checked_at: null,
});
const ses = (id: string, m: string, date: string, more: Partial<PtRecSession> = {}): PtRecSession => ({
  id,
  member_user_id: m,
  member_name: m,
  ticket_name: T20,
  coach_staff_id: COACH,
  session_date: date,
  kind: "lesson",
  uses: 1,
  moved_to: null,
  no_entry_reason: null,
  note: null,
  late: false,
  reviewed_at: null,
  created_at: `${date}T20:00:00+09:00`,
  ...more,
});
const ev = (m: string, date: string, more: Partial<OpsPtEvent> = {}): OpsPtEvent => ({
  id: `e${(seq += 1)}`,
  member_user_id: m,
  member_name: m,
  ticket_name: T20,
  before: null,
  after: null,
  used: 1,
  kind: "used",
  status: "auto",
  coach_staff_id: COACH,
  work_date: date,
  detected_at: `${date}T10:40:00+09:00`,
  note: null,
  ...more,
});
const came = (m: string, date: string): PtRecAttendance => ({ user_id: m, date, at: `${date}T19:00:00+09:00` });
/** 출석을 따로 주지 않으면 기록한 날마다 입장한 것으로 본다 */
const data = (today: string, more: Partial<PtRecordData>): PtRecordData => ({
  branch: "예시 지점",
  on: true,
  started_on: "2026-11-12",
  today,
  manage: true,
  me_staff: null,
  members: [member("a", "가온"), member("b", "나래"), member("c", "다솜"), member("d", "라온")],
  sessions: [],
  events: [],
  ...more,
  attendance: more.attendance ?? (more.sessions ?? []).filter((x) => x.member_user_id).map((x) => came(x.member_user_id as string, x.session_date)),
});
type Opt = { closes?: PtClose[]; rates?: OpsPtRate[] | null; start?: string; from?: string; coach?: string; assumeAgree?: boolean };
const stmt = (d: PtRecordData, month: string, opt: Opt = {}): PtStatement =>
  ptStatement({
    res: matchPtRecord(d),
    events: d.events ?? [],
    rates: opt.rates === undefined ? rates : opt.rates,
    month,
    coachId: opt.coach ?? COACH,
    closes: opt.closes ?? [],
    start: opt.start,
    from: opt.from,
    today: d.today ?? "2027-01-02",
    assumeAgree: opt.assumeAgree,
  });
/** 서버가 승인했을 때의 줄(시험용) — 합계 · 3.3%는 서버처럼 줄에서 셈한다 */
const approved = (st: PtStatement, coach = COACH): PtClose => {
  const snap = ptCloseSnapshot(st);
  const gross = snap.lines.reduce((n, l) => n + (l.t === "settle" ? -(l.rate ?? 0) : (l.rate ?? 0)), 0);
  const w = withholding33(gross);
  return {
    id: `close-${coach}-${st.ym}`,
    coach_staff_id: coach,
    month: `${st.ym}-01`,
    status: "approved",
    confirmed_at: null,
    approved_at: `${st.ym}-28T10:00:00+09:00`,
    uses: snap.lines.filter((l) => l.t !== "settle").length,
    settle_uses: snap.lines.filter((l) => l.t === "settle").length,
    hold: snap.hold,
    gross,
    tax_income: w.income,
    tax_local: w.local,
    net: w.net,
    lines: snap.lines,
    holds: snap.holds,
    confirm: null,
    reopened_at: null,
    reopen_reason: null,
  };
};
const confirmed = (st: PtStatement, coach = COACH): PtClose => ({
  id: `close-${coach}-${st.ym}`,
  coach_staff_id: coach,
  month: `${st.ym}-01`,
  status: "confirmed",
  confirmed_at: `${st.ym}-28T09:00:00+09:00`,
  approved_at: null,
  uses: null,
  settle_uses: null,
  hold: null,
  gross: null,
  tax_income: null,
  tax_local: null,
  net: null,
  lines: null,
  holds: null,
  confirm: ptCloseConfirmSummary(st),
  reopened_at: null,
  reopen_reason: null,
});

// 12월: 가온 12/3 · 나래 12/5 · 가온 12/10 은 맞음, 다솜 12/20 은 차감이 아직(대기)
const decBase = {
  sessions: [ses("s1", "a", "2026-12-03"), ses("s2", "b", "2026-12-05"), ses("s3", "a", "2026-12-10"), ses("s4", "c", "2026-12-20")],
  events: [ev("a", "2026-12-04"), ev("b", "2026-12-05"), ev("a", "2026-12-11")],
  attendance: [came("a", "2026-12-03"), came("b", "2026-12-05"), came("a", "2026-12-10"), came("c", "2026-12-20")],
};

describe("열린 달 — 지금 자료로 셈한다", () => {
  it("달이 안 끝났으면 확정 · 승인을 못 누른다", () => {
    const st = stmt(data("2026-12-28", decBase), "2026-12-01");
    expect(st.status).toBe("none");
    expect(st.monthEnded).toBe(false);
    expect(st.confirmBlock).toBe("1월 1일부터 확정할 수 있어요");
    expect(st.approveBlock).toBe("달이 끝난 뒤에 승인할 수 있어요");
    expect(ptStatementChip(st)).toEqual({ text: "이 달 지급 기준", tone: "ok" });
  });

  it("달이 끝나면 — 지급 줄 · 보류 · 합계 · 3.3% · 차례", () => {
    const st = stmt(data("2027-01-02", decBase), "2026-12-01");
    expect(st.monthEnded).toBe(true);
    expect(st.turn).toBe(true);
    expect(st.pay.map((l) => [l.k, l.t, l.rate])).toEqual([
      ["s1:0", "line", 30000],
      ["s2:0", "line", 30000],
      ["s3:0", "line", 30000],
    ]);
    expect(st.adj).toEqual([]);
    expect(st.settle).toEqual([]);
    expect(st.uses).toBe(3);
    expect(st.hold).toBe(1);
    expect(st.holdLines.map((l) => [l.id, l.state])).toEqual([["s4:0", "wait"]]);
    expect(st.gross).toBe(90000);
    expect(st.net).toBe(withholding33(90000).net);
    expect(st.confirmBlock).toBeNull();
    expect(st.approveBlock).toBeNull();
    expect(ptStatementChip(st).text).toBe("확정 전");
  });

  it("전환 달 경계 줄은 「지난달 수업」(carry)으로 든다", () => {
    const d = data("2027-01-02", {
      sessions: [ses("n1", "a", "2026-11-30"), ses("s1", "b", "2026-12-02")],
      events: [ev("a", "2026-12-01"), ev("b", "2026-12-02")],
      attendance: [came("a", "2026-11-30"), came("b", "2026-12-02")],
    });
    expect(stmt(d, "2026-12-01").pay.map((l) => [l.k, l.t])).toEqual([
      ["n1:0", "carry"],
      ["s1:0", "line"],
    ]);
  });

  it("수당표에 없는 수업권이 있으면 승인을 막는다 · 금액을 못 보는 화면은 횟수만", () => {
    const d = data("2027-01-02", {
      ...decBase,
      sessions: [...decBase.sessions.slice(0, 3), ses("s9", "d", "2026-12-12", { ticket_name: "체험 3회권" })],
      events: [...decBase.events, ev("d", "2026-12-12", { ticket_name: "체험 3회권" })],
      attendance: [...decBase.attendance, came("d", "2026-12-12")],
    });
    const st = stmt(d, "2026-12-01");
    expect(st.unpriced).toBe(1);
    expect(st.approveBlock).toBe("수당표에 없는 수업권 1회 — 금액을 먼저 정해 주세요");
    const blind = stmt(d, "2026-12-01", { rates: null });
    expect(blind.uses).toBe(4);
    expect(blind.gross).toBeNull();
    expect(blind.net).toBeNull();
    expect(blind.unpriced).toBe(0);
  });
});

describe("승인 = 잠금", () => {
  const decSt = stmt(data("2027-01-02", decBase), "2026-12-01");
  const dec = approved(decSt);
  // 1월: 다솜 12/20 수업의 차감이 1/8 에 잡힘 + 1월 수업 2건
  const janData = (today: string, more: Partial<PtRecordData> = {}) =>
    data(today, {
      sessions: [...decBase.sessions, ses("j1", "a", "2027-01-05"), ses("j2", "b", "2027-01-12")],
      events: [...decBase.events, ev("c", "2027-01-08"), ev("a", "2027-01-05"), ev("b", "2027-01-13")],
      ...more,
    });

  it("잠긴 달은 승인본 그대로 — 뒤늦게 풀린 수업은 그 달 숫자를 바꾸지 않고 「달라진 것」으로만 센다", () => {
    const st = stmt(janData("2027-02-02"), "2026-12-01", { closes: [dec] });
    expect(st.locked).toBe(true);
    expect(st.status).toBe("approved");
    expect(st.pay.map((l) => l.k)).toEqual(["s1:0", "s2:0", "s3:0"]);
    expect(st.gross).toBe(90000);
    expect(st.uses).toBe(3);
    expect(st.hold).toBe(1);
    expect(st.after).toEqual({ adj: 1, settle: 0 });
    expect(st.confirmBlock).toBe("이미 승인된 달이에요");
    expect(ptStatementChip(st)).toEqual({ text: "마감 · 승인됨", tone: "ok" });
  });

  it("보정 — 닫은 달의 수업이 뒤늦게 풀리면 다음에 닫는 달에 「12월 보정」 줄로", () => {
    const st = stmt(janData("2027-02-02"), "2027-01-01", { closes: [dec] });
    expect(st.turn).toBe(true);
    expect(st.pay.map((l) => l.k)).toEqual(["j1:0", "j2:0"]);
    expect(st.adj.map((l) => [l.k, l.t, l.from, l.rate])).toEqual([["s4:0", "adj", "2026-12", 30000]]);
    expect(st.uses).toBe(3);
    expect(st.gross).toBe(90000);
    // 승인하면 원장에 들어가 다시 나오지 않는다
    const jan = approved(st);
    expect(jan.lines?.map((l) => [l.k, l.t])).toEqual([
      ["j1:0", "line"],
      ["j2:0", "line"],
      ["s4:0", "adj"],
    ]);
    const feb = stmt(janData("2027-03-02"), "2027-02-01", { closes: [dec, jan] });
    expect(feb.adj).toEqual([]);
    expect(feb.pay).toEqual([]);
    expect(stmt(janData("2027-03-02"), "2026-12-01", { closes: [dec, jan] }).after).toEqual({ adj: 0, settle: 0 });
    expect([...ptCloseLedger([dec, jan], COACH).entries()].map(([k, e]) => [k, e.n, e.amount, e.ym])).toEqual([
      ["s1:0", 1, 30000, "2026-12"],
      ["s2:0", 1, 30000, "2026-12"],
      ["s3:0", 1, 30000, "2026-12"],
      ["j1:0", 1, 30000, "2027-01"],
      ["j2:0", 1, 30000, "2027-01"],
      ["s4:0", 1, 30000, "2027-01"],
    ]);
  });

  it("차례대로 — 앞 달이 열려 있으면 보정 · 정산은 그 달 몫이고 이 달은 승인을 못 한다", () => {
    const st = stmt(janData("2027-03-02"), "2027-02-01", { closes: [dec] });
    expect(st.turn).toBe(false);
    expect(st.prevOpenYm).toBe("2027-01");
    expect(st.adj).toEqual([]);
    expect(st.approveBlock).toBe("1월을 먼저 승인해 주세요");
  });

  it("코치마다 시작 달이 다르다 — 그 달부터 차례를 센다", () => {
    const d = janData("2027-03-02");
    expect(stmt(d, "2027-01-01", { start: "2027-02-01" }).approveBlock).toBe("이 코치의 마감은 2월부터예요");
    const feb = stmt(d, "2027-02-01", { start: "2027-02-01" });
    expect(feb.turn).toBe(true);
    expect(feb.approveBlock).toBeNull();
  });

  it("이중 지급 막기 — 지급한 수업의 날짜를 다음 달로 옮겨도 다시 넣지 않는다", () => {
    const d = janData("2027-02-02", {
      sessions: [ses("s1", "a", "2027-01-03"), ...decBase.sessions.slice(1), ses("j2", "b", "2027-01-12")],
      events: [ev("b", "2026-12-05"), ev("a", "2026-12-11"), ev("a", "2027-01-04"), ev("b", "2027-01-13")],
      attendance: undefined,
    });
    const st = stmt(d, "2027-01-01", { closes: [dec] });
    expect(st.pay.map((l) => l.k)).toEqual(["j2:0"]);
    expect(st.already).toBe(1);
    expect(st.settle).toEqual([]);
  });
});

describe("정산 — 지급한 수업이 없던 일이 됨", () => {
  const dec = approved(stmt(data("2027-01-02", decBase), "2026-12-01"));
  // 12/3 기록을 지웠고(s1 없음), 12/10 수업의 차감을 뺐다(차감 없음 → 대기)
  const jan = (today: string, janSessions: number) =>
    data(today, {
      sessions: [
        decBase.sessions[1],
        decBase.sessions[2],
        ...["2027-01-05", "2027-01-07", "2027-01-12"].slice(0, janSessions).map((x, i) => ses(`j${i + 1}`, "b", x)),
      ],
      events: [decBase.events[1], ...["2027-01-05", "2027-01-07", "2027-01-12"].slice(0, janSessions).map((x) => ev("b", x))],
    });

  it("코치 동의 전에는 빼지 않는다 — 줄만 보인다", () => {
    const st = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec] });
    expect(st.settle.map((l) => [l.k, l.why, l.from, l.rate, l.agreed, l.included])).toEqual([
      ["s1:0", "gone", "2026-12", 30000, false, false],
      ["s3:0", "unpaid", "2026-12", 30000, false, false],
    ]);
    expect(st.gross).toBe(90000);
    expect(ptCloseSnapshot(st).lines.filter((l) => l.t === "settle")).toEqual([]);
  });

  it("코치가 그 줄을 본 채로 확정하면 이 달에서 뺀다", () => {
    const open = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec] });
    const st = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec, confirmed(open)] });
    expect(st.status).toBe("confirmed");
    expect(st.changedSinceConfirm).toBe(false);
    expect(st.settle.map((l) => [l.k, l.agreed, l.included])).toEqual([
      ["s1:0", true, true],
      ["s3:0", true, true],
    ]);
    expect(st.gross).toBe(30000);
    expect(st.net).toBe(withholding33(30000).net);
    const snap = ptCloseSnapshot(st);
    expect(snap.lines.map((l) => [l.k, l.t, l.rate])).toEqual([
      ["j1:0", "line", 30000],
      ["j2:0", "line", 30000],
      ["j3:0", "line", 30000],
      ["s1:0", "settle", 30000],
      ["s3:0", "settle", 30000],
    ]);
    expect(Object.keys(snap.lines[3])).not.toContain("agreed");
    expect(ptStatementChip(st).text).toBe("승인 대기");
    // 승인하면 원장에서 0 — 다음 달에 다시 나오지 않는다
    const janClose = approved(st);
    expect(ptCloseLedger([dec, janClose], COACH).get("s1:0")?.n).toBe(0);
    expect(stmt(jan("2027-03-02", 3), "2027-02-01", { closes: [dec, janClose] }).settle).toEqual([]);
  });

  it("코치 본인 화면 — 확정하면 뺄 줄까지 넣어 합계를 보여 준다(확정한 합계 = 승인될 합계)", () => {
    const mine = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec], assumeAgree: true });
    expect(mine.settle.map((l) => [l.k, l.agreed, l.included])).toEqual([
      ["s1:0", false, true],
      ["s3:0", false, true],
    ]);
    expect(mine.gross).toBe(30000);
    const seen = ptCloseConfirmSummary(mine);
    expect(seen.gross).toBe(30000);
    expect(seen.settle).toEqual(["s1:0", "s3:0"]);
    // 확정한 뒤 대표님 화면의 합계가 코치가 본 합계와 같다
    const hq = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec, confirmed(mine)] });
    expect(hq.gross).toBe(30000);
    expect(hq.changedSinceConfirm).toBe(false);
    // 장부 — 보는 사람이 그 코치 본인일 때만 그렇게 셈한다
    const d = jan("2027-02-02", 3);
    const cd: PtCloseData = {
      branch: "예시 지점",
      on: true,
      available: true,
      first_month: "2026-12-01",
      today: "2027-02-02",
      manage: false,
      pay: false,
      me_staff: COACH,
      coaches: [{ id: COACH, start: "2026-12-01" }],
      closes: [dec],
    };
    expect(ptCloseBook(d, matchPtRecord(d), cd, rates, { viewerCoach: COACH }).statement(COACH, "2027-01-01")?.gross).toBe(30000);
    expect(ptCloseBook(d, matchPtRecord(d), cd, rates).statement(COACH, "2027-01-01")?.gross).toBe(90000);
    expect(ptCloseBook(d, matchPtRecord(d), cd, rates, { viewerCoach: COACH2 }).statement(COACH, "2027-01-01")?.gross).toBe(90000);
  });

  it("이 달 수당보다 많이는 못 뺀다 — 남는 줄은 다음 달로", () => {
    const open = stmt(jan("2027-02-02", 1), "2027-01-01", { closes: [dec] });
    const st = stmt(jan("2027-02-02", 1), "2027-01-01", { closes: [dec, confirmed(open)] });
    expect(st.settle.map((l) => [l.k, l.included])).toEqual([
      ["s1:0", true],
      ["s3:0", false],
    ]);
    expect(st.gross).toBe(0);
  });

  it("확정한 뒤 줄이 달라지면 알려 준다", () => {
    const open = stmt(jan("2027-02-02", 2), "2027-01-01", { closes: [dec] });
    const st = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [dec, confirmed(open)] });
    expect(st.changedSinceConfirm).toBe(true);
  });

  it("넉 달 창이 잘렸으면 창 맨 앞 사흘의 수업은 정산을 따지지 않는다", () => {
    const d = data("2027-02-02", { sessions: [], events: [], from: "2026-12-04" });
    const st = stmt(d, "2027-01-01", { closes: [dec], from: "2026-12-04" });
    // s1(12/3) · s2(12/5)는 창 맨 앞이라 모름 — s3(12/10)만 정산
    expect(st.settle.map((l) => l.k)).toEqual(["s3:0"]);
  });

  it("금액을 못 보는 화면(지점장) — 줄은 보이고 금액은 없다", () => {
    const blindDec: PtClose = {
      ...dec,
      gross: null,
      net: null,
      tax_income: null,
      tax_local: null,
      lines: (dec.lines ?? []).map((l) => ({ ...l, rate: null })),
    };
    const st = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [blindDec], rates: null });
    expect(st.settle.map((l) => [l.k, l.rate])).toEqual([
      ["s1:0", null],
      ["s3:0", null],
    ]);
    expect(st.gross).toBeNull();
    const lockedView = stmt(jan("2027-02-02", 3), "2026-12-01", { closes: [blindDec], rates: null });
    expect(lockedView.locked).toBe(true);
    expect(lockedView.gross).toBeNull();
    expect(lockedView.uses).toBe(3);
  });

  it("다른 코치의 마감은 섞이지 않는다", () => {
    const other = approved(stmt(data("2027-01-02", decBase), "2026-12-01"), COACH2);
    const st = stmt(jan("2027-02-02", 3), "2027-01-01", { closes: [other] });
    expect(st.settle).toEqual([]);
    expect(st.prevOpenYm).toBe("2026-12");
  });
});

describe("서버에 보내는 것", () => {
  it("확정 = 본 줄 · 정산 줄 / 승인 = 줄 · 보류", () => {
    const st = stmt(data("2027-01-02", { ...decBase, events: [...decBase.events, ev("d", "2026-12-15")] }), "2026-12-01");
    expect(ptCloseConfirmSummary(st)).toEqual({ uses: 3, hold: 2, gross: 90000, keys: ["s1:0", "s2:0", "s3:0"], settle: [] });
    const snap = ptCloseSnapshot(st);
    expect(snap.hold).toBe(2);
    expect(snap.lines[0]).toEqual({
      k: "s1:0",
      sid: "s1",
      i: 0,
      t: "line",
      rate: 30000,
      date: "2026-12-03",
      name: "가온",
      kind: "lesson",
      ticket: T20,
      deduct: "2026-12-04",
    });
    expect(snap.holds).toEqual([
      { k: "s4:0", date: "2026-12-20", name: "다솜", state: "wait" },
      { date: "2026-12-15", name: "라온", state: "extra", n: 1 },
    ]);
  });
});

describe("마감 장부 — 코치 · 달마다 명세를 꺼낸다", () => {
  const cdOf = (today: string, closes: PtClose[] = [], more: Partial<PtCloseData> = {}): PtCloseData => ({
    branch: "예시 지점",
    on: true,
    available: true,
    first_month: "2026-12-01",
    today,
    manage: true,
    pay: true,
    can_approve: true,
    can_reopen: true,
    me_staff: null,
    coaches: [
      { id: COACH, start: "2026-12-01" },
      { id: COACH2, start: "2027-02-01" },
    ],
    closes,
    ...more,
  });
  const bookOf = (d: PtRecordData, cd: PtCloseData) => ptCloseBook(d, matchPtRecord(d), cd, rates);

  it("시작 달 — 지점 첫 달과 코치 카드가 생긴 달 가운데 늦은 쪽", () => {
    expect(ptCloseStartYm("2026-12", null)).toBe("2026-12");
    expect(ptCloseStartYm("2026-12", "2026-10-01")).toBe("2026-12");
    expect(ptCloseStartYm("2026-12", "2027-02-01")).toBe("2027-02");
  });

  it("마감할 차례인 달 — 끝난 달 가운데 아직 승인 전인 가장 이른 달", () => {
    expect(ptCloseDueYm([], COACH, "2026-12", "2026-12-31")).toBeNull();
    expect(ptCloseDueYm([], COACH, "2026-12", "2027-01-01")).toBe("2026-12");
    expect(ptCloseDueYm([], COACH, "2026-12", "2027-03-05")).toBe("2026-12");
    const d = data("2027-01-02", decBase);
    const dec = approved(stmt(d, "2026-12-01"));
    expect(ptCloseDueYm([dec], COACH, "2026-12", "2027-01-20")).toBeNull();
    expect(ptCloseDueYm([dec], COACH, "2026-12", "2027-03-05")).toBe("2027-01");
    // 다른 코치의 승인은 세지 않는다
    expect(ptCloseDueYm([dec], COACH2, "2026-12", "2027-01-20")).toBe("2026-12");
  });

  it("장부 — 차례인 달 · 명세 · 코치마다 시작 달", () => {
    const d = data("2027-01-02", decBase);
    const book = bookOf(d, cdOf("2027-01-02"));
    expect(book.firstYm).toBe("2026-12");
    expect(book.startYm(COACH)).toBe("2026-12");
    expect(book.startYm(COACH2)).toBe("2027-02");
    expect(book.due(COACH)).toBe("2026-12-01");
    expect(book.due(COACH2)).toBeNull();
    const st = book.statement(COACH, "2026-12-01");
    expect(st?.uses).toBe(3);
    expect(st?.gross).toBe(90000);
    expect(st?.approveBlock).toBeNull();
    // 서버의 오늘을 쓴다 — 기기 날짜가 달라도 달이 끝났는지는 서버 기준
    expect(bookOf(d, cdOf("2026-12-31")).due(COACH)).toBeNull();
  });

  it("넉 달이 지난 달 — 잠긴 달은 승인본만, 안 잠긴 달은 셈하지 않는다", () => {
    const dec = approved(stmt(data("2027-01-02", decBase), "2026-12-01"));
    // 다섯 달 뒤: 받은 창이 2027-02-01 부터 — 12월 기록은 일부만(여기서는 없음)
    const late = data("2027-06-01", { from: "2027-02-01", sessions: [], events: [] });
    expect(bookOf(late, cdOf("2027-06-01")).statement(COACH, "2026-12-01")).toBeNull();
    const st = bookOf(late, cdOf("2027-06-01", [dec])).statement(COACH, "2026-12-01");
    expect(st?.locked).toBe(true);
    expect(st?.gross).toBe(90000);
    expect(st?.after).toBeNull();
  });

  it("시작 달 앞의 달은 확정도 받지 않는다", () => {
    const st = stmt(data("2027-03-02", decBase), "2027-01-01", { start: "2027-02-01" });
    expect(st.confirmBlock).toBe("마감은 2월부터예요");
  });

  it("한 줄 상태 · 「확인할 것」 글", () => {
    const d = data("2027-01-02", decBase);
    const open = stmt(d, "2026-12-01");
    expect(ptStatementStatusText(stmt(data("2026-12-20", decBase), "2026-12-01"))).toBe("진행 중");
    expect(ptStatementStatusText(open)).toBe("코치 확정 전");
    expect(ptCloseTodoText(open)).toBe("12월 PT 수당 · 코치 확정 전");
    const conf = stmt(d, "2026-12-01", { closes: [{ ...confirmed(open), confirmed_at: "2027-01-02T15:10:00+00:00" }] });
    // 서버 시각(+00:00)은 한국 날짜로 — 1/2 15:10 UTC = 1/3 00:10 KST
    expect(ptStatementStatusText(conf)).toBe("코치 확정 1/3 · 승인 대기");
    expect(ptCloseTodoText(conf)).toBe("12월 PT 수당 승인 대기");
    const done = stmt(d, "2026-12-01", { closes: [{ ...approved(open), approved_at: "2027-01-04T01:00:00+00:00" }] });
    expect(ptStatementStatusText(done)).toBe("승인 1/4");
  });
});

describe("예시 화면 — 이 기기 안에서만 확정 · 승인 · 취소", () => {
  const today = "2026-11-16";
  const rec = buildPtSample(today, false, { auto: true });
  const bookOf = (cd: PtCloseData) => ptCloseBook(rec, matchPtRecord(rec), cd, PT_SAMPLE_RATES, { firstYm: cd.first_month?.slice(0, 7) });

  it("이번 달이 끝난 다음 날인 것처럼 — 확정 → 승인 → 취소가 차례로 된다", () => {
    let cd = buildPtCloseSample(today);
    expect(cd.today).toBe("2026-12-02");
    expect(buildPtCloseSample("2026-12-20").today).toBe("2027-01-02");
    let book = bookOf(cd);
    expect(book.due(PT_SAMPLE_COACH)).toBe("2026-11-01");
    const st = book.statement(PT_SAMPLE_COACH, "2026-11-01");
    if (!st) throw new Error("명세가 없어요");
    expect(st.monthEnded).toBe(true);
    expect(st.uses).toBeGreaterThan(0);
    expect(st.hold).toBeGreaterThan(0);
    expect(st.confirmBlock).toBeNull();
    expect(st.approveBlock).toBeNull();

    cd = applyPtCloseDemo(
      cd,
      { type: "confirm", coachId: PT_SAMPLE_COACH, month: "2026-11-01", summary: ptCloseConfirmSummary(st) },
      "2026-12-02T01:00:00+00:00",
    );
    book = bookOf(cd);
    const conf = book.statement(PT_SAMPLE_COACH, "2026-11-01");
    expect(conf?.status).toBe("confirmed");
    expect(conf?.changedSinceConfirm).toBe(false);

    cd = applyPtCloseDemo(cd, { type: "approve", coachId: PT_SAMPLE_COACH, month: "2026-11-01", snapshot: ptCloseSnapshot(st) }, "2026-12-02T02:00:00+00:00");
    book = bookOf(cd);
    const done = book.statement(PT_SAMPLE_COACH, "2026-11-01");
    expect(done?.locked).toBe(true);
    expect(done?.gross).toBe(st.gross);
    expect(done?.net).toBe(withholding33(st.gross ?? 0).net);
    expect(done?.uses).toBe(st.uses);
    expect(book.due(PT_SAMPLE_COACH)).toBeNull();

    const id = cd.closes?.[0]?.id ?? "";
    cd = applyPtCloseDemo(cd, { type: "reopen", id, reason: "예시" }, "2026-12-02T03:00:00+00:00");
    const back = bookOf(cd).statement(PT_SAMPLE_COACH, "2026-11-01");
    // 취소하면 코치 확정으로 돌아간다(확정은 남는다)
    expect(back?.status).toBe("confirmed");
    expect(back?.locked).toBe(false);
    expect(back?.close?.reopen_reason).toBe("예시");
  });
});

describe("2-3 PT 명세서 — 승인한 달의 줄을 한 장으로", () => {
  // 12월: 가온 2회(12/3 · 12/10) · 나래 1회(12/5 노쇼) — 승인. 1월: 다솜 12/20 이 뒤늦게 풀림(보정)
  const decData = data("2027-01-02", {
    sessions: [ses("s1", "a", "2026-12-03"), ses("s2", "b", "2026-12-05", { kind: "noshow" }), ses("s3", "a", "2026-12-10"), ses("s4", "c", "2026-12-20")],
    events: [ev("a", "2026-12-04"), ev("b", "2026-12-05"), ev("a", "2026-12-11")],
    attendance: [came("a", "2026-12-03"), came("a", "2026-12-10"), came("c", "2026-12-20")],
  });
  const open = stmt(decData, "2026-12-01");
  const dec = { ...approved(open), approved_at: "2027-01-04T01:00:00+00:00" };
  const locked = stmt(decData, "2026-12-01", { closes: [dec] });

  it("회원별 묶음 — 이름 순 · 날짜 순 · 횟수와 금액", () => {
    const g = ptStatementGroups(locked.pay);
    expect(g.map((x) => [x.name, x.uses, x.amount, x.rate, x.items.map((i) => `${i.date}:${i.kind}`).join(",")])).toEqual([
      ["가온", 2, 60000, 30000, "2026-12-03:lesson,2026-12-10:lesson"],
      ["나래", 1, 30000, 30000, "2026-12-05:noshow"],
    ]);
    // 같은 회원이라도 1회 수당이 다르면 줄을 나눈다
    const mixed = ptStatementGroups([
      { k: "x:0", sid: "x", i: 0, t: "line", rate: 30000, date: "2026-12-03", name: "가온", kind: "lesson", ticket: T20 },
      { k: "y:0", sid: "y", i: 0, t: "line", rate: 40000, date: "2026-12-01", name: "가온", kind: "lesson", ticket: "퍼스널 트레이닝 10회권" },
      { k: "z:0", sid: "z", i: 0, t: "line", rate: 30000, date: "2026-12-08", name: "가온", kind: "lesson", ticket: T20 },
    ]);
    expect(mixed.map((x) => [x.ticket, x.uses, x.amount])).toEqual([
      ["퍼스널 트레이닝 10회권", 1, 40000],
      [T20, 2, 60000],
    ]);
    // 금액을 못 보는 화면(지점장) — 횟수만
    const blind = ptStatementGroups(locked.pay.map(({ rate: _r, ...l }) => ({ ...l, rate: null })));
    expect(blind.map((x) => [x.name, x.uses, x.amount])).toEqual([
      ["가온", 2, null],
      ["나래", 1, null],
    ]);
    expect(ptStatementGroups([])).toEqual([]);
  });

  it("지급 예정일 — 수업한 달의 다음 달 10일", () => {
    expect(ptPayDate("2026-12")).toBe("2027-01-10");
    expect(ptPayDate("2027-01")).toBe("2027-02-10");
  });

  it("막 나온 명세서 — 바로 지난달이 승인됐고 지급일까지만", () => {
    expect(ptStatementFreshYm([dec], COACH, "2027-01-04")).toBe("2026-12");
    expect(ptStatementFreshYm([dec], COACH, "2027-01-10")).toBe("2026-12");
    expect(ptStatementFreshYm([dec], COACH, "2027-01-11")).toBeNull();
    expect(ptStatementFreshYm([dec], COACH, "2027-02-03")).toBeNull();
    expect(ptStatementFreshYm([dec], COACH2, "2027-01-04")).toBeNull();
    expect(ptStatementFreshYm([confirmed(open)], COACH, "2027-01-04")).toBeNull();
  });

  it("세무 자료 — 금액 네 가지 · 지급 예정일(회원 이름은 없다) · 승인한 달만", () => {
    const text = ptStatementTaxText({ branch: "153복싱짐 예시점", coachName: "예시", st: locked });
    expect(text).toBe(
      [
        "[153복싱짐 예시점] PT 수당 — 2026년 12월 수업분",
        "받는 분: 예시 코치 (사업소득 3.3%)",
        "지급액(3.3% 전): 90,000원 · PT 3회",
        "소득세 3%: 2,700원",
        "지방소득세 0.3%: 270원",
        "실지급액: 87,030원",
        "지급 예정일: 2027년 1월 10일",
      ].join("\n"),
    );
    expect(text).not.toMatch(/가온|나래|다솜/);
    expect(ptStatementTaxText({ branch: "x", coachName: "예시", st: open })).toBeNull();
    expect(ptStatementTaxText({ branch: "x", coachName: "예시", st: stmt(decData, "2026-12-01", { closes: [dec], rates: null }) })?.includes("90,000원")).toBe(
      true,
    );
  });

  it("이름표 · 수업권 글 · 파일 이름", () => {
    expect(ptCoachLabel("예시")).toBe("예시 코치");
    expect(ptCoachLabel("예시 코치")).toBe("예시 코치");
    expect(ptCoachLabel("")).toBe("코치");
    expect(ptCoachLabel(null)).toBe("코치");
    expect(ptTicketText(T20)).toBe("1:1 20회");
    expect(ptTicketText(null)).toBe("");
    expect(ptStatementFileName("2026-12", "예시 코치")).toBe("PT수당명세서_2026-12_예시코치.pdf");
    expect(ptStatementFileName("2026-12", null)).toBe("PT수당명세서_2026-12_코치.pdf");
  });

  it("장부 — 막 나온 명세서의 달", () => {
    const cd: PtCloseData = {
      branch: "예시 지점",
      on: true,
      available: true,
      first_month: "2026-12-01",
      today: "2027-01-05",
      manage: false,
      pay: false,
      me_staff: COACH,
      coaches: [{ id: COACH, start: "2026-12-01" }],
      closes: [dec],
    };
    const book = ptCloseBook(decData, matchPtRecord(decData), cd, rates, { viewerCoach: COACH });
    expect(book.fresh(COACH)).toBe("2026-12-01");
    expect(book.due(COACH)).toBeNull();
    expect(book.statement(COACH, "2026-12-01")?.net).toBe(87030);
    expect(ptCloseBook(decData, matchPtRecord(decData), { ...cd, today: "2027-01-12" }, rates).fresh(COACH)).toBeNull();
  });
});
