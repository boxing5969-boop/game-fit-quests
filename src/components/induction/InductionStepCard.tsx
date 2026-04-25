import { ArrowRight, Banknote, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachBot } from "@/components/tutorial/CoachBot";
import { StepRewardChip } from "@/components/tutorial/StepRewardChip";
import { InductionProgressBar } from "./InductionProgressBar";
import { InductionProofRenderer } from "./InductionProofRenderer";
import type { InductionStep } from "@/data/inductionTutorialSteps";
import { cn } from "@/lib/utils";

/**
 * 단일 step 카드 — 카피·메시지는 모두 step.* 에서 읽는다 (data-driven).
 *
 * 텍스트 소스:
 *   · step.title          — STEP 배지 옆 메인 제목
 *   · step.valueHeadline  — 부제목 (가치 헤드라인)
 *   · step.valueBody      — 1~2줄 본문 (왜 이 화면이 중요한지)
 *   · step.coachMessage   — 오삼 코치 대사 (CoachBot)
 *   · step.ctaLabel       — 메인 CTA 문구
 *
 * 구조 변경 없음 — 기존 5개 섹션 (진행바·STEP·CoachBot·보상칩·CTA) 유지.
 * 본 컴포넌트는 더 이상 텍스트를 하드코딩하지 않으며,
 * 카피 변경은 src/data/inductionTutorialSteps.ts 한 곳에서 관리한다.
 */

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
  // 모든 카피는 step.* 에서 — config 단일 출처.
  const coachMessage = step.coachMessage || step.whyItMatters || step.valueBody;
  const ctaLabel = step.ctaLabel;
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

        {/* 2. STEP 배지 + 제목 + valueHeadline + valueBody
                — 모두 step.* 에서 읽음 (data-driven) */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            <span>STEP {step.order.toString().padStart(2, "0")}</span>
            <span className="opacity-70">· {step.shortLabel}</span>
          </div>
          <h2 className="text-lg font-extrabold leading-tight text-foreground">
            {step.title}
          </h2>
          {/* 가치 헤드라인 — 제목보다 한 톤 작게 부제목 역할 */}
          <p className="text-[13px] font-bold leading-snug text-foreground/90">
            {step.valueHeadline}
          </p>
          {/* 본문 — 왜 이 화면이 중요한지 1~2 줄 */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {step.valueBody}
          </p>
        </div>

        {/* 3. "왜 중요한가" — coachMessage 와 의미 분리.
                whyItMatters 는 한 줄짜리 정착 메시지, 카드형으로 무게 추가. */}
        {step.whyItMatters && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                왜 중요한가
              </p>
              <p className="mt-0.5 text-[12px] font-bold leading-snug text-foreground">
                {step.whyItMatters}
              </p>
            </div>
          </div>
        )}

        {/* 4. CoachBot — 오삼 코치 한마디 */}
        <CoachBot message={coachMessage} />

        {/* 5. proofItems — 실데이터 / 정적 안내 카드. 신규 데이터 호출 0. */}
        {step.proofItems && step.proofItems.length > 0 && (
          <InductionProofRenderer items={step.proofItems} maxItems={3} />
        )}

        {/* 6. 보상 — 시각 무게 축소. 카드 → 인라인 한 줄. */}
        <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Banknote className="h-3 w-3 text-reward/80" />
            <span className="font-semibold">이 단계 보상</span>
          </span>
          {recentReward && recentReward > 0 ? (
            <StepRewardChip amount={recentReward} />
          ) : (
            <span className="number-font text-[12px] font-bold text-reward/90">
              +{step.rewardGems.toLocaleString()}
              <span className="ml-0.5 text-[10px] font-semibold text-reward/70">
                {" "}파이트 머니
              </span>
            </span>
          )}
        </div>

        {/* 7. CTA — primary 강조. Step 5 만 reward 톤 */}
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
