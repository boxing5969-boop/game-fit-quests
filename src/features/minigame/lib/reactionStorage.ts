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

// 저장소가 막힌 환경(사파리 프라이빗·용량 초과)에서 throw 가 결과 화면 전환을 막지 않게 — 읽기는 null, 쓰기는 조용히 포기
const getItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const setItem = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 게임은 계속 */ } };

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
  if (getItem(K.todayDate) !== today) {
    setItem(K.todayDate, today);
    setItem(K.todayBest, '0');
  }
  if (getItem(K.dailyGemDate) !== today) {
    setItem(K.dailyGemDate, today);
    setItem(K.dailyGem, '0');
  }
  return {
    bestScore:        num(getItem(K.bestScore)),
    bestRound:        num(getItem(K.bestRound)),
    bestSurvivalSec:  num(getItem(K.bestSurvival)),
    todayBestScore:   num(getItem(K.todayBest)),
    totalPerfect:     num(getItem(K.totalPerfect)),
    totalGames:       num(getItem(K.totalGames)),
    totalGems:        num(getItem(K.totalGems)),
    dailyGemEarnedToday: num(getItem(K.dailyGem)),
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

  if (newBestScore)    setItem(K.bestScore,    String(run.score));
  if (newBestRound)    setItem(K.bestRound,    String(run.round));
  if (newBestSurvival) setItem(K.bestSurvival, String(Math.round(run.survivalSec)));

  // today best
  if (run.score > prev.todayBestScore) {
    setItem(K.todayBest, String(run.score));
  }

  setItem(K.totalPerfect, String(prev.totalPerfect + run.perfectCount));
  setItem(K.totalGames,   String(prev.totalGames + 1));
  const newTotalGems = prev.totalGems + run.gemsEarned;
  setItem(K.totalGems,    String(newTotalGems));
  setItem(K.dailyGem,     String(prev.dailyGemEarnedToday + run.gemsEarned));

  return {
    newBestScore, newBestRound, newBestSurvival,
    prevBestScore:    prev.bestScore,
    prevBestRound:    prev.bestRound,
    prevBestSurvival: prev.bestSurvivalSec,
    totalGems:        newTotalGems,
  };
}
