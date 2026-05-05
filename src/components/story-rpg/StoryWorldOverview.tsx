/**
 * 153 스토리 RPG — 월드맵 (Stage 47A 비주얼 오버홀).
 *
 * 0층 일러스트 배경 → 1층 곡선 path → 2층 챕터 노드 → 3층 PlayerWalker.
 */

import { useMemo, useState } from "react";
import WorldMapBackdrop, {
  type WorldRouteCode,
} from "./visuals/backgrounds/WorldMapBackdrop";
import ChapterNodeIcon, {
  type ChapterNodeStatus,
} from "./visuals/icons/ChapterNodeIcon";
import { CHAPTER_LAYOUT } from "./visuals/icons/chapterIconMap";
import PlayerWalker from "./visuals/player/PlayerWalker";
import type {
  StoryChapter,
  StoryNode,
  StorySceneProgress,
} from "@/types/storyRpg";

export interface StoryWorldOverviewProps {
  nodes: StoryNode[];
  chapters: StoryChapter[];
  progress: StorySceneProgress | null;
  routeCode?: string | null;
  onSelectChapter: (chapter: StoryChapter) => void;
}

const StoryWorldOverview = ({
  chapters,
  progress,
  routeCode,
  onSelectChapter,
}: StoryWorldOverviewProps) => {
  const completed = useMemo(
    () => new Set(progress?.completed_chapter_codes ?? []),
    [progress?.completed_chapter_codes],
  );
  const unlockedUpTo = (progress?.completed_chapter_codes?.length ?? 0) + 1;
  const currentChapterId = progress?.chapter_id ?? null;

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters],
  );

  const decideStatus = (c: StoryChapter): ChapterNodeStatus => {
    if (completed.has(c.code)) return "cleared";
    if (currentChapterId === c.id) return "current";
    if (c.chapter_number <= unlockedUpTo) return "available";
    return "locked";
  };

  // PlayerWalker 위치 — 마지막 클리어한 챕터 또는 현재 챕터의 좌표
  const walkerPos = useMemo(() => {
    if (sortedChapters.length === 0) return null;
    let target: StoryChapter | null = null;
    if (currentChapterId) {
      target = sortedChapters.find((c) => c.id === currentChapterId) ?? null;
    }
    if (!target && completed.size > 0) {
      const lastClearedNum = completed.size;
      target =
        sortedChapters.find((c) => c.chapter_number === lastClearedNum) ??
        sortedChapters[0];
    }
    if (!target) target = sortedChapters[0];
    const layout = CHAPTER_LAYOUT[target.code];
    return layout ?? { x: "16%", y: "82%", icon: "door_open" as const };
  }, [sortedChapters, currentChapterId, completed.size]);

  const [hoveredChapter, setHoveredChapter] = useState<StoryChapter | null>(null);

  if (sortedChapters.length === 0) return null;

  // 곡선 path 생성 (sortedChapters 좌표를 잇는다)
  const pathSegments = useMemo(() => {
    const segs: Array<{ d: string; cleared: boolean }> = [];
    for (let i = 0; i < sortedChapters.length - 1; i++) {
      const a = CHAPTER_LAYOUT[sortedChapters[i].code];
      const b = CHAPTER_LAYOUT[sortedChapters[i + 1].code];
      if (!a || !b) continue;
      const ax = parseFloat(a.x);
      const ay = parseFloat(a.y);
      const bx = parseFloat(b.x);
      const by = parseFloat(b.y);
      const midX = (ax + bx) / 2;
      const cleared = completed.has(sortedChapters[i].code);
      segs.push({
        d: `M ${ax} ${ay} C ${midX} ${ay}, ${midX} ${by}, ${bx} ${by}`,
        cleared,
      });
    }
    return segs;
  }, [sortedChapters, completed]);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          월드맵
        </p>
        <h2 className="mt-0.5 text-base font-black text-foreground">
          복서의 길
        </h2>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl border border-amber-500/20"
        style={{ aspectRatio: "16 / 10" }}
      >
        {/* 0층: 일러스트 배경 */}
        <WorldMapBackdrop routeCode={routeCode as WorldRouteCode | null} />

        {/* 1층: 곡선 path */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {pathSegments.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              stroke={seg.cleared ? "#fdb85c" : "#475569"}
              strokeWidth="0.8"
              strokeDasharray={seg.cleared ? "0" : "1.2 1.2"}
              fill="none"
              opacity="0.85"
            />
          ))}
        </svg>

        {/* 2층: 챕터 노드 */}
        {sortedChapters.map((c) => {
          const layout = CHAPTER_LAYOUT[c.code];
          if (!layout) return null;
          const status = decideStatus(c);
          return (
            <div
              key={c.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: layout.x, top: layout.y }}
              onMouseEnter={() => setHoveredChapter(c)}
              onMouseLeave={() => setHoveredChapter(null)}
            >
              <ChapterNodeIcon
                variant={layout.icon}
                status={status}
                size="md"
                onClick={() => {
                  if (status !== "locked") onSelectChapter(c);
                }}
                label={c.title}
              />
            </div>
          );
        })}

        {/* 3층: PlayerWalker */}
        {walkerPos && (
          <PlayerWalker
            x={walkerPos.x}
            y={walkerPos.y}
            facing="right"
            state="idle"
            routeCode={(routeCode as WorldRouteCode) ?? "master_path"}
          />
        )}

        {/* 4층: hover 카드 */}
        {hoveredChapter && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-xl border border-amber-500/30 bg-gray-950/95 px-3 py-2 text-[11px] shadow-lg"
            style={{
              left: CHAPTER_LAYOUT[hoveredChapter.code]?.x ?? "50%",
              top: `calc(${CHAPTER_LAYOUT[hoveredChapter.code]?.y ?? "50%"} - 56px)`,
              minWidth: 160,
            }}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">
              {hoveredChapter.chapter_number}장
            </p>
            <p className="mt-0.5 font-bold text-foreground">
              {hoveredChapter.title}
            </p>
            {hoveredChapter.subtitle && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {hoveredChapter.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default StoryWorldOverview;
