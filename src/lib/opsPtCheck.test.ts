import { describe, expect, it } from "vitest";
import {
  applyPtAskDemo,
  buildPtAsksSample,
  isOpenDispute,
  normalizePtAsks,
  normalizePtCheckList,
  ptAskLine,
  ptAskNoteError,
  ptCheckLine,
  ptCheckMd,
  ptReplyError,
  type PtMemberCheck,
} from "./opsPtCheck";
import { matchPtRecord, ptCounts } from "./opsPtRecord";
import {
  PT_SAMPLE_COACH,
  applyPtDemo,
  buildPtSample,
} from "./opsPtRecordSample";
import { ptPayLinesAll, ptPayMonth, ptPayHoldText } from "./opsPtPay";

const check = (more: Partial<PtMemberCheck> = {}): PtMemberCheck => ({
  id: "k1",
  event_id: "e1",
  member_user_id: "a",
  work_date: "2026-12-03",
  used: 1,
  coach_staff_id: "coach",
  asked_at: "2026-12-03T07:55:00+00:00",
  answer: null,
  answered_at: null,
  note: null,
  reply: null,
  closed_at: null,
  closed_by_name: null,
  ...more,
});

describe("회원 확인 — 서버 자료 정리 (2-4)", () => {
  it("목록을 고르게 받고 모양이 틀린 줄은 버린다", () => {
    const l = normalizePtCheckList({
      on: true,
      can_set: true,
      can_close: true,
      started_at: "2026-11-20T01:00:00+00:00",
      checks: [
        {
          id: "k1",
          event_id: "e1",
          member_user_id: "a",
          work_date: "2026-12-03",
          used: 2,
          answer: "no",
          note: "그날 안 갔어요",
        },
        {
          id: "k2",
          event_id: "e2",
          member_user_id: "b",
          work_date: "2026-12-04",
          used: "1",
          answer: "maybe",
        },
        { id: "", event_id: "e3", work_date: "2026-12-04" },
        { id: "k4", event_id: "e4", work_date: "12/4" },
      ],
    });
    expect(l).toMatchObject({ on: true, can_set: true, can_close: true });
    expect(l.checks.map((c) => `${c.id}:${c.used}:${c.answer}`)).toEqual([
      "k1:2:no",
      "k2:1:null",
    ]);
    expect(normalizePtCheckList(null)).toEqual({
      on: false,
      started_at: null,
      can_set: false,
      can_close: false,
      checks: [],
    });
  });

  it("열린 「아니에요」 = 「아니에요」인데 아직 답하지 않음", () => {
    expect(isOpenDispute(check({ answer: "no" }))).toBe(true);
    expect(
      isOpenDispute(
        check({ answer: "no", closed_at: "2026-12-05T01:00:00+00:00" }),
      ),
    ).toBe(false);
    expect(isOpenDispute(check({ answer: "yes" }))).toBe(false);
    expect(isOpenDispute(check())).toBe(false);
  });

  it("확인 필요 카드의 회원 답 한 줄 — 한국 시간 날짜", () => {
    expect(ptCheckMd("2026-12-03T16:30:00+00:00")).toBe("12/4"); // 한국 12/4 01:30
    expect(ptCheckLine(check())).toEqual({
      text: "회원님께 물어봤어요 · 12/3 — 아직 답 전",
      tone: "muted",
    });
    expect(
      ptCheckLine(
        check({ answer: "yes", answered_at: "2026-12-04T03:00:00+00:00" }),
      ),
    ).toEqual({ text: "회원 확인 · 받은 수업이 맞대요 (12/4)", tone: "ok" });
    expect(
      ptCheckLine(
        check({
          answer: "no",
          answered_at: "2026-12-04T03:00:00+00:00",
          note: "그날 안 갔어요",
        }),
      ),
    ).toEqual({
      text: "회원 「아니에요」 (12/4) · “그날 안 갔어요”",
      tone: "warn",
    });
    expect(
      ptCheckLine(
        check({
          answer: "no",
          closed_at: "2026-12-05T01:00:00+00:00",
          closed_by_name: "지점장님",
          reply: "당일 취소 규정으로 1회 차감됐어요",
        }),
      ).text,
    ).toBe(
      "회원 「아니에요」 → 지점장님 답함 · 당일 취소 규정으로 1회 차감됐어요",
    );
  });

  it("검사 — 서버와 같은 말", () => {
    expect(ptReplyError(" ")).toBe("회원님께 보낼 답을 적어 주세요");
    expect(ptReplyError("가".repeat(301))).toBe("300자 안으로 적어 주세요");
    expect(ptReplyError("확인했어요")).toBeNull();
    expect(ptAskNoteError("가".repeat(201))).toBe("200자 안으로 적어 주세요");
    expect(ptAskNoteError("")).toBeNull();
  });
});

describe("회원 화면 — PT 차감 안내 띠 (2-4)", () => {
  it("상태와 한 줄", () => {
    const list = normalizePtAsks([
      { id: "a1", work_date: "2026-12-03", used: 1, state: "ask" },
      { id: "a2", work_date: "2026-12-04", used: 2, state: "wait", note: "x" },
      {
        id: "a3",
        work_date: "2026-12-05",
        used: 1,
        state: "closed",
        reply: "차감을 되돌렸어요 — 남은 횟수가 다시 맞춰져요",
      },
      { id: "", work_date: "2026-12-05" },
    ]);
    expect(list.map((a) => a.state)).toEqual(["ask", "wait", "closed"]);
    expect(list.map(ptAskLine)).toEqual([
      "12월 3일에 PT 1회 차감이 확인됐어요",
      "지점에서 확인하고 있어요 — 확인되면 알려 드릴게요",
      "차감을 되돌렸어요 — 남은 횟수가 다시 맞춰져요",
    ]);
    expect(normalizePtAsks({})).toEqual([]);
  });

  it("예시에서 답하기 — 「네」는 사라지고 「아니에요」는 확인 중 · 두 번은 안 됨", () => {
    const list = buildPtAsksSample("2026-12-10");
    expect(list[0]).toMatchObject({ work_date: "2026-12-09", state: "ask" });
    expect(applyPtAskDemo(list, list[0].id, "yes", null)).toEqual([]);
    const no = applyPtAskDemo(
      list,
      list[0].id,
      "no",
      "  그날 안 갔어요 ",
      "2026-12-10T03:00:00.000Z",
    );
    expect(no[0]).toMatchObject({
      state: "wait",
      note: "그날 안 갔어요",
      answered_at: "2026-12-10T03:00:00.000Z",
    });
    expect(() => applyPtAskDemo(no, list[0].id, "yes", null)).toThrow(
      "이미 답해 주셨어요",
    );
  });
});

describe("확인 필요 · 수당 보류 (2-4)", () => {
  const today = "2026-12-10";

  it("사유 없는 차감 카드에 회원 답이 붙고, 열린 「아니에요」는 모아 둔다", () => {
    const res = matchPtRecord(buildPtSample(today, true));
    const extra = res.extras.find((x) => x.userId === "sample-m5");
    expect(extra?.check).toMatchObject({
      answer: "no",
      note: "그날은 개인 운동만 했어요",
    });
    expect(res.disputes?.map((c) => c.member_user_id).sort()).toEqual([
      "sample-m3",
      "sample-m5",
    ]);
    // 물은 뒤 미참석으로 기록된 차감 — 기록과 맞았어도 그 차감에 「아니에요」 표시
    const noshow = res.rows.find(
      (r) => r.s.member_user_id === "sample-m3" && r.s.kind === "noshow",
    );
    expect(noshow?.deducts.map((d) => d.disputed)).toEqual([true]);
  });

  it("「아니에요」 숫자는 관리자에게만 — 코치는 닫지 못한다", () => {
    const res = matchPtRecord(buildPtSample(today, true));
    expect(ptCounts(res, null, true).dispute).toBe(2);
    expect(ptCounts(res, PT_SAMPLE_COACH, false).dispute).toBe(0);
  });

  it("열린 「아니에요」가 걸린 수업은 「회원 확인 중」으로 보류 → 답하면 풀린다", () => {
    const d = buildPtSample(today, true);
    const res = matchPtRecord(d);
    const lines = ptPayLinesAll(res, d.events ?? [], null, null, "2026-12");
    const noshowRow = res.rows.find(
      (r) => r.s.member_user_id === "sample-m3" && r.s.kind === "noshow",
    );
    const line = lines.find((l) => l.sessionId === noshowRow?.s.id);
    expect(line?.state).toBe("member");
    const m = ptPayMonth(
      res,
      d.events ?? [],
      null,
      `${today.slice(0, 7)}-01`,
      null,
      undefined,
      "2026-12",
    );
    expect(m.hold.member).toBe(1);
    expect(ptPayHoldText(m.hold)).toContain("회원 확인 중 1");

    const k = (d.checks ?? []).find((c) => c.member_user_id === "sample-m3");
    const closed = applyPtDemo(d, {
      type: "checkClose",
      id: k?.id ?? "",
      reply: "미참석 규정으로 1회 차감됐어요",
    });
    const res2 = matchPtRecord(closed);
    expect(res2.disputes?.length).toBe(1);
    const line2 = ptPayLinesAll(
      res2,
      closed.events ?? [],
      null,
      null,
      "2026-12",
    ).find((l) => l.sessionId === noshowRow?.s.id);
    expect(line2?.state).toBe("paid");
    expect((closed.checks ?? []).find((c) => c.id === k?.id)).toMatchObject({
      reply: "미참석 규정으로 1회 차감됐어요",
      closed_by_name: "예시 지점장",
    });
  });

  it("예시 — 답은 「아니에요」에만 · 한 번만 · 켜기 · 끄기", () => {
    const d = buildPtSample(today, true, { auto: true });
    const k = (d.checks ?? [])[0];
    expect(() =>
      applyPtDemo(d, { type: "checkClose", id: k.id, reply: " " }),
    ).toThrow("회원님께 보낼 답을 적어 주세요");
    const once = applyPtDemo(d, {
      type: "checkClose",
      id: k.id,
      reply: "확인했어요",
    });
    expect(() =>
      applyPtDemo(once, { type: "checkClose", id: k.id, reply: "다시" }),
    ).toThrow("이미 답했어요");
    expect(applyPtDemo(d, { type: "checkSet", on: false }).check).toMatchObject(
      { on: false, can_set: true },
    );
  });

  it("회원 확인 자료가 없으면(서버 적용 전) 예전과 같다", () => {
    const d = buildPtSample(today, true);
    const res = matchPtRecord({ ...d, checks: undefined, check: undefined });
    expect(res.disputes).toBeUndefined();
    expect(
      res.rows.every((r) => r.deducts.every((x) => x.disputed === undefined)),
    ).toBe(true);
    expect(res.extras.every((x) => x.check === undefined)).toBe(true);
    expect(ptCounts(res, null, true).dispute).toBe(0);
  });
});
