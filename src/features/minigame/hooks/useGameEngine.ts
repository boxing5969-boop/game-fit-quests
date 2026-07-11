import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PunchType, SessionResult, GamePhase, TIERS, getTier,
} from '@/features/minigame/types/game';
import { CueResult, EndlessSession, ReactionJudgement } from '@/features/minigame/types/reaction';
import {
  REACTION_CONFIG, currentCueInterval, currentReactionWindow,
  currentPerfectWindow, currentGoodWindow,
  pickCuePattern, getRoundTheme,
} from '@/features/minigame/lib/reactionConfig';
import {
  getEndlessStats, applyEndlessRun, EndlessApplyResult,
} from '@/features/minigame/lib/reactionStorage';
import { savePlayerName } from '@/features/minigame/lib/storage';
import { audio, vibrate } from '@/features/minigame/lib/audio';

const PUNCH_TYPES: PunchType[] = ['jab', 'straight', 'hook', 'upper'];

function randomPunch(prev?: PunchType): PunchType {
  let next: PunchType;
  do { next = PUNCH_TYPES[Math.floor(Math.random() * 4)]; } while (next === prev);
  return next;
}

export interface SessionExtras {
  // endless 전용
  bestRound: number;
  bestScore: number;
  bestSurvival: number;
  newBestScore: boolean;
  newBestRound: boolean;
  newBestSurvival: boolean;
  perfectCount: number;
  feverCount: number;
  shieldSaveCount: number;
  survivalSec: number;
  gemsEarned: number;
  totalGems: number;
  reachedRound: number;
  // 결과화면 호환용 (예전 컴포넌트들이 쓰던 필드)
  promotedTier: typeof TIERS[number] | null;
  newPB: boolean;
  prevAvg: number;
  reportCard: any;
  challengeCompleted: boolean;
  challenge: any;
  challengeStreak: number;
  bonusPoints: number;
  ghostBaseline: number;
  allResults: CueResult[];
}

export function useGameEngine() {
  const hasSeenIntro = useRef(typeof window !== 'undefined' && localStorage.getItem('mitt_intro_seen') === '1');
  const [phase, setPhase] = useState<GamePhase>(hasSeenIntro.current ? 'home' : 'intro');
  const [playerName, setPlayerName] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [currentPunch, setCurrentPunch] = useState<PunchType | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [lastResult, setLastResult] = useState<CueResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [sessionExtras, setSessionExtras] = useState<SessionExtras | null>(null);
  const [wrongShake, setWrongShake] = useState(0);
  const [paused, setPaused] = useState(false);

  // endless live state
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [round, setRound] = useState(1);
  const [successesInRound, setSuccessesInRound] = useState(0);
  const [shields, setShields] = useState(0);
  const [feverActive, setFeverActive] = useState(false);
  const [feverProgress, setFeverProgress] = useState(0); // 0..1 시각용
  const [elapsedSec, setElapsedSec] = useState(0);
  const [shieldSavedFlash, setShieldSavedFlash] = useState(0);
  const [roundClearFlash, setRoundClearFlash] = useState(0);
  const [feverEnterFlash, setFeverEnterFlash] = useState(0);
  const [bestRoundLive, setBestRoundLive] = useState(0);
  const [bestScoreLive, setBestScoreLive] = useState(0);

  const session = useRef<EndlessSession>(createSession());
  const allResults = useRef<CueResult[]>([]);
  const cueShownAt = useRef(0);
  const cueExpireTimer = useRef<ReturnType<typeof setTimeout>>();
  const nextCueTimer = useRef<ReturnType<typeof setTimeout>>();
  const elapsedTimer = useRef<ReturnType<typeof setInterval>>();
  const feverTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownTimerRef = useRef<ReturnType<typeof setInterval>>();
  const invincibleUntil = useRef(0);
  const prevPunch = useRef<PunchType>();
  const pausedRef = useRef(false);
  const burstQueue = useRef<PunchType[]>([]);
  const fakePending = useRef(false);
  const isFirstPlay = useRef(false);

  function createSession(): EndlessSession {
    return {
      score: 0, round: 1, bestRoundReached: 1, successesInRound: 0,
      combo: 0, comboPeak: 0, shields: 0,
      feverActive: false, feverEndsAt: 0, perfectStreakForFever: 0,
      totalCues: 0, perfectCount: 0, goodCount: 0, missCount: 0,
      feverCount: 0, shieldSaveCount: 0,
      startedAt: 0, survivalSec: 0,
    };
  }

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const clearAllTimers = useCallback(() => {
    clearTimeout(cueExpireTimer.current);
    clearTimeout(nextCueTimer.current);
    clearTimeout(feverTimer.current);
    clearInterval(elapsedTimer.current);
    clearInterval(countdownTimerRef.current);
  }, []);

  const finishSession = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();

    const s = session.current;
    s.survivalSec = (performance.now() - s.startedAt) / 1000;

    // 젬: 기본 + 라운드 도달 + 피버 보너스 + 점수 보너스
    const gemsEarned =
      REACTION_CONFIG.dailyGemPerSession +
      (s.bestRoundReached >= 5 ? REACTION_CONFIG.dailyGemBonusRound5 : 0) +
      s.feverCount * REACTION_CONFIG.dailyGemBonusFever +
      Math.floor(s.score / 1000);

    const apply: EndlessApplyResult = applyEndlessRun({
      score: s.score,
      round: s.bestRoundReached,
      survivalSec: s.survivalSec,
      perfectCount: s.perfectCount,
      feverCount: s.feverCount,
      shieldSaveCount: s.shieldSaveCount,
      gemsEarned,
    });

    // SessionResult 호환 객체 (ResultsScreen 의 useAutoSaveScore 등에 그대로 사용됨)
    const correctResults = allResults.current.filter(r => r.correct);
    const reactionTimes = correctResults.map(r => r.reactionMs);
    const avg = reactionTimes.length > 0 ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 999;
    const best = reactionTimes.length > 0 ? Math.min(...reactionTimes) : 999;
    const breakdown: Record<PunchType, number> = { jab: 0, straight: 0, hook: 0, upper: 0 };
    correctResults.forEach(r => { breakdown[r.punchType]++; });

    const result: SessionResult = {
      playerName,
      score: s.score,
      avgReaction: Math.round(avg),
      bestReaction: Math.round(best),
      totalPunches: allResults.current.length,
      accuracy: allResults.current.length > 0
        ? Math.round((correctResults.length / allResults.current.length) * 100)
        : 0,
      comboPeak: s.comboPeak,
      roundScores: [s.score],
      punchBreakdown: breakdown,
      date: new Date().toISOString(),
      tier: getTier(avg).key,
    };

    const extras: SessionExtras = {
      bestRound: Math.max(apply.prevBestRound, s.bestRoundReached),
      bestScore: Math.max(apply.prevBestScore, s.score),
      bestSurvival: Math.max(apply.prevBestSurvival, Math.round(s.survivalSec)),
      newBestScore: apply.newBestScore,
      newBestRound: apply.newBestRound,
      newBestSurvival: apply.newBestSurvival,
      perfectCount: s.perfectCount,
      feverCount: s.feverCount,
      shieldSaveCount: s.shieldSaveCount,
      survivalSec: s.survivalSec,
      gemsEarned,
      totalGems: apply.totalGems,
      reachedRound: s.bestRoundReached,
      // legacy compat fields
      promotedTier: null,
      newPB: apply.newBestScore,
      prevAvg: 0,
      reportCard: null,
      challengeCompleted: false,
      challenge: { id: '', date: '', description: '', descriptionKo: '', bonusPoints: 0 },
      challengeStreak: 0,
      bonusPoints: 0,
      ghostBaseline: 0,
      allResults: allResults.current,
    };

    setSessionResult(result);
    setSessionExtras(extras);
    setCurrentPunch(null);
    setShowFeedback(false);
    setWaiting(false);
    audio.fanfare();
    setPhase('results');
  }, [playerName, clearAllTimers]);

  // ===== Cue scheduling (endless 핵심 루프) =====

  const scheduleNextCue = useCallback((delayMs?: number) => {
    if (pausedRef.current) return;
    clearTimeout(nextCueTimer.current);
    const interval = delayMs ?? currentCueInterval(elapsedSecRef.current, session.current.feverActive, isFirstPlay.current, session.current.round);

    nextCueTimer.current = setTimeout(() => {
      if (pausedRef.current) return;

      // burst 큐가 있으면 그걸 우선 소비
      if (burstQueue.current.length > 0) {
        const p = burstQueue.current.shift()!;
        showCue(p, 'burst');
        return;
      }

      const pattern = pickCuePattern(elapsedSecRef.current, isFirstPlay.current, session.current.round);

      if (pattern === 'burst' && elapsedSecRef.current >= REACTION_CONFIG.burstCueStartTime) {
        // 2~3개의 짧은 연속
        const len = 2 + Math.floor(Math.random() * 2);
        const queue: PunchType[] = [];
        let prev = prevPunch.current;
        for (let i = 0; i < len; i++) {
          const p = randomPunch(prev);
          queue.push(p);
          prev = p;
        }
        const first = queue.shift()!;
        burstQueue.current = queue;
        showCue(first, 'burst');
        return;
      }

      const p = randomPunch(prevPunch.current);
      showCue(p, pattern);
    }, interval);
  }, []);

  const elapsedSecRef = useRef(0);

  const showCue = useCallback((punch: PunchType, pattern: 'normal' | 'fast' | 'delayed' | 'fake' | 'burst') => {
    if (pausedRef.current) return;
    prevPunch.current = punch;
    setShowFeedback(false);
    setWaiting(true);

    // fake: 200ms 후 사라지고 새 cue 등장 (반응하면 오답 취급 X — 그냥 사라짐)
    if (pattern === 'fake' && elapsedSecRef.current >= REACTION_CONFIG.fakeCueStartTime) {
      fakePending.current = true;
      setCurrentPunch(punch);
      cueShownAt.current = performance.now();
      clearTimeout(cueExpireTimer.current);
      cueExpireTimer.current = setTimeout(() => {
        fakePending.current = false;
        setCurrentPunch(null);
        scheduleNextCue(180);
      }, 180);
      return;
    }

    fakePending.current = false;

    // delayed: cue 보이기 전 짧은 빈 화면
    const showDelay = pattern === 'delayed' ? 250 : 0;
    setTimeout(() => {
      if (pausedRef.current) return;
      setCurrentPunch(punch);
      cueShownAt.current = performance.now();

      // 반응 윈도우 내에 입력 없으면 miss
      const window = currentReactionWindow(elapsedSecRef.current, session.current.feverActive, isFirstPlay.current, session.current.round)
        * (pattern === 'fast' ? 0.85 : 1);
      clearTimeout(cueExpireTimer.current);
      cueExpireTimer.current = setTimeout(() => {
        if (pausedRef.current) return;
        if (currentPunchRef.current === punch) {
          handleMissTimeout(punch, pattern);
        }
      }, window);
    }, showDelay);
  }, [scheduleNextCue]);

  const currentPunchRef = useRef<PunchType | null>(null);
  useEffect(() => { currentPunchRef.current = currentPunch; }, [currentPunch]);

  // ===== 입력 처리 =====

  const handleMissTimeout = useCallback((punch: PunchType, pattern: 'normal' | 'fast' | 'delayed' | 'fake' | 'burst') => {
    handleJudgement(punch, pattern, 'miss', 9999, false);
  }, []);

  const handleJudgement = useCallback((
    punch: PunchType,
    pattern: 'normal' | 'fast' | 'delayed' | 'fake' | 'burst',
    judgement: ReactionJudgement,
    reactionMs: number,
    correct: boolean,
  ) => {
    const s = session.current;

    // 무적 시간 동안의 miss는 무효
    if (judgement === 'miss' && performance.now() < invincibleUntil.current) {
      return;
    }

    let points = 0;
    if (judgement === 'perfect') points = REACTION_CONFIG.pointsPerfect;
    else if (judgement === 'good') points = REACTION_CONFIG.pointsGood;
    else points = REACTION_CONFIG.pointsMiss;

    if (s.feverActive && points > 0) points *= REACTION_CONFIG.feverScoreMultiplier;

    const isMiss = judgement === 'miss';

    // 쉴드 발동
    if (isMiss && s.shields > 0) {
      s.shields--;
      s.shieldSaveCount++;
      setShields(s.shields);
      setShieldSavedFlash(f => f + 1);
      invincibleUntil.current = performance.now() + REACTION_CONFIG.reviveInvincibleMs;
      audio.cheer();
      vibrate([40, 30, 40]);
      // combo 리셋이 아닌 절반 감소
      s.combo = Math.floor(s.combo / 2);
      setCombo(s.combo);
      s.perfectStreakForFever = 0;
      // 피드백 표시
      const result: CueResult = {
        punchType: punch, pattern, reactionMs, judgement: 'miss', correct: false,
        points: 0, combo: s.combo, feverActive: s.feverActive,
        round: s.round, timestamp: Date.now(),
      };
      allResults.current.push(result);
      setLastResult(result);
      setShowFeedback(true);
      setCurrentPunch(null);
      clearTimeout(cueExpireTimer.current);
      setTimeout(() => {
        if (pausedRef.current) return;
        scheduleNextCue(REACTION_CONFIG.reviveInvincibleMs);
      }, 600);
      return;
    }

    if (isMiss) {
      // GAME OVER
      audio.miss();
      vibrate([80, 40, 80]);
      setWrongShake(w => w + 1);
      const result: CueResult = {
        punchType: punch, pattern, reactionMs, judgement: 'miss', correct: false,
        points: REACTION_CONFIG.pointsMiss, combo: 0, feverActive: s.feverActive,
        round: s.round, timestamp: Date.now(),
      };
      allResults.current.push(result);
      setLastResult(result);
      setShowFeedback(true);
      setCurrentPunch(null);
      clearTimeout(cueExpireTimer.current);
      setTimeout(() => finishSession(), 700);
      return;
    }

    // 성공
    s.score += points;
    s.combo++;
    if (s.combo > s.comboPeak) s.comboPeak = s.combo;
    if (judgement === 'perfect') {
      s.perfectCount++;
      s.perfectStreakForFever++;
      audio.perfectHit();
      vibrate(25);
    } else {
      s.goodCount++;
      s.perfectStreakForFever = 0;
      audio.punch();
      vibrate(15);
    }
    s.successesInRound++;
    s.totalCues++;

    // 라운드 클리어
    if (s.successesInRound >= REACTION_CONFIG.roundClearTarget) {
      s.successesInRound = 0;
      s.round++;
      if (s.round > s.bestRoundReached) s.bestRoundReached = s.round;
      setRoundClearFlash(f => f + 1);
      audio.bell();
      // 쉴드 드롭 (첫 플레이는 상한이 더 높음)
      const shieldCap = isFirstPlay.current
        ? REACTION_CONFIG.firstPlayMaxShields
        : REACTION_CONFIG.maxShieldCount;
      const guaranteed = s.round - 1 === REACTION_CONFIG.firstGuaranteedShieldRound;
      const dropped = guaranteed || Math.random() < REACTION_CONFIG.shieldDropChance;
      if (dropped && s.shields < shieldCap) {
        s.shields++;
        setShields(s.shields);
      }
    }

    // 피버 진입
    if (!s.feverActive && s.perfectStreakForFever >= REACTION_CONFIG.feverTriggerPerfectCount) {
      s.feverActive = true;
      s.feverEndsAt = performance.now() + REACTION_CONFIG.feverDurationMs;
      s.feverCount++;
      setFeverActive(true);
      setFeverEnterFlash(f => f + 1);
      audio.cheer();
      audio.fanfare();
      vibrate([20, 30, 20, 30, 60]);
      clearTimeout(feverTimer.current);
      feverTimer.current = setTimeout(() => {
        s.feverActive = false;
        setFeverActive(false);
        s.perfectStreakForFever = 0;
      }, REACTION_CONFIG.feverDurationMs);
    }

    // 상태 업데이트
    setScore(s.score);
    setCombo(s.combo);
    setSuccessesInRound(s.successesInRound);
    setRound(s.round);

    const result: CueResult = {
      punchType: punch, pattern, reactionMs, judgement, correct: true,
      points, combo: s.combo, feverActive: s.feverActive,
      round: s.round, timestamp: Date.now(),
    };
    allResults.current.push(result);
    setLastResult(result);
    setShowFeedback(true);
    setCurrentPunch(null);
    clearTimeout(cueExpireTimer.current);

    // success → 거의 즉시 다음 cue (피드백은 짧게 깜빡)
    const nextDelay = burstQueue.current.length > 0
      ? 90
      : REACTION_CONFIG.postSuccessDelayMs;
    scheduleNextCue(nextDelay);
  }, [scheduleNextCue, finishSession]);

  const handlePunch = useCallback((type: PunchType) => {
    if (pausedRef.current) return;
    if (!currentPunchRef.current || showFeedbackRef.current) return;

    const cue = currentPunchRef.current;
    const reactionMs = performance.now() - cueShownAt.current;
    const correct = type === cue;

    // fake cue: 어떤 입력이든 무효 (페널티 없음)
    if (fakePending.current) return;

    if (!correct) {
      handleJudgement(cue, 'normal', 'miss', reactionMs, false);
      return;
    }

    const perfectMs = currentPerfectWindow(elapsedSecRef.current, session.current.feverActive, isFirstPlay.current, session.current.round);
    const goodMs    = currentGoodWindow(elapsedSecRef.current, session.current.feverActive, isFirstPlay.current, session.current.round);
    const judgement: ReactionJudgement =
      reactionMs <= perfectMs ? 'perfect' :
      reactionMs <= goodMs    ? 'good'    : 'miss';

    handleJudgement(cue, 'normal', judgement, reactionMs, judgement !== 'miss');
  }, [handleJudgement]);

  const showFeedbackRef = useRef(false);
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);

  // ===== 카운트다운 → playing =====

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);
    audio.beep(false);
    let n = 3;
    countdownTimerRef.current = setInterval(() => {
      n--;
      if (n > 0) { audio.beep(false); setCountdown(n); }
      else if (n === 0) { audio.beep(true); setCountdown(0); }
      else {
        clearInterval(countdownTimerRef.current);
        audio.bell();
        beginPlaying();
      }
    }, 700);
  }, []);

  const beginPlaying = useCallback(() => {
    session.current = createSession();
    session.current.startedAt = performance.now();
    allResults.current = [];
    burstQueue.current = [];
    prevPunch.current = undefined;
    fakePending.current = false;
    invincibleUntil.current = 0;
    elapsedSecRef.current = 0;

    // 첫 플레이 감지: 누적 게임 수 0이면 튜토리얼 모드
    const stats = getEndlessStats();
    isFirstPlay.current = stats.totalGames === 0;
    const startShields = isFirstPlay.current ? REACTION_CONFIG.firstPlayStartShields : 0;
    session.current.shields = startShields;

    setScore(0); setCombo(0); setRound(1); setSuccessesInRound(0);
    setShields(startShields); setFeverActive(false); setElapsedSec(0); setFeverProgress(0);
    setLastResult(null); setShowFeedback(false); setCurrentPunch(null);

    setPhase('playing');
    audio.startBgm(2);

    // elapsed 타이머
    clearInterval(elapsedTimer.current);
    elapsedTimer.current = setInterval(() => {
      if (pausedRef.current) return;
      const s = session.current;
      const now = performance.now();
      elapsedSecRef.current = (now - s.startedAt) / 1000;
      setElapsedSec(elapsedSecRef.current);
      // fever progress 시각용
      if (s.feverActive) {
        const remain = Math.max(0, (s.feverEndsAt - now) / REACTION_CONFIG.feverDurationMs);
        setFeverProgress(remain);
      } else {
        setFeverProgress(0);
      }
    }, 100);

    scheduleNextCue(800);
  }, [scheduleNextCue]);

  const startGame = useCallback((name: string) => {
    setPlayerName(name);
    savePlayerName(name);
    const stats = getEndlessStats();
    setBestRoundLive(stats.bestRound);
    setBestScoreLive(stats.bestScore);
    setSessionExtras(null);
    setSessionResult(null);
    startCountdown();
  }, [startCountdown]);

  // ===== Pause / Resume / Quit =====

  const pauseGame = useCallback(() => {
    if (phase !== 'playing') return;
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    clearTimeout(cueExpireTimer.current);
    clearTimeout(nextCueTimer.current);
    audio.stopBgm();
  }, [phase]);

  const resumeGame = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    audio.startBgm(2);
    // 화면에 cue 가 남아있으면 그대로 두고 expire 만 다시 건다
    if (currentPunchRef.current) {
      const window = currentReactionWindow(elapsedSecRef.current, session.current.feverActive, isFirstPlay.current, session.current.round);
      const elapsedSinceShow = performance.now() - cueShownAt.current;
      const remain = Math.max(150, window - elapsedSinceShow);
      cueExpireTimer.current = setTimeout(() => {
        if (currentPunchRef.current) {
          handleMissTimeout(currentPunchRef.current, 'normal');
        }
      }, remain);
    } else {
      scheduleNextCue(400);
    }
  }, [scheduleNextCue, handleMissTimeout]);

  const quitToMenu = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();
    pausedRef.current = false;
    setPaused(false);
    setCurrentPunch(null);
    setShowFeedback(false);
    setWaiting(false);
    setPhase('home');
  }, [clearAllTimers]);

  const goHome = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();
    setPhase('home');
  }, [clearAllTimers]);

  const goToRanking = useCallback(() => setPhase('ranking'), []);
  const goToName = useCallback(() => setPhase('name'), []);
  const dismissIntro = useCallback(() => {
    localStorage.setItem('mitt_intro_seen', '1');
    hasSeenIntro.current = true;
    setPhase('home');
  }, []);
  const dismissPromotion = useCallback(() => setPhase('results'), []);

  const restartGame = useCallback(() => {
    const name = playerName;
    clearAllTimers();
    audio.stopBgm();
    pausedRef.current = false;
    setPaused(false);
    if (name) startGame(name);
    else setPhase('home');
  }, [playerName, clearAllTimers, startGame]);

  useEffect(() => () => { clearAllTimers(); audio.stopBgm(); }, [clearAllTimers]);

  const theme = getRoundTheme(round);

  return {
    // phase / nav
    phase, playerName, countdown,
    startGame, goHome, goToRanking, goToName, dismissPromotion, dismissIntro,
    pauseGame, resumeGame, quitToMenu, restartGame,
    // playing state
    currentPunch, waiting, lastResult, showFeedback, paused, wrongShake,
    currentScore: score, currentCombo: combo,
    round, successesInRound, roundTarget: REACTION_CONFIG.roundClearTarget,
    shields, feverActive, feverProgress, elapsedSec,
    shieldSavedFlash, roundClearFlash, feverEnterFlash,
    bestRoundLive, bestScoreLive, theme,
    onPunch: () => {}, // legacy noop
    handlePunch,
    // results
    sessionResult, sessionExtras,
    // legacy compat fields used elsewhere
    currentRound: round,
    roundTime: 0, restTime: 0,
    ghostBaseline: 0, ghostDelta: 0, showPromotion: false,
  };
}
