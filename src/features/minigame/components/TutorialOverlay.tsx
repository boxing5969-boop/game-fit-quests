/**
 * 반응속도 트레이닝 첫 플레이 안내 (2026-10-01 다크 아레나 개편).
 * 카운트다운 전에 뜨고, "시작" 을 누르면 그때 게임이 시작된다 — 엔진(useGameEngine)·reactionConfig 수치와 맞춘 내용.
 */
import { motion } from 'framer-motion';
import { Hand, Play, Timer, X, type LucideIcon } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

const GUIDE: { icon: LucideIcon | Icon3DName; label: string; desc: string; color: string }[] = [
  { icon: Hand, label: 'FOLLOW', desc: '화면에 뜬 펀치(잽·스트레이트·훅·어퍼)와 같은 버튼을 탭', color: 'text-primary' },
  { icon: 'bolt', label: 'PERFECT', desc: '빠르게 반응하면 PERFECT 100점 · 조금 늦으면 GOOD 50점', color: 'text-rating-lightning' },
  { icon: X, label: 'MISS', desc: '다른 버튼을 누르거나 시간 안에 못 치면 MISS — 실드가 없으면 끝', color: 'text-rating-miss' },
  { icon: 'shield', label: 'SHIELD', desc: '첫 판은 실드 5개로 시작 — 실수 한 번을 대신 막아 준다 (라운드 2 클리어 때 하나 더)', color: 'text-secondary' },
  { icon: Timer, label: 'ROUND', desc: '5번 성공하면 다음 라운드 — 1~5라운드는 3초까지 여유, 그 뒤로 점점 빨라진다', color: 'text-foreground' },
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
      className="arena-bg fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto px-6 py-[calc(env(safe-area-inset-top)+1rem)]"
    >
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <div className="mb-2 flex justify-center"><Icon3D name="bolt" size={64} /></div>
          <h2 className="text-[22px] font-black tracking-tight text-foreground">반응속도 트레이닝, 이렇게 해요</h2>
          <p className="mt-1 text-sm text-muted-foreground">첫 판은 천천히 — 보고, 같은 버튼을 바로 누르기</p>
        </div>

        <div className="mb-6 space-y-2.5">
          {GUIDE.map(z => (
            <div key={z.label} className="mg-card flex items-center gap-3 p-3">
              {typeof z.icon === 'string' ? (
                <Icon3D name={z.icon} size={32} />
              ) : (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ${z.color}`}>
                  <z.icon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <div className={`font-display text-lg tracking-wider ${z.color}`}>{z.label}</div>
                <div className="text-[13px] leading-snug text-foreground/80">{z.desc}</div>
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
