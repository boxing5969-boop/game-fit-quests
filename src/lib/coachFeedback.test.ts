import { describe, expect, it } from "vitest";
import {
  buildFeedbackSystem,
  buildFeedbackUser,
  checkFeedback,
  cleanMarks,
  parseFeedbackJson,
  type FeedbackStd,
} from "../../supabase/functions/_shared/coachFeedback.ts";

const stds: FeedbackStd[] = [
  { no: 1, title: "이름을 불러요", how: "회원마다 이름을 한 번 이상" },
  { no: 4, title: "처음 온 회원을 먼저", how: "끝나면 다음 방문 날을 정해요" },
];
const ctx = { memo: "이름 잘 부름. 처음 온 회원 2명 끝나고 말 안 걸음", stdNos: [1, 4] };

describe("오삼코치 다듬기 — 지시문 · 입력", () => {
  it("기준 목록과 규칙이 지시문에 들어간다", () => {
    const s = buildFeedbackSystem(stds);
    expect(s).toContain("1. 이름을 불러요 — 회원마다 이름을 한 번 이상");
    expect(s).toContain("바꿀 것은 정확히 1개");
    expect(s).toContain("이모지는 쓰지 않는다");
  });
  it("점검표 · 메모를 한 덩어리로", () => {
    const u = buildFeedbackUser({ standards: stds, marks: { "1": "y" }, memo: "", coachName: "김코치" });
    expect(u).toContain("1. 이름을 불러요: 했어요");
    expect(u).toContain("4. 처음 온 회원을 먼저: 표시 안 함");
    expect(u).toContain("(메모 없음)");
  });
  it("점검표는 1~9번 · y/s/n 만", () => {
    expect(cleanMarks({ "1": "y", "2": "x", "10": "y", a: "n", "4": "n" })).toEqual({ "1": "y", "4": "n" });
    expect(cleanMarks(null)).toEqual({});
    expect(cleanMarks(["y"])).toEqual({});
  });
});

describe("오삼코치 다듬기 — 결과 검사", () => {
  const good = {
    good1: "회원마다 이름을 불러 주셔서 분위기가 밝았어요",
    good2: "",
    fix1: '처음 온 회원 2명께 끝나고 "다음엔 언제 오세요?" 물어봐 주세요',
    fix_no: 4,
    error: "",
  };
  it("통과 — 메모에 있던 숫자는 써도 된다", () => {
    const r = checkFeedback(good, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.fix_no).toBe(4);
  });
  it("지어낸 숫자 · 탓하는 말 · 전화번호 · 긴 글은 막는다", () => {
    expect(checkFeedback({ ...good, good1: "회원 3명이 집중했어요" }, ctx)).toMatchObject({ ok: false, reason: "digits" });
    expect(checkFeedback({ ...good, fix1: "칭찬이 부족했어요" }, ctx)).toMatchObject({ ok: false, reason: "blame" });
    expect(checkFeedback({ ...good, good2: "010-1234-5678 로 연락" }, { ...ctx, memo: "010-1234-5678" })).toMatchObject({ ok: false, reason: "phone" });
    expect(checkFeedback({ ...good, good1: "가".repeat(95) }, ctx)).toMatchObject({ ok: false, reason: "too_long" });
  });
  it("기준 번호가 목록에 없으면 비운다 · 이모지는 지운다", () => {
    const r = checkFeedback({ ...good, fix_no: 9, good1: "이름을 불러 주셨어요 👍" }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.fix_no).toBeNull();
      expect(r.result.good1).toBe("이름을 불러 주셨어요");
    }
  });
  it("모델이 메모를 더 달라고 하면 그 말을 그대로", () => {
    expect(checkFeedback({ good1: "", good2: "", fix1: "", fix_no: 1, error: "메모를 한두 줄만 더 적어 주세요" }, ctx)).toMatchObject({
      ok: false,
      reason: "model_error",
      message: "메모를 한두 줄만 더 적어 주세요",
    });
  });
  it("JSON 꺼내기", () => {
    expect(parseFeedbackJson('설명 {"good1":"a"} 끝')).toEqual({ good1: "a" });
    expect(parseFeedbackJson("없음")).toBeNull();
  });
});
