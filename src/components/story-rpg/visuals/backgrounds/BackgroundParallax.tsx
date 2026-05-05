/**
 * 153 스토리 RPG — 패럴랙스 layer wrapper (Stage 47A).
 *
 * 마우스 위치 (-1..1) 와 depth (0..1) 를 받아 transform 적용.
 */

import { type ReactNode } from "react";

export interface BackgroundParallaxProps {
  mouse: { x: number; y: number };
  depth: number; // 0 (배경 — 거의 안 움직임) ~ 1 (전경 — 많이 움직임)
  children: ReactNode;
  className?: string;
}

const BackgroundParallax = ({
  mouse,
  depth,
  children,
  className = "",
}: BackgroundParallaxProps) => {
  const tx = -mouse.x * depth * 14;
  const ty = -mouse.y * depth * 8;
  return (
    <div
      className={`absolute inset-0 will-change-transform ${className}`}
      style={{ transform: `translate3d(${tx}px, ${ty}px, 0)` }}
    >
      {children}
    </div>
  );
};

export default BackgroundParallax;
