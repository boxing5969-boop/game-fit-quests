// =================================================
// Reaction Trainer (Endless) — Balance constants
// "무한의계단" 스타일: 초반 매우 쉬움 → 시간이 갈수록 단계적 상승
// 한 곳에서 난이도/연출/보상 값을 모두 조절하세요.
// =================================================

export const REACTION_CONFIG = {
  // ----- 난이도 곡선 (시간 기반, ms 단위) -----
  // 시간 구간별 cue 간격(ms): currentCueInterval 이 직접 보간해서 사용
  cueIntervalCurve: [
    { t: 0,   ms: 1400 },
    { t: 15,  ms: 1200 },
    { t: 30,  ms: 1000 },
    { t: 45,  ms: 850  },
    { t: 60,  ms: 740  },
    { t: 90,  ms: 660  },
    { t: 120, ms: 600  },
    { t: 180, ms: 540  },
  ],
  // 시간 구간별 반응 허용 시간(ms)
  reactionWindowCurve: [
    { t: 0,   ms: 1600 },
    { t: 15,  ms: 1350 },
    { t: 30,  ms: 1100 },
    { t: 45,  ms: 900  },
    { t: 60,  ms: 780  },
    { t: 90,  ms: 700  },
    { t: 120, ms: 640  },
    { t: 180, ms: 580  },
  ],

  /** success → 다음 cue 까지 추가 대기 (피드백 표시 시간). 매우 짧게! */
  postSuccessDelayMs: 110,
  /** miss → 다음 cue 까지 (조금 더 길게) */
  postMissDelayMs: 700,

  // ----- 판정 윈도우 (시간 기반 - 초반 관대, 후반 빡빡) -----
  // perfect/good 윈도우(ms)도 시간에 따라 좁아짐
  perfectWindowCurve: [
    { t: 0,   ms: 220 },
    { t: 20,  ms: 200 },
    { t: 45,  ms: 170 },
    { t: 90,  ms: 150 },
  ],
  goodWindowCurve: [
    { t: 0,   ms: 380 },
    { t: 20,  ms: 320 },
    { t: 45,  ms: 280 },
    { t: 90,  ms: 250 },
  ],

  /** 피버 모드 동안 윈도우 살짝 완화 (배수) */
  feverWindowBonus: 1.15,
  /** 피버 동안 화면 템포 (1 = 동일, <1 = 슬로우) */
  feverSlowFactor: 0.92,

  // ----- 라운드 구조 -----
  /** 라운드 클리어에 필요한 성공 반응 횟수 */
  roundClearTarget: 5,

  // ----- 라운드 기반 난이도 (요청: 1~5라운드는 3초까지 OK) -----
  /** 초보 라운드(1~5): 반응 윈도우를 매우 관대하게 */
  beginnerRoundUntil: 5,
  beginnerReactionWindowMs: 3000,
  beginnerPerfectWindowMs: 1200,
  beginnerGoodWindowMs: 2200,
  /** 6라운드부터 라운드당 윈도우 감소량 (ms) */
  reactionWindowDecayPerRound: 180,
  perfectWindowDecayPerRound: 70,
  goodWindowDecayPerRound: 130,
  /** 윈도우 하한선 */
  minReactionWindowMs: 520,
  minPerfectWindowMs: 140,
  minGoodWindowMs: 240,

  // ----- 콤보 / 피버 -----
  feverTriggerPerfectCount: 7,
  feverDurationMs: 4500,
  feverScoreMultiplier: 2,

  // ----- 쉴드(보호 아이템) -----
  /** round 클리어 시 첫 쉴드 확정 지급 라운드 */
  firstGuaranteedShieldRound: 2,
  /** 이후 라운드 클리어 시 쉴드 드롭 확률 */
  shieldDropChance: 0.18,
  /** 동시에 보유 가능한 최대 쉴드 수 */
  maxShieldCount: 1,
  /** 쉴드 발동 후 무적 시간 (ms) */
  reviveInvincibleMs: 800,

  // ----- 첫 플레이 보호(튜토리얼) -----
  /** 첫 플레이일 때 시작 쉴드(목숨) 수 */
  firstPlayStartShields: 5,
  /** 첫 플레이일 때 동시 보유 가능 쉴드 상한 */
  firstPlayMaxShields: 5,
  /** 첫 플레이일 때 cue 간격 배수 (1보다 크면 더 느림) */
  firstPlayTempoMultiplier: 1.6,
  /** 첫 플레이일 때 반응 윈도우 배수 (1보다 크면 더 관대) */
  firstPlayWindowMultiplier: 1.5,

  // ----- 패턴 등장 시작 시간 (elapsed sec) -----
  // 초반에는 함정 패턴 일절 없음 → 학습 구간 보장
  fakeCueStartTime: 35,    // 페이크 cue
  burstCueStartTime: 50,   // 짧은 연속 burst
  delayedCueStartTime: 25, // 의도적으로 살짝 늦게

  /** 패턴 비중 (시간이 갈수록 fake/burst 비중 증가) */
  patternWeights: {
    early:  { normal: 1.00, fast: 0.00, delayed: 0.00, fake: 0.00, burst: 0.00 }, // 0~20s
    warmup: { normal: 0.85, fast: 0.10, delayed: 0.05, fake: 0.00, burst: 0.00 }, // 20~30s
    mid:    { normal: 0.55, fast: 0.20, delayed: 0.15, fake: 0.06, burst: 0.04 }, // 30~45s
    late:   { normal: 0.35, fast: 0.25, delayed: 0.15, fake: 0.13, burst: 0.12 }, // 45s+
  },

  // ----- 점수 -----
  pointsPerfect: 100,
  pointsGood:    50,
  pointsMiss:    -10,

  // ----- 일일 보상 -----
  dailyGemPerSession: 5,
  dailyGemBonusRound5: 10,
  dailyGemBonusFever:  5,
} as const;

/** 시간 구간 곡선에서 elapsed 에 해당하는 값을 선형 보간 */
function interpolateCurve(curve: ReadonlyArray<{ t: number; ms: number }>, elapsedSec: number): number {
  if (elapsedSec <= curve[0].t) return curve[0].ms;
  for (let i = 0; i < curve.length - 1; i++) {
    const cur = curve[i];
    const next = curve[i + 1];
    if (elapsedSec >= cur.t && elapsedSec < next.t) {
      const ratio = (elapsedSec - cur.t) / (next.t - cur.t);
      return cur.ms + (next.ms - cur.ms) * ratio;
    }
  }
  return curve[curve.length - 1].ms;
}

/** 현재 elapsed + round 에 따른 cue 대기 시간 (ms) */
export function currentCueInterval(elapsedSec: number, feverActive: boolean, firstPlay = false, round = 1): number {
  // 초보 라운드: cue 간격을 매우 여유롭게 (사용자 요청 — 천천히 등장)
  if (round <= REACTION_CONFIG.beginnerRoundUntil) {
    const beginnerInterval = 1800 - (round - 1) * 80; // R1: 1800ms, R5: 1480ms
    return firstPlay ? beginnerInterval * REACTION_CONFIG.firstPlayTempoMultiplier : beginnerInterval;
  }
  const base = interpolateCurve(REACTION_CONFIG.cueIntervalCurve, elapsedSec);
  const fevered = feverActive ? base / REACTION_CONFIG.feverSlowFactor : base;
  return firstPlay ? fevered * REACTION_CONFIG.firstPlayTempoMultiplier : fevered;
}

/** 현재 round 에 따른 반응 허용 시간 (ms). 1~5R은 3초 보장. */
export function currentReactionWindow(elapsedSec: number, feverActive: boolean, firstPlay = false, round = 1): number {
  if (round <= REACTION_CONFIG.beginnerRoundUntil) {
    return REACTION_CONFIG.beginnerReactionWindowMs;
  }
  const overRounds = round - REACTION_CONFIG.beginnerRoundUntil;
  const base = Math.max(
    REACTION_CONFIG.minReactionWindowMs,
    REACTION_CONFIG.beginnerReactionWindowMs - REACTION_CONFIG.beginnerReactionWindowMs * 0.4 // R6 시작 = 1800ms
      - (overRounds - 1) * REACTION_CONFIG.reactionWindowDecayPerRound,
  );
  const fevered = feverActive ? base * REACTION_CONFIG.feverWindowBonus : base;
  return firstPlay ? fevered * REACTION_CONFIG.firstPlayWindowMultiplier : fevered;
}

/** 현재 round 에 따른 perfect 판정 윈도우 (ms) */
export function currentPerfectWindow(elapsedSec: number, feverActive: boolean, firstPlay = false, round = 1): number {
  if (round <= REACTION_CONFIG.beginnerRoundUntil) {
    return REACTION_CONFIG.beginnerPerfectWindowMs;
  }
  const overRounds = round - REACTION_CONFIG.beginnerRoundUntil;
  const base = Math.max(
    REACTION_CONFIG.minPerfectWindowMs,
    600 - (overRounds - 1) * REACTION_CONFIG.perfectWindowDecayPerRound,
  );
  const fevered = feverActive ? base * REACTION_CONFIG.feverWindowBonus : base;
  return firstPlay ? fevered * REACTION_CONFIG.firstPlayWindowMultiplier : fevered;
}

/** 현재 round 에 따른 good 판정 윈도우 (ms) */
export function currentGoodWindow(elapsedSec: number, feverActive: boolean, firstPlay = false, round = 1): number {
  if (round <= REACTION_CONFIG.beginnerRoundUntil) {
    return REACTION_CONFIG.beginnerGoodWindowMs;
  }
  const overRounds = round - REACTION_CONFIG.beginnerRoundUntil;
  const base = Math.max(
    REACTION_CONFIG.minGoodWindowMs,
    1100 - (overRounds - 1) * REACTION_CONFIG.goodWindowDecayPerRound,
  );
  const fevered = feverActive ? base * REACTION_CONFIG.feverWindowBonus : base;
  return firstPlay ? fevered * REACTION_CONFIG.firstPlayWindowMultiplier : fevered;
}

export type CuePattern = 'normal' | 'fast' | 'delayed' | 'fake' | 'burst';

/** elapsed + round 에 따라 다음 cue 패턴을 무작위로 선택 */
export function pickCuePattern(elapsedSec: number, firstPlay = false, round = 1): CuePattern {
  // 첫 플레이는 항상 normal 패턴만 (함정/속도 패턴 차단)
  if (firstPlay) return 'normal';
  // 초보 라운드(1~5)도 항상 normal 패턴만
  if (round <= REACTION_CONFIG.beginnerRoundUntil) return 'normal';
  const w =
    elapsedSec < 20 ? REACTION_CONFIG.patternWeights.early  :
    elapsedSec < 30 ? REACTION_CONFIG.patternWeights.warmup :
    elapsedSec < 45 ? REACTION_CONFIG.patternWeights.mid    :
    REACTION_CONFIG.patternWeights.late;

  const entries = Object.entries(w) as [CuePattern, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return 'normal';
}

/** 라운드별 배경 톤 (HSL hue 기준 + 강조 컬러 토큰) */
export const ROUND_THEMES = [
  { hue: 0,   name: 'WARMUP',   accent: 'hsl(220 80% 60%)' }, // round 1-2
  { hue: 280, name: 'NEON',     accent: 'hsl(280 80% 65%)' }, // round 3-4
  { hue: 200, name: 'ICE',      accent: 'hsl(195 90% 60%)' }, // round 5-6
  { hue: 30,  name: 'SUNSET',   accent: 'hsl(30 95% 60%)'  }, // round 7-9
  { hue: 350, name: 'INFERNO',  accent: 'hsl(350 90% 60%)' }, // round 10+
] as const;

export function getRoundTheme(round: number) {
  if (round >= 10) return ROUND_THEMES[4];
  if (round >= 7)  return ROUND_THEMES[3];
  if (round >= 5)  return ROUND_THEMES[2];
  if (round >= 3)  return ROUND_THEMES[1];
  return ROUND_THEMES[0];
}
