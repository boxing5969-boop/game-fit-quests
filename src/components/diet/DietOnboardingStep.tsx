import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DietOnboardingStepProps {
  stepIndex: number;      // 0-based
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextPending?: boolean;
  className?: string;
}

/**
 * 온보딩 스텝 공용 래퍼.
 * 상단 progress bar + 타이틀 + 본문 + 하단 네비.
 * 모바일에서 스크롤 길이 최소화를 위해 p-5 내부 여백 고정.
 */
export const DietOnboardingStep = ({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "다음",
  nextDisabled = false,
  nextPending = false,
  className,
}: DietOnboardingStepProps) => {
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>STEP {stepIndex + 1}</span>
          <span className="number-font text-foreground">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-reward transition-all duration-300"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-1">
        <h2 className="text-display-sm leading-tight text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="space-y-4">{children}</div>

      {/* Nav */}
      <div className="flex items-center gap-2 pt-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-11 rounded-2xl px-4"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            이전
          </Button>
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || nextPending}
          className={cn(
            "ml-auto h-11 flex-1 rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
            "hover:from-primary/95 hover:to-primary/80",
            "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
          )}
        >
          {nextPending ? "처리 중..." : nextLabel}
          {!nextPending && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
    </section>
  );
};

export default DietOnboardingStep;
