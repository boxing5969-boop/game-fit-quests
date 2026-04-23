import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useDefenseEngine } from '@/features/minigame/hooks/useDefenseEngine';
import { DEFENSE_CONFIG } from '@/features/minigame/lib/defenseConfig';
import { audio } from '@/features/minigame/lib/audio';
import DefenseHome from './DefenseHome';
import DefenseGameOver from './DefenseGameOver';

interface Props {
  onExit: () => void;
}

const BoxingDefenseScreen = ({ onExit }: Props) => {
  const eng = useDefenseEngine();

  if (eng.phase === 'home') {
    return <DefenseHome onStart={eng.startGame} onExit={onExit} />;
  }
  if (eng.phase === 'gameover') {
    return (
      <DefenseGameOver
        stats={eng.stats}
        gemsEarned={eng.gemsEarned}
        onRetry={eng.startGame}
        onHome={onExit}
      />
    );
  }
  return <PlayView eng={eng} />;
};

function PlayView({ eng }: { eng: ReturnType<typeof useDefenseEngine> }) {
  const { stats, combo, attacks, phase, paused, floats, bursts, shake, hitstop, opponentTheme, boxerHit, bannerEvent, shields, bestRound, maxShields, roundClearFx, shieldFx, feverEndsAt, feverFx, focusEndsAt, adrenalineEndsAt, itemPickupFx, boxerStyle } = eng;

  const inFever = !!(feverEndsAt && performance.now() < feverEndsAt);
  const roundProgress = Math.min(100, (stats.defenseInRound / DEFENSE_CONFIG.roundClearTarget) * 100);
  const comboPct = Math.min(100, ((combo % DEFENSE_CONFIG.counterTriggerCombo) / DEFENSE_CONFIG.counterTriggerCombo) * 100);
  const shakeClass = shake === 2 ? 'defense-shake-big' : shake === 1 ? 'defense-shake' : '';

  return (
    <div
      className={`fixed inset-0 flex flex-col select-none overflow-hidden touch-none ${shakeClass}`}
      style={{
        background: `radial-gradient(ellipse at top, ${opponentTheme.bgFrom} 0%, ${opponentTheme.bgTo} 70%, hsl(0 0% 2%) 100%)`,
        filter: hitstop ? 'brightness(1.5) contrast(1.15) saturate(1.4)' : undefined,
        transition: 'background 600ms ease, filter 80ms',
      }}
    >
      {/* Ring corner posts */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/30 to-primary opacity-60" />
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-blue-500/30 to-blue-500 opacity-60" />
        {/* center spotlight pulsing */}
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${opponentTheme.glow} 0%, transparent 55%)`,
          }}
        />
        {/* horizon line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/5" />
      </div>

      {/* Top HUD */}
      <div className="relative z-10 px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={eng.togglePause}
            className="w-11 h-11 rounded-full bg-card/80 border border-border text-foreground text-base active:scale-90 transition-transform backdrop-blur-md flex items-center justify-center"
            aria-label="pause"
          >
            {paused ? '▶' : '❚❚'}
          </button>

          <div className="flex-1 text-center">
            {/* ROUND — primary metric */}
            <div className="text-[10px] tracking-[0.3em] text-muted-foreground font-display">⚔ ROUND</div>
            <motion.div
              key={stats.roundReached}
              initial={{ scale: 1.4, color: 'hsl(45 100% 60%)' }}
              animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
              transition={{ duration: 0.4, type: 'spring' }}
              className="font-display text-5xl leading-none tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
            >
              {stats.roundReached}
              {bestRound > 0 && (
                <span className="text-xs text-muted-foreground ml-1.5 font-display tracking-widest">/ BEST {Math.max(bestRound, stats.roundReached)}</span>
              )}
            </motion.div>
            <div className="text-[9px] tracking-[0.3em] text-muted-foreground/70 mt-0.5 font-display flex items-center justify-center gap-1.5">
              <span>SCORE {stats.score}</span>
              <span>·</span>
              <span>⏱ {eng.elapsedSec.toFixed(1)}s</span>
              <span>·</span>
              <span className={boxerStyle.accent}>VS {boxerStyle.name}</span>
            </div>
          </div>

          {/* Right column: shields + combo */}
          <div className="w-14 text-right flex flex-col items-end gap-1">
            <div className="flex items-center gap-0.5" aria-label="headgear">
              {Array.from({ length: maxShields }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < shields ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ repeat: i < shields ? Infinity : 0, duration: 1.6 }}
                  className={`text-xl leading-none ${i < shields ? '' : 'opacity-25 grayscale'}`}
                  style={i < shields ? { filter: 'drop-shadow(0 0 6px hsl(45 100% 60%))' } : undefined}
                >
                  🪖
                </motion.div>
              ))}
            </div>
            <div>
              <div className="text-[9px] tracking-[0.25em] text-muted-foreground font-display">COMBO</div>
              <div className="font-display text-xl text-secondary leading-none tabular-nums drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                {combo}
              </div>
            </div>
          </div>
        </div>

        {/* Round progress bar */}
        <div className="mt-3 h-2 bg-muted/40 rounded-full overflow-hidden border border-border/50 relative">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-secondary to-primary"
            animate={{ width: `${roundProgress}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            style={{ boxShadow: roundProgress > 75 ? '0 0 10px hsl(45 100% 60%)' : undefined }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-display tracking-widest">
          <span className="text-muted-foreground">{stats.defenseInRound}/{DEFENSE_CONFIG.roundClearTarget} 방어</span>
          <span className="text-secondary">→ ROUND {stats.roundReached + 1}</span>
        </div>

        {/* combo bar — slimmer secondary */}
        <div className="mt-2 h-1.5 bg-muted/30 rounded-full overflow-hidden border border-border/30 relative">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-primary to-secondary"
            animate={{ width: `${comboPct}%` }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            style={{ boxShadow: comboPct > 80 ? '0 0 12px hsl(45 100% 60%)' : undefined }}
          />
          {comboPct > 80 && (
            <motion.div
              className="absolute inset-0 bg-secondary/30"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[9px] font-display tracking-widest">
          <span className="text-muted-foreground/70">PERFECT x{DEFENSE_CONFIG.counterTriggerCombo}</span>
          <span className="text-secondary/80">→ ⚡ COUNTER</span>
        </div>
      </div>

      {/* Center arena */}
      <div className="relative flex-1 flex items-end justify-center pb-4 overflow-hidden">
        {/* Opponent silhouette far above */}
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 text-7xl opacity-25"
          style={{ filter: `drop-shadow(0 4px 20px ${opponentTheme.glow})` }}
        >
          {opponentTheme.emoji}
        </div>

        {/* Boxer (player) */}
        <motion.div
          animate={{
            x: boxerHit === 'L' ? 14 : boxerHit === 'R' ? -14 : 0,
            scale: boxerHit ? 0.9 : 1,
            rotate: boxerHit === 'L' ? 6 : boxerHit === 'R' ? -6 : 0,
          }}
          transition={{ type: 'spring', stiffness: 600, damping: 18 }}
          className="relative z-10"
        >
          <div className="text-7xl drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">🥊</div>
          {/* shadow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/50 rounded-full blur-sm" />
        </motion.div>

        {/* Attack indicators */}
        <AnimatePresence>
          {attacks.map(a => (
            <AttackIndicator key={a.id} attack={a} />
          ))}
        </AnimatePresence>

        {/* Burst particles on hit */}
        <AnimatePresence>
          {bursts.map(b => (
            <BurstFx key={b.id} side={b.side} color={b.color} />
          ))}
        </AnimatePresence>

        {/* Floating fx */}
        <AnimatePresence>
          {floats.map(f => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20, scale: 0.6 }}
              animate={{ opacity: 1, y: -50, scale: f.big ? 1.5 : 1.1 }}
              exit={{ opacity: 0, y: -90 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={`absolute top-1/3 ${f.side === 'L' ? 'left-[20%]' : f.side === 'R' ? 'right-[20%]' : 'left-1/2 -translate-x-1/2'} font-display ${f.big ? 'text-4xl' : 'text-2xl'} tracking-widest ${f.color} drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]`}
              style={{ textShadow: f.big ? '0 0 20px currentColor' : undefined }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Phase banners */}
        <AnimatePresence>
          {phase === 'counter' && <CounterOverlay eng={eng} />}
        </AnimatePresence>

        <AnimatePresence>
          {bannerEvent && (
            <motion.div
              key={bannerEvent.id}
              initial={{ opacity: 0, scale: 1.6, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none"
            >
              <div className={`font-display text-5xl tracking-widest ${bannerEvent.color} drop-shadow-[0_0_24px_currentColor]`}>
                {bannerEvent.text}
              </div>
              <div className="text-foreground/80 text-sm mt-1 font-medium">{bannerEvent.sub}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ROUND CLEAR overlay — short, satisfying burst */}
        <AnimatePresence>
          {roundClearFx && (
            <motion.div
              key={roundClearFx.id}
              initial={{ opacity: 0, scale: 1.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.22) 0%, rgba(0,0,0,0.55) 75%)' }}
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -6 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14 }}
                className="font-display text-6xl text-secondary tracking-widest drop-shadow-[0_0_30px_rgba(250,204,21,0.95)]"
              >
                ROUND CLEAR
              </motion.div>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mt-2 font-display text-2xl text-foreground tracking-widest"
              >
                → ROUND {roundClearFx.round + 1}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SHIELD overlay — gain or save */}
        <AnimatePresence>
          {shieldFx && (
            <motion.div
              key={shieldFx.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.3 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
              style={{
                background: shieldFx.kind === 'save'
                  ? 'radial-gradient(circle, rgba(250,204,21,0.32) 0%, rgba(0,0,0,0.7) 80%)'
                  : 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, rgba(0,0,0,0) 80%)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: shieldFx.kind === 'save' ? 1 : 0 }}
                className="text-7xl drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]"
              >
                🪖
              </motion.div>
              <div className={`mt-2 font-display text-4xl tracking-widest ${shieldFx.kind === 'save' ? 'text-secondary' : 'text-foreground'} drop-shadow-[0_0_18px_currentColor]`}>
                {shieldFx.kind === 'save' ? 'SAVE!' : 'HEADGEAR +1'}
              </div>
              <div className="text-foreground/70 text-xs mt-1 font-display tracking-widest">
                {shieldFx.kind === 'save' ? '한 번 더 살아남았다!' : '실수 1회 보호'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persistent buff badges (Focus / Adrenaline) */}
        {(focusEndsAt || adrenalineEndsAt) && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-25 flex gap-1.5 pointer-events-none">
            {focusEndsAt && (
              <div className="px-2 py-0.5 rounded-full bg-secondary/30 border border-secondary/60 text-secondary text-[10px] font-display tracking-widest backdrop-blur-md">
                🎯 FOCUS
              </div>
            )}
            {adrenalineEndsAt && (
              <div className="px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/60 text-blue-200 text-[10px] font-display tracking-widest backdrop-blur-md">
                💉 SLOW-MO
              </div>
            )}
          </div>
        )}

        {/* FEVER mode aura */}
        {inFever && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-20 mix-blend-screen"
            animate={{ opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,80,80,0.35) 0%, transparent 70%)' }}
          />
        )}

        {/* FEVER / Item-pickup big banners */}
        <AnimatePresence>
          {feverFx && feverFx.kind === 'enter' && (
            <motion.div
              key={feverFx.id}
              initial={{ opacity: 0, scale: 1.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 16 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.32) 0%, rgba(0,0,0,0.55) 80%)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="font-display text-7xl text-primary tracking-widest drop-shadow-[0_0_30px_rgba(255,80,80,0.95)]"
              >
                🔥 FEVER!
              </motion.div>
              <div className="mt-2 font-display text-xl text-foreground tracking-widest">2x SCORE · 4.5s</div>
            </motion.div>
          )}
          {itemPickupFx && (
            <motion.div
              key={itemPickupFx.id}
              initial={{ y: -20, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="absolute top-[18%] left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-card/90 border border-secondary/50 backdrop-blur-md font-display tracking-widest text-secondary text-sm shadow-[0_0_24px_rgba(250,204,21,0.5)] pointer-events-none"
            >
              {itemPickupFx.kind === 'focus' ? '🎯 FOCUS +5s' : '💉 ADRENALINE +3s'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 bg-background/85 z-40 flex flex-col items-center justify-center gap-4 backdrop-blur-md">
            <div className="font-display text-6xl text-foreground tracking-widest">PAUSED</div>
            <SoundToggle />
            <button
              onClick={eng.togglePause}
              className="px-10 py-3 bg-primary text-primary-foreground font-display tracking-widest rounded-xl text-lg shadow-[0_0_24px_rgba(220,38,38,0.5)]"
            >
              ▶ RESUME
            </button>
            <button onClick={eng.goHome} className="text-sm text-muted-foreground underline">
              포기하고 홈으로
            </button>
          </div>
        )}
      </div>

      {/* Bottom guard buttons */}
      <div className="relative z-10 grid grid-cols-2 gap-3 p-4 pb-6">
        <GuardButton
          side="L"
          pressed={eng.pressedSide === 'L'}
          onPress={() => phase === 'counter' ? eng.handleCounterTap() : eng.handleGuard('L')}
          phase={phase}
        />
        <GuardButton
          side="R"
          pressed={eng.pressedSide === 'R'}
          onPress={() => phase === 'counter' ? eng.handleCounterTap() : eng.handleGuard('R')}
          phase={phase}
        />
      </div>
    </div>
  );
}

// ===== Attack indicator =====
function AttackIndicator({ attack }: { attack: ReturnType<typeof useDefenseEngine>['attacks'][number] }) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => { force(t => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = performance.now();
  const total = attack.arriveAt - attack.spawnedAt;
  const elapsed = t - attack.spawnedAt;
  const progress = Math.min(1, Math.max(0, elapsed / total));

  let displaySide = attack.side;
  if (attack.kind === 'feint' && attack.feintCancelAt && attack.feintShownSide) {
    displaySide = t < attack.feintCancelAt ? attack.feintShownSide : attack.side;
  }
  const isLeft = displaySide === 'L';
  const isFakeShown = attack.kind === 'feint' && attack.feintCancelAt && t < attack.feintCancelAt;

  const colorBg = attack.kind === 'hook' ? 'bg-amber-500'
                : attack.kind === 'rush' ? 'bg-fuchsia-500'
                : isFakeShown ? 'bg-zinc-500'
                : 'bg-primary';
  const label = attack.kind === 'hook' ? 'HOOK'
              : attack.kind === 'rush' ? 'RUSH!'
              : isFakeShown ? 'FAKE?'
              : '!!';

  // 옆에서 안쪽으로 다가옴
  const xOffset = isLeft ? `${(1 - progress) * 42}vw` : `-${(1 - progress) * 42}vw`;
  const ringColor = progress > 0.85 ? 'hsl(45 100% 60%)' : progress > 0.65 ? 'hsl(0 0% 100% / 0.6)' : 'hsl(0 0% 100% / 0.25)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.7 }}
      transition={{ duration: 0.12 }}
      className={`absolute top-[35%] ${isLeft ? 'left-2' : 'right-2'} z-20 flex flex-col items-center pointer-events-none`}
      style={{ transform: `translateX(${xOffset})` }}
    >
      <div className={`text-[10px] font-display tracking-widest ${colorBg} text-white px-2 py-0.5 rounded shadow-lg mb-1`}>
        {label}
      </div>
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.3, repeat: Infinity }}
        className="text-5xl drop-shadow-[0_0_14px_rgba(255,255,255,0.6)]"
      >
        🥊
      </motion.div>
      {/* speed line */}
      <div
        className={`absolute top-1/2 h-0.5 ${isLeft ? 'right-full' : 'left-full'}`}
        style={{
          width: `${progress * 60}px`,
          background: `linear-gradient(${isLeft ? 'to right' : 'to left'}, transparent, ${ringColor})`,
        }}
      />
      {/* arrival ring */}
      <div
        className="absolute -bottom-3 w-16 h-16 rounded-full border-2"
        style={{
          borderColor: ringColor,
          transform: `scale(${0.5 + progress * 0.9})`,
          transition: 'transform 60ms linear, border-color 100ms',
          boxShadow: progress > 0.85 ? `0 0 18px ${ringColor}` : undefined,
        }}
      />
    </motion.div>
  );
}

// ===== Burst particles =====
function BurstFx({ side, color }: { side: 'L' | 'R'; color: string }) {
  const particles = Array.from({ length: 8 });
  return (
    <div
      className={`absolute top-1/3 ${side === 'L' ? 'left-[20%]' : 'right-[20%]'} w-0 h-0 z-25 pointer-events-none`}
    >
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 40 + Math.random() * 30;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
        );
      })}
      {/* center flash */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      />
    </div>
  );
}

// ===== Counter overlay =====
function CounterOverlay({ eng }: { eng: ReturnType<typeof useDefenseEngine> }) {
  const [tNow, setTNow] = useState(performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = () => { setTNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const remain = Math.max(0, (eng.counterEndsAt ?? tNow) - tNow);
  const total = DEFENSE_CONFIG.counterDurationMs;
  const pct = (remain / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
      style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.18) 0%, rgba(0,0,0,0.7) 80%)' }}
    >
      <motion.div
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ repeat: Infinity, duration: 0.4 }}
        className="font-display text-6xl text-secondary tracking-widest mb-2 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)]"
      >
        COUNTER
      </motion.div>
      <div className="text-foreground/80 text-sm mb-3">탭! 탭! 탭!</div>
      <motion.div
        key={eng.counterHits}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="text-secondary font-display text-5xl mb-3 tabular-nums drop-shadow-[0_0_18px_rgba(250,204,21,0.7)]"
      >
        {eng.counterHits} <span className="text-2xl text-foreground/50">/ {eng.counterMaxHits}</span>
      </motion.div>
      <div className="w-52 h-2.5 bg-muted/50 rounded-full overflow-hidden border border-border/50">
        <div className="h-full bg-secondary" style={{ width: `${pct}%`, transition: 'width 60ms linear' }} />
      </div>
    </motion.div>
  );
}

// ===== Guard button =====
function GuardButton({ side, onPress, phase, pressed }: { side: 'L' | 'R'; onPress: () => void; phase: string; pressed: boolean }) {
  const isLeft = side === 'L';
  const isCounter = phase === 'counter';
  const isBoss = phase === 'boss';

  const accentColor = isCounter
    ? 'border-secondary active:bg-secondary/40'
    : isLeft
    ? 'border-primary/60 active:bg-primary/40'
    : 'border-blue-500/60 active:bg-blue-500/40';

  const innerGlow = isCounter
    ? 'inset 0 0 40px rgba(250,204,21,0.3)'
    : isLeft
    ? 'inset 0 0 35px rgba(220,38,38,0.2)'
    : 'inset 0 0 35px rgba(59,130,246,0.2)';

  return (
    <motion.button
      animate={pressed ? { scale: 0.92 } : { scale: 1 }}
      transition={{ duration: 0.08 }}
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={`relative h-32 sm:h-36 rounded-2xl bg-card/80 border-2 ${accentColor} flex flex-col items-center justify-center font-display tracking-widest text-foreground backdrop-blur-md transition-colors active:scale-90 ${isCounter || isBoss ? 'pulse-glow' : ''}`}
      style={{ boxShadow: innerGlow }}
    >
      <div className="text-4xl mb-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
        {isCounter ? '👊' : '🛡️'}
      </div>
      <div className="text-xl">
        {isCounter ? 'PUNCH!' : (isLeft ? 'GUARD L' : 'GUARD R')}
      </div>
      <div className={`absolute top-2 ${isLeft ? 'left-2' : 'right-2'} text-[10px] tracking-widest opacity-50`}>
        {isLeft ? '◀ LEFT' : 'RIGHT ▶'}
      </div>
      {/* corner accent */}
      <div className={`absolute bottom-1 ${isLeft ? 'left-1' : 'right-1'} text-[9px] font-display ${isLeft ? 'text-primary/60' : 'text-blue-400/60'}`}>
        {isLeft ? 'RED CORNER' : 'BLUE CORNER'}
      </div>
    </motion.button>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(audio.isEnabled());
  return (
    <button
      onClick={() => { const v = !on; audio.setEnabled(v); setOn(v); }}
      className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1"
    >
      {on ? '🔊 사운드 ON' : '🔇 사운드 OFF'}
    </button>
  );
}

export default BoxingDefenseScreen;
