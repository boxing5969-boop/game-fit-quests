import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { PunchType, PUNCHES } from '@/features/minigame/types/game';
import type { FallingGlove, RoundOutcome } from '@/features/minigame/hooks/useMittEngine';
import { audio, setVibrationEnabled, isVibrationEnabled } from '@/features/minigame/lib/audio';
import { getRoundConfig } from '@/features/minigame/lib/mittDrillConfig';

interface MittDrillScreenProps {
  currentStage: number;
  highestCleared: number;
  stageTime: number;
  energy: number;
  gloves: FallingGlove[];
  score: number;
  combo: number;
  bestCombo: number;
  lastResult: { rating: 'perfect' | 'good' | 'miss'; punch: PunchType } | null;
  wrongShake: number;
  paused: boolean;
  roundOutcome: RoundOutcome | null;
  phase: 'playing' | 'clear' | 'fail';
  comboMilestone: { value: number; key: number } | null;
  energyFloat: { delta: number; key: number } | null;
  perfectFlash: number;
  onPunch: (type: PunchType) => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onRestart: () => void;
  onNextRound: () => void;
  onRetryRound: () => void;
  onEndSession: () => void;
}

const PUNCHES_LIST: PunchType[] = ['jab', 'straight', 'hook', 'upper'];

const PUNCH_BG: Record<PunchType, string> = {
  jab: 'bg-punch-jab',
  straight: 'bg-punch-straight',
  hook: 'bg-punch-hook',
  upper: 'bg-punch-upper',
};

/** Mitt pad — circular leather target with bullseye rings. */
const MittPad = ({
  punch,
  onPress,
  flashing,
}: {
  punch: PunchType;
  onPress: () => void;
  flashing: boolean;
}) => {
  const meta = PUNCHES[punch];
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onPointerDown={onPress}
      className="relative flex flex-col items-center justify-center select-none touch-none focus:outline-none"
      aria-label={`${meta.nameEn} mitt`}
    >
      <div
        className={`relative w-16 h-16 rounded-full ${PUNCH_BG[punch]} ring-4 ring-black/40 shadow-[0_6px_18px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all ${
          flashing ? 'brightness-150 scale-110' : 'active:brightness-110'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), transparent 55%)',
        }}
      >
        <div className="absolute inset-2 rounded-full border-2 border-black/30" />
        <div className="w-3 h-3 rounded-full bg-black/60 shadow-inner" />
      </div>
      <span className="font-display text-xs tracking-wider text-foreground/90 mt-1.5">
        {meta.nameEn}
      </span>
    </motion.button>
  );
};

const MittDrillScreen = ({
  currentStage,
  highestCleared,
  stageTime,
  energy,
  gloves,
  score,
  combo,
  bestCombo,
  lastResult,
  wrongShake,
  paused,
  roundOutcome,
  phase,
  comboMilestone,
  energyFloat,
  perfectFlash,
  onPunch,
  onPause,
  onResume,
  onQuit,
  onRestart,
  onNextRound,
  onRetryRound,
  onEndSession,
}: MittDrillScreenProps) => {
  const [shaking, setShaking] = useState(false);
  const [flashLane, setFlashLane] = useState<PunchType | null>(null);
  const [showRoundBanner, setShowRoundBanner] = useState(true);
  const [bannerPhase, setBannerPhase] = useState<'ready' | 'go' | 'done'>('ready');
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldH, setFieldH] = useState(500);
  const [now, setNow] = useState(performance.now());
  const [soundOn, setSoundOn] = useState(() => audio.isEnabled());
  const [vibrationOn, setVibrationOn] = useState(() => isVibrationEnabled());
  const [confirmQuit, setConfirmQuit] = useState(false);

  const cfg = getRoundConfig(currentStage);
  const energyLow = energy <= 30;
  const energyDanger = energy <= 25;
  const energyCritical = energy > 0 && energy <= 15;

  // 라운드별 분위기 톤 (배경 글로우 색상)
  const moodHue = currentStage <= 2
    ? 'hsl(var(--secondary) / 0.18)'      // 차분
    : currentStage <= 5
    ? 'hsl(var(--primary) / 0.22)'        // 텐션
    : currentStage <= 9
    ? 'hsl(35 90% 55% / 0.25)'            // 주황 — 긴장
    : 'hsl(var(--destructive) / 0.28)';   // 빨강 — 고난도

  // ROUND banner: READY (450ms) → GO (550ms) → done
  useEffect(() => {
    setShowRoundBanner(true);
    setBannerPhase('ready');
    const t1 = setTimeout(() => setBannerPhase('go'), 500);
    const t2 = setTimeout(() => { setBannerPhase('done'); setShowRoundBanner(false); }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [currentStage]);

  useEffect(() => {
    const update = () => {
      if (fieldRef.current) setFieldH(fieldRef.current.clientHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (paused || phase !== 'playing') return;
    let raf: number;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, phase]);

  useEffect(() => {
    if (wrongShake > 0) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(t);
    }
  }, [wrongShake]);

  useEffect(() => {
    if (lastResult && lastResult.rating !== 'miss') {
      setFlashLane(lastResult.punch);
      const t = setTimeout(() => setFlashLane(null), 150);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  // Auto-pause when tab hidden
  useEffect(() => {
    const onHide = () => { if (document.hidden && !paused && phase === 'playing') onPause(); };
    const onBlur = () => { if (!paused && phase === 'playing') onPause(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
    };
  }, [paused, phase, onPause]);

  const toggleSound = () => {
    const next = !soundOn;
    audio.setEnabled(next);
    setSoundOn(next);
  };
  const toggleVibration = () => {
    const next = !vibrationOn;
    setVibrationEnabled(next);
    setVibrationOn(next);
    if (next && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch {}
    }
  };

  const HIT_ZONE_RATIO = 0.82;

  return (
    <div
      className={`relative overflow-hidden bg-background ${shaking ? 'shake' : ''}`}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}
    >
      {/* 라운드 분위기 배경 글로우 */}
      <motion.div
        key={`mood-${currentStage}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${moodHue} 0%, transparent 70%)`,
        }}
      />

      {/* PERFECT 화면 플래시 (hit-stop 느낌) */}
      <AnimatePresence>
        {perfectFlash > 0 && (
          <motion.div
            key={`pf-${perfectFlash}`}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none z-[35] bg-secondary/40 mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* 위험 상태 (≤25%) heartbeat 비네팅 */}
      {energyDanger && phase === 'playing' && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-[15]"
          animate={{ opacity: energyCritical ? [0.45, 0.85, 0.45] : [0.25, 0.55, 0.25] }}
          transition={{ duration: energyCritical ? 0.55 : 0.85, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 110px 40px hsl(var(--destructive) / 0.7)' }}
        />
      )}

      {/* ===== TOP HUD ===== */}
      <div className="border-b border-border bg-card/95 backdrop-blur relative z-20">
        {/* Energy bar (전면) */}
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-display tracking-widest text-muted-foreground">ENERGY</span>
            <span className={`text-[10px] font-display tabular-nums ${energyLow ? 'text-destructive' : 'text-foreground/80'}`}>
              {Math.round(energy)}
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden relative">
            <motion.div
              className={`h-full rounded-full ${
                energy > 60 ? 'bg-gradient-to-r from-emerald-500 to-secondary' :
                energy > 30 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                              'bg-gradient-to-r from-rose-500 to-destructive'
              }`}
              animate={{ width: `${energy}%` }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            />
            {energyLow && (
              <motion.div
                className="absolute inset-0 bg-destructive/30"
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between px-3 py-2 gap-2">
          <div className="flex flex-col min-w-0 shrink-0">
            <span className="text-[9px] uppercase text-muted-foreground tracking-widest">Round</span>
            <span className="font-display text-2xl text-primary tabular-nums leading-none">
              {currentStage}
            </span>
            <span className="text-[9px] text-muted-foreground tabular-nums">BEST {highestCleared}</span>
          </div>
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-[9px] uppercase text-muted-foreground tracking-widest">Score</span>
            <span className="font-display text-xl text-secondary tabular-nums leading-none truncate">
              {score.toLocaleString()}
            </span>
            {combo >= 3 && (
              <span className="text-[10px] font-display text-secondary tracking-widest mt-0.5">
                🔥 x{combo}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end min-w-0 shrink-0">
            <span className="text-[9px] uppercase text-muted-foreground tracking-widest">Time</span>
            <span className={`font-display text-2xl tabular-nums leading-none ${
              stageTime <= 5 ? 'text-destructive animate-pulse' : 'text-foreground'
            }`}>
              {stageTime}<span className="text-xs text-muted-foreground">s</span>
            </span>
          </div>
        </div>
      </div>

      {/* MENU button */}
      <motion.button
        onClick={onPause}
        aria-label="메뉴 / 일시정지"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        whileTap={{ scale: 0.9 }}
        className="fixed top-3 right-3 z-40 w-10 h-10 rounded-full bg-card/90 border border-border text-foreground shadow-lg flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      </motion.button>

      {/* ===== ROUND START BANNER (READY → GO) ===== */}
      <AnimatePresence mode="wait">
        {showRoundBanner && phase === 'playing' && bannerPhase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none bg-background/55 backdrop-blur-sm"
          >
            <div className="font-display text-xs tracking-[0.6em] text-muted-foreground mb-3">READY</div>
            <div className="font-display text-7xl text-primary leading-none drop-shadow-[0_0_30px_hsl(var(--primary)/0.7)]">
              ROUND {currentStage}
            </div>
            <div className="text-[11px] text-muted-foreground mt-3 font-display tracking-widest">
              {cfg.durationSec}s · {cfg.spawnIntervalMs <= 700 ? 'FAST' : cfg.spawnIntervalMs <= 1100 ? 'STEADY' : 'EASY'}
            </div>
          </motion.div>
        )}
        {showRoundBanner && phase === 'playing' && bannerPhase === 'go' && (
          <motion.div
            key="go"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: [0.5, 1.25, 1] }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
            <div className="font-display text-[7rem] text-secondary leading-none drop-shadow-[0_0_40px_hsl(var(--secondary)/0.9)]">
              GO!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== FALLING FIELD ===== */}
      <div
        ref={fieldRef}
        className="flex-1 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at top, hsl(var(--card)) 0%, hsl(var(--background)) 60%)',
        }}
      >
        {/* Lane dividers */}
        <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
          {PUNCHES_LIST.map((_, i) => (
            <div key={i} className="border-r border-border/15 last:border-r-0" />
          ))}
        </div>

        {/* Hit zone */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: `${HIT_ZONE_RATIO * 100 - 6}%`, height: '12%' }}
        >
          <div className="w-full h-full bg-gradient-to-b from-transparent via-secondary/10 to-transparent" />
        </div>
        <div
          className="absolute left-0 right-0 h-[2px] bg-secondary shadow-[0_0_24px_hsl(var(--secondary))] pointer-events-none"
          style={{ top: `${HIT_ZONE_RATIO * 100}%` }}
        />

        {/* Falling gloves */}
        {phase === 'playing' && gloves.map(g => {
          const elapsed = now - g.spawnedAt;
          const progress = Math.min(elapsed / g.duration, 1.2);
          const targetY = HIT_ZONE_RATIO * fieldH;
          const y = progress * targetY;
          const laneWidth = 100 / 4;
          const left = g.lane * laneWidth + laneWidth / 2;

          if (g.hit) {
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.35 }}
                className="absolute pointer-events-none"
                style={{ left: `${left}%`, top: `${HIT_ZONE_RATIO * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className={`text-5xl ${
                    g.result === 'perfect'
                      ? 'drop-shadow-[0_0_18px_hsl(var(--rating-lightning))]'
                      : 'drop-shadow-[0_0_10px_hsl(var(--rating-fast))]'
                  }`}
                >
                  {g.result === 'perfect' ? '⚡' : '✨'}
                </div>
              </motion.div>
            );
          }
          if (g.missed) {
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.4 }}
                className="absolute pointer-events-none text-3xl"
                style={{ left: `${left}%`, top: `${(HIT_ZONE_RATIO + 0.05) * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                💨
              </motion.div>
            );
          }

          return (
            <div
              key={g.id}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{ left: `${left}%`, top: `${y}px`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`w-14 h-14 rounded-full ${PUNCH_BG[g.punch]} shadow-[0_4px_14px_rgba(0,0,0,0.5)] flex items-center justify-center text-3xl border-2 border-white/20`}
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), transparent 55%)',
                }}
              >
                {PUNCHES[g.punch].emoji}
              </div>
              <div className="text-[10px] font-display tracking-wider text-foreground/70 mt-1">
                {PUNCHES[g.punch].nameEn}
              </div>
            </div>
          );
        })}

        {/* Feedback flash — PERFECT는 더 크고 강하게 */}
        <AnimatePresence>
          {lastResult && phase === 'playing' && (
            <motion.div
              key={`${lastResult.rating}-${gloves.length}-${score}`}
              initial={{ opacity: 0, scale: lastResult.rating === 'perfect' ? 0.4 : 0.7, y: 0 }}
              animate={{
                opacity: 1,
                scale: lastResult.rating === 'perfect' ? [0.4, 1.4, 1.1] : 1,
                y: lastResult.rating === 'miss' ? 8 : 0,
              }}
              exit={{ opacity: 0, scale: 1.3, y: -10 }}
              transition={{ duration: lastResult.rating === 'perfect' ? 0.35 : 0.28 }}
              className="absolute left-1/2 pointer-events-none z-20"
              style={{ top: `${HIT_ZONE_RATIO * 100 - 14}%`, transform: 'translateX(-50%)' }}
            >
              <div
                className={`font-display tracking-widest whitespace-nowrap ${
                  lastResult.rating === 'perfect'
                    ? 'text-5xl text-rating-lightning drop-shadow-[0_0_18px_hsl(var(--rating-lightning))]'
                    : lastResult.rating === 'good'
                    ? 'text-3xl text-rating-fast'
                    : 'text-3xl text-rating-miss'
                }`}
              >
                {lastResult.rating === 'perfect'
                  ? '⚡ PERFECT!'
                  : lastResult.rating === 'good'
                  ? '✅ GOOD'
                  : '❌ MISS'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 콤보 마일스톤 팝업 (3/5/10/15/20/30) */}
        <AnimatePresence>
          {comboMilestone && (
            <motion.div
              key={`combo-${comboMilestone.key}`}
              initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
              animate={{ opacity: 1, scale: [0.4, 1.3, 1], rotate: [-8, 4, 0] }}
              exit={{ opacity: 0, scale: 1.6, y: -30 }}
              transition={{ duration: 0.55 }}
              className="absolute inset-x-0 pointer-events-none z-20 flex justify-center"
              style={{ top: '24%' }}
            >
              <div className="font-display text-5xl tracking-widest text-secondary drop-shadow-[0_0_24px_hsl(var(--secondary)/0.9)]">
                {comboMilestone.value >= 10 ? '🔥 ' : ''}{comboMilestone.value} COMBO!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 에너지 회복 플로팅 +N */}
        <AnimatePresence>
          {energyFloat && energyFloat.delta > 0 && (
            <motion.div
              key={`ef-${energyFloat.key}`}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -34, scale: 1 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.7 }}
              className="absolute pointer-events-none z-20 left-3 top-2 font-display text-sm text-secondary drop-shadow-[0_0_10px_hsl(var(--secondary)/0.8)]"
            >
              +{energyFloat.delta}
            </motion.div>
          )}
        </AnimatePresence>


        {/* Energy low warning vignette */}
        {energyLow && phase === 'playing' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            style={{
              boxShadow: 'inset 0 0 80px 30px hsl(var(--destructive) / 0.6)',
            }}
          />
        )}
      </div>

      {/* ===== MITT PADS ===== */}
      <div className="bg-gradient-to-b from-card to-background border-t border-border relative z-30 pt-3 pb-5 px-3">
        <div className="grid grid-cols-4 gap-1">
          {PUNCHES_LIST.map(type => (
            <div key={type} className="flex justify-center">
              <MittPad
                punch={type}
                onPress={() => onPunch(type)}
                flashing={flashLane === type}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ===== ROUND CLEAR MODAL ===== */}
      <AnimatePresence>
        {phase === 'clear' && roundOutcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center px-4 py-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
              className="bg-card border-2 border-secondary/50 rounded-3xl p-5 w-full max-w-sm shadow-[0_0_60px_hsl(var(--secondary)/0.4)] text-center my-auto"
            >
              {/* Top badges */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-2 min-h-[22px]">
                {roundOutcome.newBest && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55 }}
                    className="bg-gradient-to-r from-secondary to-primary text-secondary-foreground rounded-full px-2.5 py-0.5 font-display text-[10px] tracking-widest"
                  >
                    🏆 NEW BEST
                  </motion.span>
                )}
                {roundOutcome.isFirstClear && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55, delay: 0.1 }}
                    className="bg-primary/90 text-primary-foreground rounded-full px-2.5 py-0.5 font-display text-[10px] tracking-widest"
                  >
                    🎉 FIRST CLEAR
                  </motion.span>
                )}
                {roundOutcome.isFirstThreeStar && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black rounded-full px-2.5 py-0.5 font-display text-[10px] tracking-widest"
                  >
                    ⭐ FIRST 3-STAR
                  </motion.span>
                )}
                {roundOutcome.newStarRecord && !roundOutcome.isFirstClear && !roundOutcome.isFirstThreeStar && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55 }}
                    className="bg-amber-500/90 text-black rounded-full px-2.5 py-0.5 font-display text-[10px] tracking-widest"
                  >
                    ⬆ STAR UP {roundOutcome.prevStars}→{roundOutcome.stars?.stars}
                  </motion.span>
                )}
              </div>

              <div className="text-4xl mb-1">🥊</div>
              <div className="font-display text-3xl text-secondary tracking-widest">ROUND CLEAR</div>
              <div className="text-[11px] text-muted-foreground mb-3">ROUND {roundOutcome.round}</div>

              {/* Stars */}
              {roundOutcome.stars && (
                <div className="flex justify-center gap-3 mb-2 min-h-[60px] items-center">
                  {[1, 2, 3].map(i => {
                    const earned = i <= roundOutcome.stars!.stars;
                    const isNew = earned && i > roundOutcome.prevStars;
                    return (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, rotate: -180, opacity: 0 }}
                        animate={{
                          scale: earned ? (isNew ? [0, 1.6, 1] : [0, 1.2, 1]) : [0, 1],
                          rotate: 0,
                          opacity: 1,
                        }}
                        transition={{ delay: 0.3 + i * 0.2, duration: 0.6, type: 'spring', damping: 8 }}
                        className={`text-5xl ${
                          earned
                            ? isNew
                              ? 'drop-shadow-[0_0_18px_hsl(45_100%_60%/0.95)]'
                              : 'drop-shadow-[0_0_8px_hsl(45_100%_60%/0.6)]'
                            : 'opacity-20 grayscale'
                        }`}
                      >
                        ⭐
                      </motion.div>
                    );
                  })}
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="font-display text-xs tracking-widest text-secondary mb-3"
              >
                {roundOutcome.stars?.label}
              </motion.div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">SCORE</div>
                  <div className="font-display text-sm text-foreground tabular-nums">+{roundOutcome.score.toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">ACC</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.accuracy}%</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">ENERGY</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.remainingEnergy}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                <div className="bg-secondary/15 rounded-lg p-1.5 border border-secondary/30">
                  <div className="text-[8px] text-secondary/80 tracking-widest">⚡PERFECT</div>
                  <div className="font-display text-sm text-secondary tabular-nums">{roundOutcome.perfectCount}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">✓ GOOD</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.goodCount}</div>
                </div>
                <div className="bg-destructive/10 rounded-lg p-1.5 border border-destructive/30">
                  <div className="text-[8px] text-destructive/80 tracking-widest">✗ MISS</div>
                  <div className="font-display text-sm text-destructive tabular-nums">{roundOutcome.missCount}</div>
                </div>
              </div>

              {/* 다음 목표 힌트 */}
              {roundOutcome.stars && roundOutcome.stars.stars < 3 && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-foreground/80">
                  💡 {roundOutcome.stars.stars === 1
                    ? '정확도 75%면 ⭐⭐, 90%+에너지 50이면 ⭐⭐⭐!'
                    : '정확도 90% + 에너지 50 이상이면 ⭐⭐⭐!'}
                </div>
              )}

              {/* CTA — NEXT ROUND 가장 크게 */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                onClick={onNextRound}
                className="w-full bg-primary text-primary-foreground rounded-2xl font-display tracking-widest py-4 text-2xl shadow-[0_8px_30px_hsl(var(--primary)/0.6)] border-2 border-primary-foreground/20 active:brightness-110 mb-2"
              >
                ▶ NEXT ROUND {roundOutcome.round + 1}
              </motion.button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRetryRound}
                  className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
                >
                  🔄 {roundOutcome.stars && roundOutcome.stars.stars < 3 ? '3성 도전' : 'RETRY'}
                </button>
                <button
                  onClick={onEndSession}
                  className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
                >
                  🏁 END
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ROUND FAIL (KO) MODAL ===== */}
      <AnimatePresence>
        {phase === 'fail' && roundOutcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center px-4 py-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
              className="bg-card border-2 border-destructive/60 rounded-3xl p-5 w-full max-w-sm shadow-[0_0_60px_hsl(var(--destructive)/0.4)] text-center my-auto"
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: [0.5, 1.2, 1], rotate: [-10, 5, 0] }}
                transition={{ duration: 0.6 }}
                className="text-5xl mb-1"
              >
                💥
              </motion.div>
              <div className="font-display text-3xl text-destructive tracking-widest">K.O.</div>
              <div className="text-[11px] text-muted-foreground mb-3">
                ROUND {roundOutcome.round} ·{' '}
                {roundOutcome.reason === 'ko-streak'
                  ? '연속 미스'
                  : roundOutcome.reason === 'ko-energy'
                  ? '에너지 소진'
                  : '시간 초과'}
              </div>

              {roundOutcome.prevStars > 0 && (
                <div className="flex justify-center items-center gap-1 mb-3">
                  {[1, 2, 3].map(i => (
                    <span key={i} className={`text-2xl ${i <= roundOutcome.prevStars ? '' : 'opacity-20 grayscale'}`}>⭐</span>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1 font-display">현재 기록</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">SCORE</div>
                  <div className="font-display text-sm text-foreground tabular-nums">+{roundOutcome.score.toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">ACC</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.accuracy}%</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">ENERGY</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.remainingEnergy}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <div className="bg-secondary/15 rounded-lg p-1.5 border border-secondary/30">
                  <div className="text-[8px] text-secondary/80 tracking-widest">⚡PERFECT</div>
                  <div className="font-display text-sm text-secondary tabular-nums">{roundOutcome.perfectCount}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-1.5">
                  <div className="text-[8px] text-muted-foreground tracking-widest">✓ GOOD</div>
                  <div className="font-display text-sm text-foreground tabular-nums">{roundOutcome.goodCount}</div>
                </div>
                <div className="bg-destructive/10 rounded-lg p-1.5 border border-destructive/30">
                  <div className="text-[8px] text-destructive/80 tracking-widest">✗ MISS</div>
                  <div className="font-display text-sm text-destructive tabular-nums">{roundOutcome.missCount}</div>
                </div>
              </div>

              {roundOutcome.failHint && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-foreground/85">
                  💡 {roundOutcome.failHint}
                </div>
              )}

              {/* RETRY 가장 크게 */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                initial={{ scale: 0.9 }}
                animate={{ scale: [0.9, 1.05, 1] }}
                transition={{ duration: 0.5 }}
                onClick={onRetryRound}
                className="w-full bg-primary text-primary-foreground rounded-2xl font-display tracking-widest py-4 text-3xl shadow-[0_10px_40px_hsl(var(--primary)/0.7)] border-2 border-primary-foreground/20 active:brightness-110 mb-2"
              >
                🔄 RETRY
              </motion.button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onEndSession}
                  className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
                >
                  📊 결과 보기
                </button>
                <button
                  onClick={onQuit}
                  className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
                >
                  🏠 HOME
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PAUSE OVERLAY ===== */}
      <AnimatePresence>
        {paused && phase === 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-1">⏸</div>
                <h3 className="font-display text-2xl tracking-widest text-foreground">PAUSED</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  ROUND {currentStage} · {score.toLocaleString()}점
                </p>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 mb-3 space-y-2 border border-border/60">
                <button
                  onClick={toggleSound}
                  className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">{soundOn ? '🔊' : '🔇'}</span>사운드
                  </span>
                  <span className={`relative w-10 h-5 rounded-full transition-colors ${soundOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${soundOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
                <button
                  onClick={toggleVibration}
                  className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">{vibrationOn ? '📳' : '📴'}</span>진동
                  </span>
                  <span className={`relative w-10 h-5 rounded-full transition-colors ${vibrationOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${vibrationOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </div>

              <button
                onClick={onResume}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-display tracking-widest mb-2 active:brightness-110"
              >
                ▶ RESUME
              </button>
              <button
                onClick={onRestart}
                className="w-full bg-card border border-border text-foreground py-3 rounded-xl font-display text-sm tracking-widest mb-2 active:scale-95"
              >
                🔄 처음부터
              </button>
              <button
                onClick={() => setConfirmQuit(true)}
                className="w-full bg-card border border-border text-muted-foreground py-3 rounded-xl font-display text-sm tracking-widest active:scale-95"
              >
                🏠 메뉴로
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quit confirm */}
      <AnimatePresence>
        {confirmQuit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/95 flex items-center justify-center px-6"
          >
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-sm text-foreground mb-4">정말 메뉴로 나갈까요? 진행 상황이 사라집니다.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmQuit(false)} className="bg-muted text-foreground py-3 rounded-xl font-display text-xs">취소</button>
                <button onClick={onQuit} className="bg-destructive text-destructive-foreground py-3 rounded-xl font-display text-xs">나가기</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MittDrillScreen;
