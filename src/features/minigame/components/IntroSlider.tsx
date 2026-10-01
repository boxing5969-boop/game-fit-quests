/**
 * 첫 입장 안내 슬라이드 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

interface IntroSliderProps {
  onComplete: () => void;
}

const CARDS: {
  icon: Icon3DName;
  title: string;
  points?: string[];
  visual?: React.ReactNode;
  highlight?: string;
  steps?: { step: number; text: string }[];
  footer?: string;
}[] = [
  {
    icon: 'mitt',
    title: '미트 트레이닝이란?',
    points: [
      '트레이너가 들고 있는 미트(패드)를 정확한 타이밍에 치는 훈련',
      '단순한 운동이 아닌 타이밍, 반응속도, 정확도를 동시에 키우는 복싱의 핵심 훈련',
    ],
    visual: (
      <div className="my-5 flex items-center justify-center gap-3">
        <Icon3D name="glove_mint" size={64} float />
        <Icon3D name="bolt" size={40} />
        <Icon3D name="mitt" size={64} float />
      </div>
    ),
  },
  {
    icon: 'bolt',
    title: '왜 미트 트레이닝인가?',
    points: [
      '샌드백은 기다려주지만 미트는 움직입니다',
      '살아있는 타이밍 감각은 미트에서만 만들어집니다',
      '반복할수록 몸이 먼저 반응하는 근육기억이 생깁니다',
    ],
    highlight: '"샌드백 1000번보다 미트 100번이 실전에 가깝다"',
  },
  {
    icon: 'trophy',
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
    <div className="arena-bg arena-ropes relative flex min-h-screen flex-col items-center justify-center px-6 py-8">
      {/* Skip button */}
      <button
        onClick={() => { audio.tap(); onComplete(); }}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex items-center gap-1 font-display text-sm tracking-wider text-muted-foreground"
      >
        SKIP <ArrowRight className="h-3.5 w-3.5" />
      </button>

      {/* Dots */}
      <div className="flex gap-2 mb-6">
        {CARDS.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-primary' : 'w-2.5 bg-white/15'
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
          className="mg-card w-full max-w-sm p-6"
        >
          <div className="mb-4 text-center">
            <div className="mb-2 flex justify-center"><Icon3D name={card.icon} size={64} /></div>
            <h2 className="text-[22px] font-black tracking-tight text-foreground">
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
            <div className="my-4 rounded-xl bg-primary/10 p-4 text-center ring-1 ring-primary/20">
              <p className="text-sm font-bold italic text-secondary">
                {card.highlight}
              </p>
            </div>
          )}

          {card.steps && (
            <div className="space-y-3 mb-4">
              {card.steps.map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display text-lg text-primary">
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
            onClick={() => { audio.tap(); onComplete(); }}
            className="mg-btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl tracking-widest"
          >
            <Play className="h-5 w-5 fill-current" /> 훈련 시작하기
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { audio.tap(); setIndex(i => i + 1); }}
            className="mg-btn-ghost flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl tracking-widest"
          >
            다음 <ArrowRight className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default IntroSlider;
