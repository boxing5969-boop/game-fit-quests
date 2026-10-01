/**
 * 🏆 복싱 트레이닝 랭킹 (2026-10-01 랭킹 연동 + 다크 아레나 개편).
 *
 * 서버 함수 get_minigame_leaderboard — 회원마다 최고 기록 하나씩, 지금 닉네임으로.
 * 내 기록이 순위표 밖이면 아래에 '내 순위' 줄을 따로 보여 준다 (get_minigame_my_rank).
 * 기간: 전체 · 이번 주(7일) · 오늘(한국 시간 자정부터).
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { audio } from '@/features/minigame/lib/audio';
import Icon3D, { RANK_MEDAL, type Icon3DName } from './Icon3D';

type GameKey = 'speed' | 'mitt' | 'defense';
type RangeKey = 'all' | 'week' | 'today';

interface Row {
  rank: number;
  user_id: string;
  player_name: string;
  score: number;
  avg_reaction_ms: number | null;
  accuracy: number | null;
  combo_peak: number | null;
  tier: string | null;
  played_at: string;
  is_me: boolean;
}

interface MyRank {
  rank: number;
  score: number;
  played_at: string;
  total_players: number;
}

interface Props {
  onBack: () => void;
  currentUserId?: string | null;
  initialMode?: GameKey;
}

const GAME_TABS: { key: GameKey; icon: Icon3DName; label: string; sub: string }[] = [
  { key: 'speed',   icon: 'bolt',   label: '반응속도', sub: 'SPEED' },
  { key: 'mitt',    icon: 'mitt',   label: '미트 드릴', sub: 'MITT' },
  { key: 'defense', icon: 'shield', label: '디펜스',   sub: 'DEFENSE' },
];

const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: 'all',   label: 'ALL TIME' },
  { key: 'week',  label: 'THIS WEEK' },
  { key: 'today', label: 'TODAY' },
];

/** 기간 시작 시각 (오늘 = 한국 시간 자정) */
export function rangeSince(range: RangeKey, now = Date.now()): string | null {
  if (range === 'all') return null;
  if (range === 'week') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const kst = now + 9 * 3600 * 1000;
  const dayStartKst = Math.floor(kst / 86400000) * 86400000;
  return new Date(dayStartKst - 9 * 3600 * 1000).toISOString();
}

const fmtScore = (game: GameKey, score: number) => (game === 'defense' ? `${score}s` : score.toLocaleString());

const UnifiedLeaderboard = ({ onBack, currentUserId, initialMode = 'speed' }: Props) => {
  const [game, setGame] = useState<GameKey>(initialMode);
  const [range, setRange] = useState<RangeKey>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const since = rangeSince(range);

    (async () => {
      const [board, me] = await Promise.all([
        supabase.rpc('get_minigame_leaderboard', { p_game: game, p_since: since, p_limit: 50 }),
        supabase.rpc('get_minigame_my_rank', { p_game: game, p_since: since }),
      ]);
      if (cancelled) return;
      if (board.error) {
        setError(board.error.message);
        setLoading(false);
        return;
      }
      setRows((board.data ?? []) as Row[]);
      setMine(((me.data ?? []) as MyRank[])[0] ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [game, range]);

  const tab = GAME_TABS.find(t => t.key === game)!;
  const myInList = useMemo(() => rows.some(r => r.is_me || (currentUserId && r.user_id === currentUserId)), [rows, currentUserId]);

  return (
    <div className="arena-bg arena-ropes min-h-screen px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md"
      >
        <div className="mb-3 flex items-center pt-1">
          <button
            type="button"
            onClick={() => { audio.tap(); onBack(); }}
            className="flex h-9 items-center gap-1 rounded-full bg-card/80 px-3 text-[12px] font-bold text-foreground ring-1 ring-white/10 backdrop-blur-md active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" /> 뒤로
          </button>
        </div>
        <div className="mb-4 text-center">
          <Icon3D name="trophy" size={64} className="mx-auto" />
          <h1 className="font-display text-3xl tracking-[0.2em] text-foreground">LEADERBOARD</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">153 회원 TOP 50 · 회원마다 최고 기록</p>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {GAME_TABS.map(t => {
            const active = game === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { audio.tap(); setGame(t.key); }}
                className={`mg-card flex flex-col items-center rounded-2xl px-2 py-2.5 transition-all ${
                  active ? 'ring-2 ring-primary/70' : 'opacity-70'
                }`}
              >
                <Icon3D name={t.icon} size={32} />
                <div className={`mt-1 font-display text-[12px] tracking-[0.2em] ${active ? 'text-primary' : 'text-muted-foreground'}`}>{t.sub}</div>
                <div className="text-[11px] font-semibold text-foreground/80">{t.label}</div>
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/[0.08]">
          {RANGE_TABS.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => { audio.tap(); setRange(r.key); }}
              className={`flex-1 rounded-full py-2 font-display text-[12px] tracking-[0.2em] transition-colors ${
                range === r.key ? 'bg-foreground text-background' : 'text-muted-foreground'
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
                <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                <div className="text-sm">기록 불러오는 중…</div>
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
                <div className="text-sm text-destructive">{error}</div>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground">
                <Icon3D name={tab.icon} size={64} className="mx-auto mb-3 opacity-80" />
                <p className="text-sm font-semibold">아직 기록이 없어요</p>
                <p className="mt-1 text-xs">첫 번째 챔피언이 되어 보세요!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <RankRow key={r.user_id} rank={r.rank} record={r} game={game} isMe={r.is_me || r.user_id === currentUserId} delay={i} />
                ))}
              </div>
            )}

            {/* 내 순위 — 순위표 밖에 있을 때 */}
            {!loading && !error && mine && !myInList && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/40">
                <div className="mg-num w-8 text-center font-display text-lg text-primary">{mine.rank}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[14px] font-black text-foreground">
                    내 순위
                    <span className="rounded bg-primary px-1.5 py-0.5 font-display text-[10px] tracking-widest text-primary-foreground">ME</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{mine.total_players}명 중 {mine.rank}위</div>
                </div>
                <div className="mg-num font-display text-xl text-secondary">{fmtScore(game, mine.score)}</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

function RankRow({ rank, record, game, isMe, delay }: { rank: number; record: Row; game: GameKey; isMe: boolean; delay: number }) {
  const medal = RANK_MEDAL[rank];

  let subtitle = '';
  if (game === 'speed') {
    subtitle = [
      record.avg_reaction_ms != null ? `${record.avg_reaction_ms}ms avg` : null,
      record.accuracy != null ? `${record.accuracy}% acc` : null,
    ].filter(Boolean).join(' · ');
  } else if (game === 'mitt') {
    subtitle = [
      record.accuracy != null ? `${record.accuracy}% acc` : null,
      record.combo_peak ? `combo ${record.combo_peak}` : null,
    ].filter(Boolean).join(' · ');
  } else {
    subtitle = [
      record.tier ? record.tier.toUpperCase() : null,
      record.combo_peak ? `combo ${record.combo_peak}` : null,
    ].filter(Boolean).join(' · ');
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(delay * 0.02, 0.3) }}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        isMe
          ? 'bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_20px_-10px_hsl(var(--primary))]'
          : rank <= 3
            ? 'mg-card ring-1 ring-secondary/30'
            : 'mg-card'
      }`}
    >
      <div className="flex w-9 shrink-0 items-center justify-center">
        {medal ? (
          <Icon3D name={medal} size={32} />
        ) : (
          <span className="mg-num font-display text-lg text-muted-foreground">{rank}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-black text-foreground">{record.player_name}</span>
          {isMe && (
            <span className="rounded bg-primary px-1.5 py-0.5 font-display text-[10px] tracking-widest text-primary-foreground">ME</span>
          )}
        </div>
        {subtitle && <div className="mg-num truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="mg-num font-display text-xl leading-none text-secondary">{fmtScore(game, record.score)}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(record.played_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</div>
      </div>
    </motion.div>
  );
}

export default UnifiedLeaderboard;
