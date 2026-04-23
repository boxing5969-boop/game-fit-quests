import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getLeaderboard } from '@/features/minigame/lib/storage';
import { SessionResult, getTier, TIERS } from '@/features/minigame/types/game';
import { TIER_MITT_DESC } from '@/features/minigame/lib/mittTips';

interface RankingBoardProps {
  onBack: () => void;
  currentPlayer?: string;
}

type Filter = 'all' | 'week' | 'today';

const RankingBoard = ({ onBack, currentPlayer }: RankingBoardProps) => {
  const [filter, setFilter] = useState<Filter>('all');
  const board = getLeaderboard();

  const filtered = useMemo(() => {
    const now = new Date();
    return board.filter(s => {
      if (filter === 'all') return true;
      const d = new Date(s.date);
      if (filter === 'today') {
        return d.toDateString() === now.toDateString();
      }
      // week
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    });
  }, [board, filter]);

  return (
    <div className="min-h-screen py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="font-display text-4xl tracking-wider text-foreground">RANKING</h2>
          <p className="text-muted-foreground">리더보드</p>
        </div>

        {/* Tier Guide */}
        <div className="space-y-2 mb-6">
          {TIERS.map(t => (
            <div key={t.key} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
              <span className="text-xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className={`font-display text-sm tracking-wider text-tier-${t.key}`}>
                  {t.nameEn.toUpperCase()} · {t.nameKo}
                </span>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{TIER_MITT_DESC[t.key]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 justify-center">
          {([
            { key: 'all' as Filter, label: 'ALL TIME' },
            { key: 'week' as Filter, label: 'THIS WEEK' },
            { key: 'today' as Filter, label: 'TODAY' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-display text-sm tracking-wider px-4 py-2 rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <div className="text-4xl mb-3">🥊</div>
            <p>아직 기록이 없습니다</p>
            <p className="text-sm">No records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry, i) => {
              const tier = getTier(entry.avgReaction);
              const isCurrentPlayer = entry.playerName === currentPlayer;
              return (
                <motion.div
                  key={`${entry.date}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isCurrentPlayer
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="font-display text-2xl w-8 text-center text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="text-2xl">{tier.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground truncate">{entry.playerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.avgReaction}ms avg • {entry.accuracy}% acc
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl text-secondary">{entry.score}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full mt-8 punch-btn bg-muted text-foreground py-4 font-display tracking-widest"
        >
          ← BACK
        </button>
      </motion.div>
    </div>
  );
};

export default RankingBoard;
