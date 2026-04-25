import { ArrowRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachBot } from "@/components/tutorial/CoachBot";
import { StepRewardChip } from "@/components/tutorial/StepRewardChip";
import { InductionProgressBar } from "./InductionProgressBar";
import type { InductionStep } from "@/data/inductionTutorialSteps";
import { cn } from "@/lib/utils";

/**
 * step 별 오삼 코치 대사 — "왜 153인가" 가치 전달 톤.
 *
 * 톤 가이드:
 *   · 성인 회원 친화. 게임 용어("챌린저/퀘스트/보스") 최소화
 *   · 출석이 아니라 성장·승급·기록·증명 중심
 *   · 한 줄당 12~22자, 두 줄 권장
 */
const COACH_MESSAGES: Record<number, string> = {
  1: "153은 출석이 아니라 성장으로 증명하는 곳입니다.\n지금의 당신이 출발점이에요.",
  2: "백 → 청 → 적 → 흑, 단계적 승급 구조입니다.\n오늘의 한 발이 다음 리그로 이어져요.",
  3: "헬스장은 출석으로 끝나지만,\n153은 오늘 무엇을 했는지 기록으로 남깁니다.",
  4: "훈련을 완수하면 파이트 머니가 지급돼요.\n복서 카드·단증 혜택 등 실제 가치로 연결됩니다.",
  5: "마지막 단계 — 오늘의 훈련 하나만 시작해 주세요.\n첫 기록부터 당신의 성장이 측정됩니다.",
};

/**
 * CTA 카피 — 성인 톤. 게임적 리듬("좋아, ~") 제거.
 * Step 5 는 최종 액션 신호.
 */
const CTA_LABELS: Record<number, string> = {
  1: "내 리그 확인하기",
  2: "오늘의 훈련 보기",
  3: "파이트 머니 확인",
  4: "첫 훈련 준비 완료",
  5: "첫 훈련 시작하기",
};

interface InductionStepCardProps {
  step: InductionStep;
  stepsCompleted: number;
  totalSteps: number;
  /** 직전 단계 완료 시 표시할 +N 파이트 머니. null 이면 기본 미리보기. */
  recentReward: number | null;
  /** CTA 클릭 — 현재 step 완료 요청. overlay 가 RPC 호출 담당. */
  onConfirm: () => void;
  /** 스킵 클릭. */
  onSkip: () => void;
  /** 최종 완료 mutation in-flight 시 버튼 잠금. */
  busy?: boolean;
  className?: string;
}

/**
 * 단일 step 카드 — 모바일 밀도 + 스포츠 RPG 라운드 카드 느낌.
 *
 * 구성 (위→아래, gap-3.5)
 *   1. ROUND N/5 진행 바 + 스킵
 *   2. STEP N 배지 + 제목
 *   3. CoachBot 대사
 *   4. 이 단계 보상 칩 (+N 젬)
 *   5. CTA (primary glow, arrow)
 */
export const InductionStepCard = ({
  step,
  stepsCompleted,
  totalSteps,
  recentReward,
  onConfirm,
  onSkip,
  busy = false,
  className,
}: InductionStepCardProps) => {
  const coachMessage = COACH_MESSAGES[step.order] ?? step.description;
  const ctaLabel = CTA_LABELS[step.order] ?? "다음 단계";
  const isFinalStep = step.order === totalSteps;

  return (
    <div
      className={cn(
        "relative w-full max-w-[360px] overflow-hidden rounded-3xl",
        "bg-gradient-to-b from-card via-card to-card/95",
        "border border-primary/30 shadow-[0_0_48px_rgba(217,54,32,0.28)]",
        "animate-slide-up",
        className,
      )}
    >
      {/* 상단 accent 라인 (primary→reward→primary) */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-reward to-primary" />

      <div className="flex flex-col gap-3.5 p-5">
        {/* 1. 진행 바 + 스킵 */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <InductionProgressBar
              currentStepOrder={step.order}
              stepsCompleted={stepsCompleted}
              totalSteps={totalSteps}
            />
          </div>
          <button
            type="button"
            onClick={onSkip}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "transition-colors",
            )}
            aria-label="튜토리얼 스킵"
          >
            스킵
          </button>
        </div>

        {/* 2. STEP 배지 + 제목 + description (가치 전달 한 줄) */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            <span>STEP {step.order.toString().padStart(2, "0")}</span>
          </div>
          <h2 className="text-lg font-extrabold leading-tight text-foreground">
            {step.title}
          </h2>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>

        {/* 3. CoachBot */}
        <CoachBot message={coachMessage} />

        {/* 4. 보상 칩 */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-2xl",
            "border border-reward/25 bg-gradient-to-br from-reward/10 to-transparent",
            "px-3 py-2",
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Banknote className="h-3.5 w-3.5 text-reward" />
            <span>이 단계 보상</span>
          </div>
          {recentReward && recentReward > 0 ? (
            <StepRewardChip amount={recentReward} />
          ) : (
            <span className="number-font text-[13px] font-extrabold text-reward">
              +{step.rewardGems.toLocaleString()}
              <span className="ml-0.5 text-[10px] font-bold text-reward/80">
                젬
              </span>
            </span>
          )}
        </div>

        {/* 5. CTA — primary glow 강조 */}
        <Button
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "h-11 w-full rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary to-primary/85",
            "text-primary-foreground hover:from-primary/95 hover:to-primary/80",
            "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
            isFinalStep && "from-reward/95 to-primary text-primary-foreground",
          )}
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InductionStepCard;
