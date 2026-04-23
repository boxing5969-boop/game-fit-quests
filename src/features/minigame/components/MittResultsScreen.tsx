import { motion } from 'framer-motion';
import { MittSessionResult } from '@/features/minigame/types/mittDrill';
import { MittSessionExtras } from '@/features/minigame/hooks/useMittEngine';
import { getMittReport } from '@/features/minigame/lib/mittTips';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';
import { getHighestClearedRound, getAllStars, getTotalStars } from '@/features/minigame/lib/mittDrillConfig';

interface MittResultsScreenProps {
  result: MittSessionResult;
  extras: MittSessionExtras;
  onHome: () => void;
  onRetry: () => void;
}

const MittResultsScreen = ({ result, extras, onHome, onRetry }: MittResultsScreenProps) => {
  const mitt = getMittReport(extras.perfectPct);
  const highestCleared = getHighestClearedRound();
  const reachedRound = result.round;
  const newBest = highestCleared > 0 && extras.stagesCleared >= highestCleared;
  const starsByRound = getAllStars();
  const totalStars = getTotalStars();
  const maxStars = Math.max(1, highestCleared * 3);

  useAutoSaveScore({
    game_type: 'mitt',
    player_name: result.playerName,
    score: result.score,
    avg_reaction_ms: result.avgReaction,
    best_reaction_ms: result.bestReaction,
    accuracy: result.accuracy,
    total_punches: result.totalSteps,
    combo_peak: result.completedCombos,
    tier: null,
    xp_earned: Math.floor(result.score / 10),
  });

  const Stat = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
    <div className={`rounded-xl p-3 border text-center ${accent ? 'bg-secondary/10 border-secondary/40' : 'bg-card border-border'}`}>
      <div className="text-[10px] font-display tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-xl tabular-nums ${accent ? 'text-secondary' : 'text-foreground'}`}>{value}</div>
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
            <div className="text-5xl mb-1">🎯</div>
            <h2 className="font-display text-2xl tracking-widest text-foreground">MITT DRILL</h2>
            <p className="text-xs text-muted-foreground">{result.playerName}</p>
          </div>

          {/* New Best banner */}
          {newBest && extras.stagesCleared > 0 && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.55 }}
              className="bg-gradient-to-r from-secondary to-primary text-secondary-foreground rounded-2xl p-3 mb-3 text-center shadow-[0_8px_30px_hsl(var(--secondary)/0.5)] border-2 border-secondary-foreground/20"
            >
              <div className="font-display text-2xl tracking-widest">🏆 NEW BEST ROUND</div>
              <div className="text-xs opacity-90 mt-0.5">ROUND {extras.stagesCleared}까지 클리어!</div>
            </motion.div>
          )}

          {/* Reached Round (큰 카드) */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            className="bg-card border-2 border-primary/40 rounded-2xl p-5 mb-3 text-center relative overflow-hidden"
            style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.15)' }}
          >
            <div className="text-[10px] font-display tracking-widest text-muted-foreground">CLEARED</div>
            <div className="font-display text-7xl text-primary leading-none mt-1">
              ROUND {extras.stagesCleared}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              도달 <span className="text-secondary font-display">ROUND {reachedRound}</span>
              {' · '}BEST <span className="text-secondary font-display">{highestCleared}</span>
            </div>
          </motion.div>

          {/* Score */}
          <div className="bg-card rounded-2xl p-4 mb-3 border border-border text-center">
            <div className="text-[10px] font-display tracking-widest text-muted-foreground">TOTAL SCORE</div>
            <div className="font-display text-5xl text-secondary tabular-nums">{result.score.toLocaleString()}</div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="정확도" value={`${result.accuracy}%`} />
            <Stat label="PERFECT" value={result.completedCombos} accent={result.completedCombos > 0} />
            <Stat label="평균" value={`${result.avgReaction}ms`} />
            <Stat label="최고 콤보" value={result.totalCombos} />
            <Stat label="최고 반응" value={`${result.bestReaction}ms`} />
            <Stat label="총 입력" value={result.totalSteps} />
          </div>

          {/* Mastery (누적 별점) */}
          {highestCleared > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border mb-3 text-center">
              <div className="text-[10px] text-muted-foreground tracking-widest font-display mb-1">MASTERY</div>
              <div className="font-display text-3xl text-amber-400 tabular-nums">
                ⭐ {totalStars}<span className="text-muted-foreground text-base"> / {maxStars}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
                  style={{ width: `${Math.min(100, (totalStars / maxStars) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Round breakdown — 별점 표시 추가 */}
          {extras.drillResults.length > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border mb-3">
              <div className="text-[10px] text-muted-foreground tracking-widest font-display mb-2">ROUND 기록</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {extras.drillResults.map((dr, i) => {
                  const roundNum = i + 1;
                  const stars = (starsByRound[roundNum] || 0) as 0 | 1 | 2 | 3;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`text-base ${dr.completed ? '' : 'grayscale opacity-50'}`}>
                        {dr.completed ? '✅' : '💥'}
                      </span>
                      <span className="text-foreground/80 flex-1 font-display">{dr.comboId}</span>
                      <span className="text-amber-400 tracking-tighter w-12 text-center" aria-label={`${stars} stars`}>
                        {stars > 0 ? '⭐'.repeat(stars) : '—'}
                      </span>
                      <span className="text-muted-foreground tabular-nums w-9 text-right">{dr.accuracy}%</span>
                      <span className="font-display text-foreground tabular-nums w-14 text-right">
                        {dr.completed ? `${dr.avgReaction}ms` : 'FAIL'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mitt Report */}
          <div className="bg-card border border-primary/20 rounded-xl p-3 mb-4 text-center">
            <span className="text-2xl">{mitt.emoji}</span>
            <div className="font-display text-base text-secondary tracking-wider mt-0.5 mb-1">{mitt.title}</div>
            {mitt.lines.map((line, i) => (
              <p key={i} className="text-xs text-foreground/70 leading-relaxed">{line}</p>
            ))}
          </div>

          {/* Actions — RETRY 가장 크게 */}
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
                <div className="text-3xl leading-none mt-1">RETRY</div>
                <div className="text-[10px] opacity-80 tracking-[0.3em] mt-1">ROUND 1부터</div>
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
            <button
              onClick={onHome}
              className="bg-card border border-border text-foreground py-3 rounded-xl font-display text-xs tracking-widest active:scale-95"
            >
              🏠 메뉴로
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MittResultsScreen;
