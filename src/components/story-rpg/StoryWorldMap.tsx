/**
 * 153 스토리 RPG — 월드맵 래퍼 (단계 38, 41 업그레이드).
 *
 * 41단계: 비주얼 월드맵 (StoryWorldMapVisual) 으로 위임. 기존 시그니처 유지.
 * 캐릭터 탭 시 onChapterTap 콜백 (StoryRpgPage 가 전투 시작에 사용).
 */

import StoryWorldMapVisual from "./StoryWorldMapVisual";
import type { StoryChapter, StoryNode, StoryProgress } from "@/types/storyRpg";

export interface StoryWorldMapProps {
  nodes: StoryNode[];
  chapters: StoryChapter[];
  progress: StoryProgress | null;
  userPhoto?: React.ReactNode;
  onChapterTap?: (chapter: StoryChapter) => void;
}

const StoryWorldMap = ({
  nodes,
  chapters,
  progress,
  userPhoto,
  onChapterTap,
}: StoryWorldMapProps) => {
  if (chapters.length === 0) return null;

  return (
    <StoryWorldMapVisual
      nodes={nodes}
      chapters={chapters}
      currentChapterNumber={progress?.current_chapter_number ?? 1}
      completedChapterCount={progress?.completed_chapter_count ?? 0}
      userPhoto={userPhoto}
      onChapterTap={onChapterTap}
    />
  );
};

export default StoryWorldMap;
