import { ArrowRight, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachBot } from "@/components/tutorial/CoachBot";
import { StepRewardChip } from "@/components/tutorial/StepRewardChip";
import { InductionProgressBar } from "./InductionProgressBar";
import type { InductionStep } from "@/data/inductionTutorialSteps";
import { cn } from "@/lib/utils";

/**
 * step 별 CoachBot 대사 — "랭킹업 입단식" 톤 (복싱짐 NPC 컨셉).
 */
const COACH_MESSAGES: Record<number, string> = {
  1: "환영합니다, 챌린저님.\n먼저 당신의 캐릭터와 이름을 확인하세요.",
  2: "당신은 지금 어디쯤 와 있을까요?\n현재 리그와 레벨을 확인해보세요.",
  3: "성장은 출석이 아니라 퀘스트로 증명합니다.\n오늘의 미션을 확인하세요.",
  4: "퀘스트를 깨면 보상이 따라옵니다.\n젬과 커스터마이징 보상을 확인하세요.",
  5: "이제 첫 퀘스트를 완료해보세요.\n오늘부터 당신의 랭킹업이 시작됩니다.",
};

/**
 * CTA 카피 — 게임 진행감 강조 ("좋아, 다음 단계" 리듬).
 * Step 5 만 "첫 퀘스트 시작하기" 로 최종 액션 신호.
 */
const CTA_LABELS: Record<number, string> = {
  1: "좋아, 리그 보러 가기",
  2: "좋아, 퀘스트 보러 가기",
  3: "좋아, 보상함 열기",
  4: "이제 시작하자",
  5: "첫 퀘스트 시작하기",
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

        {/* 2. STEP 배지 + 제목 */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            <span>STEP {step.order.toString().padStart(2, "0")}</span>
          </div>
          <h2 className="text-lg font-extrabold leading-tight text-foreground">
            {step.title}
          </h2>
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
            <Gem className="h-3.5 w-3.5 text-reward" />
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
