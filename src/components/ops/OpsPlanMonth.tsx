/**
 * 153운영본부 · 「일정」 탭 — 한 달 달력 조각
 *   (2026-11-12 대표님 「운동 달력처럼 운영탭에 스케줄관리도 달력처럼 스케줄 한눈에 보고 관리할수있도록」)
 *   · 회원 '운동 달력'(components/attendance/WorkoutCalendar)과 같은 모양 — 월요일 시작 · 오늘 = 민트 테두리 ·
 *     고른 날 = 검은 동그라미 · 앞뒤 달 칸 = 흐리게
 *   · 칸마다 색 점(일정 종류 — 휴무 · 외부 · 수업 · PT · 업무 · 개인 · 근무 시간) 4개까지, 넘으면 3개 + 회색 점.
 *     팀 달력은 근무 시간을 뺀다(평일마다 있어서) — 그날 누가 일하는지는 아래 '고른 날' 카드(OpsPlanTab TeamDayCard)
 *   · 날짜를 누르면 아래 카드가 그날로 — 넣기 · 고치기는 주 보기와 같은 시트(OpsPlanSheet)
 *   표시 계산은 src/lib/opsPlans.ts(dayMarks · presentMarks · monthMondays), 자료는 useOpsPlansMonth(주마다 받아 합침).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shiftMonth } from "@/lib/attendanceCalendar";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import {
  MARK_META,
  WEEK_MON_FIRST,
  addDays,
  marksLine,
  monthMondays,
  planDay,
  planMonthLabel,
  type DayMark,
  type MarkKey,
} from "@/lib/opsPlans";
import { cn } from "@/lib/utils";

/** 달 고르기 — 이름을 누르면 이번 달로 */
export const MonthSwitcher = ({
  ym,
  thisMonth,
  min,
  max,
  today,
  onChange,
}: {
  ym: string;
  thisMonth: string;
  min: string;
  max: string;
  today: string;
  onChange: (ym: string) => void;
}) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={() => onChange(shiftMonth(ym, -1))}
      disabled={ym <= min}
      aria-label="지난달"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95 disabled:opacity-30"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={() => onChange(thisMonth)}
      aria-label={ym === thisMonth ? `이번 달 · ${planMonthLabel(ym, today)}` : `${planMonthLabel(ym, today)} — 이번 달로 돌아가기`}
      className="min-w-[8.5rem] text-center text-body font-black tabular-nums text-foreground"
    >
      {planMonthLabel(ym, today)}
    </button>
    <button
      type="button"
      onClick={() => onChange(shiftMonth(ym, 1))}
      disabled={ym >= max}
      aria-label="다음 달"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95 disabled:opacity-30"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

const MAX_DOTS = 4;

/** 날짜 한 칸 — 숫자 + 색 점 */
const MonthCell = ({
  day,
  inMonth,
  marks,
  selected,
  today,
  team,
  onPick,
}: {
  day: string;
  inMonth: boolean;
  marks: readonly DayMark[];
  selected: boolean;
  today: string;
  team: boolean;
  onPick: (day: string) => void;
}) => {
  const isToday = day === today;
  const wd = weekdayOf(day);
  const shown = marks.length > MAX_DOTS ? marks.slice(0, MAX_DOTS - 1) : marks;
  const more = marks.length > shown.length;
  return (
    <button
      type="button"
      onClick={() => onPick(day)}
      aria-pressed={selected}
      aria-label={`${planDay(day)}${isToday ? " · 오늘" : ""} — ${marks.length ? marksLine(marks, team) : "일정 없음"}`}
      className={cn(
        "flex h-12 flex-col items-center gap-1 rounded-xl pt-0.5 transition-transform active:scale-95",
        !inMonth && "opacity-40",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-label font-black tabular-nums",
          selected
            ? "bg-foreground text-background"
            : isToday
              ? "text-primary ring-2 ring-primary/60"
              : wd === 0
                ? "text-muted-foreground"
                : "text-foreground",
        )}
      >
        {Number(day.slice(8, 10))}
      </span>
      <span className="flex h-2 items-center gap-[3px]" aria-hidden>
        {shown.map((m) => (
          <span key={m.key} className={cn("h-2 w-2 rounded-full", m.dot)} />
        ))}
        {more && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
      </span>
    </button>
  );
};

/** 한 달 — 요일 줄 + 날짜 칸(4~6줄) */
export const PlanMonthGrid = ({
  ym,
  marks,
  selected,
  today,
  team,
  onPick,
}: {
  ym: string;
  /** 날짜 → 그날 표시 (dayMarks) */
  marks: ReadonlyMap<string, readonly DayMark[]>;
  selected: string;
  today: string;
  /** 팀 달력이면 읽어 주기에 'n명' */
  team: boolean;
  onPick: (day: string) => void;
}) => {
  const days = monthMondays(ym).flatMap((mon) => Array.from({ length: 7 }, (_, i) => addDays(mon, i)));
  return (
    <div className="mt-3" role="group" aria-label={`${planMonthLabel(ym, today)} 일정 달력`}>
      <div className="grid grid-cols-7" aria-hidden>
        {WEEK_MON_FIRST.map((wd) => (
          <span key={wd} className="pb-1 text-center text-micro font-bold text-muted-foreground">
            {OPS_WEEKDAY[wd]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => (
          <MonthCell
            key={d}
            day={d}
            inMonth={d.startsWith(`${ym}-`)}
            marks={marks.get(d) ?? []}
            selected={d === selected}
            today={today}
            team={team}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
};

/** 색 이름표 — 그 달에 쓰인 것만 (하나도 없으면 empty 한 줄) */
export const MarkLegend = ({ keys, empty }: { keys: readonly MarkKey[]; empty: string }) =>
  keys.length === 0 ? (
    <p className="mt-3 text-label text-muted-foreground">{empty}</p>
  ) : (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1 text-micro text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", MARK_META[k].dot)} aria-hidden />
          {MARK_META[k].label}
        </span>
      ))}
    </div>
  );
