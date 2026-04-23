import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TIMING_ZONES = [
  { emoji: '⚡', label: 'PERFECT', desc: '트레이너가 미트를 내밀 때 딱 맞추는 것', color: 'text-rating-lightning' },
  { emoji: '⏩', label: 'TOO EARLY', desc: '미트가 오기 전에 쳐서 허공을 가르는 것', color: 'text-rating-slow' },
  { emoji: '🐢', label: 'TOO LATE', desc: '미트가 이미 지나간 후 치는 것', color: 'text-rating-miss' },
  { emoji: '🎭', label: 'FEINT', desc: '트레이너가 미트를 뺄 때 속지 않는 것', color: 'text-secondary' },
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
      className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center px-6"
    >
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎯</div>
          <h2 className="font-display text-3xl tracking-wider text-foreground">타이밍 존 가이드</h2>
          <p className="text-sm text-muted-foreground mt-1">실제 미트 트레이닝과 동일한 원리!</p>
        </div>

        <div className="space-y-3 mb-8">
          {TIMING_ZONES.map(z => (
            <div key={z.label} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
              <span className="text-2xl shrink-0">{z.emoji}</span>
              <div>
                <div className={`font-display text-lg tracking-wider ${z.color}`}>{z.label}</div>
                <div className="text-sm text-foreground/80">{z.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDismiss}
          className="w-full punch-btn bg-primary text-primary-foreground py-4 font-display tracking-widest"
        >
          이해했어요! 시작 🥊
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TutorialOverlay;
