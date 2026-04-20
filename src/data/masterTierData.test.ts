import { describe, it, expect } from "vitest";

import {
  MASTER_BOSS_LEVELS,
  MASTER_LEVEL_DEFINITIONS,
  canEnterMasterTrack,
  getMasterLevelDefinition,
  isMasterBossLevel,
} from "./masterTierData";

describe("masterTierData — shape", () => {
  it("exposes exactly 59 level definitions (master 1..59)", () => {
    expect(MASTER_LEVEL_DEFINITIONS).toHaveLength(59);
    expect(MASTER_LEVEL_DEFINITIONS[0].masterLevel).toBe(1);
    expect(MASTER_LEVEL_DEFINITIONS[58].masterLevel).toBe(59);
  });

  it("overallLevel === 40 + masterLevel for every row", () => {
    for (const def of MASTER_LEVEL_DEFINITIONS) {
      expect(def.overallLevel).toBe(40 + def.masterLevel);
    }
  });

  it("boss levels are exactly 10/20/30/40/50/59", () => {
    const boss = MASTER_LEVEL_DEFINITIONS.filter((d) => d.isBoss).map((d) => d.masterLevel);
    expect(boss).toEqual([10, 20, 30, 40, 50, 59]);
    expect(MASTER_BOSS_LEVELS).toEqual([10, 20, 30, 40, 50, 59]);
  });

  it("non-boss levels receive baseline 100-gem reward; boss levels scale up", () => {
    const gemFor = (n: number) => getMasterLevelDefinition(n)!.gemReward;
    expect(gemFor(1)).toBe(100);
    expect(gemFor(9)).toBe(100);
    expect(gemFor(10)).toBe(1000);
    expect(gemFor(20)).toBe(1500);
    expect(gemFor(30)).toBe(2000);
    expect(gemFor(40)).toBe(2500);
    expect(gemFor(50)).toBe(3000);
    expect(gemFor(59)).toBe(5000);
  });

  it("Lv50-boss carries champion title + eternal frame + rainbow aura", () => {
    const def = getMasterLevelDefinition(10)!; // master 10 = overall 50
    expect(def.titleReward).toBe("champion");
    expect(def.frameReward).toBe("eternal");
    expect(def.auraReward).toBe("aura_rainbow");
  });

  it("Lv99-boss carries legend title only", () => {
    const def = getMasterLevelDefinition(59)!; // master 59 = overall 99
    expect(def.titleReward).toBe("legend");
    expect(def.frameReward).toBeNull();
    expect(def.auraReward).toBeNull();
  });

  it("failRetentionPct defaults to 50 across all rows", () => {
    for (const d of MASTER_LEVEL_DEFINITIONS) {
      expect(d.failRetentionPct).toBe(50);
    }
  });
});

describe("masterTierData — helpers", () => {
  it("isMasterBossLevel matches the boss list", () => {
    for (const n of [10, 20, 30, 40, 50, 59]) {
      expect(isMasterBossLevel(n)).toBe(true);
    }
    for (const n of [1, 9, 11, 19, 29, 39, 49, 58]) {
      expect(isMasterBossLevel(n)).toBe(false);
    }
  });

  it("getMasterLevelDefinition rejects out-of-range inputs", () => {
    expect(getMasterLevelDefinition(0)).toBeUndefined();
    expect(getMasterLevelDefinition(60)).toBeUndefined();
    expect(getMasterLevelDefinition(-1)).toBeUndefined();
    expect(getMasterLevelDefinition(59)).toBeDefined();
  });

  it("canEnterMasterTrack requires black Lv10 + 4 bosses + not already in", () => {
    // Happy path
    expect(
      canEnterMasterTrack({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 4,
      }),
    ).toBe(true);

    // Not enough bosses
    expect(
      canEnterMasterTrack({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 3,
      }),
    ).toBe(false);

    // Wrong rank
    expect(
      canEnterMasterTrack({
        current_rank: "red",
        current_level: 10,
        bosses_cleared: 4,
      }),
    ).toBe(false);

    // Already unlocked
    expect(
      canEnterMasterTrack({
        current_rank: "black",
        current_level: 10,
        bosses_cleared: 4,
        master_track_unlocked: true,
      }),
    ).toBe(false);
  });
});
