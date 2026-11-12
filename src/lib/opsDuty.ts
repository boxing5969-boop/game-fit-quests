/**
 * 153운영본부 · 근무 — 출근 확정 1단계 (2026-11-12 대표님 「추천대로하자」 · 보고서 「코치 근무·PT 정직 체크 방법 보고서」
 *   https://claude.ai/artifact/THLBCi9iNUkyaonYXc3z2U · DB 20261112225136_ops_work_stage1.sql)
 *
 *   하루가 확정되는 길은 두 가지뿐 — 얼굴 인식이 시간표와 맞거나, 코치 신고를 지점장 · 대표님이 승인하거나.
 *   코치 신고: here 와 있었어요(얼굴 인식 안 됨 · 온 시각) · early 일찍 퇴근(나간 시각) · off 쉬는 날.
 *   승인되면 서버가 그날 인정 시간을 고친 기록(ops_day_entries adjust / off)을 만든다 → 계산은 그대로 src/lib/opsWork.ts.
 *   출근 알림(서버 5분 예약): 시간표 시작 15분 뒤 코치 · 60분 뒤 지점장(대표님이 지점마다 켬, 근로 코치만).
 *
 *   글 · 검사는 서버와 같은 말(ops_duty_report_send · _ops_duty_kind_text). 인정 시간 제안(dutyProposedMinutes)은
 *   computeDay 와 같은 기준 — 늦게 온 것이 10분(OPS_LATE_GRACE_MIN) 안이면 시간표대로.
 */
import { OPS_LATE_GRACE_MIN, fmtDuration, hmToMin, type OpsDay } from "./opsWork";

export type DutyKind = "here" | "early" | "off";
export type DutyStatus = "open" | "approved" | "rejected" | "canceled";

export interface DutyReport {
  id: string;
  staff_id: string;
  staff_name: string;
  work_date: string;
  kind: DutyKind;
  /** "HH:MM" — here 온 시각 · early 나간 시각 */
  at_time: string | null;
  /** 신고대로 인정할 시간(분) — 승인 때 고칠 수 있다 */
  minutes: number | null;
  note: string | null;
  status: DutyStatus;
  created_at: string;
  /** 내가 보낸 신고 */
  mine: boolean;
  decided_at: string | null;
  decide_note: string | null;
}

export interface DutySetting {
  on: boolean;
  coach_after_min: number;
  manager_after_min: number;
  started_on: string | null;
}

export interface DutyData {
  /** 서버에 출근 신고 함수가 있다(없으면 신고 단추 · 목록을 숨긴다 — DB 적용 전 · 옛 DB 미리보기) */
  available: boolean;
  branch: string;
  manage: boolean;
  /** 출근 알림을 켜고 끌 수 있다(대표님) */
  can_set: boolean;
  today: string;
  setting: DutySetting;
  reports: DutyReport[];
  /** 예시 자료(?demo=1) */
  sample?: boolean;
}

export const DUTY_DEFAULT_SETTING: DutySetting = { on: false, coach_after_min: 15, manager_after_min: 60, started_on: null };
/** 지난 날 신고는 14일 안까지(서버와 같음) */
export const DUTY_BACK_DAYS = 14;

export const DUTY_KIND_LABEL: Record<DutyKind, string> = { here: "와 있었어요", early: "일찍 퇴근", off: "쉬는 날" };
export const DUTY_KIND_HINT: Record<DutyKind, string> = {
  here: "얼굴 인식이 안 됐어요 — 온 시각을 알려 주세요",
  early: "시간표보다 일찍 나갔어요 — 나간 시각을 알려 주세요",
  off: "그날은 쉬는 날이었어요",
};
export const DUTY_STATUS: Record<DutyStatus, { label: string; cls: string }> = {
  open: { label: "확인 기다림", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "반영", cls: "bg-primary/10 text-primary" },
  rejected: { label: "반려", cls: "bg-destructive/10 text-destructive" },
  canceled: { label: "취소", cls: "bg-muted text-muted-foreground" },
};

/** 신고 한 줄 — 서버 _ops_duty_kind_text 와 같은 말 */
export const dutyKindText = (kind: DutyKind, at: string | null): string =>
  kind === "here" ? `와 있었어요 ${at ?? ""}(얼굴 인식 안 됨)` : kind === "early" ? `일찍 퇴근 ${at ?? ""}` : "쉬는 날이에요";

const dayNum = (d: string) => Math.round(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000);
/** b − a (일) */
export const dutyDayDiff = (a: string, b: string) => dayNum(b) - dayNum(a);

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHm = (s: string | null | undefined): s is string => !!s && HM.test(s);

/**
 * 신고대로 인정할 시간 제안(분) — 시간표 구간(대타로 넘긴 수업 빼고 · 받은 수업 더함)으로 센다.
 *   here : 온 시각부터 끝까지 — 첫 구간 시작 + 10분 안에 왔으면 시간표대로(얼굴 인식이 늦게 찍힌 날과 같은 기준)
 *   early: 시작부터 나간 시각까지
 *   off  : 0
 *   시간표가 없는 날 · 시각이 없으면 null(지점장이 정한다)
 */
export const dutyProposedMinutes = (day: Pick<OpsDay, "segs">, kind: DutyKind, at: string | null): number | null => {
  if (kind === "off") return 0;
  if (!isHm(at) || day.segs.length === 0) return null;
  const t = hmToMin(at);
  if (kind === "here") {
    const first = hmToMin(day.segs[0].start);
    const from = t <= first + OPS_LATE_GRACE_MIN ? 0 : t;
    return day.segs.reduce((s, x) => s + Math.max(0, hmToMin(x.end) - Math.max(hmToMin(x.start), from)), 0);
  }
  return day.segs.reduce((s, x) => s + Math.max(0, Math.min(hmToMin(x.end), t) - hmToMin(x.start)), 0);
};

/** 승인 줄 아래 한마디 — "인정 2시간 50분 · 시간표 3시간" */
export const dutyMinutesLine = (minutes: number | null, scheduledMin: number | null): string => {
  if (minutes == null) return scheduledMin ? `시간표 ${fmtDuration(scheduledMin)} · 인정 시간은 지점장님이 정해요` : "인정 시간은 지점장님이 정해요";
  if (scheduledMin != null && scheduledMin > 0 && minutes !== scheduledMin) return `인정 ${fmtDuration(minutes)} · 시간표 ${fmtDuration(scheduledMin)}`;
  return `인정 ${fmtDuration(minutes)}${scheduledMin ? " · 시간표대로" : ""}`;
};

export interface DutyDraft {
  kind: DutyKind | null;
  date: string;
  /** "HH:MM" */
  at: string;
  note: string;
}

/** 보내기 전 검사 — 서버(ops_duty_report_send)와 같은 말 */
export const dutyDraftError = (d: DutyDraft, ctx: { today: string; nowHm: string; checkedIn: boolean }): string | null => {
  if (!d.kind) return "무엇을 알릴지 골라 주세요";
  if (!d.date) return "날짜를 골라 주세요";
  if (d.date > ctx.today) return "아직 오지 않은 날은 신고할 수 없어요";
  if (dutyDayDiff(d.date, ctx.today) > DUTY_BACK_DAYS) return "14일이 지난 날은 지점장님께 말씀해 주세요";
  if (d.kind !== "off") {
    if (!isHm(d.at)) return "시각을 넣어 주세요";
    if (d.date === ctx.today && isHm(ctx.nowHm) && hmToMin(d.at) - hmToMin(ctx.nowHm) > 5) return "아직 오지 않은 시각이에요";
  }
  if (d.kind === "here" && ctx.checkedIn) return "이날은 얼굴 출근이 찍혀 있어요 — 시각이 다르면 지점장님께 말씀해 주세요";
  return null;
};

export const dutyPayload = (staffId: string, d: DutyDraft, minutes: number | null) => ({
  staff_id: staffId,
  work_date: d.date,
  kind: d.kind,
  at_time: d.kind === "off" ? null : d.at,
  minutes: d.kind === "off" ? null : minutes,
  note: d.note.trim() || null,
});
export type DutyPayload = ReturnType<typeof dutyPayload>;

/** 그날 · 그 사람의 신고 중 살아 있는 것(열림 · 반영) */
export const dutyLiveFor = (reports: DutyReport[], staffId: string, date: string): DutyReport[] =>
  reports.filter((r) => r.staff_id === staffId && r.work_date === date && (r.status === "open" || r.status === "approved"));

/** 열린 신고(관리자 '확인할 것') */
export const dutyOpen = (reports: DutyReport[]): DutyReport[] => reports.filter((r) => r.status === "open");

/**
 * 코치 화면 맨 위 — 오늘 시간표가 시작되고 알림 분이 지났는데 얼굴 출근 · 고친 기록 · 신고가 없으면 "출근 기록이 아직 없어요".
 *   서버 출근 알림(ops_duty_tick)과 같은 조건 — 알림을 못 받았어도 화면에서 같은 말을 본다(알림이 꺼진 지점도).
 */
export const dutyTodayNudge = (
  day: OpsDay | null,
  ctx: { nowHm: string; afterMin: number; reports: DutyReport[]; staffId: string },
): { start: string } | null => {
  if (!day || day.checkin || day.segs.length === 0 || day.adjust || day.status === "off") return null;
  if (!isHm(ctx.nowHm) || hmToMin(ctx.nowHm) < hmToMin(day.segs[0].start) + ctx.afterMin) return null;
  if (dutyLiveFor(ctx.reports, ctx.staffId, day.date).length > 0) return null;
  return { start: day.segs[0].start };
};

/** 신고할 수 있는 지난 날 — 14일 안 · 출근 기록 없음(누락) · 살아 있는 신고 없음(최근 날 먼저) */
export const dutyMissingDays = (days: OpsDay[], ctx: { today: string; reports: DutyReport[]; staffId: string }): OpsDay[] =>
  days
    .filter(
      (d) =>
        d.status === "missing" &&
        d.date < ctx.today &&
        dutyDayDiff(d.date, ctx.today) <= DUTY_BACK_DAYS &&
        dutyLiveFor(ctx.reports, ctx.staffId, d.date).length === 0,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

/** 신고 시트의 처음 시각 — here: 오늘이면 지금(시간표 시작보다 이르면 시작), 지난 날이면 시작 · early: 오늘이면 지금, 지난 날이면 끝 */
export const dutyDefaultAt = (kind: DutyKind, day: Pick<OpsDay, "date" | "segs">, today: string, nowHm: string): string => {
  const first = day.segs[0]?.start ?? "";
  const last = day.segs[day.segs.length - 1]?.end ?? "";
  if (kind === "here") {
    if (day.date === today && isHm(nowHm)) return isHm(first) && hmToMin(nowHm) < hmToMin(first) ? first : nowHm;
    return isHm(first) ? first : "09:00";
  }
  if (kind === "early") {
    if (day.date === today && isHm(nowHm)) return nowHm;
    return isHm(last) ? last : "18:00";
  }
  return "";
};

// ───────── 예시 화면(?demo=1) — 지어낸 근무자, 서버를 부르지 않는다 ─────────
export const DUTY_SAMPLE_STAFF = { me: "demo-duty-me", a: "demo-duty-a", b: "demo-duty-b" } as const;

const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);

/** 관리자 예시 = 열린 신고 2 + 처리 1 · 코치 예시 = 내 신고 1(어제 쉬는 날 반영) */
export const buildDutySample = (today: string, manage: boolean): DutyData => {
  const at = (d: string) => `${d}T10:00:00+09:00`;
  const all: DutyReport[] = [
    {
      id: "demo-duty-1", staff_id: DUTY_SAMPLE_STAFF.a, staff_name: "예시 코치 A", work_date: today, kind: "here", at_time: "18:05",
      minutes: 180, note: "입구에서 인식이 안 됐어요", status: "open", created_at: at(today), mine: false, decided_at: null, decide_note: null,
    },
    {
      id: "demo-duty-2", staff_id: DUTY_SAMPLE_STAFF.b, staff_name: "예시 코치 B", work_date: addDays(today, -1), kind: "early", at_time: "20:30",
      minutes: 150, note: "회원 상담이 일찍 끝났어요", status: "open", created_at: at(today), mine: false, decided_at: null, decide_note: null,
    },
    {
      id: "demo-duty-3", staff_id: DUTY_SAMPLE_STAFF.me, staff_name: "예시 코치(나)", work_date: addDays(today, -2), kind: "off", at_time: null,
      minutes: null, note: null, status: "approved", created_at: at(addDays(today, -2)), mine: true, decided_at: at(addDays(today, -1)), decide_note: "확인했어요",
    },
  ];
  return {
    available: true,
    branch: "예시 지점",
    manage,
    can_set: manage,
    today,
    setting: { on: true, coach_after_min: 15, manager_after_min: 60, started_on: addDays(today, -7) },
    reports: manage ? all : all.filter((r) => r.staff_id === DUTY_SAMPLE_STAFF.me),
    sample: true,
  };
};

export type DutyDemoAction =
  | { type: "send"; p: DutyPayload; staffName: string }
  | { type: "decide"; id: string; approve: boolean; minutes: number | null; note: string | null }
  | { type: "cancel"; id: string }
  | { type: "setting"; on: boolean };

/** 예시 화면에서 누른 것을 이 기기 안의 예시에만 반영 */
export const applyDutyDemo = (data: DutyData, a: DutyDemoAction, nowIso: string): DutyData => {
  if (a.type === "setting") return { ...data, setting: { ...data.setting, on: a.on } };
  if (a.type === "send") {
    const kind = a.p.kind as DutyKind;
    const old = data.reports.find((r) => r.staff_id === a.p.staff_id && r.work_date === a.p.work_date && r.kind === kind && r.status === "open");
    if (old) {
      return {
        ...data,
        reports: data.reports.map((r) => (r.id === old.id ? { ...r, at_time: a.p.at_time, minutes: a.p.minutes, note: a.p.note } : r)),
      };
    }
    const r: DutyReport = {
      id: `demo-duty-${data.reports.length + 1}-${a.p.work_date}`,
      staff_id: a.p.staff_id,
      staff_name: a.staffName,
      work_date: a.p.work_date,
      kind,
      at_time: a.p.at_time,
      minutes: a.p.minutes,
      note: a.p.note,
      status: "open",
      created_at: nowIso,
      mine: true,
      decided_at: null,
      decide_note: null,
    };
    return { ...data, reports: [r, ...data.reports] };
  }
  if (a.type === "cancel") return { ...data, reports: data.reports.map((r) => (r.id === a.id && r.status === "open" ? { ...r, status: "canceled" } : r)) };
  return {
    ...data,
    reports: data.reports.map((r) =>
      r.id === a.id && r.status === "open"
        ? {
            ...r,
            status: a.approve ? "approved" : "rejected",
            minutes: a.approve && r.kind !== "off" ? a.minutes ?? r.minutes : r.minutes,
            decided_at: nowIso,
            decide_note: a.note,
          }
        : r,
    ),
  };
};
