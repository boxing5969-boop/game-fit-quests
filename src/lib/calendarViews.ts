/**
 * 📅 캘린더 3-5단계 — 회원 운동 달력의 '목록' · '한 해' 보기 계산 (2026-11-14 대표님 「진행하자」 · 「캘린더 3단계 보고서」 3-5)
 *   · 목록 = 오늘부터 30일 — 내 일정 · 153 일정 · 같이 운동 · 할 일 마감 · D-day · 153 기념일 · 공휴일 · 내 생일 · 다음 약속을
 *     날마다 한 묶음으로(구글 캘린더 '일정' 보기처럼). 켜고 끄기(cals_off)를 따른다 · 지난 날은 보이지 않는다.
 *     약속한 날은 매주 되풀이라 다음 약속 하루만(목록이 약속 줄로 덮이지 않게 — 달력 보기의 점선이 나머지를 말한다).
 *   · 한 해 = 달마다 운동 시간 + 온 날 민트 점만 — 빈 칸 회색 없음(감정 설계: 안 온 날을 그리지 않는다).
 *   화면은 components/attendance/CalendarListView.tsx · CalendarYearView.tsx(누를 때 받는 조각).
 */
import { durationLabel, type AttendanceDay } from "@/lib/attendanceHistory";
import type { CalState } from "@/lib/calendarChecks";
import { EVENT_KIND_META, callLine, callsOn, closedDaySet, eventsOn } from "@/lib/calendarEvents";
import { annivOn, annivShort, ddayCount, ddayText, ddaysOn } from "@/lib/calendarMarks";
import { holidayOn } from "@/lib/krHolidays";
import {
  BIRTHDAY_LINE,
  birthdayOn,
  layerOn,
  myEventHex,
  myEventsOn,
  mySubLine,
  restDaySet,
  type CalView,
  type MyEvent,
} from "@/lib/memberEvents";
import { todosOn } from "@/lib/memberHabits";
import { isPromisedDay, slotLabel, type Promise153 } from "@/lib/promise153";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ms = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const addDays = (d: string, n: number) => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10);

// ───────────────────────── 목록 ─────────────────────────
/** 목록 보기 범위 — 오늘부터 30일 (서버 get_my_calendar 한 번에 62일까지) */
export const LIST_DAYS = 30;
export const listRange = (today: string): { from: string; to: string } => ({ from: today, to: addDays(today, LIST_DAYS) });

export type AgendaKind = "mine" | "event" | "call" | "todo" | "dday" | "anniv" | "holiday" | "birthday" | "promise";

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  title: string;
  /** 작은 글 한 줄 (시각 · 장소 · 반복 · D-n) */
  sub: string | null;
  /** 점 색 — 내 일정 색 (그 밖은 화면이 종류 색) */
  hex?: string;
  /** 내 일정이면 그 일정 (누르면 고치기) */
  event?: MyEvent;
  rest?: boolean;
  /** 153 일정 칩 이름 · 색 class */
  chip?: { label: string; cls: string };
}

export interface AgendaDay {
  day: string;
  items: AgendaItem[];
}

/**
 * 오늘부터 30일 — 날마다 그날 있는 것 (없는 날은 빼고).
 * 여러 날 일정(내 일정 · 153 일정)은 그 일정의 첫날(범위 앞에서 시작했으면 범위 첫날)에만 한 줄.
 */
export function agendaDays(input: {
  cal: CalState;
  view: CalView;
  from: string;
  to: string;
  today: string;
  promise?: Promise153 | null;
  attended?: ReadonlySet<string>;
}): AgendaDay[] {
  const { cal, view, from, to, today, promise = null, attended } = input;
  if (!YMD.test(from) || !YMD.test(to) || from > to) return [];
  const showMine = layerOn(view, "mine");
  const show153 = layerOn(view, "153");
  const showHoliday = layerOn(view, "holiday");
  const span: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) span.push(d);
  const rest = restDaySet(cal.mine, span);
  const closed = closedDaySet(cal.events);
  const out: AgendaDay[] = [];
  let promiseShown = false;
  for (const day of span) {
    const items: AgendaItem[] = [];
    if (showMine) {
      for (const e of myEventsOn(cal.mine, day)) {
        // 여러 날 한 번 하는 일정 — 첫날(또는 범위 첫날)에만
        if (!e.rrule && e.occDates.length === 0 && e.endOn > e.startOn && day !== (e.startOn < from ? from : e.startOn)) continue;
        items.push({ key: `mine:${e.id}`, kind: "mine", title: e.title, sub: mySubLine(e) || null, hex: myEventHex(e), event: e, rest: e.rest });
      }
      if (birthdayOn(cal.birthday, day)) items.push({ key: "birthday", kind: "birthday", title: BIRTHDAY_LINE, sub: day === today ? "생일 축하해요" : null });
    }
    if (show153) {
      for (const ev of eventsOn(cal.events, day)) {
        if (day !== (ev.startOn < from ? from : ev.startOn)) continue;
        const meta = EVENT_KIND_META[ev.kind];
        items.push({
          key: `event:${ev.id}`,
          kind: "event",
          title: ev.title,
          sub: ev.endOn > ev.startOn ? `~ ${Number(ev.endOn.slice(5, 7))}/${Number(ev.endOn.slice(8, 10))}` : null,
          chip: { label: meta.label, cls: meta.chip },
        });
      }
      for (const c of callsOn(cal.calls, day)) items.push({ key: `call:${c.id}`, kind: "call", title: callLine(c), sub: c.done ? "같이 했어요" : null });
    }
    for (const t of todosOn(cal.todos, day)) if (!t.done) items.push({ key: `todo:${t.id}`, kind: "todo", title: t.title, sub: "할 일 마감" });
    const anniv = annivOn(cal.anniv, day);
    if (anniv && day >= today) items.push({ key: "anniv", kind: "anniv", title: annivShort(anniv), sub: ddayCount(anniv, today) });
    for (const d of ddaysOn(cal.ddays, day, today)) {
      if (d.kind === "anniv" && anniv) continue;
      if (d.kind === "exam" && items.some((i) => i.kind === "event" && i.key === `event:${d.id}`)) continue;
      items.push({ key: `dday:${d.kind}:${d.id ?? d.day}`, kind: "dday", title: ddayText(d, today), sub: ddayCount(d, today) });
    }
    if (!promiseShown && promise && day >= today && isPromisedDay(promise, day) && !closed.has(day) && !rest.has(day) && !attended?.has(day)) {
      promiseShown = true;
      const slot = slotLabel(promise.timeSlot);
      items.push({ key: "promise", kind: "promise", title: day === today ? "오늘 운동 약속한 날" : "다음 운동 약속", sub: slot ? `${slot}에 만나요` : null });
    }
    const holiday = showHoliday ? holidayOn(day) : null;
    if (holiday) items.unshift({ key: "holiday", kind: "holiday", title: holiday, sub: "공휴일" });
    if (items.length) out.push({ day, items });
  }
  return out;
}

// ───────────────────────── 한 해 도장 ─────────────────────────
export interface YearMonth {
  /** 'YYYY-MM' */
  ym: string;
  minutes: number;
  /** 그 달 온 날 */
  days: Set<string>;
}

/** 그해 1 ~ 12월 — 달마다 운동 시간 · 온 날 */
export function yearMonths(year: number, list: readonly AttendanceDay[]): YearMonth[] {
  const out: YearMonth[] = Array.from({ length: 12 }, (_, i) => ({ ym: `${year}-${String(i + 1).padStart(2, "0")}`, minutes: 0, days: new Set<string>() }));
  for (const d of list) {
    if (!YMD.test(d.day) || Number(d.day.slice(0, 4)) !== year) continue;
    const m = out[Number(d.day.slice(5, 7)) - 1];
    if (!m || m.days.has(d.day)) continue;
    m.days.add(d.day);
    m.minutes += Math.max(0, d.minutes);
  }
  return out;
}

/** 넘겨 볼 수 있는 해 — 첫 기록이 있는 해부터 올해까지 */
export function yearBounds(firstDay: string | null | undefined, today: string): { min: number; max: number } {
  const max = Number(today.slice(0, 4));
  const min = firstDay && YMD.test(firstDay) && firstDay <= today ? Number(firstDay.slice(0, 4)) : max;
  return { min, max };
}

/** 그해 한 줄 — "2026년 · 128시간 20분 운동했어요" (운동한 해만 · 없으면 null) */
export function yearLine(months: readonly YearMonth[]): string | null {
  const minutes = months.reduce((s, m) => s + m.minutes, 0);
  return minutes > 0 ? `${durationLabel(minutes)} 운동했어요` : null;
}

/** 달 칸의 작은 글 — 운동한 달만 "14시간 12분" (없으면 null — '0' 을 쓰지 않는다) */
export const monthMinutesLabel = (m: YearMonth): string | null => (m.minutes > 0 ? durationLabel(m.minutes) : null);
