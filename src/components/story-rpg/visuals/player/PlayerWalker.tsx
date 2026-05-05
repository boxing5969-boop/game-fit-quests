/**
 * 153 스토리 RPG — 월드맵 위 작은 복서 캐릭터 (Stage 47A).
 */

import { motion } from "framer-motion";
import type { WorldRouteCode } from "../backgrounds/WorldMapBackdrop";

export interface PlayerWalkerProps {
  /** 좌표 (% 단위 — WorldOverview 의 부모 박스 기준) */
  x: string;
  y: string;
  facing?: "left" | "right";
  state?: "idle" | "walking";
  routeCode?: WorldRouteCode | null;
}

const ROUTE_COLOR: Record<WorldRouteCode, string> = {
  master_path: "#b87900",
  pro_path: "#f5832b",
  champion_road: "#a40e1a",
};

const PlayerWalker = ({
  x,
  y,
  facing = "right",
  state = "idle",
  routeCode = "master_path",
}: PlayerWalkerProps) => {
  const color = routeCode ? ROUTE_COLOR[routeCode] : "#b87900";
  const isWalking = state === "walking";

  return (
    <motion.div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
      animate={{ left: x, top: y }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      style={{ width: 32, height: 40 }}
    >
      <motion.div
        animate={isWalking ? { y: [0, -2, 0] } : { y: [0, -1, 0] }}
        transition={{
          duration: isWalking ? 0.3 : 1.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}
      >
        <svg viewBox="0 0 32 40" width="32" height="40">
          {/* 머리 */}
          <circle cx="16" cy="9" r="6" fill="#f0d2b6" stroke="#1a1a1a" strokeWidth="1" />
          {/* 몸통 */}
          <rect x="11" y="14" width="10" height="14" rx="3" fill={color} stroke="#1a1a1a" strokeWidth="1" />
          {/* 글러브 */}
          <ellipse cx="8" cy="20" rx="3.5" ry="4" fill={color} stroke="#1a1a1a" strokeWidth="1" />
          <ellipse cx="24" cy="20" rx="3.5" ry="4" fill={color} stroke="#1a1a1a" strokeWidth="1" />
          {/* 다리 */}
          <motion.rect
            x="12"
            y="28"
            width="3"
            height="10"
            fill="#1a1a1a"
            animate={isWalking ? { y: [28, 26, 28] } : {}}
            transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.rect
            x="17"
            y="28"
            width="3"
            height="10"
            fill="#1a1a1a"
            animate={isWalking ? { y: [28, 30, 28] } : {}}
            transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* 그림자 */}
          <ellipse cx="16" cy="40" rx="8" ry="1.5" fill="#000" opacity="0.4" />
        </svg>
      </motion.div>
    </motion.div>
  );
};

export default PlayerWalker;
