import { describe, it, expect } from "vitest";

import {
  AURA_UNLOCK_RULES,
  EFFECT_UNLOCK_RULES,
  FRAME_UNLOCK_RULES,
  TITLE_UNLOCK_RULES,
  TUTORIAL_REWARD_GEMS,
  TUTORIAL_STEPS,
  canPurchaseItem,
  computeUserLevel,
  getLockedItems,
  getNewUnlocks,
  getTutorialSteps,
  getUnlockStatus,
  getUnlockedItems,
  isItemUnlocked,
  isTutorialCompleted,
  resolveDisplayName,
  type UnlockCategory,
} from "./unlockRules";

// Expected unlocked counts per category at each probe level.
// Derived from the spec (not by reading the rule arrays) so the test
// catches any future drift in EFFECT_UNLOCK_RULES etc.
const EXPECTED = [
  { lvl: 1,  effect: 4,  frame: 2,  title: 1, aura: 1 },
  { lvl: 5,  effect: 7,  frame: 3,  title: 2, aura: 2 },
  { lvl: 10, effect: 10, frame: 5,  title: 3, aura: 3 },
  { lvl: 15, effect: 13, frame: 5,  title: 4, aura: 3 },
  { lvl: 20, effect: 16, frame: 7,  title: 5, aura: 4 },
  { lvl: 30, effect: 20, frame: 9,  title: 6, aura: 5 },
  { lvl: 50, effect: 20, frame: 10, title: 7, aura: 6 },
  { lvl: 99, effect: 20, frame: 10, title: 8, aura: 6 },
] as const;

describe("unlockRules — rule array shape", () => {
  it("effect rules total 20 items following spec cadence 4+3+3+3+3+4", () => {
    expect(EFFECT_UNLOCK_RULES).toHaveLength(20);
    const byLevel = (n: number) =>
      EFFECT_UNLOCK_RULES.filter((r) => r.requiredLevel === n).length;
    expect(byLevel(1)).toBe(4);
    expect(byLevel(5)).toBe(3);
    expect(byLevel(10)).toBe(3);
    expect(byLevel(15)).toBe(3);
    expect(byLevel(20)).toBe(3);
    expect(byLevel(30)).toBe(4);
  });

  it("frame rules total 10 items following spec cadence 2+1+2+2+2+1", () => {
    expect(FRAME_UNLOCK_RULES).toHaveLength(10);
    const byLevel = (n: number) =>
      FRAME_UNLOCK_RULES.filter((r) => r.requiredLevel === n).length;
    expect(byLevel(1)).toBe(2);
    expect(byLevel(5)).toBe(1);
    expect(byLevel(10)).toBe(2);
    expect(byLevel(20)).toBe(2);
    expect(byLevel(30)).toBe(2);
    expect(byLevel(50)).toBe(1);
  });

  it("title rules use the exact Korean copy from the spec", () => {
    expect(TITLE_UNLOCK_RULES).toHaveLength(8);
    const name = (lvl: number) =>
      TITLE_UNLOCK_RULES.find((r) => r.requiredLevel === lvl)
        ?.displayNameOverride;
    expect(name(1)).toBe("입문자");
    expect(name(5)).toBe("복서 지망생");
    expect(name(10)).toBe("아마추어 복서");
    expect(name(15)).toBe("링의 도전자");
    expect(name(20)).toBe("프로 복서");
    expect(name(30)).toBe("챔피언 후보");
    // Lv50/99 intentionally have no override — original labels 챔피언/레전드
    // already match the spec verbatim.
    expect(
      TITLE_UNLOCK_RULES.find((r) => r.requiredLevel === 50),
    ).toBeDefined();
    expect(
      TITLE_UNLOCK_RULES.find((r) => r.requiredLevel === 99),
    ).toBeDefined();
  });

  it("aura rules use the exact Korean copy from the spec", () => {
    expect(AURA_UNLOCK_RULES).toHaveLength(6);
    const name = (lvl: number) =>
      AURA_UNLOCK_RULES.find((r) => r.requiredLevel === lvl)
        ?.displayNameOverride;
    expect(name(1)).toBe("블루 오라");
    expect(name(5)).toBe("그린 오라");
    expect(name(10)).toBe("퍼플 오라");
    expect(name(20)).toBe("레드 오라");
    expect(name(30)).toBe("골드 오라");
    expect(name(50)).toBe("레인보우 오라");
  });
});

describe("getUnlockedItems / getLockedItems across all probe levels", () => {
  for (const row of EXPECTED) {
    it(`Lv${row.lvl}: correct split per category`, () => {
      const cats: UnlockCategory[] = ["effect", "frame", "title", "aura"];
      const totalByCat: Record<UnlockCategory, number> = {
        effect: 20,
        frame: 10,
        title: 8,
        aura: 6,
      };
      for (const cat of cats) {
        const unlocked = getUnlockedItems(cat, row.lvl).length;
        const locked = getLockedItems(cat, row.lvl).length;
        expect(unlocked, `${cat} unlocked @ Lv${row.lvl}`).toBe(row[cat]);
        expect(locked, `${cat} locked @ Lv${row.lvl}`).toBe(
          totalByCat[cat] - row[cat],
        );
      }
    });
  }
});

describe("getUnlockStatus / canPurchaseItem", () => {
  it("locked item reports correct requiredLevel and message", () => {
    const status = getUnlockStatus(1, { category: "frame", itemKey: "gold" });
    expect(status.locked).toBe(true);
    expect(status.requiredLevel).toBe(20);
    expect(status.message).toBe("Lv.20 해금");
    expect(canPurchaseItem(1, { category: "frame", itemKey: "gold" })).toBe(false);
  });

  it("unlocked item returns empty message and locked=false", () => {
    const status = getUnlockStatus(20, { category: "frame", itemKey: "gold" });
    expect(status.locked).toBe(false);
    expect(status.message).toBe("");
    expect(canPurchaseItem(20, { category: "frame", itemKey: "gold" })).toBe(true);
  });

  it("price-only item (unknown key) treats as unlocked", () => {
    const status = getUnlockStatus(1, { category: "effect", itemKey: "clover" });
    expect(status.requiredLevel).toBeNull();
    expect(status.locked).toBe(false);
    expect(canPurchaseItem(1, { category: "effect", itemKey: "clover" })).toBe(true);
  });

  it("isItemUnlocked matches canPurchaseItem for identical inputs", () => {
    const refs: { cat: UnlockCategory; key: string }[] = [
      { cat: "effect", key: "dragon" },
      { cat: "title", key: "legend" },
      { cat: "aura", key: "aura_rainbow" },
    ];
    for (const { cat, key } of refs) {
      for (const lvl of [1, 15, 30, 50, 99]) {
        expect(isItemUnlocked(cat, key, lvl)).toBe(
          canPurchaseItem(lvl, { category: cat, itemKey: key }),
        );
      }
    }
  });
});

describe("getNewUnlocks (level bump)", () => {
  it("captures every new rule in (prev, current]", () => {
    const bumped = getNewUnlocks(4, 10);
    // 4→10 should cover Lv5 (3 effect + 1 frame + 1 title + 1 aura = 6)
    // + Lv10 (3 effect + 2 frame + 1 title + 1 aura = 7) = 13
    expect(bumped).toHaveLength(13);
  });

  it("no-op when currentLevel <= prevLevel", () => {
    expect(getNewUnlocks(20, 20)).toHaveLength(0);
    expect(getNewUnlocks(20, 15)).toHaveLength(0);
  });

  it("single-threshold bump collects only that tier", () => {
    // 29→30: picks up exactly the Lv30 rules (4 effect + 2 frame + 1 title + 1 aura = 8).
    expect(getNewUnlocks(29, 30)).toHaveLength(8);
  });
});

describe("computeUserLevel — rank/level/bosses/HoF combinations", () => {
  it("white Lv1 → 1", () => {
    expect(
      computeUserLevel({ current_rank: "white", current_level: 1 }),
    ).toBe(1);
  });

  it("blue Lv5 → 15", () => {
    expect(
      computeUserLevel({ current_rank: "blue", current_level: 5 }),
    ).toBe(15);
  });

  it("red Lv10 → 30", () => {
    expect(
      computeUserLevel({ current_rank: "red", current_level: 10 }),
    ).toBe(30);
  });

  it("black Lv10, no bosses, not HoF → 40", () => {
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 0,
      }),
    ).toBe(40);
  });

  it("black Lv10, bosses>=4, not HoF → 50 (master)", () => {
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 4,
      }),
    ).toBe(50);
  });

  it("HoF flag overrides everything → 99", () => {
    expect(
      computeUserLevel({
        current_rank: "white",
        current_level: 1,
        is_in_hall_of_fame: true,
      }),
    ).toBe(99);
  });

  it("unknown rank → safe fallback 1", () => {
    expect(
      computeUserLevel({ current_rank: "gold", current_level: 5 }),
    ).toBe(1);
  });
});

describe("tutorial helpers", () => {
  it("getTutorialSteps returns the 5-step frozen ordering", () => {
    const steps = getTutorialSteps();
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.key)).toEqual([
      "profile",
      "ranking",
      "effect_shop",
      "mini_game",
      "complete",
    ]);
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("isTutorialCompleted handles null/undefined/unflagged/flagged", () => {
    expect(isTutorialCompleted(null)).toBe(false);
    expect(isTutorialCompleted(undefined)).toBe(false);
    expect(isTutorialCompleted({})).toBe(false);
    expect(isTutorialCompleted({ tutorial_completed: false })).toBe(false);
    expect(isTutorialCompleted({ tutorial_completed: true })).toBe(true);
    expect(isTutorialCompleted({ tutorial_completed: null })).toBe(false);
  });

  it("reward constant stays at the documented 1000 gems", () => {
    expect(TUTORIAL_REWARD_GEMS).toBe(1000);
  });

  it("step definitions carry the labels TutorialOverlay renders", () => {
    const byKey = Object.fromEntries(
      TUTORIAL_STEPS.map((s) => [s.key, s]),
    );
    expect(byKey.profile.label).toBe("프로필 확인");
    expect(byKey.ranking.label).toBe("랭킹 확인");
    expect(byKey.complete.ctaLabel).toBe("보상 받기");
  });
});

describe("resolveDisplayName (D1 override rule)", () => {
  it("uses override when present", () => {
    expect(resolveDisplayName("title", "beginner", "fallback")).toBe("입문자");
    expect(resolveDisplayName("aura", "aura_ocean", "fallback")).toBe("블루 오라");
  });

  it("falls back when no override", () => {
    // champion has no override (original label already matches spec)
    expect(resolveDisplayName("title", "champion", "챔피언")).toBe("챔피언");
  });

  it("falls back for items not under any unlock rule", () => {
    expect(resolveDisplayName("effect", "clover", "클로버")).toBe("클로버");
  });
});
