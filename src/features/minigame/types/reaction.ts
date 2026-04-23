import { PunchType } from './game';
import { CuePattern } from '@/features/minigame/lib/reactionConfig';

export type ReactionJudgement = 'perfect' | 'good' | 'miss';

export interface CueResult {
  punchType: PunchType;
  pattern: CuePattern;
  reactionMs: number;     // 9999 if miss
  judgement: ReactionJudgement;
  correct: boolean;
  points: number;
  combo: number;
  feverActive: boolean;
  round: number;
  timestamp: number;
}

export interface EndlessSession {
  score: number;
  round: number;
  bestRoundReached: number;
  successesInRound: number;
  combo: number;
  comboPeak: number;
  shields: number;
  feverActive: boolean;
  feverEndsAt: number;
  perfectStreakForFever: number;

  // Aggregates
  totalCues: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  feverCount: number;
  shieldSaveCount: number;

  // timing
  startedAt: number;
  survivalSec: number;
}
