import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DefenseRunStats } from '@/features/minigame/types/defense';
import { recordRun } from '@/features/minigame/lib/defenseStorage';
import { getDefenseTierBySeconds } from '@/features/minigame/lib/defenseConfig';
import { audio } from '@/features/minigame/lib/audio';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';

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
    }
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
      className="fixed inset-0 flex flex-col items-center justify-center px-5 py-6 overflow-y-auto"
      style={{
        background: `radial-gradient(ellipse at center, hsl(0 30% 8%) 0%, hsl(0 0% 3%) 70%, hsl(0 0% 1%) 100%)`,
      }}
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
        className="w-full max-w-sm relative z-10"
      >
        {/* Tier */}
        <div className="text-center mb-3">
          <motion.div
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="text-6xl mb-1 inline-block"
            style={{ filter: `drop-shadow(0 0 16px ${tier.glow})` }}
          >
            {tier.emoji}
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
          className="bg-card/85 border-2 rounded-2xl p-5 text-center mb-3 backdrop-blur-md"
          style={{
            borderColor: isNewBest ? 'hsl(45 100% 60%)' : 'hsl(var(--border))',
            boxShadow: `0 0 ${isNewBest ? '40px' : '20px'} ${isNewBest ? 'rgba(250,204,21,0.4)' : 'rgba(220,38,38,0.15)'}`,
          }}
        >
          <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground">⏱ SURVIVED</div>
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 200 }}
            className="font-display text-7xl text-foreground leading-none my-1 tabular-nums"
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
              className="mt-3 inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground font-display tracking-widest text-sm shadow-[0_0_20px_rgba(250,204,21,0.6)]"
            >
              🏅 NEW RECORD!
            </motion.div>
          )}
        </div>

        {/* ROUND chip — secondary primary metric */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.32, type: 'spring' }}
          className="bg-card/85 border-2 rounded-2xl p-3 mb-3 text-center backdrop-blur-md"
          style={{
            borderColor: isNewBestRound ? 'hsl(45 100% 60%)' : 'hsl(var(--border))',
            boxShadow: isNewBestRound ? '0 0 24px rgba(250,204,21,0.35)' : undefined,
          }}
        >
          <div className="flex items-center justify-around">
            <div>
              <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground">ROUND</div>
              <div className="font-display text-4xl text-foreground tabular-nums leading-none">{stats.roundReached}</div>
            </div>
            <div className="w-px h-10 bg-border/60" />
            <div>
              <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground">BEST</div>
              <div className="font-display text-4xl text-secondary tabular-nums leading-none">{bestRound}</div>
            </div>
          </div>
          {isNewBestRound && (
            <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-secondary/20 border border-secondary/50 text-secondary text-[10px] font-display tracking-widest">
              🏆 NEW BEST ROUND
            </div>
          )}
        </motion.div>

        {/* Score chip */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-card/70 border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] tracking-widest text-muted-foreground font-display">SCORE</div>
            <div className="font-display text-2xl text-foreground tabular-nums">{stats.score}</div>
          </div>
          <div className="bg-card/70 border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] tracking-widest text-muted-foreground font-display">ACCURACY</div>
            <div className="font-display text-2xl text-foreground tabular-nums">{accuracy}%</div>
          </div>
        </div>

        {/* Gems earned */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-secondary/20 via-secondary/10 to-transparent border border-secondary/40 rounded-xl p-3 mb-3 flex items-center gap-3"
        >
          <div className="text-3xl">💎</div>
          <div className="flex-1">
            <div className="text-[10px] font-display tracking-widest text-muted-foreground">젬 획득</div>
            <div className="font-display text-2xl text-secondary tabular-nums">+{granted}</div>
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
          <Stat label="PERFECT" value={stats.perfectCount} accent="secondary" />
          <Stat label="🔥 FEVER" value={stats.feverCount} accent="primary" />
          <Stat label="🪖 SAVE" value={stats.shieldsSaved} accent="secondary" />
          <Stat label="BOSS" value={stats.bossClears} accent="foreground" />
        </motion.div>

        {/* Actions — RETRY most prominent */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: 'spring' }}
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className="w-full py-5 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground font-display tracking-widest text-2xl mb-2"
          style={{ boxShadow: '0 0 30px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' }}
        >
          ↻ ONE MORE
        </motion.button>
        <button
          onClick={onHome}
          className="w-full py-3 rounded-xl bg-card/70 border border-border text-foreground font-display tracking-widest text-sm hover:bg-card transition-colors"
        >
          🏠 모드 선택
        </button>
      </motion.div>
    </div>
  );
};

function Stat({ label, value, accent }: { label: string; value: number; accent: 'primary' | 'secondary' | 'foreground' }) {
  const color = accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground';
  return (
    <div className="bg-card/70 border border-border rounded-lg p-2 text-center backdrop-blur-sm">
      <div className="text-[9px] tracking-widest text-muted-foreground/80 font-display">{label}</div>
      <div className={`font-display text-xl ${color} tabular-nums leading-tight`}>{value}</div>
    </div>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 });
  const colors = ['hsl(45 100% 60%)', 'hsl(355 82% 56%)', 'hsl(217 91% 60%)', 'hsl(270 70% 60%)'];
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
