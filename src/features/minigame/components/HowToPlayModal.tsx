/**
 * 게임 설명서 모달 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘·라인 아이콘).
 */
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Crosshair, EyeOff, Hand, Hourglass, Lightbulb,
  Timer, TrendingUp, X, Zap, type LucideIcon,
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

// 수치·규칙은 reactionConfig / mittDrillConfig / defenseConfig 와 엔진을 그대로 옮긴 것 (2026-10-01 검수 — 설명서가 엔진과 달랐다)
const GUIDES: Record<GameMode, Guide> = {
  reaction: {
    icon: 'bolt',
    title: '반응속도 트레이닝',
    subtitle: 'REACTION SPEED MODE',
    accent: 'text-rating-lightning',
    goal: '화면에 뜨는 펀치 명령과 같은 버튼을 가능한 빨리 누르세요. 5번 성공하면 다음 라운드 — 라운드가 오를수록 빨라집니다.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: Hand, text: <>화면에 뜬 펀치(잽·스트레이트·훅·어퍼)와 <b className="text-foreground">같은 버튼</b>을 탭</> },
          { icon: Timer, text: <>빠르면 <b className="text-rating-lightning">PERFECT 100점</b>, 조금 늦으면 <b className="text-rating-good">GOOD 50점</b> — 1~5라운드는 3초 안이면 OK</> },
          { icon: X, text: <><b className="text-destructive">다른 버튼</b>을 누르거나 시간 안에 못 치면 MISS → 실드가 없으면 게임 끝</> },
        ],
      },
      {
        title: '보호 / 보너스',
        items: [
          { icon: 'shield', text: <>라운드 2 클리어 때 <b className="text-foreground">실드 1개</b> 확정(이후 18%) — MISS 한 번을 대신 막고 콤보는 절반으로</> },
          { icon: 'fire', text: <><b className="text-foreground">PERFECT 7연속 → FEVER</b> 4.5초, 점수 2배</> },
          { icon: TrendingUp, text: '6라운드부터 반응 시간이 줄고, 30초 뒤부터 페이크·연속 큐가 섞인다' },
        ],
      },
    ],
    tips: [
      '손가락은 항상 네 버튼 위에',
      '명령이 뜨자마자 반응 — 생각하지 말고 직감',
      '첫 판은 실드 5개로 시작 — 틀려도 괜찮으니 리듬부터',
    ],
  },
  mitt: {
    icon: 'mitt',
    title: '미트 드릴 트레이닝',
    subtitle: 'MITT DRILL MODE',
    accent: 'text-secondary',
    goal: '네 레인으로 떨어지는 글러브가 아래 타격선에 닿는 순간, 같은 펀치 버튼을 치세요. 시간이 끝날 때 에너지가 남아 있으면 라운드 클리어.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: Hand, text: <>떨어지는 글러브와 <b className="text-foreground">같은 레인 버튼</b>을 글러브가 <b className="text-secondary">타격선에 닿을 때</b> 탭</> },
          { icon: Crosshair, text: <>딱 맞추면 <b className="text-rating-lightning">PERFECT 100점</b>(에너지 회복), 조금 빗나가면 <b className="text-rating-good">GOOD 50점</b></> },
          { icon: X, text: <>놓치거나 <b className="text-destructive">엉뚱한 버튼</b>을 치면 에너지가 깎인다 — 0이 되거나 연속 미스(4~6회)면 KO</> },
        ],
      },
      {
        title: '라운드 / 별점',
        items: [
          { icon: Timer, text: '라운드마다 제한 시간 — ROUND 1은 18초, 올라갈수록 길고 빨라진다' },
          { icon: 'star', text: '정확도 90% + 에너지 50% 이상이면 별 3개 · 정확도 75% 이상이면 별 2개' },
          { icon: 'fire', text: '콤보가 쌓이면 타격마다 보너스 (+5점 × 콤보, 최대 30콤보)' },
        ],
      },
    ],
    tips: [
      '글러브를 끝까지 보고 타격선에서 치기',
      '안 떨어진 레인은 치지 않기 — 헛스윙이 가장 비싸다',
      '미스가 이어지면 한 박자 멈추고 리듬 다시 잡기',
    ],
  },
  defense: {
    icon: 'shield',
    title: '복싱 디펜스 러시',
    subtitle: 'DEFENSE RUSH',
    accent: 'text-primary',
    goal: '좌·우에서 들어오는 공격을 같은 쪽 GUARD로 막아 버티세요. 기록은 생존 시간 — 오래 살아남을수록 등급이 오릅니다.',
    sections: [
      {
        title: '조작법 (단 2개 버튼)',
        items: [
          { icon: ArrowLeft, text: <>왼쪽에서 공격이 오면 → <b className="text-destructive">왼쪽 GUARD</b></> },
          { icon: ArrowRight, text: <>오른쪽에서 공격이 오면 → <b className="text-sky-400">오른쪽 GUARD</b></> },
          { icon: Crosshair, text: <>도착 직전 <b className="text-secondary">±0.23초</b> 안에 누르면 PERFECT(2점), ±0.43초면 GOOD(1점)</> },
          { icon: X, text: <>반대쪽을 막거나, 너무 빠르거나, 놓치면 한 방 — <b className="text-foreground">헤드기어가 없으면 끝</b></> },
        ],
      },
      {
        title: '공격 종류',
        items: [
          { icon: 'glove_red', text: '잽 — 기본 속도(1초), 가장 자주 나온다' },
          { icon: Zap, text: '훅 — 예고가 짧다(0.7초), 20초부터 등장' },
          { icon: EyeOff, text: <>페인트 — <b className="text-foreground">처음 보인 쪽은 가짜</b>, 중간에 바뀐 진짜 쪽을 막아야 한다 (30초부터)</> },
          { icon: AlertTriangle, text: '러시 — 가장 빠른 한 방(0.56초), 45초부터' },
        ],
      },
      {
        title: '특수 시스템',
        items: [
          { icon: 'bolt', text: <><b className="text-secondary">PERFECT 5연속 → COUNTER TIME</b> 2.2초 — 아무 버튼이나 연타 (최대 8회, 1점씩)</> },
          { icon: 'fire', text: <><b className="text-foreground">PERFECT 7연속 → FEVER</b> 4.5초, 점수 2배 · 공격이 느려진다</> },
          { icon: 'crown', text: <><b className="text-primary">30초마다 BOSS RUSH</b> — 잽 6연타, 다 막으면 +10점</> },
          { icon: 'headgear', text: <>10번 막으면 라운드 클리어 — 라운드 2 클리어 때 <b className="text-foreground">헤드기어</b> 확정(이후 18%), 한 방을 대신 맞아 준다</> },
          { icon: Hourglass, text: '라운드 3 클리어부터 가끔 FOCUS(5초 판정 넉넉) · SLOW-MO(3초 공격 느려짐) 드롭' },
          { icon: 'gem', text: '생존 15초부터 젬 — 15s 5 · 30s 10 · 45s 15 · 60s 20 · 90s 30 (하루 60 상한)' },
        ],
      },
    ],
    tips: [
      <>글러브 색이 아니라 <b>방향</b>만 보기 — 좌/우 판단이 핵심</>,
      '페인트는 바뀐 뒤의 쪽이 진짜 — 끝까지 보고 막기',
      '카운터 타임은 무조건 빠르게 연타 — 모든 탭이 점수',
      '처음 10초는 잽만 나온다 — 리듬 먼저 잡기',
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
