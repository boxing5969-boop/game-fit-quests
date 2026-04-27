import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import type { DietMissionTemplate } from "@/data/diet/missionTemplates";
import type { DailyHabitsPayload } from "@/services/dietService";
import {
  gradeTimingBySlot,
  type QuestSlotKey,
} from "@/lib/diet/questTimingEngine";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────
// 미션 상태 — pending(미완) / completed(달성, 일반 타이밍) /
// perfect_completed(달성 + perfect 타이밍)
// ──────────────────────────────────────────────────────────────────
export type MissionStatus = "pending" | "completed" | "perfect_completed";

interface DailyMissionListProps {
  missions: readonly DietMissionTemplate[];
  /** 현재 응답 — linkedHabitColumn 이 있는 미션의 체크 상태 계산에 사용 */
  responses?: DailyHabitsPayload;
  /** 제한 개수 (홈 요약 시 3~5). 미지정 시 전체 표시 */
  limit?: number;
  /** 단순 읽기 전용 카드 모드 (Hub 홈용) */
  compact?: boolean;
  className?: string;
  /**
   * 선택: 미션별 완료 시각 맵. 있으면 그 시점 기준으로 timing grade 산출.
   *   미지정 시 "지금" 기준으로 perfect 여부 판정.
   *   호출부에서 diet_quest_events 조회 결과를 mission_id → completed_at 으로 변환해 전달 가능.
   */
  completedAtMap?: Readonly<Record<string, Date | string>>;
  /**
   * 선택: 상단 진행률 바 노출 여부. 기본 false (Hub 요약에선 숨김).
   *   true 일 때 "오늘 N/M 완료" 텍스트 + bar 표시.
   */
  showProgress?: boolean;
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────

/** 미션 종류 → questTimingEngine 슬롯 매핑. 정확한 매칭이 없으면 현재 시간대 기반으로 추정. */
function inferSlotForMission(m: DietMissionTemplate): QuestSlotKey {
  if (m.waterMlThreshold !== undefined) return "water";
  if (m.linkedHabitColumn === "gym_attended") return "workout";
  if (m.linkedHabitColumn === "late_night_snack_avoided") return "dinner";
  if (m.linkedHabitColumn === "sugary_drink_avoided") return "water";
  // protein_first / veggies_natural 등 — 현재 시각 기준 식사 슬롯 추정 (KST)
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  });
  const h = Number(fmt.formatToParts(new Date()).find((p) => p.type === "hour")?.value ?? "0");
  const hh = h === 24 ? 0 : h;
  if (hh < 11) return "breakfast";
  if (hh < 17) return "lunch";
  return "dinner";
}

/** 응답 + 옵션 timestamp 로 status 결정. 기존 완료 판단 로직(linked || waterHit) 유지. */
function computeMissionStatus(
  m: DietMissionTemplate,
  responses: DailyHabitsPayload | undefined,
  completedAtMap?: Readonly<Record<string, Date | string>>,
): MissionStatus {
  const linked = m.linkedHabitColumn;
  const waterHit =
    m.waterMlThreshold !== undefined &&
    (responses?.water_ml ?? 0) >= m.waterMlThreshold;
  const habitHit = linked ? responses?.[linked] === true : false;
  const checked = waterHit || habitHit;
  if (!checked) return "pending";

  // 완료된 미션 — perfect 여부 판정
  const rawAt = completedAtMap?.[m.id];
  const completedAt =
    rawAt instanceof Date
      ? rawAt
      : typeof rawAt === "string"
        ? new Date(rawAt)
        : new Date();
  const slot = inferSlotForMission(m);
  const grade = gradeTimingBySlot(slot, completedAt);
  return grade === "perfect" ? "perfect_completed" : "completed";
}

// ──────────────────────────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────────────────────────

/**
 * 오늘의 미션 리스트 — Hub 홈 요약 카드 + Tracker 상단 미니 체크 공통 사용.
 *
 * 상태 3종:
 *   · pending           : 미완 (회색)
 *   · completed         : 달성 (primary)
 *   · perfect_completed : 정시 달성 (mint/emerald + Perfect 뱃지)
 *
 * 기존 props 동일 — completedAtMap / showProgress 만 옵션 추가.
 */
export const DailyMissionList = ({
  missions,
  responses,
  limit,
  compact = true,
  className,
  completedAtMap,
  showProgress = false,
}: DailyMissionListProps) => {
  const items = typeof limit === "number" ? missions.slice(0, limit) : missions;

  // 진행률 — 표시되는 items 기준 (limit 적용 후)
  const completedCount = items.reduce(
    (acc, m) =>
      computeMissionStatus(m, responses, completedAtMap) === "pending"
        ? acc
        : acc + 1,
    0,
  );
  const totalCount = items.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {showProgress && totalCount > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-muted-foreground">오늘 진행률</span>
            <span className="text-foreground">
              {completedCount}/{totalCount} 완료
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((m) => {
          const status = computeMissionStatus(m, responses, completedAtMap);
          const isPerfect = status === "perfect_completed";
          const isCompleted = status === "completed" || isPerfect;
          return (
            <li
              key={m.id}
              className={cn(
                "flex items-start gap-2 rounded-xl border bg-card px-3",
                compact ? "py-2" : "py-2.5",
                status === "pending" && "border-border",
                status === "completed" && "border-primary/40 bg-primary/5",
                isPerfect && "border-emerald-400/50 bg-emerald-400/10",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0",
                  isPerfect
                    ? "text-emerald-500"
                    : isCompleted
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[13px] font-bold",
                    isPerfect && "text-emerald-600",
                    !isPerfect && isCompleted && "text-primary",
                    !isCompleted && "text-foreground",
                  )}
                >
                  {m.label}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {m.hint}
                </p>
              </div>
              {isPerfect && (
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center gap-0.5 rounded-md",
                    "bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-600",
                  )}
                  aria-label="perfect timing"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Perfect
                </span>
              )}
              {m.severity === "core" && (
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">
                  CORE
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DailyMissionList;
