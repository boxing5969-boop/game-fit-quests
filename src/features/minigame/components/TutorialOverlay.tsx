/**
 * 첫 플레이 타이밍 안내 (2026-10-01 다크 아레나 개편).
 */
import { motion } from 'framer-motion';
import { EyeOff, FastForward, Play, Rewind, type LucideIcon } from 'lucide-react';
import Icon3D from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

const TIMING_ZONES: { icon: LucideIcon | 'bolt'; label: string; desc: string; color: string }[] = [
  { icon: 'bolt', label: 'PERFECT', desc: '트레이너가 미트를 내밀 때 딱 맞추는 것', color: 'text-rating-lightning' },
  { icon: FastForward, label: 'TOO EARLY', desc: '미트가 오기 전에 쳐서 허공을 가르는 것', color: 'text-rating-slow' },
  { icon: Rewind, label: 'TOO LATE', desc: '미트가 이미 지나간 후 치는 것', color: 'text-rating-miss' },
  { icon: EyeOff, label: 'FEINT', desc: '트레이너가 미트를 뺄 때 속지 않는 것', color: 'text-secondary' },
];

interface TutorialOverlayProps {
  onDismiss: () => void;
}

const TutorialOverlay = ({ onDismiss }: TutorialOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="arena-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 flex justify-center"><Icon3D name="stopwatch" size={64} /></div>
          <h2 className="text-[22px] font-black tracking-tight text-foreground">타이밍 존 가이드</h2>
          <p className="mt-1 text-sm text-muted-foreground">실제 미트 트레이닝과 동일한 원리!</p>
        </div>

        <div className="mb-8 space-y-3">
          {TIMING_ZONES.map(z => (
            <div key={z.label} className="mg-card flex items-center gap-3 p-3">
              {z.icon === 'bolt' ? (
                <Icon3D name="bolt" size={32} />
              ) : (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ${z.color}`}>
                  <z.icon className="h-4 w-4" />
                </span>
              )}
              <div>
                <div className={`font-display text-lg tracking-wider ${z.color}`}>{z.label}</div>
                <div className="text-sm text-foreground/80">{z.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { audio.tap(); onDismiss(); }}
          className="mg-btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl tracking-widest"
        >
          <Play className="h-5 w-5 fill-current" /> 이해했어요! 시작
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TutorialOverlay;
