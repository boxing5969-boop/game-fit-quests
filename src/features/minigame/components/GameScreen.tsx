/**
 * ⚡ 반응속도 트레이닝 — 플레이 화면 (2026-10-01 다크 아레나 개편).
 * 로직은 그대로, 이모지 → 입체 아이콘·방향 기호, 색은 민트/골드/레드 브랜드 톤.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { Check, Pause, X } from 'lucide-react';
import { PunchType, PUNCHES } from '@/features/minigame/types/game';
import { CueResult } from '@/features/minigame/types/reaction';
import { getRoundTheme, REACTION_CONFIG } from '@/features/minigame/lib/reactionConfig';
import Icon3D from './Icon3D';
import PunchGlyph from './PunchGlyph';
import PauseMenu from './PauseMenu';

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

/** 레인 색 위 글자색 — 골드·아이스는 어두운 글자 */
const PUNCH_TEXT: Record<PunchType, string> = {
  jab: 'text-[hsl(165_70%_7%)]',
  straight: 'text-[hsl(40_60%_8%)]',
  hook: 'text-white',
  upper: 'text-[hsl(210_22%_10%)]',
};

const PUNCH_LIST: PunchType[] = ['jab', 'straight', 'hook', 'upper'];

const JUDGEMENT_INFO = {
  perfect: { en: 'PERFECT', ko: '퍼펙트', color: 'text-rating-lightning' },
  good:    { en: 'GOOD',    ko: '굿',     color: 'text-rating-fast' },
  miss:    { en: 'MISS',    ko: '미스',   color: 'text-rating-miss' },
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
      setPopups(prev => [...prev, { id, text: 'PERFECT', sub: `+${lastResult.points}`, color: 'hsl(var(--rating-lightning))' }]);
      setRings(prev => [...prev, { id, color: accent }]);
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
      setPopups(prev => [...prev, { id, text: 'GOOD', sub: `+${lastResult.points}`, color: 'hsl(var(--rating-fast))' }]);
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
          ? 'radial-gradient(circle at 50% 30%, hsl(8 70% 22%), hsl(8 50% 8%) 70%, hsl(210 24% 3%))'
          : `radial-gradient(circle at 50% 25%, hsl(${theme.hue} 45% 13%), hsl(${theme.hue} 30% 6%) 70%, hsl(210 24% 3%))`,
        transition: 'background 0.6s ease',
      }}
    >
      {/* === 등반 배경: 위로 흐르는 패럴랙스 === */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
                hsl(${theme.hue} 70% 60% / ${0.05 + layer * 0.02}) ${80 + layer * 20}px,
                hsl(${theme.hue} 70% 60% / ${0.05 + layer * 0.02}) ${82 + layer * 20}px
              )`,
            }}
            animate={{ y: ['-50%', '0%'] }}
            transition={{ duration: feverActive ? 2 - layer * 0.3 : 6 - layer, repeat: Infinity, ease: 'linear' }}
          />
        ))}
        {/* 올라가는 글러브 */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 select-none opacity-40"
          animate={{
            bottom: `${20 + climbProgress * 18}%`,
            scale: feverActive ? [1, 1.08, 1] : 1,
          }}
          transition={{
            bottom: { type: 'spring', damping: 18, stiffness: 120 },
            scale: { duration: 0.6, repeat: feverActive ? Infinity : 0 },
          }}
          style={{ filter: `drop-shadow(0 0 16px ${theme.accent})` }}
        >
          <Icon3D name="glove_mint" size={56} />
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
            className={`absolute inset-x-4 top-[26%] bottom-[30%] z-30 flex flex-col items-center justify-center rounded-[2rem] ${PUNCH_BG[currentPunch]} ${PUNCH_TEXT[currentPunch]}`}
            style={{ boxShadow: '0 24px 80px hsl(0 0% 0% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)' }}
          >
            <div className="text-center">
              <PunchGlyph type={currentPunch} size={112} strokeWidth={2.2} className="mx-auto mb-1 drop-shadow-lg" />
              <div className="font-display text-7xl tracking-wider drop-shadow-lg">
                {PUNCHES[currentPunch].nameEn}
              </div>
              <div className="mt-1 text-2xl font-black opacity-80">
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
          className="pointer-events-none absolute inset-0 z-[35]"
          style={{
            background: 'radial-gradient(circle at 50% 45%, hsl(0 0% 100% / 0.45) 0%, transparent 60%)',
            animation: 'mg-hit-stop 0.22s ease-out forwards',
          }}
        />
      )}

      {/* === Perfect/Good popups === */}
      <div className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center">
        {popups.map(p => (
          <div
            key={p.id}
            className="perfect-pop absolute font-display text-5xl tracking-widest"
            style={{ color: p.color, textShadow: `0 0 20px ${p.color}, 0 0 40px ${p.color}` }}
          >
            {p.text}
            {p.sub && <div className="mg-num mt-0.5 text-2xl text-foreground drop-shadow">{p.sub}</div>}
          </div>
        ))}
      </div>

      {/* === Particles === */}
      <div className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle absolute h-2.5 w-2.5 rounded-full"
            style={{
              background: p.color,
              boxShadow: `0 0 12px ${p.color}`,
              ['--tx' as string]: `${p.tx}px`,
              ['--ty' as string]: `${p.ty}px`,
            }}
          />
        ))}
      </div>

      {/* === Rings === */}
      <div className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center">
        {rings.map(r => (
          <div key={r.id} className="ring-pulse absolute h-32 w-32 rounded-full" style={{ borderStyle: 'solid', borderColor: r.color }} />
        ))}
      </div>

      {/* === Top HUD === */}
      <div className="relative z-20 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="flex items-stretch justify-between gap-2 pr-12">
          {/* Round */}
          <div className="mg-card min-w-[78px] rounded-2xl px-3 py-1.5">
            <div className="font-display text-[10px] leading-none tracking-[0.25em] text-muted-foreground">ROUND</div>
            <div className="mg-num mt-0.5 font-display text-2xl leading-none text-foreground">{round}</div>
            <div className="mg-num mt-1 text-[10px] leading-none text-muted-foreground/70">BEST {bestRoundLive}</div>
          </div>

          {/* Score */}
          <div className="mg-card flex-1 rounded-2xl px-3 py-1.5 text-center">
            <div className="font-display text-[10px] leading-none tracking-[0.25em] text-muted-foreground">SCORE</div>
            <div className="mg-num mt-0.5 font-display text-2xl leading-none text-secondary">{currentScore.toLocaleString()}</div>
            <div className="mg-num mt-1 text-[10px] leading-none text-muted-foreground/70">BEST {bestScoreLive.toLocaleString()}</div>
          </div>

          {/* Time + Shield */}
          <div className="mg-card min-w-[78px] rounded-2xl px-3 py-1.5 text-right">
            <div className="font-display text-[10px] leading-none tracking-[0.25em] text-muted-foreground">TIME</div>
            <div className="mg-num mt-0.5 font-display text-xl leading-none text-foreground">{fmtTime(elapsedSec)}</div>
            <div className="mt-1 flex max-w-[80px] flex-wrap items-center justify-end gap-0.5">
              {Array.from({ length: Math.max(REACTION_CONFIG.maxShieldCount, shields) }).map((_, i) => (
                <Icon3D key={i} name="shield" size={16} dim={i >= shields} />
              ))}
            </div>
          </div>
        </div>

        {/* Round progress bar */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${theme.accent}, hsl(var(--secondary)))` }}
            animate={{ width: `${(successesInRound / roundTarget) * 100}%` }}
            transition={{ type: 'spring', damping: 18 }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="mg-num font-display text-[11px] tracking-[0.2em] text-muted-foreground">
            {successesInRound} / {roundTarget} TO ROUND {round + 1}
          </span>
          {currentCombo >= 3 && (
            <span className="mg-num flex items-center gap-1 font-display text-[12px] tracking-widest text-secondary">
              <Icon3D name="fire" size={14} /> COMBO {currentCombo}
            </span>
          )}
        </div>
      </div>

      {/* Pause button */}
      <motion.button
        onClick={onPause}
        aria-label="일시정지"
        whileTap={{ scale: 0.9 }}
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.6rem)] z-40 flex h-10 w-10 items-center justify-center rounded-full bg-card/85 text-foreground shadow-lg ring-1 ring-white/10 backdrop-blur-md"
      >
        <Pause className="h-4 w-4" fill="currentColor" />
      </motion.button>

      {/* === Main feedback area === */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {showFeedback && lastResult && judge ? (
            <motion.div
              key={`fb-${lastResult.timestamp}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="px-4 text-center"
            >
              <div className="mb-1 flex justify-center">
                {lastResult.judgement === 'perfect' ? (
                  <Icon3D name="bolt" size={72} />
                ) : lastResult.judgement === 'good' ? (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--rating-fast)/0.2)] text-rating-fast">
                    <Check className="h-9 w-9" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--rating-miss)/0.2)] text-rating-miss">
                    <X className="h-9 w-9" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className={`font-display text-5xl ${judge.color} drop-shadow-lg`}>{judge.en}</div>
              {lastResult.correct && (
                <div className="mg-num mt-2 font-display text-3xl text-foreground">
                  {Math.round(lastResult.reactionMs)}<span className="text-lg text-muted-foreground">ms</span>
                </div>
              )}
              <div className={`mg-num mt-1 font-display text-2xl ${lastResult.points >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {lastResult.points >= 0 ? '+' : ''}{lastResult.points}
              </div>
            </motion.div>
          ) : (
            !currentPunch && (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="font-display text-3xl tracking-[0.3em] text-muted-foreground">GET READY</div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* === Punch buttons === */}
      <div className="relative z-40 grid grid-cols-4 gap-2 p-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        {PUNCH_LIST.map(type => (
          <motion.button
            key={type}
            whileTap={{ scale: 0.9 }}
            onPointerDown={() => onPunch(type)}
            className={`punch-btn ${PUNCH_BG[type]} ${PUNCH_TEXT[type]} py-3 shadow-[0_10px_24px_hsl(0_0%_0%/0.45),inset_0_1px_0_hsl(0_0%_100%/0.35)] active:brightness-110`}
          >
            <PunchGlyph type={type} size={30} />
            <span className="mt-1 font-display text-[15px] tracking-wider">{PUNCHES[type].nameEn}</span>
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
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: 'radial-gradient(circle at 50% 50%, transparent 30%, hsl(28 90% 50% / 0.18) 100%)', mixBlendMode: 'screen' }}
            />
            <div className="pointer-events-none absolute left-1/2 top-[calc(110px+env(safe-area-inset-top))] z-30 -translate-x-1/2">
              <motion.div
                initial={{ scale: 0.7 }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="flex items-center gap-1.5 font-display text-2xl tracking-widest text-rating-lightning drop-shadow-[0_0_12px_hsl(28_90%_60%)]"
              >
                <Icon3D name="fire" size={24} /> FEVER x{REACTION_CONFIG.feverScoreMultiplier} <Icon3D name="fire" size={24} />
              </motion.div>
              <div className="mx-auto mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-rating-lightning transition-all duration-100" style={{ width: `${feverProgress * 100}%` }} />
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* === ROUND CLEAR flash === */}
      <AnimatePresence>
        {showRoundClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-background/55 backdrop-blur-sm" />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
              className="absolute inset-x-0 h-32 origin-left"
              style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, ${theme.accent}, transparent)`, boxShadow: `0 0 60px ${theme.accent}`, opacity: 0.85 }}
            />
            <div className="round-banner-in relative text-center">
              <div className="mg-num font-display text-7xl tracking-widest" style={{ color: 'hsl(var(--secondary))', textShadow: `0 0 30px ${theme.accent}, 0 4px 0 hsl(0 0% 0% / 0.5)` }}>
                ROUND {round}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 font-display text-3xl tracking-[0.4em]" style={{ color: theme.accent, textShadow: `0 0 16px ${theme.accent}` }}>
                CLEAR <Icon3D name="glove_mint" size={30} />
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
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          >
            <div className="mg-btn-gold flex items-center gap-2 rounded-2xl px-6 py-3">
              <Icon3D name="shield" size={32} />
              <div className="font-display text-3xl tracking-widest">SAVE!</div>
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
            className="pointer-events-none absolute inset-x-0 top-[40%] z-40 text-center"
          >
            <div
              className="inline-flex items-center gap-2 font-display text-6xl tracking-widest"
              style={{ color: 'hsl(28 92% 60%)', textShadow: '0 0 30px hsl(28 92% 50%), 0 0 60px hsl(8 85% 50%)' }}
            >
              <Icon3D name="fire" size={56} /> FEVER!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Pause overlay === */}
      <AnimatePresence>
        {paused && (
          <PauseMenu
            summary={`ROUND ${round} · ${currentScore.toLocaleString()}점 · ${fmtTime(elapsedSec)}`}
            onResume={onResume}
            onRestart={onRestart}
            onQuit={onQuit}
            restartNote={`현재 점수 ${currentScore.toLocaleString()}점 / 라운드 ${round}이 사라집니다`}
            quitLabel="모드 선택으로"
            help={
              <ul className="space-y-2 text-[13.5px] text-foreground/90">
                <li className="flex gap-2"><span className="text-primary">·</span><span>화면에 펀치 이름이 뜨면 같은 색 버튼을 누르세요</span></li>
                <li className="flex gap-2"><span className="text-primary">·</span><span>아주 빠르게 누르면 PERFECT (시간이 갈수록 더 빡빡해져요)</span></li>
                <li className="flex gap-2"><span className="text-primary">·</span><span>PERFECT {REACTION_CONFIG.feverTriggerPerfectCount}연속이면 FEVER 모드</span></li>
                <li className="flex gap-2"><span className="text-primary">·</span><span>{REACTION_CONFIG.roundClearTarget}회 성공할 때마다 라운드가 올라가요</span></li>
                <li className="flex gap-2"><span className="text-primary">·</span><span>실수해도 쉴드가 있으면 1회 살아남아요</span></li>
                <li className="flex gap-2"><span className="text-primary">·</span><span>시간이 지날수록 점점 빨라져요</span></li>
              </ul>
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameScreen;
