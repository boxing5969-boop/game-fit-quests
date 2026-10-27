/**
 * 🏢 지점 회의실 정기 회의 예약 — 화면 글 · 날짜 계산 (2026-10-27 · DB 20261027225255_office_schedules.sql)
 *   서버 _office_next_at · _office_schedule_when 과 같은 규칙. 시각은 모두 한국 시간(UTC+9, 서머타임 없음) —
 *   기기 시간대가 달라도(해외 출장 · 시뮬레이터) 같은 글이 나오게 UTC 로 계산한다.
 */

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** 화면에 늘어놓는 순서 — 월요일부터 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** 미리 알림 (서버 check 와 같다) */
export const REMIND_OPTIONS = [0, 5, 10, 30, 60] as const;
/** '지금 열기'가 보이는 때 — 시작 1시간 안 (서버 office_schedule_open_now 가 이 차례를 한 것으로 치는 범위) */
export const OPEN_NOW_WITHIN_MIN = 60;

const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** '10:00' → '오전 10:00' · '15:05' → '오후 3:05' · '00:00' → '오전 12:00' · '12:30' → '오후 12:30' */
export function clockLabel(hhmm: string): string {
  const m = HHMM.exec((hhmm ?? "").trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${m[2]}`;
}

/** 'YYYY-MM-DD' → '10월 28일 (수)' */
export function dayLabel(ymd: string): string {
  const m = YMD.exec(ymd ?? "");
  if (!m) return ymd;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return `${mo}월 ${d}일 (${WEEKDAY_KO[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]})`;
}

/** 요일 정리 — 0~6 만, 겹침 없이, 작은 수부터 */
export const cleanWeekdays = (days: readonly number[]) =>
  [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);

/** 반복 글 — '매주 월 · 수' · '평일' · '매일' · (한 번만) '10월 28일 (수)' */
export function repeatLabel(weekdays: readonly number[], onceOn: string | null | undefined): string {
  if (onceOn) return dayLabel(onceOn);
  const days = cleanWeekdays(weekdays);
  if (days.length === 7) return "매일";
  if (days.join(",") === "1,2,3,4,5") return "평일";
  return `매주 ${WEEK_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_KO[d])
    .join(" · ")}`;
}

/** 서버 알림 글과 같다 — '매주 월 · 수 오전 10:00' */
export const whenLabel = (weekdays: readonly number[], onceOn: string | null | undefined, at: string) =>
  `${repeatLabel(weekdays, onceOn)} ${clockLabel(at)}`;

/** '10분 전 알림' · '1시간 전 알림' · '알림 안 함' */
export const remindLabel = (min: number) => (min <= 0 ? "알림 안 함" : min === 60 ? "1시간 전 알림" : `${min}분 전 알림`);
/** 고르는 칸 글 — '안 함' · '10분 전' · '1시간 전' */
export const remindChip = (min: number) => (min <= 0 ? "안 함" : min === 60 ? "1시간 전" : `${min}분 전`);

/** 한국 날짜 'YYYY-MM-DD' (기기 시간대와 상관없이) */
export function kstYmd(d: Date): string {
  const k = new Date(d.getTime() + KST_MS);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}

/** 한국 시각 'HH:MM' */
export function kstHHMM(d: Date): string {
  const k = new Date(d.getTime() + KST_MS);
  return `${pad2(k.getUTCHours())}:${pad2(k.getUTCMinutes())}`;
}

/** 다음 시작 시각 — 서버 _office_next_at 과 같은 식 (매주: after 이후 첫 요일 · 시간, 한 번: 그날 그 시간 · 지났으면 null) */
export function nextOccurrence(
  weekdays: readonly number[],
  onceOn: string | null | undefined,
  at: string,
  after: Date = new Date(),
): Date | null {
  const t = HHMM.exec((at ?? "").trim());
  if (!t) return null;
  const hh = Number(t[1]);
  const mm = Number(t[2]);
  const startOf = (y: number, mo: number, d: number) => new Date(Date.UTC(y, mo, d, hh, mm) - KST_MS);
  if (onceOn) {
    const m = YMD.exec(onceOn);
    if (!m) return null;
    const s = startOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return s.getTime() >= after.getTime() ? s : null;
  }
  const days = cleanWeekdays(weekdays);
  if (!days.length) return null;
  const k = new Date(after.getTime() + KST_MS);
  for (let i = 0; i <= 7; i++) {
    const day = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + i));
    if (!days.includes(day.getUTCDay())) continue;
    const s = startOf(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    if (s.getTime() >= after.getTime()) return s;
  }
  return null;
}

/** 다음 회의 글 — '오늘 오후 3:00' · '내일 오전 10:00' · '10월 30일 (금) 오전 10:00' */
export function nextLabel(at: string | Date, now: Date = new Date()): string {
  const t = typeof at === "string" ? new Date(at) : at;
  const ymd = kstYmd(t);
  const clock = clockLabel(kstHHMM(t));
  if (ymd === kstYmd(now)) return `오늘 ${clock}`;
  if (ymd === kstYmd(new Date(now.getTime() + DAY_MS))) return `내일 ${clock}`;
  return `${dayLabel(ymd)} ${clock}`;
}

/** 시작까지 남은 분 (지났으면 0 이하) */
export const minutesUntil = (at: string | Date, now: Date = new Date()) =>
  Math.ceil(((typeof at === "string" ? new Date(at) : at).getTime() - now.getTime()) / 60_000);

/** 곧 시작 — 시작 1시간 안 (지난 것은 아님) */
export const startsSoon = (at: string | null | undefined, now: Date = new Date(), withinMin = OPEN_NOW_WITHIN_MIN) =>
  !!at && minutesUntil(at, now) > 0 && minutesUntil(at, now) <= withinMin;

/** 남은 시간 글 — '12분 뒤' · '1시간 뒤' · '곧' */
export function soonLabel(at: string, now: Date = new Date()): string {
  const m = minutesUntil(at, now);
  if (m <= 1) return "곧";
  if (m >= 60 && m % 60 === 0) return `${m / 60}시간 뒤`;
  return `${m}분 뒤`;
}

/** 예약 시트 입력 */
export interface ScheduleDraft {
  title: string;
  mode: "weekly" | "once";
  weekdays: number[];
  /** 'YYYY-MM-DD' */
  onceOn: string;
  /** 'HH:MM' */
  at: string;
}

/** 저장 전에 화면에서 먼저 거르는 것 (서버도 같은 검사를 한다) — 문제없으면 null */
export function scheduleDraftError(d: ScheduleDraft, now: Date = new Date()): string | null {
  if (!d.title.trim()) return "회의 이름을 적어 주세요";
  if (d.title.trim().length > 80) return "회의 이름은 80자까지 적을 수 있어요";
  if (!HHMM.test(d.at.trim())) return "시간을 골라 주세요";
  if (d.mode === "weekly") {
    if (cleanWeekdays(d.weekdays).length === 0) return "요일을 하나 이상 골라 주세요";
    return null;
  }
  if (!YMD.test(d.onceOn)) return "날짜를 골라 주세요";
  if (!nextOccurrence([], d.onceOn, d.at, now)) return "이미 지난 시간이에요 — 날짜나 시간을 바꿔 주세요";
  return null;
}
