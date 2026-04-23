import { SessionResult, PunchResult, PunchType, PUNCHES } from '@/features/minigame/types/game';

export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface RadarStats {
  speed: number;       // 0-100
  accuracy: number;    // 0-100
  consistency: number; // 0-100
  combo: number;       // 0-100
  stamina: number;     // 0-100
}

export interface ReportCard {
  grade: LetterGrade;
  totalScore: number; // 0-100
  stats: RadarStats;
  weaknessKo: string;
  weaknessEn: string;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/**
 * Speed: 0ms → 100, 700ms → 0
 */
function scoreSpeed(avg: number): number {
  return clamp(100 - (avg / 7));
}

/**
 * Consistency: lower stddev of reaction times = better
 */
function scoreConsistency(times: number[]): number {
  if (times.length < 2) return 50;
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length;
  const std = Math.sqrt(variance);
  // 0ms std → 100, 250ms std → 0
  return clamp(100 - (std / 2.5));
}

/**
 * Combo: peak combo 30+ = 100
 */
function scoreCombo(peak: number): number {
  return clamp((peak / 30) * 100);
}

/**
 * Stamina: compare avg reaction in last round vs first round.
 * No degradation = 100, +200ms degradation = 0
 */
function scoreStamina(results: PunchResult[]): number {
  const r1 = results.filter(r => r.round === 1 && r.correct);
  const r3 = results.filter(r => r.round === 3 && r.correct);
  if (r1.length === 0 || r3.length === 0) return 70;
  const avg1 = r1.reduce((s, r) => s + r.reactionMs, 0) / r1.length;
  const avg3 = r3.reduce((s, r) => s + r.reactionMs, 0) / r3.length;
  const diff = avg3 - avg1;
  return clamp(100 - (diff / 2));
}

function letterGrade(score: number): LetterGrade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const PUNCH_LABEL_KO: Record<PunchType, string> = {
  jab: '잽', straight: '스트레이트', hook: '훅', upper: '어퍼컷',
};

export function buildReportCard(result: SessionResult, allResults: PunchResult[]): ReportCard {
  const correct = allResults.filter(r => r.correct);
  const times = correct.map(r => r.reactionMs);

  const stats: RadarStats = {
    speed: scoreSpeed(result.avgReaction),
    accuracy: result.accuracy,
    consistency: scoreConsistency(times),
    combo: scoreCombo(result.comboPeak),
    stamina: scoreStamina(allResults),
  };

  const totalScore = (stats.speed + stats.accuracy + stats.consistency + stats.combo + stats.stamina) / 5;

  // Find weakest punch type
  const punchAvgs: { type: PunchType; avg: number; count: number }[] = [];
  (['jab', 'straight', 'hook', 'upper'] as PunchType[]).forEach(type => {
    const ts = correct.filter(r => r.punchType === type).map(r => r.reactionMs);
    if (ts.length > 0) {
      const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
      punchAvgs.push({ type, avg, count: ts.length });
    }
  });

  let weaknessKo = '훌륭한 전반적 성과! 약점이 보이지 않습니다.';
  let weaknessEn = 'Excellent overall — no clear weakness.';

  if (punchAvgs.length >= 2) {
    const overallAvg = result.avgReaction;
    const slowest = punchAvgs.sort((a, b) => b.avg - a.avg)[0];
    const diff = Math.round(slowest.avg - overallAvg);
    if (diff > 30) {
      weaknessKo = `오늘의 약점: ${PUNCH_LABEL_KO[slowest.type]} 반응속도가 평균보다 ${diff}ms 느립니다.`;
      weaknessEn = `Weak spot: ${PUNCHES[slowest.type].nameEn} reactions are ${diff}ms slower than your average.`;
    } else if (stats.consistency < 50) {
      weaknessKo = '오늘의 약점: 반응속도 일관성이 부족합니다. 호흡을 안정시키세요.';
      weaknessEn = 'Weak spot: Reaction consistency is low. Steady your breathing.';
    } else if (stats.stamina < 60) {
      weaknessKo = '오늘의 약점: 후반 라운드 체력 저하. 지구력 훈련이 필요합니다.';
      weaknessEn = 'Weak spot: Stamina drops in later rounds. Build endurance.';
    } else if (result.accuracy < 90) {
      weaknessKo = '오늘의 약점: 정확도가 낮습니다. 속도보다 정확함을 우선하세요.';
      weaknessEn = 'Weak spot: Accuracy is low. Precision before speed.';
    }
  }

  return {
    grade: letterGrade(totalScore),
    totalScore: Math.round(totalScore),
    stats,
    weaknessKo,
    weaknessEn,
  };
}

export function buildShareText(name: string, result: SessionResult, card: ReportCard): string {
  return [
    `🥊 BOXING REACTION TRAINER`,
    `Fighter: ${name}`,
    `Grade: ${card.grade}  |  Score: ${result.score}`,
    `Avg Reaction: ${result.avgReaction}ms  |  Best: ${result.bestReaction}ms`,
    `Accuracy: ${result.accuracy}%  |  Peak Combo: ${result.comboPeak}`,
    `Tier: ${result.tier.toUpperCase()}`,
    ``,
    `도전해보세요!`,
  ].join('\n');
}
