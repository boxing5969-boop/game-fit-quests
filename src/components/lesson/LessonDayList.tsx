/**
 * 📋 레벨별 일차 목록 — "화이트 리그 · 레벨 1 → 1일차 · 2일차 · 3일차" (2026-09-30 대표님 매뉴얼).
 * 누르면 그날 수업(LessonDaySheet)을 연다. 오늘(다음) 수업은 민트 표시, 지난 수업은 체크.
 */
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  dayStatus,
  levelLong,
  type LessonDay,
  type LessonToday,
} from "@/lib/lessonDays";
import { cn } from "@/lib/utils";

interface Props {
  groups: { level: number; days: LessonDay[] }[];
  today?: LessonToday | null;
  onOpen: (dayNo: number) => void;
}

/** 목록 둘째 줄 — 반복하는 날 / 새로 배우는 동작 / 그날 순서 */
const summaryOf = (d: LessonDay): string => {
  if (d.steps.length === 0 && d.repeatOfDay != null) return `${d.repeatOfDay}일차 수업을 한 번 더`;
  const fresh = d.steps.filter((s) => s.isNew).map((s) => s.name.replace(/\s*\(.*?\)\s*/g, ""));
  if (fresh.length > 0) return `새로 배워요 · ${fresh.join(", ")}`;
  return d.steps
    .filter((s) => s.kind !== "warmup" && s.kind !== "strength")
    .map((s) => s.name)
    .join(" · ");
};

const LessonDayList = ({ groups, today, onOpen }: Props) => (
  <div className="space-y-4">
    {groups.map((g) => (
      <section key={g.level} aria-label={levelLong(g.level)}>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="text-[15px] font-black text-foreground">{levelLong(g.level)}</h3>
          <span className="text-[11.5px] font-bold text-muted-foreground">{g.days.length}일 수업</span>
        </div>
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1">
          {g.days.map((d) => {
            const st = dayStatus(d, today);
            return (
              <li key={d.dayNo}>
                <button
                  type="button"
                  onClick={() => onOpen(d.dayNo)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70",
                    st === "current" && "bg-primary/[0.06]",
                  )}
                >
                  <span
                    className={cn(
                      "w-[52px] shrink-0 text-[15px] font-black tabular-nums",
                      st === "done" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {d.dayNo}일차
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-foreground">{d.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{summaryOf(d)}</span>
                  </span>
                  {st === "current" && today && (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-primary-foreground">
                      {today.attendedToday ? "오늘" : "다음"}
                    </span>
                  )}
                  {st === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-status-complete" aria-label="지난 수업" />}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    ))}
  </div>
);

export default LessonDayList;
