import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttackKind,
  DefensePhase,
  DefenseRunStats,
  DefenseSide,
  IncomingAttack,
  Judgement,
} from '@/features/minigame/types/defense';
import {
  DEFENSE_CONFIG,
  getDifficultyTier,
  getOpponentTheme,
  getGemReward,
  getBoxerStyle,
  applyStyleBias,
} from '@/features/minigame/lib/defenseConfig';
import { getDefenseState } from '@/features/minigame/lib/defenseStorage';
import { audio, vibrate } from '@/features/minigame/lib/audio';

interface FloatingFx {
  id: number;
  text: string;
  color: string;
  side?: DefenseSide;
  big?: boolean;
}

interface BurstFx {
  id: number;
  side: DefenseSide;
  color: string;
}

const now = () => performance.now();

let attackIdSeq = 1;
let fxIdSeq = 1;

/** Weighted random pick with fallback to jab. */
function pickAttackKind(weights: { jab: number; hook: number; feint: number; rush: number }): AttackKind {
  const total = weights.jab + weights.hook + weights.feint + weights.rush;
  if (total <= 0) return 'jab';
  let r = Math.random() * total;
  if ((r -= weights.jab) < 0) return 'jab';
  if ((r -= weights.hook) < 0) return 'hook';
  if ((r -= weights.feint) < 0) return 'feint';
  return 'rush';
}

function telegraphFor(kind: AttackKind, scale: number): number {
  const base =
    kind === 'jab'   ? DEFENSE_CONFIG.jabTelegraphMs   :
    kind === 'hook'  ? DEFENSE_CONFIG.hookTelegraphMs  :
    kind === 'feint' ? DEFENSE_CONFIG.feintTelegraphMs :
                       DEFENSE_CONFIG.rushTelegraphMs;
  return Math.max(360, base * scale);
}

export function useDefenseEngine() {
  const [phase, setPhase] = useState<DefensePhase>('home');
  const [paused, setPaused] = useState(false);

  const [stats, setStats] = useState<DefenseRunStats>(() => emptyStats());
  const [combo, setCombo] = useState(0);
  const [attacks, setAttacks] = useState<IncomingAttack[]>([]);
  const [shake, setShake] = useState<0 | 1 | 2>(0);
  const [hitstop, setHitstop] = useState(false);
  const [floats, setFloats] = useState<FloatingFx[]>([]);
  const [bursts, setBursts] = useState<BurstFx[]>([]);
  const [boxerHit, setBoxerHit] = useState<DefenseSide | null>(null);
  const [bannerEvent, setBannerEvent] = useState<{ id: number; text: string; sub: string; color: string } | null>(null);

  // ===== Round / Shield =====
  const [shields, setShields] = useState(0);
  const [bestRound, setBestRound] = useState(0);
  const [roundClearFx, setRoundClearFx] = useState<{ id: number; round: number } | null>(null);
  const [shieldFx, setShieldFx] = useState<{ id: number; kind: 'gain' | 'save' } | null>(null);
  const invincibleUntilRef = useRef<number>(0);

  // ===== Fever =====
  const [feverEndsAt, setFeverEndsAt] = useState<number | null>(null);
  const [feverFx, setFeverFx] = useState<{ id: number; kind: 'enter' | 'exit' } | null>(null);
  const feverEndsAtRef = useRef<number | null>(null);
  useEffect(() => { feverEndsAtRef.current = feverEndsAt; }, [feverEndsAt]);

  // ===== Focus / Adrenaline =====
  const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
  const [adrenalineEndsAt, setAdrenalineEndsAt] = useState<number | null>(null);
  const [itemPickupFx, setItemPickupFx] = useState<{ id: number; kind: 'focus' | 'adrenaline' } | null>(null);
  const focusEndsAtRef = useRef<number | null>(null);
  const adrenalineEndsAtRef = useRef<number | null>(null);
  useEffect(() => { focusEndsAtRef.current = focusEndsAt; }, [focusEndsAt]);
  useEffect(() => { adrenalineEndsAtRef.current = adrenalineEndsAt; }, [adrenalineEndsAt]);

  // Live elapsed seconds for HUD (ticks every 100ms while playing)
  const [elapsedSec, setElapsedSec] = useState(0);

  // counter time
  const [counterEndsAt, setCounterEndsAt] = useState<number | null>(null);
  const [counterHits, setCounterHits] = useState(0);
  const [pressedSide, setPressedSide] = useState<DefenseSide | null>(null);

  // boss
  const bossPatternRef = useRef<DefenseSide[]>([]);
  const bossIndexRef = useRef(0);
  const bossNextIdxRef = useRef(0); // next boss milestone index in bossRushStartTimes

  // milestone banners shown
  const milestonesShownRef = useRef<Set<number>>(new Set());

  // timing refs
  const startedAtRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const nextSpawnAtRef = useRef<number>(0);
  const lastInputAtRef = useRef<number>(0);
  const lastSideRef = useRef<DefenseSide | null>(null);
  const tierIdxRef = useRef<number>(0);

  // ===== derived =====
  const survivedMsLive = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const pauseAdj = pausedAtRef.current ? now() - pausedAtRef.current : 0;
    return now() - startedAtRef.current - totalPausedMsRef.current - pauseAdj;
  }, []);

  const opponentTheme = useMemo(() => getOpponentTheme(elapsedSec), [elapsedSec]);

  // ===== fx =====
  const pushFloat = useCallback((text: string, color: string, side?: DefenseSide, big = false) => {
    const id = fxIdSeq++;
    setFloats(f => [...f, { id, text, color, side, big }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 750);
  }, []);

  const pushBurst = useCallback((side: DefenseSide, color: string) => {
    const id = fxIdSeq++;
    setBursts(b => [...b, { id, side, color }]);
    setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 600);
  }, []);

  const triggerShake = useCallback((big = false) => {
    setShake(big ? 2 : 1);
    setTimeout(() => setShake(0), big ? 380 : 220);
  }, []);

  const triggerHitstop = useCallback((ms = 110) => {
    setHitstop(true);
    setTimeout(() => setHitstop(false), ms);
  }, []);

  const triggerBoxerHit = useCallback((side: DefenseSide) => {
    setBoxerHit(side);
    setTimeout(() => setBoxerHit(null), 180);
  }, []);

  const showBanner = useCallback((text: string, sub: string, color: string, ms = 1100) => {
    const id = fxIdSeq++;
    setBannerEvent({ id, text, sub, color });
    setTimeout(() => setBannerEvent(b => (b?.id === id ? null : b)), ms);
  }, []);

  // ===== spawn =====
  // Read latest stats via ref so spawn always uses current round style
  const statsRef = useRef(stats);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  const spawnAttack = useCallback((overrideSide?: DefenseSide, kindOverride?: AttackKind) => {
    const elapsed = survivedMsLive();
    const tier = getDifficultyTier(elapsed);
    const style = getBoxerStyle(statsRef.current.roundReached);
    const biased = applyStyleBias(tier.weights, style);
    const kind = kindOverride ?? pickAttackKind(biased);
    const tele = telegraphFor(kind, tier.teleScale);

    let trueSide: DefenseSide;
    if (overrideSide) {
      trueSide = overrideSide;
    } else if (lastSideRef.current && Math.random() < tier.sideAlternateBias) {
      trueSide = lastSideRef.current === 'L' ? 'R' : 'L';
    } else {
      trueSide = Math.random() < 0.5 ? 'L' : 'R';
    }
    lastSideRef.current = trueSide;

    const a: IncomingAttack = {
      id: attackIdSeq++,
      side: trueSide,
      kind,
      spawnedAt: now(),
      arriveAt: now() + tele,
    };
    if (kind === 'feint') {
      a.feintShownSide = trueSide === 'L' ? 'R' : 'L';
      a.feintCancelAt = a.spawnedAt + tele * DEFENSE_CONFIG.feintCancelRatio;
    }
    if (kind === 'hook' || kind === 'rush') audio.beep(true);
    setAttacks(list => [...list, a]);
  }, [survivedMsLive]);

  // ===== boss rush =====
  const startBossRush = useCallback(() => {
    setPhase('boss');
    audio.cheer();
    audio.setBgmIntensity(3);
    triggerShake(true);
    showBanner('⚠ BOSS RUSH', '연속 6연타를 막아라', 'text-primary', 1100);
    vibrate([40, 30, 40]);
    const len = DEFENSE_CONFIG.bossPatternLength;
    const pattern: DefenseSide[] = [];
    let last: DefenseSide | null = null;
    for (let i = 0; i < len; i++) {
      // 2/3 alternation, 1/3 same — readable but tricky
      const next: DefenseSide = last && Math.random() < 0.7 ? (last === 'L' ? 'R' : 'L') : (Math.random() < 0.5 ? 'L' : 'R');
      pattern.push(next);
      last = next;
    }
    bossPatternRef.current = pattern;
    bossIndexRef.current = 0;
    setAttacks([]);
    setTimeout(() => {
      spawnAttack(pattern[0], 'jab');
      bossIndexRef.current = 1;
    }, 800);
  }, [spawnAttack, showBanner, triggerShake]);

  // ===== counter time =====
  const startCounterTime = useCallback(() => {
    setPhase('counter');
    audio.fanfare();
    audio.setBgmIntensity(3);
    triggerHitstop(180);
    showBanner('⚡ COUNTER TIME', '아무 버튼이나 빠르게 탭!', 'text-secondary', 900);
    vibrate([30, 20, 30, 20, 50]);
    setAttacks([]);
    setCounterHits(0);
    setCounterEndsAt(now() + DEFENSE_CONFIG.counterDurationMs);
    setStats(s => ({ ...s, counterTimes: s.counterTimes + 1 }));
  }, [showBanner, triggerHitstop]);

  const finishCounterTime = useCallback(() => {
    setCounterEndsAt(null);
    setPhase('playing');
    audio.setBgmIntensity(2);
    nextSpawnAtRef.current = now() + 700;
  }, []);

  // ===== main loop =====
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'counter' && phase !== 'boss') return;
    if (paused) return;

    let raf = 0;
    let lastTickSec = 0;
    const loop = () => {
      const t = now();
      const elapsed = survivedMsLive();
      const elapsedS = Math.floor(elapsed / 100) / 10;
      if (elapsedS !== lastTickSec) {
        lastTickSec = elapsedS;
        setElapsedSec(elapsedS);
      }

      // Fever / Focus / Adrenaline expiry
      if (feverEndsAtRef.current && t >= feverEndsAtRef.current) {
        setFeverEndsAt(null);
        setFeverFx({ id: fxIdSeq++, kind: 'exit' });
        setTimeout(() => setFeverFx(f => (f?.kind === 'exit' ? null : f)), 600);
        audio.setBgmIntensity(2);
      }
      if (focusEndsAtRef.current && t >= focusEndsAtRef.current) setFocusEndsAt(null);
      if (adrenalineEndsAtRef.current && t >= adrenalineEndsAtRef.current) setAdrenalineEndsAt(null);

      // Counter time end
      if (phase === 'counter' && counterEndsAt && t >= counterEndsAt) {
        finishCounterTime();
        raf = requestAnimationFrame(loop);
        return;
      }

      // Tier crossing detection — show banner + grace window
      const tierInfo = getDifficultyTier(elapsed);
      const newIdx = DEFENSE_CONFIG.difficultyTiers.indexOf(tierInfo as never);
      if (newIdx > tierIdxRef.current) {
        tierIdxRef.current = newIdx;
        // Push spawn forward to give grace
        nextSpawnAtRef.current = Math.max(nextSpawnAtRef.current, t + DEFENSE_CONFIG.graceWindowAfterStepMs);
        // Skip banner for the very first tier transition to avoid intro spam
        if (newIdx >= 2) {
          showBanner(`▲ ${tierInfo.label}`, '난이도 상승!', 'text-primary', 850);
          audio.beep(true);
          vibrate(20);
        }
      }

      // Milestone banners
      for (const ms of DEFENSE_CONFIG.milestonesMs) {
        if (elapsed >= ms && !milestonesShownRef.current.has(ms)) {
          milestonesShownRef.current.add(ms);
          const sec = Math.round(ms / 1000);
          showBanner(`${sec}s !!`, '계속 가자!', 'text-secondary', 1000);
          audio.cheer();
          triggerShake(false);
        }
      }

      // Boss rush trigger by time
      if (
        phase === 'playing' &&
        bossNextIdxRef.current < DEFENSE_CONFIG.bossRushStartTimes.length &&
        elapsed >= DEFENSE_CONFIG.bossRushStartTimes[bossNextIdxRef.current]
      ) {
        bossNextIdxRef.current += 1;
        startBossRush();
        raf = requestAnimationFrame(loop);
        return;
      }

      // Spawn cycle
      if (phase === 'playing') {
        if (t >= nextSpawnAtRef.current) {
          spawnAttack();
          let slowFactor = 1;
          if (feverEndsAtRef.current && t < feverEndsAtRef.current) slowFactor *= DEFENSE_CONFIG.feverSlowFactor;
          if (adrenalineEndsAtRef.current && t < adrenalineEndsAtRef.current) slowFactor *= DEFENSE_CONFIG.adrenalineSlowFactor;
          const interval = tierInfo.intervalMs / slowFactor;
          nextSpawnAtRef.current = t + interval * (0.85 + Math.random() * 0.3);
        }
      } else if (phase === 'boss') {
        if (
          attacks.length === 0 &&
          bossIndexRef.current < bossPatternRef.current.length &&
          t >= nextSpawnAtRef.current
        ) {
          spawnAttack(bossPatternRef.current[bossIndexRef.current], 'jab');
          bossIndexRef.current += 1;
          nextSpawnAtRef.current = t + DEFENSE_CONFIG.bossIntervalMs;
        }
      }

      // Miss by timeout
      setAttacks(list => {
        let died = false;
        const stillAlive: IncomingAttack[] = [];
        for (const a of list) {
          if (a.resolved) { stillAlive.push(a); continue; }
          if (t - a.arriveAt > DEFENSE_CONFIG.goodWindowMs) {
            if (phase !== 'counter') { died = true; break; }
          } else {
            stillAlive.push(a);
          }
        }
        if (died) {
          endRun('miss');
          return [];
        }
        return stillAlive;
      });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, counterEndsAt, attacks.length]);

  // ===== input =====
  const handleGuard = useCallback((side: DefenseSide) => {
    if (paused) return;
    const t = now();
    if (t - lastInputAtRef.current < DEFENSE_CONFIG.inputCooldownMs) return;
    lastInputAtRef.current = t;

    setPressedSide(side);
    setTimeout(() => setPressedSide(p => (p === side ? null : p)), 100);

    if (phase === 'counter') return;

    setAttacks(list => {
      const idx = list.findIndex(a => !a.resolved);
      if (idx < 0) return list; // ghost tap, no penalty
      const a = list[idx];
      const diff = Math.abs(t - a.arriveAt);

      if (side !== a.side) {
        audio.miss();
        vibrate([80, 30, 80]);
        triggerBoxerHit(a.side);
        endRun('wrong-side');
        return [];
      }

      // Focus expands perfect window
      const focusBonus = (focusEndsAtRef.current && t < focusEndsAtRef.current)
        ? DEFENSE_CONFIG.focusPerfectWindowBonus
        : 0;
      let j: Judgement = 'miss';
      if (diff <= DEFENSE_CONFIG.perfectWindowMs + focusBonus) j = 'perfect';
      else if (diff <= DEFENSE_CONFIG.goodWindowMs) j = 'good';

      if (j === 'miss') {
        audio.miss();
        vibrate([80, 30, 80]);
        triggerBoxerHit(side);
        endRun('mistime');
        return [];
      }

      // Fever score multiplier
      const inFever = !!(feverEndsAtRef.current && t < feverEndsAtRef.current);
      const basePoints = j === 'perfect' ? DEFENSE_CONFIG.scorePerfect : DEFENSE_CONFIG.scoreGood;
      const points = inFever ? basePoints * DEFENSE_CONFIG.feverScoreMultiplier : basePoints;

      if (j === 'perfect') {
        audio.perfectHit();
        vibrate(20);
        triggerHitstop(120);
        triggerShake();
        pushFloat(inFever ? `PERFECT x${DEFENSE_CONFIG.feverScoreMultiplier}` : 'PERFECT', 'text-secondary', side, true);
        pushBurst(side, inFever ? 'hsl(355 100% 65%)' : 'hsl(45 100% 60%)');
      } else {
        audio.punch();
        vibrate(10);
        pushFloat(inFever ? `GOOD x${DEFENSE_CONFIG.feverScoreMultiplier}` : 'GOOD', 'text-rating-good', side);
        pushBurst(side, 'hsl(217 91% 60%)');
      }

      setStats(prev => {
        const newPerfect = prev.perfectCount + (j === 'perfect' ? 1 : 0);
        const newGood = prev.goodCount + (j === 'good' ? 1 : 0);
        const newScore = prev.score + points;
        const newCombo = j === 'perfect' ? combo + 1 : 0;
        let extraFever = 0;

        if (newCombo > 0 && newCombo % DEFENSE_CONFIG.counterTriggerCombo === 0) {
          setTimeout(() => startCounterTime(), 240);
        }

        // ===== Fever trigger: perfect 7연속 (피버 중에는 재트리거 안 함) =====
        if (
          !feverEndsAtRef.current &&
          j === 'perfect' &&
          newCombo > 0 &&
          newCombo % DEFENSE_CONFIG.feverTriggerPerfectCount === 0
        ) {
          extraFever = 1;
          const ends = now() + DEFENSE_CONFIG.feverDurationMs;
          setFeverEndsAt(ends);
          setFeverFx({ id: fxIdSeq++, kind: 'enter' });
          setTimeout(() => setFeverFx(f => (f?.kind === 'enter' ? null : f)), 900);
          audio.fanfare();
          audio.setBgmIntensity(3);
          vibrate([30, 20, 30, 20, 60]);
          triggerShake(true);
          showBanner('🔥 FEVER!', `${DEFENSE_CONFIG.feverScoreMultiplier}x SCORE · ${(DEFENSE_CONFIG.feverDurationMs / 1000).toFixed(1)}s`, 'text-primary', 1100);
        }

        // Boss clear detection
        if (
          phase === 'boss' &&
          bossIndexRef.current >= bossPatternRef.current.length &&
          list.filter(x => x.id !== a.id).length === 0
        ) {
          setTimeout(() => {
            setStats(s2 => ({ ...s2, score: s2.score + DEFENSE_CONFIG.scoreBossClear, bossClears: s2.bossClears + 1 }));
            pushFloat(`BOSS CLEAR +${DEFENSE_CONFIG.scoreBossClear}`, 'text-secondary', undefined, true);
            audio.cheer();
            triggerShake(true);
            vibrate([60, 40, 100]);
            showBanner('BOSS CLEAR', `+${DEFENSE_CONFIG.scoreBossClear} BONUS`, 'text-secondary', 900);
            setPhase('playing');
            audio.setBgmIntensity(2);
            nextSpawnAtRef.current = now() + 750;
          }, 250);
        }

        // ===== Round progression =====
        const newDefenseInRound = prev.defenseInRound + 1;
        let newRound = prev.roundReached;
        let nextDefenseInRound = newDefenseInRound;
        let extraShieldsCollected = 0;
        let extraFocus = 0;
        let extraAdrenaline = 0;
        if (newDefenseInRound >= DEFENSE_CONFIG.roundClearTarget) {
          newRound = prev.roundReached + 1;
          nextDefenseInRound = 0;
          // 라운드 클리어 연출
          const clearedRound = prev.roundReached;
          setRoundClearFx({ id: fxIdSeq++, round: clearedRound });
          setTimeout(() => setRoundClearFx(null), DEFENSE_CONFIG.roundClearBannerMs);
          triggerHitstop(DEFENSE_CONFIG.roundClearHitstopMs);
          audio.cheer();
          vibrate([20, 40, 30]);

          // 실드 드롭 판정
          let drop = false;
          if (clearedRound === DEFENSE_CONFIG.firstGuaranteedShieldRound) drop = true;
          else if (clearedRound > DEFENSE_CONFIG.firstGuaranteedShieldRound) {
            drop = Math.random() < DEFENSE_CONFIG.shieldDropChance;
          }
          if (drop) {
            setShields(curr => {
              if (curr >= DEFENSE_CONFIG.maxShieldCount) return curr;
              extraShieldsCollected = 1;
              setShieldFx({ id: fxIdSeq++, kind: 'gain' });
              setTimeout(() => setShieldFx(f => (f?.kind === 'gain' ? null : f)), 1100);
              audio.fanfare();
              vibrate(30);
              return curr + 1;
            });
          }
          // ===== Focus / Adrenaline drop (라운드 3 이후, shield와 무관) =====
          if (clearedRound >= DEFENSE_CONFIG.itemDropEarliestRound) {
            const r = Math.random();
            if (r < DEFENSE_CONFIG.focusDropChance) {
              const ends = now() + DEFENSE_CONFIG.focusDurationMs;
              setFocusEndsAt(ends);
              setItemPickupFx({ id: fxIdSeq++, kind: 'focus' });
              setTimeout(() => setItemPickupFx(f => (f?.kind === 'focus' ? null : f)), 1000);
              audio.fanfare();
              vibrate(20);
              extraFocus = 1;
            } else if (r < DEFENSE_CONFIG.focusDropChance + DEFENSE_CONFIG.adrenalineDropChance) {
              const ends = now() + DEFENSE_CONFIG.adrenalineDurationMs;
              setAdrenalineEndsAt(ends);
              setItemPickupFx({ id: fxIdSeq++, kind: 'adrenaline' });
              setTimeout(() => setItemPickupFx(f => (f?.kind === 'adrenaline' ? null : f)), 1000);
              audio.fanfare();
              vibrate(20);
              extraAdrenaline = 1;
            }
          }
          // 후속 스폰 약간 지연 (연출 시간)
          nextSpawnAtRef.current = Math.max(nextSpawnAtRef.current, now() + 700);
        }

        setCombo(newCombo);
        return {
          ...prev,
          score: newScore,
          perfectCount: newPerfect,
          goodCount: newGood,
          totalAttacks: prev.totalAttacks + 1,
          bestCombo: Math.max(prev.bestCombo, newCombo),
          roundReached: newRound,
          defenseInRound: nextDefenseInRound,
          shieldsCollected: prev.shieldsCollected + extraShieldsCollected,
          feverCount: prev.feverCount + extraFever,
          focusUses: prev.focusUses + extraFocus,
          adrenalineUses: prev.adrenalineUses + extraAdrenaline,
        };
      });

      return list.filter(x => x.id !== a.id);
    });
  }, [phase, paused, combo, startCounterTime, pushFloat, pushBurst, triggerHitstop, triggerShake, triggerBoxerHit, showBanner]);

  const handleCounterTap = useCallback(() => {
    if (phase !== 'counter') return;
    const t = now();
    if (t - lastInputAtRef.current < 50) return;
    lastInputAtRef.current = t;
    if (counterHits >= DEFENSE_CONFIG.counterMaxHits) return;
    setCounterHits(h => h + 1);
    setStats(s => ({ ...s, score: s.score + DEFENSE_CONFIG.scoreCounterHit, counterHits: s.counterHits + 1 }));
    audio.punch();
    vibrate(15);
    pushFloat(`+${DEFENSE_CONFIG.scoreCounterHit}`, 'text-secondary');
    pushBurst(Math.random() < 0.5 ? 'L' : 'R', 'hsl(45 100% 60%)');
  }, [phase, counterHits, pushFloat, pushBurst]);

  // ===== shield save =====
  // Returns true if a shield absorbed the hit; in that case death is prevented.
  const tryConsumeShield = useCallback((): boolean => {
    if (now() < invincibleUntilRef.current) return true; // 무적 중엔 그냥 무시
    let consumed = false;
    setShields(curr => {
      if (curr <= 0) return curr;
      consumed = true;
      return curr - 1;
    });
    if (!consumed) return false;
    // SAVE 연출
    invincibleUntilRef.current = now() + DEFENSE_CONFIG.reviveInvincibleMs;
    setShieldFx({ id: fxIdSeq++, kind: 'save' });
    setTimeout(() => setShieldFx(f => (f?.kind === 'save' ? null : f)), 900);
    showBanner('SAVE!', 'HEADGEAR 발동', 'text-secondary', 750);
    triggerHitstop(180);
    triggerShake(true);
    audio.fanfare();
    vibrate([40, 30, 80]);
    setCombo(0);
    setAttacks([]); // 화면의 진행 중 공격 리셋
    setStats(s => ({ ...s, shieldsSaved: s.shieldsSaved + 1 }));
    nextSpawnAtRef.current = now() + 900;
    return true;
  }, [showBanner, triggerHitstop, triggerShake]);

  // ===== end =====
  const endRun = useCallback((_reason: string) => {
    if (tryConsumeShield()) return; // 실드로 살아남음 — 게임 계속
    triggerShake(true);
    audio.bell();
    audio.stopBgm();
    const finalSurvived = survivedMsLive();
    setStats(s => ({ ...s, endedAt: now(), survivedMs: finalSurvived }));
    setPhase('gameover');
  }, [triggerShake, survivedMsLive, tryConsumeShield]);

  // ===== controls =====
  const startGame = useCallback(() => {
    setStats(emptyStats());
    setCombo(0);
    setAttacks([]);
    setBursts([]);
    setFloats([]);
    setBoxerHit(null);
    setBannerEvent(null);
    setCounterEndsAt(null);
    setCounterHits(0);
    setElapsedSec(0);
    setShields(0);
    setRoundClearFx(null);
    setShieldFx(null);
    setBestRound(getDefenseState().bestRound);
    setFeverEndsAt(null);
    setFeverFx(null);
    setFocusEndsAt(null);
    setAdrenalineEndsAt(null);
    setItemPickupFx(null);
    invincibleUntilRef.current = 0;
    bossPatternRef.current = [];
    bossIndexRef.current = 0;
    bossNextIdxRef.current = 0;
    milestonesShownRef.current = new Set();
    tierIdxRef.current = 0;
    lastSideRef.current = null;
    startedAtRef.current = now();
    totalPausedMsRef.current = 0;
    pausedAtRef.current = null;
    nextSpawnAtRef.current = now() + 1100;
    lastInputAtRef.current = 0;
    setPaused(false);
    audio.bell();
    audio.startBgm(1);
    setPhase('playing');
    showBanner('READY?', 'GO!', 'text-primary', 700);
  }, [showBanner]);

  const goHome = useCallback(() => {
    audio.stopBgm();
    setPhase('home');
    setPaused(false);
    setAttacks([]);
  }, []);

  const togglePause = useCallback(() => {
    setPaused(p => {
      if (!p) {
        pausedAtRef.current = now();
        audio.stopBgm();
      } else if (pausedAtRef.current != null) {
        const diff = now() - pausedAtRef.current;
        totalPausedMsRef.current += diff;
        nextSpawnAtRef.current += diff;
        setAttacks(list => list.map(a => ({
          ...a,
          arriveAt: a.arriveAt + diff,
          feintCancelAt: a.feintCancelAt ? a.feintCancelAt + diff : undefined,
        })));
        if (counterEndsAt) setCounterEndsAt(counterEndsAt + diff);
        pausedAtRef.current = null;
        audio.startBgm(elapsedSec >= 30 ? 2 : 1);
      }
      return !p;
    });
  }, [counterEndsAt, elapsedSec]);

  const gemsEarned = useMemo(() => getGemReward(Math.floor(stats.survivedMs / 1000)), [stats.survivedMs]);

  return {
    phase, paused, stats, combo, attacks,
    shake, hitstop, floats, bursts, boxerHit, bannerEvent,
    counterEndsAt, counterHits, counterMaxHits: DEFENSE_CONFIG.counterMaxHits,
    pressedSide, opponentTheme, gemsEarned,
    elapsedSec,
    // round / shield
    shields, bestRound, roundClearFx, shieldFx,
    maxShields: DEFENSE_CONFIG.maxShieldCount,
    // fever / items
    feverEndsAt, feverFx, focusEndsAt, adrenalineEndsAt, itemPickupFx,
    boxerStyle: getBoxerStyle(stats.roundReached),
    handleGuard, handleCounterTap, startGame, goHome, togglePause,
  };
}

function emptyStats(): DefenseRunStats {
  return {
    score: 0,
    bestCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    totalAttacks: 0,
    counterTimes: 0,
    counterHits: 0,
    bossClears: 0,
    startedAt: now(),
    survivedMs: 0,
    roundReached: 1,
    defenseInRound: 0,
    shieldsCollected: 0,
    shieldsSaved: 0,
    feverCount: 0,
    focusUses: 0,
    adrenalineUses: 0,
  };
}
