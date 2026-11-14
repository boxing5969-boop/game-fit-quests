/**
 * 🗓 운동 달력 '한 해' 보기 — 한 해 도장 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5)
 *   달마다 운동 시간 + 온 날 민트 점만 — 빈 칸 회색 없음(감정 설계: 안 온 날은 그리지 않는다) · 리그 테마면 점도 리그 색.
 *   달을 누르면 그 달 달력으로. 자료는 출석 기록(get_attendance_history) 그대로 — 서버를 더 부르지 않는다.
 *   WorkoutCalendar 가 '한 해'를 고를 때만 받는 조각.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { AttendanceDay } from "@/lib/attendanceHistory";
import { monthWeeks } from "@/lib/attendanceCalendar";
import { monthMinutesLabel, yearBounds, yearLine, yearMonths } from "@/lib/calendarViews";
import { cn } from "@/lib/utils";

export interface CalendarYearViewProps {
  year: number;
  list: readonly AttendanceDay[];
  firstDay: string | null;
  today: string;
  /** 리그 테마 도장 색 (없으면 민트) */
  stampHex?: string | null;
  onYear: (y: number) => void;
  onPickMonth: (ym: string) => void;
}

const CalendarYearView = ({ year, list, firstDay, today, stampHex = null, onYear, onPickMonth }: CalendarYearViewProps) => {
  const bounds = yearBounds(firstDay, today);
  const months = yearMonths(year, list);
  const line = yearLine(months);
  const thisMonth = today.slice(0, 7);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onYear(year - 1)}
          disabled={year <= bounds.min}
          aria-label="지난해"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="min-w-[6rem] text-center text-body font-bold tabular-nums text-foreground">{year}년</span>
        <button
          type="button"
          onClick={() => onYear(year + 1)}
          disabled={year >= bounds.max}
          aria-label="다음 해"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {line && <p className="mt-1 text-center text-label font-bold text-primary">{line}</p>}
      <ol className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4" aria-label={`${year}년 한 해 도장`}>
        {months.map((m) => {
          const label = monthMinutesLabel(m);
          const future = m.ym > thisMonth;
          return (
            <li key={m.ym}>
              <button
                type="button"
                onClick={() => onPickMonth(m.ym)}
                disabled={future}
                aria-label={`${Number(m.ym.slice(5))}월${label ? ` · ${label}` : ""} · 이 달 달력 보기`}
                className="w-full rounded-xl p-1.5 text-left active:bg-muted/60 disabled:active:bg-transparent"
              >
                <span className={cn("block text-label font-bold", m.ym === thisMonth ? "text-primary" : "text-foreground")}>{Number(m.ym.slice(5))}월</span>
                <span className="block h-5 truncate text-micro tabular-nums text-muted-foreground">{label ?? ""}</span>
                <span className="mt-1 grid grid-cols-7 gap-[3px]" aria-hidden>
                  {monthWeeks(m.ym)
                    .flat()
                    .map((c) => (
                      <span key={c.day} className="flex h-2.5 items-center justify-center">
                        {c.inMonth && m.days.has(c.day) && (
                          <span className={cn("h-2 w-2 rounded-full", !stampHex && "bg-primary")} style={stampHex ? { backgroundColor: stampHex } : undefined} />
                        )}
                      </span>
                    ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default CalendarYearView;
