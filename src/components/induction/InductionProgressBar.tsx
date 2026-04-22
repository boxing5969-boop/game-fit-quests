import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface InductionProgressBarProps {
  /** 1-based. 현재 표시 중인 step. */
  currentStepOrder: number;
  /** 완료된 step 수 (0..total). */
  stepsCompleted: number;
  totalSteps: number;
  className?: string;
}

/**
 * "N/5" 세그먼트 진행 바 — 스포츠 RPG 라운드 게이지 느낌.
 *
 * 각 세그먼트는 3-state:
 *   • completed — primary→reward 그라디언트 + 체크 링
 *   • current   — 하단 glow + subtle shimmer
 *   • upcoming  — muted 슬래시
 *
 * 폭은 flex-1 로 5분할 고정이라 뷰포트와 관계없이 한 줄 유지.
 */
export const InductionProgressBar = ({
  currentStepOrder,
  stepsCompleted,
  totalSteps,
  className,
}: InductionProgressBarProps) => {
  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span>ROUND</span>
        <span className="number-font text-foreground">
          {Math.min(stepsCompleted, totalSteps).toString().padStart(2, "0")}
          <span className="mx-1 text-muted-foreground">/</span>
          {totalSteps.toString().padStart(2, "0")}
        </span>
      </div>

      <div
        className="flex items-center gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={stepsCompleted}
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const order = i + 1;
          const isCompleted = order <= stepsCompleted;
          const isCurrent = order === currentStepOrder && !isCompleted;
          return (
            <div key={order} className="relative flex-1 pt-2.5">
              {/* Bar */}
              <div
                className={cn(
                  "h-2 w-full rounded-full transition-all duration-300",
                  isCompleted &&
                    "bg-gradient-to-r from-primary via-primary to-reward shadow-[0_0_10px_rgba(246,196,83,0.35)]",
                  isCurrent &&
                    "bg-primary/45 shadow-[0_0_10px_rgba(217,54,32,0.3)] overflow-hidden",
                  !isCompleted && !isCurrent && "bg-muted",
                )}
              >
                {/* Current segment shimmer */}
                {isCurrent && (
                  <span
                    className="absolute inset-y-0 left-0 w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent"
                    aria-hidden
                  />
                )}
              </div>

              {/* Completed ring */}
              {isCompleted && (
                <span
                  className={cn(
                    "absolute -top-0.5 right-0 flex h-4 w-4 items-center justify-center",
                    "rounded-full bg-gradient-to-br from-primary to-reward",
                    "text-primary-foreground shadow-[0_0_8px_rgba(246,196,83,0.55)]",
                    "animate-bounce-in",
                  )}
                  aria-hidden
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              )}

              {/* Current dot */}
              {isCurrent && (
                <span
                  className={cn(
                    "absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full",
                    "bg-primary shadow-[0_0_10px_rgba(217,54,32,0.7)]",
                    "ring-2 ring-primary/40 animate-pulse",
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InductionProgressBar;
