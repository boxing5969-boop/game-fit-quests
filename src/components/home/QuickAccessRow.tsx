/**
 * 마이복서153 — 홈 우선순위 카드 아래 퀵 액세스 3칩.
 *
 * 작은 카드 3개로 기능별 진입 + 현재 상태 한 줄 (badge).
 *   · 미션  — 오늘의 미션 진행 상태
 *   · 챌린지 — 참여 중 / 미참여
 *   · 진행도 — 이번 주 XP 막대 (간단)
 *
 * Click → 각 페이지로 navigate.
 */

import { motion } from "framer-motion";
import { Zap, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface QuickAccessRowProps {
  /** 미션 상태: "locked" | "ready" | "in_progress" | "done" */
  missionStatus: "locked" | "ready" | "in_progress" | "done";
  /** 챌린지 참여 중인지 */
  challengeJoined: boolean;
  /** 이번 주 XP 진행률 0~1 */
  weeklyProgress: number;
}

const QuickAccessRow = ({
  missionStatus,
  challengeJoined,
  weeklyProgress,
}: QuickAccessRowProps) => {
  const navigate = useNavigate();

  const missionMeta =
    missionStatus === "done"
      ? { label: "완료", color: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" }
      : missionStatus === "in_progress"
        ? { label: "진행 중", color: "bg-yellow-500/20 text-amber-700 dark:text-yellow-300" }
        : missionStatus === "ready"
          ? { label: "시작 가능", color: "bg-primary/15 text-emerald-700 dark:bg-primary/20 dark:text-primary" }
          : { label: "잠금", color: "bg-muted text-muted-foreground dark:bg-gray-700 dark:text-gray-400" };

  const challengeMeta = challengeJoined
    ? { label: "참여 중", color: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" }
    : { label: "참여하기", color: "bg-yellow-500/20 text-amber-700 dark:text-yellow-300" };

  const weeklyPercent = Math.round(weeklyProgress * 100);

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* 미션 */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate("/missions")}
        className="rounded-2xl border border-border bg-card p-3 text-left shadow-elev-1 active:bg-secondary dark:border-white/10 dark:bg-gray-900/60 dark:shadow-none dark:active:bg-gray-900"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-gray-500">
            미션
          </p>
        </div>
        <p className="mt-1.5 text-sm font-black text-foreground dark:text-white">오늘 도전</p>
        <span
          className={`mt-1.5 inline-block rounded-pill px-1.5 py-0.5 text-[9px] font-black ${missionMeta.color}`}
        >
          {missionMeta.label}
        </span>
      </motion.button>

      {/* 챌린지 */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate("/challenges")}
        className="rounded-2xl border border-border bg-card p-3 text-left shadow-elev-1 active:bg-secondary dark:border-white/10 dark:bg-gray-900/60 dark:shadow-none dark:active:bg-gray-900"
      >
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-gray-500">
            챌린지
          </p>
        </div>
        <p className="mt-1.5 text-sm font-black text-foreground dark:text-white">더 다이어터</p>
        <span
          className={`mt-1.5 inline-block rounded-pill px-1.5 py-0.5 text-[9px] font-black ${challengeMeta.color}`}
        >
          {challengeMeta.label}
        </span>
      </motion.button>

      {/* 진행도 */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate("/halloffame")}
        className="rounded-2xl border border-border bg-card p-3 text-left shadow-elev-1 active:bg-secondary dark:border-white/10 dark:bg-gray-900/60 dark:shadow-none dark:active:bg-gray-900"
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-gray-500">
            진행도
          </p>
        </div>
        <p className="mt-1.5 text-sm font-black text-foreground tabular-nums dark:text-white">
          {weeklyPercent}%
        </p>
        {/* 미니 바 */}
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-gray-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weeklyPercent}%` }}
            transition={{ duration: 0.8 }}
            className="h-full bg-gradient-to-r from-orange-400 to-yellow-400"
          />
        </div>
      </motion.button>
    </div>
  );
};

export default QuickAccessRow;
