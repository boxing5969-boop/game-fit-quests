import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { PunchType, PUNCHES } from '@/features/minigame/types/game';
import { CueResult } from '@/features/minigame/types/reaction';
import { audio, setVibrationEnabled, isVibrationEnabled } from '@/features/minigame/lib/audio';
import { getRoundTheme, REACTION_CONFIG } from '@/features/minigame/lib/reactionConfig';

interface GameScreenProps {
  // playing state
  currentPunch: PunchType | null;
  waiting: boolean;
  lastResult: CueResult | null;
  showFeedback: boolean;
  currentScore: number;
  currentCombo: number;
  wrongShake: number;

  // endless state
  round: number;
  successesInRound: number;
  roundTarget: number;
  shields: number;
  feverActive: boolean;
  feverProgress: number;
  elapsedSec: number;
  shieldSavedFlash: number;
  roundClearFlash: number;
  feverEnterFlash: number;
  bestRoundLive: number;
  bestScoreLive: number;

  paused: boolean;
  onPunch: (type: PunchType) => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

const PUNCH_BG: Record<PunchType, string> = {
  jab: 'bg-punch-jab',
  straight: 'bg-punch-straight',
  hook: 'bg-punch-hook',
  upper: 'bg-punch-upper',
};

const PUNCH_TEXT: Record<PunchType, string> = {
  jab: 'text-white',
  straight: 'text-white',
  hook: 'text-black',
  upper: 'text-white',
};

const PUNCH_BTN: Record<PunchType, string> = {
  jab: 'bg-punch-jab text-white',
  straight: 'bg-punch-straight text-white',
  hook: 'bg-punch-hook text-black',
  upper: 'bg-punch-upper text-white',
};

const JUDGEMENT_INFO = {
  perfect: { emoji: '⚡', en: 'PERFECT', ko: '퍼펙트', color: 'text-rating-lightning' },
  good:    { emoji: '✅', en: 'GOOD',    ko: '굿',     color: 'text-rating-fast' },
  miss:    { emoji: '❌', en: 'MISS',    ko: '미스',   color: 'text-rating-miss' },
} as const;

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const GameScreen = ({
  currentPunch, lastResult, showFeedback, currentScore, currentCombo, wrongShake,
  round, successesInRound, roundTarget, shields, feverActive, feverProgress, elapsedSec,
  shieldSavedFlash, roundClearFlash, feverEnterFlash, bestRoundLive, bestScoreLive,
  paused, onPunch, onPause, onResume, onQuit, onRestart,
}: GameScreenProps) => {
  const judge = lastResult ? JUDGEMENT_INFO[lastResult.judgement] : null;

  const [shaking, setShaking] = useState(false);
  const [soundOn, setSoundOn] = useState(() => audio.isEnabled());
  const [vibrationOn, setVibrationOn] = useState(() => isVibrationEnabled());
  const [showHelp, setShowHelp] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [showRoundClear, setShowRoundClear] = useState(false);
  const [showShieldSave, setShowShieldSave] = useState(false);
  const [showFeverEnter, setShowFeverEnter] = useState(false);

  const theme = useMemo(() => getRoundTheme(round), [round]);

  useEffect(() => {
    if (wrongShake > 0) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(t);
    }
  }, [wrongShake]);

  useEffect(() => {
    if (roundClearFlash > 0) {
      setShowRoundClear(true);
      const t = setTimeout(() => setShowRoundClear(false), 1100);
      return () => clearTimeout(t);
    }
  }, [roundClearFlash]);

  useEffect(() => {
    if (shieldSavedFlash > 0) {
      setShowShieldSave(true);
      const t = setTimeout(() => setShowShieldSave(false), 900);
      return () => clearTimeout(t);
    }
  }, [shieldSavedFlash]);

  useEffect(() => {
    if (feverEnterFlash > 0) {
      setShowFeverEnter(true);
      const t = setTimeout(() => setShowFeverEnter(false), 1200);
      return () => clearTimeout(t);
    }
  }, [feverEnterFlash]);

  // Auto-pause on tab hide
  useEffect(() => {
    const onHide = () => { if (document.hidden && !paused) onPause(); };
    const onBlur = () => { if (!paused) onPause(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
    };
  }, [paused, onPause]);

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

  // === Hit-stop & particle juice for PERFECT ===
  const [hitStopKey, setHitStopKey] = useState(0);
  const [popups, setPopups] = useState<{ id: number; text: string; sub?: string; color: string }[]>([]);
  const [particles, setParticles] = useState<{ id: number; tx: number; ty: number; color: string }[]>([]);
  const [rings, setRings] = useState<{ id: number; color: string }[]>([]);

  useEffect(() => {
    if (!lastResult || !showFeedback) return;
    if (!lastResult.correct) return;
    const id = lastResult.timestamp;

    if (lastResult.judgement === 'perfect') {
      setHitStopKey(k => k + 1);
      const accent = theme.accent;
      // popup
      setPopups(prev => [...prev, {
        id, text: 'PERFECT', sub: `+${lastResult.points}`,
        color: 'hsl(var(--rating-lightning))',
      }]);
      // ring
      setRings(prev => [...prev, { id, color: accent }]);
      // 8 particles
      const newParts = Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
        const dist  = 70 + Math.random() * 60;
        return {
          id: id * 100 + i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          color: i % 2 === 0 ? accent : 'hsl(var(--rating-lightning))',
        };
      });
      setParticles(prev => [...prev, ...newParts]);
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== id));
        setRings(prev => prev.filter(r => r.id !== id));
        setParticles(prev => prev.filter(p => Math.floor(p.id / 100) !== id));
      }, 700);
    } else if (lastResult.judgement === 'good') {
      setPopups(prev => [...prev, {
        id, text: 'GOOD', sub: `+${lastResult.points}`,
        color: 'hsl(var(--rating-fast))',
      }]);
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== id));
      }, 600);
    }
  }, [lastResult, showFeedback, theme.accent]);

  // 등반 진행
  const climbProgress = Math.min(1, successesInRound / roundTarget);

  return (
    <div
      className={`game-viewport flex flex-col ${shaking ? 'shake' : ''}`}
      style={{
        background: feverActive
          ? 'radial-gradient(circle at 50% 30%, hsl(0 90% 25%), hsl(0 60% 8%) 70%, hsl(0 0% 0%))'
          : `radial-gradient(circle at 50% 25%, hsl(${theme.hue} 70% 14%), hsl(${theme.hue} 40% 6%) 70%, hsl(0 0% 0%))`,
        transition: 'background 0.6s ease',
      }}
    >
      {/* === 등반 배경: 위로 흐르는 패럴랙스 === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[0, 1, 2].map(layer => (
          <motion.div
            key={layer}
            className="absolute inset-x-0"
            style={{
              top: `${-100 + layer * 50}%`,
              height: '300%',
              backgroundImage: `repeating-linear-gradient(
                to bottom,
                transparent 0,
                transparent ${80 + layer * 20}px,
                hsl(${theme.hue} 80% 60% / ${0.06 + layer * 0.02}) ${80 + layer * 20}px,
                hsl(${theme.hue} 80% 60% / ${0.06 + layer * 0.02}) ${82 + layer * 20}px
              )`,
            }}
            animate={{ y: ['-50%', '0%'] }}
            transition={{
              duration: feverActive ? 2 - layer * 0.3 : 6 - layer,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
        {/* boxer 등반 실루엣 */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 text-5xl opacity-40 select-none"
          animate={{
            bottom: `${20 + climbProgress * 18}%`,
            scale: feverActive ? [1, 1.08, 1] : 1,
          }}
          transition={{
            bottom: { type: 'spring', damping: 18, stiffness: 120 },
            scale: { duration: 0.6, repeat: feverActive ? Infinity : 0 },
          }}
          style={{ filter: `drop-shadow(0 0 12px ${theme.accent})` }}
        >
          🥊
        </motion.div>
      </div>

      {/* Full-screen flash card (cue) */}
      <AnimatePresence>
        {currentPunch && !showFeedback && (
          <motion.div
            key={`flash-${currentPunch}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`absolute inset-x-4 top-[26%] bottom-[30%] rounded-3xl ${PUNCH_BG[currentPunch]} ${PUNCH_TEXT[currentPunch]} flex flex-col items-center justify-center z-30 shadow-2xl`}
            style={{ boxShadow: `0 20px 80px hsl(var(--primary) / 0.5)` }}
          >
            <div className="text-center">
              <div className="text-8xl mb-2 drop-shadow-2xl">{PUNCHES[currentPunch].emoji}</div>
              <div className="font-display text-6xl tracking-wider drop-shadow-lg">
                {PUNCHES[currentPunch].nameEn}
              </div>
              <div className="text-2xl font-display mt-1 opacity-90">
                {PUNCHES[currentPunch].nameKo}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Hit-stop white flash (PERFECT) === */}
      {hitStopKey > 0 && (
        <div
          key={`hs-${hitStopKey}`}
          className="absolute inset-0 z-[35] pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 45%, hsl(0 0% 100% / 0.45) 0%, transparent 60%)',
            animation: 'mg-hit-stop 0.22s ease-out forwards',
          }}
        />
      )}

      {/* === Perfect/Good popups === */}
      <div className="absolute inset-0 z-[36] pointer-events-none flex items-center justify-center">
        {popups.map(p => (
          <div
            key={p.id}
            className="absolute font-display text-5xl tracking-widest perfect-pop"
            style={{
              color: p.color,
              textShadow: `0 0 20px ${p.color}, 0 0 40px ${p.color}`,
            }}
          >
            {p.text}
            {p.sub && <div className="text-2xl mt-0.5 text-foreground drop-shadow">{p.sub}</div>}
          </div>
        ))}
      </div>

      {/* === Particles === */}
      <div className="absolute inset-0 z-[36] pointer-events-none flex items-center justify-center">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute w-2.5 h-2.5 rounded-full particle"
            style={{
              background: p.color,
              boxShadow: `0 0 12px ${p.color}`,
              ['--tx' as any]: `${p.tx}px`,
              ['--ty' as any]: `${p.ty}px`,
            }}
          />
        ))}
      </div>

      {/* === Rings === */}
      <div className="absolute inset-0 z-[36] pointer-events-none flex items-center justify-center">
        {rings.map(r => (
          <div
            key={r.id}
            className="absolute w-32 h-32 rounded-full ring-pulse"
            style={{ borderStyle: 'solid', borderColor: r.color }}
          />
        ))}
      </div>

      {/* === Top HUD === */}
      <div className="relative z-20 px-3 pt-2 pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Round */}
          <div className="bg-card/80 backdrop-blur border border-border rounded-xl px-3 py-1.5 min-w-[78px]">
            <div className="text-[9px] font-display tracking-widest text-muted-foreground leading-none">ROUND</div>
            <div className="font-display text-2xl text-foreground leading-none mt-0.5 tabular-nums">{round}</div>
            <div className="text-[9px] text-muted-foreground/70 leading-none mt-1">BEST {bestRoundLive}</div>
          </div>

          {/* Score */}
          <div className="bg-card/80 backdrop-blur border border-border rounded-xl px-3 py-1.5 flex-1 text-center">
            <div className="text-[9px] font-display tracking-widest text-muted-foreground leading-none">SCORE</div>
            <div className="font-display text-2xl text-secondary leading-none mt-0.5 tabular-nums">{currentScore.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground/70 leading-none mt-1">BEST {bestScoreLive.toLocaleString()}</div>
          </div>

          {/* Time + Shield */}
          <div className="bg-card/80 backdrop-blur border border-border rounded-xl px-3 py-1.5 min-w-[78px] text-right">
            <div className="text-[9px] font-display tracking-widest text-muted-foreground leading-none">TIME</div>
            <div className="font-display text-xl text-foreground leading-none mt-0.5 tabular-nums">{fmtTime(elapsedSec)}</div>
            <div className="flex items-center justify-end gap-1 mt-1 flex-wrap max-w-[80px]">
              {Array.from({ length: Math.max(REACTION_CONFIG.maxShieldCount, shields) }).map((_, i) => (
                <span
                  key={i}
                  className={`text-sm transition-all ${i < shields ? 'opacity-100 scale-100' : 'opacity-25 scale-90 grayscale'}`}
                >🛡️</span>
              ))}
            </div>
          </div>
        </div>

        {/* Round progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${theme.accent}, hsl(var(--secondary)))` }}
            animate={{ width: `${(successesInRound / roundTarget) * 100}%` }}
            transition={{ type: 'spring', damping: 18 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] font-display tracking-widest text-muted-foreground">
            {successesInRound} / {roundTarget} TO ROUND {round + 1}
          </span>
          {currentCombo >= 3 && (
            <span className="text-[10px] font-display text-secondary">
              🔥 COMBO {currentCombo}
            </span>
          )}
        </div>
      </div>

      {/* Pause button */}
      <motion.button
        onClick={onPause}
        aria-label="일시정지"
        whileTap={{ scale: 0.9 }}
        className="fixed top-3 right-3 z-40 w-10 h-10 rounded-full bg-primary/90 text-primary-foreground shadow-lg border-2 border-primary-foreground/20 flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      </motion.button>

      {/* === Main feedback area === */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <AnimatePresence mode="wait">
          {showFeedback && lastResult && judge ? (
            <motion.div
              key={`fb-${lastResult.timestamp}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="text-center px-4"
            >
              <div className="text-7xl mb-1">{judge.emoji}</div>
              <div className={`font-display text-5xl ${judge.color} drop-shadow-lg`}>
                {judge.en}
              </div>
              {lastResult.correct && (
                <div className="font-display text-3xl text-foreground mt-2 tabular-nums">
                  {Math.round(lastResult.reactionMs)}<span className="text-lg text-muted-foreground">ms</span>
                </div>
              )}
              <div className={`font-display text-2xl mt-1 ${lastResult.points >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {lastResult.points >= 0 ? '+' : ''}{lastResult.points}
              </div>
            </motion.div>
          ) : (
            !currentPunch && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="font-display text-3xl text-muted-foreground tracking-widest">
                  GET READY
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* === Punch buttons === */}
      <div className="grid grid-cols-4 gap-2 p-3 pb-6 relative z-40">
        {(['jab', 'straight', 'hook', 'upper'] as PunchType[]).map(type => (
          <motion.button
            key={type}
            whileTap={{ scale: 0.9 }}
            onPointerDown={() => onPunch(type)}
            className={`punch-btn ${PUNCH_BTN[type]} py-3 shadow-lg active:brightness-110`}
          >
            <span className="text-2xl">{PUNCHES[type].emoji}</span>
            <span className="font-display text-sm tracking-wider mt-1">{PUNCHES[type].nameEn}</span>
          </motion.button>
        ))}
      </div>

      {/* === FEVER overlay === */}
      <AnimatePresence>
        {feverActive && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                background: 'radial-gradient(circle at 50% 50%, transparent 30%, hsl(0 90% 50% / 0.18) 100%)',
                mixBlendMode: 'screen',
              }}
            />
            <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <motion.div
                initial={{ scale: 0.7 }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="font-display text-2xl text-rating-lightning tracking-widest drop-shadow-[0_0_12px_hsl(0_90%_60%)]"
              >
                🔥 FEVER x{REACTION_CONFIG.feverScoreMultiplier} 🔥
              </motion.div>
              <div className="h-1 mt-1 bg-muted/40 rounded-full overflow-hidden w-32 mx-auto">
                <div
                  className="h-full bg-rating-lightning transition-all duration-100"
                  style={{ width: `${feverProgress * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* === ROUND CLEAR flash (강화: 풀스크린 띠 + 큰 배너) === */}
      <AnimatePresence>
        {showRoundClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            {/* 어두워지는 배경 */}
            <div className="absolute inset-0 bg-background/55 backdrop-blur-sm" />
            {/* 가로 띠 */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
              className="absolute inset-x-0 h-32 origin-left"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme.accent}, ${theme.accent}, transparent)`,
                boxShadow: `0 0 60px ${theme.accent}`,
              }}
            />
            {/* 텍스트 배너 */}
            <div className="relative round-banner-in text-center">
              <div
                className="font-display text-7xl tracking-widest"
                style={{ color: 'hsl(var(--secondary))', textShadow: `0 0 30px ${theme.accent}, 0 4px 0 hsl(0 0% 0% / 0.5)` }}
              >
                ROUND {round}
              </div>
              <div
                className="font-display text-3xl tracking-[0.4em] mt-2"
                style={{ color: theme.accent, textShadow: `0 0 16px ${theme.accent}` }}
              >
                CLEAR! 🥊
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === SHIELD SAVE flash === */}
      <AnimatePresence>
        {showShieldSave && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-secondary/95 text-secondary-foreground rounded-2xl px-6 py-3 shadow-2xl border-2 border-background/20">
              <div className="text-center font-display text-3xl tracking-widest">🛡️ SAVE!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === FEVER ENTER flash === */}
      <AnimatePresence>
        {showFeverEnter && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="absolute inset-x-0 top-[40%] z-40 text-center pointer-events-none"
          >
            <div
              className="inline-block font-display text-6xl tracking-widest"
              style={{
                color: 'hsl(0 90% 60%)',
                textShadow: '0 0 30px hsl(0 90% 50%), 0 0 60px hsl(0 90% 50%)',
              }}
            >
              🔥 FEVER!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Pause overlay === */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center px-6"
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
                  ROUND {round} · {currentScore.toLocaleString()}점 · {fmtTime(elapsedSec)}
                </p>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 mb-3 space-y-2 border border-border/60">
                <button
                  onClick={toggleSound}
                  className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">{soundOn ? '🔊' : '🔇'}</span> 사운드
                  </span>
                  <span className={`relative w-10 h-5 rounded-full ${soundOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${soundOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
                <button
                  onClick={toggleVibration}
                  className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">{vibrationOn ? '📳' : '📴'}</span> 진동
                  </span>
                  <span className={`relative w-10 h-5 rounded-full ${vibrationOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${vibrationOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={onResume}
                  className="w-full bg-primary text-primary-foreground font-display tracking-widest py-3 rounded-xl shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  ▶ 계속하기
                </button>
                <button
                  onClick={() => setShowHelp(true)}
                  className="w-full bg-muted text-foreground font-display text-sm tracking-widest py-2.5 rounded-xl border border-border"
                >
                  ❓ 게임 방법
                </button>
                <button
                  onClick={() => setConfirmRestart(true)}
                  className="w-full bg-muted text-foreground font-display text-sm tracking-widest py-2.5 rounded-xl border border-border"
                >
                  🔄 다시 시작
                </button>
                <button
                  onClick={() => setConfirmQuit(true)}
                  className="w-full bg-destructive/10 text-destructive font-display text-sm tracking-widest py-2.5 rounded-xl border border-destructive/30"
                >
                  🚪 종료 → 모드 선택으로
                </button>
              </div>
            </motion.div>

            {/* Help modal */}
            <AnimatePresence>
              {showHelp && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/90 backdrop-blur flex items-center justify-center px-6"
                  onClick={() => setShowHelp(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl"
                  >
                    <h4 className="font-display text-xl tracking-widest text-center text-foreground mb-3">📖 게임 방법</h4>
                    <ul className="space-y-2 text-sm text-foreground/90">
                      <li className="flex gap-2"><span>⚡</span><span>화면에 펀치 이름이 뜨면 같은 색 버튼을 누르세요</span></li>
                      <li className="flex gap-2"><span>🎯</span><span>아주 빠르게 누르면 PERFECT (시간이 갈수록 더 빡빡해져요)</span></li>
                      <li className="flex gap-2"><span>🔥</span><span>PERFECT {REACTION_CONFIG.feverTriggerPerfectCount}연속이면 FEVER 모드</span></li>
                      <li className="flex gap-2"><span>🥊</span><span>{REACTION_CONFIG.roundClearTarget}회 성공할 때마다 라운드 ↑</span></li>
                      <li className="flex gap-2"><span>🛡️</span><span>실수해도 쉴드가 있으면 1회 살아남습니다</span></li>
                      <li className="flex gap-2"><span>⏱️</span><span>시간이 지날수록 점점 빨라집니다</span></li>
                    </ul>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="w-full mt-4 bg-primary text-primary-foreground font-display tracking-widest py-2.5 rounded-xl"
                    >확인</button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Restart confirm */}
            <AnimatePresence>
              {confirmRestart && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/90 backdrop-blur flex items-center justify-center px-6"
                >
                  <motion.div
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-card border border-border rounded-2xl p-5 w-full max-w-xs shadow-2xl text-center"
                  >
                    <div className="text-4xl mb-2">🔄</div>
                    <h4 className="font-display text-lg tracking-widest text-foreground mb-1">처음부터?</h4>
                    <p className="text-xs text-muted-foreground mb-4">현재 점수 {currentScore.toLocaleString()}점 / 라운드 {round}이 사라집니다</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmRestart(false)}
                        className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-display text-sm tracking-widest"
                      >취소</button>
                      <button
                        onClick={() => { setConfirmRestart(false); onRestart(); }}
                        className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-display text-sm tracking-widest"
                      >다시</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quit confirm */}
            <AnimatePresence>
              {confirmQuit && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/90 backdrop-blur flex items-center justify-center px-6"
                >
                  <motion.div
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-card border border-destructive/30 rounded-2xl p-5 w-full max-w-xs shadow-2xl text-center"
                  >
                    <div className="text-4xl mb-2">🚪</div>
                    <h4 className="font-display text-lg tracking-widest text-foreground mb-1">정말 나갈까요?</h4>
                    <p className="text-xs text-muted-foreground mb-4">현재 진행은 저장되지 않습니다</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmQuit(false)}
                        className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-display text-sm tracking-widest"
                      >취소</button>
                      <button
                        onClick={() => { setConfirmQuit(false); onQuit(); }}
                        className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl font-display text-sm tracking-widest"
                      >나가기</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameScreen;
