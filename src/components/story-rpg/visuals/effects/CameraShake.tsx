/**
 * 153 스토리 RPG — 카메라 흔들림 (Stage 47A).
 *
 * trigger 변경 시 0.4s 동안 자식 요소 흔들림.
 */

import { useEffect, useRef, type ReactNode } from "react";

export interface CameraShakeProps {
  trigger: number;
  intensity?: "soft" | "medium" | "hard";
  children: ReactNode;
}

const INTENSITY_PX: Record<NonNullable<CameraShakeProps["intensity"]>, number> = {
  soft: 2,
  medium: 5,
  hard: 10,
};

const CameraShake = ({
  trigger,
  intensity = "medium",
  children,
}: CameraShakeProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const prevTrigger = useRef<number>(trigger);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    const el = ref.current;
    if (!el) return;
    const max = INTENSITY_PX[intensity];
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Date.now() - start;
      if (t > 400) {
        el.style.transform = "translate3d(0,0,0)";
        return;
      }
      const x = (Math.random() * 2 - 1) * max * (1 - t / 400);
      const y = (Math.random() * 2 - 1) * max * (1 - t / 400);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trigger, intensity]);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
};

export default CameraShake;
