import { motion } from 'framer-motion';
import { useState } from 'react';
import { Info } from 'lucide-react';
import HowToPlayModal, { GameMode } from './HowToPlayModal';

interface ModeSelectProps {
  onMode1: () => void;
  onMode2: () => void;
  onMode3: () => void;
  onEducation: () => void;
  onLeaderboard: () => void;
}

const ModeSelect = ({ onMode1, onMode2, onMode3, onEducation, onLeaderboard }: ModeSelectProps) => {
  const [helpMode, setHelpMode] = useState<GameMode | null>(null);

  const InfoBtn = ({ mode, color }: { mode: GameMode; color: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setHelpMode(mode); }}
      className={`shrink-0 w-8 h-8 rounded-full bg-background/60 border border-border flex items-center justify-center ${color} hover:scale-110 transition-transform`}
      aria-label="게임 설명서"
    >
      <Info className="w-4 h-4" />
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pt-16 pb-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center relative z-10 w-full max-w-sm"
      >
        <div className="text-6xl mb-3">🥊</div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-1">
          BOXING
        </h1>
        <h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-6">
          TRAINING CENTER
        </h2>

        <div className="flex flex-col gap-4 w-full">
          {/* Mode 1 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onMode1}
            className="w-full bg-card border border-border hover:border-primary/50 rounded-2xl p-5 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl">⚡</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl text-foreground tracking-wider">
                  반응속도 트레이닝
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  펀치 명령에 최대한 빠르게 반응하세요
                </div>
                <div className="text-xs text-primary mt-1 font-display tracking-wider">
                  REACTION SPEED MODE
                </div>
              </div>
              <InfoBtn mode="reaction" color="text-primary" />
            </div>
          </motion.button>

          {/* Mode 2 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onMode2}
            className="w-full bg-card border border-border hover:border-secondary/50 rounded-2xl p-5 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl">🎯</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl text-foreground tracking-wider">
                  미트 드릴 트레이닝
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  트레이너 호출을 듣고 콤보를 따라치세요
                </div>
                <div className="text-xs text-secondary mt-1 font-display tracking-wider">
                  MITT DRILL MODE
                </div>
              </div>
              <InfoBtn mode="mitt" color="text-secondary" />
            </div>
          </motion.button>

          {/* Mode 3 — Boxing Defense Rush */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onMode3}
            className="w-full bg-card border border-primary/40 hover:border-primary rounded-2xl p-5 text-left transition-colors relative overflow-hidden"
            style={{ boxShadow: 'inset 0 0 30px rgba(220,38,38,0.1)' }}
          >
            <div className="absolute top-2 right-2 text-[9px] font-display tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded">
              NEW
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl">🛡️</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl text-foreground tracking-wider">
                  복싱 디펜스 러시
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  좌우 공격을 막고 카운터를 노려라
                </div>
                <div className="text-xs text-primary mt-1 font-display tracking-wider">
                  DEFENSE RUSH
                </div>
              </div>
              <InfoBtn mode="defense" color="text-primary" />
            </div>
          </motion.button>

          {/* Leaderboard + Education row */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onLeaderboard}
              className="bg-card border border-secondary/40 hover:border-secondary rounded-2xl p-4 text-left transition-colors"
            >
              <div className="text-3xl mb-1">🏆</div>
              <div className="font-display text-base text-foreground tracking-wider">
                랭킹
              </div>
              <div className="text-[10px] text-secondary font-display tracking-widest mt-0.5">
                LEADERBOARD
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onEducation}
              className="bg-card border border-border hover:border-border/80 rounded-2xl p-4 text-left transition-colors"
            >
              <div className="text-3xl mb-1">📚</div>
              <div className="font-display text-base text-foreground tracking-wider">
                미트 트레이닝이란?
              </div>
              <div className="text-[10px] text-muted-foreground font-display tracking-widest mt-0.5">
                LEARN
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-4 flex gap-6 text-2xl opacity-20">
        <span>👊</span><span>🤜</span><span>🥊</span><span>⬆️</span>
      </div>

      <HowToPlayModal
        open={helpMode !== null}
        mode={helpMode ?? 'reaction'}
        onClose={() => setHelpMode(null)}
      />
    </div>
  );
};

export default ModeSelect;
