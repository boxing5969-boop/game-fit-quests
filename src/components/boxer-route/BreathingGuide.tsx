/**
 * 복싱인 루트 — 호흡 가이드.
 *
 * 들숨 / 멈춤 / 날숨 / 멈춤 4 phase 를 반복 사이클.
 * 부드러운 원이 커지고 작아지면서 호흡 페이스를 안내.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export interface BreathingGuideProps {
  /** [in, hold1, out, hold2] 초 */
  pattern: [number, number, number, number];
  label?: string;
  /** 일시 정지 */
  paused?: boolean;
}

type Phase = "in" | "hold1" | "out" | "hold2";

const PHASE_LABEL: Record<Phase, string> = {
  in: "들이쉬기",
  hold1: "멈춤",
  out: "내쉬기",
  hold2: "멈춤",
};

const BreathingGuide = ({ pattern, label, paused }: BreathingGuideProps) => {
  const [phase, setPhase] = useState<Phase>("in");
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    const [pIn, pHold1, pOut, pHold2] = pattern;
    const durations: Record<Phase, number> = {
      in: pIn * 1000,
      hold1: pHold1 * 1000,
      out: pOut * 1000,
      hold2: pHold2 * 1000,
    };
    const order: Phase[] = ["in", "hold1", "out", "hold2"];
    const id = setTimeout(() => {
      const idx = order.indexOf(phase);
      const nextPhase = order[(idx + 1) % order.length];
      // 0초 페이즈는 건너뜀
      if (durations[nextPhase] === 0) {
        const idx2 = order.indexOf(nextPhase);
        setPhase(order[(idx2 + 1) % order.length]);
      } else {
        setPhase(nextPhase);
      }
      setPhaseStartedAt(Date.now());
    }, durations[phase]);
    return () => clearTimeout(id);
  }, [phase, pattern, paused, phaseStartedAt]);

  const [pIn, , pOut] = pattern;
  const scale =
    phase === "in" ? 1.0 : phase === "out" ? 0.55 : phase === "hold1" ? 1.0 : 0.55;
  const duration =
    phase === "in" ? pIn : phase === "out" ? pOut : 0.4;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-amber-400/40 bg-amber-500/10"
          animate={{ scale }}
          transition={{ duration, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full bg-amber-400/15"
          animate={{ scale }}
          transition={{ duration, ease: "easeInOut" }}
        />
        <span className="relative z-10 text-[11px] font-bold uppercase tracking-widest text-amber-200">
          {PHASE_LABEL[phase]}
        </span>
      </div>
      {label && (
        <p className="text-center text-[11px] text-muted-foreground">{label}</p>
      )}
    </div>
  );
};

export default BreathingGuide;
