import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export type GameMode = 'reaction' | 'mitt' | 'defense';

interface HowToPlayModalProps {
  open: boolean;
  mode: GameMode;
  onClose: () => void;
}

interface Section {
  title: string;
  items: { icon: string; text: React.ReactNode }[];
}

interface Guide {
  emoji: string;
  title: string;
  subtitle: string;
  accent: string; // tailwind text color class
  goal: string;
  sections: Section[];
  tips: string[];
}

const GUIDES: Record<GameMode, Guide> = {
  reaction: {
    emoji: '⚡',
    title: '반응속도 트레이닝',
    subtitle: 'REACTION SPEED MODE',
    accent: 'text-rating-lightning',
    goal: '화면에 뜬 펀치 명령을 최대한 빠르게 따라치세요. 빠를수록 점수가 올라갑니다.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: '👊', text: <>화면에 뜬 펀치(잽/훅/어퍼 등)를 <b className="text-foreground">동일한 버튼</b>으로 탭</> },
          { icon: '⏱️', text: <>반응이 빠를수록 <b className="text-rating-lightning">PERFECT</b> → <b className="text-rating-fast">FAST</b> → GOOD 순으로 점수 차등</> },
          { icon: '❌', text: <>다른 버튼을 누르면 <b className="text-destructive">오타</b>로 콤보 초기화</> },
        ],
      },
      {
        title: '점수 / 콤보',
        items: [
          { icon: '⚡', text: 'PERFECT(<200ms): 최대 점수 + 콤보 +1' },
          { icon: '🔥', text: '연속 성공 시 콤보 보너스 누적' },
          { icon: '👻', text: '본인 최고기록(고스트)과 실시간 격차 표시' },
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
    emoji: '🎯',
    title: '미트 드릴 트레이닝',
    subtitle: 'MITT DRILL MODE',
    accent: 'text-secondary',
    goal: '트레이너의 콤보 호출(예: "원-투-훅")을 듣고 순서대로 정확히 따라치세요.',
    sections: [
      {
        title: '조작법',
        items: [
          { icon: '👂', text: <>트레이너 호출 → <b className="text-foreground">표시된 글러브 순서</b>대로 탭</> },
          { icon: '🎯', text: <>미트가 나오는 <b className="text-secondary">정확한 타이밍</b>에 맞춰 치기</> },
          { icon: '🎭', text: <><b className="text-foreground">FEINT</b>(페인트): 미트가 빠지면 치지 않기 — 안 치는 게 정답</> },
        ],
      },
      {
        title: '판정',
        items: [
          { icon: '⚡', text: 'PERFECT — 정확한 타이밍' },
          { icon: '⏩', text: 'TOO EARLY — 너무 빨라서 허공 가르기' },
          { icon: '🐢', text: 'TOO LATE — 미트가 이미 지나감' },
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
    emoji: '🛡️',
    title: '복싱 디펜스 러시',
    subtitle: 'DEFENSE RUSH',
    accent: 'text-primary',
    goal: '좌/우에서 들어오는 공격을 같은 쪽 가드로 막아내고, 콤보를 쌓아 카운터로 점수를 폭발시키세요.',
    sections: [
      {
        title: '조작법 (단 2개 버튼)',
        items: [
          { icon: '⬅️', text: <>왼쪽에서 공격이 오면 → <b className="text-primary">왼쪽 GUARD</b></> },
          { icon: '➡️', text: <>오른쪽에서 공격이 오면 → <b className="text-blue-400">오른쪽 GUARD</b></> },
          { icon: '🎯', text: <>도착 직전 <b className="text-secondary">±200ms</b> 안에 누르면 PERFECT</> },
          { icon: '🎭', text: <><b className="text-foreground">FEINT</b>: 글러브가 도중에 사라지면 누르지 않기 (속지 않기)</> },
        ],
      },
      {
        title: '공격 종류',
        items: [
          { icon: '👊', text: '잽 — 기본 속도, 가장 자주 나옴' },
          { icon: '💥', text: '훅 — 예고 짧고 빠름, 집중 필요' },
          { icon: '🌀', text: '페인트 — 누르지 않고 참는 게 정답' },
          { icon: '⚠️', text: '러시 — 3~5연타 빠르게, 리듬 유지' },
        ],
      },
      {
        title: '특수 시스템',
        items: [
          { icon: '⚡', text: <><b className="text-secondary">5연속 PERFECT</b> → COUNTER TIME 발동, 중앙 펀치 연타로 보너스</> },
          { icon: '👑', text: <><b className="text-primary">20점마다 BOSS RUSH</b> — 짧은 폭주 패턴 클리어 시 +10점</> },
          { icon: '💎', text: '점수 구간별 GEM 보상 + 일일 미션 진행' },
        ],
      },
    ],
    tips: [
      '글러브 색을 보지 말고 <b>방향</b>만 보기 — 좌/우 판단이 핵심',
      '페인트가 두려우면 약간 늦게 누르는 게 안전',
      '카운터 타임은 무조건 빠르게 — 모든 탭이 점수',
      '초반 10점은 학습 구간, 천천히 리듬 잡기',
    ],
  },
};

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
          className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 border-b border-border bg-gradient-to-b from-card to-card/60">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className="text-4xl">{guide.emoji}</div>
                <div>
                  <div className={`font-display text-xs tracking-widest ${guide.accent}`}>{guide.subtitle}</div>
                  <h2 className="font-display text-2xl tracking-wider text-foreground leading-tight">
                    {guide.title}
                  </h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Goal */}
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
                <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">GOAL</div>
                <div className="text-sm text-foreground leading-relaxed">{guide.goal}</div>
              </div>

              {/* Sections */}
              {guide.sections.map((sec) => (
                <div key={sec.title}>
                  <div className={`text-[11px] font-display tracking-widest mb-2 ${guide.accent}`}>
                    ▣ {sec.title.toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    {sec.items.map((it, i) => (
                      <div key={i} className="flex items-start gap-3 bg-background/50 border border-border/60 rounded-lg p-2.5">
                        <span className="text-xl shrink-0 leading-none mt-0.5">{it.icon}</span>
                        <div className="text-sm text-foreground/90 leading-relaxed">{it.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tips */}
              <div>
                <div className="text-[11px] font-display tracking-widest text-rating-lightning mb-2">
                  💡 PRO TIPS
                </div>
                <ul className="space-y-1.5">
                  {guide.tips.map((t, i) => (
                    <li key={i} className="text-sm text-foreground/85 flex gap-2">
                      <span className="text-rating-lightning shrink-0">·</span>
                      <span dangerouslySetInnerHTML={{ __html: t }} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border bg-card">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className={`w-full py-4 rounded-2xl font-display tracking-widest text-lg ${
                  mode === 'defense'
                    ? 'bg-primary text-primary-foreground'
                    : mode === 'mitt'
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-foreground text-background'
                }`}
              >
                이해했어요! 시작 🥊
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HowToPlayModal;
