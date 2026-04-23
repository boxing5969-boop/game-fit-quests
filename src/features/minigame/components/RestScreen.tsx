import { motion } from 'framer-motion';
import { REST_TIPS } from '@/features/minigame/lib/mittTips';

interface RestScreenProps {
  restTime: number;
  currentRound: number;
  score: number;
}

const RestScreen = ({ restTime, currentRound, score }: RestScreenProps) => {
  const tip = REST_TIPS[Math.min(currentRound - 1, REST_TIPS.length - 1)];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center max-w-sm w-full"
      >
        <div className="text-5xl mb-4">🔔</div>
        <h2 className="font-display text-4xl text-foreground mb-2">REST</h2>
        <p className="text-muted-foreground text-lg mb-6">휴식 시간</p>

        <div className="font-display text-8xl text-primary tabular-nums mb-4">
          {restTime}
        </div>
        <p className="text-muted-foreground">
          라운드 {currentRound} 완료 • 현재 점수: <span className="text-secondary font-bold">{score}</span>
        </p>
        <p className="text-muted-foreground mt-2 mb-6">
          다음: 라운드 {currentRound + 1} / 3
        </p>

        {/* Mitt training tip */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-4 text-left"
        >
          <div className="text-xs font-display tracking-widest text-secondary mb-2">
            {tip.icon} {tip.title}
          </div>
          {tip.lines.map((line, i) => (
            <p key={i} className="text-sm text-foreground/80 leading-relaxed">{line}</p>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RestScreen;
