/**
 * 🤝 운동 달력 2-4단계 — 함께 · 돌아보기 (2026-11-13 대표님 「시작하자」 · 「운동 달력 2단계 보고서」 2-4
 *   https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b) — 서버 값 읽기 · 계산 · 글 한 곳 (시험 calendarTogether.test.ts)
 *   감정 설계(CLAUDE.md 「회원 감정 설계 기준」 — 한 달 · 재등록 = 확신 · 안 오는 날 = 그리움(죄책감 금지)):
 *   · 일요일 주간 돌아보기 — 이번 주(월~일) 운동 시간 · 지킨 약속 · 금색 별 + 다음 주 약속 한 줄. 잘한 것만, 안 온 주엔 없다.
 *     제목 · 글은 서버 _cal_week_recap(일요일 저녁 알림)과 같은 말 — 화면에는 짝꿍과 같이 온 날 칩 하나를 더한다.
 *   · 운동 짝꿍과 같이 약속 — 지금 이어진 운동 짝꿍(한 명)의 약속 요일이 내 약속과 겹치면 서로 보인다 · 둘 다 온 날 = 쌍도장.
 *   · 이번 달 운동 카드 — 도장 달력 + 그 달 운동 시간 + 코치 한마디 + 153 로고 · 지점 이름 → 이미지(그리기는 lib/monthCardImage.ts).
 *   · 나의 153 앨범 — 그 달 '오늘 운동 한 줄'에 올린 사진.
 *   · 재등록 즈음 '153과 함께한 시간' — 수강권 끝나기 14일 전 ~ 끝나고 14일, 권유 문구 없이 첫 도장 날짜 · 지금까지 운동 시간.
 *   DB 20261113111423_calendar_stage24.sql (get_my_calendar recap · partner · set_my_weekly_recap · calendar_tick ④) —
 *   카드 · 앨범 · 함께한 시간은 이미 있는 자료(get_attendance_history · get_my_calendar)만 쓴다.
 */
import { durationLabel, type AttendanceDay, type AttendanceHistory } from "@/lib/attendanceHistory";
import { monthWeeks, weekOf } from "@/lib/attendanceCalendar";
import { monthMinutes, monthRecap, type DayMoment } from "@/lib/calendarMoments";
import { noteWho, type CalNote } from "@/lib/calendarMarks";
import { PROMISE_WEEK, slotLabel, weekKept, weekdayOfYmd, weekdaysLabel, type Promise153, type TimeSlot } from "@/lib/promise153";
import type { CalDay, JournalVisibility } from "@/lib/calendarChecks";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const SLOTS = new Set<string>(["dawn", "morning", "noon", "afternoon", "evening", "night"]);
const addDays = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

// ───────────────────────── 서버 값 ─────────────────────────
/** 운동 짝꿍 — 이름 · 짝꿍의 지금 약속(요일 0=일 · 시간대) · 보이는 날짜 중 둘 다 온 날 */
export interface CalPartner {
  name: string;
  days: number[];
  slot: TimeSlot | null;
  together: string[];
}

/** 일요일 주간 돌아보기 알림 — 켬/끔(기본 켬) · 시각 · 이 회원에게 가는지(약속 시범 지점 회원만) */
export interface CalRecapPref {
  on: boolean;
  at: string;
  sends: boolean;
}

export const RECAP_PREF_OFF: CalRecapPref = { on: true, at: "19:30", sends: false };

export function normalizePartner(raw: unknown): CalPartner | null {
  const r = obj(raw);
  const name = str(r?.name);
  if (!r || !name) return null;
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const slot = str(r.slot);
  const together = Array.isArray(r.together)
    ? [...new Set(r.together.map((d) => str(d)?.slice(0, 10) ?? "").filter((d) => YMD.test(d)))].sort()
    : [];
  return { name, days, slot: slot && SLOTS.has(slot) ? (slot as TimeSlot) : null, together };
}

export function normalizeRecapPref(raw: unknown): CalRecapPref {
  const r = obj(raw);
  if (!r) return RECAP_PREF_OFF;
  const at = str(r.at);
  return { on: r.on !== false, at: at && HM.test(at) ? at : "19:30", sends: r.sends === true };
}

// ───────────────────────── 운동 짝꿍과 같이 약속 ─────────────────────────
/** 내 약속과 짝꿍 약속이 겹치는 요일 (월요일부터) */
export function sharedDays(mine: Pick<Promise153, "weekdays"> | null | undefined, partner: CalPartner | null | undefined): number[] {
  if (!mine || !partner || partner.days.length === 0) return [];
  const theirs = new Set(partner.days);
  return PROMISE_WEEK.map((w) => w.day).filter((d) => mine.weekdays.includes(d) && theirs.has(d));
}

/** 약속 한 줄 아래 — '짝꿍 비비님과 수 · 금 같이 약속했어요' (겹칠 때만) */
export function partnerPromiseLine(mine: Pick<Promise153, "weekdays"> | null | undefined, partner: CalPartner | null | undefined): string | null {
  const shared = sharedDays(mine, partner);
  return partner && shared.length > 0 ? `짝꿍 ${partner.name}님과 ${weekdaysLabel(shared)} 같이 약속했어요` : null;
}

/** 약속 시트 — '짝꿍 비비님은 수 · 금 아침에 약속했어요' · 짝꿍이 아직 약속하지 않았으면 같이 하자는 한 줄 */
export function partnerHint(partner: CalPartner | null | undefined): string | null {
  if (!partner) return null;
  if (partner.days.length === 0) return `짝꿍 ${partner.name}님도 약속을 걸면 같은 요일이 서로 보여요`;
  const slot = slotLabel(partner.slot);
  return `짝꿍 ${partner.name}님은 ${weekdaysLabel(partner.days)}${slot ? ` ${slot}` : ""}에 약속했어요`;
}

/** 쌍도장 — 둘 다 출석한 날 */
export const isTogetherDay = (partner: CalPartner | null | undefined, day: string): boolean => !!partner && partner.together.includes(day);

export const togetherText = (partner: Pick<CalPartner, "name">): string => `짝꿍 ${partner.name}님과 같이 운동한 날이에요`;

// ───────────────────────── 일요일 주간 돌아보기 ─────────────────────────
export interface WeekRecap {
  from: string;
  to: string;
  minutes: number;
  kept: number;
  stars: number;
  /** 짝꿍과 같이 온 날 (화면에만) */
  together: number;
  /** '이번 주 3시간 46분 운동했어요' */
  title: string;
  /** '약속 3번 지켰어요' · '금색 별 1개' (잘한 것만 · 0 은 없음) */
  facts: string[];
  /** '다음 주도 월 · 수 저녁에 만나요' */
  next: string;
  hasPromise: boolean;
}

/** 다음 주 한 줄 — 서버 _cal_week_recap 과 같은 말 */
export function recapNext(p: Pick<Promise153, "weekdays" | "timeSlot"> | null | undefined): string {
  if (!p || p.weekdays.length === 0) return "다음 주도 체육관에서 만나요";
  const label = weekdaysLabel(p.weekdays);
  const slot = slotLabel(p.timeSlot);
  if (label === "매일" && !slot) return "다음 주도 매일 만나요";
  return `다음 주도 ${label}${slot ? ` ${slot}` : ""}에 만나요`;
}

/** 알림 글 — '약속 3번 지켰어요 · 금색 별 1개. 다음 주도 …' (서버 body 와 같은 말 · 짝꿍 칩은 빼고) */
export const recapBody = (r: Pick<WeekRecap, "kept" | "stars" | "next">): string => {
  const facts = [r.kept > 0 ? `약속 ${r.kept}번 지켰어요` : null, r.stars > 0 ? `금색 별 ${r.stars}개` : null].filter(Boolean);
  return facts.length ? `${facts.join(" · ")}. ${r.next}` : r.next;
};

/**
 * 이번 주(월~오늘) 돌아보기 — 일요일에만(onlySunday) · 그 주에 한 번도 안 왔으면 null.
 *   minutes = 날마다 첫 출석의 운동 시간(get_attendance_history list 그대로 — 서버 _cal_minutes_between 과 같은 식)
 *   kept = 약속한 요일에 온 날 · stars = 금색 별 날(starDay — 체크 자료가 없으면 0) · together = 짝꿍과 같이 온 날
 */
export function weekRecap(input: {
  today: string;
  list: readonly AttendanceDay[];
  promise?: Promise153 | null;
  starDay?: (day: string) => boolean;
  partner?: CalPartner | null;
  onlySunday?: boolean;
}): WeekRecap | null {
  const { today, list, promise = null, starDay, partner = null, onlySunday = true } = input;
  if (!YMD.test(today)) return null;
  if (onlySunday && weekdayOfYmd(today) !== 0) return null;
  const days = weekOf(today).filter((d) => d <= today);
  if (days.length === 0) return null;
  const byDay = new Map(list.map((d) => [d.day, d] as const));
  const came = days.filter((d) => byDay.has(d));
  if (came.length === 0) return null;
  const minutes = came.reduce((s, d) => s + Math.max(0, byDay.get(d)?.minutes ?? 0), 0);
  const kept = promise ? weekKept(promise, today, new Set(came)) : 0;
  const stars = starDay ? days.filter((d) => starDay(d)).length : 0;
  const together = partner ? came.filter((d) => partner.together.includes(d)).length : 0;
  const facts = [
    kept > 0 ? `약속 ${kept}번 지켰어요` : null,
    stars > 0 ? `금색 별 ${stars}개` : null,
    partner && together > 0 ? `짝꿍과 같이 ${together}번` : null,
  ].filter((x): x is string => !!x);
  return {
    from: days[0],
    to: today,
    minutes,
    kept,
    stars,
    together,
    title: `이번 주 ${durationLabel(minutes)} 운동했어요`,
    facts,
    next: recapNext(promise),
    hasPromise: !!promise,
  };
}

// ───────────────────────── 이번 달 운동 카드 ─────────────────────────
export interface MonthCardCell {
  day: string;
  num: number;
  inMonth: boolean;
  on: boolean;
  gold: boolean;
  together: boolean;
}

export interface MonthCardModel {
  month: string;
  /** '에이님의 11월' */
  title: string;
  minutes: number;
  /** '8시간 36분' */
  minutesText: string;
  /** '10월보다 +2시간' (늘었을 때만) */
  gain: string | null;
  weeks: MonthCardCell[][];
  /** 그 달 마지막 코치 한마디 */
  note: { body: string; who: string; day: string } | null;
  /** '선릉역점' */
  branchShort: string | null;
  sign: string;
  fileName: string;
}

export const CARD_SIGN = "153 건강과 행복. 153복싱짐";

export const branchShortOf = (b: string | null | undefined): string | null => {
  const s = str(b);
  return s ? s.replace(/^153\s*복싱짐\s*/, "").trim() || s : null;
};

/** 그 달 운동 카드 — 운동한 달만 (출석이 없으면 null) */
export function monthCardModel(input: {
  month: string;
  data: Pick<AttendanceHistory, "list" | "monthly">;
  moments?: ReadonlyMap<string, DayMoment>;
  notes?: readonly CalNote[];
  partner?: CalPartner | null;
  name?: string | null;
  branch?: string | null;
}): MonthCardModel | null {
  const { month, data, moments, notes = [], partner = null } = input;
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const byDay = new Set(data.list.map((d) => d.day));
  const weeks = monthWeeks(month).map((row) =>
    row.map((c): MonthCardCell => {
      const on = c.inMonth && byDay.has(c.day);
      return {
        day: c.day,
        num: Number(c.day.slice(8)),
        inMonth: c.inMonth,
        on,
        gold: on && !!moments?.get(c.day)?.gold,
        together: on && isTogetherDay(partner, c.day),
      };
    }),
  );
  if (!weeks.some((row) => row.some((c) => c.on))) return null;
  const minutes = monthMinutes(data, month);
  const note =
    [...notes]
      .filter((x) => x.day.startsWith(`${month}-`))
      .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
      .map((x) => ({ body: x.body, who: noteWho(x), day: x.day }))[0] ?? null;
  const name = str(input.name);
  const mm = Number(month.slice(5, 7));
  return {
    month,
    title: name ? `${name}님의 ${mm}월` : `${mm}월의 운동`,
    minutes,
    minutesText: durationLabel(minutes),
    gain: monthRecap(data, month)?.gain ?? null,
    weeks,
    note,
    branchShort: branchShortOf(input.branch),
    sign: CARD_SIGN,
    fileName: `153-운동카드-${month}.png`,
  };
}

/** '11월 12일' */
export const monthDayLabel = (day: string): string => (YMD.test(day) ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일` : "");

// ───────────────────────── 나의 153 앨범 ─────────────────────────
export interface AlbumPhoto {
  day: string;
  url: string;
  content: string;
  mood: string | null;
  visibility: JournalVisibility;
}

/** 그 달 '오늘 운동 한 줄'에 올린 사진 — 최근 날부터 */
export function albumOf(days: ReadonlyMap<string, CalDay>, month: string): AlbumPhoto[] {
  const out: AlbumPhoto[] = [];
  for (const [day, info] of days) {
    const j = info.journal;
    if (!day.startsWith(`${month}-`) || !j?.photoUrl) continue;
    // (3-5) 다이어리 사진 3장 — 한 장씩 (예전 한 줄은 photoUrl 한 장)
    const urls = j.photos?.length ? j.photos : [j.photoUrl];
    for (const url of urls) out.push({ day, url, content: j.content, mood: j.mood, visibility: j.visibility });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}

// ───────────────────────── 재등록 즈음 '153과 함께한 시간' ─────────────────────────
export const RENEWAL_BEFORE_DAYS = 14;
export const RENEWAL_AFTER_DAYS = 14;

export interface RenewalLine {
  title: string;
  /** '128시간 20분' */
  time: string;
  /** '2026년 2월 3일 첫 도장부터' */
  since: string;
  ended: boolean;
}

/** 수강권 끝나기 14일 전 ~ 끝나고 14일 — 권유 문구 없이 가치만 (운동 시간이 없으면 null) */
export function renewalLine(input: {
  membershipEnd: string | null | undefined;
  today: string;
  firstDay: string | null | undefined;
  totalMinutes: number;
}): RenewalLine | null {
  const end = str(input.membershipEnd)?.slice(0, 10) ?? null;
  const { today, firstDay, totalMinutes } = input;
  if (!end || !YMD.test(end) || !YMD.test(today) || !firstDay || !YMD.test(firstDay) || !(totalMinutes > 0)) return null;
  if (today < addDays(end, -RENEWAL_BEFORE_DAYS) || today > addDays(end, RENEWAL_AFTER_DAYS)) return null;
  const [y, m, d] = firstDay.split("-").map(Number);
  return {
    title: "153과 함께한 시간",
    time: durationLabel(totalMinutes),
    since: `${y}년 ${m}월 ${d}일 첫 도장부터`,
    ended: today > end,
  };
}
