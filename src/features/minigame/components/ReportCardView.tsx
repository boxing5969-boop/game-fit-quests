import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReportCard, buildShareText } from '@/features/minigame/lib/report';
import { SessionResult } from '@/features/minigame/types/game';
import RadarChart from './RadarChart';

interface ReportCardViewProps {
  card: ReportCard;
  result: SessionResult;
}

const GRADE_COLORS: Record<string, string> = {
  S: 'text-rating-lightning',
  A: 'text-rating-fast',
  B: 'text-rating-good',
  C: 'text-rating-slow',
  D: 'text-rating-miss',
};

const ReportCardView = ({ card, result }: ReportCardViewProps) => {
  const [shared, setShared] = useState(false);

  const onShare = async () => {
    const text = buildShareText(result.playerName, result, card);
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      toast.success('결과가 클립보드에 복사되었습니다!');
      setTimeout(() => setShared(false), 2000);
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-2xl p-6 mb-4"
    >
      <div className="text-center mb-4">
        <div className="text-muted-foreground text-xs font-display tracking-widest mb-1">
          TRAINING REPORT
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className={`font-display text-7xl ${GRADE_COLORS[card.grade]} leading-none`}>
            {card.grade}
          </div>
          <div className="text-left">
            <div className="text-muted-foreground text-xs">OVERALL</div>
            <div className="font-display text-3xl text-foreground">{card.totalScore}</div>
          </div>
        </div>
      </div>

      <RadarChart stats={card.stats} />

      <div className="mt-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
        <div className="text-xs text-muted-foreground mb-1 font-display tracking-widest">
          💡 PERSONALIZED TIP
        </div>
        <div className="text-sm text-foreground">{card.weaknessKo}</div>
        <div className="text-xs text-muted-foreground mt-1">{card.weaknessEn}</div>
      </div>

      <button
        onClick={onShare}
        className="mt-4 w-full py-3 rounded-lg bg-muted hover:bg-muted/70 font-display tracking-widest text-sm text-foreground transition-colors"
      >
        {shared ? '✓ COPIED!' : '📋 SHARE RESULT'}
      </button>
    </motion.div>
  );
};

export default ReportCardView;
