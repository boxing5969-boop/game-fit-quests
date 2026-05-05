/**
 * 153 스토리 RPG — 마우스 위치 훅 (Stage 47A).
 *
 * 패럴랙스 layer 가 mouse 위치를 따라가도록 raf 기반으로 부드럽게 추적.
 * containerRef 안에서 -1..1 범위의 x/y 를 반환 (가운데 = 0).
 */

import { useEffect, useRef, useState } from "react";

export interface MousePosition {
  x: number;
  y: number;
}

export function useMousePosition(
  containerRef: React.RefObject<HTMLElement>,
): MousePosition {
  const [pos, setPos] = useState<MousePosition>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRef.current = { x, y };
    };
    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    const tick = () => {
      setPos((cur) => ({
        x: cur.x + (targetRef.current.x - cur.x) * 0.08,
        y: cur.y + (targetRef.current.y - cur.y) * 0.08,
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return pos;
}
