/**
 * 153 스토리 RPG — 비주얼 월드맵 (단계 41).
 *
 * 세로형 지그재그 월드맵 — 노드들이 곡선 path 로 연결되고 캐릭터가 현재 노드 위에 떠있다.
 * 모든 SVG/그라디언트는 인라인. 외부 이미지 X.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Lock, Sparkles } from "lucide-react";
import OsamMascot from "@/components/mascot/OsamMascot";
import type { StoryChapter, StoryNode } from "@/types/storyRpg";

export interface StoryWorldMapVisualProps {
  nodes: StoryNode[];
  chapters: StoryChapter[];
  currentChapterNumber: number;
  completedChapterCount: number;
  userPhoto?: React.ReactNode;
  onChapterTap?: (chapter: StoryChapter) => void;
}

const ROW_HEIGHT = 110;
const NODE_SIZE = 72;

const StoryWorldMapVisual = ({
  nodes,
  chapters,
  currentChapterNumber,
  completedChapterCount,
  userPhoto,
  onChapterTap,
}: StoryWorldMapVisualProps) => {
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters],
  );

  const nodeByCode = useMemo(() => {
    const m = new Map<string, StoryNode>();
    nodes.forEach((n) => m.set(n.code, n));
    return m;
  }, [nodes]);

  const totalHeight = sortedChapters.length * ROW_HEIGHT + 40;

  // 지그재그 좌표 계산 (퍼센트 기준 — left: 22%, 50%, 78% 반복)
  const nodePositions = useMemo(() => {
    return sortedChapters.map((c, i) => {
      const col = i % 3; // 0=left, 1=center, 2=right
      const leftPct = col === 0 ? 22 : col === 1 ? 50 : 78;
      const top = i * ROW_HEIGHT + 20;
      return { chapter: c, leftPct, top };
    });
  }, [sortedChapters]);

  const currentNodeIndex = nodePositions.findIndex(
    (n) => n.chapter.chapter_number === currentChapterNumber,
  );

  // 노드 사이 곡선 path 생성 (절대 좌표는 SVG 가 viewBox 100% 사용)
  const pathSegments = useMemo(() => {
    const segs: string[] = [];
    for (let i = 0; i < nodePositions.length - 1; i++) {
      const a = nodePositions[i];
      const b = nodePositions[i + 1];
      const ay = a.top + NODE_SIZE / 2;
      const by = b.top + NODE_SIZE / 2;
      const midY = (ay + by) / 2;
      segs.push(
        `M ${a.leftPct}% ${ay} C ${a.leftPct}% ${midY}, ${b.leftPct}% ${midY}, ${b.leftPct}% ${by}`,
      );
    }
    return segs;
  }, [nodePositions]);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          월드맵
        </p>
        <h2 className="mt-0.5 text-base font-black text-foreground">
          체육관의 풍경
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          현재 위치를 탭하면 챕터 정보가 보여집니다.
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-b from-indigo-950 via-slate-900 to-gray-950"
        style={{ height: totalHeight }}
      >
        {/* 떠다니는 입자 */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-amber-300/60"
              style={{
                left: `${(i * 13 + 5) % 100}%`,
                top: `${(i * 17 + 10) % 100}%`,
              }}
              animate={{ opacity: [0.2, 0.8, 0.2], y: [0, -12, 0] }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
            />
          ))}
        </div>

        {/* 곡선 path */}
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          {pathSegments.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke={i < completedChapterCount ? "#fbbf24" : "#475569"}
              strokeWidth="3"
              strokeDasharray={i < completedChapterCount ? "0" : "6 6"}
              fill="none"
              opacity="0.7"
            />
          ))}
        </svg>

        {/* 노드 */}
        {nodePositions.map(({ chapter, leftPct, top }, i) => {
          const node = nodeByCode.get(chapter.world_node_code);
          const isCurrent = chapter.chapter_number === currentChapterNumber;
          const isCleared = chapter.chapter_number < currentChapterNumber;
          const isLocked = chapter.chapter_number > currentChapterNumber;

          return (
            <button
              key={chapter.id}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && onChapterTap?.(chapter)}
              className="absolute -translate-x-1/2 transform"
              style={{ left: `${leftPct}%`, top, width: NODE_SIZE }}
            >
              <motion.div
                whileTap={!isLocked ? { scale: 0.94 } : undefined}
                animate={
                  isCurrent
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(251,191,36,0.0)",
                          "0 0 0 8px rgba(251,191,36,0.25)",
                          "0 0 0 0 rgba(251,191,36,0.0)",
                        ],
                      }
                    : {}
                }
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                className={`relative flex h-[72px] w-[72px] flex-col items-center justify-center rounded-2xl border-2 ${
                  isCurrent
                    ? "border-amber-300 bg-gradient-to-br from-amber-500/40 to-rose-500/30"
                    : isCleared
                      ? "border-emerald-500/60 bg-emerald-500/15"
                      : "border-white/10 bg-gray-900/70 opacity-70"
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-200">
                  {chapter.chapter_number}장
                </span>
                <span className="mt-0.5 line-clamp-1 max-w-[60px] text-center text-[10px] font-bold text-foreground">
                  {node?.title ?? chapter.title}
                </span>
                {isCleared && (
                  <Check className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" />
                )}
                {isLocked && (
                  <Lock className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gray-700 p-0.5 text-gray-300" />
                )}
                {isCurrent && (
                  <Sparkles className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amber-400 p-0.5 text-amber-950" />
                )}
              </motion.div>
            </button>
          );
        })}

        {/* 캐릭터 (현재 노드 위에 떠있음) */}
        {currentNodeIndex >= 0 && (
          <motion.div
            className="pointer-events-none absolute -translate-x-1/2 transform"
            style={{
              left: `${nodePositions[currentNodeIndex].leftPct}%`,
              top: nodePositions[currentNodeIndex].top - 56,
              width: 60,
              height: 60,
            }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {userPhoto ?? <OsamMascot size="sm" state="idle" />}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default StoryWorldMapVisual;
