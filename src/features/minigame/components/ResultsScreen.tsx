import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { SessionResult, getTier } from '@/features/minigame/types/game';
import { SessionExtras } from '@/features/minigame/hooks/useGameEngine';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';

interface ResultsScreenProps {
  result: SessionResult;
  extras: SessionExtras;
  onHome: () => void;
  onRanking: () => void;
  onRetry?: () => void;
}

const fmtSec = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const ResultsScreen = ({ result, extras, onHome, onRanking, onRetry }: ResultsScreenProps) => {
  const tier = getTier(result.avgReaction);
  const [shared, setShared] = useState(false);

  // 랭킹업 자동 저장
  useAutoSaveScore({
    game_type: 'speed',
    player_name: result.playerName,
    score: result.score,
    avg_reaction_ms: result.avgReaction,
    best_reaction_ms: result.bestReaction,
    accuracy: result.accuracy,
    total_punches: result.totalPunches,
    combo_peak: result.comboPeak,
    tier: tier.key,
    xp_earned: Math.floor(result.score / 10),
  });

  const onShare = async () => {
    try {
      const txt = `🥊 반응속도 트레이닝\n${result.playerName}\n` +
        `ROUND ${extras.reachedRound} · SCORE ${result.score.toLocaleString()}\n` +
        `생존 ${fmtSec(extras.survivalSec)} · PERFECT ${extras.perfectCount}회 · 🔥${extras.feverCount}`;
      await navigator.clipboard.writeText(txt);
      setShared(true);
      toast.success('결과가 복사되었습니다!');
      setTimeout(() => setShared(false), 2000);
    } catch {
      toast.error('복사 실패');
    }
  };

  const Stat = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) => (
    <div className={`rounded-xl p-3 border text-center ${accent ? 'bg-secondary/10 border-secondary/40' : 'bg-card border-border'}`}>
      <div className="text-[10px] font-display tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${accent ? 'text-secondary' : 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div
      className="overflow-y-auto bg-gradient-to-b from-background via-background to-card/40"
      style={{ minHeight: '100dvh', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="py-5 px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-3">
            <div className="text-5xl mb-1">🥊</div>
            <h2 className="font-display text-2xl tracking-widest text-foreground">GAME OVER</h2>
            <p className="text-xs text-muted-foreground">{result.playerName}</p>
          </div>

          {/* New Best banner — 강화 (반짝이는 띠 + 펄스) */}
          {(extras.newBestScore || extras.newBestRound) && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotate: -3 }}
              animate={{ scale: [0.7, 1.08, 1], opacity: 1, rotate: 0 }}
              transition={{ duration: 0.55, times: [0, 0.6, 1] }}
              className="new-best-shine text-secondary-foreground rounded-2xl p-4 mb-3 text-center shadow-[0_8px_30px_hsl(var(--secondary)/0.6)] border-2 border-secondary-foreground/20"
            >
              <div className="font-display text-3xl tracking-widest drop-shadow">🏆 NEW BEST! 🏆</div>
              <div className="text-xs font-medium mt-1 opacity-90">
                {extras.newBestRound && `라운드 ${extras.bestRound} `}
                {extras.newBestScore && `· ${extras.bestScore.toLocaleString()}점 `}
                달성!
              </div>
            </motion.div>
          )}

        {/* Round 강조 (가장 큰 카드) */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14 }}
          className="bg-card border-2 border-primary/40 rounded-2xl p-5 mb-3 text-center relative overflow-hidden"
          style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.15)' }}
        >
          <div className="text-[10px] font-display tracking-widest text-muted-foreground">REACHED</div>
          <div className="font-display text-7xl text-primary leading-none mt-1">
            ROUND {extras.reachedRound}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            BEST <span className="text-secondary font-display">{extras.bestRound}</span>
          </div>
        </motion.div>

        {/* Score */}
        <div className="bg-card rounded-2xl p-4 mb-3 border border-border text-center">
          <div className="text-[10px] font-display tracking-widest text-muted-foreground">SCORE</div>
          <div className="font-display text-5xl text-secondary tabular-nums">{result.score.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">
            BEST {extras.bestScore.toLocaleString()}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="생존" value={fmtSec(extras.survivalSec)} sub={`BEST ${fmtSec(extras.bestSurvival)}`} />
          <Stat label="PERFECT" value={extras.perfectCount} accent={extras.perfectCount > 0} />
          <Stat label="평균" value={`${result.avgReaction}`} sub="ms" />
          <Stat label="🔥 FEVER" value={extras.feverCount} accent={extras.feverCount > 0} />
          <Stat label="🛡️ SAVE" value={extras.shieldSaveCount} accent={extras.shieldSaveCount > 0} />
          <Stat label="콤보" value={result.comboPeak} />
        </div>

        {/* Gems */}
        <div className="bg-gradient-to-r from-secondary/15 to-primary/15 border border-secondary/30 rounded-xl p-3 mb-4 text-center">
          <div className="text-[10px] font-display tracking-widest text-muted-foreground">획득</div>
          <div className="font-display text-2xl text-secondary">💎 +{extras.gemsEarned}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            보유 {extras.totalGems.toLocaleString()} 💎
          </div>
        </div>

        {/* Actions — RETRY가 가장 크게 (거대 CTA) */}
        <div className="flex flex-col gap-3 sticky bottom-0 pt-3 pb-3 bg-gradient-to-t from-background via-background/95 to-transparent -mx-1 px-1">
          <motion.button
            whileTap={{ scale: 0.96 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [0.9, 1.04, 1], opacity: 1 }}
            transition={{ duration: 0.45, times: [0, 0.6, 1] }}
            onClick={onRetry}
            className="relative w-full bg-primary text-primary-foreground rounded-3xl font-display tracking-widest shadow-[0_12px_50px_hsl(var(--primary)/0.7)] active:brightness-110 overflow-hidden border-2 border-primary-foreground/20"
            style={{ minHeight: '88px' }}
          >
            <div className="relative z-10 flex flex-col items-center justify-center py-1">
              <div className="text-4xl leading-none">🔄</div>
              <div className="text-4xl leading-none mt-1">RETRY</div>
              <div className="text-[10px] opacity-80 tracking-[0.3em] mt-1">한 번 더!</div>
            </div>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ x: ['-120%', '120%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              style={{
                background: 'linear-gradient(100deg, transparent 30%, hsl(0 0% 100% / 0.25) 50%, transparent 70%)',
              }}
            />
          </motion.button>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onShare}
              className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
            >
              {shared ? '✓ 복사' : '📋 공유'}
            </button>
            <button
              onClick={onRanking}
              className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
            >
              🏆 랭킹
            </button>
            <button
              onClick={onHome}
              className="bg-card border border-border text-foreground py-2.5 rounded-xl font-display text-xs tracking-widest active:scale-95"
            >
              🏠 홈
            </button>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultsScreen;
