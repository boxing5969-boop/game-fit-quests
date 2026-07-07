import { SessionResult, PunchType, TierKey, TIERS, PunchResult } from '@/features/minigame/types/game';

const LEADERBOARD_KEY = 'boxing_leaderboard';
const PLAYER_KEY = 'boxing_player_name';
const PROFILES_KEY = 'boxing_profiles';
const DAILY_KEY = 'boxing_daily_progress';

export interface PlayerProfile {
  name: string;
  highestTier: TierKey;
  promotionDate?: string;
  bestReaction: number;
  bestAvgReaction: number;
  bestScore: number;
  totalPunches: number;
  sessionsCount: number;
  streakDays: number;
  lastSessionDate: string; // YYYY-MM-DD
  challengesCompleted: number;
  challengeStreak: number;
  lastChallengeDate: string;
}

const defaultProfile = (name: string): PlayerProfile => ({
  name,
  highestTier: 'bronze',
  bestReaction: 9999,
  bestAvgReaction: 9999,
  bestScore: 0,
  totalPunches: 0,
  sessionsCount: 0,
  streakDays: 0,
  lastSessionDate: '',
  challengesCompleted: 0,
  challengeStreak: 0,
  lastChallengeDate: '',
});

export function getLeaderboard(): SessionResult[] {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveSession(result: SessionResult): SessionResult[] {
  const board = getLeaderboard();
  board.push(result);
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 30);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top));
  return top;
}

export function getPlayerSessions(name: string): SessionResult[] {
  return getLeaderboard().filter(s => s.playerName === name);
}

export function getSavedPlayerName(): string {
  return localStorage.getItem(PLAYER_KEY) || '';
}

export function savePlayerName(name: string) {
  localStorage.setItem(PLAYER_KEY, name);
}

// ===== Profiles =====

function getProfilesMap(): Record<string, PlayerProfile> {
  try {
    const data = localStorage.getItem(PROFILES_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

function saveProfilesMap(map: Record<string, PlayerProfile>) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
}

export function getProfile(name: string): PlayerProfile {
  const map = getProfilesMap();
  return map[name] || defaultProfile(name);
}

export function saveProfile(profile: PlayerProfile) {
  const map = getProfilesMap();
  map[profile.name] = profile;
  saveProfilesMap(map);
}

const tierRank = (t: TierKey) => TIERS.findIndex(x => x.key === t);

// 로컬(KST) 날짜 — UTC(toISOString)면 새벽 0~9시 플레이가 어제로 붙어 일일 판정이 어긋남.
const todayStr = () => new Date().toLocaleDateString("en-CA");

/**
 * Apply session result to profile. Returns:
 * - promoted: new tier if upgraded
 * - newPB: true if avg reaction improved
 */
export function applySessionToProfile(name: string, result: SessionResult): {
  profile: PlayerProfile;
  promoted: TierKey | null;
  newPB: boolean;
  prevAvg: number;
} {
  const profile = getProfile(name);
  const prevAvg = profile.bestAvgReaction;

  const promoted = tierRank(result.tier) < tierRank(profile.highestTier)
    ? result.tier
    : null;

  const newPB = result.avgReaction < profile.bestAvgReaction;

  // streak
  const today = todayStr();
  let streak = profile.streakDays;
  if (profile.lastSessionDate === today) {
    // same day, no change
  } else if (profile.lastSessionDate) {
    const last = new Date(profile.lastSessionDate);
    const now = new Date(today);
    const diff = Math.round((now.getTime() - last.getTime()) / 86400000);
    streak = diff === 1 ? streak + 1 : 1;
  } else {
    streak = 1;
  }

  const updated: PlayerProfile = {
    ...profile,
    highestTier: promoted || profile.highestTier,
    promotionDate: promoted ? new Date().toISOString() : profile.promotionDate,
    bestReaction: Math.min(profile.bestReaction, result.bestReaction),
    bestAvgReaction: Math.min(profile.bestAvgReaction, result.avgReaction),
    bestScore: Math.max(profile.bestScore, result.score),
    totalPunches: profile.totalPunches + result.totalPunches,
    sessionsCount: profile.sessionsCount + 1,
    streakDays: streak,
    lastSessionDate: today,
  };

  saveProfile(updated);

  return { profile: updated, promoted, newPB, prevAvg };
}

// ===== Daily Challenges =====

export interface DailyChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  descriptionKo: string;
  punchType?: PunchType;
  targetCount?: number;
  targetAvgMs?: number;
  bonusPoints: number;
}

const CHALLENGE_TEMPLATES = [
  { type: 'jab' as PunchType, target: 50, ms: 350, ko: '잽만 50개, 평균 350ms 이하', en: 'Land 50 jabs averaging under 350ms' },
  { type: 'straight' as PunchType, target: 40, ms: 380, ko: '스트레이트 40개, 평균 380ms 이하', en: '40 straights under 380ms avg' },
  { type: 'hook' as PunchType, target: 40, ms: 400, ko: '훅 40개, 평균 400ms 이하', en: '40 hooks under 400ms avg' },
  { type: 'upper' as PunchType, target: 35, ms: 400, ko: '어퍼컷 35개, 평균 400ms 이하', en: '35 uppercuts under 400ms avg' },
  { type: undefined, target: 100, ms: 350, ko: '총 100개 펀치, 평균 350ms 이하', en: '100 total punches under 350ms avg' },
  { type: undefined, target: 80, ms: 0, ko: '정확도 90% 달성 (80개 이상)', en: 'Hit 90% accuracy with 80+ punches' },
];

function dayHash(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
  return h;
}

export function getTodaysChallenge(): DailyChallenge {
  const date = todayStr();
  const idx = dayHash(date) % CHALLENGE_TEMPLATES.length;
  const t = CHALLENGE_TEMPLATES[idx];
  return {
    id: `${date}-${idx}`,
    date,
    description: t.en,
    descriptionKo: t.ko,
    punchType: t.type,
    targetCount: t.target,
    targetAvgMs: t.ms || undefined,
    bonusPoints: 500,
  };
}

interface DailyProgress {
  completedDates: string[]; // YYYY-MM-DD
}

function getDailyProgress(): DailyProgress {
  try {
    const d = localStorage.getItem(DAILY_KEY);
    return d ? JSON.parse(d) : { completedDates: [] };
  } catch { return { completedDates: [] }; }
}

export function isChallengeCompletedToday(): boolean {
  return getDailyProgress().completedDates.includes(todayStr());
}

export function checkChallengeAgainstSession(
  challenge: DailyChallenge,
  results: PunchResult[]
): boolean {
  const correct = results.filter(r => r.correct);
  const filtered = challenge.punchType
    ? correct.filter(r => r.punchType === challenge.punchType)
    : correct;

  if (challenge.targetCount && filtered.length < challenge.targetCount) {
    // accuracy challenge fallback
    if (!challenge.targetAvgMs) {
      const acc = results.length > 0 ? correct.length / results.length : 0;
      return acc >= 0.9 && results.length >= challenge.targetCount;
    }
    return false;
  }

  if (challenge.targetAvgMs && filtered.length > 0) {
    const avg = filtered.reduce((s, r) => s + r.reactionMs, 0) / filtered.length;
    if (avg > challenge.targetAvgMs) return false;
  }

  return true;
}

export function markChallengeCompleted(name: string): { streak: number; total: number } {
  const date = todayStr();
  const prog = getDailyProgress();
  if (!prog.completedDates.includes(date)) {
    prog.completedDates.push(date);
    localStorage.setItem(DAILY_KEY, JSON.stringify(prog));
  }

  const profile = getProfile(name);
  const last = profile.lastChallengeDate;
  let streak = profile.challengeStreak;
  if (last === date) {
    // already counted
  } else if (last) {
    const diff = Math.round((new Date(date).getTime() - new Date(last).getTime()) / 86400000);
    streak = diff === 1 ? streak + 1 : 1;
  } else {
    streak = 1;
  }

  const updated: PlayerProfile = {
    ...profile,
    challengesCompleted: profile.challengesCompleted + (last === date ? 0 : 1),
    challengeStreak: streak,
    lastChallengeDate: date,
  };
  saveProfile(updated);
  return { streak, total: updated.challengesCompleted };
}
