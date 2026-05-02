/**
 * 153 QUEST v1.5 15단계 — 리턴 라운드 복귀 미션 카드.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 카드 자체에는 보상 amount 없음 — 시트의 단일 claim 버튼이 처리
 */

import { CheckCircle2, Sparkles } from "lucide-react";

import type { ReturnRoundMission } from "@/services/boxingEngagementService";

export interface ReturnRoundMissionCardProps {
  mission: ReturnRoundMission;
  selected: boolean;
  onSelect: () => void;
}

const ReturnRoundMissionCard = ({
  mission,
  selected,
  onSelect,
}: ReturnRoundMissionCardProps) => (
  <button
    type="button"
    onClick={onSelect}
    className={`flex w-full items-start gap-3 rounded-card border px-3.5 py-3 text-left transition-all active:scale-[0.99] ${
      selected
        ? "border-primary bg-primary/10"
        : "border-border bg-card hover:border-primary/40"
    }`}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      {selected ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-bold text-foreground">{mission.title}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
        {mission.description}
      </p>
    </div>
    {selected && (
      <span className="shrink-0 text-[11px] font-bold text-primary">
        선택됨
      </span>
    )}
  </button>
);

export default ReturnRoundMissionCard;
