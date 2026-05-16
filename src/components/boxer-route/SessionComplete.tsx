/**
 * 복싱인 루트 — 라운드 완료 화면.
 *
 * 톤: 회복 / 꾸준함 / 자기 존중.
 * 게임 표현 (전투 승리 / 보상 / 레벨업) 일절 사용 금지.
 */

import { motion } from "framer-motion";
import type { VisualizationRoutine } from "@/data/boxerRouteContent";

export interface SessionCompleteProps {
  routine: VisualizationRoutine;
  streak: number;
  totalRounds: number;
  onClose: () => void;
  onAnotherRound: () => void;
}

const SessionComplete = ({
  routine,
  streak,
  totalRounds,
  onClose,
  onAnotherRound,
}: SessionCompleteProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-gray-950/85 via-gray-900/80 to-gray-950/85 p-6 text-center shadow-lg"
    >
      <motion.p
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/70"
      >
        ROUND COMPLETED
      </motion.p>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-black leading-snug text-foreground"
      >
        {routine.closing_line}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-auto max-w-[300px] whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground"
      >
        {routine.takeaway}
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex justify-center gap-6 pt-2"
      >
        <Stat label="이번 라운드" value={routine.title} compact />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex justify-center gap-4 border-t border-white/5 pt-4"
      >
        <Stat label="이번 주 연속" value={`${streak}일`} />
        <Stat label="누적 라운드" value={`${totalRounds}회`} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="flex flex-col gap-2 pt-2"
      >
        <button
          type="button"
          onClick={onAnotherRound}
          className="rounded-pill border border-amber-500/40 bg-amber-500/10 px-6 py-2.5 text-[12px] font-bold text-amber-100 active:scale-[0.98]"
        >
          다른 라운드 골라 보기
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-pill border border-white/10 bg-gray-900/50 px-6 py-2 text-[11px] text-muted-foreground active:scale-[0.98]"
        >
          오늘은 여기까지
        </button>
      </motion.div>
    </motion.div>
  );
};

function Stat({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={
          compact
            ? "mt-0.5 text-[12px] font-bold text-foreground"
            : "mt-0.5 text-base font-black tabular-nums text-amber-200"
        }
      >
        {value}
      </span>
    </div>
  );
}

export default SessionComplete;
