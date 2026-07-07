// Endless Reaction Trainer — local storage helpers

const K = {
  bestScore:     'reactionTraining_bestScore',
  bestRound:     'reactionTraining_bestRound',
  bestSurvival:  'reactionTraining_bestSurvivalSec',
  todayBest:     'reactionTraining_todayBestScore',
  todayDate:     'reactionTraining_todayDate',
  totalPerfect:  'reactionTraining_totalPerfect',
  totalGames:    'reactionTraining_totalGames',
  totalGems:     'reactionTraining_totalGems',
  dailyGem:      'reactionTraining_dailyGemEarned',
  dailyGemDate:  'reactionTraining_dailyGemDate',
} as const;

// 로컬(KST) 날짜 — UTC(toISOString)면 새벽 0~9시 플레이가 어제로 붙어 일일 젬 한도가 어긋남.
const todayStr = () => new Date().toLocaleDateString("en-CA");

const num = (v: string | null) => (v ? Number(v) || 0 : 0);

export interface EndlessStats {
  bestScore: number;
  bestRound: number;
  bestSurvivalSec: number;
  todayBestScore: number;
  totalPerfect: number;
  totalGames: number;
  totalGems: number;
  dailyGemEarnedToday: number;
}

export function getEndlessStats(): EndlessStats {
  if (typeof window === 'undefined') {
    return {
      bestScore: 0, bestRound: 0, bestSurvivalSec: 0, todayBestScore: 0,
      totalPerfect: 0, totalGames: 0, totalGems: 0, dailyGemEarnedToday: 0,
    };
  }
  // today 자동 리셋
  const today = todayStr();
  if (localStorage.getItem(K.todayDate) !== today) {
    localStorage.setItem(K.todayDate, today);
    localStorage.setItem(K.todayBest, '0');
  }
  if (localStorage.getItem(K.dailyGemDate) !== today) {
    localStorage.setItem(K.dailyGemDate, today);
    localStorage.setItem(K.dailyGem, '0');
  }
  return {
    bestScore:        num(localStorage.getItem(K.bestScore)),
    bestRound:        num(localStorage.getItem(K.bestRound)),
    bestSurvivalSec:  num(localStorage.getItem(K.bestSurvival)),
    todayBestScore:   num(localStorage.getItem(K.todayBest)),
    totalPerfect:     num(localStorage.getItem(K.totalPerfect)),
    totalGames:       num(localStorage.getItem(K.totalGames)),
    totalGems:        num(localStorage.getItem(K.totalGems)),
    dailyGemEarnedToday: num(localStorage.getItem(K.dailyGem)),
  };
}

export interface EndlessRunSummary {
  score: number;
  round: number;
  survivalSec: number;
  perfectCount: number;
  feverCount: number;
  shieldSaveCount: number;
  gemsEarned: number;
}

export interface EndlessApplyResult {
  newBestScore: boolean;
  newBestRound: boolean;
  newBestSurvival: boolean;
  prevBestScore: number;
  prevBestRound: number;
  prevBestSurvival: number;
  totalGems: number;
}

export function applyEndlessRun(run: EndlessRunSummary): EndlessApplyResult {
  const prev = getEndlessStats();

  const newBestScore    = run.score > prev.bestScore;
  const newBestRound    = run.round > prev.bestRound;
  const newBestSurvival = run.survivalSec > prev.bestSurvivalSec;

  if (newBestScore)    localStorage.setItem(K.bestScore,    String(run.score));
  if (newBestRound)    localStorage.setItem(K.bestRound,    String(run.round));
  if (newBestSurvival) localStorage.setItem(K.bestSurvival, String(Math.round(run.survivalSec)));

  // today best
  if (run.score > prev.todayBestScore) {
    localStorage.setItem(K.todayBest, String(run.score));
  }

  localStorage.setItem(K.totalPerfect, String(prev.totalPerfect + run.perfectCount));
  localStorage.setItem(K.totalGames,   String(prev.totalGames + 1));
  const newTotalGems = prev.totalGems + run.gemsEarned;
  localStorage.setItem(K.totalGems,    String(newTotalGems));
  localStorage.setItem(K.dailyGem,     String(prev.dailyGemEarnedToday + run.gemsEarned));

  return {
    newBestScore, newBestRound, newBestSurvival,
    prevBestScore:    prev.bestScore,
    prevBestRound:    prev.bestRound,
    prevBestSurvival: prev.bestSurvivalSec,
    totalGems:        newTotalGems,
  };
}
