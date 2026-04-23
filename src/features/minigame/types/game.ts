export type PunchType = 'jab' | 'straight' | 'hook' | 'upper';

export interface PunchCommand {
  type: PunchType;
  emoji: string;
  nameKo: string;
  nameEn: string;
  color: string;
}

export const PUNCHES: Record<PunchType, PunchCommand> = {
  jab:      { type: 'jab',      emoji: '👊', nameKo: '잽',       nameEn: 'JAB',      color: 'punch-jab' },
  straight: { type: 'straight', emoji: '🤜', nameKo: '스트레이트', nameEn: 'STRAIGHT', color: 'punch-straight' },
  hook:     { type: 'hook',     emoji: '🥊', nameKo: '훅',       nameEn: 'HOOK',     color: 'punch-hook' },
  upper:    { type: 'upper',    emoji: '⬆️', nameKo: '어퍼컷',    nameEn: 'UPPER',    color: 'punch-upper' },
};

export type ReactionRating = 'lightning' | 'fast' | 'good' | 'slow' | 'miss';

export interface RatingInfo {
  key: ReactionRating;
  emoji: string;
  nameKo: string;
  nameEn: string;
  color: string;
  points: number;
  maxMs: number;
}

export const RATINGS: RatingInfo[] = [
  { key: 'lightning', emoji: '⚡', nameKo: '번개', nameEn: 'LIGHTNING', color: 'rating-lightning', points: 100, maxMs: 200 },
  { key: 'fast',      emoji: '✅', nameKo: '빠름', nameEn: 'FAST',      color: 'rating-fast',      points: 75,  maxMs: 350 },
  { key: 'good',      emoji: '👍', nameKo: '좋음', nameEn: 'GOOD',      color: 'rating-good',      points: 50,  maxMs: 500 },
  { key: 'slow',      emoji: '🐢', nameKo: '느림', nameEn: 'SLOW',      color: 'rating-slow',      points: 25,  maxMs: 700 },
  { key: 'miss',      emoji: '❌', nameKo: '미스', nameEn: 'MISS',      color: 'rating-miss',      points: -10, maxMs: Infinity },
];

export function getRating(ms: number): RatingInfo {
  return RATINGS.find(r => ms < r.maxMs) || RATINGS[RATINGS.length - 1];
}

export function getComboMultiplier(combo: number): number {
  if (combo >= 20) return 3.0;
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  return 1.0;
}

export interface PunchResult {
  punchType: PunchType;
  reactionMs: number;
  rating: ReactionRating;
  correct: boolean;
  points: number;
  combo: number;
  multiplier: number;
  round: number;
  timestamp: number;
}

export interface SessionResult {
  playerName: string;
  score: number;
  avgReaction: number;
  bestReaction: number;
  totalPunches: number;
  accuracy: number;
  comboPeak: number;
  roundScores: number[];
  punchBreakdown: Record<PunchType, number>;
  date: string;
  tier: TierKey;
}

export type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legend';

export interface TierInfo {
  key: TierKey;
  emoji: string;
  nameKo: string;
  nameEn: string;
  color: string;
  maxAvgMs: number;
}

export const TIERS: TierInfo[] = [
  { key: 'legend',   emoji: '⚡', nameKo: '레전드',     nameEn: 'Legend',   color: 'tier-legend',   maxAvgMs: 250 },
  { key: 'platinum', emoji: '💎', nameKo: '챔피언',     nameEn: 'Platinum', color: 'tier-platinum', maxAvgMs: 350 },
  { key: 'gold',     emoji: '🥇', nameKo: '프로 복서',   nameEn: 'Gold',     color: 'tier-gold',     maxAvgMs: 450 },
  { key: 'silver',   emoji: '🥈', nameKo: '프로 지망생', nameEn: 'Silver',   color: 'tier-silver',   maxAvgMs: 600 },
  { key: 'bronze',   emoji: '🥉', nameKo: '아마추어',   nameEn: 'Bronze',   color: 'tier-bronze',   maxAvgMs: Infinity },
];

export function getTier(avgMs: number): TierInfo {
  return TIERS.find(t => avgMs < t.maxAvgMs) || TIERS[TIERS.length - 1];
}

export type GamePhase = 'intro' | 'home' | 'name' | 'countdown' | 'playing' | 'rest' | 'promotion' | 'results' | 'ranking';
