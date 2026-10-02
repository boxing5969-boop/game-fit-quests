/**
 * 🎯 미트 드릴 — 결과 화면 (2026-10-01 다크 아레나 개편).
 */
import { motion } from 'framer-motion';
import { Check, Home, RotateCcw, X } from 'lucide-react';
import { MittSessionResult } from '@/features/minigame/types/mittDrill';
import { MittSessionExtras } from '@/features/minigame/hooks/useMittEngine';
import { getMittReport } from '@/features/minigame/lib/mittTips';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';
import { audio } from '@/features/minigame/lib/audio';
import { getHighestClearedRound, getAllStars, getTotalStars } from '@/features/minigame/lib/mittDrillConfig';
import Icon3D from './Icon3D';

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
  // 엔진이 라운드를 깰 때 저장소를 먼저 갱신하므로 "저장값 >= 이번 결과" 비교는 동률도 신기록으로 보였다 — 엔진이 알려 준 값을 쓴다
  const newBest = extras.newBestRound;
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
    combo_peak: result.totalCombos, // 최고 콤보 (completedCombos 는 PERFECT 횟수)
    tier: null,
    xp_earned: Math.floor(result.score / 10),
  });

  const Stat = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
    <div className={`mg-card rounded-xl p-3 text-center ${accent ? 'ring-1 ring-secondary/40' : ''}`}>
      <div className="font-display text-[11px] tracking-widest text-muted-foreground">{label}</div>
      <div className={`mg-num font-display text-xl ${accent ? 'text-secondary' : 'text-foreground'}`}>{value}</div>
    </div>
  );

  return (
    <div
      className="arena-bg arena-ropes overflow-y-auto"
      style={{ minHeight: '100dvh', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          {/* Header */}
          <div className="mb-3 text-center">
            <div className="mb-1 flex justify-center"><Icon3D name="mitt" size={76} /></div>
            <h2 className="font-display text-3xl tracking-[0.2em] text-foreground">MITT DRILL</h2>
            <p className="text-[12px] font-semibold text-muted-foreground">{result.playerName}</p>
          </div>

          {/* New Best banner */}
          {newBest && extras.stagesCleared > 0 && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.55 }}
              className="new-best-shine mb-3 rounded-2xl border-2 border-secondary-foreground/20 p-3 text-center text-secondary-foreground shadow-[0_8px_30px_hsl(var(--secondary)/0.5)]"
            >
              <div className="flex items-center justify-center gap-2 font-display text-2xl tracking-widest"><Icon3D name="trophy" size={26} /> NEW BEST ROUND</div>
              <div className="text-xs opacity-90 mt-0.5">ROUND {extras.stagesCleared}까지 클리어!</div>
            </motion.div>
          )}

          {/* Reached Round (큰 카드) */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            className="mg-card relative mb-3 overflow-hidden p-5 text-center ring-1 ring-primary/40"
            style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.15)' }}
          >
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">CLEARED</div>
            <div className="mg-num mt-1 font-display text-7xl leading-none text-primary">
              ROUND {extras.stagesCleared}
            </div>
            <div className="mg-num mt-2 text-xs text-muted-foreground">
              도달 <span className="font-display text-secondary">ROUND {reachedRound}</span>
              {' · '}BEST <span className="font-display text-secondary">{highestCleared}</span>
            </div>
          </motion.div>

          {/* Score */}
          <div className="mg-card mb-3 p-4 text-center">
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">TOTAL SCORE</div>
            <div className="mg-num font-display text-5xl text-secondary">{result.score.toLocaleString()}</div>
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
            <div className="mg-card mb-3 p-3 text-center">
              <div className="mb-1 font-display text-[11px] tracking-widest text-muted-foreground">MASTERY</div>
              <div className="mg-num flex items-center justify-center gap-1.5 font-display text-3xl text-secondary">
                <Icon3D name="star" size={28} /> {totalStars}<span className="text-base text-muted-foreground"> / {maxStars}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-secondary to-amber-400"
                  style={{ width: `${Math.min(100, (totalStars / maxStars) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Round breakdown — 별점 표시 추가 */}
          {extras.drillResults.length > 0 && (
            <div className="mg-card mb-3 p-3">
              <div className="mb-2 font-display text-[11px] tracking-widest text-muted-foreground">ROUND 기록</div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {extras.drillResults.map((dr, i) => {
                  // 같은 라운드를 다시 하면 결과가 한 줄 더 쌓이므로 순번이 아니라 'ROUND N' 라벨에서 라운드를 읽는다
                  const roundNum = Number((dr.comboId.match(/\d+/) || [i + 1])[0]);
                  const stars = (starsByRound[roundNum] || 0) as 0 | 1 | 2 | 3;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {dr.completed ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-destructive" strokeWidth={3} />
                      )}
                      <span className="flex-1 font-display text-[13px] text-foreground/80">{dr.comboId}</span>
                      <span className="flex w-14 items-center justify-center gap-0.5" aria-label={`${stars} stars`}>
                        {stars > 0 ? Array.from({ length: stars }).map((_, k) => <Icon3D key={k} name="star" size={12} />) : <span className="text-muted-foreground">—</span>}
                      </span>
                      <span className="mg-num w-9 text-right text-muted-foreground">{dr.accuracy}%</span>
                      <span className="mg-num w-14 text-right font-display text-[13px] text-foreground">
                        {dr.completed ? `${dr.avgReaction}ms` : 'FAIL'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mitt Report */}
          <div className="mg-card mb-4 p-3 text-center ring-1 ring-primary/20">
            <div className="flex justify-center"><Icon3D name={mitt.icon} size={36} /></div>
            <div className="mb-1 mt-0.5 font-display text-base tracking-wider text-secondary">{mitt.title}</div>
            {mitt.lines.map((line, i) => (
              <p key={i} className="text-xs text-foreground/70 leading-relaxed">{line}</p>
            ))}
          </div>

          {/* Actions — RETRY 가장 크게 */}
          <div className="flex flex-col gap-3 sticky bottom-0 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-background via-background/95 to-transparent -mx-1 px-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [0.9, 1.04, 1], opacity: 1 }}
              transition={{ duration: 0.45, times: [0, 0.6, 1] }}
              onClick={() => { audio.tap(); onRetry(); }}
              className="mg-btn-primary relative w-full overflow-hidden rounded-3xl font-display tracking-widest active:brightness-110"
              style={{ minHeight: '84px' }}
            >
              <div className="relative z-10 flex items-center justify-center gap-3 py-1">
                <RotateCcw className="h-8 w-8" strokeWidth={2.5} />
                <div className="text-left">
                  <div className="text-4xl leading-none">RETRY</div>
                  <div className="mt-0.5 text-[11px] tracking-[0.3em] opacity-80">ROUND 1부터</div>
                </div>
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
              onClick={() => { audio.tap(); onHome(); }}
              className="mg-btn-ghost flex h-12 items-center justify-center gap-2 rounded-xl font-display text-[15px] tracking-widest active:scale-95"
            >
              <Home className="h-4 w-4" /> 메뉴로
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MittResultsScreen;
