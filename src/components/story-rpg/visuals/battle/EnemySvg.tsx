/**
 * 153 스토리 RPG — 11 적 unique SVG (Stage 47B).
 *
 * 모두 inline SVG. 외부 이미지 / 외부 IP 0.
 * 보편적 도상: 슬라임 / 늑대 / 로봇 / 그림자 / 거울 등 자체 IP.
 */

import { motion } from "framer-motion";
import type { EnemyVariant } from "./enemyVariants";

export type EnemyPose = "idle" | "attack" | "hurt" | "defeated";

export interface EnemySvgProps {
  variant: EnemyVariant;
  pose?: EnemyPose;
  isBoss?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_PX: Record<NonNullable<EnemySvgProps["size"]>, number> = {
  sm: 80,
  md: 130,
  lg: 180,
};

const EnemySvg = ({
  variant,
  pose = "idle",
  isBoss = false,
  size = "md",
  className = "",
}: EnemySvgProps) => {
  const base = SIZE_PX[size];
  const px = isBoss ? Math.round(base * 1.5) : base;
  const tint = pose === "hurt";

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px * 1.2 }}
      animate={
        pose === "idle"
          ? { y: [0, -4, 0] }
          : pose === "attack"
            ? { x: [0, -10, 14, 0], y: [0, -4, 0, 0] }
            : pose === "hurt"
              ? { x: [-4, 4, -3, 3, 0] }
              : pose === "defeated"
                ? { y: [0, 30], opacity: [1, 0], filter: ["grayscale(0)", "grayscale(1)"] }
                : { x: 0, y: 0 }
      }
      transition={{
        duration:
          pose === "idle" ? 1.5 : pose === "defeated" ? 0.6 : 0.3,
        repeat: pose === "idle" ? Infinity : 0,
        ease: "easeInOut",
      }}
    >
      <svg viewBox="0 0 200 240" width={px} height={px * 1.2}>
        <EnemyBody variant={variant} pose={pose} isBoss={isBoss} />
        {tint && (
          <rect width="200" height="240" fill="#a40e1a" opacity="0.3" />
        )}
      </svg>
    </motion.div>
  );
};

// ──────────────────────────────────────────────────────────────────
// 11 적 body — variant 별 분기
// ──────────────────────────────────────────────────────────────────
function EnemyBody({
  variant,
  pose,
  isBoss,
}: {
  variant: EnemyVariant;
  pose: EnemyPose;
  isBoss: boolean;
}) {
  switch (variant) {
    case "lazy_slime":
      return <LazySlime />;
    case "guard_breaker":
      return <GuardBreaker pose={pose} />;
    case "tension_wolf":
      return <TensionWolf pose={pose} />;
    case "overtraining_golem":
      return <OvertrainingGolem />;
    case "master_door":
      return <MasterDoor />;
    case "routine_breaker":
      return <RoutineBreaker />;
    case "compare_monster":
      return <CompareMonster />;
    case "shadow_rival":
      return <ShadowRival isBoss={isBoss} />;
    case "camp_guard":
      return <CampGuard pose={pose} />;
    case "crowd_illusion":
      return <CrowdIllusion />;
    case "self_doubt":
      return <SelfDoubt />;
    default:
      return <ShadowRival isBoss={isBoss} />;
  }
}

// ── A. lazy_slime — 회색 슬라임 + 졸린 눈 + 침 ─────────────────
function LazySlime() {
  return (
    <g>
      <ellipse cx="100" cy="190" rx="36" ry="6" fill="#000" opacity="0.35" />
      <path
        d="M 60 180 Q 60 110 100 110 Q 140 110 140 180 Q 140 195 100 195 Q 60 195 60 180 Z"
        fill="#8a9da5"
        stroke="#3a4750"
        strokeWidth="2"
      />
      {/* 졸린 눈 */}
      <path d="M 78 140 L 92 140" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
      <path d="M 108 140 L 122 140" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
      {/* 입 */}
      <ellipse cx="100" cy="160" rx="6" ry="3" fill="#1a1a1a" opacity="0.7" />
      {/* 침 */}
      <motion.ellipse
        cx="106" cy="172" rx="2" ry="4"
        fill="#a8d4e0"
        animate={{ y: [0, 14, 14], opacity: [1, 0.5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
      {/* 광택 */}
      <ellipse cx="78" cy="130" rx="10" ry="6" fill="#fff" opacity="0.25" />
    </g>
  );
}

// ── B. guard_breaker — 검은 hood + 큰 회색 망치 ──────────────
function GuardBreaker({ pose }: { pose: EnemyPose }) {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="36" ry="5" fill="#000" opacity="0.4" />
      {/* hood 인영 */}
      <path d="M 70 200 L 70 110 Q 100 90 130 110 L 130 200 Z" fill="#0a0a0a" />
      <path d="M 60 130 Q 100 80 140 130 L 130 110 Q 100 90 70 110 Z" fill="#0a0a0a" />
      {/* hood 안 빨간 inner glow */}
      <ellipse cx="100" cy="120" rx="12" ry="14" fill="#a40e1a" opacity="0.7" />
      <circle cx="94" cy="120" r="2" fill="#fff" />
      <circle cx="106" cy="120" r="2" fill="#fff" />
      {/* 큰 망치 */}
      <g transform={pose === "attack" ? "rotate(-20 150 130)" : "rotate(0 150 130)"}>
        <rect x="148" y="100" width="6" height="80" fill="#5a5a5a" />
        <rect x="135" y="60" width="38" height="44" rx="3" fill="#7a7a7a" stroke="#3a3a3a" strokeWidth="2" />
        <rect x="138" y="68" width="4" height="28" fill="#3a3a3a" />
        <rect x="166" y="68" width="4" height="28" fill="#3a3a3a" />
      </g>
    </g>
  );
}

// ── C. tension_wolf — 회색 늑대 + 빨간 눈 + 송곳니 ────────────
function TensionWolf({ pose }: { pose: EnemyPose }) {
  return (
    <g>
      <ellipse cx="100" cy="220" rx="40" ry="6" fill="#000" opacity="0.4" />
      {/* 늑대 머리 (상단 뾰족 양귀) */}
      <path
        d="M 60 80 L 78 130 L 50 160 L 80 200 L 120 200 L 150 160 L 122 130 L 140 80 L 120 110 L 100 95 L 80 110 Z"
        fill="#5a6470"
        stroke="#1a1a1a"
        strokeWidth="2"
      />
      {/* 코 */}
      <ellipse cx="100" cy="160" rx="10" ry="6" fill="#1a1a1a" />
      {/* 빨간 눈 */}
      <ellipse cx="82" cy="135" rx="6" ry="4" fill="#a40e1a" />
      <ellipse cx="118" cy="135" rx="6" ry="4" fill="#a40e1a" />
      <motion.circle cx="82" cy="135" r="2" fill="#fff" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
      <motion.circle cx="118" cy="135" r="2" fill="#fff" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
      {/* 송곳니 + 으르렁 입 */}
      <path
        d={pose === "attack"
          ? "M 80 175 L 92 200 L 100 175 L 108 200 L 120 175"
          : "M 84 175 L 90 188 L 100 178 L 110 188 L 116 175"}
        fill="#fff"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
    </g>
  );
}

// ── D. overtraining_golem — 청회색 로봇 + 빨간 눈 슬릿 + 균열 ─
function OvertrainingGolem() {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="46" ry="6" fill="#000" opacity="0.4" />
      {/* 머리 */}
      <rect x="74" y="60" width="52" height="46" fill="#4a5a6a" stroke="#1a1a1a" strokeWidth="2" rx="4" />
      <rect x="80" y="80" width="40" height="6" fill="#a40e1a" />
      <motion.rect
        x="80" y="80" width="40" height="6"
        fill="#fff"
        opacity="0.7"
        animate={{ opacity: [0.3, 0.9, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {/* 몸통 */}
      <rect x="64" y="110" width="72" height="100" fill="#5a6a7a" stroke="#1a1a1a" strokeWidth="2" rx="4" />
      {/* 균열 — 빛남 */}
      <motion.path
        d="M 100 130 L 110 160 L 95 175 L 110 200"
        stroke="#a40e1a"
        strokeWidth="3"
        fill="none"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* 어깨 볼트 */}
      <circle cx="68" cy="120" r="4" fill="#3a3a3a" />
      <circle cx="132" cy="120" r="4" fill="#3a3a3a" />
    </g>
  );
}

// ── E. master_door — 거대 문 + 자물쇠 + 노란 빛 (보스) ────────
function MasterDoor() {
  return (
    <g>
      <ellipse cx="100" cy="232" rx="50" ry="6" fill="#000" opacity="0.4" />
      {/* 문 프레임 */}
      <rect x="50" y="40" width="100" height="180" fill="#3a2a1a" stroke="#1a0a0a" strokeWidth="3" />
      {/* 문 패널 */}
      <rect x="58" y="50" width="40" height="80" fill="#5a3a1a" stroke="#1a0a0a" strokeWidth="2" />
      <rect x="102" y="50" width="40" height="80" fill="#5a3a1a" stroke="#1a0a0a" strokeWidth="2" />
      <rect x="58" y="135" width="40" height="80" fill="#5a3a1a" stroke="#1a0a0a" strokeWidth="2" />
      <rect x="102" y="135" width="40" height="80" fill="#5a3a1a" stroke="#1a0a0a" strokeWidth="2" />
      {/* 자물쇠 */}
      <rect x="84" y="100" width="32" height="40" fill="#4a4a4a" stroke="#1a1a1a" strokeWidth="2" rx="3" />
      <path d="M 90 100 L 90 90 Q 90 78 100 78 Q 110 78 110 90 L 110 100" fill="none" stroke="#4a4a4a" strokeWidth="4" />
      {/* 자물쇠 안 노란 빛 */}
      <motion.circle
        cx="100" cy="120" r="6"
        fill="#fdb85c"
        animate={{ opacity: [0.5, 1, 0.5], r: [5, 8, 5] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
    </g>
  );
}

// ── F. routine_breaker — 깨진 시계 + 톱니 ─────────────────────
function RoutineBreaker() {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="40" ry="6" fill="#000" opacity="0.4" />
      {/* 시계 머리 */}
      <circle cx="100" cy="100" r="50" fill="#d4c8a0" stroke="#5a4a2a" strokeWidth="3" />
      {/* 깨진 균열 */}
      <path d="M 100 50 L 110 90 L 90 100 L 105 130" stroke="#1a1a1a" strokeWidth="3" fill="none" />
      <path d="M 50 100 L 80 110 L 70 95" stroke="#1a1a1a" strokeWidth="2" fill="none" />
      {/* 시침/분침 */}
      <motion.line
        x1="100" y1="100" x2="100" y2="65"
        stroke="#1a1a1a"
        strokeWidth="3"
        strokeLinecap="round"
        animate={{ rotate: [-15, 15, -15] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "100px 100px" }}
      />
      <line x1="100" y1="100" x2="125" y2="100" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="100" r="4" fill="#1a1a1a" />
      {/* 톱니 어깨 (양쪽) */}
      <g transform="translate(50 170)">
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "0 0" }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return <rect key={i} x={Math.cos(a) * 18 - 3} y={Math.sin(a) * 18 - 3} width="6" height="6" fill="#5a5a5a" />;
          })}
          <circle cx="0" cy="0" r="14" fill="#7a7a7a" />
        </motion.g>
      </g>
      <g transform="translate(150 170)">
        <motion.g animate={{ rotate: -360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "0 0" }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return <rect key={i} x={Math.cos(a) * 18 - 3} y={Math.sin(a) * 18 - 3} width="6" height="6" fill="#5a5a5a" />;
          })}
          <circle cx="0" cy="0" r="14" fill="#7a7a7a" />
        </motion.g>
      </g>
    </g>
  );
}

// ── G. compare_monster — 거울 + 흐릿한 사람 모양 ──────────────
function CompareMonster() {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="44" ry="6" fill="#000" opacity="0.4" />
      {/* 거울 프레임 */}
      <rect x="50" y="40" width="100" height="170" rx="50" fill="#fdb85c" stroke="#7a4a1a" strokeWidth="3" />
      {/* 거울 표면 */}
      <rect x="58" y="48" width="84" height="154" rx="42" fill="#1a2a4a" />
      {/* 흐릿한 사람 모양 (모핑) */}
      <motion.g
        animate={{ scaleX: [1, 1.1, 0.9, 1], scaleY: [1, 0.95, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{ transformOrigin: "100px 130px" }}
      >
        <ellipse cx="100" cy="100" rx="14" ry="16" fill="#8a9da5" opacity="0.7" />
        <path d="M 80 130 Q 100 120 120 130 L 122 180 L 78 180 Z" fill="#8a9da5" opacity="0.7" />
      </motion.g>
      {/* 광택 */}
      <path d="M 70 60 Q 90 50 110 60" stroke="#fff" strokeWidth="2" fill="none" opacity="0.5" />
    </g>
  );
}

// ── H. shadow_rival — 검은 실루엣 + 빨간 눈 (보스급) ──────────
function ShadowRival({ isBoss }: { isBoss: boolean }) {
  return (
    <g>
      <ellipse cx="100" cy="232" rx="42" ry="6" fill="#000" opacity="0.5" />
      {/* 실루엣 */}
      <path
        d="M 70 220 L 70 110 Q 75 90 100 90 Q 125 90 130 110 L 130 220 Z"
        fill="#0a0a0a"
      />
      <ellipse cx="100" cy="80" rx="22" ry="26" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="1" />
      {/* 빨간 눈 */}
      <motion.ellipse cx="92" cy="80" rx="3" ry="4" fill="#a40e1a" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity }} />
      <motion.ellipse cx="108" cy="80" rx="3" ry="4" fill="#a40e1a" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }} />
      {/* 글러브 */}
      <ellipse cx="68" cy="140" rx="13" ry="15" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="1" />
      <ellipse cx="132" cy="140" rx="13" ry="15" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="1" />
      {isBoss && (
        <motion.circle
          cx="100" cy="160" r="40"
          fill="none"
          stroke="#a40e1a"
          strokeWidth="2"
          opacity="0.4"
          animate={{ r: [38, 50, 38], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      )}
    </g>
  );
}

// ── I. camp_guard — 모닥불 옆 거구 가드 ──────────────────────
function CampGuard({ pose }: { pose: EnemyPose }) {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="44" ry="6" fill="#000" opacity="0.4" />
      {/* 모닥불 */}
      <ellipse cx="40" cy="215" rx="18" ry="4" fill="#1a1a1a" />
      <motion.path
        d="M 30 215 Q 40 195 50 215 Q 45 200 40 175 Q 35 200 30 215 Z"
        fill="#f5832b"
        animate={{ opacity: [0.7, 1, 0.7], scaleY: [1, 1.15, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        style={{ transformOrigin: "40px 215px" }}
      />
      {/* 거구 */}
      <path d="M 75 220 L 75 110 Q 100 95 125 110 L 125 220 Z" fill="#3a2a2a" />
      <ellipse cx="100" cy="80" rx="20" ry="24" fill="#a8745a" stroke="#1a1a1a" strokeWidth="2" />
      <line x1="86" y1="78" x2="96" y2="78" stroke="#1a1a1a" strokeWidth="3" />
      <line x1="104" y1="78" x2="114" y2="78" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M 88 95 L 112 95" stroke="#1a1a1a" strokeWidth="2" />
      {/* 양 글러브 */}
      <ellipse cx={pose === "attack" ? "60" : "68"} cy="140" rx="14" ry="16" fill="#5a3a3a" stroke="#1a1a1a" strokeWidth="1.5" />
      <ellipse cx={pose === "attack" ? "140" : "132"} cy="140" rx="14" ry="16" fill="#5a3a3a" stroke="#1a1a1a" strokeWidth="1.5" />
    </g>
  );
}

// ── J. crowd_illusion — 5-7 작은 얼굴 비웃기 ─────────────────
function CrowdIllusion() {
  const FACES = [
    { x: 50, y: 100, r: 18 },
    { x: 100, y: 80, r: 22 },
    { x: 150, y: 100, r: 18 },
    { x: 70, y: 160, r: 16 },
    { x: 130, y: 160, r: 16 },
    { x: 100, y: 200, r: 14 },
  ];
  return (
    <g>
      {FACES.map((f, i) => (
        <motion.g
          key={i}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.15 }}
        >
          <circle cx={f.x} cy={f.y} r={f.r} fill="#3a3a4a" stroke="#0a0a0a" strokeWidth="1.5" />
          {/* 비웃는 눈 */}
          <path d={`M ${f.x - 6} ${f.y - 2} L ${f.x - 2} ${f.y - 5}`} stroke="#fff" strokeWidth="1.5" />
          <path d={`M ${f.x + 6} ${f.y - 2} L ${f.x + 2} ${f.y - 5}`} stroke="#fff" strokeWidth="1.5" />
          {/* 비웃는 입 */}
          <path d={`M ${f.x - 5} ${f.y + 5} Q ${f.x} ${f.y + 8} ${f.x + 5} ${f.y + 3}`} stroke="#a40e1a" strokeWidth="1.5" fill="none" />
        </motion.g>
      ))}
    </g>
  );
}

// ── K. self_doubt — 안개 + 흐릿한 자기 모습 ──────────────────
function SelfDoubt() {
  return (
    <g>
      <ellipse cx="100" cy="225" rx="44" ry="6" fill="#000" opacity="0.4" />
      {/* 안개 */}
      <motion.ellipse
        cx="100" cy="170" rx="60" ry="50"
        fill="#fff"
        opacity="0.18"
        animate={{ rx: [60, 68, 60], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      {/* 흐릿한 자기 모습 (회색조 PlayerBoxer 단순화) */}
      <g opacity="0.55">
        <ellipse cx="100" cy="80" rx="20" ry="24" fill="#a0a0a0" />
        <rect x="78" y="75" width="44" height="5" fill="#7a7a7a" />
        <path d="M 75 180 L 78 110 Q 100 100 122 110 L 125 180 Z" fill="#7a7a7a" />
        <ellipse cx="78" cy="135" rx="11" ry="13" fill="#5a5a5a" />
        <ellipse cx="122" cy="135" rx="11" ry="13" fill="#5a5a5a" />
        {/* 얼굴 — 무표정 */}
        <ellipse cx="92" cy="83" rx="2" ry="2" fill="#1a1a1a" opacity="0.6" />
        <ellipse cx="108" cy="83" rx="2" ry="2" fill="#1a1a1a" opacity="0.6" />
      </g>
      {/* 물음표 */}
      <motion.text
        x="135" y="65"
        fontSize="22"
        fontWeight="bold"
        fill="#a8a0c0"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >?</motion.text>
    </g>
  );
}

export default EnemySvg;
