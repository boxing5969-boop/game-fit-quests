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
 *   · 운동 약속 (2026-11-12 대표님 「추천하는대로 진행할게」 · withPromise — 내 기록에서만): 약속한 날(오늘 · 앞으로)은 점선 테두리 →
 *     출석하면 그대로 민트 도장 · 놓친 약속은 표시하지 않는다 · 카드 안 한 줄(잘한 것 · 다음 약속) + 걸기 · 고치기 시트(PromiseSheet).
 *     계산 · 글은 lib/promise153.ts, 자료는 services/promiseService.ts(켠 지점 회원이 아니면 아무것도 안 그림).
 *   · 다음 단계: 오늘의 체크(다 채운 날 금색 별).
 *   날짜 계산은 lib/attendanceCalendar.ts (주는 월요일 시작).
 */
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Handshake, Star } from "lucide-react";
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
import { isPromisedDay, promiseSentence, promiseStatus, type Promise153 } from "@/lib/promise153";
import { useMyPromise } from "@/services/promiseService";
import PromiseSheet from "@/components/attendance/PromiseSheet";
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
  /** 약속한 날(오늘 · 앞으로, 아직 안 온 날) — 점선 테두리 */
  promised?: boolean;
  picked: boolean;
  onPick: (day: string) => void;
}

/** 날짜 한 칸 — 출석한 날 = 민트 도장(누르면 그날 한 줄) · 기념일 = 금색 도장 · 오늘 = 테두리 · 앞뒤 달 = 흐리게 */
const DayCell = ({ day, on, today, faint = false, moment, promised = false, picked, onPick }: CellProps) => {
  const isToday = day === today;
  const num = Number(day.slice(8));
  const base = "flex h-10 w-10 items-center justify-center rounded-full text-label tabular-nums";
  const gold = on && !!moment?.gold;
  const label = `${dayLabel(day)}${on ? " 출석" : ""}${on && moment ? ` · ${moment.text}` : ""}${!on && promised ? " · 약속한 날" : ""}${isToday ? " · 오늘" : ""}`;
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
          promised && day >= today
            ? "border-2 border-dashed border-primary font-bold text-primary"
            : isToday
              ? "font-bold text-foreground ring-2 ring-primary/60"
              : day > today
                ? "text-muted-foreground/60"
                : "text-foreground",
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

const shortBranchName = (b: string | null): string | null => (b ? b.replace(/^153복싱짐\s*/, "") || b : null);

/** 운동 약속 한 줄 — 없으면 걸기 단추, 있으면 잘한 것 · 다음 약속 + 고치기 (놓친 약속은 말하지 않는다) */
const PromiseLine = ({
  promise,
  today,
  attended,
  branch,
  onOpen,
}: {
  promise: Promise153 | null;
  today: string;
  attended: ReadonlyMap<string, unknown>;
  branch: string | null;
  onOpen: () => void;
}) => {
  if (!promise) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-left transition-transform active:scale-[0.99]"
      >
        <Handshake className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">운동 약속 걸기</span>
          <span className="block text-label text-muted-foreground">약속한 날이 달력에 보이고, 그날 아침 알려 드려요</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    );
  }
  const set = new Set(attended.keys());
  const status = promiseStatus(promise, today, set);
  return (
    <div className={cn("mt-3 flex items-center gap-3 rounded-xl px-4 py-3", status?.tone === "done" ? "bg-primary/10" : "bg-muted/60")}>
      <Handshake className={cn("h-5 w-5 shrink-0", status?.tone === "next" ? "text-muted-foreground" : "text-primary")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold leading-snug text-foreground">{status?.text ?? promiseSentence(promise, shortBranchName(branch))}</span>
        <span className="block truncate text-label text-muted-foreground">{promiseSentence(promise)}</span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-full bg-card px-3 py-1.5 text-label font-bold text-foreground shadow-elev-1 active:scale-95"
      >
        고치기
      </button>
    </div>
  );
};

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
  /** 운동 약속(내 기록에서만) — 약속한 날 점선 · 한 줄 · 걸기/고치기 */
  withPromise?: boolean;
}

const WorkoutCalendarCard = ({ data, title, openTitle, storageKey, footer, header, recap = false, withPromise = false }: WorkoutCalendarCardProps) => {
  const today = kstToday();
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const [month, setMonth] = useState(() => monthOf(today));
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => attendanceByDay(data.list), [data.list]);
  const moments = useMemo(() => dayMoments(data, today), [data, today]);
  const promiseQ = useMyPromise(withPromise);
  const promiseState = withPromise && promiseQ.data?.on ? promiseQ.data : null;
  const promise = promiseState?.promise ?? null;
  const [promiseOpen, setPromiseOpen] = useState(false);
  const promisedFor = (d: string) => !byDay.has(d) && d >= today && isPromisedDay(promise, d);
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
                      promised={c.inMonth && promisedFor(c.day)}
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
                <DayCell
                  day={d}
                  on={byDay.has(d)}
                  today={today}
                  moment={moments.get(d)}
                  promised={promisedFor(d)}
                  picked={picked === d}
                  onPick={pick}
                />
              </li>
            ))}
          </ol>
        )}

        {pickedDay && <DayLine d={pickedDay} moment={moments.get(pickedDay.day)} />}
        {promiseState && (
          <PromiseLine promise={promise} today={today} attended={byDay} branch={promiseState.branch} onOpen={() => setPromiseOpen(true)} />
        )}
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
      {promiseState && (
        <PromiseSheet
          open={promiseOpen}
          onOpenChange={setPromiseOpen}
          promise={promise}
          branchShort={shortBranchName(promiseState.branch)}
          returnBonus={promiseState.returnBonus}
        />
      )}
    </section>
  );
};

export default WorkoutCalendarCard;
