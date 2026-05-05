/**
 * 153 스토리 RPG — 월드맵 래퍼 (단계 46).
 *
 * 기존 StoryWorldMapVisual 을 감싸서 잠금/클리어/현재 챕터 표시.
 * 챕터 클릭 시 onSelectChapter (상위 페이지에서 progress_to_scene 호출).
 */

import StoryWorldMapVisual from "./StoryWorldMapVisual";
import type {
  StoryChapter,
  StoryNode,
  StorySceneProgress,
} from "@/types/storyRpg";

export interface StoryWorldOverviewProps {
  nodes: StoryNode[];
  chapters: StoryChapter[];
  /** boxing_user_scene_progress 행 (해당 active route) */
  progress: StorySceneProgress | null;
  onSelectChapter: (chapter: StoryChapter) => void;
}

const StoryWorldOverview = ({
  nodes,
  chapters,
  progress,
  onSelectChapter,
}: StoryWorldOverviewProps) => {
  if (chapters.length === 0) return null;

  // 클리어한 챕터 = completed_chapter_codes 안 / 현재 챕터 = chapter_id 또는 진행 중인 첫 챕터
  const completed = new Set(progress?.completed_chapter_codes ?? []);
  const currentChapterId = progress?.chapter_id ?? null;

  // 현재 챕터 번호 = 클리어 갯수 + 1 (잠금 해제 단계)
  const unlockedUpTo = (progress?.completed_chapter_codes?.length ?? 0) + 1;

  // StoryWorldMapVisual 은 currentChapterNumber 와 completedChapterCount 만 받는다.
  return (
    <StoryWorldMapVisual
      nodes={nodes}
      chapters={chapters}
      currentChapterNumber={(() => {
        if (currentChapterId) {
          const c = chapters.find((c) => c.id === currentChapterId);
          if (c) return c.chapter_number;
        }
        return Math.min(unlockedUpTo, 6);
      })()}
      completedChapterCount={completed.size}
      onChapterTap={(chapter) => {
        // 잠금 검증: 클리어한 챕터이거나, current 또는 다음 챕터까지만 허용
        if (completed.has(chapter.code)) {
          onSelectChapter(chapter);
          return;
        }
        if (chapter.chapter_number <= unlockedUpTo) {
          onSelectChapter(chapter);
        }
      }}
    />
  );
};

export default StoryWorldOverview;
