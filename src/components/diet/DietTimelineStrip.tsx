import { DIET_STAGES } from "@/data/dietProgramData";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type LogStatus = Database["public"]["Enums"]["diet_log_status"];

interface DietTimelineStripProps {
  /** 현재 day_number (1~21) */
  currentDay: number;
  /** day_number → status 맵 (로그가 있는 날만). 없는 키는 "empty" 로 간주 */
  statusByDay: Partial<Record<number, LogStatus>>;
  className?: string;
}

/**
 * 21-day timeline strip — 각 스테이지 라벨 + 도트 그리드.
 *   • approved: 진한 primary 채움
 *   • pending/revision_requested: primary/40 링
 *   • rejected: destructive 링
 *   • 로그 없음: muted 도트
 *   • currentDay: outline 강조
 */
export const DietTimelineStrip = ({
  currentDay,
  statusByDay,
  className,
}: DietTimelineStripProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>21일 타임라인</span>
        <span className="number-font text-foreground">DAY {currentDay} / 21</span>
      </div>
      <div className="space-y-3">
        {DIET_STAGES.map((stage) => {
          const days: number[] = [];
          for (let d = stage.dayRange[0]; d <= stage.dayRange[1]; d++) days.push(d);
          return (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wide">
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-primary">
                  {stage.label}
                </span>
                <span className="text-muted-foreground">
                  Day {stage.dayRange[0]}~{stage.dayRange[1]}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {days.map((d) => {
                  const st = statusByDay[d];
                  const isCurrent = d === currentDay;
                  return (
                    <DayDot
                      key={d}
                      day={d}
                      status={st}
                      isCurrent={isCurrent}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DayDot = ({
  day,
  status,
  isCurrent,
}: {
  day: number;
  status: LogStatus | undefined;
  isCurrent: boolean;
}) => {
  const base =
    "flex h-7 flex-1 items-center justify-center rounded-md text-[10px] font-bold";
  if (status === "approved") {
    return (
      <span
        className={cn(
          base,
          "bg-gradient-to-br from-primary to-reward text-primary-foreground shadow-[0_0_8px_rgba(246,196,83,0.35)]",
          isCurrent && "ring-2 ring-foreground",
        )}
      >
        {day}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span
        className={cn(
          base,
          "border border-destructive bg-destructive/10 text-destructive",
          isCurrent && "ring-2 ring-foreground",
        )}
      >
        {day}
      </span>
    );
  }
  if (status === "pending" || status === "revision_requested") {
    return (
      <span
        className={cn(
          base,
          "border border-primary/50 bg-primary/5 text-primary",
          isCurrent && "ring-2 ring-foreground",
        )}
      >
        {day}
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        "border border-border bg-muted text-muted-foreground",
        isCurrent && "ring-2 ring-primary",
      )}
    >
      {day}
    </span>
  );
};

export default DietTimelineStrip;
