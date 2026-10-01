/**
 * 🎨 복싱 트레이닝 입체 아이콘 (2026-10-01 대표님: 이모지 대신 우리 자산).
 *
 * public/assets/minigame/3d/*.webp — 경영리포트 홈 아이콘과 같은 글로시 3D 스타일로 만든 153 자산.
 * 그림을 바꾸면 ICON_VERSION 을 올린다 (폰에 남은 옛 그림 캐시를 끊기 위해).
 */
import type { CSSProperties } from 'react';

export type Icon3DName =
  | 'glove_mint'
  | 'glove_red'
  | 'bolt'
  | 'mitt'
  | 'shield'
  | 'trophy'
  | 'book'
  | 'medal_gold'
  | 'medal_silver'
  | 'medal_bronze'
  | 'fire'
  | 'gem'
  | 'star'
  | 'stopwatch'
  | 'bell'
  | 'crown'
  | 'calendar'
  | 'headgear'
  | 'hero_gloves';

const ICON_VERSION = 1;

export const icon3dUrl = (name: Icon3DName) => `/assets/minigame/3d/${name}.webp?v=${ICON_VERSION}`;

interface Props {
  name: Icon3DName;
  /** 한 변 px (hero_gloves 는 가로가 더 넓은 그림이라 size 가 가로 기준) */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** 흐리게 (꺼진 상태 — 쉴드 없음 · 별 미획득 등) */
  dim?: boolean;
  /** 둥실 떠 있는 애니메이션 */
  float?: boolean;
  alt?: string;
}

const Icon3D = ({ name, size = 48, className = '', style, dim, float, alt = '' }: Props) => (
  <img
    src={icon3dUrl(name)}
    width={size}
    height={size}
    alt={alt}
    aria-hidden={alt ? undefined : true}
    draggable={false}
    decoding="async"
    className={`icon3d inline-block shrink-0 select-none ${float ? 'icon3d-float' : ''} ${
      dim ? 'opacity-25 grayscale' : ''
    } ${className}`}
    style={{ width: size, height: size, objectFit: 'contain', ...style }}
  />
);

export default Icon3D;

/** 등급 → 아이콘 (반응속도·디펜스 공통) */
export const TIER_ICON: Record<string, Icon3DName> = {
  bronze: 'medal_bronze',
  silver: 'medal_silver',
  gold: 'medal_gold',
  platinum: 'gem',
  legend: 'crown',
};

/** 리더보드 1·2·3등 메달 */
export const RANK_MEDAL: Record<number, Icon3DName> = {
  1: 'medal_gold',
  2: 'medal_silver',
  3: 'medal_bronze',
};
