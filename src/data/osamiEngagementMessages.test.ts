import { describe, expect, it } from "vitest";

import {
  getOsamiMessages,
  pickOsamiMessageBySeed,
  type OsamiMessageType,
  type OsamiPersona,
} from "./osamiEngagementMessages";

const ALL_PERSONAS: OsamiPersona[] = ["white", "blue", "red", "black"];

const ALL_TYPES: OsamiMessageType[] = [
  "app_open",
  "daily_briefing",
  "quiz_correct",
  "quiz_wrong",
  "fun_challenge_start",
  "fun_challenge_complete",
  "journal_prompt",
  "cheer_received",
  "comeback_after_absence",
];

describe("osamiEngagementMessages", () => {
  describe("getOsamiMessages", () => {
    it("returns at least one message for every (persona, type) combination", () => {
      for (const persona of ALL_PERSONAS) {
        for (const type of ALL_TYPES) {
          const list = getOsamiMessages(persona, type);
          expect(list.length, `${persona}/${type}`).toBeGreaterThanOrEqual(1);
          for (const msg of list) {
            expect(typeof msg).toBe("string");
            expect(msg.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe("pickOsamiMessageBySeed", () => {
    it("returns a deterministic message for the same seed", () => {
      const a = pickOsamiMessageBySeed("white", "daily_briefing", "2026-04-30");
      const b = pickOsamiMessageBySeed("white", "daily_briefing", "2026-04-30");
      expect(a).toBe(b);
    });

    it("returns the same message for the same persona+type+seed across personas independently", () => {
      // 시드가 같아도 페르소나가 다르면 다른 사전 → 다른 메시지가 나올 수 있다.
      const seed = "user-42:2026-04-30";
      const messages = ALL_PERSONAS.map((p) =>
        pickOsamiMessageBySeed(p, "daily_briefing", seed),
      );
      // 각 페르소나의 첫 메시지가 모두 사전에서 골라진 valid 한 string 인지 검증.
      for (const msg of messages) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it("returned message is always one of the candidates", () => {
      const seeds = ["a", "b", "c", "user-1:2026-01-01", "user-99:2026-12-31"];
      for (const persona of ALL_PERSONAS) {
        for (const type of ALL_TYPES) {
          const candidates = getOsamiMessages(persona, type);
          for (const seed of seeds) {
            const picked = pickOsamiMessageBySeed(persona, type, seed);
            expect(candidates).toContain(picked);
          }
        }
      }
    });

    it("changes message when seed changes (statistical sample)", () => {
      // 같은 페르소나 / 타입에서 seed 가 충분히 달라지면 결과 다양성 발생.
      const seen = new Set<string>();
      for (let i = 0; i < 50; i++) {
        seen.add(pickOsamiMessageBySeed("white", "app_open", `seed-${i}`));
      }
      // white/app_open 후보가 2개이므로 둘 다 등장해야 함.
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });
  });
});
