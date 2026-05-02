/**
 * 153 QUEST v1.5 14단계 — 컨디션 게이지 진입 카드.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정 (읽기도 안 함)
 *   · 보상 0 — 카드 클릭은 시트 열기만
 *   · ChatAssistant / 새 AI 챗박스 0건
 */

import { Activity } from "lucide-react";

import {
  CONDITION_OPTIONS,
  getConditionOption,
  getConditionRecommendation,
} from "@/data/boxingConditionMessages";
import { useTodayBoxingCondition } from "@/hooks/useBoxingCondition";

interface Props {
  onOpen: () => void;
}

const ConditionGaugeCard = ({ onOpen }: Props) => {
  const { data: today, isLoading } = useTodayBoxingCondition();
  const selected = today?.condition_type ?? null;
  const option = getConditionOption(selected);
  const rec = getConditionRecommendation(selected);

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="오늘의 컨디션"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘의 컨디션
          </p>
          <h3 className="mt-0.5 text-[15px] font-bold text-foreground">
            {option ? `${option.emoji} ${option.label}` : "컨디션 선택"}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {isLoading
              ? "불러오는 중…"
              : rec
                ? rec.osamiMessage
                : "오늘 상태에 맞춰 보조 퀘스트 우선순위가 바뀝니다."}
          </p>
        </div>
      </div>

      {/* 빠른 선택 칩 */}
      {!selected && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CONDITION_OPTIONS.slice(0, 5).map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={onOpen}
              className="rounded-pill border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-all active:scale-[0.98] hover:border-primary/40"
            >
              {o.emoji} {o.shortLabel}
            </button>
          ))}
        </div>
      )}

      {/* 선택 후 추천 안내 */}
      {selected && rec && (
        <div className="mb-2 rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[12px] leading-relaxed text-foreground">
            {rec.hint}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 공식 훈련은 그대로 유지됩니다. 보조 퀘스트 추천만 조정됩니다.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-card border border-border bg-card py-2.5 text-[12.5px] font-bold text-primary transition-all active:scale-[0.99] hover:border-primary/40"
      >
        {selected ? "컨디션 다시 선택" : "오늘 컨디션 선택"} →
      </button>
    </section>
  );
};

export default ConditionGaugeCard;
