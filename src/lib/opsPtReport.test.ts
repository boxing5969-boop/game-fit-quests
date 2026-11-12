import { describe, expect, it } from "vitest";

import type { OpsPtEvent } from "./opsPt";
import { matchPtRecord, ptGuessClassDay, ptNearEntry, type PtRecAttendance, type PtRecSession, type PtRecordData } from "./opsPtRecord";
import {
  PT_REPORT_KINDS,
  PT_REPORT_KIND_LABEL,
  applyPtReportDemo,
  buildPtReportSample,
  emptyPtReportDraft,
  ptReportDraftError,
  ptReportFix,
  ptReportFixReply,
  ptReportLine,
  ptReportNeedsDate,
  ptReportOpenCount,
  ptReportPayload,
  ptReportStamp,
  type PtReport,
} from "./opsPtReport";

// ───────── 지어낸 자료(실제 회원 아님) ─────────
const COACH = "coach-1";
const T20 = "퍼스널 트레이닝 20회권";
let seq = 0;
const ses = (m: string, date: string, more: Partial<PtRecSession> = {}): PtRecSession => ({
  id: `s${(seq += 1)}`, member_user_id: m, member_name: m, ticket_name: T20, coach_staff_id: COACH, session_date: date, kind: "lesson",
  uses: 1, moved_to: null, no_entry_reason: null, note: null, late: false, reviewed_at: null, created_at: `${date}T20:00:00+09:00`, ...more,
});
const ev = (m: string, date: string, detected: string, more: Partial<OpsPtEvent> = {}): OpsPtEvent => ({
  id: `e${(seq += 1)}`, member_user_id: m, member_name: m, ticket_name: T20, before: 10, after: 9, used: 1, kind: "used",
  status: "auto", coach_staff_id: COACH, work_date: date, detected_at: detected, note: null, ...more,
});
const came = (m: string, date: string, hm: string): PtRecAttendance => ({ user_id: m, date, at: `${date}T${hm}:00+09:00` });
const data = (today: string, more: Partial<PtRecordData>): PtRecordData => ({
  branch: "예시 지점", on: true, started_on: "2026-11-12", today, manage: true, me_staff: null,
  members: [
    { user_id: "a", name: "nick_a", label: "가온", tail: "0001", ticket: T20, remaining: 9, end_date: null, checked_at: null },
    { user_id: "b", name: "nick_b", label: "나래", tail: "0002", ticket: T20, remaining: 9, end_date: null, checked_at: null },
  ],
  sessions: [], events: [], attendance: [], ...more,
});
const report = (more: Partial<PtReport>): PtReport => ({
  id: `r${(seq += 1)}`, coach_staff_id: COACH, coach_name: "예시 코치", reporter_name: "예시 코치", mine: false, session_id: null,
  event_id: null, member_user_id: "a", member_name: "가온", about_date: null, kind: "other", right_date: null, note: null,
  status: "open", reply: null, handled_at: null, created_at: "2026-11-12T10:00:00+09:00", session: null, event: null, ...more,
});

describe("오류 신고 — 글", () => {
  it("종류 6가지 · 이름은 서버(_ops_pt_report_kind_label)와 같은 말", () => {
    expect(PT_REPORT_KINDS).toHaveLength(6);
    expect(PT_REPORT_KIND_LABEL.wrong_date).toBe("날짜가 달라요");
    expect(PT_REPORT_KIND_LABEL.missing).toBe("수업했는데 기록이 없어요");
    expect(PT_REPORT_KIND_LABEL.not_held).toBe("수업 안 했는데 잡혔어요");
    expect(PT_REPORT_KIND_LABEL.other).toBe("그 밖");
  });
  it("실제 수업 날짜는 날짜 · 기록 없음에만 꼭", () => {
    expect(ptReportNeedsDate("wrong_date")).toBe(true);
    expect(ptReportNeedsDate("missing")).toBe(true);
    expect(ptReportNeedsDate("not_held")).toBe(false);
    expect(ptReportNeedsDate(null)).toBe(false);
  });
  it("한 줄 요약 · 시각", () => {
    expect(ptReportLine({ kind: "wrong_date", about_date: "2026-11-12", right_date: "2026-11-11" })).toBe("날짜가 달라요 · 11/12 → 11/11");
    expect(ptReportLine({ kind: "missing", about_date: null, right_date: "2026-11-11" })).toBe("수업했는데 기록이 없어요 · 11/11");
    expect(ptReportLine({ kind: "not_held", about_date: "2026-11-12", right_date: null })).toBe("수업 안 했는데 잡혔어요 · 11/12");
    expect(ptReportStamp("2026-11-12T10:23:18.118519+00:00")).toBe("11/12 19:23");
    expect(ptReportStamp("엉뚱한 값")).toBe("");
  });
});

describe("오류 신고 — 보내기 전 검사(서버와 같은 말)", () => {
  const today = "2026-11-12";
  it("막히는 경우", () => {
    expect(ptReportDraftError(emptyPtReportDraft(), { today })).toBe("무엇이 틀렸는지 골라 주세요");
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "wrong_count" }), { today })).toBe("회원을 골라 주세요");
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "wrong_date", session_id: "s" }), { today })).toBe("실제 수업 날짜를 골라 주세요");
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "missing", member_user_id: "a", right_date: "2026-11-13" }), { today })).toBe(
      "아직 오지 않은 날은 고를 수 없어요",
    );
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "missing", member_user_id: "a", right_date: "2026-06-01" }), { today })).toBe("날짜가 너무 멀어요");
    expect(
      ptReportDraftError(emptyPtReportDraft({ kind: "wrong_date", session_id: "s", about_date: "2026-11-11", right_date: "2026-11-11" }), { today }),
    ).toBe("지금 날짜와 같아요 — 실제 수업 날짜를 골라 주세요");
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "other", note: " " }), { today })).toBe("무엇이 틀렸는지 적어 주세요");
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "other", note: "가".repeat(301) }), { today })).toBe("메모는 300자까지 적을 수 있어요");
  });
  it("통과하는 경우", () => {
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "wrong_date", session_id: "s", about_date: "2026-11-12", right_date: "2026-11-11" }), { today })).toBeNull();
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "not_held", event_id: "e" }), { today })).toBeNull();
    expect(ptReportDraftError(emptyPtReportDraft({ kind: "other", note: "오늘 PT 목록이 안 떠요" }), { today })).toBeNull();
  });
  it("보내는 모양 — 날짜가 필요 없는 종류는 고른 날이 없으면 빈 값 · 메모는 다듬어서", () => {
    const p = ptReportPayload("지점", emptyPtReportDraft({ kind: "not_held", event_id: "e", member_name: " 가온 ", note: "  개인 운동만 " }));
    expect(p).toMatchObject({ branch: "지점", kind: "not_held", event_id: "e", member_name: "가온", right_date: null, note: "개인 운동만" });
    expect(p).not.toHaveProperty("coach_staff_id");
    expect(ptReportPayload("지점", emptyPtReportDraft({ kind: "other", note: "x", coach_staff_id: "c2" }))).toHaveProperty("coach_staff_id", "c2");
  });
});

describe("오류 신고 — 관리자 고치기", () => {
  // 11/11 낮 입장 → 차감은 11/12 새벽에 잡힘 → 기록이 차감 날(11/12)로 적힘 (2026-11-12 실제로 있던 모양 · 이름은 지어냄)
  const wrong = ses("a", "2026-11-12", { no_entry_reason: "door_open" });
  const d = data("2026-11-12", {
    sessions: [wrong],
    events: [ev("a", "2026-11-12", "2026-11-11T18:45:04+00:00")],
    attendance: [came("a", "2026-11-11", "11:52")],
  });
  const res = matchPtRecord(d);

  it("날짜 신고 → 그 기록 날짜를 신고한 날로(기록 시트)", () => {
    const fix = ptReportFix(report({ kind: "wrong_date", session_id: wrong.id, about_date: "2026-11-12", right_date: "2026-11-11" }), res);
    expect(fix).toMatchObject({ type: "edit", date: "2026-11-11" });
    expect(fix?.type === "edit" && fix.row.s.id).toBe(wrong.id);
    expect(ptReportFixReply(fix!)).toBe("기록 날짜를 11/11로 고쳤어요");
  });
  it("이미 신고대로 되어 있으면 처리만", () => {
    const fixed = matchPtRecord({ ...d, sessions: [{ ...wrong, session_date: "2026-11-11", no_entry_reason: null }] });
    const fix = ptReportFix(report({ kind: "wrong_date", session_id: wrong.id, about_date: "2026-11-12", right_date: "2026-11-11" }), fixed);
    expect(fix).toEqual({ type: "done", text: "기록이 11/11로 되어 있어요" });
  });
  it("지워진 기록이면 처리만 · 찾을 수 없으면 직접 확인", () => {
    const gone = matchPtRecord({ ...d, sessions: [] });
    expect(ptReportFix(report({ kind: "wrong_date", session_id: wrong.id, right_date: "2026-11-11", session: { session_date: "2026-11-12", kind: "lesson", status: "void", uses: 1 } }), gone)).toEqual({
      type: "done",
      text: "그 기록은 지워졌어요",
    });
    expect(ptReportFix(report({ kind: "wrong_date", session_id: "없는 기록", right_date: "2026-11-11" }), gone)).toBeNull();
  });
  it("기록 없음 → 그날 수업 기록 넣기 · 이미 있으면 처리만", () => {
    const fix = ptReportFix(report({ kind: "missing", member_user_id: "b", member_name: "나래", right_date: "2026-11-11" }), res);
    expect(fix).toEqual({ type: "new", member_user_id: "b", member_name: "나래", date: "2026-11-11" });
    expect(ptReportFixReply(fix!)).toBe("11/11 수업 기록을 넣었어요");
    expect(ptReportFix(report({ kind: "missing", member_user_id: "a", right_date: "2026-11-12" }), res)).toEqual({ type: "done", text: "11/12 수업 기록이 있어요" });
  });
  it("수업 안 함 → 그 기록 지우기 · 차감만 있는 신고는 직접 확인(브로제이)", () => {
    expect(ptReportFix(report({ kind: "not_held", session_id: wrong.id }), res)).toMatchObject({ type: "void" });
    expect(ptReportFix(report({ kind: "not_held", event_id: "e1" }), res)).toBeNull();
    expect(ptReportFix(report({ kind: "wrong_count", session_id: wrong.id }), res)).toBeNull();
    expect(ptReportFix(report({ kind: "wrong_date", session_id: wrong.id, right_date: "2026-11-11", status: "fixed" }), res)).toBeNull();
  });
  it("열린 신고 수 — 코치별", () => {
    const list = [report({ status: "open" }), report({ status: "open", coach_staff_id: "coach-2" }), report({ status: "fixed" })];
    expect(ptReportOpenCount(list)).toBe(2);
    expect(ptReportOpenCount(list, COACH)).toBe(1);
    expect(ptReportOpenCount(undefined)).toBe(0);
  });
});

describe("사유 없는 차감 — 출석으로 실제 수업 날 어림", () => {
  it("저녁 수업 · 다음 날 잡힌 차감 → 전날 입장(그날 기록 없음)", () => {
    // 11/11 20:02 입장 → 차감 11/12 15:45 에 잡힘 · 기록 없음 (2026-11-12 실제로 있던 모양 · 이름은 지어냄)
    const res = matchPtRecord(
      data("2026-11-12", {
        events: [ev("b", "2026-11-12", "2026-11-12T06:45:05+00:00")],
        attendance: [came("b", "2026-11-11", "20:02"), came("b", "2026-11-10", "19:59")],
      }),
    );
    expect(res.extras).toHaveLength(1);
    expect(res.extras[0].guess).toEqual({ date: "2026-11-11", at: "2026-11-11T20:02:00+09:00" });
  });
  it("어림한 날의 입장은 「기록 없는 입장」으로 또 묻지 않는다", () => {
    const res = matchPtRecord(
      data("2026-11-12", {
        started_on: "2026-11-09",
        events: [ev("b", "2026-11-12", "2026-11-12T06:45:05+00:00")],
        attendance: [came("b", "2026-11-11", "20:02"), came("b", "2026-11-10", "19:59")],
      }),
    );
    expect(res.extras[0].guess?.date).toBe("2026-11-11");
    expect(res.unrecorded.map((u) => u.date)).toEqual(["2026-11-10"]);
  });
  it("차감을 알아챈 뒤의 입장은 그 차감의 수업이 아니다", () => {
    // 11/11 14:45 에 잡힌 차감 → 그날 20:02 입장이 아니라 11/10 입장
    expect(
      ptGuessClassDay(
        [
          { date: "2026-11-10", at: "2026-11-10T19:59:00+09:00" },
          { date: "2026-11-11", at: "2026-11-11T20:02:00+09:00" },
        ],
        "2026-11-11",
        "2026-11-11T05:45:00+00:00",
      ),
    ).toEqual({ date: "2026-11-10", at: "2026-11-10T19:59:00+09:00" });
  });
  it("이틀 넘게 앞선 입장 · 그날 기록이 있는 날은 어림하지 않는다", () => {
    expect(ptGuessClassDay([{ date: "2026-11-08", at: "2026-11-08T17:00:00+09:00" }], "2026-11-11", "2026-11-11T05:00:00+00:00")).toBeNull();
    expect(
      ptGuessClassDay([{ date: "2026-11-10", at: "2026-11-10T19:00:00+09:00" }], "2026-11-11", "2026-11-11T05:00:00+00:00", (d) => d === "2026-11-10"),
    ).toBeNull();
    // 알아챈 시각이 없으면 차감 날 끝까지
    expect(ptGuessClassDay([{ date: "2026-11-11", at: "2026-11-11T21:00:00+09:00" }], "2026-11-11", null)).toEqual({
      date: "2026-11-11",
      at: "2026-11-11T21:00:00+09:00",
    });
  });
  it("한 입장은 한 차감에만 — 두 번째 차감은 그 앞 입장으로", () => {
    const res = matchPtRecord(
      data("2026-11-12", {
        events: [ev("a", "2026-11-12", "2026-11-12T01:00:00+00:00"), ev("a", "2026-11-12", "2026-11-12T02:00:00+00:00")],
        attendance: [came("a", "2026-11-11", "19:00"), came("a", "2026-11-10", "19:00")],
      }),
    );
    expect(res.extras.map((x) => x.guess?.date)).toEqual(["2026-11-11", "2026-11-10"]);
  });
  it("기록 시트 — 고른 날 입장이 없으면 그 앞 이틀의 입장을 알려 준다", () => {
    const att = [came("a", "2026-11-11", "11:52"), came("a", "2026-11-05", "11:43")];
    expect(ptNearEntry(att, "a", "2026-11-12")).toEqual({ date: "2026-11-11", at: "2026-11-11T11:52:00+09:00" });
    expect(ptNearEntry(att, "a", "2026-11-08")).toBeNull();
    expect(ptNearEntry(att, "a", "2026-11-12", (d) => d === "2026-11-11")).toBeNull();
    expect(ptNearEntry(att, null, "2026-11-12")).toBeNull();
  });
});

describe("오류 신고 — 예시 화면", () => {
  it("예시 자료 · 보내기 · 처리", () => {
    const list = buildPtReportSample("2026-11-12", true, "sample-coach");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.coach_staff_id === "sample-coach")).toBe(true);
    const sent = applyPtReportDemo(
      list,
      { type: "send", p: ptReportPayload("예시", emptyPtReportDraft({ kind: "missing", member_user_id: "sample-m1", right_date: "2026-11-11" })), memberName: "한하늘" },
      { manage: false, coachId: "sample-coach" },
    );
    expect(sent[0]).toMatchObject({ kind: "missing", status: "open", member_name: "한하늘", mine: true });
    const done = applyPtReportDemo(sent, { type: "resolve", id: sent[0].id, status: "fixed", reply: " 넣었어요 " }, { manage: true, coachId: "sample-coach" });
    expect(done[0]).toMatchObject({ status: "fixed", reply: "넣었어요" });
  });
});
