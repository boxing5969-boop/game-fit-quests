/**
 * 153 스토리 RPG — 장애물 SVG creature (단계 41).
 *
 * 8가지 습관/상태를 인라인 SVG 로 표현. 외부 이미지 X.
 * state 별 framer-motion 애니메이션 (idle/hurt/defeated).
 */

import { motion, type Transition } from "framer-motion";

export type CreatureState = "idle" | "hurt" | "defeated";
export type CreatureSize = "sm" | "md" | "lg";

const SIZE_PX: Record<CreatureSize, number> = { sm: 80, md: 140, lg: 200 };

export interface StoryObstacleCreatureProps {
  code: string;
  state?: CreatureState;
  size?: CreatureSize;
}

const idleAnim = {
  scale: [1, 1.02, 1],
};
const idleTransition: Transition = {
  duration: 2.4,
  repeat: Infinity,
  ease: "easeInOut",
};

const hurtAnim = {
  x: [-5, 5, -5, 0],
  filter: [
    "brightness(1)",
    "brightness(1.6) saturate(2)",
    "brightness(1)",
    "brightness(1.6) saturate(2)",
    "brightness(1)",
  ],
};
const hurtTransition: Transition = { duration: 0.4, ease: "easeOut" };

const defeatedAnim = {
  rotate: 360,
  scale: 0.2,
  opacity: 0,
};
const defeatedTransition: Transition = { duration: 0.9, ease: "easeIn" };

function pickAnim(state: CreatureState) {
  if (state === "hurt") return { animate: hurtAnim, transition: hurtTransition };
  if (state === "defeated")
    return { animate: defeatedAnim, transition: defeatedTransition };
  return { animate: idleAnim, transition: idleTransition };
}

// ─────────────────────────── creature SVGs ─────────────────────────────

function LazySlime() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="slime-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="68" rx="34" ry="22" fill="url(#slime-grad)" stroke="#052e16" strokeWidth="2" />
      <ellipse cx="40" cy="62" rx="3" ry="4" fill="#052e16" />
      <ellipse cx="60" cy="62" rx="3" ry="4" fill="#052e16" />
      <path d="M 42 72 Q 50 76 58 72" stroke="#052e16" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 50 80 Q 52 90 50 95" stroke="#86efac" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function GuardBreaker() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id="gb-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
      </defs>
      <rect x="22" y="22" width="56" height="56" rx="6" fill="url(#gb-grad)" stroke="#450a0a" strokeWidth="2" />
      <path d="M 30 40 L 60 50 L 40 65 L 70 75" stroke="#450a0a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="38" cy="44" rx="3" ry="4" fill="#fef2f2" />
      <ellipse cx="62" cy="44" rx="3" ry="4" fill="#fef2f2" />
      <ellipse cx="38" cy="44" rx="1.5" ry="2" fill="#450a0a" />
      <ellipse cx="62" cy="44" rx="1.5" ry="2" fill="#450a0a" />
      <path d="M 36 64 Q 50 56 64 64" stroke="#450a0a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BreathHolder() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M 30 30 Q 30 18 50 18 Q 70 18 70 30 L 70 78 Q 65 70 60 78 Q 55 70 50 78 Q 45 70 40 78 Q 35 70 30 78 Z"
        fill="#f8fafc"
        opacity="0.85"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
      <ellipse cx="42" cy="42" rx="3" ry="4" fill="#0f172a" />
      <ellipse cx="58" cy="42" rx="3" ry="4" fill="#0f172a" />
      <line x1="44" y1="58" x2="56" y2="68" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
      <line x1="56" y1="58" x2="44" y2="68" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function WristBreak() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M 30 50 Q 35 30 50 35 Q 60 38 60 50 L 70 60 L 60 70 Q 50 78 35 70 Q 22 60 30 50 Z"
        fill="#a78bfa"
        stroke="#3b0764"
        strokeWidth="2"
      />
      <line x1="55" y1="42" x2="75" y2="22" stroke="#3b0764" strokeWidth="3" strokeLinecap="round" />
      <line x1="58" y1="46" x2="80" y2="34" stroke="#3b0764" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="44" cy="52" rx="2.5" ry="3" fill="#3b0764" />
      <ellipse cx="54" cy="52" rx="2.5" ry="3" fill="#3b0764" />
    </svg>
  );
}

function QuitDemon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="demon-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>
      <path d="M 30 28 L 36 18 L 42 28 Z" fill="#dc2626" />
      <path d="M 70 28 L 64 18 L 58 28 Z" fill="#dc2626" />
      <ellipse cx="50" cy="58" rx="28" ry="26" fill="url(#demon-grad)" stroke="#7f1d1d" strokeWidth="2" />
      <ellipse cx="42" cy="54" rx="3" ry="4" fill="#fde047" />
      <ellipse cx="58" cy="54" rx="3" ry="4" fill="#fde047" />
      <path d="M 40 70 Q 50 64 60 70" stroke="#fef2f2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <text x="46" y="82" fontSize="12" fill="#fef2f2" fontWeight="bold">ㅠ</text>
    </svg>
  );
}

function ExcuseGoblin() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="goblin-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#166534" />
        </radialGradient>
      </defs>
      <ellipse cx="48" cy="56" rx="22" ry="24" fill="url(#goblin-grad)" stroke="#052e16" strokeWidth="2" />
      <path d="M 32 36 L 40 30 L 38 42 Z" fill="#166534" />
      <path d="M 64 36 L 56 30 L 58 42 Z" fill="#166534" />
      <ellipse cx="42" cy="50" rx="2.5" ry="3.5" fill="#052e16" />
      <ellipse cx="56" cy="50" rx="2.5" ry="3.5" fill="#052e16" />
      <path d="M 40 64 Q 48 70 56 64" stroke="#052e16" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="68" y1="56" x2="86" y2="48" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <circle cx="86" cy="48" r="3" fill="#4ade80" stroke="#052e16" strokeWidth="1.5" />
    </svg>
  );
}

function TenseWolf() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id="wolf-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
      </defs>
      <path d="M 28 30 L 36 18 L 38 32 Z" fill="url(#wolf-grad)" stroke="#111827" strokeWidth="1.5" />
      <path d="M 72 30 L 64 18 L 62 32 Z" fill="url(#wolf-grad)" stroke="#111827" strokeWidth="1.5" />
      <ellipse cx="50" cy="56" rx="26" ry="22" fill="url(#wolf-grad)" stroke="#111827" strokeWidth="2" />
      <ellipse cx="42" cy="52" rx="3" ry="4" fill="#fde047" />
      <ellipse cx="58" cy="52" rx="3" ry="4" fill="#fde047" />
      <ellipse cx="42" cy="52" rx="1.5" ry="2.5" fill="#111827" />
      <ellipse cx="58" cy="52" rx="1.5" ry="2.5" fill="#111827" />
      <path d="M 44 68 L 47 72 L 50 68 L 53 72 L 56 68" stroke="#fef2f2" strokeWidth="1.5" fill="none" />
      <ellipse cx="68" cy="40" rx="2" ry="4" fill="#60a5fa" opacity="0.8" />
    </svg>
  );
}

function CompareMonster() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="cmp-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#581c87" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="56" rx="30" ry="24" fill="url(#cmp-grad)" stroke="#3b0764" strokeWidth="2" />
      <ellipse cx="36" cy="50" rx="3" ry="4" fill="#fef2f2" />
      <ellipse cx="50" cy="46" rx="3" ry="4" fill="#fef2f2" />
      <ellipse cx="64" cy="50" rx="3" ry="4" fill="#fef2f2" />
      <ellipse cx="42" cy="58" rx="2.5" ry="3" fill="#fef2f2" />
      <ellipse cx="58" cy="58" rx="2.5" ry="3" fill="#fef2f2" />
      <ellipse cx="36" cy="50" rx="1.5" ry="2" fill="#3b0764" />
      <ellipse cx="50" cy="46" rx="1.5" ry="2" fill="#3b0764" />
      <ellipse cx="64" cy="50" rx="1.5" ry="2" fill="#3b0764" />
      <ellipse cx="42" cy="58" rx="1.2" ry="1.6" fill="#3b0764" />
      <ellipse cx="58" cy="58" rx="1.2" ry="1.6" fill="#3b0764" />
      <path d="M 42 70 Q 50 66 58 70" stroke="#3b0764" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function OvertrainGolem() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id="golem-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>
      </defs>
      <rect x="24" y="32" width="52" height="50" rx="6" fill="url(#golem-grad)" stroke="#111827" strokeWidth="2" />
      <path d="M 30 50 L 50 60 L 38 70 L 70 78" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 56 38 L 62 46" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="48" rx="3" ry="3" fill="#0f172a" />
      <ellipse cx="60" cy="48" rx="3" ry="3" fill="#0f172a" />
      <line x1="38" y1="46" x2="42" y2="50" stroke="#dc2626" strokeWidth="1.5" />
      <line x1="58" y1="46" x2="62" y2="50" stroke="#dc2626" strokeWidth="1.5" />
      <path d="M 38 68 Q 50 74 62 68" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const CREATURE_MAP: Record<string, () => JSX.Element> = {
  lazy_slime: LazySlime,
  guard_breaker: GuardBreaker,
  breath_holder: BreathHolder,
  wrist_break: WristBreak,
  quit_demon: QuitDemon,
  excuse_goblin: ExcuseGoblin,
  tense_wolf: TenseWolf,
  compare_monster: CompareMonster,
  overtrain_golem: OvertrainGolem,
};

const StoryObstacleCreature = ({
  code,
  state = "idle",
  size = "md",
}: StoryObstacleCreatureProps) => {
  const Creature = CREATURE_MAP[code] ?? LazySlime;
  const px = SIZE_PX[size];
  const { animate, transition } = pickAnim(state);

  return (
    <motion.div
      style={{ width: px, height: px }}
      animate={animate}
      transition={transition}
      className="inline-flex items-center justify-center"
    >
      <Creature />
    </motion.div>
  );
};

export default StoryObstacleCreature;
