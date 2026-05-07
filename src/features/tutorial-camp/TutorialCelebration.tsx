/**
 * 7일 스타터 캠프 — Day 완료 / Day 7 수여식 축하 (단계 44).
 *
 * step.animation 이 confetti / celebration 일 때 일반 overlay 대신 본 컴포넌트.
 * canvas-confetti 가 이미 의존성에 있어 새 패키지 0.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { COMMON_LABELS, STARTER_TITLE_TEXT } from "./tutorialCampCopy";
import { COLOR_AMBER, prefersReducedMotion } from "./tutorialCampMotion";
import type { TutorialCampStep } from "./tutorialCampSteps";
import OsamMascot from "@/components/mascot/OsamMascot";

export interface TutorialCelebrationProps {
  step: TutorialCampStep;
  onContinue: () => void;
}

const TutorialCelebration = ({ step, onContinue }: TutorialCelebrationProps) => {
  const grand = step.animation === "celebration";
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (grand) {
      // Day 7 수여식 — 3 회 시퀀스
      const fire = (x: number, delay: number) =>
        setTimeout(() => {
          try {
            confetti({
              particleCount: 90,
              spread: 75,
              origin: { x, y: 0.45 },
              colors: ["#fdb85c", "#fde047", "#fb7185", "#fef3c7"],
            });
          } catch {
            // ignore
          }
        }, delay);
      fire(0.2, 200);
      fire(0.8, 600);
      fire(0.5, 1000);
    } else {
      // Day 1~6 작은 confetti
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#fdb85c", "#fde047", "#fef3c7"],
        });
      } catch {
        // ignore
      }
    }
  }, [grand, reduced]);

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      data-tour-overlay="true"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(253,184,92,0.18) 0%, rgba(10,16,36,0.92) 60%)",
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 180 }}
        className="w-full max-w-[340px] rounded-2xl border border-amber-400/40 bg-gradient-to-b from-[#0d1530] to-[#0a1024] px-6 py-7 text-center text-amber-50 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        {/* 큰 오삼이 캐릭터 (승리 표정) — Day 7 은 더 크게 */}
        <div className="mb-2 flex justify-center">
          <OsamMascot size={grand ? "xl" : "lg"} state="victory" />
        </div>
        <p
          className="text-[10px] font-black uppercase tracking-[0.5em]"
          style={{ color: COLOR_AMBER }}
        >
          {grand ? "GRADUATION" : `DAY ${step.day} CLEAR`}
        </p>
        <h2 className="mt-3 text-2xl font-black leading-tight">{step.title}</h2>
        <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-amber-100/85">
          {step.body}
        </p>

        {grand && (
          <div className="mt-4 rounded-xl border-l-2 border-rose-500/60 bg-rose-950/15 px-4 py-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300/80">
              칭호
            </p>
            <p className="mt-0.5 text-[13px] font-black text-rose-100">
              {STARTER_TITLE_TEXT}
            </p>
          </div>
        )}

        <p className="mt-4 text-[11px] italic text-amber-200/70">
          {step.osamiMessage}
        </p>

        <Button
          onClick={onContinue}
          className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
        >
          {grand ? COMMON_LABELS.finishCamp : COMMON_LABELS.finishDay}
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default TutorialCelebration;
