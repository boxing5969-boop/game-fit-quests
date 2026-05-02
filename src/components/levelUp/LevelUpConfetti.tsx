/**
 * 153 — 레벨업 컨페티 폭발 (rank 별 색상 + 별 모양 + 다단계).
 *
 * 다단계 폭발:
 *   t=0.4s — 양쪽에서 동시에 폭발 (스타트)
 *   t=0.7s — 중앙 폭발 (트로피 도착)
 *   t=1.0s — 좌우 분수
 *   t=1.5s — 별 / emoji 폭발
 *   t=3.0s — 잔잔한 회전 폭발
 *
 * Rank 별 색상 팔레트:
 *   white — silver/gold/white
 *   blue  — cyan/blue/gold
 *   red   — red/orange/gold
 *   black — gold/violet/white (mastery)
 */

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

export interface LevelUpConfettiProps {
  rank: string;
  isMaster?: boolean;
  /** 외부에서 시작 시점 제어 */
  active: boolean;
}

const COLORS_BY_RANK: Record<string, string[]> = {
  white: ["#E8E8E8", "#FFFFFF", "#F6C453", "#FFD700", "#C0C0C0"],
  blue: ["#4A90E2", "#1E90FF", "#00BFFF", "#F6C453", "#FFFFFF"],
  red: ["#E8553A", "#FF6347", "#FF4500", "#F6C453", "#FFD700"],
  black: ["#F6C453", "#FFD700", "#9B59B6", "#8E44AD", "#FFFFFF", "#FFC0CB"],
};

/** SVG path 로 별 모양 컨페티 만들기 */
function makeStarShape(): confetti.Shape {
  // canvas-confetti 의 path API 사용 — 5각 별
  return confetti.shapeFromPath({
    path: "M0 -10L2.939 -4.045L9.511 -3.09L4.755 1.545L5.878 8.09L0 5L-5.878 8.09L-4.755 1.545L-9.511 -3.09L-2.939 -4.045Z",
  });
}

const LevelUpConfetti = ({ rank, isMaster, active }: LevelUpConfettiProps) => {
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!active) return;

    const rankKey = (rank ?? "white").toLowerCase();
    const colors = COLORS_BY_RANK[rankKey] ?? COLORS_BY_RANK.white;
    const intensity = isMaster ? 1.6 : 1;

    // 별 모양 생성 (실패 시 default 사용)
    let starShape: confetti.Shape | null = null;
    try {
      starShape = makeStarShape();
    } catch {
      starShape = null;
    }

    const shapes: confetti.Shape[] = starShape
      ? ["circle", "square", starShape]
      : ["circle", "square"];

    // Stage 1 (t=400ms) — 양쪽에서 시작 폭발
    const t1 = window.setTimeout(() => {
      confetti({
        particleCount: Math.floor(60 * intensity),
        angle: 60,
        spread: 70,
        startVelocity: 50,
        origin: { x: 0, y: 0.7 },
        colors,
        shapes,
        scalar: 1.2,
        ticks: 200,
      });
      confetti({
        particleCount: Math.floor(60 * intensity),
        angle: 120,
        spread: 70,
        startVelocity: 50,
        origin: { x: 1, y: 0.7 },
        colors,
        shapes,
        scalar: 1.2,
        ticks: 200,
      });
    }, 400);
    cleanupRef.current.push(() => window.clearTimeout(t1));

    // Stage 2 (t=700ms) — 중앙 대폭발 (트로피 도착)
    const t2 = window.setTimeout(() => {
      confetti({
        particleCount: Math.floor(150 * intensity),
        angle: 90,
        spread: 360,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.4 },
        colors,
        shapes,
        scalar: 1.4,
        ticks: 250,
        gravity: 0.8,
      });
    }, 700);
    cleanupRef.current.push(() => window.clearTimeout(t2));

    // Stage 3 (t=1000ms~3000ms) — 좌우 분수 (지속 2초)
    const t3 = window.setTimeout(() => {
      const fountainEnd = Date.now() + 2000;
      const fountainFrame = () => {
        confetti({
          particleCount: 4,
          angle: 65,
          spread: 50,
          startVelocity: 35,
          origin: { x: 0.05, y: 0.85 },
          colors,
          shapes,
          scalar: 0.9,
          ticks: 150,
        });
        confetti({
          particleCount: 4,
          angle: 115,
          spread: 50,
          startVelocity: 35,
          origin: { x: 0.95, y: 0.85 },
          colors,
          shapes,
          scalar: 0.9,
          ticks: 150,
        });
        if (Date.now() < fountainEnd) {
          requestAnimationFrame(fountainFrame);
        }
      };
      fountainFrame();
    }, 1000);
    cleanupRef.current.push(() => window.clearTimeout(t3));

    // Stage 4 (t=1500ms) — 위에서 별 비
    const t4 = window.setTimeout(() => {
      confetti({
        particleCount: Math.floor(80 * intensity),
        angle: 270,
        spread: 180,
        startVelocity: 25,
        origin: { x: 0.5, y: -0.05 },
        colors,
        shapes,
        scalar: 1.3,
        ticks: 350,
        gravity: 0.6,
      });
    }, 1500);
    cleanupRef.current.push(() => window.clearTimeout(t4));

    // Master 만 — Stage 5 (t=2200ms) — 황금 폭풍
    if (isMaster) {
      const t5 = window.setTimeout(() => {
        confetti({
          particleCount: 200,
          angle: 90,
          spread: 360,
          startVelocity: 40,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#F6C453", "#FFD700", "#FFC0CB", "#FFFFFF"],
          shapes,
          scalar: 1.6,
          ticks: 300,
        });
      }, 2200);
      cleanupRef.current.push(() => window.clearTimeout(t5));
    }

    // Stage 6 (t=3000ms) — 잔잔한 잔향 폭발
    const t6 = window.setTimeout(() => {
      confetti({
        particleCount: Math.floor(40 * intensity),
        angle: 90,
        spread: 360,
        startVelocity: 20,
        origin: { x: 0.5, y: 0.6 },
        colors,
        shapes,
        scalar: 0.8,
        ticks: 200,
        gravity: 0.7,
      });
    }, 3000);
    cleanupRef.current.push(() => window.clearTimeout(t6));

    // cleanup
    const cleanups = cleanupRef.current;
    return () => {
      cleanups.forEach((fn) => fn());
      cleanupRef.current = [];
      try {
        confetti.reset();
      } catch {
        // ignore
      }
    };
  }, [active, rank, isMaster]);

  return null; // 렌더 없음 — confetti 는 자체 canvas 사용
};

export default LevelUpConfetti;
