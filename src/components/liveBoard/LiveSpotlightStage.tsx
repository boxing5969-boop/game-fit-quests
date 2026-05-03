/**
 * 153 — 라이브보드 상단 스포트라이트 무대 (Cinematic).
 *
 * 1~3명의 "주인공" 회원을 풀 사이즈로 회전 표시.
 *
 * 주인공 선정 로직 (우선순위):
 *   1. 5분 이내 신규 입실 (방금 환영 무대)
 *   2. 가장 오래 운동 중 (수고하는 사람 부각)
 *   3. 가장 높은 레벨 (랭킹 최상위)
 *
 * 동작:
 *   · 인원 ≤ 3: 모두 한 번에 표시 (회전 없음)
 *   · 인원 > 3: 3명씩 묶어 10초마다 회전
 *   · 새 입실 발생 시 즉시 첫 페이지로 점프 (환영 연출)
 *
 * 시각:
 *   · LiveActiveMemberCard size="spotlight" + isFresh 강조
 *   · framer-motion AnimatePresence 슬라이드 전환
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import LiveActiveMemberCard, {
  type LiveActiveMember,
} from "./LiveActiveMemberCard";

const FRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5분
const ROTATE_INTERVAL_MS = 10_000; // 10초
const SPOTLIGHT_PER_PAGE = 3;

export interface LiveSpotlightStageProps {
  members: LiveActiveMember[];
  /** 분 단위 환산 함수 (LiveBoardPage 의 elapsedMin 재사용) */
  getElapsedMinutes: (startedAt: number) => number;
  showForceExit?: boolean;
  onForceExit?: (sessionId: string, name: string) => void;
}

const LiveSpotlightStage = ({
  members,
  getElapsedMinutes,
  showForceExit,
  onForceExit,
}: LiveSpotlightStageProps) => {
  const now = Date.now();

  /** 정렬된 회원 — fresh > 가장 오래 운동 > 레벨 high */
  const sorted = useMemo(() => {
    const arr = [...members];
    arr.sort((a, b) => {
      const aFresh = now - a.startedAt < FRESH_THRESHOLD_MS;
      const bFresh = now - b.startedAt < FRESH_THRESHOLD_MS;
      if (aFresh !== bFresh) return aFresh ? -1 : 1;
      // 둘 다 fresh 면 가장 최근 입실이 앞
      if (aFresh && bFresh) return b.startedAt - a.startedAt;
      // 둘 다 non-fresh 면 가장 오래 운동한 사람이 앞
      const aDur = now - a.startedAt;
      const bDur = now - b.startedAt;
      if (aDur !== bDur) return bDur - aDur;
      // 같으면 레벨 high 우선
      return b.level - a.level;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / SPOTLIGHT_PER_PAGE));
  const [pageIndex, setPageIndex] = useState(0);

  // 새 fresh 회원 들어오면 페이지 0 으로 점프
  const lastFreshIdRef = useRef<string | null>(null);
  useEffect(() => {
    const fresh = sorted.find(
      (m) => Date.now() - m.startedAt < FRESH_THRESHOLD_MS,
    );
    if (fresh && fresh.user_id !== lastFreshIdRef.current) {
      lastFreshIdRef.current = fresh.user_id;
      setPageIndex(0);
    }
  }, [sorted]);

  // 회전 (페이지 2 이상일 때만)
  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      setPageIndex((p) => (p + 1) % totalPages);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [totalPages]);

  // pageIndex 가 totalPages 변경으로 범위를 벗어나면 0 으로 리셋
  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);

  const currentPage = sorted.slice(
    pageIndex * SPOTLIGHT_PER_PAGE,
    (pageIndex + 1) * SPOTLIGHT_PER_PAGE,
  );

  // 1~3명일 때 그리드 폭 자동 조정
  const gridCols =
    currentPage.length === 1
      ? "grid-cols-1 max-w-sm mx-auto"
      : currentPage.length === 2
        ? "grid-cols-2 max-w-3xl mx-auto"
        : "grid-cols-3 max-w-5xl mx-auto";

  return (
    <div className="relative w-full">
      {/* 무대 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-black uppercase tracking-wider text-yellow-300">
          오늘의 스포트라이트
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === pageIndex
                    ? "w-6 bg-yellow-400"
                    : "w-1.5 bg-yellow-400/30"
                }`}
              />
            ))}
          </div>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/40 to-transparent" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pageIndex}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`grid gap-4 ${gridCols}`}
        >
          {currentPage.map((m) => {
            const isFresh = Date.now() - m.startedAt < FRESH_THRESHOLD_MS;
            return (
              <LiveActiveMemberCard
                key={m.user_id}
                member={m}
                size="spotlight"
                elapsedMinutes={getElapsedMinutes(m.startedAt)}
                isFresh={isFresh}
                showForceExit={showForceExit}
                onForceExit={
                  onForceExit ? () => onForceExit(m.id, m.name) : undefined
                }
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LiveSpotlightStage;
