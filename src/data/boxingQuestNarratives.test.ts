import { describe, expect, it } from "vitest";

import {
  BOXING_QUEST_NARRATIVES,
  getBoxingQuestNarrative,
  type NarrativeRank,
} from "./boxingQuestNarratives";

const ALL_RANKS: NarrativeRank[] = ["white", "blue", "red", "black"];

describe("boxingQuestNarratives", () => {
  it("BOXING_QUEST_NARRATIVES contains exactly 4 entries (white/blue/red/black)", () => {
    expect(BOXING_QUEST_NARRATIVES).toHaveLength(4);
    const ranks = BOXING_QUEST_NARRATIVES.map((n) => n.rank).sort();
    expect(ranks).toEqual(["black", "blue", "red", "white"]);
  });

  it("getBoxingQuestNarrative returns the right archetype for every rank", () => {
    for (const rank of ALL_RANKS) {
      const n = getBoxingQuestNarrative(rank);
      expect(n.rank).toBe(rank);
      expect(n.archetype.length).toBeGreaterThan(0);
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.hook.length).toBeGreaterThan(0);
      expect(n.body.length).toBeGreaterThanOrEqual(2);
      expect(n.closing.length).toBeGreaterThan(0);
    }
  });

  it("all narratives are distinct (no copy-paste between ranks)", () => {
    const archetypes = ALL_RANKS.map((r) => getBoxingQuestNarrative(r).archetype);
    expect(new Set(archetypes).size).toBe(ALL_RANKS.length);
  });

  it("does not reference real-world boxers / movies / quotes (smoke check)", () => {
    // 자체 제작 콘텐츠 보호: 알려진 실존 인물명 / 영화 / 명언 키워드가
    // narrative 본문에 들어가지 않는지 가벼운 smoke check.
    const blacklist = [
      "알리",
      "타이슨",
      "록키",
      "세컨즈 아웃",
      "Float like",
      "Sting like",
    ];
    for (const n of BOXING_QUEST_NARRATIVES) {
      const blob = [n.title, n.archetype, n.hook, ...n.body, n.closing].join(
        "\n",
      );
      for (const word of blacklist) {
        expect(
          blob.toLowerCase().includes(word.toLowerCase()),
          `${n.rank} contains forbidden term "${word}"`,
        ).toBe(false);
      }
    }
  });
});
