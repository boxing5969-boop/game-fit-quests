/**
 * 153 스토리 RPG — 월드맵 배경 일러스트 (Stage 47A).
 *
 * 3 루트 (master_path / pro_path / champion_road) 별 5 layer 인라인 SVG.
 * 외부 이미지 0. 외부 IP 0. 마우스 패럴랙스 적용.
 */

import { useRef } from "react";
import { useMousePosition } from "@/hooks/useMousePosition";
import { STORY_ROUTE_BACKDROP_PALETTE } from "@/data/storyRpgVisuals";
import BackgroundParallax from "./BackgroundParallax";
import ParticleField from "../effects/ParticleField";

export type WorldRouteCode = "master_path" | "pro_path" | "champion_road";

export interface WorldMapBackdropProps {
  routeCode: WorldRouteCode | null;
}

const WorldMapBackdrop = ({ routeCode }: WorldMapBackdropProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouse = useMousePosition(containerRef);
  const palette = routeCode
    ? STORY_ROUTE_BACKDROP_PALETTE[routeCode]
    : STORY_ROUTE_BACKDROP_PALETTE.master_path;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* layer 1: 그라디언트 하늘 */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${palette.skyFrom} 0%, ${palette.skyTo} 100%)`,
        }}
      />

      {routeCode === "master_path" && (
        <MasterPathLayers mouse={mouse} accent={palette.accent} />
      )}
      {routeCode === "pro_path" && (
        <ProPathLayers mouse={mouse} accent={palette.accent} />
      )}
      {routeCode === "champion_road" && (
        <ChampionRoadLayers mouse={mouse} accent={palette.accent} />
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// 마스터의 길 — 새벽 도시 + 등불 + 안개
// ──────────────────────────────────────────────────────────────────
function MasterPathLayers({
  mouse,
  accent,
}: {
  mouse: { x: number; y: number };
  accent: string;
}) {
  return (
    <>
      {/* 산 실루엣 */}
      <BackgroundParallax mouse={mouse} depth={0.2}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
        >
          <path
            d="M 0 420 L 100 320 L 200 380 L 320 280 L 460 360 L 580 300 L 720 380 L 800 340 L 800 600 L 0 600 Z"
            fill="#1a1f4d"
            opacity="0.85"
          />
        </svg>
      </BackgroundParallax>

      {/* 도시 빌딩 + 깜빡이는 창 */}
      <BackgroundParallax mouse={mouse} depth={0.4}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
        >
          <g fill="#0b0e2e">
            <rect x="40" y="450" width="60" height="150" />
            <rect x="120" y="420" width="50" height="180" />
            <rect x="190" y="470" width="40" height="130" />
            <rect x="260" y="430" width="60" height="170" />
            <rect x="350" y="460" width="50" height="140" />
            <rect x="430" y="410" width="70" height="190" />
            <rect x="530" y="450" width="55" height="150" />
            <rect x="610" y="430" width="48" height="170" />
            <rect x="690" y="460" width="60" height="140" />
          </g>
          <g fill={accent}>
            {Array.from({ length: 24 }).map((_, i) => {
              const x = 50 + (i * 33) % 720;
              const y = 470 + ((i * 17) % 100);
              return (
                <rect key={i} x={x} y={y} width="3" height="3">
                  <animate
                    attributeName="opacity"
                    values="0.2;1;0.2"
                    dur={`${2 + (i % 3)}s`}
                    repeatCount="indefinite"
                    begin={`${(i % 5) * 0.3}s`}
                  />
                </rect>
              );
            })}
          </g>
        </svg>
      </BackgroundParallax>

      {/* 안개 */}
      <BackgroundParallax mouse={mouse} depth={0.6}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          <ellipse cx="200" cy="500" rx="280" ry="60" fill="#fff" opacity="0.05" />
          <ellipse cx="600" cy="520" rx="240" ry="50" fill="#fff" opacity="0.06" />
          <ellipse cx="400" cy="540" rx="320" ry="40" fill="#fff" opacity="0.04" />
        </svg>
      </BackgroundParallax>

      <ParticleField kind="firefly" density="medium" speed="slow" />
      <ParticleField kind="lantern" density="low" speed="slow" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 프로의 길 — 새벽 링 + 떠오르는 태양 + 줄넘기
// ──────────────────────────────────────────────────────────────────
function ProPathLayers({
  mouse,
  accent,
}: {
  mouse: { x: number; y: number };
  accent: string;
}) {
  return (
    <>
      {/* 떠오르는 태양 */}
      <BackgroundParallax mouse={mouse} depth={0.15}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          <defs>
            <radialGradient id="pro-sun" cx="50%" cy="100%" r="50%">
              <stop offset="0%" stopColor="#fdb85c" />
              <stop offset="50%" stopColor="#f5832b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a40e1a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="400" cy="500" rx="380" ry="240" fill="url(#pro-sun)" />
          <circle cx="400" cy="490" r="80" fill="#fdb85c" opacity="0.55" />
        </svg>
      </BackgroundParallax>

      {/* 링 코너 기둥 */}
      <BackgroundParallax mouse={mouse} depth={0.35}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
        >
          <g fill="#1a1f2e">
            <rect x="80" y="380" width="14" height="220" />
            <rect x="700" y="380" width="14" height="220" />
            <rect x="200" y="400" width="10" height="200" opacity="0.7" />
            <rect x="590" y="400" width="10" height="200" opacity="0.7" />
          </g>
          {/* 줄 */}
          <g stroke="#0b0e2e" strokeWidth="3" fill="none">
            <line x1="80" y1="420" x2="714" y2="420" opacity="0.6" />
            <line x1="80" y1="450" x2="714" y2="450" opacity="0.6" />
            <line x1="80" y1="480" x2="714" y2="480" opacity="0.6" />
          </g>
        </svg>
      </BackgroundParallax>

      {/* 줄넘기 곡선 (애니메이션) */}
      <BackgroundParallax mouse={mouse} depth={0.55}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          <path
            d="M 240 360 Q 400 300 560 360"
            stroke={accent}
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          >
            <animate
              attributeName="d"
              values="M 240 360 Q 400 300 560 360; M 240 360 Q 400 420 560 360; M 240 360 Q 400 300 560 360"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </BackgroundParallax>

      <ParticleField kind="dust" density="medium" speed="normal" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 챔피언 로드 — 폭풍 + 거대 그림자 + 군중 + 붉은 안개
// ──────────────────────────────────────────────────────────────────
function ChampionRoadLayers({
  mouse,
  accent,
}: {
  mouse: { x: number; y: number };
  accent: string;
}) {
  return (
    <>
      {/* 번개 layer (가끔 깜빡) */}
      <BackgroundParallax mouse={mouse} depth={0.1}>
        <svg viewBox="0 0 800 600" className="h-full w-full">
          <path
            d="M 200 0 L 220 180 L 200 200 L 240 380"
            stroke="#fff"
            strokeWidth="3"
            fill="none"
            opacity="0"
          >
            <animate
              attributeName="opacity"
              values="0;0;1;0;0"
              dur="6s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M 600 0 L 580 220 L 620 240 L 600 400"
            stroke="#fff"
            strokeWidth="3"
            fill="none"
            opacity="0"
          >
            <animate
              attributeName="opacity"
              values="0;0;0;1;0"
              dur="8s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </BackgroundParallax>

      {/* 거대한 라이벌 silhouette */}
      <BackgroundParallax mouse={mouse} depth={0.3}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
        >
          <path
            d="M 200 600 Q 200 360 280 320 Q 320 280 320 220 Q 320 180 360 180 Q 400 180 400 220 Q 400 280 440 320 Q 520 360 520 600 Z"
            fill="#000"
            opacity="0.85"
          />
          {/* 빨간 눈 */}
          <circle cx="350" cy="230" r="3" fill={accent}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="380" cy="230" r="3" fill={accent}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" begin="0.5s" />
          </circle>
        </svg>
      </BackgroundParallax>

      {/* 군중 실루엣 */}
      <BackgroundParallax mouse={mouse} depth={0.5}>
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
        >
          <g fill="#000" opacity="0.85">
            {Array.from({ length: 38 }).map((_, i) => {
              const x = 20 + i * 21;
              const h = 18 + (i % 5) * 3;
              return (
                <ellipse
                  key={i}
                  cx={x}
                  cy={580}
                  rx={6}
                  ry={h}
                />
              );
            })}
          </g>
        </svg>
      </BackgroundParallax>

      <ParticleField kind="rain" density="high" speed="fast" />
    </>
  );
}

export default WorldMapBackdrop;
