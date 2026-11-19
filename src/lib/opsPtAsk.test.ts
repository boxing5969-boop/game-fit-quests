import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PT_ASK_ANSWER_PRESETS,
  applyPtAskDemo,
  buildPtAskSample,
  ptAskAnswerError,
  ptAskFor,
  ptAskLine,
  ptAskNoteError,
  ptAskPayload,
  ptAskQuestion,
  ptOpenAsks,
  type PtAsk,
} from "./opsPtAsk";

const base: PtAsk = {
  id: "a1",
  coach_staff_id: "c1",
  coach_name: "예시 코치",
  asker_name: "운영진",
  mine: true,
  item: "entry",
  event_id: null,
  session_id: null,
  member_user_id: "m1",
  member_name: "가온",
  about_date: "2026-11-15",
  note: null,
  status: "open",
  answer: null,
  answered_at: null,
  created_at: "2026-11-19T10:00:00+09:00",
};

describe("코치에게 물어보기", () => {
  it("묻는 말 — 종류마다", () => {
    expect(ptAskQuestion(base)).toBe("가온 11/15 입장 — PT 수업이었나요?");
    expect(ptAskQuestion({ ...base, item: "deduct" })).toBe("가온 11/15 차감 — 어떤 수업이었나요?");
    expect(ptAskQuestion({ ...base, item: "wait" })).toBe("가온 11/15 수업 — 브로제이 차감이 안 보여요");
    expect(ptAskQuestion({ item: "other" })).toBe("확인 부탁드려요");
  });

  it("카드의 질문 찾기 — 입장은 회원 + 날짜 · 차감은 차감 id · 차감 대기는 기록 id · 코치별", () => {
    const deduct: PtAsk = { ...base, id: "a2", item: "deduct", event_id: "e1" };
    const wait: PtAsk = { ...base, id: "a3", item: "wait", session_id: "s1" };
    const other: PtAsk = { ...base, id: "a4", coach_staff_id: "c2" };
    const list = [base, deduct, wait, other];
    expect(ptAskFor(list, { item: "entry", member_user_id: "m1", about_date: "2026-11-15" }, "c1")?.id).toBe("a1");
    expect(ptAskFor(list, { item: "entry", member_user_id: "m1", about_date: "2026-11-16" }, "c1")).toBeNull();
    expect(ptAskFor(list, { item: "entry", member_user_id: "m2", about_date: "2026-11-15" }, "c1")).toBeNull();
    expect(ptAskFor(list, { item: "deduct", event_id: "e1" }, "c1")?.id).toBe("a2");
    expect(ptAskFor(list, { item: "deduct", event_id: "e9" }, "c1")).toBeNull();
    expect(ptAskFor(list, { item: "wait", session_id: "s1" }, "c1")?.id).toBe("a3");
    expect(ptAskFor(list, { item: "entry", member_user_id: "m1", about_date: "2026-11-15" }, "c2")?.id).toBe("a4");
  });

  it("열린 질문이 먼저 — 없으면 가장 최근 답", () => {
    const old: PtAsk = { ...base, id: "o", status: "answered", answer: "개인 운동이었어요", created_at: "2026-11-17T10:00:00+09:00" };
    const newer: PtAsk = { ...base, id: "n", status: "answered", answer: "수업이었어요", created_at: "2026-11-18T10:00:00+09:00" };
    const t = { item: "entry" as const, member_user_id: "m1", about_date: "2026-11-15" };
    expect(ptAskFor([old, newer], t)?.id).toBe("n");
    expect(ptAskFor([old, newer, { ...base, id: "open", created_at: "2026-11-16T10:00:00+09:00" }], t)?.id).toBe("open");
  });

  it("카드 한 줄 · 코치가 답할 것", () => {
    expect(ptAskLine(base)).toEqual({ text: "예시 코치님께 물어봤어요 — 답을 기다려요", tone: "warn" });
    expect(ptAskLine({ ...base, status: "answered", answer: "수업이었어요" })).toEqual({ text: "예시 코치 답 · 수업이었어요", tone: "ok" });
    const list = [{ ...base, id: "b", created_at: "2026-11-19T11:00:00+09:00" }, base, { ...base, id: "x", status: "answered" as const }, { ...base, id: "y", coach_staff_id: "c2" }];
    expect(ptOpenAsks(list, "c1").map((a) => a.id)).toEqual(["a1", "b"]);
  });

  it("검사 말 = 서버 마이그레이션의 말", () => {
    const sql = readFileSync("supabase/migrations/20261119114451_ops_pt_asks.sql", "utf8");
    const msgs = [
      ptAskNoteError("entry", "가".repeat(201)),
      ptAskNoteError("other", ""),
      ptAskAnswerError(" "),
      ptAskAnswerError("가".repeat(301)),
    ];
    for (const m of msgs) {
      expect(m).toBeTruthy();
      expect(sql).toContain(m!);
    }
    expect(ptAskNoteError("entry", "")).toBeNull();
    expect(ptAskAnswerError("수업이었어요")).toBeNull();
    for (const list of Object.values(PT_ASK_ANSWER_PRESETS)) for (const p of list) expect(ptAskAnswerError(p)).toBeNull();
  });

  it("보내는 모양 · 예시에서 눌러 보기", () => {
    const p = ptAskPayload("예시 지점", "c1", { item: "entry", member_user_id: "m1", member_name: "가온", about_date: "2026-11-15" }, "  차감도 봐 주세요 ");
    expect(p).toEqual({
      branch: "예시 지점",
      coach_staff_id: "c1",
      item: "entry",
      event_id: null,
      session_id: null,
      member_user_id: "m1",
      member_name: "가온",
      about_date: "2026-11-15",
      note: "차감도 봐 주세요",
    });
    const sample = buildPtAskSample("2026-11-19", true, "c1");
    const sent = applyPtAskDemo(sample, { type: "send", p }, { coachId: "c1" });
    expect(sent).toHaveLength(sample.length + 1);
    const hit = ptAskFor(sent, { item: "entry", member_user_id: "m1", about_date: "2026-11-15" }, "c1")!;
    expect(hit.status).toBe("open");
    const done = applyPtAskDemo(sent, { type: "answer", id: hit.id, answer: "개인 운동이었어요" }, { coachId: "c1" });
    expect(ptAskFor(done, { item: "entry", member_user_id: "m1", about_date: "2026-11-15" }, "c1")?.answer).toBe("개인 운동이었어요");
  });
});
