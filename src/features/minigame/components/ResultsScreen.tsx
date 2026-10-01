/**
 * ⚡ 반응속도 트레이닝 — 결과 화면 (2026-10-01 다크 아레나 개편).
 */
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Home, RotateCcw } from 'lucide-react';
import { SessionResult, getTier } from '@/features/minigame/types/game';
import { SessionExtras } from '@/features/minigame/hooks/useGameEngine';
import { useAutoSaveScore } from '@/features/minigame/lib/saveScore';
import { audio } from '@/features/minigame/lib/audio';
import Icon3D, { TIER_ICON, type Icon3DName } from './Icon3D';

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
      const txt = `[마이복서153] 반응속도 트레이닝 - ${result.playerName}\n` +
        `ROUND ${extras.reachedRound} · SCORE ${result.score.toLocaleString()}\n` +
        `생존 ${fmtSec(extras.survivalSec)} · PERFECT ${extras.perfectCount}회 · FEVER ${extras.feverCount}회`;
      await navigator.clipboard.writeText(txt);
      setShared(true);
      toast.success('결과가 복사되었습니다!');
      setTimeout(() => setShared(false), 2000);
    } catch {
      toast.error('복사 실패');
    }
  };

  const Stat = ({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent?: boolean; icon?: Icon3DName }) => (
    <div className={`mg-card rounded-xl p-3 text-center ${accent ? 'ring-1 ring-secondary/40' : ''}`}>
      <div className="flex items-center justify-center gap-1 font-display text-[11px] tracking-widest text-muted-foreground">
        {icon && <Icon3D name={icon} size={14} />}{label}
      </div>
      <div className={`mg-num font-display text-2xl ${accent ? 'text-secondary' : 'text-foreground'}`}>{value}</div>
      {sub && <div className="mg-num mt-0.5 text-[10px] text-muted-foreground/80">{sub}</div>}
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
          {/* Header — 등급 아이콘 */}
          <div className="mb-3 text-center">
            <div className="mb-1 flex justify-center"><Icon3D name={TIER_ICON[tier.key]} size={76} /></div>
            <h2 className="font-display text-3xl tracking-[0.2em] text-foreground">GAME OVER</h2>
            <p className="text-[12px] font-semibold text-muted-foreground">
              {result.playerName} · <span className={`text-tier-${tier.key}`}>{tier.nameKo}</span>
            </p>
          </div>

          {/* New Best banner — 강화 (반짝이는 띠 + 펄스) */}
          {(extras.newBestScore || extras.newBestRound) && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotate: -3 }}
              animate={{ scale: [0.7, 1.08, 1], opacity: 1, rotate: 0 }}
              transition={{ duration: 0.55, times: [0, 0.6, 1] }}
              className="new-best-shine mb-3 rounded-2xl border-2 border-secondary-foreground/20 p-4 text-center text-secondary-foreground shadow-[0_8px_30px_hsl(var(--secondary)/0.5)]"
            >
              <div className="flex items-center justify-center gap-2 font-display text-3xl tracking-widest drop-shadow"><Icon3D name="trophy" size={30} /> NEW BEST!</div>
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
          className="mg-card relative mb-3 overflow-hidden p-5 text-center ring-1 ring-primary/40"
          style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.15)' }}
        >
          <div className="font-display text-[11px] tracking-widest text-muted-foreground">REACHED</div>
          <div className="mg-num mt-1 font-display text-7xl leading-none text-primary">
            ROUND {extras.reachedRound}
          </div>
          <div className="mg-num mt-2 text-xs text-muted-foreground">
            BEST <span className="font-display text-secondary">{extras.bestRound}</span>
          </div>
        </motion.div>

        {/* Score */}
        <div className="mg-card mb-3 p-4 text-center">
          <div className="font-display text-[11px] tracking-widest text-muted-foreground">SCORE</div>
          <div className="mg-num font-display text-5xl text-secondary">{result.score.toLocaleString()}</div>
          <div className="mg-num mt-1 text-xs text-muted-foreground">
            BEST {extras.bestScore.toLocaleString()}
          </div>
        </div>

        {/* Stats grid */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="생존" value={fmtSec(extras.survivalSec)} sub={`BEST ${fmtSec(extras.bestSurvival)}`} icon="stopwatch" />
          <Stat label="PERFECT" value={extras.perfectCount} accent={extras.perfectCount > 0} icon="bolt" />
          <Stat label="평균" value={`${result.avgReaction}`} sub="ms" />
          <Stat label="FEVER" value={extras.feverCount} accent={extras.feverCount > 0} icon="fire" />
          <Stat label="SAVE" value={extras.shieldSaveCount} accent={extras.shieldSaveCount > 0} icon="shield" />
          <Stat label="콤보" value={result.comboPeak} />
        </div>

        {/* Gems */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-secondary/30 bg-gradient-to-r from-secondary/15 to-primary/10 p-3">
          <Icon3D name="gem" size={40} />
          <div className="flex-1">
            <div className="font-display text-[11px] tracking-widest text-muted-foreground">획득</div>
            <div className="mg-num font-display text-2xl text-secondary">+{extras.gemsEarned}</div>
          </div>
          <div className="mg-num text-right text-[11px] text-muted-foreground">보유 {extras.totalGems.toLocaleString()}</div>
        </div>

        {/* Actions — RETRY가 가장 크게 (거대 CTA) */}
        <div className="flex flex-col gap-3 sticky bottom-0 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-background via-background/95 to-transparent -mx-1 px-1">
          <motion.button
            whileTap={{ scale: 0.96 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [0.9, 1.04, 1], opacity: 1 }}
            transition={{ duration: 0.45, times: [0, 0.6, 1] }}
            onClick={() => { audio.tap(); onRetry?.(); }}
            className="mg-btn-primary relative w-full overflow-hidden rounded-3xl font-display tracking-widest active:brightness-110"
            style={{ minHeight: '84px' }}
          >
            <div className="relative z-10 flex items-center justify-center gap-3 py-1">
              <RotateCcw className="h-8 w-8" strokeWidth={2.5} />
              <div className="text-left">
                <div className="text-4xl leading-none">RETRY</div>
                <div className="mt-0.5 text-[11px] tracking-[0.3em] opacity-80">한 번 더!</div>
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
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { audio.tap(); onShare(); }}
              className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
            >
              {shared ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />} {shared ? '복사됨' : '공유'}
            </button>
            <button
              onClick={() => { audio.tap(); onRanking(); }}
              className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
            >
              <Icon3D name="trophy" size={18} /> 랭킹
            </button>
            <button
              onClick={() => { audio.tap(); onHome(); }}
              className="mg-btn-ghost flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] tracking-widest active:scale-95"
            >
              <Home className="h-4 w-4" /> 홈
            </button>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultsScreen;
