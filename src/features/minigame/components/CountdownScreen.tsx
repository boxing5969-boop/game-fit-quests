import { motion, AnimatePresence } from 'framer-motion';

interface CountdownScreenProps {
  countdown: number; // 3, 2, 1, 0 (FIGHT)
  round: number;
}

const CountdownScreen = ({ countdown, round }: CountdownScreenProps) => {
  const display = countdown === 0 ? 'FIGHT!' : countdown.toString();
  const isFight = countdown === 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-transparent" />
      <div className="text-muted-foreground font-display text-2xl tracking-widest mb-4 relative">
        ROUND {round}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={countdown}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`font-display tracking-wider relative ${
            isFight ? 'text-secondary text-9xl' : 'text-primary text-[12rem]'
          }`}
          style={{ lineHeight: 1 }}
        >
          {display}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CountdownScreen;
