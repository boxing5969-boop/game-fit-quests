/**
 * 📅 운동 달력 — 날짜 계산 한 곳 (2026-11-12 선릉역점 봄 회원 제안 → 대표님 「추천대로 진행하자」)
 *   보고서 「마이복서153 회원 제안 검토 — 홈 캘린더·출석 도장·체크리스트」 1단계
 *   (https://claude.ai/artifact/4s6m5nxaghb8Hpqxpx79Rn).
 *   · 주는 월요일에 시작한다 — '내 운동 기록'의 '이번 주 7칸' · 11/8 확정한 「153 운동 약속」(월요일에 약속)과 같은 기준.
 *   · 날짜는 모두 KST 'YYYY-MM-DD' 글자 그대로 계산한다(기기 시간대와 상관없게 UTC 자정으로만 더하고 뺀다).
 *   화면은 components/attendance/WorkoutCalendar.tsx. 시험 attendanceCalendar.test.ts.
 */
import type { AttendanceDay } from "@/lib/attendanceHistory";
import { weekMonday } from "@/lib/achievement153";

const DAY_MS = 86_400_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM = /^(\d{4})-(\d{2})$/;

const toUtc = (ymd: string): number | null => {
  const m = YMD.exec(ymd);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fromUtc = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export const monthOf = (ymd: string): string => ymd.slice(0, 7);

/** 'YYYY-MM' 에서 delta 달 앞(−) · 뒤(+) */
export function shiftMonth(ym: string, delta: number): string {
  const m = YM.exec(ym);
  if (!m) return ym;
  const idx = Number(m[1]) * 12 + (Number(m[2]) - 1) + Math.trunc(delta);
  const y = Math.floor(idx / 12);
  return `${y}-${String(idx - y * 12 + 1).padStart(2, "0")}`;
}

/** 그 날이 든 주의 월 ~ 일 7칸 */
export function weekOf(day: string): string[] {
  const mon = weekMonday(day);
  const t = mon ? toUtc(mon) : null;
  if (t == null) return [];
  return Array.from({ length: 7 }, (_, i) => fromUtc(t + i * DAY_MS));
}

export interface CalendarCell {
  day: string;
  /** 보고 있는 달의 날짜인가 (앞뒤 달 날짜는 흐리게) */
  inMonth: boolean;
}

/** 그 달 달력 — 월요일에 시작하는 주 4~6줄 */
export function monthWeeks(ym: string): CalendarCell[][] {
  const m = YM.exec(ym);
  if (!m) return [];
  const first = `${ym}-01`;
  const start = toUtc(weekMonday(first) ?? first);
  if (start == null) return [];
  const last = Date.UTC(Number(m[1]), Number(m[2]), 0); // 그 달 마지막 날
  const weeks: CalendarCell[][] = [];
  for (let t = start; t <= last; t += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = fromUtc(t + i * DAY_MS);
        return { day, inMonth: monthOf(day) === ym };
      }),
    );
  }
  return weeks;
}

/** 넘겨 볼 수 있는 달 — 첫 기록이 있는 달부터 이번 달까지 (기록이 없으면 이번 달만) */
export function monthBounds(firstDay: string | null | undefined, today: string): { min: string; max: string } {
  const max = monthOf(today);
  const min = firstDay && YMD.test(firstDay) && firstDay <= today ? monthOf(firstDay) : max;
  return { min, max };
}

/** 날짜 → 그날 출석 (같은 날 두 줄이면 먼저 들어온 것 — 출석은 하루 1번이라 보통 한 줄) */
export function attendanceByDay(list: readonly AttendanceDay[]): Map<string, AttendanceDay> {
  const map = new Map<string, AttendanceDay>();
  for (const d of list) {
    if (!YMD.test(d.day)) continue;
    const prev = map.get(d.day);
    if (!prev || d.at < prev.at) map.set(d.day, d);
  }
  return map;
}
