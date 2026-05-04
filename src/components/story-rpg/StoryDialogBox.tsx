/**
 * 153 스토리 RPG — 오삼이 대화창 (단계 38, 41 업그레이드).
 *
 * 41단계 업그레이드:
 *   · 타이프라이터 효과 (40ms 간격)
 *   · 타이핑 중 탭 → 즉시 전체 표시
 *   · 타이핑 끝나면 "▼ 다음" 깜빡임
 *
 * 보호 원칙:
 *   · LLM 호출 없음. ChatAssistant 미사용.
 *   · dialogue 는 모두 마이복서153 자체 카피 (실존 인물/IP 사용 금지).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import OsamMascot from "@/components/mascot/OsamMascot";
import { STORY_RPG_INTRO_FALLBACK } from "@/data/storyRpgCopy";
import type { StoryChapter, StoryDialogue } from "@/types/storyRpg";
import StoryObstacleBadge from "./StoryObstacleBadge";

const TYPE_INTERVAL_MS = 40;

export interface StoryDialogBoxProps {
  chapter: StoryChapter | null;
  dialogues: StoryDialogue[];
  onOpenQuests?: () => void;
  onChallenge?: () => void;
}

const StoryDialogBox = ({
  chapter,
  dialogues,
  onOpenQuests,
  onChallenge,
}: StoryDialogBoxProps) => {
  const navigate = useNavigate();

  const intro = chapter
    ? dialogues.find(
        (d) => d.chapter_id === chapter.id && d.dialogue_type === "intro",
      )
    : null;

  const body = intro?.body ?? STORY_RPG_INTRO_FALLBACK;
  const speaker = intro?.speaker ?? "오삼이";

  // 타이프라이터 — chapter/body 가 바뀔 때마다 리셋
  const [typedLen, setTypedLen] = useState(0);

  useEffect(() => {
    setTypedLen(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedLen(i);
      if (i >= body.length) clearInterval(id);
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [body]);

  const isComplete = typedLen >= body.length;
  const handleTap = () => {
    if (!isComplete) setTypedLen(body.length);
  };

  return (
    <section
      onClick={handleTap}
      className="relative cursor-pointer rounded-2xl border border-amber-500/30 bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950/30 p-4 shadow-lg shadow-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <OsamMascot size="sm" state="idle" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
            {speaker}
          </p>
          {chapter && (
            <p className="mt-0.5 text-[12px] font-bold text-foreground">
              {chapter.chapter_number}장 · {chapter.title}
            </p>
          )}
          <p className="mt-2 min-h-[3.5em] whitespace-pre-line text-[13px] leading-relaxed text-foreground">
            {body.slice(0, typedLen)}
            {!isComplete && (
              <motion.span
                className="ml-0.5 inline-block h-3 w-0.5 align-middle bg-amber-300"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </p>
        </div>
      </div>

      {chapter?.obstacle_code && isComplete && (
        <div className="mt-3">
          <StoryObstacleBadge code={chapter.obstacle_code} size="md" showDescription />
        </div>
      )}

      {isComplete && (
        <>
          <div
            className="mt-3 flex flex-wrap gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {onChallenge && (
              <button
                type="button"
                onClick={onChallenge}
                className="inline-flex items-center gap-1.5 rounded-pill border border-amber-500/60 bg-gradient-to-r from-amber-500/30 to-rose-500/20 px-3 py-1.5 text-[11px] font-black text-amber-50 active:scale-[0.98] hover:border-amber-400"
              >
                <Sparkles className="h-3 w-3" />
                도전하기
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenQuests?.()}
              className="inline-flex items-center gap-1.5 rounded-pill border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-100 active:scale-[0.98] hover:border-amber-500/60"
            >
              오늘의 퀘스트 보기
            </button>
            <button
              type="button"
              onClick={() => navigate("/missions")}
              className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-gray-900/60 px-3 py-1.5 text-[11px] font-bold text-foreground active:scale-[0.98] hover:border-white/30"
            >
              공식 훈련하러 가기
            </button>
          </div>

          <motion.p
            className="mt-2 text-center text-[10px] font-bold tracking-wider text-amber-300/70"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ▼ 탭하여 다음
          </motion.p>
        </>
      )}
    </section>
  );
};

export default StoryDialogBox;
