/**
 * 📅 운동 달력 카드 (2026-11-12 선릉역점 봄 회원 제안 → 대표님 「추천대로 진행하자」)
 *   보고서 https://claude.ai/artifact/4s6m5nxaghb8Hpqxpx79Rn 1단계 — 출석한 날에 도장, 기본은 이번 주 한 줄, 펼치면 한 달.
 *   · 홈 첫 화면 '운동 달력'(components/home/HomeWorkoutCalendar — 홈 꾸미기 '첫 화면'에서 끄기)과
 *     '내 운동 기록'의 '이번 주' 카드(AttendanceHistoryPanel WeekCard)가 이 조각 하나를 같이 쓴다.
 *   · 숫자는 서버 get_attendance_history 한 곳(useAttendanceHistory — 홈 '내 운동' · 내 운동 기록과 같은 캐시). DB 변경 없음.
 *   · 대표님 규칙을 따른다: 출석 '횟수'를 주인공 숫자로 두지 않는다(10-22 「몇 번 말고 몇 시간」) — 도장 줄이 주인공이고
 *     칩은 잘한 것(n주 연속 · 이번 주 n번)만 · 빠진 날 표시는 없다 · 카드 맨 아래 한 줄 단추(h-14 border-t).
 *   · 날짜를 누르면(출석한 날만) 그날 들어온 시각 · 운동 시간 한 줄.
 *   · 감정 설계판 (2026-11-12 대표님 「달력 기능도 목표는 회원님들의 감정을 설계하는 거야」 — CLAUDE.md 「회원 감정 설계 기준」):
 *     기념일 = 금색 도장(첫 도장 · 출석 축하를 채운 날) · 고른 날 아래 '그날의 의미' 한 줄(다시 시작한 날 · 가장 길게 운동한 날) ·
 *     지난 달을 넘겨 보면 '10월 · 14시간 12분 운동했어요' · 새 달 첫 7일엔 지난달 한 줄(recap — 홈만).
 *     '이번 주 n번 왔어요' 칩은 뺐다 — 도장 줄이 이미 말하고, 숫자는 횟수보다 시간(10-22). 계산은 lib/calendarMoments.ts.
 *   · 다음 단계가 이 칸에 얹힌다: 2단계 운동 약속(약속한 날 테두리) · 3단계 오늘의 체크(다 채운 날 금색 별).
 *   날짜 계산은 lib/attendanceCalendar.ts (주는 월요일 시작).
 */
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  WEEKDAY_KO,
  dayLabel,
  durationLabel,
  kstTime,
  monthLabel,
  type AttendanceDay,
  type AttendanceHistory,
} from "@/lib/attendanceHistory";
import { attendanceByDay, monthBounds, monthOf, monthWeeks, shiftMonth, weekOf } from "@/lib/attendanceCalendar";
import { kstToday } from "@/lib/attendanceCheer";
import { dayMoments, freshStartLine, monthRecap, type DayMoment } from "@/lib/calendarMoments";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");

/** 펼침 기억 — 기기마다 (기기 저장이 막혀도 화면은 그대로) */
const readOpen = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeOpen = (key: string, open: boolean) => {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* 저장이 막힌 기기 — 이번 화면에서만 기억 */
  }
};

interface CellProps {
  day: string;
  on: boolean;
  today: string;
  faint?: boolean;
  /** 기념일 — 금색 도장 */
  moment?: DayMoment;
  picked: boolean;
  onPick: (day: string) => void;
}

/** 날짜 한 칸 — 출석한 날 = 민트 도장(누르면 그날 한 줄) · 기념일 = 금색 도장 · 오늘 = 테두리 · 앞뒤 달 = 흐리게 */
const DayCell = ({ day, on, today, faint = false, moment, picked, onPick }: CellProps) => {
  const isToday = day === today;
  const num = Number(day.slice(8));
  const base = "flex h-10 w-10 items-center justify-center rounded-full text-label tabular-nums";
  const gold = on && !!moment?.gold;
  const label = `${dayLabel(day)}${on ? " 출석" : ""}${on && moment ? ` · ${moment.text}` : ""}${isToday ? " · 오늘" : ""}`;
  if (faint) {
    return (
      <span className={cn(base, "text-muted-foreground/40")} aria-hidden>
        {num}
      </span>
    );
  }
  if (!on) {
    return (
      <span
        className={cn(
          base,
          isToday ? "font-bold text-foreground ring-2 ring-primary/60" : day > today ? "text-muted-foreground/60" : "text-foreground",
        )}
        aria-label={label}
      >
        {num}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPick(day)}
      aria-pressed={picked}
      aria-label={label}
      className={cn(
        base,
        "font-extrabold transition-transform active:scale-95",
        gold ? "bg-reward text-reward-foreground" : "bg-primary text-primary-foreground",
        picked && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      {num}
    </button>
  );
};

/** 고른 날 — 들어온 시각 · 운동 시간 + 그날의 의미 한 줄(있을 때만) */
const DayLine = ({ d, moment }: { d: AttendanceDay; moment?: DayMoment }) => (
  <div className="mt-3 rounded-xl bg-muted/60 px-4 py-3">
    <p className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-body font-bold tabular-nums text-foreground">
        {dayLabel(d.day)} <span className="text-label font-medium text-muted-foreground">{kstTime(d.at)} 들어옴</span>
      </span>
      <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{durationLabel(d.minutes)}</span>
    </p>
    {moment && (
      <p className={cn("mt-1 flex items-center gap-1 text-label font-bold", moment.gold ? "text-reward" : "text-primary")}>
        <Star className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden />
        {moment.text}
      </p>
    )}
  </div>
);

export interface WorkoutCalendarCardProps {
  data: AttendanceHistory;
  /** 접혔을 때 제목 */
  title: string;
  /** 펼쳤을 때 제목 (없으면 title) */
  openTitle?: string;
  /** 펼침 기억 키 — '153cal:' 로 시작 (화면마다 따로) */
  storageKey: string;
  /** 접혔을 때 카드 안 맨 아래 — '내 운동 기록'의 응원 한 줄 */
  footer?: ReactNode;
  /** 제목 바로 아래(접힘 · 펼침 모두) — 첫 4주 8번 칸(StarterProgress, 2026-11-12 동기부여 1단계) */
  header?: ReactNode;
  /** 새 달 첫 7일에 지난달 한 줄을 보여 주나 — 홈만 (내 운동 기록에는 월별 그래프가 있다) */
  recap?: boolean;
}

const WorkoutCalendarCard = ({ data, title, openTitle, storageKey, footer, header, recap = false }: WorkoutCalendarCardProps) => {
  const today = kstToday();
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const [month, setMonth] = useState(() => monthOf(today));
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => attendanceByDay(data.list), [data.list]);
  const moments = useMemo(() => dayMoments(data, today), [data, today]);
  const bounds = monthBounds(data.firstDay, today);
  const week = weekOf(today);
  const weekCount = week.filter((d) => byDay.has(d)).length;
  const pickedDay = picked ? byDay.get(picked) ?? null : null;
  // 지난 달을 넘겨 보면 그 달 한 줄 · 새 달 첫 7일엔 지난달 한 줄 (이번 달 숫자는 홈 '내 운동'이 주인공 — 다시 쓰지 않는다)
  const pastRecap = open && month < monthOf(today) ? monthRecap(data, month) : null;
  const freshLine = recap && !pastRecap ? freshStartLine(data, today) : null;
  const heading = open ? openTitle ?? title : title;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeOpen(storageKey, next);
    setMonth(monthOf(today));
    setPicked(null);
  };
  const goMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    if (next < bounds.min || next > bounds.max) return;
    setMonth(next);
    setPicked(null);
  };
  const pick = (day: string) => setPicked((p) => (p === day ? null : day));

  return (
    <section aria-label={heading} className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-heading text-foreground">{heading}</h3>
          {data.weekStreak >= 2 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">{n(data.weekStreak)}주 연속</span>
          )}
        </div>

        {header}

        {open ? (
          <div className="mt-3">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                disabled={month <= bounds.min}
                aria-label="지난달"
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="min-w-[8rem] text-center text-body font-bold tabular-nums text-foreground">{monthLabel(month)}</span>
              <button
                type="button"
                onClick={() => goMonth(1)}
                disabled={month >= bounds.max}
                aria-label="다음 달"
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-y-1" role="group" aria-label={`${monthLabel(month)} 출석 달력`}>
              {WEEKDAY_KO.map((w) => (
                <span key={w} className="pb-1 text-center text-micro text-muted-foreground">
                  {w}
                </span>
              ))}
              {monthWeeks(month)
                .flat()
                .map((c) => (
                  <span key={c.day} className="flex justify-center">
                    <DayCell
                      day={c.day}
                      on={c.inMonth && byDay.has(c.day)}
                      today={today}
                      faint={!c.inMonth}
                      moment={moments.get(c.day)}
                      picked={picked === c.day}
                      onPick={pick}
                    />
                  </span>
                ))}
            </div>
          </div>
        ) : (
          <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={`이번 주 ${weekCount}번 출석`}>
            {week.map((d, i) => (
              <li key={d} className="flex flex-col items-center gap-1.5">
                <span className={cn("text-micro", d === today ? "font-black text-foreground" : "text-muted-foreground")}>{WEEKDAY_KO[i]}</span>
                <DayCell day={d} on={byDay.has(d)} today={today} moment={moments.get(d)} picked={picked === d} onPick={pick} />
              </li>
            ))}
          </ol>
        )}

        {pickedDay && <DayLine d={pickedDay} moment={moments.get(pickedDay.day)} />}
        {pastRecap && (
          <p className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-3">
            <span className="text-label font-bold tabular-nums text-foreground">{pastRecap.text}</span>
            {pastRecap.gain && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-micro font-bold tabular-nums text-primary">{pastRecap.gain}</span>
            )}
          </p>
        )}
        {freshLine && <p className="mt-3 border-t border-border pt-3 text-label font-bold tabular-nums text-foreground">{freshLine}</p>}
        {!open && footer}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex h-14 w-full items-center justify-center gap-1 border-t border-border text-body font-bold text-foreground active:bg-muted/50"
      >
        {open ? "달력 접기" : "달력 펼치기"}
        <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </section>
  );
};

export default WorkoutCalendarCard;
