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
  /** 이번 세션에서 최고 클리어 라운드를 갱신했는지 (동률은 false) */
  newBestRound: boolean;
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

  // 글러브 목록의 "지금" 값 — 판정은 여기서 하고 화면용 state 는 뒤따라 바꾼다.
  // setGloves 업데이터 안에서 판정하면 React 18 이 업데이터를 렌더 때까지 미룰 수 있어
  // 정타가 헛스윙(MISS)으로 먼저 처리되던 경쟁 상태를 없앤다 (2026-10-01 검수).
  const glovesRef = useRef<FallingGlove[]>([]);
  const commitGloves = useCallback((next: FallingGlove[]) => {
    glovesRef.current = next;
    setGloves(next);
  }, []);
  // 이번 세션에서 최고 라운드를 갱신했는지 (결과 화면 NEW BEST 배너 — 동률은 신기록이 아니다)
  const newBestInSessionRef = useRef(false);

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
  /** 라운드 시간이 다 된 뒤 마지막 글러브를 기다리는 마감 시각 — 일시정지하면 멈췄다가 재개 때 남은 만큼 다시 건다 */
  const drainDueAtRef = useRef<number | null>(null);
  const currentStageRef = useRef(1);
  const phaseRef = useRef<MittPhase>('home');
  const pausedRef = useRef(false);
  const pausedAtRef = useRef<number>(0);
  const energyRef = useRef(100);
  const scoreRef = useRef(score);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { energyRef.current = energy; }, [energy]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const clearAllTimers = useCallback(() => {
    clearTimeout(spawnTimerRef.current);
    clearInterval(stageTimerRef.current);
    clearInterval(countdownTimerRef.current);
    clearTimeout(drainTimeoutRef.current);
    drainDueAtRef.current = null;
    if (tickRafRef.current) cancelAnimationFrame(tickRafRef.current);
  }, []);

  // ===== 라운드 종료 처리 =====
  const finalizeRound = useCallback((reason: 'time-up' | 'ko-energy' | 'ko-streak') => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'ending' as MittPhase; // 중복 finalize 차단
    clearAllTimers();
    commitGloves([]);

    const rs = roundStatsRef.current;
    const cfg = getRoundConfig(rs.round);
    const total = rs.perfect + rs.good + rs.miss;
    const correct = rs.perfect + rs.good;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const remainingEnergy = Math.max(0, energyRef.current);
    const cleared = reason === 'time-up' && remainingEnergy > 0 && total > 0;
    const stars = evaluateStars({ cleared, accuracy, remainingEnergy });
    // Read live score via ref — finalizeRound is invoked from timer closures
    // frozen at stage start, where the captured `score` still equals startScore.
    const roundScore = scoreRef.current - rs.startScore;

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
      if (newBest) { setHighestCleared(rs.round); newBestInSessionRef.current = true; }
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
      audio.roundClear();
      vibrate([40, 60, 40]);
      setPhase('clear');
      phaseRef.current = 'clear';
    } else {
      audio.fail();
      vibrate([80, 40, 80, 40, 120]);
      setPhase('fail');
      phaseRef.current = 'fail';
    }

    // bgm fade
    audio.stopBgm();
  }, [clearAllTimers, commitGloves]);

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
      newBestRound: newBestInSessionRef.current,
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
    commitGloves([...glovesRef.current, newGlove]);
  }, [commitGloves]);

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
    const prev = glovesRef.current;
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
    if (changed || filtered.length !== prev.length) commitGloves(filtered);
    tickRafRef.current = requestAnimationFrame(tick);
  }, [applyEnergyDelta, finalizeRound, commitGloves]);

  // ===== 라운드 시작 =====
  const startStage = useCallback((stageNum: number) => {
    const cfg = getRoundConfig(stageNum);
    currentStageRef.current = stageNum;
    setCurrentStage(stageNum);
    setStageTime(cfg.durationSec);
    setEnergy(cfg.energyStart);
    energyRef.current = cfg.energyStart;
    commitGloves([]);
    setLastResult(null);
    setRoundOutcome(null);
    roundStatsRef.current = {
      round: stageNum,
      perfect: 0,
      good: 0,
      miss: 0,
      consecutiveMiss: 0,
      // ref 로 읽는다 — 카운트다운이 캡처한 옛 클로저의 score(직전 게임 점수)를 쓰면
      // 재시작 후 1라운드 점수가 음수로 찍히던 문제 (2026-10-01 검수)
      startScore: scoreRef.current,
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
          const graceMs = cfg.fallDurationMs + STAGE_END_GRACE_MS;
          drainDueAtRef.current = performance.now() + graceMs;
          drainTimeoutRef.current = setTimeout(() => {
            drainDueAtRef.current = null;
            finalizeRound('time-up');
          }, graceMs);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [scheduleSpawn, tick, finalizeRound, commitGloves]);

  const handlePunch = useCallback((type: PunchType) => {
    if (phaseRef.current !== 'playing') return;
    const now = performance.now();
    const cfg = getRoundConfig(currentStageRef.current);

    // 판정은 ref(지금 값)로 — state 업데이터 안에서 하면 지연 실행돼 정타가 MISS 로 먼저 처리될 수 있다
    let target: FallingGlove | undefined;
    let bestDelta = Infinity;
    const prev = glovesRef.current;
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

    if (target) {
      const t = target;
      const rating: 'perfect' | 'good' = bestDelta <= cfg.perfectWindowMs ? 'perfect' : 'good';
      const points = rating === 'perfect' ? 100 : 50;
      const comboBonus = Math.min(combo, 30) * 5;
      commitGloves(prev.map(g => g.id === t.id ? { ...g, hit: true, result: rating } : g));
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
        if (newCombo >= 5) audio.combo();
      }
      allHits.current.push({ punch: type, result: rating, reactionMs: Math.round(bestDelta), stage: currentStageRef.current });
    } else {
      setCombo(0);
      setWrongShake(s => s + 1);
      audio.whoosh();
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
  }, [combo, applyEnergyDelta, finalizeRound, commitGloves]);

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
    newBestInSessionRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    setBestCombo(0);
    setEnergy(100);
    energyRef.current = 100;
    commitGloves([]);
    setSessionResult(null);
    setSessionExtras(null);
    setRoundOutcome(null);
    startCountdown(() => startStage(1));
  }, [startCountdown, startStage, commitGloves]);

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
    commitGloves([]);
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    setBestCombo(0);
    setEnergy(100);
    energyRef.current = 100;
    setLastResult(null);
    setRoundOutcome(null);
    allHits.current = [];
    drillResultsRef.current = [];
    newBestInSessionRef.current = false;
    if (name) {
      startCountdown(() => startStage(1));
    } else {
      setPhase('home');
      phaseRef.current = 'home';
    }
  }, [playerName, clearAllTimers, startCountdown, startStage, commitGloves]);

  const goHome = useCallback(() => {
    clearAllTimers();
    audio.stopBgm();
    setPaused(false);
    pausedRef.current = false;
    setPhase('home');
    phaseRef.current = 'home';
    commitGloves([]);
    setRoundOutcome(null);
  }, [clearAllTimers, commitGloves]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    pausedAtRef.current = performance.now();
    audio.stopBgm();
    clearTimeout(spawnTimerRef.current);
    // 라운드 마감 대기(drain)도 멈춘다 — 안 멈추면 일시정지 중에 라운드가 끝나 버린다
    clearTimeout(drainTimeoutRef.current);
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'playing' || !pausedRef.current) return;
    const pauseDuration = performance.now() - pausedAtRef.current;
    commitGloves(glovesRef.current.map(g =>
      (g.hit || g.missed) ? g : { ...g, spawnedAt: g.spawnedAt + pauseDuration }
    ));
    pausedRef.current = false;
    setPaused(false);
    const intensity: 1 | 2 | 3 = currentStageRef.current <= 3 ? 1 : currentStageRef.current <= 7 ? 2 : 3;
    audio.startBgm(intensity);
    if (drainDueAtRef.current != null) {
      // 시간이 다 된 뒤 멈췄던 경우 — 남은 마감 시간만큼 다시 건다 (스폰은 더 하지 않는다)
      const remain = Math.max(60, drainDueAtRef.current - pausedAtRef.current);
      drainDueAtRef.current = performance.now() + remain;
      drainTimeoutRef.current = setTimeout(() => {
        drainDueAtRef.current = null;
        finalizeRound('time-up');
      }, remain);
      return;
    }
    scheduleSpawn();
  }, [scheduleSpawn, finalizeRound, commitGloves]);

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
