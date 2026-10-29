/**
 * 153운영본부 · 근무 — 인정 시간 계산 (2026-10-29 대표님 · 보고서 「153운영본부 — 코치 계약 · 근태 · 급여 자동화」)
 *
 * 대표님 규칙(10-29):
 *   · 출근 = 입구 얼굴 인식(브로제이 → staff_duty_logs). 안 찍은 날은 일해도 0시간(빨강 '누락') — 지점장 · 대표님이 고친다.
 *   · 퇴근 = 코치님이 따로 하지 않는다 — 시간표 끝 시각으로 자동.
 *   · 일찍 감 · 늦게 옴 = 지점장 · 대표님이 그날 인정 시간을 고친다(adjust). 늦게 온 날은 앱이 '지각'으로 알려만 준다.
 *   · 연장 근무 = 코치 신청 → 대표님 승인된 것만 더한다. 수업 대타 = 승인되면 원래 코치에서 빠지고 대타 코치에게 붙는다.
 * 서버(ops_month)는 자료만 준다 — 계산은 이 파일 한 곳. 2단계 월 마감 때 이 결과를 확정값으로 저장한다.
 */

export type OpsKind = "parttime" | "freelancer" | "employee" | "intern" | "volunteer";
export type OpsPayType = "hourly" | "monthly" | "none";

export interface OpsStaff {
  id: string;
  user_id: string | null;
  name: string;
  kind: OpsKind;
  pay_type: OpsPayType;
  hourly_wage: number | null;
  monthly_salary: number | null;
  pt_freelancer: boolean;
  checkin_required: boolean;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  note?: string | null;
  mine?: boolean;
}

export interface OpsRule {
  id: string;
  staff_id: string;
  weekday: number; // 0 = 일요일
  start_time: string; // "HH:MM"
  end_time: string;
  valid_from: string; // "YYYY-MM-DD"
  valid_to: string | null;
}

export type OpsEntryKind = "adjust" | "off" | "overtime" | "cover";
export type OpsEntryStatus = "pending" | "approved" | "rejected" | "canceled";

export interface OpsEntry {
  id: string;
  staff_id: string;
  work_date: string;
  kind: OpsEntryKind;
  status: OpsEntryStatus;
  minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  cover_staff_id: string | null;
  reason: string | null;
  decide_note?: string | null;
  requested_by_me?: boolean;
}

export interface OpsCheckin {
  staff_id: string;
  work_date: string;
  at_hm: string; // 첫 얼굴 출근 시각 "HH:MM"
}

export interface OpsSeg {
  start: string;
  end: string;
  /** 대타로 받은 수업이면 원래 코치 이름 */
  coverFor?: string;
}

/**
 * ok 정상 · late 지각(인정은 그대로, 표시만) · missing 시간표가 있는데 출근 기록 없음(0시간) · adjusted 고친 날 ·
 * off 쉰 날 · extra 시간표 없는 날 출근 · today 오늘(아직 진행 중) · future 앞으로 · none 근무 없음
 */
export type OpsDayStatus = "ok" | "late" | "missing" | "adjusted" | "off" | "extra" | "today" | "future" | "none";

export interface OpsDay {
  date: string;
  weekday: number;
  segs: OpsSeg[];
  scheduledMin: number;
  checkin: string | null;
  creditedMin: number;
  overtimeMin: number;
  status: OpsDayStatus;
  adjust: OpsEntry | null;
  pending: OpsEntry[];
  givenAway: OpsEntry[]; // 내가 대타로 넘긴 수업(승인됨)
}

export interface OpsMonthSummary {
  days: OpsDay[];
  workDays: number;
  creditedMin: number;
  overtimeMin: number;
  missing: number;
  late: number;
  pending: number;
  /** 기본급(시간 × 시급 · 월급) — 주휴수당 · 공제는 2단계. 시급을 볼 수 없으면 null */
  basePay: number | null;
  /** 시간표 기준 한 주 시간(가장 긴 주) — 주 15시간 이상이면 주휴수당 대상 */
  weeklyScheduledMin: number;
}

/** 지각 표시 기준 — 시간표 시작보다 이만큼 늦게 찍으면 '지각' */
export const OPS_LATE_GRACE_MIN = 10;

export const OPS_KIND_LABEL: Record<OpsKind, string> = {
  parttime: "아르바이트",
  freelancer: "프리랜서 3.3%",
  employee: "4대보험",
  intern: "수습",
  volunteer: "무급 도우미",
};

export const OPS_WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 최저시급 — 그 해 1월 1일부터 (2026 · 2027 고시) */
export const MIN_WAGE: Array<{ from: string; wage: number }> = [
  { from: "2026-01-01", wage: 10320 },
  { from: "2027-01-01", wage: 10700 },
];

export const minWageOn = (date: string): number => {
  let w = MIN_WAGE[0].wage;
  for (const m of MIN_WAGE) if (date >= m.from) w = m.wage;
  return w;
};

export const hmToMin = (hm: string): number => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minToHm = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** 120 → "2시간", 90 → "1시간 30분", 45 → "45분" */
export const fmtDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

/** 시간 숫자(소수 한 자리) — 1,234.5 */
export const fmtHours = (min: number): string => {
  const v = Math.round((min / 60) * 10) / 10;
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
};

export const fmtWon = (n: number): string => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** "2026-10-01" → 그 달의 날짜 목록 */
export const monthDates = (month: string): string[] => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
};

export const weekdayOf = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** 그날 적용되는 시간표 구간 (근무 기간 밖이면 없음) */
export const rulesOn = (staff: OpsStaff, rules: OpsRule[], date: string): OpsSeg[] => {
  if (staff.start_date && date < staff.start_date) return [];
  if (staff.end_date && date > staff.end_date) return [];
  const wd = weekdayOf(date);
  return rules
    .filter((r) => r.staff_id === staff.id && r.weekday === wd && r.valid_from <= date && (!r.valid_to || r.valid_to >= date))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((r) => ({ start: r.start_time, end: r.end_time }));
};

const segMin = (s: OpsSeg) => Math.max(0, hmToMin(s.end) - hmToMin(s.start));
const overlaps = (a: OpsSeg, b: { start: string; end: string }) =>
  hmToMin(a.start) < hmToMin(b.end) && hmToMin(b.start) < hmToMin(a.end);

/** 한 사람의 하루 */
export const computeDay = (
  staff: OpsStaff,
  date: string,
  ctx: { rules: OpsRule[]; entries: OpsEntry[]; checkins: OpsCheckin[]; staffById: Map<string, OpsStaff>; today: string; nowHm?: string },
): OpsDay => {
  const mineEntries = ctx.entries.filter((e) => e.work_date === date && e.staff_id === staff.id);
  const approved = mineEntries.filter((e) => e.status === "approved");
  const off = approved.find((e) => e.kind === "off") ?? null;
  const adjust = approved.filter((e) => e.kind === "adjust").at(-1) ?? null;
  const givenAway = approved.filter((e) => e.kind === "cover");
  const overtimeMin = approved.filter((e) => e.kind === "overtime").reduce((s, e) => s + (e.minutes ?? 0), 0);
  const pending = ctx.entries.filter(
    (e) => e.work_date === date && e.status === "pending" && (e.staff_id === staff.id || e.cover_staff_id === staff.id),
  );

  // 시간표 구간 — 쉰 날이면 없음, 대타로 넘긴 수업은 빠짐
  let segs: OpsSeg[] = off ? [] : rulesOn(staff, ctx.rules, date);
  for (const g of givenAway) {
    if (!g.start_time || !g.end_time) continue;
    segs = segs.filter((s) => !overlaps(s, { start: g.start_time!, end: g.end_time! }));
  }
  // 대타로 받은 수업
  const coverIn = ctx.entries.filter(
    (e) => e.work_date === date && e.kind === "cover" && e.status === "approved" && e.cover_staff_id === staff.id && e.start_time && e.end_time,
  );
  for (const c of coverIn) {
    segs.push({ start: c.start_time!, end: c.end_time!, coverFor: ctx.staffById.get(c.staff_id)?.name ?? "동료" });
  }
  segs.sort((a, b) => a.start.localeCompare(b.start));

  const scheduledMin = segs.reduce((s, x) => s + segMin(x), 0);
  const checkin = ctx.checkins.find((c) => c.staff_id === staff.id && c.work_date === date)?.at_hm ?? null;
  const present = !!checkin || !staff.checkin_required;

  let creditedMin = 0;
  let status: OpsDayStatus = "none";

  if (adjust) {
    creditedMin = adjust.minutes ?? 0;
    status = "adjusted";
  } else if (off) {
    status = "off";
  } else if (date > ctx.today) {
    status = scheduledMin > 0 ? "future" : "none";
  } else if (scheduledMin > 0) {
    if (present) {
      creditedMin = scheduledMin;
      const late = !!checkin && segs.length > 0 && hmToMin(checkin) > hmToMin(segs[0].start) + OPS_LATE_GRACE_MIN;
      status = date === ctx.today && ctx.nowHm && hmToMin(ctx.nowHm) < hmToMin(segs[segs.length - 1].end) ? "today" : late ? "late" : "ok";
    } else if (date === ctx.today) {
      status = "today"; // 아직 출근 전일 수 있다
    } else {
      status = "missing";
    }
  } else if (checkin) {
    status = "extra"; // 시간표 없는 날 출근 — 지점장이 인정 시간을 넣으면 반영
  }

  creditedMin += overtimeMin;
  return {
    date,
    weekday: weekdayOf(date),
    segs,
    scheduledMin,
    checkin,
    creditedMin,
    overtimeMin,
    status,
    adjust,
    pending,
    givenAway,
  };
};

/** 시간표 기준 한 주 시간 — 가장 긴 주(요일별 구간 합). 주 15시간 · 월 60시간 안내에 쓴다 */
export const weeklyScheduledMin = (staff: OpsStaff, rules: OpsRule[], date: string): number =>
  [0, 1, 2, 3, 4, 5, 6].reduce((sum, wd) => {
    const segs = rules.filter(
      (r) => r.staff_id === staff.id && r.weekday === wd && r.valid_from <= date && (!r.valid_to || r.valid_to >= date),
    );
    return sum + segs.reduce((s, r) => s + Math.max(0, hmToMin(r.end_time) - hmToMin(r.start_time)), 0);
  }, 0);

/** 한 사람의 한 달 */
export const computeStaffMonth = (
  staff: OpsStaff,
  month: string,
  ctx: { rules: OpsRule[]; entries: OpsEntry[]; checkins: OpsCheckin[]; staffById: Map<string, OpsStaff>; today: string; nowHm?: string },
): OpsMonthSummary => {
  const days = monthDates(month).map((d) => computeDay(staff, d, ctx));
  const creditedMin = days.reduce((s, d) => s + d.creditedMin, 0);
  const overtimeMin = days.reduce((s, d) => s + d.overtimeMin, 0);
  const workDays = days.filter((d) => d.creditedMin > 0).length;
  const missing = days.filter((d) => d.status === "missing").length;
  const late = days.filter((d) => d.status === "late").length;
  const pending = ctx.entries.filter((e) => e.status === "pending" && e.staff_id === staff.id).length;

  let basePay: number | null = null;
  if (staff.pay_type === "hourly" && staff.hourly_wage != null) basePay = Math.round((creditedMin / 60) * staff.hourly_wage);
  else if (staff.pay_type === "monthly" && staff.monthly_salary != null) basePay = staff.monthly_salary;
  else if (staff.pay_type === "none") basePay = 0;

  const ref = ctx.today >= month && ctx.today <= monthDates(month).at(-1)! ? ctx.today : month;
  return {
    days,
    workDays,
    creditedMin,
    overtimeMin,
    missing,
    late,
    pending,
    basePay,
    weeklyScheduledMin: weeklyScheduledMin(staff, ctx.rules, ref),
  };
};

/** 시간표 한 줄 요약 — "월·수·금 06:00~09:00 · 화 19:00~22:00" */
export const scheduleSummary = (staff: OpsStaff, rules: OpsRule[], date: string): string => {
  const active = rules.filter((r) => r.staff_id === staff.id && r.valid_from <= date && (!r.valid_to || r.valid_to >= date));
  if (active.length === 0) return "";
  // 같은 시간대끼리 요일을 묶는다
  const byTime = new Map<string, number[]>();
  for (const r of active) {
    const key = `${r.start_time}~${r.end_time}`;
    byTime.set(key, [...(byTime.get(key) ?? []), r.weekday]);
  }
  return [...byTime.entries()]
    .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]) || a[0].localeCompare(b[0]))
    .map(([t, wds]) => `${[...new Set(wds)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => OPS_WEEKDAY[w]).join("·")} ${t}`)
    .join(" · ");
};

/** 주 15시간 · 월 60시간 안내 (근로자 형태만) */
export const laborNotices = (staff: OpsStaff, weeklyMin: number, monthMin: number): string[] => {
  if (staff.kind === "freelancer" || staff.kind === "volunteer") return [];
  const out: string[] = [];
  if (weeklyMin >= 15 * 60) out.push("주 15시간 이상 — 주휴수당 대상");
  if (monthMin >= 60 * 60 || weeklyMin * 4.345 >= 60 * 60) out.push("월 60시간 이상 — 4대보험 가입 대상");
  return out;
};
