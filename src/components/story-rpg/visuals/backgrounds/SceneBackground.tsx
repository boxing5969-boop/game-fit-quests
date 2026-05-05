/**
 * 153 스토리 RPG — 씬 배경 일러스트 (Stage 47A).
 *
 * 10 테마 × 4 mood. 모두 inline SVG. 외부 IP 0.
 */

import ParticleField, { type ParticleKind } from "../effects/ParticleField";

export type SceneBackgroundTheme =
  | "gym_entrance"
  | "gym_mirror"
  | "gym_ring"
  | "gym_sandbag"
  | "gym_rope"
  | "gym_corner"
  | "gym_hall"
  | "master_room"
  | "rival_arena"
  | "champion_camp";

export type SceneMood = "calm" | "tense" | "sad" | "triumphant";

export interface SceneBackgroundProps {
  theme: SceneBackgroundTheme;
  mood?: SceneMood;
  className?: string;
}

const MOOD_TINT: Record<SceneMood, string> = {
  calm: "rgba(253, 184, 92, 0.06)",
  tense: "rgba(8, 24, 48, 0.18)",
  sad: "rgba(120, 120, 130, 0.12)",
  triumphant: "rgba(253, 184, 92, 0.18)",
};

const MOOD_PARTICLE: Record<
  SceneMood,
  { kind: ParticleKind; density: "low" | "medium"; speed: "slow" | "normal" }
> = {
  calm: { kind: "dust", density: "low", speed: "slow" },
  tense: { kind: "dust", density: "medium", speed: "normal" },
  sad: { kind: "rain", density: "low", speed: "slow" },
  triumphant: { kind: "firefly", density: "medium", speed: "normal" },
};

const SceneBackground = ({
  theme,
  mood = "calm",
  className = "",
}: SceneBackgroundProps) => {
  const tint = MOOD_TINT[mood];
  const particle = MOOD_PARTICLE[mood];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-3xl ${className}`}
    >
      <svg
        viewBox="0 0 1280 720"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        {renderTheme(theme)}
      </svg>
      <div className="absolute inset-0" style={{ background: tint }} />
      <ParticleField kind={particle.kind} density={particle.density} speed={particle.speed} />
    </div>
  );
};

function renderTheme(theme: SceneBackgroundTheme) {
  switch (theme) {
    case "gym_entrance":
      return (
        <g>
          <defs>
            <linearGradient id="bg-gym-entrance" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1a1f4d" />
              <stop offset="100%" stopColor="#0b0e2e" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-gym-entrance)" />
          {/* 양문 */}
          <rect x="500" y="260" width="280" height="380" fill="#1a1a2e" stroke="#fdb85c" strokeWidth="3" />
          <line x1="640" y1="260" x2="640" y2="640" stroke="#fdb85c" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="610" cy="450" r="6" fill="#fdb85c" />
          <circle cx="670" cy="450" r="6" fill="#fdb85c" />
          {/* 신발장 */}
          <rect x="100" y="500" width="320" height="160" fill="#0f1224" stroke="#3a3f5d" strokeWidth="2" />
          <g stroke="#3a3f5d" strokeWidth="1">
            <line x1="180" y1="500" x2="180" y2="660" />
            <line x1="260" y1="500" x2="260" y2="660" />
            <line x1="340" y1="500" x2="340" y2="660" />
            <line x1="100" y1="580" x2="420" y2="580" />
          </g>
          {/* 벽시계 */}
          <circle cx="900" cy="180" r="40" fill="#0f1224" stroke="#fdb85c" strokeWidth="3" />
          <line x1="900" y1="180" x2="900" y2="150" stroke="#fdb85c" strokeWidth="3" />
          <line x1="900" y1="180" x2="920" y2="180" stroke="#fdb85c" strokeWidth="2" />
          {/* 천장 빛 */}
          <ellipse cx="640" cy="0" rx="380" ry="80" fill="#fdb85c" opacity="0.08" />
        </g>
      );

    case "gym_mirror":
      return (
        <g>
          <defs>
            <linearGradient id="bg-mirror" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#241b3a" />
              <stop offset="100%" stopColor="#0b0e2e" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-mirror)" />
          {/* 거울 */}
          <rect x="280" y="120" width="720" height="500" rx="24" fill="#1a2540" stroke="#fdb85c" strokeWidth="4" />
          <rect x="300" y="140" width="680" height="460" rx="20" fill="#0d1228" opacity="0.85" />
          {/* 흐릿한 반사 */}
          <ellipse cx="640" cy="380" rx="160" ry="200" fill="#fdb85c" opacity="0.04" />
          {/* 도구 */}
          <line x1="100" y1="640" x2="200" y2="540" stroke="#3a3f5d" strokeWidth="3" />
          <ellipse cx="200" cy="540" rx="20" ry="6" fill="#3a3f5d" />
        </g>
      );

    case "gym_ring":
      return (
        <g>
          <defs>
            <radialGradient id="bg-ring" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#fdb85c" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0b0e2e" />
            </radialGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-ring)" />
          {/* 링 캔버스 */}
          <ellipse cx="640" cy="600" rx="540" ry="60" fill="#1a1a2e" />
          <ellipse cx="640" cy="590" rx="500" ry="40" fill="#241a1a" />
          {/* 코너 기둥 */}
          <rect x="120" y="320" width="14" height="320" fill="#fdb85c" />
          <rect x="1146" y="320" width="14" height="320" fill="#fdb85c" />
          <rect x="320" y="360" width="10" height="280" fill="#fdb85c" opacity="0.5" />
          <rect x="950" y="360" width="10" height="280" fill="#fdb85c" opacity="0.5" />
          {/* 줄 */}
          <line x1="120" y1="380" x2="1160" y2="380" stroke="#fdb85c" strokeWidth="3" opacity="0.6" />
          <line x1="120" y1="440" x2="1160" y2="440" stroke="#fdb85c" strokeWidth="3" opacity="0.6" />
          <line x1="120" y1="500" x2="1160" y2="500" stroke="#fdb85c" strokeWidth="3" opacity="0.6" />
          {/* 투광등 */}
          <ellipse cx="640" cy="80" rx="200" ry="40" fill="#fdb85c" opacity="0.18" />
        </g>
      );

    case "gym_sandbag":
      return (
        <g>
          <rect width="1280" height="720" fill="#0f1424" />
          <rect x="0" y="0" width="1280" height="80" fill="#1a1f33" />
          {[300, 640, 980].map((x, i) => (
            <g key={i}>
              <line x1={x} y1="80" x2={x} y2="220" stroke="#3a3f5d" strokeWidth="3" />
              <rect x={x - 50} y="220" width="100" height="240" rx="20" fill="#1a1a1a" stroke="#3a3f5d" strokeWidth="2" />
              <ellipse cx={x} cy="500" rx="56" ry="12" fill="#000" opacity="0.5" />
            </g>
          ))}
          <rect x="0" y="640" width="1280" height="80" fill="#0a0d18" />
        </g>
      );

    case "gym_rope":
      return (
        <g>
          <rect width="1280" height="720" fill="#16203a" />
          <rect x="0" y="0" width="1280" height="120" fill="#0b0e2e" />
          <line x1="200" y1="120" x2="1080" y2="120" stroke="#fdb85c" strokeWidth="3" />
          {[260, 400, 540, 680, 820, 960].map((x, i) => (
            <g key={i}>
              <line x1={x} y1="120" x2={x} y2="160" stroke="#3a3f5d" strokeWidth="2" />
              <ellipse cx={x} cy="160" rx="14" ry="8" fill="#3a3f5d" />
            </g>
          ))}
          <rect x="100" y="540" width="1080" height="180" fill="#1a1f33" />
        </g>
      );

    case "gym_corner":
      return (
        <g>
          <rect width="1280" height="720" fill="#1a1428" />
          <rect x="80" y="500" width="200" height="120" rx="6" fill="#3a3f5d" />
          <rect x="100" y="480" width="160" height="40" fill="#5a3f1f" />
          <ellipse cx="180" cy="540" rx="40" ry="6" fill="#000" opacity="0.6" />
          {/* 수건 */}
          <path d="M 480 520 L 480 640 L 600 640 L 600 520 L 540 540 Z" fill="#fdb85c" opacity="0.7" />
          {/* 물병 */}
          <rect x="800" y="500" width="40" height="120" rx="8" fill="#1a4d3a" stroke="#fdb85c" strokeWidth="2" />
        </g>
      );

    case "gym_hall":
      return (
        <g>
          <rect width="1280" height="720" fill="#0f1424" />
          {/* 벤치 */}
          <rect x="100" y="540" width="400" height="80" fill="#3a2a1a" />
          <rect x="120" y="620" width="20" height="80" fill="#1a1a1a" />
          <rect x="460" y="620" width="20" height="80" fill="#1a1a1a" />
          {/* 게시판 */}
          <rect x="780" y="200" width="320" height="240" fill="#3a2a1a" stroke="#fdb85c" strokeWidth="3" />
          <rect x="800" y="220" width="80" height="60" fill="#fdb85c" opacity="0.4" />
          <rect x="900" y="220" width="80" height="60" fill="#a40e1a" opacity="0.4" />
          <rect x="800" y="300" width="180" height="40" fill="#1a1f33" />
          {/* 짐백 */}
          <ellipse cx="600" cy="640" rx="80" ry="20" fill="#1a1a1a" />
          <path d="M 540 640 Q 540 580 600 580 Q 660 580 660 640 Z" fill="#3a2a1a" />
        </g>
      );

    case "master_room":
      return (
        <g>
          <defs>
            <radialGradient id="bg-master" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#fdb85c" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-master)" />
          <rect width="1280" height="720" fill="#080510" opacity="0.5" />
          {/* 한 줄기 빛 */}
          <path d="M 580 0 L 700 0 L 800 720 L 480 720 Z" fill="#fdb85c" opacity="0.1" />
          {/* 책상 */}
          <rect x="440" y="540" width="400" height="20" fill="#3a2a1a" />
          <rect x="460" y="560" width="20" height="160" fill="#3a2a1a" />
          <rect x="800" y="560" width="20" height="160" fill="#3a2a1a" />
          {/* 마스터 글러브 (장식) */}
          <ellipse cx="640" cy="510" rx="40" ry="32" fill="#a40e1a" stroke="#fdb85c" strokeWidth="3" />
        </g>
      );

    case "rival_arena":
      return (
        <g>
          <defs>
            <radialGradient id="bg-rival" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#a40e1a" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-rival)" />
          {/* 큰 링 */}
          <ellipse cx="640" cy="540" rx="540" ry="80" fill="#1a0a0a" />
          <ellipse cx="640" cy="530" rx="500" ry="60" fill="#241010" />
          {/* 군중 */}
          <g fill="#000" opacity="0.85">
            {Array.from({ length: 60 }).map((_, i) => (
              <ellipse key={i} cx={20 + i * 21} cy={680} rx={8} ry={20 + (i % 4) * 4} />
            ))}
          </g>
          {/* 플래시 */}
          <circle cx="200" cy="120" r="3" fill="#fff">
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="1080" cy="180" r="3" fill="#fff">
            <animate attributeName="opacity" values="0;1;0" dur="2.5s" repeatCount="indefinite" begin="0.5s" />
          </circle>
        </g>
      );

    case "champion_camp":
      return (
        <g>
          <defs>
            <linearGradient id="bg-camp" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0b0e2e" />
              <stop offset="50%" stopColor="#1a1428" />
              <stop offset="100%" stopColor="#241828" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#bg-camp)" />
          {/* 산 */}
          <path d="M 0 460 L 200 240 L 380 360 L 540 280 L 720 380 L 900 260 L 1100 360 L 1280 320 L 1280 720 L 0 720 Z" fill="#000" opacity="0.7" />
          {/* 텐트 */}
          <path d="M 540 600 L 640 460 L 740 600 Z" fill="#3a2a1a" stroke="#fdb85c" strokeWidth="3" />
          <line x1="640" y1="460" x2="640" y2="600" stroke="#fdb85c" strokeWidth="2" />
          {/* 모닥불 */}
          <ellipse cx="900" cy="640" rx="40" ry="10" fill="#1a1a1a" />
          <path d="M 880 640 L 900 580 L 920 640 Z" fill="#fdb85c">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="0.8s" repeatCount="indefinite" />
          </path>
          <path d="M 890 640 L 900 600 L 910 640 Z" fill="#a40e1a" opacity="0.8" />
        </g>
      );

    default:
      return null;
  }
}

export default SceneBackground;
