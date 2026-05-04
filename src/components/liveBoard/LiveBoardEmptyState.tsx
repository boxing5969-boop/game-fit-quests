/**
 * 153 — 라이브보드 빈 상태 (오늘 활동 0명) 시그니처 화면.
 *
 * 체육관 모니터에 항상 떠있는 화면이라 빈 상태도 멋있어야 한다.
 *
 * 요소:
 *   · 마이복서153 로고 + 잔잔한 호흡
 *   · "오늘 첫 라운드를 누가 시작할까요?" 타이포
 *   · 누적 통계 (오늘 방문 수 / 명예의 전당 수)
 *   · 별 / 입자 잔잔한 떠다님 (배경)
 *   · 시그니처 색감: 153 브랜드 톤
 */

import { motion } from "framer-motion";

export interface LiveBoardEmptyStateProps {
  branchName: string;
  todayVisitCount: number;
  hallOfFameCount: number;
}

const LiveBoardEmptyState = ({
  branchName,
  todayVisitCount,
  hallOfFameCount,
}: LiveBoardEmptyStateProps) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* 배경 — 떠다니는 별/입자 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute select-none"
            style={{
              left: `${(i * 47) % 100}%`,
              top: `${(i * 31) % 100}%`,
              fontSize: `${10 + (i % 4) * 4}px`,
              color:
                i % 3 === 0 ? "#F6C453" : i % 3 === 1 ? "#FFFFFF" : "#E8553A",
              opacity: 0.15,
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.1, 0.35, 0.1],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          >
            {i % 4 === 0 ? "✨" : i % 4 === 1 ? "⭐" : i % 4 === 2 ? "🥊" : "·"}
          </motion.span>
        ))}
      </div>

      {/* 중앙 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        {/* 153 시그니처 로고 + 글러브 (회원이 설정한 캐릭터가 아닌 일반 sprite 표시 안 함) */}
        <motion.div
          animate={{
            y: [0, -8, 0],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="flex flex-col items-center gap-3"
        >
          <div className="text-7xl">🥊</div>
          <p className="text-2xl font-black tracking-wider text-yellow-300">
            마이복서153
          </p>
          <p className="text-xs font-bold tracking-[0.3em] text-yellow-400">
            MY BOXER 153
          </p>
          <p className="text-sm text-gray-400">{branchName} · 오늘도 복싱 레벨업 중</p>
        </motion.div>

        {/* 시그니처 메시지 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-3"
        >
          <p className="text-3xl font-black text-white">
            오늘 첫 라운드를{" "}
            <span className="text-reward">누가 시작할까요?</span>
          </p>
          <p className="text-lg text-gray-400">
            출석 체크 후 운동을 시작하면 이곳에 표시됩니다 🥊
          </p>
        </motion.div>

        {/* 통계 카드 */}
        {(todayVisitCount > 0 || hallOfFameCount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mt-2 flex items-center gap-4"
          >
            {todayVisitCount > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  오늘 방문
                </p>
                <p className="number-font mt-0.5 text-3xl font-black text-emerald-300 tabular-nums">
                  {todayVisitCount}
                  <span className="ml-1 text-base text-emerald-500">명</span>
                </p>
              </div>
            )}
            {hallOfFameCount > 0 && (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                  명예의 전당
                </p>
                <p className="number-font mt-0.5 text-3xl font-black text-yellow-300 tabular-nums">
                  {hallOfFameCount}
                  <span className="ml-1 text-base text-yellow-600">명</span>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LiveBoardEmptyState;
