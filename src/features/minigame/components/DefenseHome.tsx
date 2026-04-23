import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { getDefenseState, getDailyMissions } from '@/features/minigame/lib/defenseStorage';
import { DailyMission } from '@/features/minigame/types/defense';
import HowToPlayModal from './HowToPlayModal';

interface Props {
  onStart: () => void;
  onExit: () => void;
}

const DefenseHome = ({ onStart, onExit }: Props) => {
  const [state, setState] = useState(() => getDefenseState());
  const [missions, setMissions] = useState<DailyMission[]>(() => getDailyMissions());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setState(getDefenseState());
    setMissions(getDailyMissions());
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-between px-5 py-8 overflow-y-auto"
      style={{
        background: 'radial-gradient(ellipse at top, hsl(355 60% 12%) 0%, hsl(0 0% 4%) 70%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-primary via-transparent to-primary" />
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 via-transparent to-blue-500" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm text-center pt-6"
      >
        <div className="text-6xl mb-2">🥊</div>
        <h1 className="font-display text-5xl tracking-wider text-foreground leading-none">
          BOXING
        </h1>
        <h2 className="font-display text-3xl tracking-widest text-primary leading-none mt-1">
          DEFENSE RUSH
        </h2>
        <p className="text-muted-foreground text-sm mt-2">좌우로 공격을 막고, 콤보를 쌓아 카운터!</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 w-full max-w-sm space-y-3"
      >
        {/* Best stats — 시간 기반 */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="BEST" value={`${state.bestSeconds}s`} accent="primary" />
          <StatCard label="TODAY" value={`${state.todayBestSeconds}s`} accent="secondary" />
          <StatCard label="GEMS" value={`💎${state.totalGems}`} accent="foreground" />
        </div>

        {/* Daily missions */}
        <div className="bg-card/70 border border-border rounded-xl p-3 backdrop-blur-sm">
          <div className="text-[10px] font-display tracking-widest text-secondary mb-2">📅 오늘의 미션</div>
          <div className="space-y-2">
            {missions.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <span>{m.done ? '✅' : '⬜'}</span>
                <span className="flex-1 text-foreground/90">{m.label}</span>
                <span className="font-display tabular-nums text-muted-foreground text-xs">
                  {Math.min(m.current, m.goal)}/{m.goal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How to play — quick view */}
        <button
          onClick={() => setShowHelp(true)}
          className="w-full bg-card/50 border border-border/60 rounded-xl p-3 text-left flex items-center gap-3 hover:border-primary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display tracking-widest text-foreground text-sm">▣ 게임 설명서</div>
            <div className="text-xs text-muted-foreground">조작법 · 공격 종류 · 카운터 / 보스 시스템</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onStart}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground font-display tracking-widest text-2xl shadow-[0_0_30px_rgba(220,38,38,0.4)]"
        >
          ▶ START
        </motion.button>

        <button
          onClick={onExit}
          className="w-full text-muted-foreground text-sm py-2"
        >
          ← 모드 선택
        </button>
      </motion.div>

      <div className="h-2" />

      <HowToPlayModal
        open={showHelp}
        mode="defense"
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
};

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: 'primary' | 'secondary' | 'foreground' }) {
  const colorClass = accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground';
  return (
    <div className="bg-card/70 border border-border rounded-xl p-2 text-center backdrop-blur-sm">
      <div className="text-[9px] tracking-widest text-muted-foreground font-display">{label}</div>
      <div className={`font-display text-xl ${colorClass} leading-tight`}>{value}</div>
    </div>
  );
}

export default DefenseHome;
