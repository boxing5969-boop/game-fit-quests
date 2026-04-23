import { motion } from 'framer-motion';
import { REST_TIPS } from '@/features/minigame/lib/mittTips';

interface MittRestScreenProps {
  restTime: number;
  currentStage: number;
  totalStages: number;
  score: number;
  onSkip: () => void;
}

const MittRestScreen = ({ restTime, currentStage, totalStages, score, onSkip }: MittRestScreenProps) => {
  const tipIndex = Math.floor(currentStage / 10) % REST_TIPS.length;
  const tip = REST_TIPS[tipIndex];

  const nextStage = currentStage + 1;
  const progress = (currentStage / totalStages) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-gradient-to-b from-background to-card">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        <div className="text-5xl mb-3">🔔</div>
        <h2 className="font-display text-4xl text-foreground mb-1 tracking-wider">REST</h2>
        <p className="text-muted-foreground text-sm mb-5">코너로 돌아가세요</p>

        {/* Progress bar */}
        <div className="bg-muted rounded-full h-2 mb-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          {currentStage} / {totalStages} 스테이지 클리어
        </p>

        {/* Score + countdown card */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <div className="text-xs text-muted-foreground mb-1">현재 점수</div>
          <div className="font-display text-3xl text-secondary tabular-nums mb-3">
            {score.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mb-1">다음 시작까지</div>
          <div className="font-display text-6xl text-primary tabular-nums leading-none">
            {restTime}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            다음: 스테이지 {nextStage}
          </p>
        </div>

        {/* Skip button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onSkip}
          className="w-full bg-primary text-primary-foreground font-display text-lg tracking-widest py-4 rounded-xl mb-4 shadow-lg active:brightness-110"
        >
          ⏭ 건너뛰기 (SKIP)
        </motion.button>

        {/* Tip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card/50 border border-border rounded-xl p-4 text-left"
        >
          <div className="text-xs font-display tracking-widest text-secondary mb-2">
            {tip.icon} {tip.title}
          </div>
          {tip.lines.map((line, i) => (
            <p key={i} className="text-xs text-foreground/70 leading-relaxed">{line}</p>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default MittRestScreen;
