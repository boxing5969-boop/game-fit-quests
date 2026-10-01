/**
 * 🎯 미트 드릴 — 플레이 화면 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘·방향 기호).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { ArrowUp, BarChart3, Check, Flag, Home, Pause, PartyPopper, Play, RotateCcw, Wind, X } from 'lucide-react';
import { PunchType, PUNCHES } from '@/features/minigame/types/game';
import type { FallingGlove, RoundOutcome } from '@/features/minigame/hooks/useMittEngine';
import { getRoundConfig } from '@/features/minigame/lib/mittDrillConfig';
import Icon3D from './Icon3D';
import PunchGlyph from './PunchGlyph';
import PauseMenu from './PauseMenu';

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
/** 레인 색 위 글자색 — 골드·아이스는 어두운 글자 */
const PUNCH_TEXT: Record<PunchType, string> = {
  jab: 'text-[hsl(165_70%_7%)]',
  straight: 'text-[hsl(40_60%_8%)]',
  hook: 'text-white',
  upper: 'text-[hsl(210_22%_10%)]',
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
        className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full ${PUNCH_BG[punch]} ${PUNCH_TEXT[punch]} shadow-[0_8px_20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-4 ring-black/40 transition-all ${
          flashing ? 'scale-110 brightness-150' : 'active:brightness-110'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.28), transparent 55%)',
        }}
      >
        <div className="absolute inset-2 rounded-full border-2 border-black/25" />
        <PunchGlyph type={punch} size={30} strokeWidth={2.8} className="relative" />
      </div>
      <span className="mt-1.5 font-display text-[13px] tracking-wider text-foreground/90">
        {meta.nameEn}
      </span>
    </motion.button>
  );
};

/** 통계 칸 */
const StatBox = ({ label, value, tone = 'muted' }: { label: string; value: string | number; tone?: 'muted' | 'gold' | 'red' }) => (
  <div
    className={`rounded-xl p-1.5 ${
      tone === 'gold'
        ? 'bg-secondary/15 ring-1 ring-secondary/30'
        : tone === 'red'
        ? 'bg-destructive/10 ring-1 ring-destructive/30'
        : 'bg-white/[0.05]'
    }`}
  >
    <div className={`font-display text-[10px] tracking-[0.2em] ${tone === 'gold' ? 'text-secondary/80' : tone === 'red' ? 'text-destructive/80' : 'text-muted-foreground'}`}>{label}</div>
    <div className={`mg-num font-display text-base ${tone === 'gold' ? 'text-secondary' : tone === 'red' ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
  </div>
);

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

  const cfg = getRoundConfig(currentStage);
  const energyLow = energy <= 30;
  const energyDanger = energy <= 25;
  const energyCritical = energy > 0 && energy <= 15;

  // 라운드별 분위기 톤 (배경 글로우 색상)
  const moodHue = currentStage <= 2
    ? 'hsl(var(--primary) / 0.22)'        // 민트 — 차분
    : currentStage <= 5
    ? 'hsl(var(--secondary) / 0.2)'       // 골드 — 텐션
    : currentStage <= 9
    ? 'hsl(28 90% 55% / 0.25)'            // 주황 — 긴장
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

  const HIT_ZONE_RATIO = 0.82;

  return (
    <div
      className={`arena-bg relative overflow-hidden ${shaking ? 'shake' : ''}`}
      // 아이폰: body 가 상태바만큼 위 여백을 갖고 있어 100dvh 그대로면 아래 미트가 화면 밖으로 밀린다 (2026-10-01)
      style={{ height: 'calc(100dvh - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column' }}
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
      <div className="relative z-20 border-b border-white/[0.07] bg-card/90 backdrop-blur">
        {/* Energy bar (전면) */}
        <div className="px-3 pt-2">
          <div className="mb-1 flex items-center justify-between pr-11">
            <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">ENERGY</span>
            <span className={`mg-num font-display text-[11px] ${energyLow ? 'text-destructive' : 'text-foreground/80'}`}>
              {Math.round(energy)}
            </span>
          </div>
          <div className="relative mr-11 h-2.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full rounded-full ${
                energy > 60 ? 'bg-gradient-to-r from-primary to-secondary' :
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
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 shrink-0 flex-col">
            <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">ROUND</span>
            <span className="mg-num font-display text-2xl leading-none text-primary">
              {currentStage}
            </span>
            <span className="mg-num text-[10px] text-muted-foreground">BEST {highestCleared}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">SCORE</span>
            <span className="mg-num truncate font-display text-xl leading-none text-secondary">
              {score.toLocaleString()}
            </span>
            {combo >= 3 && (
              <span className="mg-num mt-0.5 flex items-center gap-1 font-display text-[11px] tracking-widest text-secondary">
                <Icon3D name="fire" size={12} /> x{combo}
              </span>
            )}
          </div>
          <div className="flex min-w-0 shrink-0 flex-col items-end">
            <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">TIME</span>
            <span className={`mg-num font-display text-2xl leading-none ${
              stageTime <= 5 ? 'animate-pulse text-destructive' : 'text-foreground'
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
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.6rem)] z-40 flex h-10 w-10 items-center justify-center rounded-full bg-card/85 text-foreground shadow-lg ring-1 ring-white/10 backdrop-blur-md"
      >
        <Pause className="h-4 w-4" fill="currentColor" />
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
            <Icon3D name="bell" size={44} className="mb-2" />
            <div className="mb-3 font-display text-xs tracking-[0.6em] text-muted-foreground">READY</div>
            <div className="mg-num font-display text-7xl leading-none text-primary drop-shadow-[0_0_30px_hsl(var(--primary)/0.7)]">
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
        className="arena-ropes relative flex-1 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at top, hsl(210 18% 11%) 0%, hsl(var(--background)) 60%)',
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
                  className={
                    g.result === 'perfect'
                      ? 'drop-shadow-[0_0_18px_hsl(var(--rating-lightning))]'
                      : 'drop-shadow-[0_0_10px_hsl(var(--rating-fast))]'
                  }
                >
                  <Icon3D name={g.result === 'perfect' ? 'bolt' : 'star'} size={52} />
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
                className="pointer-events-none absolute text-muted-foreground"
                style={{ left: `${left}%`, top: `${(HIT_ZONE_RATIO + 0.05) * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                <Wind className="h-8 w-8" />
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
                className={`flex h-14 w-14 items-center justify-center rounded-full ${PUNCH_BG[g.punch]} ${PUNCH_TEXT[g.punch]} border-2 border-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.5)]`}
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), transparent 55%)',
                }}
              >
                <PunchGlyph type={g.punch} size={28} strokeWidth={2.8} />
              </div>
              <div className="mt-1 font-display text-[11px] tracking-wider text-foreground/70">
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
                className={`flex items-center gap-1.5 whitespace-nowrap font-display tracking-widest ${
                  lastResult.rating === 'perfect'
                    ? 'text-5xl text-rating-lightning drop-shadow-[0_0_18px_hsl(var(--rating-lightning))]'
                    : lastResult.rating === 'good'
                    ? 'text-3xl text-rating-fast'
                    : 'text-3xl text-rating-miss'
                }`}
              >
                {lastResult.rating === 'perfect' ? (
                  <><Icon3D name="bolt" size={40} /> PERFECT!</>
                ) : lastResult.rating === 'good' ? (
                  <><Check className="h-7 w-7" strokeWidth={3} /> GOOD</>
                ) : (
                  <><X className="h-7 w-7" strokeWidth={3} /> MISS</>
                )}
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
              <div className="flex items-center gap-2 font-display text-5xl tracking-widest text-secondary drop-shadow-[0_0_24px_hsl(var(--secondary)/0.9)]">
                {comboMilestone.value >= 10 && <Icon3D name="fire" size={44} />}{comboMilestone.value} COMBO!
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
      <div className="relative z-30 border-t border-white/[0.07] bg-gradient-to-b from-card to-background px-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
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
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
              className="mg-card my-auto w-full max-w-sm p-5 text-center ring-2 ring-secondary/50 shadow-[0_0_60px_hsl(var(--secondary)/0.35)]"
            >
              {/* Top badges */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-2 min-h-[22px]">
                {roundOutcome.newBest && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55 }}
                    className="mg-btn-gold flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] tracking-widest"
                  >
                    <Icon3D name="trophy" size={14} /> NEW BEST
                  </motion.span>
                )}
                {roundOutcome.isFirstClear && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55, delay: 0.1 }}
                    className="mg-btn-primary flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] tracking-widest"
                  >
                    <PartyPopper className="h-3 w-3" /> FIRST CLEAR
                  </motion.span>
                )}
                {roundOutcome.isFirstThreeStar && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mg-btn-gold flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] tracking-widest"
                  >
                    <Icon3D name="star" size={14} /> FIRST 3-STAR
                  </motion.span>
                )}
                {roundOutcome.newStarRecord && !roundOutcome.isFirstClear && !roundOutcome.isFirstThreeStar && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                    transition={{ duration: 0.55 }}
                    className="mg-btn-gold flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] tracking-widest"
                  >
                    <ArrowUp className="h-3 w-3" strokeWidth={3} /> STAR UP {roundOutcome.prevStars}→{roundOutcome.stars?.stars}
                  </motion.span>
                )}
              </div>

              <div className="mb-1 flex justify-center"><Icon3D name="mitt" size={56} /></div>
              <div className="font-display text-3xl tracking-widest text-secondary">ROUND CLEAR</div>
              <div className="mg-num mb-3 text-[11px] text-muted-foreground">ROUND {roundOutcome.round}</div>

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
                        className={
                          earned
                            ? isNew
                              ? 'drop-shadow-[0_0_18px_hsl(45_100%_60%/0.95)]'
                              : 'drop-shadow-[0_0_8px_hsl(45_100%_60%/0.6)]'
                            : ''
                        }
                      >
                        <Icon3D name="star" size={52} dim={!earned} />
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
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                <StatBox label="SCORE" value={`+${roundOutcome.score.toLocaleString()}`} />
                <StatBox label="ACC" value={`${roundOutcome.accuracy}%`} />
                <StatBox label="ENERGY" value={roundOutcome.remainingEnergy} />
              </div>
              <div className="mb-4 grid grid-cols-3 gap-1.5">
                <StatBox label="PERFECT" value={roundOutcome.perfectCount} tone="gold" />
                <StatBox label="GOOD" value={roundOutcome.goodCount} />
                <StatBox label="MISS" value={roundOutcome.missCount} tone="red" />
              </div>

              {/* 다음 목표 힌트 */}
              {roundOutcome.stars && roundOutcome.stars.stars < 3 && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-left text-[12px] text-foreground/85 ring-1 ring-primary/30">
                  <Icon3D name="star" size={22} />
                  <span>
                    {roundOutcome.stars.stars === 1
                      ? '정확도 75%면 별 2개, 90% + 에너지 50이면 별 3개!'
                      : '정확도 90% + 에너지 50 이상이면 별 3개!'}
                  </span>
                </div>
              )}

              {/* CTA — NEXT ROUND 가장 크게 */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                onClick={onNextRound}
                className="mg-btn-primary mb-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-2xl tracking-widest active:brightness-110"
              >
                <Play className="h-6 w-6 fill-current" /> NEXT ROUND {roundOutcome.round + 1}
              </motion.button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRetryRound}
                  className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
                >
                  <RotateCcw className="h-4 w-4" /> {roundOutcome.stars && roundOutcome.stars.stars < 3 ? '별 3개 도전' : 'RETRY'}
                </button>
                <button
                  onClick={onEndSession}
                  className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
                >
                  <Flag className="h-4 w-4" /> END
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
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
              className="mg-card my-auto w-full max-w-sm p-5 text-center ring-2 ring-destructive/50 shadow-[0_0_60px_hsl(var(--destructive)/0.35)]"
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: [0.5, 1.2, 1], rotate: [-10, 5, 0] }}
                transition={{ duration: 0.6 }}
                className="mb-1 flex justify-center"
              >
                <Icon3D name="glove_red" size={64} />
              </motion.div>
              <div className="font-display text-3xl tracking-widest text-destructive">K.O.</div>
              <div className="mg-num mb-3 text-[11px] text-muted-foreground">
                ROUND {roundOutcome.round} ·{' '}
                {roundOutcome.reason === 'ko-streak'
                  ? '연속 미스'
                  : roundOutcome.reason === 'ko-energy'
                  ? '에너지 소진'
                  : '시간 초과'}
              </div>

              {roundOutcome.prevStars > 0 && (
                <div className="mb-3 flex items-center justify-center gap-1">
                  {[1, 2, 3].map(i => (
                    <Icon3D key={i} name="star" size={26} dim={i > roundOutcome.prevStars} />
                  ))}
                  <span className="ml-1 font-display text-[11px] text-muted-foreground">현재 기록</span>
                </div>
              )}

              <div className="mb-2 grid grid-cols-3 gap-1.5">
                <StatBox label="SCORE" value={`+${roundOutcome.score.toLocaleString()}`} />
                <StatBox label="ACC" value={`${roundOutcome.accuracy}%`} />
                <StatBox label="ENERGY" value={roundOutcome.remainingEnergy} />
              </div>
              <div className="mb-3 grid grid-cols-3 gap-1.5">
                <StatBox label="PERFECT" value={roundOutcome.perfectCount} tone="gold" />
                <StatBox label="GOOD" value={roundOutcome.goodCount} />
                <StatBox label="MISS" value={roundOutcome.missCount} tone="red" />
              </div>

              {roundOutcome.failHint && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-left text-[12px] text-foreground/85 ring-1 ring-primary/30">
                  <Icon3D name="book" size={22} />
                  <span>{roundOutcome.failHint}</span>
                </div>
              )}

              {/* RETRY 가장 크게 */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                initial={{ scale: 0.9 }}
                animate={{ scale: [0.9, 1.05, 1] }}
                transition={{ duration: 0.5 }}
                onClick={onRetryRound}
                className="mg-btn-primary mb-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-3xl tracking-widest active:brightness-110"
              >
                <RotateCcw className="h-7 w-7" strokeWidth={2.5} /> RETRY
              </motion.button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onEndSession}
                  className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
                >
                  <BarChart3 className="h-4 w-4" /> 결과 보기
                </button>
                <button
                  onClick={onQuit}
                  className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
                >
                  <Home className="h-4 w-4" /> HOME
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PAUSE OVERLAY ===== */}
      <AnimatePresence>
        {paused && phase === 'playing' && (
          <PauseMenu
            summary={`ROUND ${currentStage} · ${score.toLocaleString()}점`}
            onResume={onResume}
            onRestart={onRestart}
            onQuit={onQuit}
            resumeLabel="RESUME"
            quitLabel="메뉴로"
            restartNote="ROUND 1부터 다시 시작해요"
            quitNote="정말 메뉴로 나갈까요? 진행 상황이 사라집니다."
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MittDrillScreen;
