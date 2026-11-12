/**
 * 📅 운동 달력 2-2단계 — 153 일정 · 저요 한 운동 모집 (2026-11-13 대표님 「다음」 · 153 일정은 「앱 운영본부에서」)
 *   「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b 2-2 — 감정 설계 「오기 전 = 기대」.
 *   · 153 일정 = 지점장님 · 대표님이 153운영본부 「일정」 탭에서 '회원 달력에 올리기'(휴관 · 단축 운영 · 이벤트 · 대회 · 특강 · 그 밖)
 *     → 그 지점 회원 운동 달력에 바로 + 알림(그날 아침 · 하루 전 저녁 — 고른 것만, 일정마다 한 번).
 *   · 휴관일 = 약속 점선을 그리지 않고 · 약속 한 줄이 '오늘이 약속한 날'이라 하지 않고 · 그날 체크에서 체육관을 뺀다(별을 받을 수 있게).
 *   · 저요 한 모집 = 내가 올렸거나 저요 한 운동 모집(내린 것 빼고) — 그날 칸 하늘색 점 · 그날 카드 한 줄.
 *   서버 값 읽기 · 글 · 검사는 여기 한 곳(시험 calendarEvents.test.ts). DB 20261113001417_calendar_stage22.sql
 *   (get_my_calendar 의 events · calls · ops_cal_events · ops_cal_event_save · ops_cal_event_remove).
 */
import { formatHour } from "@/lib/partnerCallTime";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const EVENT_TITLE_MAX = 40;
/** 기간 = 시작 날 포함 31일까지 */
export const EVENT_SPAN_MAX = 30;
/** 시작 날은 오늘부터 이만큼 안 */
export const EVENT_AHEAD_MAX = 400;

/** exam = 승급 심사(2-3단계 · 2026-11-13) — DB 는 kind event + is_exam 으로 담고 함수가 exam 으로 보낸다.
 *  회원 알림은 타이틀 레벨(레벨 10) 회원에게만 · 그 회원 달력 머리에 '승급 심사' D-day */
export type EventKind = "closed" | "short" | "event" | "match" | "exam" | "class" | "etc";
export const EVENT_KINDS: readonly EventKind[] = ["closed", "short", "event", "match", "exam", "class", "etc"];

export interface EventKindMeta {
  /** 달력 · 알림에 보이는 이름 */
  label: string;
  /** 고르는 칩 이름 */
  pick: string;
  chip: string;
  placeholder: string;
  /** 처음 고를 때 '하루 전 저녁' 알림을 켤까 (휴관 · 단축 운영 = 오기 전에 알아야 해서) */
  eve: boolean;
}

export const EVENT_KIND_META: Record<EventKind, EventKindMeta> = {
  closed: {
    label: "휴관",
    pick: "휴관",
    chip: "bg-slate-200 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
    placeholder: "예: 추석 연휴 휴관",
    eve: true,
  },
  short: {
    label: "단축 운영",
    pick: "단축 운영",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    placeholder: "예: 10시~18시만 열어요",
    eve: true,
  },
  event: {
    label: "이벤트",
    pick: "이벤트",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    placeholder: "예: 153 플리스 사전예약 마감",
    eve: false,
  },
  match: {
    label: "대회",
    pick: "대회",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    placeholder: "예: 153 PB 대회",
    eve: false,
  },
  exam: {
    label: "승급 심사",
    pick: "승급 심사",
    chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    placeholder: "예: 화이트 리그 타이틀매치 심사 저녁 7시",
    eve: true,
  },
  class: {
    label: "특강",
    pick: "특강",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    placeholder: "예: 미트 특강 저녁 8시",
    eve: false,
  },
  etc: {
    label: "153 일정",
    pick: "그 밖",
    chip: "bg-secondary text-foreground",
    placeholder: "한 줄로 적어 주세요",
    eve: false,
  },
};

/** 달력 칸 점 — 휴관 = 회색 · 그 밖 153 일정 = 주황 · 저요 한 모집 = 하늘색 */
export const DOT_CLOSED = "bg-slate-400";
export const DOT_EVENT = "bg-amber-500";
export const DOT_CALL = "bg-sky-500";

/** 운동 모집 종류 — communityHubService PURPOSE_LABEL 과 같은 말 */
const PURPOSE: Record<string, string> = { mitt: "미트", sparring: "스파링", jump: "줄넘기", together: "같이 운동" };

// ───────────────────────── 서버 값 ─────────────────────────
export interface CalEvent {
  id: string;
  kind: EventKind;
  title: string;
  startOn: string;
  endOn: string;
}

export interface CalCall {
  id: string;
  day: string;
  /** '지금' 모집이면 null 일 수 있다 */
  hour: number | null;
  purpose: string;
  mine: boolean;
  /** 올린 사람 (닉네임 없으면 이름) */
  host: string;
  joiners: number;
  /** 내가 '같이 했어요'를 눌렀나 */
  done: boolean;
  /** '지금' 모집(30분) */
  now: boolean;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ymd = (v: unknown): string | null => {
  const s = str(v);
  return s && YMD.test(s.slice(0, 10)) ? s.slice(0, 10) : null;
};
const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : null;
};
const isKind = (v: unknown): v is EventKind => typeof v === "string" && (EVENT_KINDS as readonly string[]).includes(v);

export function normalizeEvent(raw: unknown): CalEvent | null {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  const startOn = ymd(r?.start_on);
  const endOn = ymd(r?.end_on) ?? startOn;
  if (!r || !id || !title || !startOn || !endOn || endOn < startOn || !isKind(r.kind)) return null;
  return { id, kind: r.kind, title, startOn, endOn };
}

export function normalizeCall(raw: unknown): CalCall | null {
  const r = obj(raw);
  const id = str(r?.id);
  const day = ymd(r?.day);
  if (!r || !id || !day) return null;
  const hour = int(r.hour);
  return {
    id,
    day,
    hour: hour != null && hour >= 0 && hour <= 23 ? hour : null,
    purpose: str(r.purpose) ?? "together",
    mine: r.mine === true,
    host: str(r.host) ?? "동료",
    joiners: Math.max(0, int(r.joiners) ?? 0),
    done: r.done === true,
    now: r.now === true,
  };
}

export const normalizeEvents = (raw: unknown): CalEvent[] =>
  (Array.isArray(raw) ? raw : []).map(normalizeEvent).filter((x): x is CalEvent => !!x);
export const normalizeCalls = (raw: unknown): CalCall[] =>
  (Array.isArray(raw) ? raw : []).map(normalizeCall).filter((x): x is CalCall => !!x);

// ───────────────────────── 날짜 ─────────────────────────
const addDays = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};
const weekday = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** '11/14(금)' */
export const mdw = (day: string): string => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}(${DAY[weekday(day)]})`;

/** 그날 걸친 153 일정 */
export const eventsOn = (events: readonly CalEvent[], day: string): CalEvent[] =>
  events.filter((e) => e.startOn <= day && day <= e.endOn);

/** 그날의 저요 한 모집 (시간 순) */
export const callsOn = (calls: readonly CalCall[], day: string): CalCall[] =>
  calls.filter((c) => c.day === day).sort((a, b) => (a.hour ?? -1) - (b.hour ?? -1));

/** 그날 지점이 쉬나 */
export const isClosedDay = (events: readonly CalEvent[], day: string): boolean =>
  events.some((e) => e.kind === "closed" && e.startOn <= day && day <= e.endOn);

/** 휴관일 모음 (보이는 범위의 일정에서) */
export function closedDaySet(events: readonly CalEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    if (e.kind !== "closed") continue;
    const span = Math.min(dayDiff(e.startOn, e.endOn), EVENT_SPAN_MAX);
    for (let i = 0; i <= span; i++) out.add(addDays(e.startOn, i));
  }
  return out;
}

/** 달력 칸 점 — 휴관이 먼저 (오는 날을 정하는 일정이라) */
export function eventDot(events: readonly CalEvent[], day: string): "closed" | "event" | null {
  const on = eventsOn(events, day);
  if (on.length === 0) return null;
  return on.some((e) => e.kind === "closed") ? "closed" : "event";
}

// ───────────────────────── 글 ─────────────────────────
/** '11/14(금)' · '11/14(금) ~ 11/16(일)' */
export const eventRange = (e: Pick<CalEvent, "startOn" | "endOn">): string =>
  e.endOn > e.startOn ? `${mdw(e.startOn)} ~ ${mdw(e.endOn)}` : mdw(e.startOn);

/** 여러 날 일정을 그 사이 날에 볼 때 — '11/16(일)까지' (마지막 날 · 하루 일정은 null) */
export const eventUntil = (e: Pick<CalEvent, "endOn">, day: string): string | null => (day < e.endOn ? `${mdw(e.endOn)}까지` : null);

/** 운동 모집 한 줄 — '오후 7시 미트 · 내 모집 · 저요 2명' · '오후 8시 같이 운동 · 민준님' */
export function callLine(c: CalCall): string {
  const when = c.now ? "지금" : c.hour != null ? formatHour(c.hour) : null;
  const what = PURPOSE[c.purpose] ?? "같이 운동";
  const who = c.mine ? (c.joiners > 0 ? `내 모집 · 저요 ${c.joiners}명` : "내 모집") : `${c.host}님`;
  return `${when ? `${when} ` : ""}${what} · ${who}`;
}

// ───────────────────────── 운영본부 「일정」 탭 ─────────────────────────
export interface OpsCalEvent extends CalEvent {
  notifyMorning: boolean;
  notifyEve: boolean;
  morningSentAt: string | null;
  morningSentN: number | null;
  eveSentAt: string | null;
  eveSentN: number | null;
  /** 올리거나 마지막으로 고친 분 */
  by: string | null;
}

export interface OpsCalState {
  on: boolean;
  branch: string | null;
  today: string | null;
  canEdit: boolean;
  /** 알림 받는 회원 수 (올릴 수 있는 분에게만) */
  audience: number | null;
  morningAt: string;
  eveAt: string;
  quietAfter: string;
  events: OpsCalEvent[];
}

export const OPS_CAL_OFF: OpsCalState = {
  on: false,
  branch: null,
  today: null,
  canEdit: false,
  audience: null,
  morningAt: "08:30",
  eveAt: "19:00",
  quietAfter: "21:00",
  events: [],
};

const HM = /^\d{2}:\d{2}$/;
const hm = (v: unknown, fallback: string): string => {
  const s = str(v);
  return s && HM.test(s) ? s : fallback;
};

export function normalizeOpsCal(raw: unknown): OpsCalState {
  const r = obj(raw);
  if (!r || r.on !== true) return { ...OPS_CAL_OFF, branch: str(r?.branch) };
  const events = (Array.isArray(r.events) ? r.events : [])
    .map((x): OpsCalEvent | null => {
      const base = normalizeEvent(x);
      const o = obj(x);
      if (!base || !o) return null;
      return {
        ...base,
        notifyMorning: o.notify_morning !== false,
        notifyEve: o.notify_eve === true,
        morningSentAt: str(o.morning_sent_at),
        morningSentN: int(o.morning_sent_n),
        eveSentAt: str(o.eve_sent_at),
        eveSentN: int(o.eve_sent_n),
        by: str(o.by),
      };
    })
    .filter((x): x is OpsCalEvent => !!x);
  const audience = int(r.audience);
  return {
    on: true,
    branch: str(r.branch),
    today: ymd(r.today),
    canEdit: r.can_edit === true,
    audience: audience != null && audience >= 0 ? audience : null,
    morningAt: hm(r.morning_at, "08:30"),
    eveAt: hm(r.eve_at, "19:00"),
    quietAfter: hm(r.quiet_after, "21:00"),
    events,
  };
}

/** '08:30' → '아침 8시 30분' · '19:00' → '저녁 7시' · '12:00' → '낮 12시' */
export function hmLabel(v: string): string {
  const [h, m] = v.split(":").map(Number);
  if (!Number.isFinite(h)) return v;
  const head = h < 6 ? `새벽 ${h}시` : h < 12 ? `아침 ${h}시` : h === 12 ? "낮 12시" : h < 18 ? `오후 ${h - 12}시` : `저녁 ${h - 12}시`;
  return m ? `${head} ${m}분` : head;
}

/** 알림 한 줄 — '그날 아침 8시 30분 · 하루 전 저녁 7시' / 보낸 뒤 '그날 아침 보냄 · 150명' / '알림 없음' */
export function noticeStatus(e: OpsCalEvent, st: Pick<OpsCalState, "morningAt" | "eveAt">): string {
  const parts: string[] = [];
  if (e.eveSentAt) parts.push(`하루 전 보냄 · ${(e.eveSentN ?? 0).toLocaleString("ko-KR")}명`);
  else if (e.notifyEve) parts.push(`하루 전 ${hmLabel(st.eveAt)}`);
  if (e.morningSentAt) parts.push(`그날 아침 보냄 · ${(e.morningSentN ?? 0).toLocaleString("ko-KR")}명`);
  else if (e.notifyMorning) parts.push(`그날 ${hmLabel(st.morningAt)}`);
  return parts.length ? parts.join(" · ") : "알림 없음";
}

// ───────────────────────── 올리기 · 고치기 ─────────────────────────
export interface EventDraft {
  kind: EventKind;
  title: string;
  startOn: string;
  endOn: string;
  /** 여러 날 */
  multi: boolean;
  notifyMorning: boolean;
  notifyEve: boolean;
}

export const newEventDraft = (date: string, kind: EventKind = "closed"): EventDraft => ({
  kind,
  title: "",
  startOn: date,
  endOn: date,
  multi: false,
  notifyMorning: true,
  notifyEve: EVENT_KIND_META[kind].eve,
});

export const draftFromEvent = (e: OpsCalEvent): EventDraft => ({
  kind: e.kind,
  title: e.title,
  startOn: e.startOn,
  endOn: e.endOn,
  multi: e.endOn > e.startOn,
  notifyMorning: e.notifyMorning,
  notifyEve: e.notifyEve,
});

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** 서버(ops_cal_event_save)와 같은 검사 — 통과하면 null */
export function eventDraftError(d: EventDraft, today: string): string | null {
  if (!isKind(d.kind)) return "종류를 골라 주세요";
  const title = tidy(d.title);
  if (!title) return "한 줄 설명을 적어 주세요";
  if ([...title].length > EVENT_TITLE_MAX) return "한 줄 설명은 40자 안으로 적어 주세요";
  if (!YMD.test(d.startOn)) return "날짜를 골라 주세요";
  const end = d.multi && YMD.test(d.endOn) ? d.endOn : d.startOn;
  if (end < d.startOn) return "끝나는 날을 시작하는 날 뒤로 골라 주세요";
  if (dayDiff(d.startOn, end) > EVENT_SPAN_MAX) return "기간은 31일 안으로 골라 주세요";
  if (end < today) return "지난 날짜에는 올릴 수 없어요";
  if (dayDiff(today, d.startOn) > EVENT_AHEAD_MAX) return "1년 안의 날짜로 골라 주세요";
  return null;
}

export const eventPayload = (d: EventDraft, branch: string | null, id?: string | null) => ({
  p_id: id ?? null,
  p_branch: id ? null : branch,
  p_kind: d.kind,
  p_title: tidy(d.title),
  p_start: d.startOn,
  p_end: d.multi && YMD.test(d.endOn) ? d.endOn : d.startOn,
  p_notify_morning: d.notifyMorning,
  p_notify_eve: d.notifyEve,
});

/** 지금 올리면 알림이 언제 가나 — 오늘 · 내일 일정이고 알림 시간이 이미 됐으면 '10분 안에' */
export function sendHint(d: EventDraft, st: Pick<OpsCalState, "morningAt" | "eveAt" | "quietAfter">, today: string, nowHm: string): string | null {
  const late = nowHm >= st.quietAfter;
  if (d.startOn === today && d.notifyMorning) {
    if (late) return "오늘 알림 시간이 지나서 그날 아침 알림은 안 가요";
    if (nowHm >= st.morningAt) return "오늘 일정이라 올리면 10분 안에 알려요";
  }
  if (d.startOn === addDays(today, 1) && d.notifyEve && !late && nowHm >= st.eveAt) return "내일 일정이라 올리면 10분 안에 알려요";
  return null;
}

/** 지금 올라가 있는 일정 중 다가오는 것 (끝난 일정은 빼고) */
export const upcomingEvents = <T extends CalEvent>(events: readonly T[], today: string): T[] => events.filter((e) => e.endOn >= today);
