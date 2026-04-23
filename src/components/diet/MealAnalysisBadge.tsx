import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL_KO,
  CATEGORY_TONE_CLASS,
  type MealCategory,
} from "@/lib/diet/mealAnalyzer";

interface MealAnalysisBadgeProps {
  category: MealCategory;
  feedback?: string | null;
  compact?: boolean;
  className?: string;
}

/**
 * 식단 사진 분석 결과 표시 카드/배지.
 *
 * compact=true: 작은 배지만 (갤러리 썸네일 위)
 * compact=false: 피드백 한 줄 포함 카드 (상세 화면)
 */
export const MealAnalysisBadge = ({
  category,
  feedback,
  compact,
  className,
}: MealAnalysisBadgeProps) => {
  const tone = CATEGORY_TONE_CLASS[category];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
          tone,
          className,
        )}
      >
        <Sparkles className="h-2.5 w-2.5" />
        {CATEGORY_LABEL_KO[category]}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone,
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">
          MEAL · {CATEGORY_LABEL_KO[category]}
        </p>
      </div>
      {feedback && (
        <p className="mt-1 text-[12.5px] font-bold leading-snug">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default MealAnalysisBadge;
