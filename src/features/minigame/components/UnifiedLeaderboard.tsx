import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase as rankup } from '@/integrations/supabase/client';
import { Trophy, Loader2 } from 'lucide-react';

type GameKey = 'speed' | 'mitt' | 'defense';
type RangeKey = 'all' | 'week' | 'today';

interface Record {
  id: string;
  user_id: string;
  player_name: string;
  game_type: string;
  score: number;
  avg_reaction_ms: number | null;
  best_reaction_ms: number | null;
  accuracy: number | null;
  combo_peak: number | null;
  tier: string | null;
  played_at: string;
}

interface Props {
  onBack: () => void;
  currentUserId?: string | null;
  initialMode?: GameKey;
}

const GAME_TABS: { key: GameKey; emoji: string; label: string; sub: string; accent: string }[] = [
  { key: 'speed',   emoji: '⚡', label: '반응속도', sub: 'SPEED',   accent: 'primary' },
  { key: 'mitt',    emoji: '🎯', label: '미트 드릴', sub: 'MITT',    accent: 'secondary' },
  { key: 'defense', emoji: '🛡️', label: '디펜스',   sub: 'DEFENSE', accent: 'primary' },
];

const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: 'all',   label: 'ALL TIME' },
  { key: 'week',  label: 'THIS WEEK' },
  { key: 'today', label: 'TODAY' },
];

const UnifiedLeaderboard = ({ onBack, currentUserId, initialMode = 'speed' }: Props) => {
  const [game, setGame] = useState<GameKey>(initialMode);
  const [range, setRange] = useState<RangeKey>('all');
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await rankup
        .from('minigame_records')
        .select('*')
        .eq('game_type', game)
        .order('score', { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setRecords((data ?? []) as Record[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [game]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === 'today' ? now - 24 * 60 * 60 * 1000 :
      range === 'week'  ? now - 7  * 24 * 60 * 60 * 1000 :
      0;

    const inRange = records.filter(r => new Date(r.played_at).getTime() >= cutoff);

    const bestByUser = new Map<string, Record>();
    for (const r of inRange) {
      const prev = bestByUser.get(r.user_id);
      if (!prev || r.score > prev.score) bestByUser.set(r.user_id, r);
    }

    return Array.from(bestByUser.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [records, range]);

  const tab = GAME_TABS.find(t => t.key === game)!;

  return (
    <div className="min-h-screen pt-14 pb-6 px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <div className="text-center mb-5">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-secondary" />
          <h1 className="font-display text-3xl tracking-wider text-foreground">LEADERBOARD</h1>
          <p className="text-xs text-muted-foreground mt-1">랭킹업 글로벌 TOP 20</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {GAME_TABS.map(t => {
            const active = game === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setGame(t.key)}
                className={`relative rounded-xl px-2 py-3 border transition-all ${
                  active
                    ? `bg-${t.accent}/15 border-${t.accent}/60 shadow-[0_0_20px_-8px] shadow-${t.accent}/40`
                    : 'bg-card border-border hover:border-border/80'
                }`}
                style={active ? {
                  background: t.accent === 'secondary'
                    ? 'hsl(var(--secondary) / 0.12)'
                    : 'hsl(var(--primary) / 0.12)',
                  borderColor: t.accent === 'secondary'
                    ? 'hsl(var(--secondary) / 0.55)'
                    : 'hsl(var(--primary) / 0.55)',
                } : undefined}
              >
                <div className="text-2xl leading-none">{t.emoji}</div>
                <div className={`font-display text-[11px] tracking-widest mt-1 ${
                  active ? `text-${t.accent === 'secondary' ? 'secondary' : 'primary'}` : 'text-muted-foreground'
                }`}>
                  {t.sub}
                </div>
                <div className="text-[10px] text-foreground/70 mt-0.5">{t.label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 mb-4 bg-card border border-border rounded-lg p-1">
          {RANGE_TABS.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`flex-1 font-display text-[11px] tracking-widest py-2 rounded-md transition-colors ${
                range === r.key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${game}-${range}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {loading ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <div className="text-sm">기록 불러오는 중…</div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-sm text-destructive">{error}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="text-4xl mb-3">{tab.emoji}</div>
                <p className="text-sm">아직 기록이 없습니다</p>
                <p className="text-xs mt-1">첫 번째 챔피언이 되어보세요!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((r, i) => (
                  <RankRow key={r.id} rank={i + 1} record={r} game={game} isMe={r.user_id === currentUserId} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={onBack}
          className="w-full mt-6 punch-btn bg-muted text-foreground py-4 font-display tracking-widest"
        >
          ← BACK
        </button>
      </motion.div>
    </div>
  );
};

function RankRow({ rank, record, game, isMe }: { rank: number; record: Record; game: GameKey; isMe: boolean }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  let subtitle = '';
  if (game === 'speed') {
    const ms = record.avg_reaction_ms;
    const acc = record.accuracy;
    subtitle = [
      ms != null ? `${ms}ms avg` : null,
      acc != null ? `${acc}% acc` : null,
    ].filter(Boolean).join(' · ');
  } else if (game === 'mitt') {
    const acc = record.accuracy;
    const combo = record.combo_peak;
    subtitle = [
      acc != null ? `${acc}% acc` : null,
      combo ? `combo ${combo}` : null,
    ].filter(Boolean).join(' · ');
  } else {
    const combo = record.combo_peak;
    const tier = record.tier;
    subtitle = [
      tier ? tier.toUpperCase() : null,
      combo ? `combo ${combo}` : null,
    ].filter(Boolean).join(' · ');
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
        isMe
          ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_-10px_hsl(var(--primary))]'
          : rank <= 3
            ? 'bg-card border-secondary/30'
            : 'bg-card border-border'
      }`}
    >
      <div className="w-8 text-center shrink-0">
        {medal ? (
          <span className="text-2xl">{medal}</span>
        ) : (
          <span className="font-display text-lg text-muted-foreground">{rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-foreground truncate">{record.player_name}</span>
          {isMe && (
            <span className="text-[9px] font-display tracking-widest bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              ME
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-xl text-secondary leading-none">
          {game === 'defense' ? `${record.score}s` : record.score}
        </div>
        <div className="text-[9px] text-muted-foreground mt-0.5">
          {new Date(record.played_at).toLocaleDateString()}
        </div>
      </div>
    </motion.div>
  );
}

export default UnifiedLeaderboard;
