/**
 * 🌟 운동 달력 — 그날의 의미 · 달 돌아보기
 *   (2026-11-12 대표님 「달력 기능 스케줄러 기능도 목표는 회원님들의 감정을 설계하는 거야」 — CLAUDE.md 「회원 감정 설계 기준」)
 *   끝난 뒤 '오길 잘했다'가 남게 — 잘한 것만 · 숫자는 시간으로 · 한 번에 한 줄.
 *   · 기념일(금색 도장): 첫 도장을 찍은 날 · 출석 축하를 채운 날(서버 milestones.reachedOn 그대로)
 *   · 그날 한 줄(글만): 다시 시작한 날(14일 넘게 쉬고 온 날 — 쉰 기간은 말하지 않는다) ·
 *     그 달 가장 길게 운동한 날(운동 시간을 실제로 잰 날만 · 그 달에 3번 이상 왔을 때)
 *   · 달 돌아보기: 지난 달을 넘겨 보면 '10월 · 14시간 12분 운동했어요'(앞 달보다 늘었을 때만 '+2시간')
 *     새 달 첫 7일에는 지난달 한 줄 — 이번 달 숫자는 홈 '내 운동'이 주인공이라 여기서 다시 쓰지 않는다(같은 숫자는 한 화면에 한 번).
 *   모두 get_attendance_history 가 준 기록만 쓴다(DB 변경 없음). 시험 calendarMoments.test.ts
 */
import { MIN_GAIN_MINUTES } from "@/lib/attendanceCheer";
import { durationLabel, measuredDay, type AttendanceDay, type AttendanceHistory } from "@/lib/attendanceHistory";
import { shiftMonth } from "@/lib/attendanceCalendar";

export type MomentKind = "first" | "milestone" | "restart" | "longest";

export interface DayMoment {
  kind: MomentKind;
  /** 그날 한 줄 — '~날이에요' */
  text: string;
  /** 금색 도장으로 그리나 (첫 도장 · 출석 축하만 — 드물어야 기념일이다) */
  gold: boolean;
}

/** 이만큼(일) 쉬고 온 날 = 다시 시작한 날 */
export const RESTART_GAP_DAYS = 14;
/** 그 달에 이만큼 왔을 때부터 '가장 길게 운동한 날'을 말한다 */
export const LONGEST_MIN_DAYS = 3;
/** 새 달 첫 며칠 동안 지난달 돌아보기를 보여 주나 */
export const RECAP_FIRST_DAYS = 7;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const utc = (ymd: string): number | null => {
  const m = YMD.exec(ymd);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const gapDays = (from: string, to: string): number | null => {
  const a = utc(from);
  const b = utc(to);
  return a == null || b == null ? null : Math.round((b - a) / 86_400_000);
};
const n = (v: number) => v.toLocaleString("ko-KR");
/** 'YYYY-MM' → '10월' */
const mm = (ym: string): string => `${Number(ym.slice(5, 7))}월`;

/** 날짜 → 그날의 의미 (한 날에 하나 — 첫 도장 > 출석 축하 > 다시 시작 > 가장 길게) */
export function dayMoments(
  data: Pick<AttendanceHistory, "list" | "milestones">,
  today: string,
): Map<string, DayMoment> {
  const out = new Map<string, DayMoment>();
  const days = [...new Map(data.list.filter((d) => YMD.test(d.day)).map((d) => [d.day, d] as const)).values()].sort((a, b) =>
    a.day.localeCompare(b.day),
  );
  if (days.length === 0) return out;

  // 그 달 가장 길게 운동한 날 — 실제로 잰 날 하나가 뚜렷이 가장 길 때만
  const byMonth = new Map<string, AttendanceDay[]>();
  for (const d of days) {
    const k = d.day.slice(0, 7);
    const arr = byMonth.get(k);
    if (arr) arr.push(d);
    else byMonth.set(k, [d]);
  }
  for (const [ym, items] of byMonth) {
    if (items.length < LONGEST_MIN_DAYS) continue;
    const max = Math.max(...items.map((d) => d.minutes));
    const top = items.filter((d) => d.minutes === max);
    if (top.length !== 1 || !measuredDay(top[0])) continue;
    out.set(top[0].day, {
      kind: "longest",
      text: `${ym === today.slice(0, 7) ? "이번 달" : `${mm(ym)}에`} 가장 길게 운동한 날이에요`,
      gold: false,
    });
  }

  // 다시 시작한 날 — 쉰 기간은 말하지 않는다
  for (let i = 1; i < days.length; i++) {
    const gap = gapDays(days[i - 1].day, days[i].day);
    if (gap != null && gap >= RESTART_GAP_DAYS) out.set(days[i].day, { kind: "restart", text: "다시 시작한 날이에요", gold: false });
  }

  // 출석 축하를 채운 날 — 서버가 준 날짜 그대로
  for (const m of [...data.milestones].sort((a, b) => a.milestone - b.milestone)) {
    if (m.milestone > 0 && m.reachedOn && YMD.test(m.reachedOn)) {
      out.set(m.reachedOn, { kind: "milestone", text: `출석 ${n(m.milestone)}회를 채운 날이에요`, gold: true });
    }
  }

  // 첫 도장 — 기록이 시작된 뒤 처음 찍은 날 ('153에서의 첫날'이라고는 하지 않는다 — 오래 다닌 회원에게는 사실이 아니다)
  out.set(days[0].day, { kind: "first", text: "첫 도장을 찍은 날이에요", gold: true });
  return out;
}

/** 그 달 운동 시간(분) — 서버 월별 값이 있으면 그 값(내 운동 기록 그래프와 같은 숫자), 없으면 날마다 목록에서 */
export function monthMinutes(data: Pick<AttendanceHistory, "list" | "monthly">, ym: string): number {
  const m = data.monthly.find((x) => x.month === ym);
  if (m) return Math.max(0, m.minutes);
  let sum = 0;
  for (const d of data.list) if (d.day.startsWith(`${ym}-`)) sum += Math.max(0, Number.isFinite(d.minutes) ? d.minutes : 0);
  return sum;
}

export interface MonthRecap {
  month: string;
  minutes: number;
  /** '10월 · 14시간 12분 운동했어요' */
  text: string;
  /** 앞 달보다 늘었을 때만 — '9월보다 +2시간' (줄어든 것은 말하지 않는다) */
  gain: string | null;
}

/** 지난 달 돌아보기 — 운동한 달만 */
export function monthRecap(data: Pick<AttendanceHistory, "list" | "monthly">, ym: string): MonthRecap | null {
  const minutes = monthMinutes(data, ym);
  if (minutes <= 0) return null;
  const prev = shiftMonth(ym, -1);
  const prevMinutes = monthMinutes(data, prev);
  const diff = minutes - prevMinutes;
  return {
    month: ym,
    minutes,
    text: `${mm(ym)} · ${durationLabel(minutes)} 운동했어요`,
    gain: prevMinutes > 0 && diff >= MIN_GAIN_MINUTES ? `${mm(prev)}보다 +${durationLabel(diff)}` : null,
  };
}

/** 새 달 첫 7일 — 지난달 한 줄과 다음 한 걸음 ('지난달 14시간 12분 운동했어요 · 11월도 이어 가요'). 지난달에 운동했을 때만 */
export function freshStartLine(data: Pick<AttendanceHistory, "list" | "monthly">, today: string): string | null {
  if (!YMD.test(today) || Number(today.slice(8, 10)) > RECAP_FIRST_DAYS) return null;
  const ym = today.slice(0, 7);
  const minutes = monthMinutes(data, shiftMonth(ym, -1));
  return minutes > 0 ? `지난달 ${durationLabel(minutes)} 운동했어요 · ${mm(ym)}도 이어 가요` : null;
}
