import { describe, expect, it } from "vitest";
import { cleanKo, KO_STYLE, koTells } from "../../supabase/functions/_shared/koStyle.ts";
import { buildFeedbackSystem, FEEDBACK_EXAMPLE } from "../../supabase/functions/_shared/coachFeedback.ts";
import { buildCoreSystem, MIND_SUMMARY_SYSTEM, TAILOR_SYSTEM } from "../../supabase/functions/_shared/coachMind.ts";
import { COACH_SYSTEM } from "../../supabase/functions/_shared/coach.ts";
import { SUMMARY_SYSTEM } from "../../supabase/functions/office-summary/summary.ts";

// 2026-11-20 대표님 「이거적용하자 … 마이복서 153에도」 — im-not-ai 한글 AI 티 지우기

describe("cleanKo — 보이지 않는 문자만 지운다", () => {
  it("보통 한글 · 이모지 · 기호는 그대로", () => {
    const s = "회원님, 오늘은 잽 하나만 깔끔하게 🥊 (10~15분) · 153복싱짐";
    expect(cleanKo(s)).toBe(s);
    expect(cleanKo("")).toBe("");
  });
  it("제로폭 · BOM · 소프트하이픈 · 방향 제어 · 태그 문자를 지운다", () => {
    const zw = String.fromCharCode(0x200b);
    const bom = String.fromCharCode(0xfeff);
    const shy = String.fromCharCode(0xad);
    const rlo = String.fromCharCode(0x202e);
    const tag = String.fromCodePoint(0xe0061);
    expect(cleanKo(`잽${zw}을${bom} 쳐${shy}요${rlo}${tag}`)).toBe("잽을 쳐요");
  });
  it("이모지 잇기(U+200D) · 꼴 바꾸기(U+FE0F)는 둔다 — 가족 이모지가 깨지지 않게", () => {
    const family = "👨‍👩‍👧‍👦";
    const heart = "❤️";
    expect(cleanKo(family)).toBe(family);
    expect(cleanKo(heart)).toBe(heart);
  });
  it("특수 공백은 보통 공백으로", () => {
    expect(cleanKo("오늘 운동 끝")).toBe("오늘 운동 끝");
  });
});

describe("koTells — 남은 S1 지문 찾기", () => {
  it("깨끗한 글은 빈 목록", () => {
    expect(koTells("복싱을 배우면 삶의 태도까지 달라져요. 체력과 자신감을 같이 키울 수 있어요.")).toEqual([]);
  });
  it("줄표 · AI 관용구 · 이중 피동 · 겹 완곡을 찾는다", () => {
    expect(koTells("놓쳤으면 처음부터 다시 — 숫자만 남겨 주세요")).toContain("—");
    expect(koTells("결론적으로, 시사하는 바가 큽니다")).toEqual(expect.arrayContaining(["결론적으로", "시사하는 바"]));
    expect(koTells("판단되어진다")).toContain("되어진");
    expect(koTells("복싱은 단순한 운동을 넘어 삶을 바꿔요")).toContain("단순한 ~을 넘어");
    expect(koTells("좋아질 수 있을 것으로 보입니다")).toContain("겹 완곡");
    expect(koTells("지금이 바로 시작할 때입니다")).toContain("지금이 바로 ~할 때");
    expect(koTells(`잽${String.fromCharCode(0x200b)}`)).toContain("보이지 않는 문자");
  });
  it("「가장 힘들 때예요」 같은 보통 말은 걸지 않는다", () => {
    expect(koTells("가장 힘들 때예요. 그래도 한 번만 더 와 주세요.")).toEqual([]);
  });
});

describe("KO_STYLE — AI 글을 쓰는 지시문에 모두 붙어 있다", () => {
  it("규칙 문장", () => {
    expect(KO_STYLE).toContain("[글 다듬기");
    expect(KO_STYLE).toContain("형식 규칙");
    expect(KO_STYLE).toContain("줄표");
  });
  it("관찰 다듬기 · 코치 성향 카드 · 공통 기준 · 맞춤 · 먼저 말 걸기 · 회의 요약", () => {
    for (const sys of [
      buildFeedbackSystem([{ no: 1, title: "이름을 불러요", how: "회원마다" }]),
      MIND_SUMMARY_SYSTEM,
      buildCoreSystem([{ no: 1, title: "이름을 불러요" }]),
      TAILOR_SYSTEM,
      COACH_SYSTEM,
      SUMMARY_SYSTEM,
    ]) {
      expect(sys).toContain(KO_STYLE);
    }
  });
  it("JSON 지시문은 출력 줄이 맨 끝 그대로", () => {
    for (const sys of [buildFeedbackSystem([{ no: 1, title: "이름을 불러요", how: "회원마다" }]), MIND_SUMMARY_SYSTEM, TAILOR_SYSTEM]) {
      expect(sys.trim().split("\n").pop()).toMatch(/^\[출력\]/);
    }
  });
  it("지시문 속 예시 답에는 AI 티가 없다(모델이 예시를 따라 쓰니까)", () => {
    const ex = FEEDBACK_EXAMPLE.output;
    expect(koTells([ex.good1, ex.good2, ex.fix1].join("\n"))).toEqual([]);
    const core = buildCoreSystem([{ no: 1, title: "이름을 불러요" }]);
    const exampleLine = core.split("\n").find((l) => l.startsWith("→ {")) ?? "";
    expect(exampleLine).not.toBe("");
    expect(koTells(exampleLine)).toEqual([]);
  });
});
