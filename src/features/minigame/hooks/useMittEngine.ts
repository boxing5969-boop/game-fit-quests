import { useState, useRef, useCallback, useEffect } from 'react';
import { PunchType } from '@/features/minigame/types/game';
import { MittSessionResult, DrillResult, StepResult } from '@/features/minigame/types/mittDrill';
import { savePlayerName } from '@/features/minigame/lib/storage';
import { audio, vibrate } from '@/features/minigame/lib/audio';
import {
  getRoundConfig,
  evaluateStars,
  StarRating,
  getHighestClearedRound,
  setHighestClearedRound,
  recordRoundBest,
  incrementTotals,
  recordStars,
  getStarsForRound,
  getBestScoreForRound,
  getBestAccuracyForRound,
  getFailHint,
} from '@/features/minigame/lib/mittDrillConfig';

export type MittPhase =
  | 'home'
  | 'name'
  | 'countdown'
  | 'playing'
  | 'ending'   // finalize 처리 중 (중복 호출 방지)
  | 'clear'    // 라운드 클리어 모달 (NEXT)
  | 'fail'    // 라운드 실패 모달 (RETRY)
  | 'results'; // 전체 세션 종료 (HOME / RETRY)

export interface FallingGlove {
  id: number;
  punch: PunchType;
  lane: number;       // 0..3
  spawnedAt: number;  // performance.now()
  duration: number;   // ms from spawn to hit-zone center
  hit: boolean;
  missed: boolean;
  result?: 'perfect' | 'good' | 'miss';
}

export interface MittSessionExtras {
  perfectPct: number;
  drillResults: DrillResult[];
  stagesCleared: number;
}

export interface RoundOutcome {
  round: number;
  cleared: boolean;
  reason: 'time-up' | 'ko-energy' | 'ko-streak' | null;
  score: number;
  accuracy: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  remainingEnergy: number;
  stars: StarRating | null;
  newBest: boolean;          // 최고 라운드 갱신
  newStarRecord: boolean;    // 라운드 별점 신기록
  prevStars: 0 | 1 | 2 | 3;  // 이 라운드 이전 별점
  isFirstClear: boolean;
  isFirstThreeStar: boolean;
  newBestScore: boolean;
  newBestAccuracy: boolean;
  bestScore: number;
  bestAccuracy: number;
  failHint?: string;
}

const PUNCHES_LIST: PunchType[] = ['jab', 'straight', 'hook', 'upper'];
const STAGE_END_GRACE_MS = 1000;

export function useMittEngine() {
  const [phase, setPhase] = useState<MittPhase>('home');
  const [playerName, setPlayerName] = useState('');
  const [currentStage, setCurrentStage] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [stageTime, setStageTime] = useState(20);
  const [paused, setPaused] = useState(false);

  const [gloves, setGloves] = useState<FallingGlove[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [lastResult, setLastResult] = useState<{ rating: 'perfect' | 'good' | 'miss'; punch: PunchType } | null>(null);
  const [wrongShake, setWrongShake] = useState(0);
  const [highestCleared, setHighestCleared] = useState<number>(getHighestClearedRound());
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null);
  const [comboMilestone, setComboMilestone] = useState<{ value: number; key: number } | null>(null);
  const [energyFloat, setEnergyFloat] = useState<{ delta: number; key: number } | null>(null);
  const [perfectFlash, setPerfectFlash] = useState(0);

  const [sessionResult, setSessionResult] = useState<MittSessionResult | null>(null);
  const [sessionExtras, setSessionExtras] = useState<MittSessionExtras | null>(null);

  // 라운드 단위 통계 누적
  const allHits = useRef<{ punch: PunchType; result: 'perfect' | 'good' | 'miss'; reactionMs: number; stage: number }[]>([]);
  const roundStatsRef = useRef<{
    round: number;
    perfect: number;
    good: number;
    miss: number;
    consecutiveMiss: number;
    startScore: number;
  }>({ round: 1, perfect: 0, good: 0, miss: 0, consecutiveMiss: 0, startScore: 0 });

  const drillResultsRef = useRef<DrillResult[]>([]);

  const gloveIdRef = useRef(0);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const stageTimerRef = useRef<ReturnType<typeof setInterval>>();
  const tickRafRef = useRef<number>();
  const countdownTimerRef = useRef<ReturnType<typeof setInterval>>();
  const drainTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const currentStageRef = useRef(1);
  const phaseRef = useRef<MittPhase>('home');
  const pausedRef = useRef(false);
  const pausedAtRef = useRef<number>(0);
  const energyRef = useRef(100);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { energyRef.current = energy; }, [energy]);

  const clearAllTimers = useCallback(() => {
    clearTimeout(spawnTimerRef.current);
    clearInterval(stageTimerRef.current);
    clearInterval(countdownTimerRef.current);
    clearTimeout(drainTimeoutRef.current);
    if (tickRafRef.current) cancelAnimationFrame(tickRafRef.current);
  }, []);

  // ===== 라운드 종료 처리 =====
  const finalizeRound = useCallback((reason: 'time-up' | 'ko-energy' | 'ko-streak') => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'ending' as MittPhase; // 중복 finalize 차단
    clearAllTimers();
    setGloves([]);

    const rs = roundStatsRef.current;
    const cfg = getRoundConfig(rs.round);
    const total = rs.perfect + rs.good + rs.miss;
    const correct = rs.perfect + rs.good;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const remainingEnergy = Math.max(0, energyRef.current);
    const cleared = reason === 'time-up' && remainingEnergy > 0 && total > 0;
    const stars = evaluateStars({ cleared, accuracy, remainingEnergy });
    const roundScore = score - rs.startScore;

    // Drill result 누적 (최종 결과 화면용)
    const stepResults: StepResult[] = allHits.current
      .filter(h => h.stage === rs.round)
      .map(h => ({
        punch: h.punch,
        inputPunch: h.result === 'miss' ? null : h.punch,
        correct: h.result !== 'miss',
        reactionMs: h.reactionMs,
        timestamp: Date.now(),
      }));
    const cors = stepResults.filter(s => s.correct);
    drillResultsRef.current.push({
      comboId: `ROUND ${rs.round}`,
      stepResults,
      completed: cleared,
      avgReaction: cors.length ? Math.round(cors.reduce((a, b) => a + b.reactionMs, 0) / cors.length) : 9999,
      accuracy,
    });

    let newBest = false;
    let newStarRecord = false;
    let prevStars: 0 | 1 | 2 | 3 = getStarsForRound(rs.round);
    let isFirstClear = false;
    let isFirstThreeStar = false;
    let newBestScore = false;
    let newBestAccuracy = false;
    let bestScore = getBestScoreForRound(rs.round);
    let bestAccuracy = getBestAccuracyForRound(rs.round);

    if (cleared) {
      newBest = setHighestClearedRound(rs.round);
      if (newBest) setHighestCleared(rs.round);
      const rec = recordRoundBest(rs.round, roundScore, accuracy);
      newBestScore = rec.newBestScore;
      newBestAccuracy = rec.newBestAcc;
      bestScore = rec.prevBestScore;
      bestAccuracy = rec.prevBestAccuracy;
      if (stars) {
        const sr = recordStars(rs.round, stars.stars);
        newStarRecord = sr.newRecord;
        prevStars = sr.prevStars;
        isFirstClear = sr.isFirstClear;
        isFirstThreeStar = sr.isFirstThreeStar;
      }
    }

    const failHint = !cleared
      ? getFailHint({
          round: rs.round,
          accuracy,
          perfectCount: rs.perfect,
          missCount: rs.miss,
          remainingEnergy,
          reason,
        })
      : undefined;

    const outcome: RoundOutcome = {
      round: rs.round,
      cleared,
      reason: cleared ? 'time-up' : reason,
      score: roundScore,
      accuracy,
      perfectCount: rs.perfect,
      goodCount: rs.good,
      missCount: rs.miss,
      remainingEnergy,
      stars,
      newBest,
      newStarRecord,
      prevStars,
      isFirstClear,
      isFirstThreeStar,
      newBestScore,
      newBestAccuracy,
      bestScore,
      bestAccuracy,
      failHint,
    };
    setRoundOutcome(outcome);

    if (cleared) {
      audio.fanfare();
      vibrate([40, 60, 40]);
      setPhase('clear');
      phaseRef.current = 'clear';
    } else {
      audio.miss();
      vibrate([80, 40, 80, 40, 120]);
      setPhase('fail');
      phaseRef.current = 'fail';
    }

    // bgm fade
    audio.stopBgm();
  }, [clearAllTimers, score]);

  const finishSession = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();

    const all = allHits.current;
    const correct = all.filter(h => h.result !== 'miss');
    const perfects = all.filter(h => h.result === 'perfect');
    const times = correct.map(h => h.reactionMs);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 999;
    const best = times.length ? Math.min(...times) : 999;
    const reachedRound = currentStageRef.current;

    incrementTotals(perfects.length);

    const result: MittSessionResult = {
      playerName,
      score,
      totalCombos: bestCombo,
      completedCombos: perfects.length,
      avgReaction: Math.round(avg),
      bestReaction: Math.round(best),
      accuracy: all.length ? Math.round((correct.length / all.length) * 100) : 0,
      totalSteps: all.length,
      correctSteps: correct.length,
      drillResults: drillResultsRef.current,
      date: new Date().toISOString(),
      round: reachedRound,
    };
    const perfectPct = all.length ? (perfects.length / all.length) * 100 : 0;

    setSessionResult(result);
    setSessionExtras({
      perfectPct,
      drillResults: drillResultsRef.current,
      stagesCleared: Math.max(0, reachedRound - 1),
    });
    setPhase('results');
    phaseRef.current = 'results';
  }, [clearAllTimers, playerName, score, bestCombo]);

  // ===== 스폰 / 틱 =====
  const spawnGlove = useCallback(() => {
    const cfg = getRoundConfig(currentStageRef.current);
    const punch = PUNCHES_LIST[Math.floor(Math.random() * PUNCHES_LIST.length)];
    const lane = PUNCHES_LIST.indexOf(punch);
    const newGlove: FallingGlove = {
      id: ++gloveIdRef.current,
      punch,
      lane,
      spawnedAt: performance.now(),
      duration: cfg.fallDurationMs,
      hit: false,
      missed: false,
    };
    setGloves(prev => [...prev, newGlove]);
  }, []);

  const scheduleSpawn = useCallback(() => {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    const cfg = getRoundConfig(currentStageRef.current);
    const jitter = 0.85 + Math.random() * 0.3;
    spawnTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      spawnGlove();
      if (Math.random() < cfg.multiSpawnChance) {
        setTimeout(() => {
          if (phaseRef.current === 'playing' && !pausedRef.current) spawnGlove();
        }, 180 + Math.random() * 220);
      }
      scheduleSpawn();
    }, cfg.spawnIntervalMs * jitter);
  }, [spawnGlove]);

  const applyEnergyDelta = useCallback((delta: number) => {
    setEnergy(e => {
      const next = Math.max(0, Math.min(100, e + delta));
      energyRef.current = next;
      if (next <= 0 && phaseRef.current === 'playing') {
        // 다음 frame에 KO 처리 (state 안정성)
        setTimeout(() => finalizeRound('ko-energy'), 0);
      }
      return next;
    });
  }, [finalizeRound]);

  const tick = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    if (pausedRef.current) {
      tickRafRef.current = requestAnimationFrame(tick);
      return;
    }
    const now = performance.now();
    const cfg = getRoundConfig(currentStageRef.current);
    setGloves(prev => {
      let changed = false;
      const next = prev.map(g => {
        if (g.hit || g.missed) return g;
        const elapsed = now - g.spawnedAt;
        if (elapsed > g.duration + cfg.goodWindowMs) {
          changed = true;
          allHits.current.push({ punch: g.punch, result: 'miss', reactionMs: 9999, stage: currentStageRef.current });
          roundStatsRef.current.miss += 1;
          roundStatsRef.current.consecutiveMiss += 1;
          setCombo(0);
          setLastResult({ rating: 'miss', punch: g.punch });
          audio.miss();
          vibrate(40);
          applyEnergyDelta(-cfg.missPenalty);
          if (roundStatsRef.current.consecutiveMiss >= cfg.consecutiveMissKO) {
            setTimeout(() => finalizeRound('ko-streak'), 0);
          }
          return { ...g, missed: true, result: 'miss' as const };
        }
        return g;
      });
      const filtered = next.filter(g => now - g.spawnedAt < g.duration + 800);
      return changed || filtered.length !== prev.length ? filtered : prev;
    });
    tickRafRef.current = requestAnimationFrame(tick);
  }, [applyEnergyDelta, finalizeRound]);

  // ===== 라운드 시작 =====
  const startStage = useCallback((stageNum: number) => {
    const cfg = getRoundConfig(stageNum);
    currentStageRef.current = stageNum;
    setCurrentStage(stageNum);
    setStageTime(cfg.durationSec);
    setEnergy(cfg.energyStart);
    energyRef.current = cfg.energyStart;
    setGloves([]);
    setLastResult(null);
    setRoundOutcome(null);
    roundStatsRef.current = {
      round: stageNum,
      perfect: 0,
      good: 0,
      miss: 0,
      consecutiveMiss: 0,
      startScore: score,
    };

    setPhase('playing');
    phaseRef.current = 'playing';

    // BGM by intensity
    const intensity: 1 | 2 | 3 = stageNum <= 3 ? 1 : stageNum <= 7 ? 2 : 3;
    audio.startBgm(intensity);

    scheduleSpawn();
    tickRafRef.current = requestAnimationFrame(tick);

    stageTimerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setStageTime(t => {
        if (t <= 1) {
          clearInterval(stageTimerRef.current);
          clearTimeout(spawnTimerRef.current);
          // grace: 마지막 글러브가 도착할 시간 대기
          drainTimeoutRef.current = setTimeout(() => {
            finalizeRound('time-up');
          }, cfg.fallDurationMs + STAGE_END_GRACE_MS);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [scheduleSpawn, tick, finalizeRound, score]);

  const handlePunch = useCallback((type: PunchType) => {
    if (phaseRef.current !== 'playing') return;
    const now = performance.now();
    const cfg = getRoundConfig(currentStageRef.current);

    let target: FallingGlove | undefined;
    let bestDelta = Infinity;
    setGloves(prev => {
      prev.forEach(g => {
        if (g.hit || g.missed) return;
        if (g.punch !== type) return;
        const elapsed = now - g.spawnedAt;
        const delta = Math.abs(elapsed - g.duration);
        if (delta < bestDelta && delta <= cfg.goodWindowMs) {
          bestDelta = delta;
          target = g;
        }
      });
      if (!target) return prev;
      const t = target;
      const rating: 'perfect' | 'good' = bestDelta <= cfg.perfectWindowMs ? 'perfect' : 'good';
      const points = rating === 'perfect' ? 100 : 50;
      const comboBonus = Math.min(combo, 30) * 5;
      setScore(s => s + points + comboBonus);
      setCombo(c => {
        const nc = c + 1;
        setBestCombo(b => Math.max(b, nc));
        return nc;
      });
      setLastResult({ rating, punch: type });
      if (rating === 'perfect') {
        audio.perfectHit();
        roundStatsRef.current.perfect += 1;
        applyEnergyDelta(cfg.perfectRecover);
        setEnergyFloat({ delta: cfg.perfectRecover, key: performance.now() });
        setPerfectFlash(f => f + 1);
      } else {
        audio.punch();
        roundStatsRef.current.good += 1;
      }
      roundStatsRef.current.consecutiveMiss = 0;
      vibrate(rating === 'perfect' ? 30 : 15);
      // 콤보 마일스톤
      const newCombo = combo + 1;
      if ([3, 5, 10, 15, 20, 30].includes(newCombo)) {
        setComboMilestone({ value: newCombo, key: performance.now() });
        if (newCombo >= 5) audio.fanfare();
      }
      allHits.current.push({ punch: type, result: rating, reactionMs: Math.round(bestDelta), stage: currentStageRef.current });
      return prev.map(g => g.id === t.id ? { ...g, hit: true, result: rating } : g);
    });

    if (!target) {
      setCombo(0);
      setWrongShake(s => s + 1);
      audio.miss();
      vibrate([50, 30, 50]);
      setLastResult({ rating: 'miss', punch: type });
      allHits.current.push({ punch: type, result: 'miss', reactionMs: 9999, stage: currentStageRef.current });
      roundStatsRef.current.miss += 1;
      roundStatsRef.current.consecutiveMiss += 1;
      applyEnergyDelta(-cfg.majorMissPenalty);
      if (roundStatsRef.current.consecutiveMiss >= cfg.consecutiveMissKO) {
        setTimeout(() => finalizeRound('ko-streak'), 0);
      }
    }
  }, [combo, applyEnergyDelta, finalizeRound]);

  const startCountdown = useCallback((onDone: () => void) => {
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setCountdown(3);
    audio.beep(false);
    let n = 3;
    countdownTimerRef.current = setInterval(() => {
      n--;
      if (n > 0) {
        audio.beep(false);
        setCountdown(n);
      } else if (n === 0) {
        audio.beep(true);
        setCountdown(0);
      } else {
        clearInterval(countdownTimerRef.current);
        audio.bell();
        onDone();
      }
    }, 800);
  }, []);

  // ===== Public actions =====
  const startGame = useCallback((name: string) => {
    setPlayerName(name);
    savePlayerName(name);
    allHits.current = [];
    drillResultsRef.current = [];
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setEnergy(100);
    energyRef.current = 100;
    setSessionResult(null);
    setSessionExtras(null);
    setRoundOutcome(null);
    startCountdown(() => startStage(1));
  }, [startCountdown, startStage]);

  // 다음 라운드로 진행 (clear 모달의 NEXT)
  const nextRound = useCallback(() => {
    if (phaseRef.current !== 'clear') return;
    const next = currentStageRef.current + 1;
    setRoundOutcome(null);
    startCountdown(() => startStage(next));
  }, [startCountdown, startStage]);

  // 같은 라운드 다시 시도 (fail 모달의 RETRY)
  const retryRound = useCallback(() => {
    if (phaseRef.current !== 'fail' && phaseRef.current !== 'clear') return;
    setRoundOutcome(null);
    startCountdown(() => startStage(currentStageRef.current));
  }, [startCountdown, startStage]);

  // 처음 라운드부터 다시 (전체 세션 재시작)
  const restartGame = useCallback(() => {
    const name = playerName;
    clearAllTimers();
    audio.stopBgm();
    setPaused(false);
    pausedRef.current = false;
    setGloves([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setEnergy(100);
    energyRef.current = 100;
    setLastResult(null);
    setRoundOutcome(null);
    allHits.current = [];
    drillResultsRef.current = [];
    if (name) {
      startCountdown(() => startStage(1));
    } else {
      setPhase('home');
      phaseRef.current = 'home';
    }
  }, [playerName, clearAllTimers, startCountdown, startStage]);

  const goHome = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();
    setPaused(false);
    pausedRef.current = false;
    setPhase('home');
    phaseRef.current = 'home';
    setGloves([]);
    setRoundOutcome(null);
  }, [clearAllTimers]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    pausedAtRef.current = performance.now();
    audio.stopBgm();
    clearTimeout(spawnTimerRef.current);
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'playing' || !pausedRef.current) return;
    const pauseDuration = performance.now() - pausedAtRef.current;
    setGloves(prev => prev.map(g =>
      (g.hit || g.missed) ? g : { ...g, spawnedAt: g.spawnedAt + pauseDuration }
    ));
    pausedRef.current = false;
    setPaused(false);
    const intensity: 1 | 2 | 3 = currentStageRef.current <= 3 ? 1 : currentStageRef.current <= 7 ? 2 : 3;
    audio.startBgm(intensity);
    scheduleSpawn();
  }, [scheduleSpawn]);

  // 결과 화면으로 이동 (clear/fail 모달에서 "그만하기")
  const endSession = useCallback(() => {
    if (phaseRef.current !== 'clear' && phaseRef.current !== 'fail') return;
    finishSession();
  }, [finishSession]);

  const goToName = useCallback(() => setPhase('name'), []);
  const skipRest = useCallback(() => {}, []); // legacy no-op
  const quitToMenu = useCallback(() => goHome(), [goHome]);

  useEffect(() => () => { clearAllTimers(); audio.stopBgm(); }, [clearAllTimers]);

  return {
    phase, playerName, paused,
    currentStage,
    totalStages: highestCleared,
    countdown, restTime: 0, stageTime,
    gloves, score, combo, bestCombo, energy, lastResult, wrongShake,
    highestCleared, roundOutcome,
    comboMilestone, energyFloat, perfectFlash,
    sessionResult, sessionExtras,
    startGame, handlePunch, goHome, goToName, skipRest,
    pauseGame, resumeGame, quitToMenu, restartGame,
    nextRound, retryRound, endSession,
  };
}
