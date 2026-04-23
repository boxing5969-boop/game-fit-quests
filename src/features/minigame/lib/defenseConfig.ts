// Boxing Defense Rush — 시간 기반 난이도 곡선
// 무한의계단처럼 "처음 쉽고 점점 어려워지는" 무한 생존형
// 모든 밸런스 수치는 여기서 한 곳에서 조정

export const DEFENSE_CONFIG = {
  // ===== 타이밍 윈도우 =====
  perfectWindowMs: 230,
  goodWindowMs: 430,

  // ===== 텔레그래프 (도착까지 걸리는 시간) =====
  // 구간별 멀티플라이어로 점점 짧아지게 됨
  jabTelegraphMs: 1000,
  hookTelegraphMs: 700,
  feintTelegraphMs: 880,
  feintCancelRatio: 0.55,
  rushTelegraphMs: 560,

  // ===== 점수 =====
  scoreGood: 1,
  scorePerfect: 2,
  scoreCounterHit: 1,
  scoreBossClear: 10,

  // ===== 콤보 / 카운터 =====
  counterTriggerCombo: 5,
  counterDurationMs: 2200,
  counterMaxHits: 8,

  // ===== 보스 러시 (시간 기준) =====
  // 30s, 60s, 90s, 120s, 150s ...
  bossRushStartTimes: [30_000, 60_000, 90_000, 120_000, 150_000, 180_000],
  bossPatternLength: 6,
  bossIntervalMs: 480,

  // ===== 입력 =====
  inputCooldownMs: 80,

  // ===== 라운드 시스템 =====
  // 방어 성공(perfect/good) 10회마다 1라운드 클리어
  roundClearTarget: 10,
  roundClearBannerMs: 950,        // ROUND CLEAR 배너 시간
  roundClearHitstopMs: 220,       // 짧은 슬로모/줌

  // ===== 보호 아이템 (HEADGEAR) =====
  firstGuaranteedShieldRound: 2,  // 라운드 2 클리어 시 확정 지급
  shieldDropChance: 0.18,         // 이후 라운드 클리어 시 18% 드롭
  maxShieldCount: 1,              // 동시에 최대 보유 1개
  reviveInvincibleMs: 800,        // 부활 직후 무적 시간
  reviveComboPenalty: 'reset' as 'reset' | 'half', // 콤보 처리

  // ===== 피버 모드 =====
  feverTriggerPerfectCount: 7,    // perfect 7연속 → fever
  feverDurationMs: 4500,          // 4.5초 유지
  feverScoreMultiplier: 2,        // 점수 x2
  feverSlowFactor: 0.88,          // 공격 간격을 1/0.88 ≈ 1.14배로 늘려 12% 슬로우

  // ===== Focus / Adrenaline 아이템 =====
  focusDurationMs: 5000,          // perfect window 확장 5초
  focusPerfectWindowBonus: 110,   // 추가 ms
  focusDropChance: 0.10,          // 라운드 클리어 시 10%
  adrenalineDurationMs: 3000,
  adrenalineSlowFactor: 0.82,     // 공격 간격 1/0.82 ≈ 1.22배 슬로우
  adrenalineDropChance: 0.08,
  itemDropEarliestRound: 3,       // 라운드 3 클리어부터 Focus/Adrenaline 드롭 가능

  // ===== 난이도 스텝 직후 완충 시간 =====
  graceWindowAfterStepMs: 2500,

  // ===== 시간 기반 난이도 곡선 =====
  // tier 진입 시점(ms), 공격 간격, 텔레그래프 배율, 패턴 가중치
  // intervalMs = 다음 공격까지의 평균 간격
  // teleScale = 모든 텔레그래프(jab/hook/...)에 곱하는 배율 (작을수록 빨라짐)
  // weights: jab/hook/feint/rush 등장 확률
  difficultyTiers: [
    {
      label: 'WARMUP',     atMs: 0,      intervalMs: 1500, teleScale: 1.10, sideAlternateBias: 0.45,
      weights: { jab: 1.0, hook: 0,    feint: 0,    rush: 0 },
    },
    {
      label: 'EASY',       atMs: 10_000, intervalMs: 1300, teleScale: 1.05, sideAlternateBias: 0.55,
      weights: { jab: 1.0, hook: 0,    feint: 0,    rush: 0 },
    },
    {
      label: 'STEADY',     atMs: 20_000, intervalMs: 1100, teleScale: 1.00, sideAlternateBias: 0.65,
      weights: { jab: 0.85, hook: 0.15, feint: 0,    rush: 0 },
    },
    {
      label: 'HEATING UP', atMs: 30_000, intervalMs: 950,  teleScale: 0.95, sideAlternateBias: 0.65,
      weights: { jab: 0.65, hook: 0.30, feint: 0.05, rush: 0 },
    },
    {
      label: 'INTENSE',    atMs: 45_000, intervalMs: 820,  teleScale: 0.88, sideAlternateBias: 0.7,
      weights: { jab: 0.50, hook: 0.30, feint: 0.15, rush: 0.05 },
    },
    {
      label: 'PRO',        atMs: 60_000, intervalMs: 700,  teleScale: 0.82, sideAlternateBias: 0.7,
      weights: { jab: 0.40, hook: 0.30, feint: 0.20, rush: 0.10 },
    },
    {
      label: 'MASTER',     atMs: 90_000, intervalMs: 600,  teleScale: 0.78, sideAlternateBias: 0.7,
      weights: { jab: 0.35, hook: 0.30, feint: 0.20, rush: 0.15 },
    },
    {
      label: 'LEGEND',     atMs: 120_000, intervalMs: 540, teleScale: 0.74, sideAlternateBias: 0.7,
      weights: { jab: 0.30, hook: 0.30, feint: 0.20, rush: 0.20 },
    },
    {
      label: 'INFINITY',   atMs: 150_000, intervalMs: 500, teleScale: 0.72, sideAlternateBias: 0.7,
      weights: { jab: 0.25, hook: 0.30, feint: 0.20, rush: 0.25 },
    },
  ],

  // ===== 마일스톤 배너 (시간 돌파 축하) =====
  milestonesMs: [30_000, 45_000, 60_000, 90_000, 120_000],

  // ===== 젬 보상 (생존 시간 기반) =====
  gemRewards: [
    { minSeconds: 90, gems: 30 },
    { minSeconds: 60, gems: 20 },
    { minSeconds: 45, gems: 15 },
    { minSeconds: 30, gems: 10 },
    { minSeconds: 15, gems: 5 },
  ],
  dailyGemCap: 60,
} as const;

export interface DifficultyTier {
  label: string;
  atMs: number;
  intervalMs: number;
  teleScale: number;
  sideAlternateBias: number;
  weights: { jab: number; hook: number; feint: number; rush: number };
}

export function getDifficultyTier(elapsedMs: number): DifficultyTier {
  const tiers = DEFENSE_CONFIG.difficultyTiers as readonly DifficultyTier[];
  let current: DifficultyTier = tiers[0];
  for (const t of tiers) {
    if (elapsedMs >= t.atMs) current = t;
    else break;
  }
  return current;
}

/** Returns the tier index AND ms-since-entering it (used for grace window). */
export function getTierProgress(elapsedMs: number) {
  const tiers = DEFENSE_CONFIG.difficultyTiers;
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (elapsedMs >= tiers[i].atMs) idx = i;
    else break;
  }
  const tier = tiers[idx];
  return { tier, idx, msInTier: elapsedMs - tier.atMs };
}

// ===== 등급 (생존 시간 기준) =====
export const DEFENSE_TIERS = [
  { key: 'legend',   minSeconds: 90, emoji: '⚡', label: 'LEGEND',   ko: '레전드',     glow: 'rgba(168,85,247,0.6)' },
  { key: 'platinum', minSeconds: 60, emoji: '💎', label: 'PLATINUM', ko: '챔피언',     glow: 'rgba(56,189,248,0.6)' },
  { key: 'gold',     minSeconds: 45, emoji: '🥇', label: 'GOLD',     ko: '프로 디펜더', glow: 'rgba(250,204,21,0.6)' },
  { key: 'silver',   minSeconds: 25, emoji: '🥈', label: 'SILVER',   ko: '디펜더',     glow: 'rgba(203,213,225,0.5)' },
  { key: 'bronze',   minSeconds: 0,  emoji: '🥉', label: 'BRONZE',   ko: '아마추어',   glow: 'rgba(180,83,9,0.5)' },
] as const;

export function getDefenseTier(scoreOrSeconds: number) {
  // 호환: 인자가 score인지 seconds인지 모호 — 호출부에서 seconds 전달 권장
  return DEFENSE_TIERS.find(t => scoreOrSeconds >= t.minSeconds) ?? DEFENSE_TIERS[DEFENSE_TIERS.length - 1];
}

export function getDefenseTierBySeconds(seconds: number) {
  return DEFENSE_TIERS.find(t => seconds >= t.minSeconds) ?? DEFENSE_TIERS[DEFENSE_TIERS.length - 1];
}

export function getGemReward(seconds: number): number {
  for (const r of DEFENSE_CONFIG.gemRewards) if (seconds >= r.minSeconds) return r.gems;
  return 0;
}

// ===== 시간대별 적 테마 =====
export interface OpponentTheme {
  key: string;
  name: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  glow: string;
  minSeconds: number;
}
export const OPPONENT_THEMES: OpponentTheme[] = [
  { key: 'rookie',  name: 'ROOKIE',   emoji: '🥊', bgFrom: 'hsl(0 25% 8%)',    bgTo: 'hsl(0 0% 3%)',  glow: 'rgba(220,38,38,0.35)', minSeconds: 0   },
  { key: 'street',  name: 'BRAWLER',  emoji: '👊', bgFrom: 'hsl(280 30% 10%)', bgTo: 'hsl(0 0% 3%)',  glow: 'rgba(168,85,247,0.4)',  minSeconds: 20  },
  { key: 'pro',     name: 'PRO',      emoji: '🥋', bgFrom: 'hsl(220 35% 10%)', bgTo: 'hsl(0 0% 3%)',  glow: 'rgba(59,130,246,0.45)', minSeconds: 45  },
  { key: 'champ',   name: 'CHAMPION', emoji: '👑', bgFrom: 'hsl(45 50% 12%)',  bgTo: 'hsl(0 0% 3%)',  glow: 'rgba(250,204,21,0.5)',  minSeconds: 75  },
  { key: 'legend',  name: 'LEGEND',   emoji: '⚡', bgFrom: 'hsl(300 50% 14%)', bgTo: 'hsl(0 0% 3%)',  glow: 'rgba(236,72,153,0.55)', minSeconds: 110 },
];
export function getOpponentTheme(seconds: number): OpponentTheme {
  for (let i = OPPONENT_THEMES.length - 1; i >= 0; i--) {
    if (seconds >= OPPONENT_THEMES[i].minSeconds) return OPPONENT_THEMES[i];
  }
  return OPPONENT_THEMES[0];
}

// ===== 라운드별 boxer 스타일 =====
// 각 스타일은 패턴 가중치를 살짝 조정해 'jab type', 'hook type' 등의 느낌을 줌
export interface BoxerStyle {
  key: string;
  name: string;        // ex. JABBER
  ko: string;
  accent: string;      // tailwind text-* 또는 hsl
  weightBias: { jab?: number; hook?: number; feint?: number; rush?: number };
  minRound: number;
}

export const BOXER_STYLES: BoxerStyle[] = [
  { key: 'rookie',   name: 'ROOKIE',   ko: '신인',     accent: 'text-foreground',   weightBias: {},                                       minRound: 1 },
  { key: 'jabber',   name: 'JABBER',   ko: '잽 전문',   accent: 'text-primary',      weightBias: { jab: 1.4 },                              minRound: 3 },
  { key: 'hooker',   name: 'HOOKER',   ko: '훅 마스터', accent: 'text-amber-400',    weightBias: { hook: 1.6, jab: 0.7 },                   minRound: 5 },
  { key: 'trickster',name: 'TRICKSTER',ko: '페인트',   accent: 'text-fuchsia-400',  weightBias: { feint: 2.0, jab: 0.8 },                  minRound: 7 },
  { key: 'rusher',   name: 'RUSHER',   ko: '연타',     accent: 'text-rose-400',     weightBias: { rush: 1.8, hook: 1.2, jab: 0.6 },        minRound: 9 },
  { key: 'phantom',  name: 'PHANTOM',  ko: '환영',     accent: 'text-secondary',    weightBias: { feint: 1.6, rush: 1.4, hook: 1.2 },      minRound: 12 },
];

export function getBoxerStyle(round: number): BoxerStyle {
  for (let i = BOXER_STYLES.length - 1; i >= 0; i--) {
    if (round >= BOXER_STYLES[i].minRound) return BOXER_STYLES[i];
  }
  return BOXER_STYLES[0];
}

/** 기본 tier weights에 boxer style bias를 곱해 최종 가중치 산출 */
export function applyStyleBias(
  base: { jab: number; hook: number; feint: number; rush: number },
  style: BoxerStyle,
): { jab: number; hook: number; feint: number; rush: number } {
  return {
    jab:   Math.max(0, base.jab   * (style.weightBias.jab   ?? 1)),
    hook:  Math.max(0, base.hook  * (style.weightBias.hook  ?? 1)),
    feint: Math.max(0, base.feint * (style.weightBias.feint ?? 1)),
    rush:  Math.max(0, base.rush  * (style.weightBias.rush  ?? 1)),
  };
}
