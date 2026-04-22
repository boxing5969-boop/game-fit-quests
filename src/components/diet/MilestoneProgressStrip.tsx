import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MilestoneProgressStripProps {
  approvedDays: number;
  milestone7Reached: boolean;
  milestone14Reached: boolean;
  milestone21Reached: boolean;
  className?: string;
}

/**
 * 7 / 14 / 21일 배지 진행률 strip.
 * 현재 승인일 기준으로 각 구간의 진행 비율을 시각화.
 */
export const MilestoneProgressStrip = ({
  approvedDays,
  milestone7Reached,
  milestone14Reached,
  milestone21Reached,
  className,
}: MilestoneProgressStripProps) => {
  const segments = [
    {
      label: "7일 리셋",
      target: 7,
      reached: milestone7Reached,
      rangeStart: 0,
    },
    {
      label: "14일 연소",
      target: 14,
      reached: milestone14Reached,
      rangeStart: 7,
    },
    {
      label: "21일 완주",
      target: 21,
      reached: milestone21Reached,
      rangeStart: 14,
    },
  ] as const;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>배지 진행</span>
        <span className="number-font text-foreground">
          {Math.min(approvedDays, 21)} / 21
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {segments.map((s) => {
          const denominator = s.target - s.rangeStart; // 7
          const numerator = Math.max(
            0,
            Math.min(denominator, approvedDays - s.rangeStart),
          );
          const pct = Math.round((numerator / denominator) * 100);
          return (
            <div
              key={s.label}
              className={cn(
                "rounded-xl border px-2.5 py-2",
                s.reached
                  ? "border-reward/50 bg-gradient-to-br from-reward/15 to-reward/5"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-[10.5px] font-black uppercase tracking-wide",
                    s.reached ? "text-reward-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </p>
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
                    s.reached
                      ? "bg-reward text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.reached ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  ) : (
                    <Lock className="h-2.5 w-2.5" />
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    s.reached
                      ? "bg-gradient-to-r from-reward to-primary"
                      : "bg-primary/50",
                  )}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneProgressStrip;
