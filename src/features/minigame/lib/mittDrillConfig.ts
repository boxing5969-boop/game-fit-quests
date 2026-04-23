// =====================================================================
// MITT DRILL — STAGE-CLEAR CONFIG
// 무한의계단 스타일: 한 판씩 깨는 구조. ROUND 1은 매우 쉬움(약 20초),
// 라운드가 올라갈수록 시간/속도/패턴 복잡도가 함께 상승.
// =====================================================================

export interface MittRoundConfig {
  round: number;
  durationSec: number;        // 라운드 제한 시간
  spawnIntervalMs: number;    // cue 간격 (작을수록 빠름)
  fallDurationMs: number;     // 미트가 hit-zone 도달 시간 (작을수록 빠름)
  multiSpawnChance: number;   // 같은 시점 동시 스폰 확률 (0~1)
  perfectWindowMs: number;
  goodWindowMs: number;
  energyStart: number;        // 시작 에너지 (대부분 100 고정)
  missPenalty: number;        // 일반 miss 시 -energy
  majorMissPenalty: number;   // 입력 자체가 틀렸을 때 -energy
  perfectRecover: number;     // perfect 시 +energy
  consecutiveMissKO: number;  // n회 연속 miss → instant KO
}

// 시작/끝 값. 라운드 사이는 부드러운 곡선으로 보간.
// ROUND 1~3은 매우 부드럽게, ROUND 4부터 본격 상승.
const BASE = {
  durationSec: { start: 18, end: 55 },
  spawnIntervalMs: { start: 1700, end: 540 },   // ROUND 1 더 여유 있게
  fallDurationMs: { start: 2900, end: 950 },    // ROUND 1 글러브가 더 천천히 떨어짐
  multiSpawnChance: { start: 0, end: 0.5 },
  perfectWindowMs: { start: 260, end: 120 },    // ROUND 1 판정 더 관대
  goodWindowMs: { start: 420, end: 240 },
};

const RAMP_TO_ROUND = 12; // 12라운드까지 본 곡선, 이후엔 천천히 추가 가속

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// 초반 라운드는 거의 변화 없게 → 중반부터 본격 상승하는 ease-in 곡선
function easeInQuad(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c;
}

export function getRoundConfig(round: number): MittRoundConfig {
  const r = Math.max(1, round);
  // ROUND 1~3은 거의 비슷한 난이도 유지 → 4부터 상승 가속
  const t = easeInQuad(Math.min(1, Math.max(0, (r - 1) / (RAMP_TO_ROUND - 1))));

  // 12라운드 이후엔 완만한 추가 가속
  const overflow = Math.max(0, r - RAMP_TO_ROUND);
  const overflowFactor = 1 - Math.min(0.25, overflow * 0.02); // 최대 25% 더 빠르게

  const durationSec = Math.round(lerp(BASE.durationSec.start, BASE.durationSec.end, t) + overflow * 1.5);
  const spawnIntervalMs = Math.round(lerp(BASE.spawnIntervalMs.start, BASE.spawnIntervalMs.end, t) * overflowFactor);
  const fallDurationMs = Math.round(lerp(BASE.fallDurationMs.start, BASE.fallDurationMs.end, t) * overflowFactor);
  // ROUND 1~3은 동시 스폰 완전 차단
  const multiSpawnChance = r <= 3
    ? 0
    : Math.min(0.7, lerp(BASE.multiSpawnChance.start, BASE.multiSpawnChance.end, t) + overflow * 0.015);
  const perfectWindowMs = Math.round(lerp(BASE.perfectWindowMs.start, BASE.perfectWindowMs.end, t));
  const goodWindowMs = Math.round(lerp(BASE.goodWindowMs.start, BASE.goodWindowMs.end, t));

  // 초반 보호 강화: 1~3라운드는 KO 임계 6 → 5 → 5 → 4
  const consecutiveMissKO = r <= 3 ? 6 : r <= 5 ? 5 : 4;

  // 초반엔 패널티 작게, 후반엔 표준
  const missPenalty = r <= 2 ? 5 : r <= 5 ? 9 : 13;
  const majorMissPenalty = r <= 2 ? 8 : r <= 5 ? 14 : 18;
  const perfectRecover = r <= 3 ? 2 : 1;

  return {
    round: r,
    durationSec,
    spawnIntervalMs,
    fallDurationMs,
    multiSpawnChance,
    perfectWindowMs,
    goodWindowMs,
    energyStart: 100,
    missPenalty,
    majorMissPenalty,
    perfectRecover,
    consecutiveMissKO,
  };
}

// ===== 별점 평가 =====
export interface StarRating {
  stars: 1 | 2 | 3;
  label: string;
}

export function evaluateStars(args: {
  cleared: boolean;
  accuracy: number;     // 0~100
  remainingEnergy: number;
}): StarRating | null {
  if (!args.cleared) return null;
  if (args.accuracy >= 90 && args.remainingEnergy >= 50) return { stars: 3, label: 'PERFECT CLEAR' };
  if (args.accuracy >= 75) return { stars: 2, label: 'GREAT CLEAR' };
  return { stars: 1, label: 'CLEAR' };
}

// ===== localStorage keys =====
export const MITT_KEYS = {
  highestCleared: 'mittTraining_highestClearedRound',
  bestScoreByRound: 'mittTraining_bestScoreByRound',
  bestAccuracyByRound: 'mittTraining_bestAccuracyByRound',
  starsByRound: 'mittTraining_starsByRound',                  // { [round]: 1|2|3 }
  firstClearByRound: 'mittTraining_firstClearByRound',        // { [round]: true }
  firstThreeStarByRound: 'mittTraining_firstThreeStarByRound',// { [round]: true }
  totalPerfect: 'mittTraining_totalPerfect',
  totalGames: 'mittTraining_totalGames',
  totalStars: 'mittTraining_totalStars',                      // sum of best stars
} as const;

function readMap<T = number>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function writeMap(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function getHighestClearedRound(): number {
  try { return Number(localStorage.getItem(MITT_KEYS.highestCleared) || '0'); } catch { return 0; }
}

export function setHighestClearedRound(round: number): boolean {
  const cur = getHighestClearedRound();
  if (round > cur) {
    try { localStorage.setItem(MITT_KEYS.highestCleared, String(round)); } catch {}
    return true;
  }
  return false;
}

export function recordRoundBest(round: number, score: number, accuracy: number) {
  const sMap = readMap<number>(MITT_KEYS.bestScoreByRound);
  const aMap = readMap<number>(MITT_KEYS.bestAccuracyByRound);
  const prevBestScore = sMap[round] || 0;
  const prevBestAccuracy = aMap[round] || 0;
  const newBestScore = score > prevBestScore;
  const newBestAcc = accuracy > prevBestAccuracy;
  if (newBestScore) sMap[round] = score;
  if (newBestAcc) aMap[round] = accuracy;
  writeMap(MITT_KEYS.bestScoreByRound, sMap);
  writeMap(MITT_KEYS.bestAccuracyByRound, aMap);
  return { newBestScore, newBestAcc, prevBestScore, prevBestAccuracy };
}

export function getBestScoreForRound(round: number): number {
  return readMap<number>(MITT_KEYS.bestScoreByRound)[round] || 0;
}
export function getBestAccuracyForRound(round: number): number {
  return readMap<number>(MITT_KEYS.bestAccuracyByRound)[round] || 0;
}

// ===== Stars / Mastery =====
export function getStarsForRound(round: number): 0 | 1 | 2 | 3 {
  const v = readMap<number>(MITT_KEYS.starsByRound)[round] || 0;
  return (v as 0 | 1 | 2 | 3);
}

export function getAllStars(): Record<number, 1 | 2 | 3> {
  return readMap(MITT_KEYS.starsByRound) as Record<number, 1 | 2 | 3>;
}

export function getTotalStars(): number {
  const map = getAllStars();
  return Object.values(map).reduce((sum, s) => sum + (s || 0), 0);
}

/** Returns { newRecord, prevStars, isFirstClear, isFirstThreeStar } */
export function recordStars(round: number, stars: 1 | 2 | 3): {
  newRecord: boolean;
  prevStars: 0 | 1 | 2 | 3;
  isFirstClear: boolean;
  isFirstThreeStar: boolean;
} {
  const sMap = readMap<number>(MITT_KEYS.starsByRound);
  const fcMap = readMap<boolean>(MITT_KEYS.firstClearByRound);
  const f3Map = readMap<boolean>(MITT_KEYS.firstThreeStarByRound);
  const prev = (sMap[round] || 0) as 0 | 1 | 2 | 3;

  const isFirstClear = !fcMap[round];
  const isFirstThreeStar = stars === 3 && !f3Map[round];
  const newRecord = stars > prev;

  if (newRecord) {
    sMap[round] = stars;
    writeMap(MITT_KEYS.starsByRound, sMap);
  }
  if (isFirstClear) {
    fcMap[round] = true;
    writeMap(MITT_KEYS.firstClearByRound, fcMap);
  }
  if (isFirstThreeStar) {
    f3Map[round] = true;
    writeMap(MITT_KEYS.firstThreeStarByRound, f3Map);
  }
  return { newRecord, prevStars: prev, isFirstClear, isFirstThreeStar };
}

export function incrementTotals(perfectCount: number) {
  try {
    const tp = Number(localStorage.getItem(MITT_KEYS.totalPerfect) || '0') + perfectCount;
    const tg = Number(localStorage.getItem(MITT_KEYS.totalGames) || '0') + 1;
    localStorage.setItem(MITT_KEYS.totalPerfect, String(tp));
    localStorage.setItem(MITT_KEYS.totalGames, String(tg));
  } catch {}
}

// ===== Hint for failed round =====
export function getFailHint(args: {
  round: number;
  accuracy: number;
  perfectCount: number;
  missCount: number;
  remainingEnergy: number;
  reason: 'time-up' | 'ko-energy' | 'ko-streak';
}): string {
  if (args.reason === 'ko-streak') {
    return '연속 미스를 줄이면 KO를 피할 수 있어요.';
  }
  if (args.reason === 'ko-energy') {
    if (args.missCount >= 5) return `MISS를 ${Math.max(2, args.missCount - 3)}회만 줄여도 클리어 가능해요.`;
    return 'PERFECT를 더 노리면 에너지가 회복돼요.';
  }
  // time-up but not cleared
  if (args.accuracy < 60) return '판정을 놓치지 말고 끝까지 글러브에 집중!';
  if (args.accuracy < 75) return `정확도 75% 넘기면 ⭐⭐를 받을 수 있어요.`;
  if (args.accuracy < 90) return `정확도 90% + 에너지 50 이상이면 ⭐⭐⭐!`;
  return '한 번만 더 시도하면 클리어!';
}
