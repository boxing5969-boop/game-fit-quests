/**
 * 🥊 복싱 트레이닝 — 모드 고르기 (2026-10-01 다크 아레나 개편).
 * 세 모드 카드(입체 아이콘) + 랭킹·배우기. 이모지 없음.
 */
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import HowToPlayModal, { GameMode } from './HowToPlayModal';
import Icon3D, { type Icon3DName } from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

interface ModeSelectProps {
  onMode1: () => void;
  onMode2: () => void;
  onMode3: () => void;
  onEducation: () => void;
  onLeaderboard: () => void;
}

const MODES: {
  key: GameMode;
  icon: Icon3DName;
  title: string;
  sub: string;
  desc: string;
  glow: string;
  tag?: string;
}[] = [
  {
    key: 'reaction',
    icon: 'bolt',
    title: '반응속도 트레이닝',
    sub: 'REACTION SPEED',
    desc: '펀치 명령이 뜨면 최대한 빠르게',
    glow: 'hsl(43 90% 60% / 0.28)',
  },
  {
    key: 'mitt',
    icon: 'mitt',
    title: '미트 드릴 트레이닝',
    sub: 'MITT DRILL',
    desc: '내려오는 글러브를 타이밍 맞춰 때리기',
    glow: 'hsl(8 78% 55% / 0.28)',
  },
  {
    key: 'defense',
    icon: 'shield',
    title: '복싱 디펜스 러시',
    sub: 'DEFENSE RUSH',
    desc: '좌우 공격을 막고 카운터를 노려라',
    glow: 'hsl(160 84% 42% / 0.28)',
    tag: 'NEW',
  },
];

const ModeSelect = ({ onMode1, onMode2, onMode3, onEducation, onLeaderboard }: ModeSelectProps) => {
  const [helpMode, setHelpMode] = useState<GameMode | null>(null);
  const go = (fn: () => void) => () => { audio.tap(); fn(); };
  const start: Record<GameMode, () => void> = { reaction: onMode1, mitt: onMode2, defense: onMode3 };

  return (
    <div className="arena-bg arena-ropes relative flex min-h-screen flex-col items-center overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+3.25rem)]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* 머리 — 두 글러브 + 제목 */}
        <div className="relative mb-5 flex flex-col items-center text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute top-2 h-32 w-56 rounded-full"
            style={{ background: 'radial-gradient(ellipse, hsl(160 84% 39% / 0.35), transparent 65%)' }}
          />
          <Icon3D name="hero_gloves" size={150} float className="relative" />
          <h1 className="font-display mt-1 text-[44px] leading-none tracking-wide text-foreground">
            BOXING <span className="text-primary">ARENA</span>
          </h1>
          <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
            153 복싱 트레이닝 · 매일 5분, 타이밍이 달라져요
          </p>
        </div>

        {/* 모드 카드 */}
        <div className="flex w-full flex-col gap-3">
          {MODES.map((m, i) => (
            <motion.button
              key={m.key}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.07 }}
              whileTap={{ scale: 0.98 }}
              onClick={go(start[m.key])}
              className="mg-card relative w-full overflow-hidden p-4 text-left active:brightness-110"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -left-6 -top-10 h-32 w-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${m.glow}, transparent 70%)` }}
              />
              {m.tag && (
                <span className="absolute right-3 top-3 rounded-md bg-primary px-1.5 py-0.5 font-display text-[11px] tracking-[0.2em] text-primary-foreground">
                  {m.tag}
                </span>
              )}
              <div className="relative flex items-center gap-3.5">
                <Icon3D name={m.icon} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[12px] tracking-[0.25em] text-primary">{m.sub}</div>
                  <div className="text-[17px] font-black leading-tight text-foreground">{m.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{m.desc}</div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${m.title} 설명서`}
                  onClick={(e) => { e.stopPropagation(); audio.tap(); setHelpMode(m.key); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setHelpMode(m.key); } }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground ring-1 ring-white/10 active:scale-90"
                >
                  <Info className="h-4 w-4" />
                </span>
              </div>
            </motion.button>
          ))}

          {/* 랭킹 · 배우기 */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              whileTap={{ scale: 0.97 }}
              onClick={go(onLeaderboard)}
              className="mg-card relative flex flex-col items-start overflow-hidden p-4 text-left"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(43 83% 62% / 0.25), transparent 70%)' }}
              />
              <Icon3D name="trophy" size={48} />
              <div className="mt-2 text-[15px] font-black text-foreground">랭킹</div>
              <div className="font-display text-[11px] tracking-[0.25em] text-secondary">LEADERBOARD</div>
              <ChevronRight className="absolute bottom-4 right-3 h-4 w-4 text-muted-foreground/60" />
            </motion.button>

            <motion.button
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              whileTap={{ scale: 0.97 }}
              onClick={go(onEducation)}
              className="mg-card relative flex flex-col items-start overflow-hidden p-4 text-left"
            >
              <Icon3D name="book" size={48} />
              <div className="mt-2 text-[15px] font-black text-foreground">미트 트레이닝이란?</div>
              <div className="font-display text-[11px] tracking-[0.25em] text-muted-foreground">LEARN</div>
              <ChevronRight className="absolute bottom-4 right-3 h-4 w-4 text-muted-foreground/60" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <HowToPlayModal
        open={helpMode !== null}
        mode={helpMode ?? 'reaction'}
        onClose={() => setHelpMode(null)}
      />
    </div>
  );
};

export default ModeSelect;
