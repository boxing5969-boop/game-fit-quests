/**
 * 📅 출석 기록 전체 — 회원 본인(내 출석 기록) · 관리자 · 지점장(회원 상세 '출석' 탭) 공용 (2026-10-21 대표님)
 *   "관리자와 지점장은 회원 상세보기 들어가면 회원이 총 몇 회 출석했는지 전체 출석 확인할 수 있게,
 *    회원님들의 출석 기록도 확인할 수 있게, 그래프랑 UI 를 깔끔하게"
 *
 *   서버 정본: get_attendance_history(p_user_id) — supabase/migrations/20261021212901_attendance_history.sql
 *   출석 1회 = 그날(KST) 첫 인정 출석. 이 파일은 응답을 안전하게 읽고 그래프 · 목록용으로 다듬는다.
 */

export interface AttendanceDay {
  /** 'YYYY-MM-DD' (KST) */
  day: string;
  /** 체크인 시각 ISO */
  at: string;
  end: string | null;
  method: string;
  branch: string | null;
}

export interface MonthCount {
  /** 'YYYY-MM' */
  month: string;
  days: number;
}

export type HourBucket = "dawn" | "morning" | "noon" | "afternoon" | "evening" | "night";

export interface AttendanceHistory {
  total: number;
  month: number;
  lastMonth: number;
  weeks8: number;
  firstDay: string | null;
  lastDay: string | null;
  recordsSince: string;
  /** 오래된 달 → 이번 달 (기록 시작 전 달은 뺀다) */
  monthly: MonthCount[];
  /** 월 ~ 일 (7칸) */
  weekday: number[];
  hours: Record<HourBucket, number>;
  /** 최근 순 */
  list: AttendanceDay[];
  milestones: { milestone: number; reachedOn: string | null; gems: number; mileage: number }[];
}

export const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const HOUR_BUCKETS: { key: HourBucket; label: string; range: string }[] = [
  { key: "dawn", label: "새벽", range: "0–6시" },
  { key: "morning", label: "아침", range: "6–11시" },
  { key: "noon", label: "점심", range: "11–14시" },
  { key: "afternoon", label: "오후", range: "14–18시" },
  { key: "evening", label: "저녁", range: "18–21시" },
  { key: "night", label: "밤", range: "21–24시" },
];

const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** 서버 JSON → 화면용 */
export function normalizeAttendanceHistory(raw: unknown): AttendanceHistory {
  const r = obj(raw);
  const recordsSince = str(r.records_since) ?? "2026-02-01";
  const sinceMonth = recordsSince.slice(0, 7);
  const monthly = (Array.isArray(r.monthly) ? r.monthly : [])
    .map((m) => obj(m))
    .map((m) => ({ month: str(m.month) ?? "", days: int(m.days) }))
    .filter((m) => /^\d{4}-\d{2}$/.test(m.month) && m.month >= sinceMonth)
    .sort((a, b) => a.month.localeCompare(b.month));
  const wd = Array.isArray(r.weekday) ? r.weekday : [];
  const weekday = Array.from({ length: 7 }, (_, i) => int(wd[i]));
  const h = obj(r.hours);
  const hours = Object.fromEntries(HOUR_BUCKETS.map((b) => [b.key, int(h[b.key])])) as Record<HourBucket, number>;
  const list = (Array.isArray(r.list) ? r.list : [])
    .map((x) => obj(x))
    .map((x) => ({
      day: str(x.day) ?? "",
      at: str(x.at) ?? "",
      end: str(x.end),
      method: str(x.method) ?? "",
      branch: str(x.branch),
    }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.day) && x.at)
    .sort((a, b) => b.day.localeCompare(a.day));
  const milestones = (Array.isArray(r.milestones) ? r.milestones : [])
    .map((m) => obj(m))
    .map((m) => ({ milestone: int(m.milestone), reachedOn: str(m.reached_on), gems: int(m.gems), mileage: int(m.mileage) }))
    .filter((m) => m.milestone > 0)
    .sort((a, b) => a.milestone - b.milestone);
  return {
    total: int(r.total),
    month: int(r.month),
    lastMonth: int(r.last_month),
    weeks8: int(r.weeks8),
    firstDay: str(r.first_day),
    lastDay: str(r.last_day),
    recordsSince,
    monthly,
    weekday,
    hours,
    list,
    milestones,
  };
}

/** 최근 8주 주 평균 (소수 한 자리) */
export const weeklyAverage = (weeks8: number): number => Math.round((Math.max(0, weeks8) / 8) * 10) / 10;

/** 가장 많이 온 시간대 — 출석이 없으면 null */
export function topHourBucket(hours: Record<HourBucket, number>) {
  let best: (typeof HOUR_BUCKETS)[number] | null = null;
  let max = 0;
  for (const b of HOUR_BUCKETS) {
    const v = hours[b.key] ?? 0;
    if (v > max) {
      max = v;
      best = b;
    }
  }
  return best ? { ...best, count: max } : null;
}

/** 가장 많이 온 요일 인덱스(0=월) — 없으면 -1 */
export function topWeekday(weekday: number[]): number {
  let idx = -1;
  let max = 0;
  weekday.forEach((v, i) => {
    if (v > max) {
      max = v;
      idx = i;
    }
  });
  return idx;
}

/** 목록을 달별로 묶기 — 최근 달 먼저 */
export function groupByMonth(list: AttendanceDay[]): { month: string; items: AttendanceDay[] }[] {
  const out: { month: string; items: AttendanceDay[] }[] = [];
  for (const d of list) {
    const m = d.day.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === m) last.items.push(d);
    else out.push({ month: m, items: [d] });
  }
  return out;
}

/** '2026-10' → '2026년 10월' / short: '10월' */
export const monthLabel = (ym: string, short = false): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return short ? `${Number(m[2])}월` : `${m[1]}년 ${Number(m[2])}월`;
};

/** '2026-10-21' → '10.21 (화)' */
export const dayLabel = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  // 그 날짜의 요일 (UTC 정오로 만들어 시간대와 상관없이)
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay(); // 0=일
  return `${Number(m[2])}.${Number(m[3])} (${WEEKDAY_KO[(dow + 6) % 7]})`;
};

/** 체크인 시각 → 'HH:mm' (KST) */
export const kstTime = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + 9 * 3600_000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

/** 출석 방법 이름 */
export const methodLabel = (m: string): string =>
  m === "qr_manual" ? "QR 출석" : m === "broj" || m === "face" ? "얼굴 인식" : "출석";

/** 운동 시간(분) — 퇴실 기록이 있고 10분~10시간일 때만 */
export function sessionMinutes(d: AttendanceDay): number | null {
  if (!d.end) return null;
  const mins = Math.round((new Date(d.end).getTime() - new Date(d.at).getTime()) / 60000);
  return Number.isFinite(mins) && mins >= 10 && mins <= 600 ? mins : null;
}
