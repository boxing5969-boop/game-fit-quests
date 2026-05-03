/**
 * 153 — 라이브보드 하단 컴팩트 그리드 (Cinematic).
 *
 * 스포트라이트 무대에 못 들어간 나머지 회원들을 작은 카드로 한눈에.
 *
 * 동작:
 *   · 12명 미만: 페이지 회전 OFF (모두 한 화면)
 *   · 13명 이상: 페이지당 최대 PAGE_SIZE 명, 15초마다 회전
 *   · 인원수에 따라 그리드 컬럼 자동 (5-12: 5xN / 13+: 6~7xN)
 *
 * 시각:
 *   · LiveActiveMemberCard size="medium" 또는 "compact"
 *   · framer-motion AnimatePresence 슬라이드 전환
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";

import LiveActiveMemberCard, {
  type LiveActiveMember,
  type LiveCardSize,
} from "./LiveActiveMemberCard";

const ROTATE_INTERVAL_MS = 15_000;
const ROTATE_THRESHOLD = 13; // 13명 이상부터 페이지 회전
const PAGE_SIZE = 12; // 페이지당 최대 12명

export interface LiveCompactGridProps {
  members: LiveActiveMember[];
  getElapsedMinutes: (startedAt: number) => number;
  showForceExit?: boolean;
  onForceExit?: (sessionId: string, name: string) => void;
}

const LiveCompactGrid = ({
  members,
  getElapsedMinutes,
  showForceExit,
  onForceExit,
}: LiveCompactGridProps) => {
  const totalCount = members.length;
  const shouldRotate = totalCount >= ROTATE_THRESHOLD;
  const totalPages = shouldRotate
    ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    : 1;

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      setPageIndex((p) => (p + 1) % totalPages);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [totalPages]);

  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);

  const currentPage = shouldRotate
    ? members.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)
    : members;

  const cardSize: LiveCardSize = shouldRotate ? "compact" : "medium";

  /** 그리드 컬럼 — 인원수와 사이즈에 따라 */
  const gridCols = shouldRotate
    ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6"
    : currentPage.length <= 4
      ? "grid-cols-2 sm:grid-cols-4"
      : currentPage.length <= 6
        ? "grid-cols-3 sm:grid-cols-6"
        : "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6";

  if (currentPage.length === 0) return null;

  return (
    <div className="mt-4 w-full">
      {/* 헤더 */}
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-black uppercase tracking-wider text-emerald-300">
          {shouldRotate ? "함께 운동 중" : "운동 중"} ({totalCount})
        </h3>
        {shouldRotate && totalPages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === pageIndex
                    ? "w-4 bg-emerald-400"
                    : "w-1 bg-emerald-400/30"
                }`}
              />
            ))}
          </div>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pageIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`grid gap-2.5 ${gridCols}`}
        >
          {currentPage.map((m) => (
            <LiveActiveMemberCard
              key={m.user_id}
              member={m}
              size={cardSize}
              elapsedMinutes={getElapsedMinutes(m.startedAt)}
              showForceExit={showForceExit && cardSize !== "compact"}
              onForceExit={
                onForceExit ? () => onForceExit(m.id, m.name) : undefined
              }
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LiveCompactGrid;
