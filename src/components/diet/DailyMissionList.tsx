import { CheckCircle2, Circle } from "lucide-react";
import type { DietMissionTemplate } from "@/data/diet/missionTemplates";
import type { DailyHabitsPayload } from "@/services/dietService";
import { cn } from "@/lib/utils";

interface DailyMissionListProps {
  missions: readonly DietMissionTemplate[];
  /** 현재 응답 — linkedHabitColumn 이 있는 미션의 체크 상태 계산에 사용 */
  responses?: DailyHabitsPayload;
  /** 제한 개수 (홈 요약 시 3~5). 미지정 시 전체 표시 */
  limit?: number;
  /** 단순 읽기 전용 카드 모드 (Hub 홈용) */
  compact?: boolean;
  className?: string;
}

/**
 * 오늘의 미션 리스트 — Hub 홈 요약 카드 + Tracker 상단 미니 체크 공통 사용.
 *
 * linkedHabitColumn 이 연결된 미션은 현재 응답 상태에 맞춰 체크 시각화.
 * 연결 안 된 미션은 참고용 bullet.
 */
export const DailyMissionList = ({
  missions,
  responses,
  limit,
  compact = true,
  className,
}: DailyMissionListProps) => {
  const items = typeof limit === "number" ? missions.slice(0, limit) : missions;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((m) => {
        const linked = m.linkedHabitColumn;
        // 수치형 체크 — water_ml 이 threshold 이상이면 자동 체크.
        // linkedHabitColumn 과 독립 — 둘 중 하나만 충족해도 "달성" 으로 본다.
        const waterHit =
          m.waterMlThreshold !== undefined &&
          (responses?.water_ml ?? 0) >= m.waterMlThreshold;
        const habitHit = linked ? responses?.[linked] === true : false;
        const checked = waterHit || habitHit;
        return (
          <li
            key={m.id}
            className={cn(
              "flex items-start gap-2 rounded-xl border bg-card px-3",
              compact ? "py-2" : "py-2.5",
              checked ? "border-primary/40 bg-primary/5" : "border-border",
            )}
          >
            <span className="mt-0.5 shrink-0 text-primary">
              {checked ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-[13px] font-bold",
                  checked ? "text-primary" : "text-foreground",
                )}
              >
                {m.label}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {m.hint}
              </p>
            </div>
            {m.severity === "core" && (
              <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">
                CORE
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default DailyMissionList;
