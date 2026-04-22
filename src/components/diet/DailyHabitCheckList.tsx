import { Check } from "lucide-react";
import { DIET_HABITS, type DietHabitKey } from "@/data/dietProgramData";
import type { DailyHabitsPayload } from "@/services/dietService";
import { cn } from "@/lib/utils";

interface DailyHabitCheckListProps {
  value: DailyHabitsPayload;
  onChange: (next: DailyHabitsPayload) => void;
  /** 청소년 트랙일 때 라벨 소폭 조정 (단식/거르기 언어 금지) */
  isYouth?: boolean;
  className?: string;
}

/**
 * 5가지 핵심 습관 체크리스트.
 * linkedHabitColumn 기준으로 한 번 탭 = on/off 토글.
 */
export const DailyHabitCheckList = ({
  value,
  onChange,
  isYouth = false,
  className,
}: DailyHabitCheckListProps) => {
  const toggle = (k: DietHabitKey) => {
    onChange({ ...value, [k]: value[k] === true ? false : true });
  };
  return (
    <ul className={cn("space-y-1.5", className)}>
      {DIET_HABITS.map((h) => {
        const on = value[h.key] === true;
        return (
          <li key={h.key}>
            <button
              type="button"
              onClick={() => toggle(h.key)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.99]",
                on
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
              aria-pressed={on}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13.5px] font-bold",
                    on ? "text-primary" : "text-foreground",
                  )}
                >
                  {h.label}
                </p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                  {isYouth && h.key === "late_night_snack_avoided"
                    ? "밤 간식은 조금만, 식사는 거르지 않기"
                    : h.prompt}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default DailyHabitCheckList;
