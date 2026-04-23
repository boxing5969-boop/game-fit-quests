import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSliderProps {
  onComplete: () => void;
}

const CARDS = [
  {
    emoji: '🥊',
    title: '미트 트레이닝이란?',
    points: [
      '트레이너가 들고 있는 미트(패드)를 정확한 타이밍에 치는 훈련',
      '단순한 운동이 아닌 타이밍, 반응속도, 정확도를 동시에 키우는 복싱의 핵심 훈련',
    ],
    visual: (
      <div className="flex items-center justify-center gap-4 text-6xl my-6 animate-pulse">
        <span>🥊</span>
        <span className="text-4xl">💥</span>
        <span>🎯</span>
      </div>
    ),
  },
  {
    emoji: '⚡',
    title: '왜 미트 트레이닝인가?',
    points: [
      '샌드백은 기다려주지만 미트는 움직입니다',
      '살아있는 타이밍 감각은 미트에서만 만들어집니다',
      '반복할수록 몸이 먼저 반응하는 근육기억이 생깁니다',
    ],
    highlight: '"샌드백 1000번보다 미트 100번이 실전에 가깝다"',
  },
  {
    emoji: '🏆',
    title: '타이밍 마스터가 되는 법',
    steps: [
      { step: 1, text: '트레이너 미트 위치 인식' },
      { step: 2, text: '거리와 타이밍 계산' },
      { step: 3, text: '정확한 순간에 카운터' },
      { step: 4, text: '반복으로 자동화' },
    ],
    footer: '"체육관 미트 트레이닝 전 5분, 이 게임이 당신의 타이밍을 바꿉니다"',
  },
];

const IntroSlider = ({ onComplete }: IntroSliderProps) => {
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 relative">
      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute top-4 right-4 text-sm text-muted-foreground font-display tracking-wider z-10 hover:text-foreground transition-colors"
      >
        SKIP →
      </button>

      {/* Dots */}
      <div className="flex gap-2 mb-6">
        {CARDS.map((_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === index ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.3 }}
          className="max-w-sm w-full bg-card border border-border rounded-2xl p-6"
        >
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">{card.emoji}</div>
            <h2 className="font-display text-3xl tracking-wider text-foreground">
              {card.title}
            </h2>
          </div>

          {card.visual && card.visual}

          {card.points && (
            <ul className="space-y-3 mb-4">
              {card.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          {card.highlight && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 my-4 text-center">
              <p className="text-sm font-bold text-secondary italic">
                {card.highlight}
              </p>
            </div>
          )}

          {card.steps && (
            <div className="space-y-3 mb-4">
              {card.steps.map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-display text-lg flex items-center justify-center shrink-0">
                    {s.step}
                  </div>
                  <span className="text-sm text-foreground/90">{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {card.footer && (
            <p className="text-xs text-muted-foreground text-center italic mt-4">
              {card.footer}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 w-full max-w-sm">
        {isLast ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onComplete}
            className="w-full punch-btn bg-primary text-primary-foreground py-4 text-lg font-display tracking-widest"
          >
            훈련 시작하기 🥊
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIndex(i => i + 1)}
            className="w-full punch-btn bg-muted text-foreground py-4 font-display tracking-widest"
          >
            다음 →
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default IntroSlider;
