/**
 * 🛡 디펜스 러시 — 결과 화면 (2026-10-01 다크 아레나 개편).
 */
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, RotateCcw, Timer } from 'lucide-react';
import { DefenseRunStats } from '@/features/minigame/types/defense';
import { recordRun } from '@/features/minigame/lib/defenseStorage';
import { getDefenseTierBySeconds } from '@/features/minigame/lib/defenseConfig';
import { audio } from '@/features/minigame/lib/audio';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';
import Icon3D, { TIER_ICON, type Icon3DName } from './Icon3D';

interface Props {
  stats: DefenseRunStats;
  gemsEarned: number;
  onRetry: () => void;
  onHome: () => void;
}

function fmtTime(ms: number): string {
  const totalDeci = Math.floor(ms / 100);
  const sec = Math.floor(totalDeci / 10);
  const dec = totalDeci % 10;
  return `${sec}.${dec}s`;
}

const DefenseGameOver = ({ stats, gemsEarned, onRetry, onHome }: Props) => {
  const survivedSeconds = Math.floor(stats.survivedMs / 1000);
  const tier = getDefenseTierBySeconds(survivedSeconds);
  const accuracy = stats.totalAttacks > 0
    ? Math.round((stats.perfectCount / stats.totalAttacks) * 100)
    : 0;

  const recorded = useRef(false);
  const [granted, setGranted] = useState(0);
  const [capped, setCapped] = useState(false);
  const [bestSeconds, setBestSeconds] = useState(0);
  const [previousBestSeconds, setPreviousBestSeconds] = useState(0);
  const [bestRound, setBestRound] = useState(0);
  const [previousBestRound, setPreviousBestRound] = useState(0);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const res = recordRun(
      {
        finalScore: stats.score,
        survivedSeconds,
        perfects: stats.perfectCount,
        counters: stats.counterTimes,
        bossClears: stats.bossClears,
        roundReached: stats.roundReached,
      },
      gemsEarned,
    );
    setGranted(res.gemsGranted);
    setCapped(res.gemsCapped);
    setBestSeconds(res.state.bestSeconds);
    setPreviousBestSeconds(res.prevBestSeconds);
    setBestRound(res.state.bestRound);
    setPreviousBestRound(res.prevBestRound);

    if ((survivedSeconds > res.prevBestSeconds && survivedSeconds > 0) || stats.roundReached > res.prevBestRound) {
      audio.fanfare();
      setTimeout(() => audio.cheer(), 400);
    } else {
      audio.fail();
    }
    // 결과 화면 음악
    setTimeout(() => audio.startLobby(), 900);
  }, [stats, gemsEarned, survivedSeconds]);

  useAutoSaveScore(useMemo(() => ({
    game_type: 'defense' as const,
    player_name: 'Defender',
    score: survivedSeconds,           // 시간 기반 게임 — score를 초로 매핑
    avg_reaction_ms: null,
    best_reaction_ms: null,
    accuracy,
    total_punches: stats.perfectCount + stats.goodCount,
    combo_peak: stats.bestCombo,
    tier: tier.key,
    xp_earned: Math.floor(survivedSeconds / 3),
  }), [stats, accuracy, tier, survivedSeconds]));

  const isNewBest = survivedSeconds > 0 && survivedSeconds > previousBestSeconds;
  const isNewBestRound = stats.roundReached > previousBestRound && stats.roundReached > 0;

  return (
    <div
      className="arena-bg arena-ropes fixed inset-0 flex flex-col items-center overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]"
    >
      {isNewBest && (
        <>
          <div
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{ background: `radial-gradient(circle at center, ${tier.glow} 0%, transparent 60%)` }}
          />
          <ConfettiBurst />
        </>
      )}

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative z-10 my-auto w-full max-w-sm"
      >
        {/* Tier */}
        <div className="mb-3 text-center">
          <motion.div
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="mb-1 inline-block"
            style={{ filter: `drop-shadow(0 0 16px ${tier.glow})` }}
          >
            <Icon3D name={TIER_ICON[tier.key] as Icon3DName} size={88} />
          </motion.div>
          <div
            className="font-display text-2xl tracking-widest text-foreground"
            style={{ textShadow: `0 0 20px ${tier.glow}` }}
          >
            {tier.label}
          </div>
          <div className="text-xs text-muted-foreground">{tier.ko}</div>
        </div>

        {/* SURVIVED TIME — primary metric */}
        <div
          className="mg-card mb-3 p-5 text-center"
          style={{
            boxShadow: isNewBest ? '0 0 40px rgba(239,201,76,0.35), 0 0 0 2px hsl(43 83% 62%)' : undefined,
          }}
        >
          <div className="flex items-center justify-center gap-1 font-display text-[11px] tracking-[0.3em] text-muted-foreground"><Timer className="h-3.5 w-3.5" /> SURVIVED</div>
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 200 }}
            className="mg-num my-1 font-display text-7xl leading-none text-foreground"
            style={{ textShadow: isNewBest ? '0 0 30px hsl(45 100% 60%)' : undefined }}
          >
            {fmtTime(stats.survivedMs)}
          </motion.div>
          <div className="text-[10px] text-muted-foreground font-display tracking-widest">
            BEST <span className="text-secondary">{fmtTime(bestSeconds * 1000)}</span>
            {previousBestSeconds > 0 && !isNewBest && (
              <span className="ml-2 text-muted-foreground/60">PREV {fmtTime(previousBestSeconds * 1000)}</span>
            )}
          </div>
          {isNewBest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
              className="mg-btn-gold mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1 font-display text-sm tracking-widest"
            >
              <Icon3D name="medal_gold" size={18} /> NEW RECORD!
            </motion.div>
          )}
        </div>

        {/* ROUND chip — secondary primary metric */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.32, type: 'spring' }}
          className="mg-card mb-3 p-3 text-center"
          style={{
            boxShadow: isNewBestRound ? '0 0 24px rgba(239,201,76,0.35), 0 0 0 2px hsl(43 83% 62%)' : undefined,
          }}
        >
          <div className="flex items-center justify-around">
            <div>
              <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground">ROUND</div>
              <div className="mg-num font-display text-4xl leading-none text-foreground">{stats.roundReached}</div>
            </div>
            <div className="w-px h-10 bg-border/60" />
            <div>
              <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground">BEST</div>
              <div className="mg-num font-display text-4xl leading-none text-secondary">{bestRound}</div>
            </div>
          </div>
          {isNewBestRound && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-secondary/50 bg-secondary/20 px-3 py-0.5 font-display text-[11px] tracking-widest text-secondary">
              <Icon3D name="trophy" size={14} /> NEW BEST ROUND
            </div>
          )}
        </motion.div>

        {/* Score chip */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="mg-card p-3 text-center">
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">SCORE</div>
            <div className="mg-num font-display text-2xl text-foreground">{stats.score}</div>
          </div>
          <div className="mg-card p-3 text-center">
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">ACCURACY</div>
            <div className="mg-num font-display text-2xl text-foreground">{accuracy}%</div>
          </div>
        </div>

        {/* Gems earned */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-secondary/40 bg-gradient-to-r from-secondary/20 via-secondary/10 to-transparent p-3"
        >
          <Icon3D name="gem" size={40} />
          <div className="flex-1">
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">젬 획득</div>
            <div className="mg-num font-display text-2xl text-secondary">+{granted}</div>
            {capped && <div className="text-[10px] text-muted-foreground">일일 상한 도달</div>}
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-4 gap-1.5 mb-4"
        >
          <Stat label="PERFECT" value={stats.perfectCount} accent="secondary" icon="bolt" />
          <Stat label="FEVER" value={stats.feverCount} accent="primary" icon="fire" />
          <Stat label="SAVE" value={stats.shieldsSaved} accent="secondary" icon="headgear" />
          <Stat label="BOSS" value={stats.bossClears} accent="foreground" icon="crown" />
        </motion.div>

        {/* Actions — RETRY most prominent */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: 'spring' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { audio.tap(); onRetry(); }}
          className="mg-btn-primary mb-2 flex w-full items-center justify-center gap-2 rounded-2xl py-5 font-display text-2xl tracking-widest"
        >
          <RotateCcw className="h-6 w-6" strokeWidth={2.5} /> ONE MORE
        </motion.button>
        <button
          onClick={() => { audio.tap(); onHome(); }}
          className="mg-btn-ghost flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-[15px] tracking-widest"
        >
          <Home className="h-4 w-4" /> 모드 선택
        </button>
      </motion.div>
    </div>
  );
};

function Stat({ label, value, accent, icon }: { label: string; value: number; accent: 'primary' | 'secondary' | 'foreground'; icon?: Icon3DName }) {
  const color = accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground';
  return (
    <div className="mg-card rounded-xl p-2 text-center">
      {icon && <div className="mb-0.5 flex justify-center"><Icon3D name={icon} size={20} /></div>}
      <div className="font-display text-[10px] tracking-widest text-muted-foreground/80">{label}</div>
      <div className={`mg-num font-display text-xl leading-tight ${color}`}>{value}</div>
    </div>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 });
  const colors = ['hsl(43 83% 62%)', 'hsl(160 84% 42%)', 'hsl(8 75% 55%)', 'hsl(0 0% 96%)'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: '50vw', y: '40vh', opacity: 1, rotate: 0 }}
          animate={{
            x: `${Math.random() * 100}vw`,
            y: '110vh',
            opacity: 0,
            rotate: Math.random() * 720,
          }}
          transition={{ duration: 2 + Math.random(), ease: 'easeOut', delay: Math.random() * 0.3 }}
          className="absolute w-2 h-3"
          style={{ background: colors[i % colors.length] }}
        />
      ))}
    </div>
  );
}

export default DefenseGameOver;
