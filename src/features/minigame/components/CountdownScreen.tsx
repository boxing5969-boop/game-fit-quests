import { motion, AnimatePresence } from 'framer-motion';
import Icon3D from './Icon3D';

interface CountdownScreenProps {
  countdown: number; // 3, 2, 1, 0 (FIGHT)
  round: number;
}

/** 라운드 시작 카운트다운 — 숫자는 민트, FIGHT 는 골드 + 벨 아이콘 (2026-10-01) */
const CountdownScreen = ({ countdown, round }: CountdownScreenProps) => {
  const display = countdown === 0 ? 'FIGHT!' : countdown.toString();
  const isFight = countdown === 0;

  return (
    <div className="arena-bg arena-ropes relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: isFight
            ? 'radial-gradient(circle, hsl(43 90% 60% / 0.35), transparent 65%)'
            : 'radial-gradient(circle, hsl(160 84% 39% / 0.3), transparent 65%)',
          transition: 'background 0.3s',
        }}
      />
      <div className="relative mb-4 flex items-center gap-2 font-display text-2xl tracking-[0.3em] text-muted-foreground">
        <Icon3D name="bell" size={28} /> ROUND {round}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={countdown}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`relative font-display tracking-wider ${
            isFight ? 'text-secondary text-8xl' : 'text-primary text-[12rem]'
          }`}
          style={{ lineHeight: 1, textShadow: isFight ? '0 0 40px hsl(43 90% 60% / 0.6)' : '0 0 40px hsl(160 84% 39% / 0.5)' }}
        >
          {display}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CountdownScreen;
