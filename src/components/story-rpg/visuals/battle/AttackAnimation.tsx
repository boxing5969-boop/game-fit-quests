/**
 * 153 스토리 RPG — 5 공격 애니메이션 (Stage 47B).
 *
 * jab 슬라이드 / guard arc / footwork dust / counter slow-mo / osam_advice popup.
 * BattleArena 위에 absolute overlay 로 렌더.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CharacterPortrait from "../portraits/CharacterPortrait";

export type AttackCommand =
  | "jab"
  | "guard"
  | "footwork"
  | "counter"
  | "osam_advice";

export interface AttackAnimationProps {
  /** 현재 진행 중인 공격 (null 이면 대기). */
  command: AttackCommand | null;
  /** 플레이어 → 적 좌표 (BattleArena 기준 px). */
  playerXY: { x: number; y: number };
  enemyXY: { x: number; y: number };
  /** 오삼이 조언 텍스트 (osam_advice 일 때). */
  osamLine?: string;
  onComplete: () => void;
}

const DURATION_MS: Record<AttackCommand, number> = {
  jab: 600,
  guard: 700,
  footwork: 600,
  counter: 900,
  osam_advice: 1400,
};

const AttackAnimation = ({
  command,
  playerXY,
  enemyXY,
  osamLine,
  onComplete,
}: AttackAnimationProps) => {
  useEffect(() => {
    if (!command) return;
    const t = setTimeout(onComplete, DURATION_MS[command]);
    return () => clearTimeout(t);
  }, [command, onComplete]);

  return (
    <AnimatePresence>
      {command && (
        <motion.div
          key={command}
          className="pointer-events-none absolute inset-0 z-30"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {command === "jab" && (
            <JabStreak playerXY={playerXY} enemyXY={enemyXY} />
          )}
          {command === "guard" && <GuardArc playerXY={playerXY} />}
          {command === "footwork" && <FootworkDust playerXY={playerXY} />}
          {command === "counter" && (
            <CounterSlowMo playerXY={playerXY} enemyXY={enemyXY} />
          )}
          {command === "osam_advice" && <OsamAdvicePopup line={osamLine} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── A. jab — 글러브 → 적 흰 streak ────────────────────────────
function JabStreak({
  playerXY,
  enemyXY,
}: {
  playerXY: { x: number; y: number };
  enemyXY: { x: number; y: number };
}) {
  const dx = enemyXY.x - playerXY.x;
  const dy = enemyXY.y - playerXY.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.sqrt(dx * dx + dy * dy);
  return (
    <motion.div
      className="absolute h-0.5 origin-left"
      style={{
        left: playerXY.x,
        top: playerXY.y,
        width: length,
        transform: `rotate(${angle}deg)`,
        background: "linear-gradient(90deg, transparent 0%, #fff 50%, transparent 100%)",
        boxShadow: "0 0 6px #fff",
      }}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: [0, 1, 0] }}
      transition={{ duration: 0.25 }}
    />
  );
}

// ── B. guard — 플레이어 앞 amber arc ──────────────────────────
function GuardArc({ playerXY }: { playerXY: { x: number; y: number } }) {
  return (
    <motion.svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      className="absolute"
      style={{ left: playerXY.x - 10, top: playerXY.y - 40 }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 0.9, 0.7, 0], scale: [0.6, 1, 1.1, 1.2] }}
      transition={{ duration: 0.6 }}
    >
      <path
        d="M 10 65 Q 40 5 70 65"
        stroke="#fdb85c"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 18 60 Q 40 18 62 60"
        stroke="#fef3c7"
        strokeWidth="2"
        fill="none"
        opacity="0.7"
      />
    </motion.svg>
  );
}

// ── C. footwork — 발 아래 dust 4-5 점 ─────────────────────────
function FootworkDust({ playerXY }: { playerXY: { x: number; y: number } }) {
  return (
    <div className="absolute" style={{ left: playerXY.x - 30, top: playerXY.y + 20 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-zinc-300"
          style={{ left: i * 14 }}
          initial={{ y: 0, opacity: 0.9, scale: 0.6 }}
          animate={{ y: -22 - i * 2, opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.5, delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}

// ── D. counter — 화면 slow-mo + 빨간 깜빡 ─────────────────────
function CounterSlowMo({
  playerXY,
  enemyXY,
}: {
  playerXY: { x: number; y: number };
  enemyXY: { x: number; y: number };
}) {
  const dx = enemyXY.x - playerXY.x;
  const dy = enemyXY.y - playerXY.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.sqrt(dx * dx + dy * dy);
  return (
    <>
      {/* slow-mo overlay */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.45, 0.45, 0] }}
        transition={{ duration: 0.8 }}
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {/* 큰 빨간 streak */}
      <motion.div
        className="absolute h-1 origin-left"
        style={{
          left: playerXY.x,
          top: playerXY.y - 10,
          width: length + 20,
          transform: `rotate(${angle}deg)`,
          background: "linear-gradient(90deg, transparent 0%, #e41e28 50%, transparent 100%)",
          boxShadow: "0 0 12px #e41e28",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.55, delay: 0.2 }}
      />
      {/* "COUNTER!" 텍스트 */}
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.2, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black text-rose-400 drop-shadow-[0_0_12px_rgba(228,30,40,0.8)]"
      >
        COUNTER!
      </motion.p>
    </>
  );
}

// ── E. osam_advice — 우측 상단 오삼이 popup + 말풍선 ──────────
function OsamAdvicePopup({ line }: { line?: string }) {
  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute right-3 top-3 flex items-start gap-2"
    >
      <CharacterPortrait portraitKey="osam" emotion="happy" talking size="sm" />
      <div className="max-w-[180px] rounded-2xl border border-amber-400/60 bg-gray-950/95 p-2 shadow-lg">
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">
          오삼이
        </p>
        <p className="mt-1 text-[11px] leading-tight text-amber-100">
          {line ?? "이렇게 해보세요!"}
        </p>
      </div>
    </motion.div>
  );
}

export default AttackAnimation;
