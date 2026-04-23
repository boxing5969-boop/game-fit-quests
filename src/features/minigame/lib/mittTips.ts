import { PunchType } from '@/features/minigame/types/game';

export const PUNCH_MITT_TIPS: Record<PunchType, string> = {
  jab: '💡 잽 카운터: 짧고 빠르게, 미트 중앙을 노려라',
  straight: '💡 스트레이트: 체중을 실어 미트 정면을 강하게',
  hook: '💡 훅 카운터: 옆으로 스텝 후 반격이 핵심',
  upper: '💡 어퍼: 무릎을 살짝 굽혀 아래에서 위로',
};

export const REST_TIPS = [
  {
    icon: '🥊',
    title: '미트 트레이닝 TIP #1',
    lines: [
      '눈은 항상 트레이너의 어깨를 봐라.',
      '어깨가 먼저 움직여야 미트가 온다.',
      '게임에서도 펀치 애니메이션 시작점을 주목하세요!',
    ],
  },
  {
    icon: '⚡',
    title: '미트 트레이닝 TIP #2',
    lines: [
      '타이밍은 연습할수록 몸에 저장됩니다.',
      '처음엔 눈으로 보고 치지만',
      '고수는 리듬으로 느끼고 칩니다.',
      '오늘 이 게임을 10분 하면 내일 미트가 달라집니다!',
    ],
  },
];

export function getMittReport(perfectPct: number): { emoji: string; title: string; lines: string[] } {
  if (perfectPct >= 70) {
    return {
      emoji: '🏆',
      title: '타이밍 마스터 등급!',
      lines: [
        '오늘 체육관에서 미트 트레이닝 하면',
        '트레이너가 깜짝 놀랄 거예요.',
        '이 타이밍 감각 그대로 미트에 적용하세요!',
      ],
    };
  }
  if (perfectPct >= 40) {
    return {
      emoji: '💪',
      title: '타이밍이 늘고 있어요!',
      lines: [
        '미트 트레이닝을 꾸준히 하면',
        'PERFECT 비율이 자연스럽게 올라갑니다.',
        '내일도 게임 5분 + 미트 트레이닝 도전!',
      ],
    };
  }
  return {
    emoji: '🌱',
    title: '타이밍 훈련 시작 단계',
    lines: [
      '괜찮아요! 모든 고수는 여기서 시작했어요.',
      '미트 트레이닝의 핵심은 반복입니다.',
      '매일 이 게임으로 눈과 손을 깨우세요 🥊',
    ],
  };
}

export const TIER_MITT_DESC: Record<string, string> = {
  bronze: '미트가 어디있는지 보고 치는 단계',
  silver: '콤보를 외워서 치는 단계',
  gold: '리듬을 느끼며 치는 단계',
  platinum: '트레이너 호흡을 읽고 먼저 반응하는 단계',
  legend: '눈 감아도 타이밍이 몸에서 나오는 단계\n진정한 미트 트레이닝 고수',
};
