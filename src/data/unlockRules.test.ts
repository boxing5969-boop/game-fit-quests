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
//
// Effects (36 total):
//   Lv1×4, Lv5×4, Lv10×3, Lv15×4, Lv20×3, Lv25×3, Lv30×6, Lv35×3, Lv40×2, Lv50×4
// Cumulative: Lv1=4, Lv5=8, Lv10=11, Lv15=15, Lv20=18, Lv25=21, Lv30=27,
//             Lv35=30, Lv40=32, Lv50=36, Lv99=36
//
// Titles (9 total): Lv1×2 (rookie_challenger + beginner), Lv5, Lv10, Lv15,
//                   Lv20, Lv30, Lv50, Lv99
// Cumulative: Lv1=2, Lv5=3, Lv10=4, Lv15=5, Lv20=6, Lv30=7, Lv50=8, Lv99=9
const EXPECTED = [
  { lvl: 1,  effect: 4,  frame: 2,  title: 2, aura: 1 },
  { lvl: 5,  effect: 8,  frame: 3,  title: 3, aura: 2 },
  { lvl: 10, effect: 11, frame: 5,  title: 4, aura: 3 },
  { lvl: 15, effect: 15, frame: 5,  title: 5, aura: 3 },
  { lvl: 20, effect: 18, frame: 7,  title: 6, aura: 4 },
  { lvl: 30, effect: 27, frame: 9,  title: 7, aura: 5 },
  { lvl: 50, effect: 36, frame: 10, title: 8, aura: 6 },
  { lvl: 99, effect: 36, frame: 10, title: 9, aura: 6 },
] as const;

describe("unlockRules — rule array shape", () => {
  it("effect rules cover all 36 EFFECT_OPTIONS distributed across league tiers", () => {
    expect(EFFECT_UNLOCK_RULES).toHaveLength(36);
    const byLevel = (n: number) =>
      EFFECT_UNLOCK_RULES.filter((r) => r.requiredLevel === n).length;
    // Cadence after Step 8 입단식 expansion
    expect(byLevel(1)).toBe(4);
    expect(byLevel(5)).toBe(4);
    expect(byLevel(10)).toBe(3);
    expect(byLevel(15)).toBe(4);
    expect(byLevel(20)).toBe(3);
    expect(byLevel(25)).toBe(3);
    expect(byLevel(30)).toBe(6);
    expect(byLevel(35)).toBe(3);
    expect(byLevel(40)).toBe(2);
    expect(byLevel(50)).toBe(4);
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

  it("title rules include 신입 챌린저 + 7 standard tiers + 2 endgame", () => {
    expect(TITLE_UNLOCK_RULES).toHaveLength(9);
    // Lv1 entries: 신입 챌린저 (입단식 보상) + 입문자 (기본)
    const lv1 = TITLE_UNLOCK_RULES.filter((r) => r.requiredLevel === 1);
    expect(lv1.map((r) => r.displayNameOverride).sort()).toEqual(
      ["신입 챌린저", "입문자"].sort(),
    );
    const nameAt = (lvl: number) =>
      TITLE_UNLOCK_RULES.find(
        (r) => r.requiredLevel === lvl && r.itemKey !== "rookie_challenger",
      )?.displayNameOverride;
    expect(nameAt(5)).toBe("복서 지망생");
    expect(nameAt(10)).toBe("아마추어 복서");
    expect(nameAt(15)).toBe("링의 도전자");
    expect(nameAt(20)).toBe("프로 복서");
    expect(nameAt(30)).toBe("챔피언 후보");
    // Lv50/99 don't carry override (champion/legend already match)
    expect(TITLE_UNLOCK_RULES.find((r) => r.requiredLevel === 50)).toBeDefined();
    expect(TITLE_UNLOCK_RULES.find((r) => r.requiredLevel === 99)).toBeDefined();
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
        effect: 36,
        frame: 10,
        title: 9,
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
    // 'clover' was added to Lv5 in Step 8. Use a truly unknown key.
    const status = getUnlockStatus(1, { category: "effect", itemKey: "__phantom__" });
    expect(status.requiredLevel).toBeNull();
    expect(status.locked).toBe(false);
    expect(canPurchaseItem(1, { category: "effect", itemKey: "__phantom__" })).toBe(true);
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
    // 4→10: Lv5 (4 effect + 1 frame + 1 title + 1 aura = 7)
    //     + Lv10 (3 effect + 2 frame + 1 title + 1 aura = 7) = 14
    expect(bumped).toHaveLength(14);
  });

  it("no-op when currentLevel <= prevLevel", () => {
    expect(getNewUnlocks(20, 20)).toHaveLength(0);
    expect(getNewUnlocks(20, 15)).toHaveLength(0);
  });

  it("single-threshold bump collects only that tier", () => {
    // 29→30: Lv30 = 6 effect + 2 frame + 1 title + 1 aura — wait, let me recount.
    // Frame Lv30 = 2 (galaxy, holy), Title Lv30 = 1 (thunder_king), Aura Lv30 = 1 (halo_black_gold)
    // Effect Lv30 = 6 → total = 6 + 2 + 1 + 1 = 10
    expect(getNewUnlocks(29, 30)).toHaveLength(10);
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

  it("master_track_unlocked + master_level maps to 41..99", () => {
    // Same rank/level shell (black Lv10) but master track flipped.
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 4,
        master_track_unlocked: true,
        master_level: 1,
      }),
    ).toBe(41);

    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        master_track_unlocked: true,
        master_level: 10,
      }),
    ).toBe(50);

    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        master_track_unlocked: true,
        master_level: 59,
      }),
    ).toBe(99);
  });

  it("master_track takes precedence over is_in_hall_of_fame flag", () => {
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        is_in_hall_of_fame: true,
        master_track_unlocked: true,
        master_level: 25,
      }),
    ).toBe(65);
  });

  it("master_track with master_level=0 falls through to legacy logic", () => {
    // Defensive: unlocked but not yet assigned a level → treat as 1..40 path.
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 4,
        master_track_unlocked: true,
        master_level: 0,
      }),
    ).toBe(50);
  });

  it("master_level is clamped to 59 if overshot", () => {
    expect(
      computeUserLevel({
        current_rank: "black",
        current_level: 10,
        master_track_unlocked: true,
        master_level: 9999,
      }),
    ).toBe(99);
  });
});

describe("tutorial helpers", () => {
  it("getTutorialSteps returns the 5-step frozen ordering", () => {
    const steps = getTutorialSteps();
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.key)).toEqual([
      "profile_photo",
      "discover_app",
      "first_mission",
      "first_checkin",
      "first_challenge",
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

  it("step definitions carry the 스타터 캠프 labels the tutorial overlay renders", () => {
    const byKey = Object.fromEntries(
      TUTORIAL_STEPS.map((s) => [s.key, s]),
    );
    expect(byKey.profile_photo.label).toBe("1단계 — 프로필 사진 설정");
    expect(byKey.discover_app.label).toBe("2단계 — 마이복서153 알아보기");
    expect(byKey.first_mission.label).toBe("3단계 — 훈련 미션 둘러보기");
    expect(byKey.first_checkin.label).toBe("4단계 — QR 출석체크 연습하기");
    expect(byKey.first_challenge.label).toBe("5단계 — 더 다이어터 챌린지 둘러보기");
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
