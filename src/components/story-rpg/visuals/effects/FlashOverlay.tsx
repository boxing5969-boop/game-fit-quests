/**
 * 153 스토리 RPG — 화면 플래시 (Stage 47A).
 */

import { useEffect, useState } from "react";

export interface FlashOverlayProps {
  trigger: number;
  color?: "white" | "red" | "amber";
  duration?: number;
}

const COLOR_MAP: Record<NonNullable<FlashOverlayProps["color"]>, string> = {
  white: "rgba(255,255,255,0.6)",
  red: "rgba(228,30,40,0.55)",
  amber: "rgba(253,184,92,0.55)",
};

const FlashOverlay = ({
  trigger,
  color = "white",
  duration = 200,
}: FlashOverlayProps) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (trigger <= 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(t);
  }, [trigger, duration]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40 transition-opacity"
      style={{
        backgroundColor: COLOR_MAP[color],
        opacity: active ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    />
  );
};

export default FlashOverlay;
