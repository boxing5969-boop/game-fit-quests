/**
 * 153 스토리 RPG — 파티클 (Stage 47A).
 *
 * 4 종 (dust / firefly / lantern / rain) × 3 density × 3 speed.
 * 외부 이미지 X — 모든 파티클 inline SVG / CSS.
 */

import { useMemo } from "react";

export type ParticleKind = "dust" | "firefly" | "lantern" | "rain";

export interface ParticleFieldProps {
  kind: ParticleKind;
  density?: "low" | "medium" | "high";
  speed?: "slow" | "normal" | "fast";
  className?: string;
}

const DENSITY_COUNT: Record<NonNullable<ParticleFieldProps["density"]>, number> = {
  low: 10,
  medium: 20,
  high: 40,
};

const SPEED_DUR: Record<NonNullable<ParticleFieldProps["speed"]>, [number, number]> = {
  slow: [8, 14],
  normal: [4, 9],
  fast: [1, 3],
};

const ParticleField = ({
  kind,
  density = "medium",
  speed = "normal",
  className = "",
}: ParticleFieldProps) => {
  const count = DENSITY_COUNT[density];
  const [minDur, maxDur] = SPEED_DUR[speed];

  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const dur = minDur + Math.random() * (maxDur - minDur);
      const delay = Math.random() * dur * -1;
      const size =
        kind === "lantern"
          ? 10 + Math.random() * 8
          : kind === "rain"
            ? 1 + Math.random() * 1
            : 2 + Math.random() * 3;
      const drift = (Math.random() * 2 - 1) * 30;
      return { id: i, left, top, dur, delay, size, drift };
    });
    // intentionally re-randomize when count/kind/speed change
  }, [count, kind, minDur, maxDur]);

  const baseColor =
    kind === "firefly"
      ? "#fdb85c"
      : kind === "lantern"
        ? "#fdb85c"
        : kind === "rain"
          ? "#9fb1d6"
          : "#cbd5e1";
  const opacity =
    kind === "rain" ? 0.35 : kind === "dust" ? 0.4 : 0.85;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <style>{`
        @keyframes story-particle-up {
          0% { transform: translate(0, 0); opacity: 0; }
          15% { opacity: var(--p-op, 0.6); }
          85% { opacity: var(--p-op, 0.6); }
          100% { transform: translate(var(--p-drift, 0px), -120%); opacity: 0; }
        }
        @keyframes story-particle-rain {
          0% { transform: translate(0, -10%); opacity: 0; }
          10% { opacity: 0.5; }
          100% { transform: translate(0, 120%); opacity: 0.5; }
        }
      `}</style>
      {particles.map((p) => {
        const isRain = kind === "rain";
        return (
          <span
            key={p.id}
            style={
              {
                position: "absolute",
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: isRain ? `${p.size}px` : `${p.size}px`,
                height: isRain ? `${p.size * 14}px` : `${p.size}px`,
                background:
                  kind === "lantern"
                    ? `radial-gradient(circle, ${baseColor} 0%, transparent 70%)`
                    : baseColor,
                borderRadius: isRain ? "9999px" : "9999px",
                opacity: opacity,
                filter: kind === "firefly" || kind === "lantern" ? "blur(1.5px)" : "none",
                animation: `${
                  isRain ? "story-particle-rain" : "story-particle-up"
                } ${p.dur}s linear ${p.delay}s infinite`,
                "--p-drift": `${p.drift}px`,
                "--p-op": String(opacity),
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};

export default ParticleField;
