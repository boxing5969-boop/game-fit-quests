/**
 * 153 스토리 RPG — 월드맵 (단계 38).
 *
 * 노드 상태 결정:
 *   · 현재 챕터의 world_node_code → "current"
 *   · 이미 클리어한 챕터들의 world_node_code → "cleared"
 *   · 그 외 → "neutral" (locked 는 사용 안 함 — 노드는 자유롭게 둘러볼 수 있는 풍경)
 */

import { useMemo } from "react";
import StoryWorldNode, { type StoryWorldNodeState } from "./StoryWorldNode";
import type { StoryChapter, StoryNode, StoryProgress } from "@/types/storyRpg";

export interface StoryWorldMapProps {
  nodes: StoryNode[];
  chapters: StoryChapter[];
  progress: StoryProgress | null;
}

const StoryWorldMap = ({ nodes, chapters, progress }: StoryWorldMapProps) => {
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.sort_order - b.sort_order),
    [nodes],
  );

  const currentChapterNum = progress?.current_chapter_number ?? 1;
  const currentChapter = chapters.find(
    (c) => c.chapter_number === currentChapterNum,
  );

  const clearedNodes = useMemo(() => {
    const set = new Set<string>();
    chapters
      .filter((c) => c.chapter_number < currentChapterNum)
      .forEach((c) => set.add(c.world_node_code));
    return set;
  }, [chapters, currentChapterNum]);

  const decideState = (node: StoryNode): StoryWorldNodeState => {
    if (currentChapter?.world_node_code === node.code) return "current";
    if (clearedNodes.has(node.code)) return "cleared";
    return "neutral";
  };

  if (sortedNodes.length === 0) return null;

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
          오늘 내가 어디에 서 있는지를 한 눈에 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sortedNodes.map((node) => (
          <StoryWorldNode
            key={node.id}
            node={node}
            state={decideState(node)}
          />
        ))}
      </div>
    </section>
  );
};

export default StoryWorldMap;
