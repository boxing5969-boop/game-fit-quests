/**
 * 펀치 네 종류의 방향 기호 (이모지 대체, 2026-10-01).
 *   잽 = 짧게 곧장 →   스트레이트 = 길게 두 줄 ⇒   훅 = 옆으로 감아 돌아 ↷   어퍼 = 아래에서 위로 ↑
 * 색은 currentColor — 레인 색 글자 위에 그대로 올린다.
 */
import type { PunchType } from '@/features/minigame/types/game';

interface Props {
  type: PunchType;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const PunchGlyph = ({ type, size = 28, className = '', strokeWidth = 2.6 }: Props) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
  switch (type) {
    case 'jab':
      return (
        <svg {...common}>
          <path d="M5 12h12" />
          <path d="M13 7l5 5-5 5" />
        </svg>
      );
    case 'straight':
      return (
        <svg {...common}>
          <path d="M3 9h11" />
          <path d="M3 15h11" />
          <path d="M14 6l6 6-6 6" />
        </svg>
      );
    case 'hook':
      return (
        <svg {...common}>
          <path d="M5 16c0-6 4-9 9-9h5" />
          <path d="M15 3l4 4-4 4" />
          <path d="M5 16v3" />
        </svg>
      );
    case 'upper':
    default:
      return (
        <svg {...common}>
          <path d="M12 19V6" />
          <path d="M6 12l6-6 6 6" />
          <path d="M8 19h8" />
        </svg>
      );
  }
};

export default PunchGlyph;
