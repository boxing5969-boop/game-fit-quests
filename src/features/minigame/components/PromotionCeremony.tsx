import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { TierInfo } from '@/features/minigame/types/game';
import { audio } from '@/features/minigame/lib/audio';

interface PromotionCeremonyProps {
  tier: TierInfo;
  onContinue: () => void;
}

const PromotionCeremony = ({ tier, onContinue }: PromotionCeremonyProps) => {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    audio.fanfare();

    const burst = (originX: number) => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: originX, y: 0.5 },
        colors: ['#ffd700', '#e63946', '#ffffff', '#a855f7'],
      });
    };
    burst(0.2);
    setTimeout(() => burst(0.8), 200);
    setTimeout(() => burst(0.5), 400);
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ['#ffd700', '#e63946', '#ffffff', '#a855f7'],
      });
    }, 700);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm overflow-hidden">
      {/* Radial glow */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 3, opacity: 0.3 }}
        transition={{ duration: 1.2 }}
        className={`absolute w-64 h-64 rounded-full bg-tier-${tier.key} blur-3xl`}
      />

      <motion.div
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 100, delay: 0.2 }}
        className="text-9xl mb-6 relative drop-shadow-2xl"
      >
        {tier.emoji}
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center px-6 relative"
      >
        <div className="text-2xl font-display tracking-widest text-secondary mb-2">
          🎉 PROMOTION 🎉
        </div>
        <div className={`font-display text-6xl sm:text-7xl tracking-wider text-tier-${tier.key} mb-2`}>
          {tier.nameEn.toUpperCase()}
        </div>
        <div className={`text-2xl text-tier-${tier.key}/80 mb-2`}>
          {tier.nameKo}
        </div>
        <div className="text-foreground text-lg font-bold mb-2">
          새로운 등급을 달성했습니다!
        </div>
        <div className="text-sm text-muted-foreground max-w-xs text-center">
          이제 체육관 미트 앞에서도 이 타이밍을 보여주세요!
        </div>
      </motion.div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onContinue}
        className="punch-btn bg-primary text-primary-foreground px-12 py-4 font-display text-lg tracking-widest relative"
      >
        CONTINUE
      </motion.button>
    </div>
  );
};

export default PromotionCeremony;
