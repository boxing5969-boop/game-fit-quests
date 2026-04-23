// Boxing Defense Rush — 일일 통계 / 미션 / 젬 (localStorage)
// 시간 기반 생존형으로 전환됨
import { DailyMission } from '@/features/minigame/types/defense';
import { DEFENSE_CONFIG } from './defenseConfig';

const KEY = 'boxing_defense_state_v2';
const LEGACY_KEY = 'boxing_defense_state_v1';

interface DefenseState {
  date: string;                    // YYYY-MM-DD
  bestSeconds: number;             // 역대 최고 생존(초)
  bestScore: number;               // 역대 최고 점수
  bestRound: number;               // 역대 최고 라운드
  todayBestSeconds: number;
  todayBestScore: number;
  todayBestRound: number;
  todayGems: number;
  totalGems: number;
  perfectsToday: number;
  countersToday: number;
  bossClearsToday: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyState(): DefenseState {
  return {
    date: todayKey(),
    bestSeconds: 0,
    bestScore: 0,
    bestRound: 0,
    todayBestSeconds: 0,
    todayBestScore: 0,
    todayBestRound: 0,
    todayGems: 0,
    totalGems: 0,
    perfectsToday: 0,
    countersToday: 0,
    bossClearsToday: 0,
  };
}

function load(): DefenseState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<DefenseState>;
      const base: DefenseState = { ...emptyState(), ...s, date: s.date ?? todayKey() };
      if (base.date !== todayKey()) {
        return {
          ...base,
          date: todayKey(),
          todayBestSeconds: 0,
          todayBestScore: 0,
          todayBestRound: 0,
          todayGems: 0,
          perfectsToday: 0,
          countersToday: 0,
          bossClearsToday: 0,
        };
      }
      return base;
    }
    // Migrate legacy v1 → bestScore only
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      return { ...emptyState(), bestScore: old.bestScore ?? 0, totalGems: old.totalGems ?? 0 };
    }
  } catch {}
  return emptyState();
}

function save(s: DefenseState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getDefenseState() { return load(); }

export interface RunSummary {
  finalScore: number;
  survivedSeconds: number;
  perfects: number;
  counters: number;
  bossClears: number;
  roundReached: number;
}

export function recordRun(r: RunSummary, gemsEarned: number) {
  const s = load();
  const prevBestSeconds = s.bestSeconds;
  const prevBestScore = s.bestScore;
  const prevBestRound = s.bestRound;
  s.bestSeconds = Math.max(s.bestSeconds, r.survivedSeconds);
  s.bestScore = Math.max(s.bestScore, r.finalScore);
  s.bestRound = Math.max(s.bestRound, r.roundReached);
  s.todayBestSeconds = Math.max(s.todayBestSeconds, r.survivedSeconds);
  s.todayBestScore = Math.max(s.todayBestScore, r.finalScore);
  s.todayBestRound = Math.max(s.todayBestRound, r.roundReached);
  s.perfectsToday += r.perfects;
  s.countersToday += r.counters;
  s.bossClearsToday += r.bossClears;

  const remainingCap = Math.max(0, DEFENSE_CONFIG.dailyGemCap - s.todayGems);
  const granted = Math.min(gemsEarned, remainingCap);
  s.todayGems += granted;
  s.totalGems += granted;
  save(s);
  return {
    state: s,
    gemsGranted: granted,
    gemsCapped: granted < gemsEarned,
    prevBestSeconds,
    prevBestScore,
    prevBestRound,
  };
}

export function getDailyMissions(): DailyMission[] {
  const s = load();
  const defs = [
    { id: 'survive45', label: '45초 이상 생존', goal: 45, current: s.todayBestSeconds },
    { id: 'perfect15', label: 'PERFECT 15회 누적', goal: 15, current: s.perfectsToday },
    { id: 'boss2',     label: 'BOSS 2회 클리어', goal: 2, current: s.bossClearsToday },
  ];
  return defs.map(d => ({ ...d, done: d.current >= d.goal }));
}
