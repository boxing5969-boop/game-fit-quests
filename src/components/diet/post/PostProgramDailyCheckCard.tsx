/**
 * 153 다이어트 — 사후 프로그램 일일 체크 카드.
 *
 * 21일 프로그램의 트래커(DietTrackerPage) 를 그대로 쓰지 않고, 사후 프로그램용으로
 * 가벼운 데일리 체크를 제공:
 *   · POST_PROGRAM_DAILY_MAINTENANCE / EXTEND 미션 6개
 *   · 체크박스 토글 → localStorage 일자별 저장 (서버 RPC 없이 동작)
 *   · 점수: questTimingEngine.calcQuestScore 합산
 *   · 오삼 코치 메시지: questMessageEngine — 진행 상황별 동적 분기
 *   · 모두 완료 시 all_done 토스트 1회
 *
 * 보호 함수 미참조: scoreEngine.ts · ruleEngine.ts · mealAnalyzer.ts · missionTemplates.ts.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  POST_PROGRAM_DAILY_EXTEND,
  POST_PROGRAM_DAILY_MAINTENANCE,
} from "@/data/diet/postProgramDailyMissions";
import type { DietMissionTemplate } from "@/data/diet/missionTemplates";
import {
  calcQuestScore,
  gradeTimingBySlot,
  type QuestSlotKey,
  type TimingGrade,
} from "@/lib/diet/questTimingEngine";
import {
  getQuestMessage,
  makeMessageSeed,
  type QuestMessageType,
} from "@/lib/diet/questMessageEngine";

interface PostProgramDailyCheckCardProps {
  /** 'maintenance' = 유지 / 'extend' = 연장 */
  mode: "maintenance" | "extend";
  /** plan id — localStorage 키 분리용 */
  planId: string;
  /** 회원 식별 — 코치 메시지 시드 (선택) */
  userId?: string | null;
}

interface DailyChecks {
  /** mission id → { checked: bool, atIso: string } */
  [missionId: string]: { checked: boolean; atIso: string };
}

const STORAGE_PREFIX = "diet_post_daily_v1";

function todayKstIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function inferSlotForMission(m: DietMissionTemplate): QuestSlotKey {
  if (m.waterMlThreshold !== undefined) return "water";
  if (m.linkedHabitColumn === "gym_attended") return "workout";
  if (m.linkedHabitColumn === "late_night_snack_avoided") return "dinner";
  if (m.linkedHabitColumn === "sugary_drink_avoided") return "water";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  });
  const h = Number(
    fmt.formatToParts(new Date()).find((p) => p.type === "hour")?.value ?? "0",
  );
  const hh = h === 24 ? 0 : h;
  if (hh < 11) return "breakfast";
  if (hh < 17) return "lunch";
  return "dinner";
}

export const PostProgramDailyCheckCard = ({
  mode,
  planId,
  userId,
}: PostProgramDailyCheckCardProps) => {
  const day = todayKstIso();
  const storageKey = `${STORAGE_PREFIX}:${planId}:${day}`;
  const missions =
    mode === "maintenance"
      ? POST_PROGRAM_DAILY_MAINTENANCE
      : POST_PROGRAM_DAILY_EXTEND;

  const [checks, setChecks] = useState<DailyChecks>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as DailyChecks) : {};
    } catch {
      return {};
    }
  });
  const [allDoneToastShown, setAllDoneToastShown] = useState(false);

  // localStorage persist
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checks));
    } catch {
      // best-effort
    }
  }, [storageKey, checks]);

  const handleToggle = (m: DietMissionTemplate) => {
    setChecks((prev) => {
      const cur = prev[m.id]?.checked === true;
      return {
        ...prev,
        [m.id]: { checked: !cur, atIso: new Date().toISOString() },
      };
    });
  };

  // 진행률 / 점수 / 오삼 코치 메시지
  const summary = useMemo(() => {
    let completed = 0;
    let perfect = 0;
    let score = 0;
    for (const m of missions) {
      const entry = checks[m.id];
      if (!entry?.checked) continue;
      completed += 1;
      const at = entry.atIso ? new Date(entry.atIso) : new Date();
      const slot = inferSlotForMission(m);
      const grade: TimingGrade = gradeTimingBySlot(slot, at);
      if (grade === "perfect") perfect += 1;
      const s = calcQuestScore({
        isCore: m.severity === "core",
        timingGrade: grade,
      });
      score += s.total;
    }
    const total = missions.length;
    return {
      total,
      completed,
      perfect,
      score,
      allDone: total > 0 && completed === total,
    };
  }, [checks, missions]);

  const messageType: QuestMessageType = (() => {
    if (summary.total === 0) return "morning_start";
    if (summary.allDone) return "all_done";
    if (summary.completed === 0) return "morning_start";
    if (summary.completed === summary.total - 1) return "almost_done";
    return "incomplete_nudge";
  })();
  const coachMessage = useMemo(() => {
    const seed = makeMessageSeed(userId ?? null, messageType);
    return getQuestMessage({
      type: messageType,
      remainingCount: Math.max(0, summary.total - summary.completed),
      todayScore: summary.score,
      seed,
    });
  }, [userId, messageType, summary]);

  // 모두 완료 시 토스트 1회
  useEffect(() => {
    if (summary.allDone && !allDoneToastShown) {
      const seed = makeMessageSeed(userId ?? null, "all_done");
      const msg = getQuestMessage({
        type: "all_done",
        todayScore: summary.score,
        seed,
      });
      toast.success(`🏆 ${msg}`);
      setAllDoneToastShown(true);
    }
    if (!summary.allDone) setAllDoneToastShown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.allDone]);

  const accentClass =
    mode === "maintenance" ? "text-emerald-600" : "text-primary";
  const barClass =
    mode === "maintenance"
      ? summary.allDone
        ? "bg-emerald-500"
        : "bg-emerald-400"
      : summary.allDone
        ? "bg-emerald-500"
        : "bg-primary";

  return (
    <section
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        summary.allDone
          ? "border-emerald-400/50 bg-emerald-400/10"
          : mode === "maintenance"
            ? "border-emerald-400/30 bg-card"
            : "border-primary/30 bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-[0.2em]",
            summary.allDone ? "text-emerald-600" : accentClass,
          )}
        >
          오늘의 미션 · {mode === "maintenance" ? "유지" : "연장"}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
            summary.allDone
              ? "bg-emerald-400/20 text-emerald-700"
              : mode === "maintenance"
                ? "bg-emerald-400/15 text-emerald-700"
                : "bg-primary/10 text-primary",
          )}
        >
          {summary.completed}/{summary.total} 완료
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barClass)}
          style={{
            width: `${summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%`,
          }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {missions.map((m) => {
          const entry = checks[m.id];
          const checked = entry?.checked === true;
          const at = entry?.atIso ? new Date(entry.atIso) : null;
          const slot = inferSlotForMission(m);
          const grade: TimingGrade = at
            ? gradeTimingBySlot(slot, at)
            : "perfect";
          const isPerfect = checked && grade === "perfect";
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => handleToggle(m)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
                  !checked && "border-border",
                  checked && !isPerfect && "border-primary/40 bg-primary/5",
                  isPerfect && "border-emerald-400/50 bg-emerald-400/10",
                )}
                aria-pressed={checked}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0",
                    isPerfect
                      ? "text-emerald-500"
                      : checked
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {checked ? (
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
                      !isPerfect && checked && "text-primary",
                      !checked && "text-foreground",
                    )}
                  >
                    {m.label}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {m.hint}
                  </p>
                </div>
                {isPerfect && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-600">
                    <Sparkles className="h-2.5 w-2.5" />
                    Perfect
                  </span>
                )}
                {m.severity === "core" && (
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">
                    CORE
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p
          className={cn(
            "text-[12px] leading-relaxed",
            summary.allDone ? "text-emerald-700 font-bold" : "text-foreground",
          )}
        >
          <Sparkles className="mr-1 inline h-3 w-3 align-[-2px] text-primary" />
          {coachMessage}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-lg px-2 py-1 text-[12px] font-extrabold",
            summary.allDone
              ? "bg-emerald-500/15 text-emerald-700"
              : "bg-card text-foreground",
          )}
        >
          {summary.score}점
        </span>
      </div>
    </section>
  );
};

export default PostProgramDailyCheckCard;
