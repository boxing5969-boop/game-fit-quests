/**
 * 153 스토리 RPG — 오삼이 대화창 (단계 38).
 *
 * 정적 dialogue 테이블에서 현재 챕터의 'intro' 대사를 1개 표시.
 * dialogue 데이터가 비어있으면 STORY_INTRO_FALLBACK 으로 graceful 표시.
 *
 * 보호 원칙:
 *   · LLM 호출 없음. ChatAssistant 미사용.
 *   · dialogue 는 모두 마이복서153 자체 카피 (실존 인물/IP 사용 금지).
 */

import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { STORY_RPG_INTRO_FALLBACK } from "@/data/storyRpgCopy";
import type { StoryChapter, StoryDialogue } from "@/types/storyRpg";
import StoryObstacleBadge from "./StoryObstacleBadge";

export interface StoryDialogBoxProps {
  chapter: StoryChapter | null;
  dialogues: StoryDialogue[];
  onOpenQuests?: () => void;
}

const StoryDialogBox = ({
  chapter,
  dialogues,
  onOpenQuests,
}: StoryDialogBoxProps) => {
  const navigate = useNavigate();

  const intro = chapter
    ? dialogues.find(
        (d) => d.chapter_id === chapter.id && d.dialogue_type === "intro",
      )
    : null;

  const body = intro?.body ?? STORY_RPG_INTRO_FALLBACK;
  const speaker = intro?.speaker ?? "오삼이";

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-base">
          🥊
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            {speaker}
          </p>
          {chapter && (
            <p className="text-[12px] font-bold text-foreground">
              {chapter.chapter_number}장 · {chapter.title}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
        {body}
      </p>

      {chapter?.obstacle_code && (
        <div className="mt-3">
          <StoryObstacleBadge code={chapter.obstacle_code} size="md" showDescription />
        </div>
      )}

      {/* 선택지 — 기존 기능으로 연결 (callback 또는 라우트 이동) */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenQuests?.()}
          className="inline-flex items-center gap-1.5 rounded-pill border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-100 active:scale-[0.98] hover:border-amber-500/60"
        >
          <Sparkles className="h-3 w-3" />
          오늘의 퀘스트 보기
        </button>
        <button
          type="button"
          onClick={() => navigate("/missions")}
          className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-gray-900/60 px-3 py-1.5 text-[11px] font-bold text-foreground active:scale-[0.98] hover:border-white/30"
        >
          공식 훈련하러 가기
        </button>
        <button
          type="button"
          onClick={() => navigate("/halloffame")}
          className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-gray-900/60 px-3 py-1.5 text-[11px] font-bold text-foreground active:scale-[0.98] hover:border-white/30"
        >
          복싱 전당
        </button>
      </div>
    </section>
  );
};

export default StoryDialogBox;
