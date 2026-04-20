/**
 * Master track — client-side mirror of master_level_definitions.
 *
 * Serves two purposes:
 *   1. Render the 41~99 progression UI without a round-trip per level
 *      (title/is_boss/reward preview shown in RankUpPage / member card)
 *   2. Provide a typed source for unlockRules when the master track
 *      overrides the classic rank*10+level formula.
 *
 * ⚠️  Stays in sync with migration 20260420160000_master_track.sql.
 *     Touch both together when changing boss layout / rewards.
 */

export type MasterTierRewardKey = "gem" | "title" | "frame" | "aura";

export interface MasterLevelDefinition {
  /** 1..59 — offset from the master-track entry point. */
  masterLevel: number;
  /** 41..99 on the unified scale. */
  overallLevel: number;
  title: string;
  description: string;
  isBoss: boolean;
  xpRequired: number;
  sessionsRequired: number;
  daysRequired: number;
  gemReward: number;
  titleReward: string | null;
  frameReward: string | null;
  auraReward: string | null;
  /** 0..100 — only applies on boss failure. */
  failRetentionPct: number;
}

const boss = (n: number) => [10, 20, 30, 40, 50, 59].includes(n);

const bossTitle = (n: number): string => {
  switch (n) {
    case 10: return "챔피언 자격심사";
    case 20: return "제1방어전";
    case 30: return "제2방어전";
    case 40: return "제3방어전";
    case 50: return "제4방어전";
    case 59: return "그랜드 챔피언";
    default: return `마스터 Lv.${n}`;
  }
};

const bossDescription = (n: number): string => {
  switch (n) {
    case 10: return "마스터 트랙 첫 번째 관문. 통과 시 챔피언 칭호와 영원의 프레임을 획득합니다.";
    case 20:
    case 30:
    case 40:
    case 50: return "챔피언 방어전 — 큰 보상이 기다립니다.";
    case 59: return "그랜드 챔피언 시험. 레전드 칭호가 기다립니다.";
    default: return "마스터 구간 정규 훈련 단계.";
  }
};

const gemsFor = (n: number): number => {
  if (n === 59) return 5000;
  if (n === 50) return 3000;
  if (n === 40) return 2500;
  if (n === 30) return 2000;
  if (n === 20) return 1500;
  if (n === 10) return 1000;
  return 100;
};

const titleFor = (n: number): string | null => {
  if (n === 10) return "champion";
  if (n === 59) return "legend";
  return null;
};

const frameFor = (n: number): string | null => (n === 10 ? "eternal" : null);
const auraFor  = (n: number): string | null => (n === 10 ? "aura_rainbow" : null);

export const MASTER_LEVEL_DEFINITIONS: MasterLevelDefinition[] = Array.from(
  { length: 59 },
  (_, i) => {
    const n = i + 1;
    const isBoss = boss(n);
    return {
      masterLevel: n,
      overallLevel: 40 + n,
      title: bossTitle(n),
      description: bossDescription(n),
      isBoss,
      xpRequired: isBoss ? 2000 : 500,
      sessionsRequired: isBoss ? 12 : 4,
      daysRequired: isBoss ? 21 : 7,
      gemReward: gemsFor(n),
      titleReward: titleFor(n),
      frameReward: frameFor(n),
      auraReward: auraFor(n),
      failRetentionPct: 50,
    };
  },
);

/** O(1) lookup by master_level (1..59). */
export function getMasterLevelDefinition(
  masterLevel: number,
): MasterLevelDefinition | undefined {
  if (masterLevel < 1 || masterLevel > 59) return undefined;
  return MASTER_LEVEL_DEFINITIONS[masterLevel - 1];
}

/** Master levels where a boss battle is required to progress. */
export const MASTER_BOSS_LEVELS: ReadonlyArray<number> = Object.freeze([
  10, 20, 30, 40, 50, 59,
]);

export function isMasterBossLevel(masterLevel: number): boolean {
  return MASTER_BOSS_LEVELS.includes(masterLevel);
}

/** Entry condition mirror of enter_master_track RPC. */
export interface MasterEntryInput {
  current_rank: string;
  current_level: number;
  bosses_cleared?: number;
  master_track_unlocked?: boolean;
}

export function canEnterMasterTrack(input: MasterEntryInput): boolean {
  if (input.master_track_unlocked) return false; // already in
  return (
    input.current_rank === "black" &&
    input.current_level === 10 &&
    (input.bosses_cleared ?? 0) >= 4
  );
}
