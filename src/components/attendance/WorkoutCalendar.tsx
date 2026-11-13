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
 *   · 2-1단계 (2026-11-12 대표님 「추천대로」 · withChecks — 내 기록에서만 · 보고서 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b):
 *     오늘의 체크(저절로 — 체육관 · 응원 · 한 줄) + 나만의 체크(3개까지) → 다 채운 날 칸 오른쪽 위 금색 별 · 그날 기분 스티커는 칸 오른쪽 아래.
 *     오늘까지는 출석 안 한 날도 눌러 그날 카드(CalendarChecks DayChecksPanel)를 연다 · 아무 날도 안 고르면 '오늘의 체크' 한 줄.
 *     한 줄 쓰기 = 기존 '오늘 운동 한 줄'(처음엔 나만 보기) · 응원 보내기 = 기존 응원 창 · 나만의 체크 = CheckItemsSheet (모두 누를 때 받는 조각).
 *     계산 · 글은 lib/calendarChecks.ts, 자료는 services/calendarCheckService.ts(함수가 없거나 승인 전 계정이면 지금 그대로).
 *   · 2-2단계 (2026-11-13 대표님 「다음」 · withChecks 와 같은 자료 get_my_calendar): 칸 아래 점 = 153 일정(주황 · 휴관은 회색) ·
 *     저요 한 운동 모집(하늘색) — 앞날도 그런 날은 눌러 그날 일정을 본다 · 점이 있을 때만 이름표 한 줄.
 *     휴관일 = 약속 점선을 그리지 않고 · 약속 한 줄도 약속한 날로 치지 않고 · 그날 체크에서 체육관을 뺀다. 글 · 계산은 lib/calendarEvents.ts.
 *   · 2-3단계 (2026-11-13 대표님 「다음」 · 같은 자료 get_my_calendar): 칸 왼쪽 위 = 그날 한 일 아이콘 하나(타이틀매치 > 레벨업 > 153 PB > PT) ·
 *     왼쪽 아래 = 코치 한마디 말풍선 도장 · 보라 점 = D-day · 출석한 153 기념일 = 금색 도장 · 머리 칩 = 가장 가까운 D-day(누르면 DdaySheet) ·
 *     한 달 보기는 좌우로 밀어 달 넘기기 · 날짜를 길게 누르면 바로 넣기(오늘 · 6일 전까지 = QuickDaySheet, 앞날 = 목표일) ·
 *     알림 링크 '/home?cal=날짜'면 그날을 펼쳐 고른다(focusDay). 글 · 계산은 lib/calendarMarks.ts.
 *   · 2-4단계 (2026-11-13 대표님 「시작하자」 · 같은 자료 get_my_calendar + 내 운동 기록): 일요일 주간 돌아보기(그날은 약속 한 줄을 접는다) ·
 *     운동 짝꿍과 같은 요일 약속 한 줄 · 둘 다 온 날 쌍도장(도장 뒤에 하늘색 도장) · 달 아래 '앨범 n · 카드'(나의 153 앨범 ·
 *     이번 달 운동 카드 이미지 — 지난달 한 줄과 같은 줄) · 홈은 수강권 끝나기 14일 전부터 맨 위에 '153과 함께한 시간'(renewalEnd —
 *     그때는 첫 4주 칸을 접는다). 글 · 계산은 lib/calendarTogether.ts.
 *   · 캘린더 3-1단계 (2026-11-13 대표님 「추천대로 3-1부터」 · 내 기록에서만): 약속 시트 '늘 보기(구독)' + '한 번 받기' ·
 *     나만의 체크 시트 맨 아래 '휴대폰 캘린더에서 늘 보기' → CalendarFeedSheet(kind member — 약속 · 153 일정 · D-day 구독 주소).
 *     서버에 기능이 없으면(DB 적용 전) 두 입구 모두 예전 그대로. 카드에는 아무것도 더하지 않았다(시트 안에서만).
 *   날짜 계산은 lib/attendanceCalendar.ts (주는 월요일 시작).
 */
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { calendarRange, dayChecks, isStarDay, stickerOf, type StickerKey } from "@/lib/calendarChecks";
import { DOT_CALL, DOT_CLOSED, DOT_EVENT, callsOn, closedDaySet, eventDot, eventsOn } from "@/lib/calendarEvents";
import {
  DDAY_CHIP,
  DOT_DDAY,
  LONG_PRESS_MOVE_PX,
  LONG_PRESS_MS,
  actShort,
  annivOn,
  ddayChip,
  ddayText,
  ddaysOn,
  nextDday,
  notesOn,
  quickModeOf,
  swipeMonthDelta,
  topActOn,
  withAnnivMoments,
  type CalAct,
} from "@/lib/calendarMarks";
import { albumOf, isTogetherDay, partnerPromiseLine, renewalLine, weekRecap, type CalPartner } from "@/lib/calendarTogether";
import { useMyPromise } from "@/services/promiseService";
import { CAL2_KEY, useMyCalendar, useSetCheckDone, useSetDaySticker, useSetTodoDone } from "@/services/calendarCheckService";
import { useCalendarFeed } from "@/services/calendarFeedService";
import PromiseSheet from "@/components/attendance/PromiseSheet";
import DayChecksPanel from "@/components/attendance/CalendarChecks";
import { ActIcon, NoteIcon } from "@/components/attendance/CalendarMarkIcons";
import { MonthTools, RenewalBlock, WeekRecapPanel } from "@/components/attendance/CalendarTogether";
import { cn } from "@/lib/utils";

// 그날 카드에서 누를 때만 받는 창 (홈 첫 화면 묶음을 키우지 않게)
const CheckItemsSheet = lazy(() => import("@/components/attendance/CheckItemsSheet"));
const ChampionJournalSheet = lazy(() => import("@/components/engagement/ChampionJournalSheet"));
const SecondCheerSheet = lazy(() => import("@/components/engagement/SecondCheerSheet"));
const DdaySheet = lazy(() => import("@/components/attendance/DdaySheet"));
const QuickDaySheet = lazy(() => import("@/components/attendance/QuickDaySheet"));
const MonthCardSheet = lazy(() => import("@/components/attendance/MonthCardSheet"));
const AlbumSheet = lazy(() => import("@/components/attendance/AlbumSheet"));
const CalendarFeedSheet = lazy(() => import("@/components/calendar/CalendarFeedSheet"));

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
  /** 금색 별 — 그날 체크를 다 채운 날 (2-1단계) */
  star?: boolean;
  /** 그날 기분 스티커(이모지 — 그릴 때 153 입체 아이콘) */
  sticker?: string | null;
  /** 출석하지 않은 날도 누를 수 있나 — 체크를 켠 달력의 오늘까지 (+ 153 일정 · 모집이 있는 앞날) */
  pickable?: boolean;
  /** (2-2) 칸 아래 점 — 153 일정(휴관은 회색) */
  dot?: "closed" | "event" | null;
  /** (2-2) 칸 아래 점 — 저요 한 운동 모집 */
  call?: boolean;
  /** (2-3) 칸 왼쪽 위 — 그날 한 일 하나(타이틀매치 > 레벨업 > 153 PB > PT) */
  act?: CalAct | null;
  /** (2-3) 칸 왼쪽 아래 — 코치 한마디 도장 */
  note?: boolean;
  /** (2-3) 칸 아래 보라 점 — D-day */
  dday?: boolean;
  /** (2-4) 쌍도장 — 운동 짝꿍과 둘 다 온 날 (도장 뒤에 하늘색 도장이 겹친다) */
  together?: boolean;
  /** (2-3) 길게 누르기 — 바로 넣기 (없으면 길게 눌러도 아무 일 없음) */
  onLongPress?: (day: string) => void;
  picked: boolean;
  onPick: (day: string) => void;
}

type LongPressHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave" | "onContextMenu"
>;

/** (2-3) 길게 누르기 — 0.45초 · 10px 안에서. 길게 누른 뒤 따라오는 click 한 번은 삼킨다(swallow) */
function useLongPress(day: string, onLong?: (day: string) => void): { handlers: LongPressHandlers; swallow: () => boolean } {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );
  if (!onLong) return { handlers: {}, swallow: () => false };
  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          try {
            navigator.vibrate?.(12);
          } catch {
            /* 진동이 없는 기기 */
          }
          onLong(day);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_MOVE_PX) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu: (e) => e.preventDefault(),
    },
    swallow: () => {
      if (!fired.current) return false;
      fired.current = false;
      return true;
    },
  };
}

/** 날짜 한 칸 — 출석한 날 = 민트 도장(누르면 그날 한 줄) · 기념일 = 금색 도장 · 오늘 = 테두리 · 앞뒤 달 = 흐리게 ·
 *  금색 별(다 채운 날)은 오른쪽 위 · 기분 스티커는 오른쪽 아래 · (2-3) 그날 한 일은 왼쪽 위 · 코치 한마디는 왼쪽 아래 */
const DayCell = ({
  day,
  on,
  today,
  faint = false,
  moment,
  promised = false,
  star = false,
  sticker = null,
  pickable = false,
  dot = null,
  call = false,
  act = null,
  note = false,
  dday = false,
  together = false,
  onLongPress,
  picked,
  onPick,
}: CellProps) => {
  const isToday = day === today;
  const num = Number(day.slice(8));
  const lp = useLongPress(day, faint ? undefined : onLongPress);
  const base = "flex h-10 w-10 items-center justify-center rounded-full text-label tabular-nums";
  const gold = on && !!moment?.gold;
  const label = `${dayLabel(day)}${on ? " 출석" : ""}${on && together ? " · 짝꿍과 같이" : ""}${on && moment ? ` · ${moment.text}` : ""}${!on && promised ? " · 약속한 날" : ""}${star ? " · 금색 별" : ""}${act ? ` · ${actShort(act)}` : ""}${note ? " · 코치 한마디" : ""}${dday ? " · D-day" : ""}${dot === "closed" ? " · 휴관" : dot === "event" ? " · 153 일정" : ""}${call ? " · 같이 운동" : ""}${isToday ? " · 오늘" : ""}`;
  const pickedRing = picked && "ring-2 ring-foreground ring-offset-2 ring-offset-card";
  // 길게 누를 때 아이폰 글자 고르기 · 메뉴가 뜨지 않게
  const pressCls = onLongPress ? "select-none [-webkit-touch-callout:none]" : "";
  const click = () => {
    if (lp.swallow()) return;
    onPick(day);
  };
  if (faint) {
    return (
      <span className={cn(base, "text-muted-foreground/40")} aria-hidden>
        {num}
      </span>
    );
  }
  const marks = (
    <>
      {act && (
        <span className="pointer-events-none absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-elev-1" aria-hidden>
          <ActIcon act={act} className="h-3 w-3" />
        </span>
      )}
      {star && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-elev-1" aria-hidden>
          <Star className="h-3.5 w-3.5 text-reward" fill="currentColor" />
        </span>
      )}
      {note && (
        <span className="pointer-events-none absolute -bottom-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-elev-1" aria-hidden>
          <NoteIcon className="h-3 w-3" />
        </span>
      )}
      {sticker && (
        <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 text-micro leading-none" aria-hidden>
          {sticker}
        </span>
      )}
      {(dot || call || dday) && (
        <span className="pointer-events-none absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden>
          {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot === "closed" ? DOT_CLOSED : DOT_EVENT)} />}
          {call && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CALL)} />}
          {dday && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_DDAY)} />}
        </span>
      )}
    </>
  );
  if (!on) {
    const cls = cn(
      base,
      promised && day >= today
        ? "border-2 border-dashed border-primary font-bold text-primary"
        : isToday
          ? "font-bold text-foreground ring-2 ring-primary/60"
          : day > today
            ? "text-muted-foreground/60"
            : "text-foreground",
      pickable && pickedRing,
    );
    return (
      <span className="relative inline-flex">
        {pickable ? (
          <button
            type="button"
            onClick={click}
            {...lp.handlers}
            aria-pressed={picked}
            aria-label={label}
            className={cn(cls, pressCls, "transition-transform active:scale-95")}
          >
            {num}
          </button>
        ) : (
          <span className={cls} aria-label={label}>
            {num}
          </span>
        )}
        {marks}
      </span>
    );
  }
  return (
    <span className="relative inline-flex">
      {/* (2-4) 쌍도장 — 짝꿍 도장이 살짝 뒤에 겹친다 */}
      {together && <span className="pointer-events-none absolute left-[5px] top-[4px] h-10 w-10 rounded-full bg-sky-300 dark:bg-sky-500/70" aria-hidden />}
      <button
        type="button"
        onClick={click}
        {...lp.handlers}
        aria-pressed={picked}
        aria-label={label}
        className={cn(
          base,
          pressCls,
          "relative font-extrabold transition-transform active:scale-95",
          gold ? "bg-reward text-reward-foreground" : "bg-primary text-primary-foreground",
          pickedRing,
        )}
      >
        {num}
      </button>
      {marks}
    </span>
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
  skip,
  partner,
  onOpen,
}: {
  promise: Promise153 | null;
  today: string;
  attended: ReadonlyMap<string, unknown>;
  branch: string | null;
  /** 휴관일 — 약속한 날로 치지 않는다 */
  skip?: ReadonlySet<string>;
  /** (2-4) 운동 짝꿍 — 같은 요일로 약속했으면 아래 줄이 '짝꿍 ○○님과 수 같이 약속했어요' */
  partner?: CalPartner | null;
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
          <span className="block text-label text-muted-foreground">약속한 날이 달력에 보이고, 고른 시각에 알려 드려요</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    );
  }
  const set = new Set(attended.keys());
  const status = promiseStatus(promise, today, set, skip);
  const together = partnerPromiseLine(promise, partner);
  return (
    <div className={cn("mt-3 flex items-center gap-3 rounded-xl px-4 py-3", status?.tone === "done" ? "bg-primary/10" : "bg-muted/60")}>
      <Handshake className={cn("h-5 w-5 shrink-0", status?.tone === "next" ? "text-muted-foreground" : "text-primary")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold leading-snug text-foreground">{status?.text ?? promiseSentence(promise, shortBranchName(branch))}</span>
        {/* 회색 줄은 하나만 — 짝꿍과 같은 요일이면 그 한 줄이 약속 문장 대신 */}
        {together ? (
          <span className="block text-label font-bold leading-snug text-sky-700 dark:text-sky-300">{together}</span>
        ) : (
          <span className="block truncate text-label text-muted-foreground">{promiseSentence(promise)}</span>
        )}
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
  /** 2-1단계 체크(내 기록에서만) — 오늘의 체크 · 나만의 체크 · 한 줄 · 기분 스티커 · 금색 별 */
  withChecks?: boolean;
  /** (2-3) 이 날을 펼쳐 고른다 — 코치 한마디 알림 링크 '/home?cal=날짜' (HomeWorkoutCalendar) */
  focusDay?: string | null;
  /** focusDay 를 쓴 뒤 — 주소의 ?cal= 을 지우게 */
  onFocusDone?: () => void;
  /** (2-4) 수강권 끝나는 날 — 14일 전 ~ 끝나고 14일 맨 위에 '153과 함께한 시간' (홈 · 회원만, 없으면 안 그림) */
  renewalEnd?: string | null;
}

type SheetKey = "items" | "line" | "cheer" | "dday" | "quick" | "card" | "album" | "feed";

const WorkoutCalendarCard = ({
  data,
  title,
  openTitle,
  storageKey,
  footer,
  header,
  recap = false,
  withPromise = false,
  withChecks = false,
  focusDay = null,
  onFocusDone,
  renewalEnd,
}: WorkoutCalendarCardProps) => {
  const today = kstToday();
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const [month, setMonth] = useState(() => monthOf(today));
  const [slide, setSlide] = useState<1 | -1>(1);
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => attendanceByDay(data.list), [data.list]);
  const baseMoments = useMemo(() => dayMoments(data, today), [data, today]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const promiseQ = useMyPromise(withPromise);
  const promiseState = withPromise && promiseQ.data?.on ? promiseQ.data : null;
  const promise = promiseState?.promise ?? null;
  const [promiseOpen, setPromiseOpen] = useState(false);
  const navigate = useNavigate();
  const bounds = monthBounds(data.firstDay, today);
  const week = useMemo(() => weekOf(today), [today]);
  const weekCount = week.filter((d) => byDay.has(d)).length;
  const pickedDay = picked ? byDay.get(picked) ?? null : null;

  // 2-1단계 체크 — 보이는 날짜(이번 주 또는 한 달)만 서버에 묻는다
  const visibleDays = useMemo(() => (open ? monthWeeks(month).flat().map((c) => c.day) : week), [open, month, week]);
  const range = withChecks ? calendarRange(visibleDays) : null;
  const calQ = useMyCalendar(range?.from ?? null, range?.to ?? null, withChecks);
  const cal = withChecks && calQ.data?.on ? calQ.data : null;
  // (2-2) 153 일정 · 저요 한 모집 — 휴관일은 약속한 날로 치지 않고 체육관 체크도 뺀다
  const closed = useMemo(() => (cal ? closedDaySet(cal.events) : new Set<string>()), [cal]);
  const promisedFor = (d: string) => !byDay.has(d) && d >= today && isPromisedDay(promise, d) && !closed.has(d);
  const dotFor = (d: string) => (cal ? eventDot(cal.events, d) : null);
  const callFor = (d: string) => !!cal && callsOn(cal.calls, d).length > 0;
  const hasAgenda = (d: string) => !!cal && (eventsOn(cal.events, d).length > 0 || callsOn(cal.calls, d).length > 0);
  // (2-4) 운동 짝꿍 — 둘 다 온 날 = 쌍도장
  const partner = cal?.partner ?? null;
  const togetherFor = (d: string) => byDay.has(d) && isTogetherDay(partner, d);
  const legend = useMemo(() => {
    if (!cal) return null;
    const dots = new Set(visibleDays.map((d) => eventDot(cal.events, d)).filter(Boolean));
    const calls = visibleDays.some((d) => callsOn(cal.calls, d).length > 0);
    const dday = visibleDays.some(
      (d) => d >= today && (ddaysOn(cal.ddays, d, today).length > 0 || (!byDay.has(d) && !!annivOn(cal.anniv, d))),
    );
    const together = visibleDays.some((d) => byDay.has(d) && isTogetherDay(cal.partner, d));
    const out = [
      ...(dots.has("event") ? [{ cls: DOT_EVENT, label: "153 일정" }] : []),
      ...(dots.has("closed") ? [{ cls: DOT_CLOSED, label: "휴관" }] : []),
      ...(calls ? [{ cls: DOT_CALL, label: "같이 운동" }] : []),
      ...(dday ? [{ cls: DOT_DDAY, label: "D-day" }] : []),
      ...(together ? [{ cls: "bg-sky-300 dark:bg-sky-500/70", label: "짝꿍과 같이" }] : []),
    ];
    return out.length ? out : null;
  }, [cal, visibleDays, today, byDay]);
  const qc = useQueryClient();
  // (3-1) 휴대폰 캘린더 구독 주소 — 서버에 기능이 있고 이 계정이 가질 수 있을 때만 입구가 보인다
  const feedQ = useCalendarFeed("member", withChecks);
  const feedOk = withChecks && !!feedQ.data?.available && !!feedQ.data?.can;
  const doneM = useSetCheckDone();
  const stickerM = useSetDaySticker();
  const todoM = useSetTodoDone();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const [sheetMonth, setSheetMonth] = useState<string>(() => monthOf(today));
  const [mounted, setMounted] = useState<Record<SheetKey, boolean>>({
    items: false,
    line: false,
    cheer: false,
    dday: false,
    quick: false,
    card: false,
    album: false,
    feed: false,
  });
  const openSheet = (k: SheetKey, day: string | null = null) => {
    setMounted((m) => (m[k] ? m : { ...m, [k]: true }));
    setSheetDay(day);
    setSheet(k);
  };
  const closeSheet = () => {
    setSheet(null);
    void qc.invalidateQueries({ queryKey: CAL2_KEY }); // 한 줄 · 응원을 마쳤으면 체크가 채워진다
  };
  // (2-3) 출석한 153 기념일 = 금색 도장 (첫 도장 · 출석 축하가 먼저)
  const moments = useMemo(
    () => (cal ? withAnnivMoments(baseMoments, cal.anniv, (d) => byDay.has(d)) : baseMoments),
    [baseMoments, cal, byDay],
  );
  const starOf = (d: string) => !!cal && d <= today && isStarDay(dayChecks(d, byDay.has(d), cal.days.get(d), cal.items, closed.has(d)));
  const stickerFor = (d: string) => (cal ? stickerOf(cal.days.get(d)?.sticker)?.emoji ?? null : null);
  // (2-3) 앞날도 누를 수 있다 — 그날 일정 · D-day · '이 날을 목표일로'
  const pickableFor = (d: string) => !!cal && (d <= today || hasAgenda(d) || quickModeOf(d, today) === "future");
  const actFor = (d: string) => (cal ? topActOn(cal.acts, d) : null);
  const noteFor = (d: string) => !!cal && notesOn(cal.notes, d).length > 0;
  const ddayFor = (d: string) =>
    !!cal && (ddaysOn(cal.ddays, d, today).length > 0 || (d >= today && !byDay.has(d) && !!annivOn(cal.anniv, d)));
  const nextD = cal ? nextDday(cal.ddays, today) : null;
  // (2-3) 길게 누르기 — 오늘 · 6일 전까지 = 바로 넣기 · 앞날 = 목표일
  const onLongPress = (d: string) => {
    const mode = quickModeOf(d, today);
    if (!cal || !mode) return;
    setPicked(d);
    if (mode === "future") openSheet("dday", d);
    else openSheet("quick", d);
  };
  const longPressFor = (d: string) => (cal && quickModeOf(d, today) ? onLongPress : undefined);
  const showToday = !!cal && !picked && (!open || month === monthOf(today));
  const panelFor = (day: string, compact: boolean) =>
    cal ? (
      <DayChecksPanel
        day={day}
        today={today}
        attended={byDay.get(day) ?? null}
        moment={moments.get(day)}
        cal={cal}
        compact={compact}
        busy={doneM.isPending}
        onToggle={(itemId, done) => doneM.mutate({ day, itemId, done }, { onError: (e) => toast.error((e as Error).message) })}
        onSticker={(key: StickerKey | null) => stickerM.mutate({ day, sticker: key }, { onError: (e) => toast.error((e as Error).message) })}
        onWriteLine={() => openSheet("line")}
        onCheer={() => openSheet("cheer")}
        onManage={() => openSheet("items")}
        onOpenCalls={() => navigate("/myboxer/community?together=1")}
        onGoal={(d) => openSheet("dday", d)}
        onTodo={(id, done) =>
          todoM.mutate(
            { id, done, today },
            {
              onSuccess: () => {
                if (done) toast.success("끝냈어요");
              },
              onError: (e) => toast.error((e as Error).message),
            },
          )
        }
      />
    ) : null;
  // 지난 달을 넘겨 보면 그 달 한 줄 · 새 달 첫 7일엔 지난달 한 줄 (이번 달 숫자는 홈 '내 운동'이 주인공 — 다시 쓰지 않는다)
  const pastRecap = open && month < monthOf(today) ? monthRecap(data, month) : null;
  // 새 달 첫 7일 지난달 한 줄은 접힌 카드에만 — 펼치면 달마다 아래 한 줄(앨범 · 카드)이 있다 (2-4)
  const freshLine = recap && !open ? freshStartLine(data, today) : null;
  const heading = open ? openTitle ?? title : title;
  // (2-4) 일요일 주간 돌아보기 — 내 기록 · 이번 주가 보일 때 · 고른 날이 없을 때 (그날은 약속 한 줄을 접는다)
  const weekly =
    withChecks && !picked && (!open || month === monthOf(today)) ? weekRecap({ today, list: data.list, promise, starDay: starOf, partner }) : null;
  // (2-4) 재등록 즈음 '153과 함께한 시간' — 보일 때는 머리 칸(첫 4주)을 접는다
  const renewal = renewalEnd
    ? renewalLine({ membershipEnd: renewalEnd, today, firstDay: data.firstDay, totalMinutes: data.totalMinutes })
    : null;
  // (2-4) 달 아래 '앨범 n · 카드' — 운동한 달만 카드 · 사진이 있는 달만 앨범
  const albums = open && cal ? albumOf(cal.days, month) : [];
  const monthHas = (ym: string) => data.list.some((d) => d.day.startsWith(`${ym}-`));
  const lastMonth = shiftMonth(monthOf(today), -1);
  const openCard = (ym: string) => {
    setSheetMonth(ym);
    openSheet("card");
  };

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
    setSlide(delta > 0 ? 1 : -1);
    setMonth(next);
    setPicked(null);
  };
  const pick = (day: string) => setPicked((p) => (p === day ? null : day));
  // (2-3) 한 달 보기 — 좌우로 밀어 달 넘기기 (세로 스크롤은 그대로 · 길게 누르기는 움직이면 풀린다)
  const onSwipeStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };
  const onSwipeEnd = (e: ReactTouchEvent) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const delta = swipeMonthDelta(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t);
    if (delta) goMonth(delta);
  };

  // (2-3) 코치 한마디 알림 링크 '/home?cal=날짜' — 그날을 펼쳐 고르고 카드가 보이게
  useEffect(() => {
    if (!focusDay) return;
    if (!weekOf(today).includes(focusDay)) {
      setOpen(true);
      setMonth(monthOf(focusDay));
    }
    // 오늘이면 고르지 않는다 — '오늘의 체크' 한 줄(코치 한마디 포함) · 일요일 주간 돌아보기가 그대로 보이게 (2-4)
    setPicked(focusDay === today ? null : focusDay);
    window.setTimeout(() => sectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    onFocusDone?.();
    // 알림 링크로 한 번 — 날짜가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay]);

  return (
    <section ref={sectionRef} aria-label={heading} className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-heading text-foreground">{heading}</h3>
          {(nextD || data.weekStreak >= 2) && (
            <span className="flex min-w-0 items-center gap-1.5">
              {/* (2-3) 가장 가까운 D-day — 누르면 D-day 시트(목표일 정하기 · 빼기) */}
              {nextD && (
                <button
                  type="button"
                  onClick={() => openSheet("dday")}
                  aria-label={`D-day ${ddayText(nextD, today)} · 목표일 정하기`}
                  className={cn("max-w-[11rem] truncate rounded-full px-3 py-1 text-label font-bold tabular-nums active:scale-95", DDAY_CHIP)}
                >
                  {ddayChip(nextD, today)}
                </button>
              )}
              {data.weekStreak >= 2 && (
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">{n(data.weekStreak)}주 연속</span>
              )}
            </span>
          )}
        </div>

        {renewal ? <RenewalBlock line={renewal} /> : header}

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
            <div
              key={month}
              className={cn(
                "mt-2 grid touch-pan-y grid-cols-7 duration-200 animate-in fade-in-0 motion-reduce:animate-none",
                slide > 0 ? "slide-in-from-right-4" : "slide-in-from-left-4",
                cal ? "gap-y-3" : "gap-y-1",
              )}
              role="group"
              aria-label={`${monthLabel(month)} 출석 달력 · 좌우로 밀어 달 넘기기`}
              onTouchStart={onSwipeStart}
              onTouchEnd={onSwipeEnd}
              onTouchCancel={() => (swipeRef.current = null)}
            >
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
                      star={c.inMonth && starOf(c.day)}
                      sticker={c.inMonth ? stickerFor(c.day) : null}
                      pickable={c.inMonth && pickableFor(c.day)}
                      dot={c.inMonth ? dotFor(c.day) : null}
                      call={c.inMonth && callFor(c.day)}
                      act={c.inMonth ? actFor(c.day) : null}
                      note={c.inMonth && noteFor(c.day)}
                      dday={c.inMonth && ddayFor(c.day)}
                      together={c.inMonth && togetherFor(c.day)}
                      onLongPress={c.inMonth ? longPressFor(c.day) : undefined}
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
                  star={starOf(d)}
                  sticker={stickerFor(d)}
                  pickable={pickableFor(d)}
                  dot={dotFor(d)}
                  call={callFor(d)}
                  act={actFor(d)}
                  note={noteFor(d)}
                  dday={ddayFor(d)}
                  together={togetherFor(d)}
                  onLongPress={longPressFor(d)}
                  picked={picked === d}
                  onPick={pick}
                />
              </li>
            ))}
          </ol>
        )}

        {legend && (
          <p className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1" aria-hidden>
            {legend.map((x) => (
              <span key={x.label} className="flex items-center gap-1 text-micro text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", x.cls)} />
                {x.label}
              </span>
            ))}
          </p>
        )}
        {cal
          ? picked
            ? panelFor(picked, false)
            : showToday && panelFor(today, true)
          : pickedDay && <DayLine d={pickedDay} moment={moments.get(pickedDay.day)} />}
        {weekly ? (
          <WeekRecapPanel recap={weekly} onPromise={promiseState ? () => setPromiseOpen(true) : undefined} />
        ) : (
          promiseState && (
            <PromiseLine
              promise={promise}
              today={today}
              attended={byDay}
              branch={promiseState.branch}
              skip={closed}
              partner={partner}
              onOpen={() => setPromiseOpen(true)}
            />
          )
        )}
        {open ? (
          <MonthTools
            text={pastRecap?.text}
            gain={pastRecap?.gain}
            albumCount={albums.length}
            onAlbum={() => {
              setSheetMonth(month);
              openSheet("album");
            }}
            onCard={withChecks && monthHas(month) ? () => openCard(month) : undefined}
            cardAria={`${Number(month.slice(5, 7))}월 운동 카드 만들기`}
          />
        ) : (
          freshLine && (
            <MonthTools
              text={freshLine}
              onCard={withChecks && monthHas(lastMonth) ? () => openCard(lastMonth) : undefined}
              cardAria={`${Number(lastMonth.slice(5, 7))}월 운동 카드 만들기`}
            />
          )
        )}
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
          eveAt={promiseState.eveAt}
          today={today}
          partner={partner}
          onOpenFeed={
            feedOk
              ? () => {
                  setPromiseOpen(false);
                  openSheet("feed");
                }
              : undefined
          }
        />
      )}
      {cal && mounted.items && (
        <Suspense fallback={null}>
          <CheckItemsSheet
            open={sheet === "items"}
            onOpenChange={(v) => (v ? setSheet("items") : closeSheet())}
            items={cal.items.filter((i) => i.archivedOn == null)}
            nudge={cal.nudge}
            recap={cal.recap}
            onOpenFeed={feedOk ? () => openSheet("feed") : undefined}
          />
        </Suspense>
      )}
      {feedOk && mounted.feed && (
        <Suspense fallback={null}>
          <CalendarFeedSheet open={sheet === "feed"} onOpenChange={(v) => setSheet(v ? "feed" : null)} kind="member" />
        </Suspense>
      )}
      {withChecks && mounted.card && (
        <Suspense fallback={null}>
          <MonthCardSheet
            open={sheet === "card"}
            onOpenChange={(v) => setSheet(v ? "card" : null)}
            month={sheetMonth}
            data={data}
            today={today}
          />
        </Suspense>
      )}
      {cal && mounted.album && (
        <Suspense fallback={null}>
          <AlbumSheet
            open={sheet === "album"}
            onOpenChange={(v) => setSheet(v ? "album" : null)}
            month={sheetMonth}
            photos={albumOf(cal.days, sheetMonth)}
            onPickDay={(d) => setPicked(d)}
          />
        </Suspense>
      )}
      {withChecks && mounted.line && (
        <Suspense fallback={null}>
          <ChampionJournalSheet open={sheet === "line"} onClose={closeSheet} defaultVisibility="private" rememberKey="cal" />
        </Suspense>
      )}
      {withChecks && mounted.cheer && (
        <Suspense fallback={null}>
          <SecondCheerSheet open={sheet === "cheer"} onClose={closeSheet} />
        </Suspense>
      )}
      {cal && mounted.dday && (
        <Suspense fallback={null}>
          <DdaySheet
            open={sheet === "dday"}
            onOpenChange={(v) => (v ? setSheet("dday") : closeSheet())}
            ddays={cal.ddays}
            today={today}
            initialDay={sheetDay}
          />
        </Suspense>
      )}
      {cal && mounted.quick && (
        <Suspense fallback={null}>
          <QuickDaySheet
            open={sheet === "quick"}
            onOpenChange={(v) => (v ? setSheet("quick") : closeSheet())}
            day={sheetDay}
            today={today}
            cal={cal}
            busy={doneM.isPending}
            onToggle={(day, itemId, done) => doneM.mutate({ day, itemId, done }, { onError: (e) => toast.error((e as Error).message) })}
            onSticker={(day, key) => stickerM.mutate({ day, sticker: key }, { onError: (e) => toast.error((e as Error).message) })}
            onWriteLine={() => openSheet("line")}
            onManage={() => openSheet("items")}
          />
        </Suspense>
      )}
    </section>
  );
};

export default WorkoutCalendarCard;
