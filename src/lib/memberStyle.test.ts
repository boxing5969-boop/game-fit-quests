import { describe, expect, it } from "vitest";
import {
  ALL_SCALE_ITEMS, PREF_ITEMS, TYPE_ITEMS, BIG5_ITEMS, cleanStyleAnswers, missingItems, scoreStyle, checkCard,
} from "../../supabase/functions/_shared/memberStyle.ts";

const full = (v: number) => {
  const a: Record<string, number | string> = {};
  for (const i of ALL_SCALE_ITEMS) a[i.id] = v;
  for (const p of PREF_ITEMS) a[p.id] = p.options[0].v;
  return a;
};

const card = {
  one_line: "차근차근 이해하고 나서 몸이 빨리 따라오는 회원이에요",
  first_words: ["오늘 잽 하나만 같이 다듬어 봐요", "지난번보다 가드가 좋아졌어요"],
  teach: { explain: "왜 그런지 한 줄 먼저", correct: "하나만 짚어요", praise: "구체적으로", intensity: "중간부터", group: "짝 연습이 좋아요" },
  say: ["좋아요, 그 느낌이에요", "하나만 더 해 봐요", "지난번보다 빨라졌어요"],
  avoid: ["다른 회원과 비교하기", "한꺼번에 여러 개 고치기", "큰 소리로 지적하기"],
  dropout: { level: "보통", signals: ["2주 넘게 안 오면"], basis: "추정" },
  retention: "이름을 불러 인사해요",
  next_goal: "4주 안에 원투 정확하게",
  sparring: "코치님이 먼저 권하면 해요",
  evidence: [{ claim: "설명을 좋아해요", basis: "확정" }, { claim: "평일 저녁에 와요", basis: "확정" }],
};

describe("153 성향 검사", () => {
  it("문항 수 · 겹치는 번호 없음", () => {
    expect(TYPE_ITEMS.length).toBe(16);
    expect(BIG5_ITEMS.length).toBe(10);
    expect(PREF_ITEMS.length).toBe(10);
    const ids = [...ALL_SCALE_ITEMS.map((i) => i.id), ...PREF_ITEMS.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("빠진 문항 · 이상한 값은 버린다", () => {
    expect(missingItems(cleanStyleAnswers(full(3)))).toEqual([]);
    const bad = cleanStyleAnswers({ ...full(3), [TYPE_ITEMS[0].id]: 9, junk: 1 });
    expect(missingItems(bad)).toContain(TYPE_ITEMS[0].id);
    expect(bad.junk).toBeUndefined();
  });
  it("채점 범위", () => {
    for (const v of [1, 3, 5]) {
      const s = scoreStyle(cleanStyleAnswers(full(v)));
      expect(s.type16).toMatch(/^[EI][SN][TF][JP]$/);
      for (const n of Object.values(s.axes)) expect(Math.abs(n)).toBeLessThanOrEqual(100);
      for (const n of Object.values(s.big5)) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(100); }
    }
  });
  it("지도 카드 검사 — 통과 · 금지 낱말", () => {
    expect(checkCard(card).ok).toBe(true);
    expect(checkCard({ ...card, one_line: "ENFP 라서 활발해요" }).ok).toBe(false);
    expect(checkCard({ ...card, retention: "우울해 보이면 연락" }).ok).toBe(false);
    expect(checkCard({ ...card, say: [] }).ok).toBe(false);
  });
});
