/**
 * 🛡 복싱 디펜스 러시 — 플레이 화면 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Crosshair, Hourglass, Pause, Play, Swords, Timer, Volume2, VolumeX } from 'lucide-react';
import { useDefenseEngine } from '@/features/minigame/hooks/useDefenseEngine';
import { DEFENSE_CONFIG } from '@/features/minigame/lib/defenseConfig';
import { audio } from '@/features/minigame/lib/audio';
import DefenseHome from './DefenseHome';
import DefenseGameOver from './DefenseGameOver';
import Icon3D from './Icon3D';

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
      {/* Ring corner posts — 왼쪽 레드 코너 · 오른쪽 블루 코너 */}
      <div className="pointer-events-none absolute inset-0 arena-ropes">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-destructive via-destructive/30 to-destructive opacity-60" />
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-500 via-sky-500/30 to-sky-500 opacity-60" />
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
      <div className="relative z-10 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={eng.togglePause}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card/85 text-foreground ring-1 ring-white/10 backdrop-blur-md transition-transform active:scale-90"
            aria-label="pause"
          >
            {paused ? <Play className="h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </button>

          <div className="flex-1 text-center">
            {/* ROUND — primary metric */}
            <div className="flex items-center justify-center gap-1 font-display text-[11px] tracking-[0.3em] text-muted-foreground"><Swords className="h-3 w-3" /> ROUND</div>
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
              <span className="flex items-center gap-0.5"><Timer className="h-3 w-3" /> {eng.elapsedSec.toFixed(1)}s</span>
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
                  style={i < shields ? { filter: 'drop-shadow(0 0 6px hsl(45 100% 60%))' } : undefined}
                >
                  <Icon3D name="headgear" size={24} dim={i >= shields} />
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
          <span className="flex items-center gap-1 text-secondary/80">→ <Icon3D name="bolt" size={12} /> COUNTER</span>
        </div>
      </div>

      {/* Center arena */}
      <div className="relative flex-1 flex items-end justify-center pb-4 overflow-hidden">
        {/* Opponent silhouette far above */}
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 opacity-30"
          style={{ filter: `drop-shadow(0 4px 20px ${opponentTheme.glow})` }}
        >
          <Icon3D name={opponentTheme.icon} size={88} />
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
          <Icon3D name="glove_mint" size={96} className="drop-shadow-[0_0_20px_rgba(16,185,129,0.45)]" />
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
              className={`absolute top-1/3 ${f.side === 'L' ? 'left-[20%]' : f.side === 'R' ? 'right-[20%]' : 'left-1/2'} font-display ${f.big ? 'text-4xl' : 'text-2xl'} tracking-widest ${f.color} drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]`}
              // 가운데 정렬은 framer 의 x 로 — Tailwind translate 클래스는 framer 가 쓰는 inline transform 에 덮여 사라진다
              style={{ x: f.side ? 0 : '-50%', textShadow: f.big ? '0 0 20px currentColor' : undefined }}
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
              className="absolute top-1/4 left-1/2 z-30 text-center pointer-events-none"
              style={{ x: '-50%' }}
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
                  : 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(0,0,0,0) 80%)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: shieldFx.kind === 'save' ? 1 : 0 }}
                className="drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]"
              >
                <Icon3D name="headgear" size={88} />
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
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[25] flex gap-1.5 pointer-events-none">
            {focusEndsAt && (
              <div className="flex items-center gap-1 rounded-full border border-secondary/60 bg-secondary/30 px-2 py-0.5 font-display text-[11px] tracking-widest text-secondary backdrop-blur-md">
                <Crosshair className="h-3 w-3" /> FOCUS
              </div>
            )}
            {adrenalineEndsAt && (
              <div className="flex items-center gap-1 rounded-full border border-sky-400/60 bg-sky-500/30 px-2 py-0.5 font-display text-[11px] tracking-widest text-sky-200 backdrop-blur-md">
                <Hourglass className="h-3 w-3" /> SLOW-MO
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
            style={{ background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.32) 0%, transparent 70%)' }}
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
              style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.3) 0%, rgba(0,0,0,0.55) 80%)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="flex items-center gap-3 font-display text-7xl tracking-widest text-secondary drop-shadow-[0_0_30px_rgba(249,115,22,0.95)]"
              >
                <Icon3D name="fire" size={64} /> FEVER!
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
              className="absolute top-[18%] left-1/2 z-30 px-4 py-2 rounded-xl bg-card/90 border border-secondary/50 backdrop-blur-md font-display tracking-widest text-secondary text-sm shadow-[0_0_24px_rgba(250,204,21,0.5)] pointer-events-none"
              style={{ x: '-50%' }}
            >
              {itemPickupFx.kind === 'focus' ? <span className="flex items-center gap-1"><Crosshair className="h-4 w-4" /> FOCUS +5s</span> : <span className="flex items-center gap-1"><Hourglass className="h-4 w-4" /> ADRENALINE +3s</span>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
              <Pause className="h-7 w-7 text-foreground" fill="currentColor" />
            </div>
            <div className="font-display text-5xl tracking-[0.2em] text-foreground">PAUSED</div>
            <SoundToggle />
            <button
              onClick={() => { audio.tap(); eng.togglePause(); }}
              className="mg-btn-primary flex h-12 items-center gap-2 rounded-2xl px-10 py-3 font-display text-xl tracking-widest"
            >
              <Play className="h-5 w-5 fill-current" /> RESUME
            </button>
            <button onClick={eng.goHome} className="text-sm text-muted-foreground underline">
              포기하고 홈으로
            </button>
          </div>
        )}
      </div>

      {/* Bottom guard buttons */}
      <div className="relative z-10 grid grid-cols-2 gap-3 p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
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

  const colorBg = attack.kind === 'hook' ? 'bg-amber-500 text-black'
                : attack.kind === 'rush' ? 'bg-destructive'
                : isFakeShown ? 'bg-zinc-500'
                : 'bg-sky-600';
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
      // 접근 이동은 framer 의 x 값으로 — inline transform 은 framer 가 scale 을 쓰면서 덮어써 버린다 (2026-10-01 검수)
      style={{ x: xOffset }}
    >
      <div className={`mb-1 rounded px-2 py-0.5 font-display text-[11px] tracking-widest text-white shadow-lg ${colorBg}`}>
        {label}
      </div>
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.3, repeat: Infinity }}
        className="drop-shadow-[0_0_14px_rgba(255,255,255,0.5)]"
        style={{ scaleX: isLeft ? 1 : -1 }}
      >
        <Icon3D name="glove_red" size={64} />
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
      className={`absolute top-1/3 ${side === 'L' ? 'left-[20%]' : 'right-[20%]'} w-0 h-0 z-[25] pointer-events-none`}
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
        className="absolute w-12 h-12 rounded-full"
        style={{ x: '-50%', y: '-50%', background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
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
    ? 'border-destructive/60 active:bg-destructive/40'
    : 'border-sky-500/60 active:bg-sky-500/40';

  const innerGlow = isCounter
    ? 'inset 0 0 40px rgba(239,201,76,0.3)'
    : isLeft
    ? 'inset 0 0 35px rgba(217,54,32,0.2)'
    : 'inset 0 0 35px rgba(14,165,233,0.2)';

  return (
    <motion.button
      animate={pressed ? { scale: 0.92 } : { scale: 1 }}
      transition={{ duration: 0.08 }}
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={`relative flex h-32 flex-col items-center justify-center rounded-2xl border-2 bg-card/80 font-display tracking-widest text-foreground backdrop-blur-md transition-colors active:scale-90 sm:h-36 ${accentColor} ${isCounter || isBoss ? 'pulse-glow' : ''}`}
      style={{ boxShadow: innerGlow }}
    >
      <div className="mb-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
        <Icon3D name={isCounter ? 'glove_mint' : 'shield'} size={48} />
      </div>
      <div className="text-xl">
        {isCounter ? 'PUNCH!' : (isLeft ? 'GUARD L' : 'GUARD R')}
      </div>
      <div className={`absolute top-2 ${isLeft ? 'left-2' : 'right-2'} text-[11px] tracking-widest opacity-50`}>
        {isLeft ? '< LEFT' : 'RIGHT >'}
      </div>
      {/* corner accent */}
      <div className={`absolute bottom-1 ${isLeft ? 'left-1' : 'right-1'} font-display text-[10px] ${isLeft ? 'text-destructive/70' : 'text-sky-400/70'}`}>
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
      className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-bold text-muted-foreground"
    >
      {on ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
      {on ? '사운드 ON' : '사운드 OFF'}
    </button>
  );
}

export default BoxingDefenseScreen;
