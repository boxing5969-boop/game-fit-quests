/**
 * 🌙 음력 ↔ 양력 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5 '내 기념일(양력 · 음력)')
 *
 *   회원 운동 달력 '내 기념일'을 음력으로 넣을 때만 쓴다(누를 때 받는 내 일정 시트 조각 안). 서버는 음력을 계산하지 않는다 —
 *   앱이 이 표로 앞으로 올 양력 날들(occ_dates · 12개까지)을 계산해 보내고, 서버는 그 날들로 달력 · 알림을 낸다
 *   (DB 20261114101236_calendar_stage35.sql set_my_cal_event).
 *
 *   표 출처: 한국천문연구원(KASI) 음력 기준을 그대로 옮긴 korean-lunar-calendar 0.4.0(MIT)으로 2025-01-01 ~ 2037-03-31 양력을
 *   하루씩 바꿔 음력 달마다 첫날 · 날 수를 모았다(2026-11-14 · 라이브러리는 앱에 넣지 않고 표만). 설날 · 추석이
 *   lib/krHolidays(월력요항) 와 같은지 시험(lunar.test.ts)이 본다.
 *   ⚠ 표는 음력 2025 ~ 2036 년 — 2036 년이 오기 전에 다음 해들을 더한다(그 뒤의 날은 계산하지 않는다 = 기념일 날이 비면 다시 저장).
 *
 *   한국 관습: 윤달 기념일은 그해에 그 윤달이 없으면 평달 같은 날 · 30일 기념일은 그 달이 29일까지면 29일.
 */

/** 음력 2025년 1월 1일 = 양력 2025-01-29 — 아래 표의 달들은 여기서부터 빈틈없이 이어진다 */
const START = "2025-01-29";

/**
 * [음력 해, 윤달(0 = 없음), 달마다 날 수 — 1 = 30일 · 0 = 29일, 1월부터 윤달을 제자리(그 달 바로 뒤)에 넣은 순서]
 * 2025 윤6월 · 2028 윤5월 · 2031 윤3월 · 2033 윤11월 · 2036 윤6월.
 */
const YEARS: ReadonlyArray<readonly [number, number, string]> = [
  [2025, 6, "1010010101110"],
  [2026, 0, "101001010111"],
  [2027, 0, "010100100111"],
  [2028, 5, "0110100100110"],
  [2029, 0, "110110010011"],
  [2030, 0, "010110101010"],
  [2031, 3, "1010101101010"],
  [2032, 0, "100101101101"],
  [2033, 11, "0100101011101"],
  [2034, 0, "010010101110"],
  [2035, 0, "101001001101"],
  [2036, 6, "1101001001101"],
];

export const LUNAR_MIN_YEAR = YEARS[0][0];
export const LUNAR_MAX_YEAR = YEARS[YEARS.length - 1][0];

export interface LunarMonth {
  y: number;
  m: number;
  leap: boolean;
  /** 그 달 1일의 양력 날짜 */
  start: string;
  days: 29 | 30;
}

export interface LunarDate {
  y: number;
  m: number;
  d: number;
  leap: boolean;
}

const DAY_MS = 86_400_000;
const ms = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const addDays = (d: string, n: number) => new Date(ms(d) + n * DAY_MS).toISOString().slice(0, 10);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

let cache: LunarMonth[] | null = null;
/** 음력 달 목록 (오래된 달부터) — 한 번만 만든다 */
export function lunarMonths(): readonly LunarMonth[] {
  if (cache) return cache;
  const out: LunarMonth[] = [];
  let start = START;
  for (const [y, leapMonth, bits] of YEARS) {
    let m = 1;
    let leapNext = false;
    for (const b of bits) {
      const days = b === "1" ? 30 : 29;
      out.push({ y, m, leap: leapNext, start, days });
      start = addDays(start, days);
      if (leapNext) {
        leapNext = false;
        m += 1;
      } else if (m === leapMonth) {
        leapNext = true; // 다음 칸 = 같은 달의 윤달
      } else {
        m += 1;
      }
    }
  }
  cache = out;
  return out;
}

const findMonth = (y: number, m: number, leap: boolean) => lunarMonths().find((x) => x.y === y && x.m === m && x.leap === leap) ?? null;

/** 그해 윤달 (없으면 0) */
export const leapMonthOf = (y: number): number => YEARS.find((r) => r[0] === y)?.[1] ?? 0;

/**
 * 음력 → 양력. 윤달을 골랐는데 그해 그 윤달이 없으면 평달 · 30일이 없는 달이면 29일(한국 관습).
 * 표 밖의 해 · 잘못된 달 · 날이면 null.
 */
export function lunarToSolar(y: number, m: number, d: number, leap = false): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 30) return null;
  const month = (leap ? findMonth(y, m, true) : null) ?? findMonth(y, m, false);
  if (!month) return null;
  return addDays(month.start, Math.min(d, month.days) - 1);
}

/** 양력 → 음력 (표 밖이면 null) */
export function solarToLunar(date: string): LunarDate | null {
  if (!YMD.test(date)) return null;
  const t = ms(date);
  for (const x of lunarMonths()) {
    const s = ms(x.start);
    if (t >= s && t < s + x.days * DAY_MS) return { y: x.y, m: x.m, d: Math.round((t - s) / DAY_MS) + 1, leap: x.leap };
  }
  return null;
}

/** 음력 m월 d일(윤달)이 양력으로 오는 날들 — from ~ to 안 · 해마다 하나 (날짜 순) */
export function lunarDatesBetween(m: number, d: number, leap: boolean, from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = LUNAR_MIN_YEAR; y <= LUNAR_MAX_YEAR; y++) {
    const s = lunarToSolar(y, m, d, leap);
    if (s && s >= from && s <= to && !out.includes(s)) out.push(s);
  }
  return out.sort();
}

/** 서버(occ_dates)가 받는 범위 — 오늘 400일 전 ~ 3700일 뒤 · 12개까지 */
export const LUNAR_OCC_MAX = 12;

/**
 * 내 음력 기념일이 올 양력 날들 — 1년 전부터 10년 안(서버 범위 안) · 12개까지(넘치면 오래된 것부터 뺀다).
 * 지난 1년 것도 넣어 지난달을 넘겨 봐도 그날 표시가 보이게.
 */
export function lunarOccurrences(m: number, d: number, leap: boolean, today: string, max = LUNAR_OCC_MAX): string[] {
  if (!YMD.test(today)) return [];
  const all = lunarDatesBetween(m, d, leap, addDays(today, -365), addDays(today, 3650));
  return all.length > max ? all.slice(all.length - max) : all;
}

/** "음력 3월 15일" · "음력 윤6월 1일" */
export const lunarLabel = (v: { m: number; d: number; leap?: boolean | null }): string => `음력 ${v.leap ? "윤" : ""}${v.m}월 ${v.d}일`;

/** 그해 그 날짜 칸에 무엇이 오나 — "윤6월이 없는 해는 6월 1일로" 같은 안내 (평소엔 null) */
export function lunarAdjustNote(y: number, m: number, d: number, leap: boolean): string | null {
  if (leap && !findMonth(y, m, true)) return `${y}년에는 윤${m}월이 없어 ${m}월 ${d}일로 챙겨요`;
  const month = (leap ? findMonth(y, m, true) : null) ?? findMonth(y, m, false);
  if (month && d > month.days) return `${y}년 ${leap && findMonth(y, m, true) ? "윤" : ""}${m}월은 29일까지라 29일로 챙겨요`;
  return null;
}
