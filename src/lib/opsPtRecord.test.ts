import { describe, expect, it } from "vitest";

import type { OpsPtEvent } from "./opsPt";
import {
  PT_NO_ENTRY_MONTH_LIMIT,
  addDays,
  dayDiff,
  matchPtRecord,
  ptCounts,
  ptDraftError,
  ptDraftPayload,
  ptMemberName,
  ptMemberSub,
  ptMonthCompare,
  ptRowStatus,
  ptTodayList,
  type PtDraft,
  type PtRecAttendance,
  type PtRecMember,
  type PtRecSession,
  type PtRecordData,
} from "./opsPtRecord";
import { PT_SAMPLE_COACH, buildPtSample } from "./opsPtRecordSample";

// ───────── 지어낸 자료 ─────────
const COACH = "coach-1";
const T20 = "퍼스널 트레이닝 20회권";
let seq = 0;
const member = (id: string, name: string, more: Partial<PtRecMember> = {}): PtRecMember => ({
  user_id: id, name, label: null, tail: "", ticket: T20, remaining: 10, end_date: null, checked_at: null, ...more,
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
  branch: "예시 지점", on: true, started_on: "2026-10-01", today, manage: false, me_staff: COACH,
  members: [member("a", "가온"), member("b", "나래"), member("c", "다솜")], sessions: [], events: [], attendance: [], ...more,
});
const rowOf = (res: ReturnType<typeof matchPtRecord>, id: string) => res.rows.find((r) => r.s.id === id)!;

describe("날짜", () => {
  it("일 수 · 더하기", () => {
    expect(dayDiff("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("짝짓기", () => {
  it("수업 → 다음 날 잡힌 차감과 맞는다", () => {
    const s = ses("a", "2026-10-05");
    const res = matchPtRecord(data("2026-10-10", { sessions: [s], events: [ev("a", "2026-10-06")], attendance: [came("a", "2026-10-05")] }));
    const r = rowOf(res, s.id);
    expect(r.state).toBe("ok");
    expect(r.lateDeduct).toBe(false);
    expect(r.deducts[0].days).toBe(1);
    expect(res.extras).toHaveLength(0);
    expect(ptRowStatus(r)).toEqual({ text: "차감 확인", tone: "ok" });
  });

  it("한 번에 2회가 빠지면 기록 2건과 맞춘다", () => {
    const s1 = ses("a", "2026-10-06");
    const s2 = ses("a", "2026-10-07");
    const res = matchPtRecord(data("2026-10-12", { sessions: [s2, s1], events: [ev("a", "2026-10-08", 2)] }));
    expect(rowOf(res, s1.id).state).toBe("ok");
    expect(rowOf(res, s2.id).state).toBe("ok");
    expect(res.extras).toHaveLength(0);
  });

  it("연속 2회 수업 한 건은 차감 2회와 맞는다 — 1회만 잡히면 1회 대기", () => {
    const s = ses("a", "2026-10-06", "lesson", { uses: 2 });
    const full = matchPtRecord(data("2026-10-12", { sessions: [s], events: [ev("a", "2026-10-07", 2)] }));
    expect(rowOf(full, s.id).state).toBe("ok");
    const half = matchPtRecord(data("2026-10-12", { sessions: [s], events: [ev("a", "2026-10-07", 1)] }));
    expect(rowOf(half, s.id).state).toBe("wait");
    expect(ptCounts(half, null, false).wait).toBe(1);
  });

  it("이틀 안이면 '확인 중', 넘으면 '차감 대기'", () => {
    const s = ses("a", "2026-10-05");
    const attendance = [came("a", "2026-10-05")];
    expect(rowOf(matchPtRecord(data("2026-10-07", { sessions: [s], attendance })), s.id).state).toBe("pending");
    expect(ptRowStatus(rowOf(matchPtRecord(data("2026-10-07", { sessions: [s], attendance })), s.id)).text).toBe("차감 확인 중");
    const late = matchPtRecord(data("2026-10-08", { sessions: [s], attendance }));
    expect(rowOf(late, s.id).state).toBe("wait");
    expect(ptCounts(late, null, false).wait).toBe(1);
    expect(ptRowStatus(rowOf(late, s.id)).text).toBe("차감 대기");
  });

  it("늦게 잡힌 차감은 오래된 기록부터 채운다(보정)", () => {
    const old1 = ses("a", "2026-10-05");
    const old2 = ses("a", "2026-10-13");
    const res = matchPtRecord(
      data("2026-11-11", { sessions: [old1, old2], events: [ev("a", "2026-11-10", 2)], attendance: [came("a", "2026-10-05"), came("a", "2026-10-13")] }),
    );
    expect(rowOf(res, old1.id).state).toBe("ok");
    expect(rowOf(res, old1.id).lateDeduct).toBe(true);
    expect(rowOf(res, old2.id).lateDeduct).toBe(true);
    expect(ptRowStatus(rowOf(res, old1.id)).text).toBe("늦은 차감 11/10");
    expect(res.extras).toHaveLength(0);
  });

  it("새 수업의 차감이 오래된 미차감 수업에 붙지 않는다", () => {
    const forgot = ses("a", "2026-10-05");
    const fresh = ses("a", "2026-10-20");
    const res = matchPtRecord(data("2026-10-25", { sessions: [forgot, fresh], events: [ev("a", "2026-10-21")] }));
    expect(rowOf(res, fresh.id).state).toBe("ok");
    expect(rowOf(res, forgot.id).state).toBe("wait");
  });

  it("기록보다 앞선 차감은 그 기록과 짝짓지 않는다 → 사유 없는 차감", () => {
    const s = ses("a", "2026-10-20");
    const res = matchPtRecord(data("2026-10-25", { sessions: [s], events: [ev("a", "2026-10-18")] }));
    expect(rowOf(res, s.id).state).toBe("wait");
    expect(res.extras).toHaveLength(1);
    expect(res.extras[0]).toMatchObject({ key: "a", name: "가온", workDate: "2026-10-18", count: 1, coachId: COACH });
  });

  it("뺀 차감 · 확인 전 차감 · 시작일 앞 차감은 세지 않는다", () => {
    const s = ses("a", "2026-10-05");
    const res = matchPtRecord(
      data("2026-10-12", {
        sessions: [s],
        events: [ev("a", "2026-10-06", 1, { status: "excluded" }), ev("b", "2026-10-06", 3, { kind: "ended", status: "check" }), ev("c", "2026-09-30")],
      }),
    );
    expect(rowOf(res, s.id).state).toBe("wait");
    expect(res.extras).toHaveLength(0);
  });

  it("수업권이 끝나 지점장 확인을 기다리면 코치의 차감 대기로 세지 않는다", () => {
    const s = ses("a", "2026-10-05");
    const attendance = [came("a", "2026-10-05")];
    const res = matchPtRecord(data("2026-10-12", { sessions: [s], attendance, events: [ev("a", "2026-10-06", 1, { kind: "ended", status: "check" })] }));
    expect(rowOf(res, s.id).heldByCheck).toBe(true);
    expect(ptCounts(res, null, false).wait).toBe(0);
    expect(ptRowStatus(rowOf(res, s.id)).text).toBe("수업권 끝남 · 지점장 확인 중");
    // 지점장이 「수업으로」 하면 맞는다
    const done = matchPtRecord(data("2026-10-12", { sessions: [s], events: [ev("a", "2026-10-06", 1, { kind: "ended", status: "confirmed" })] }));
    expect(rowOf(done, s.id).state).toBe("ok");
  });

  it("시작일 앞 수업은 맞춰 보지 않지만, 시작 뒤에 잡힌 차감은 설명한다", () => {
    const pre = ses("a", "2026-09-29");
    const attendance = [came("a", "2026-09-29")];
    const res = matchPtRecord(data("2026-10-08", { sessions: [pre], attendance }));
    expect(rowOf(res, pre.id).state).toBe("prestart");
    expect(ptRowStatus(rowOf(res, pre.id)).text).toBe("시작 전 수업");
    expect(ptCounts(res, null, false).total).toBe(0);
    const explained = matchPtRecord(data("2026-10-08", { sessions: [pre], attendance, events: [ev("a", "2026-10-01")] }));
    expect(rowOf(explained, pre.id).state).toBe("ok");
    expect(explained.extras).toHaveLength(0);
  });

  it("앱 계정이 없는 회원(이름만) — 같은 이름으로 직접 넣은 차감과 맞춘다", () => {
    const s = ses(null, "2026-10-05", "noshow");
    const waiting = matchPtRecord(data("2026-10-12", { sessions: [s] }));
    expect(rowOf(waiting, s.id).untracked).toBe(true);
    expect(ptRowStatus(rowOf(waiting, s.id)).text).toBe("차감 직접 넣기");
    const done = matchPtRecord(data("2026-10-12", { sessions: [s], events: [ev(null, "2026-10-06", 1, { kind: "manual", status: "confirmed" })] }));
    expect(rowOf(done, s.id).state).toBe("ok");
  });

  it("창이 잘렸으면 맨 앞 이틀의 차감은 묻지 않는다", () => {
    const res = matchPtRecord(data("2027-03-01", { from: "2026-11-01", events: [ev("a", "2026-11-02"), ev("a", "2026-11-05")] }));
    expect(res.extras.map((x) => x.workDate)).toEqual(["2026-11-05"]);
  });
});

describe("출석 · 기록", () => {
  it("출석 체크 없는 수업 — 사유가 없으면 확인 필요, 있으면 세기만", () => {
    const noReason = ses("a", "2026-10-19");
    const reasoned = ses("b", "2026-10-25", "lesson", { no_entry_reason: "door_open" });
    const cameIn = ses("c", "2026-10-26");
    const res = matchPtRecord(
      data("2026-10-27", {
        sessions: [noReason, reasoned, cameIn],
        events: [ev("a", "2026-10-20"), ev("b", "2026-10-26"), ev("c", "2026-10-27")],
        attendance: [came("c", "2026-10-26")],
      }),
    );
    expect(rowOf(res, noReason.id)).toMatchObject({ noEntry: true, needReason: true });
    expect(rowOf(res, reasoned.id)).toMatchObject({ noEntry: true, needReason: false });
    expect(rowOf(res, cameIn.id)).toMatchObject({ noEntry: false, needReason: false, entryAt: "2026-10-26T19:00:00+09:00" });
    expect(ptCounts(res, null, false).needReason).toBe(1);
    expect(ptRowStatus(rowOf(res, noReason.id)).tone).toBe("warn");
    const cmp = ptMonthCompare(res, [], "2026-10-01", null);
    expect(cmp.noEntry).toBe(2);
    expect(cmp.noEntryOver).toBe(false);
  });

  it(`출석 체크 없는 수업이 한 달 ${PT_NO_ENTRY_MONTH_LIMIT}회를 넘으면 표시`, () => {
    const sessions = ["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-12"].map((d) => ses("a", d, "lesson", { no_entry_reason: "manual" }));
    const res = matchPtRecord(data("2026-10-13", { sessions }));
    expect(ptMonthCompare(res, [], "2026-10", null)).toMatchObject({ noEntry: 4, noEntryOver: true });
    expect(ptMonthCompare(res, [], "2026-10", "other-coach").noEntry).toBe(0);
  });

  it("노쇼 · 당일취소는 출석이 없어도 된다", () => {
    const s = ses("a", "2026-10-05", "noshow");
    const res = matchPtRecord(data("2026-10-12", { sessions: [s], events: [ev("a", "2026-10-06")] }));
    expect(rowOf(res, s.id)).toMatchObject({ state: "ok", noEntry: false, needReason: false });
  });

  it("기록 없는 입장 — 개인 운동으로 닫으면 사라지고, 오늘 것은 따로", () => {
    const res = matchPtRecord(
      data("2026-10-27", {
        sessions: [ses("b", "2026-10-25", "self")],
        attendance: [came("a", "2026-10-26"), came("b", "2026-10-25"), came("c", "2026-10-27", "18:00"), came("a", "2026-09-30")],
      }),
    );
    expect(res.unrecorded.map((u) => `${u.userId} ${u.date} ${u.isToday}`)).toEqual(["c 2026-10-27 true", "a 2026-10-26 false"]);
    expect(ptCounts(res, null, false).unrecorded).toBe(1);
  });

  it("일정 변경 — 옮긴 날 수업이 있으면 그대로, 옮긴 날이 지났는데 아무것도 없으면 알린다", () => {
    const moved = ses("a", "2026-10-21", "moved", { moved_to: "2026-10-23" });
    const lesson = ses("a", "2026-10-23");
    const ok = matchPtRecord(data("2026-10-27", { sessions: [moved, lesson], events: [ev("a", "2026-10-24")], attendance: [came("a", "2026-10-23")] }));
    expect(rowOf(ok, moved.id)).toMatchObject({ state: "info", movedMissing: false });
    expect(ptRowStatus(rowOf(ok, moved.id)).text).toBe("→ 10/23");
    expect(ok.rows.filter((r) => r.state === "ok")).toHaveLength(1); // 두 번 세지 않는다
    const missing = matchPtRecord(data("2026-10-27", { sessions: [moved] }));
    expect(rowOf(missing, moved.id).movedMissing).toBe(true);
    expect(ptCounts(missing, null, false).movedMissing).toBe(1);
    // 옮긴 날이 아직 안 왔으면 묻지 않는다 · 옮긴 날 입장만 있으면 「기록 없는 입장」이 맡는다
    expect(rowOf(matchPtRecord(data("2026-10-22", { sessions: [moved] })), moved.id).movedMissing).toBe(false);
    const cameOnly = matchPtRecord(data("2026-10-27", { sessions: [moved], attendance: [came("a", "2026-10-23")] }));
    expect(rowOf(cameOnly, moved.id).movedMissing).toBe(false);
    expect(ptCounts(cameOnly, null, false).unrecorded).toBe(1);
  });

  it("늦은 기록은 지점장 확인 전까지 표시 — 코치 숫자에는 안 들어간다", () => {
    const late = ses("a", "2026-10-05", "lesson", { late: true });
    const reviewed = ses("b", "2026-10-05", "lesson", { late: true, reviewed_at: "2026-10-07T09:00:00+09:00" });
    const res = matchPtRecord(
      data("2026-10-12", {
        sessions: [late, reviewed],
        events: [ev("a", "2026-10-06"), ev("b", "2026-10-06")],
        attendance: [came("a", "2026-10-05"), came("b", "2026-10-05")],
      }),
    );
    expect(rowOf(res, late.id).needReview).toBe(true);
    expect(rowOf(res, reviewed.id).needReview).toBe(false);
    expect(ptCounts(res, null, false)).toMatchObject({ needReview: 1, total: 0 });
    expect(ptCounts(res, null, true)).toMatchObject({ needReview: 1, total: 1 });
    expect(ptRowStatus(rowOf(res, late.id)).text).toBe("늦은 기록 · 확인 전");
  });

  it("코치마다 나눠 센다", () => {
    const mine = ses("a", "2026-10-05");
    const other = ses("b", "2026-10-05", "lesson", { coach_staff_id: "coach-2" });
    const res = matchPtRecord(data("2026-10-12", { sessions: [mine, other], events: [ev("c", "2026-10-06", 2, { coach_staff_id: "coach-2" })] }));
    expect(ptCounts(res, COACH, false)).toMatchObject({ wait: 1, extra: 0 });
    expect(ptCounts(res, "coach-2", false)).toMatchObject({ wait: 1, extra: 2 });
    expect(ptCounts(res, null, true)).toMatchObject({ wait: 2, extra: 2 });
  });
});

describe("이름표 · 오늘 PT", () => {
  it("이름표가 있으면 그 이름으로 — 앱 이름 · 전화 끝자리는 아래 줄", () => {
    const m = member("a", "ㄱㅇ", { label: "가온", tail: "1234" });
    expect(ptMemberName(m)).toBe("가온");
    expect(ptMemberSub(m)).toBe("앱 이름 ㄱㅇ");
    expect(ptMemberSub(member("b", "나래", { tail: "5678" }))).toBe("…5678");
    expect(ptMemberSub(member("b", "나래"))).toBe("");
    const s = ses("a", "2026-10-05");
    const res = matchPtRecord(data("2026-10-12", { members: [m], sessions: [s], events: [ev("a", "2026-10-09")] }));
    expect(rowOf(res, s.id).name).toBe("가온");
  });

  it("오늘 들어온 순서 + 오늘 기록만 있는 회원", () => {
    const today = "2026-10-27";
    const done = ses("b", today);
    const noshow = ses("c", today, "noshow");
    const d = data(today, { sessions: [done, noshow], attendance: [came("b", today, "19:05"), came("a", today, "18:00"), came("a", today, "18:30")] });
    const list = ptTodayList(d, matchPtRecord(d));
    expect(list.map((i) => `${i.name}:${i.at ? "in" : "-"}:${i.row?.s.kind ?? "todo"}`)).toEqual(["가온:in:todo", "나래:in:lesson", "다솜:-:noshow"]);
  });
});

describe("넣기 검사", () => {
  const base: PtDraft = { member_user_id: "a", member_name: "가온", kind: "lesson", session_date: "2026-10-27", uses: 1, moved_to: null, no_entry_reason: null, note: "" };
  const ctx = { today: "2026-10-27", hasEntry: true };
  it("서버와 같은 말", () => {
    expect(ptDraftError(base, ctx)).toBeNull();
    expect(ptDraftError({ ...base, member_user_id: null, member_name: " " }, ctx)).toBe("회원을 골라 주세요");
    expect(ptDraftError({ ...base, session_date: "2026-10-28" }, ctx)).toBe("아직 오지 않은 날은 적을 수 없어요");
    expect(ptDraftError({ ...base, kind: "moved" }, ctx)).toBe("옮긴 날짜를 골라 주세요");
    expect(ptDraftError({ ...base, kind: "moved", moved_to: "2026-10-27" }, ctx)).toBe("옮긴 날짜가 원래 날짜와 같아요");
    expect(ptDraftError({ ...base, kind: "moved", session_date: "2026-10-30", moved_to: "2026-11-02" }, ctx)).toBeNull();
    expect(ptDraftError({ ...base, uses: 5 }, ctx)).toBe("횟수는 1~4회로 넣어 주세요");
    expect(ptDraftError(base, { ...ctx, hasEntry: false })).toBe("그날 출석 체크가 없어요 — 사유를 골라 주세요");
    expect(ptDraftError({ ...base, no_entry_reason: "door_open" }, { ...ctx, hasEntry: false })).toBeNull();
    expect(ptDraftError({ ...base, kind: "noshow" }, { ...ctx, hasEntry: false })).toBeNull();
    expect(ptDraftError({ ...base, member_user_id: null, member_name: "이름만" }, { ...ctx, hasEntry: false })).toBeNull();
  });
  it("보내는 모양 — 종류에 안 맞는 칸은 비운다", () => {
    expect(ptDraftPayload("예시 지점", { ...base, kind: "noshow", uses: 3, moved_to: "2026-10-30", no_entry_reason: "other", note: " 메모 " })).toEqual({
      branch: "예시 지점", member_user_id: "a", member_name: "가온", kind: "noshow", session_date: "2026-10-27", uses: 1, moved_to: null, no_entry_reason: null, note: "메모",
    });
    expect(ptDraftPayload("예시 지점", { ...base, id: "s1", uses: 2, coach_staff_id: COACH })).toMatchObject({ id: "s1", uses: 2, coach_staff_id: COACH });
  });
});

// ───────── 10월 정산에서 생긴 일을 본뜬 모의 (이름 · 숫자는 지어낸 것 — 날짜 모양만 같다) ─────────
describe("10월 사례 모의", () => {
  const members = [member("r", "다솜"), member("m", "마루"), member("k", "가람"), member("w", "우리"), member("g", "기쁨")];
  const lessons: Array<[string, string[]]> = [
    ["r", ["2026-10-05", "2026-10-09", "2026-10-13", "2026-10-17", "2026-10-19", "2026-10-23", "2026-10-28"]],
    ["m", ["2026-10-06", "2026-10-07", "2026-10-12", "2026-10-14"]],
    ["k", ["2026-10-05", "2026-10-09", "2026-10-12"]],
    ["w", ["2026-10-21", "2026-10-25", "2026-10-29"]],
    ["g", ["2026-10-19"]],
  ];
  /** 수업 뒤 차감을 안 한 3건 */
  const FORGOT = new Set(["r 2026-10-13", "m 2026-10-12", "k 2026-10-05"]);
  /** 문이 열려 있어 출석 체크 없이 들어온 3건 */
  const NO_ENTRY = new Set(["r 2026-10-19", "w 2026-10-25", "w 2026-10-29"]);
  const sessions: PtRecSession[] = [];
  const attendance: PtRecAttendance[] = [];
  const octEvents: OpsPtEvent[] = [];
  for (const [m, days] of lessons) {
    for (const d of days) {
      sessions.push(ses(m, d));
      if (!NO_ENTRY.has(`${m} ${d}`)) attendance.push(came(m, d));
      // 마루 10/6 · 10/7 은 한 번에 2회로 잡힘
      if (FORGOT.has(`${m} ${d}`) || (m === "m" && d === "2026-10-06")) continue;
      octEvents.push(m === "m" && d === "2026-10-07" ? ev(m, "2026-10-08", 2) : ev(m, addDays(d, 1)));
    }
  }
  sessions.push(ses("r", "2026-10-21", "moved", { moved_to: "2026-10-23" })); // 21일 수업을 23일로 옮김
  attendance.push(came("g", "2026-10-26")); // 들어왔는데 기록도 차감도 없는 날
  /** 11/10 에 한꺼번에 넣은 보정 차감 5회 */
  const fixEvents = [ev("r", "2026-11-10", 2), ev("m", "2026-11-10", 1), ev("k", "2026-11-10", 2)];

  it("10월 말 — 차감 대기 3 · 출석 체크 없음 3 · 기록 없는 입장 1", () => {
    const res = matchPtRecord(data("2026-10-31", { members, sessions, events: octEvents, attendance }));
    const c = ptCounts(res, COACH, false);
    expect(c).toMatchObject({ wait: 3, needReason: 3, unrecorded: 1, extra: 0, movedMissing: 0 });
    expect(res.rows.filter((r) => r.state === "wait").map((r) => `${r.key} ${r.s.session_date}`).sort()).toEqual([...FORGOT].sort());
    expect(res.rows.filter((r) => r.needReason).map((r) => `${r.key} ${r.s.session_date}`).sort()).toEqual([...NO_ENTRY].sort());
    // 옮긴 수업은 한 번만 — 다솜의 차감되는 기록은 7건
    expect(res.rows.filter((r) => r.key === "r" && r.s.kind === "lesson")).toHaveLength(7);
    expect(ptMonthCompare(res, octEvents, "2026-10", COACH)).toMatchObject({ byDeduct: 15, byRecord: 15 });
  });

  it("11/10 보정 뒤(기록이 있었다면) — 차감 대기 0 · 늦은 차감 3 · 사유 없는 차감 2(과차감 의심)", () => {
    const events = [...octEvents, ...fixEvents];
    const res = matchPtRecord(data("2026-11-11", { members, sessions, events, attendance }));
    expect(ptCounts(res, COACH, false)).toMatchObject({ wait: 0, extra: 2 });
    expect(res.rows.filter((r) => r.lateDeduct).map((r) => `${r.key} ${r.s.session_date}`).sort()).toEqual([...FORGOT].sort());
    expect(res.extras.map((x) => `${x.key} ${x.count}`).sort()).toEqual(["k 1", "r 1"]);
    // 늦게 잡힌 차감은 원래 수업한 달(10월) 기록으로 센다 — 11월 기록 기준은 0
    expect(ptMonthCompare(res, events, "2026-10", COACH)).toMatchObject({ byDeduct: 15, byRecord: 18 });
    expect(ptMonthCompare(res, events, "2026-11", COACH)).toMatchObject({ byDeduct: 5, byRecord: 0 });
  });

  it("11/10 보정 뒤(그 3건을 기록하지 않았다면) — 사유 없는 차감 5", () => {
    const kept = sessions.filter((s) => !FORGOT.has(`${s.member_user_id} ${s.session_date}`));
    const res = matchPtRecord(data("2026-11-11", { members, sessions: kept, events: [...octEvents, ...fixEvents], attendance }));
    expect(ptCounts(res, COACH, false)).toMatchObject({ extra: 5, wait: 0 });
    // 그 3건은 '기록 없는 입장'으로도 남는다(들어왔는데 기록이 없다)
    expect(ptCounts(res, COACH, false).unrecorded).toBe(4);
  });
});

describe("예시 자료", () => {
  it("화면의 여러 모습이 하나씩 들어 있다", () => {
    const d = buildPtSample("2026-11-12", false);
    const res = matchPtRecord(d);
    expect(ptCounts(res, PT_SAMPLE_COACH, false)).toEqual({ needReason: 0, extra: 1, wait: 1, unrecorded: 1, movedMissing: 0, needReview: 1, total: 3 });
    expect(ptCounts(res, null, true).total).toBe(4);
    const todo = ptTodayList(d, res).filter((i) => !i.row);
    expect(todo.map((i) => i.name)).toEqual(["한하늘"]);
    expect(res.rows.filter((r) => r.state === "pending")).toHaveLength(1);
    expect(res.rows.filter((r) => r.noEntry && !r.needReason)).toHaveLength(1);
  });
});
