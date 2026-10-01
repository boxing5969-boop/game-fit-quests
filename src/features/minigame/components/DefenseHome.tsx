/**
 * 🛡 디펜스 러시 — 시작 화면 (2026-10-01 다크 아레나 개편).
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Info, Play } from 'lucide-react';
import { getDefenseState, getDailyMissions } from '@/features/minigame/lib/defenseStorage';
import { DailyMission } from '@/features/minigame/types/defense';
import { audio } from '@/features/minigame/lib/audio';
import HowToPlayModal from './HowToPlayModal';
import Icon3D from './Icon3D';

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
    // 메뉴 음악 — 플레이가 시작되면 엔진이 알아서 바꾼다
    audio.startLobby();
  }, []);

  return (
    <div className="arena-bg arena-ropes fixed inset-0 flex flex-col items-center justify-between overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-destructive via-transparent to-destructive" />
        <div className="absolute bottom-0 right-0 top-0 w-1.5 bg-gradient-to-b from-sky-500 via-transparent to-sky-500" />
      </div>

      <button
        type="button"
        onClick={() => { audio.tap(); onExit(); }}
        className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex h-9 items-center gap-1 rounded-full bg-card/80 px-3 text-[12px] font-bold text-foreground ring-1 ring-white/10 backdrop-blur-md active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" /> 모드 선택
      </button>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mt-10 w-full max-w-sm text-center"
      >
        <div className="relative mb-2 flex justify-center">
          <div
            aria-hidden
            className="pointer-events-none absolute top-3 h-24 w-44 rounded-full"
            style={{ background: 'radial-gradient(ellipse, hsl(160 84% 39% / 0.35), transparent 65%)' }}
          />
          <Icon3D name="shield" size={104} float className="relative" />
        </div>
        <h1 className="font-display text-[46px] leading-none tracking-wide text-foreground">
          DEFENSE <span className="text-primary">RUSH</span>
        </h1>
        <p className="mt-1.5 text-[12.5px] font-semibold text-muted-foreground">좌우로 공격을 막고, 콤보를 쌓아 카운터!</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 mt-4 w-full max-w-sm space-y-3"
      >
        {/* Best stats — 시간 기반 */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="BEST" value={`${state.bestSeconds}s`} accent="primary" />
          <StatCard label="TODAY" value={`${state.todayBestSeconds}s`} accent="secondary" />
          <StatCard label="GEMS" value={state.totalGems} accent="foreground" icon="gem" />
        </div>

        {/* Daily missions */}
        <div className="mg-card p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <Icon3D name="calendar" size={26} />
            <div className="font-display text-[12px] tracking-[0.25em] text-secondary">TODAY'S MISSIONS</div>
          </div>
          <div className="space-y-2">
            {missions.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-[13.5px]">
                {m.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
                <span className={`flex-1 font-semibold ${m.done ? 'text-muted-foreground line-through' : 'text-foreground/90'}`}>{m.label}</span>
                <span className="mg-num font-display text-[13px] text-muted-foreground">
                  {Math.min(m.current, m.goal)}/{m.goal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How to play — quick view */}
        <button
          type="button"
          onClick={() => { audio.tap(); setShowHelp(true); }}
          className="mg-card flex w-full items-center gap-3 p-3 text-left active:brightness-110"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-black text-foreground">게임 설명서</div>
            <div className="text-[12px] text-muted-foreground">조작법 · 공격 종류 · 카운터 / 보스 시스템</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => { audio.tap(); onStart(); }}
          className="mg-btn-primary flex h-16 w-full items-center justify-center gap-2 rounded-2xl font-display text-[28px] tracking-widest"
        >
          <Play className="h-7 w-7 fill-current" /> START
        </motion.button>
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

function StatCard({ label, value, accent, icon }: { label: string; value: number | string; accent: 'primary' | 'secondary' | 'foreground'; icon?: 'gem' }) {
  const colorClass = accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground';
  return (
    <div className="mg-card p-2.5 text-center">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`mg-num flex items-center justify-center gap-1 font-display text-2xl leading-tight ${colorClass}`}>
        {icon && <Icon3D name={icon} size={20} />}{value}
      </div>
    </div>
  );
}

export default DefenseHome;
