/**
 * 게임 설명서 모달 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘·라인 아이콘).
 */
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Crosshair, Ear, EyeOff, FastForward, Hand, Lightbulb,
  Rewind, Timer, TrendingUp, Wind, X, Zap, type LucideIcon,
} from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';
import { audio } from '@/features/minigame/lib/audio';

export type GameMode = 'reaction' | 'mitt' | 'defense';

interface Section {
  title: string;
  items: { icon: LucideIcon | Icon3DName; text: ReactNode }[];
}

interface Guide {
  icon: Icon3DName;
  title: string;
  subtitle: string;
  accent: string; // tailwind text color class
  goal: string;
  sections: Section[];
  tips: ReactNode[];
}

const GUIDES: Record<GameMode, Guide> = {
  reaction: {
    icon: 'bolt',
    title: '반응속도 트레이닝',
    subtitle: 'REACTION SPEED MODE',
    accent: 'text-rating-lightning',
    goal: '화면에 뜬 펀치 명령을 최대한 빠르게 따라치세요. 빠를수록 점수가 올라갑니다.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: Hand, text: <>화면에 뜬 펀치(잽/훅/어퍼 등)를 <b className="text-foreground">같은 색 버튼</b>으로 탭</> },
          { icon: Timer, text: <>반응이 빠를수록 <b className="text-rating-lightning">PERFECT</b> → <b className="text-rating-fast">FAST</b> → GOOD 순으로 점수 차등</> },
          { icon: X, text: <>다른 버튼을 누르면 <b className="text-destructive">오타</b>로 콤보 초기화</> },
        ],
      },
      {
        title: '점수 / 콤보',
        items: [
          { icon: 'bolt', text: 'PERFECT(<200ms): 최대 점수 + 콤보 +1' },
          { icon: 'fire', text: '연속 성공 시 콤보 보너스 누적' },
          { icon: TrendingUp, text: '본인 최고 기록과 실시간 격차 표시' },
        ],
      },
    ],
    tips: [
      '손가락은 항상 버튼 위에 올려두기',
      '명령이 뜨자마자 반응 — 생각하지 말고 직감',
      '오타 1번보다 PERFECT 1번이 훨씬 큼',
    ],
  },
  mitt: {
    icon: 'mitt',
    title: '미트 드릴 트레이닝',
    subtitle: 'MITT DRILL MODE',
    accent: 'text-secondary',
    goal: '트레이너의 콤보 호출(예: "원-투-훅")을 듣고 순서대로 정확히 따라치세요.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: Ear, text: <>트레이너 호출 → <b className="text-foreground">표시된 글러브 순서</b>대로 탭</> },
          { icon: Crosshair, text: <>미트가 나오는 <b className="text-secondary">정확한 타이밍</b>에 맞춰 치기</> },
          { icon: EyeOff, text: <><b className="text-foreground">FEINT</b>(페인트): 미트가 빠지면 치지 않기 — 안 치는 게 정답</> },
        ],
      },
      {
        title: '판정',
        items: [
          { icon: 'bolt', text: 'PERFECT — 정확한 타이밍' },
          { icon: FastForward, text: 'TOO EARLY — 너무 빨라서 허공 가르기' },
          { icon: Rewind, text: 'TOO LATE — 미트가 이미 지나감' },
        ],
      },
    ],
    tips: [
      '호출을 끝까지 듣고 시작 — 성급함 금지',
      '리듬을 만들어서 일정한 템포로',
      '페인트는 보면 멈출 수 있다 — 침착하게',
    ],
  },
  defense: {
    icon: 'shield',
    title: '복싱 디펜스 러시',
    subtitle: 'DEFENSE RUSH',
    accent: 'text-primary',
    goal: '좌/우에서 들어오는 공격을 같은 쪽 가드로 막아내고, 콤보를 쌓아 카운터로 점수를 폭발시키세요.',
    sections: [
      {
        title: '조작법 (단 2개 버튼)',
        items: [
          { icon: ArrowLeft, text: <>왼쪽에서 공격이 오면 → <b className="text-destructive">왼쪽 GUARD</b></> },
          { icon: ArrowRight, text: <>오른쪽에서 공격이 오면 → <b className="text-sky-400">오른쪽 GUARD</b></> },
          { icon: Crosshair, text: <>도착 직전 <b className="text-secondary">±200ms</b> 안에 누르면 PERFECT</> },
          { icon: EyeOff, text: <><b className="text-foreground">FEINT</b>: 글러브가 도중에 사라지면 누르지 않기 (속지 않기)</> },
        ],
      },
      {
        title: '공격 종류',
        items: [
          { icon: 'glove_red', text: '잽 — 기본 속도, 가장 자주 나옴' },
          { icon: Zap, text: '훅 — 예고 짧고 빠름, 집중 필요' },
          { icon: Wind, text: '페인트 — 누르지 않고 참는 게 정답' },
          { icon: AlertTriangle, text: '러시 — 3~5연타 빠르게, 리듬 유지' },
        ],
      },
      {
        title: '특수 시스템',
        items: [
          { icon: 'bolt', text: <><b className="text-secondary">5연속 PERFECT</b> → COUNTER TIME 발동, 중앙 펀치 연타로 보너스</> },
          { icon: 'crown', text: <><b className="text-primary">20점마다 BOSS RUSH</b> — 짧은 폭주 패턴 클리어 시 +10점</> },
          { icon: 'gem', text: '점수 구간별 GEM 보상 + 일일 미션 진행' },
        ],
      },
    ],
    tips: [
      <>글러브 색을 보지 말고 <b>방향</b>만 보기 — 좌/우 판단이 핵심</>,
      '페인트가 두려우면 약간 늦게 누르는 게 안전',
      '카운터 타임은 무조건 빠르게 — 모든 탭이 점수',
      '초반 10점은 학습 구간, 천천히 리듬 잡기',
    ],
  },
};

const ItemIcon = ({ icon }: { icon: LucideIcon | Icon3DName }) => {
  if (typeof icon === 'string') return <Icon3D name={icon} size={26} />;
  const Lucide = icon;
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-foreground/80">
      <Lucide className="h-4 w-4" />
    </span>
  );
};

interface HowToPlayModalProps {
  open: boolean;
  mode: GameMode;
  onClose: () => void;
}

const HowToPlayModal = ({ open, mode, onClose }: HowToPlayModalProps) => {
  const guide = GUIDES[mode];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-md sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
          >
            {/* Header */}
            <div className="relative border-b border-white/[0.07] px-5 pb-4 pt-5">
              <button
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <Icon3D name={guide.icon} size={56} />
                <div>
                  <div className={`font-display text-[12px] tracking-[0.25em] ${guide.accent}`}>{guide.subtitle}</div>
                  <h2 className="text-[20px] font-black leading-tight text-foreground">{guide.title}</h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Goal */}
              <div className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/[0.06]">
                <div className="mb-1 font-display text-[11px] tracking-widest text-muted-foreground">GOAL</div>
                <div className="text-sm leading-relaxed text-foreground">{guide.goal}</div>
              </div>

              {/* Sections */}
              {guide.sections.map((sec) => (
                <div key={sec.title}>
                  <div className={`mb-2 font-display text-[12px] tracking-widest ${guide.accent}`}>
                    {sec.title.toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    {sec.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.05]">
                        <span className="shrink-0"><ItemIcon icon={it.icon} /></span>
                        <div className="text-sm leading-relaxed text-foreground/90">{it.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tips */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 font-display text-[12px] tracking-widest text-rating-lightning">
                  <Lightbulb className="h-4 w-4" /> PRO TIPS
                </div>
                <ul className="space-y-1.5">
                  {guide.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/85">
                      <span className="shrink-0 text-rating-lightning">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.07] bg-card px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { audio.tap(); onClose(); }}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg tracking-widest ${
                  mode === 'mitt' ? 'mg-btn-gold' : 'mg-btn-primary'
                }`}
              >
                이해했어요! 시작 <Icon3D name="glove_mint" size={22} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HowToPlayModal;
