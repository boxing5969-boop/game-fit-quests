import { Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface HabitScoreCardProps {
  /** 0~100 */
  habitScore: number;
  /** 21 일 중 승인된 일수 */
  approvedDays: number;
  /** 현재 연속 승인일 */
  streak: number;
  className?: string;
}

/**
 * 오늘의 습관 점수 + 누적 완주율 + 연속일 요약.
 * 체중 숫자는 절대 표시하지 않는다 (절대 규칙 9).
 */
export const HabitScoreCard = ({
  habitScore,
  approvedDays,
  streak,
  className,
}: HabitScoreCardProps) => {
  const completion = Math.round((approvedDays / 21) * 100);
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        "space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            오늘 습관 점수
          </p>
          <p className="mt-0.5 flex items-baseline gap-1">
            <span className="number-font text-2xl font-extrabold text-foreground">
              {habitScore}
            </span>
            <span className="text-[12px] font-bold text-muted-foreground">
              / 100
            </span>
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      {/* Score bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-reward transition-all duration-500"
          style={{ width: `${habitScore}%` }}
          aria-hidden
        />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            21일 완주율
          </p>
          <p className="mt-0.5 number-font text-[15px] font-extrabold text-foreground">
            {completion}
            <span className="text-[11px] font-bold text-muted-foreground">
              %
            </span>
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Flame className="h-3 w-3 text-reward" />
            연속
          </p>
          <p className="mt-0.5 number-font text-[15px] font-extrabold text-foreground">
            {streak}
            <span className="text-[11px] font-bold text-muted-foreground">
              일
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HabitScoreCard;
