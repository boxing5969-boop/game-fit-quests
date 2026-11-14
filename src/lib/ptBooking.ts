/**
 * PT 프리미엄 1단계 — PT 예약 · 취소 규칙 · 수업 1회 적립 (2026-11-14 대표님
 * 「PT 회원님들 관리를 효율적으로 … 스케줄 관리 혼동되지 않게 · 당일 취소는 차감되고 하루전은 언제든지 가능 ·
 *  담당코치님이 마이복서 153을 통해 예약하거나 관리」 · 보고서 https://claude.ai/artifact/KVmuJHjNQ2aqLw4ADc62xn)
 *
 *   서버(DB 20261114150412_ops_pt_booking.sql)는 자료와 규칙 — 이 파일은 화면 계산 한 곳:
 *     · 회원: 홈 PT 카드(pt_my_home) · 예약할 수 있는 칸(pt_open_slots) → 읽기 · 날짜 글 · 취소 안내 · 지난 수업 글
 *     · 코치 · 지점장 · 대표님: 예약판(ops_pt_book_board) → 날짜 묶기 · 결과 필요 · 회원 줄 · 닫기 고르기 · 넣기 검사
 *   규칙: 전날 자정까지 취소 · 변경 = 차감 없음 / 수업 당일 회원 취소 · 미참석 = 1회 차감 / 코치 사정 = 차감 없음.
 *     회원이 방금(10분 안) 직접 잡은 예약은 당일이어도 차감 없이 취소(실수 방지).
 *   글 원칙(회원 감정 설계): 탓하는 말을 쓰지 않는다 — '노쇼'는 회원 화면에서 '미참석'.
 *   시각은 모두 한국 시간. 숫자 · 실명은 여기 없다(시험은 지어낸 이름).
 */

// ───────────────────────── 날짜 · 시각 (한국 시간) ─────────────────────────
const KST = 9 * 3600_000;
const DAY = 86_400_000;
export const PT_WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const kstDateOf = (ms: number): string => new Date(ms + KST).toISOString().slice(0, 10);
export const kstDateOfIso = (iso: string): string => kstDateOf(Date.parse(iso));
/** 'YYYY-MM-DD' 두 날짜의 차(일) — b − a */
export const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
export const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** 한국 날짜 + 자정부터 분 → ISO(UTC) */
export const kstIso = (date: string, minutes: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - KST + minutes * 60_000).toISOString();
/** ISO → 한국 시각의 자정부터 분 */
export const kstMinutes = (iso: string): number => {
  const d = new Date(Date.parse(iso) + KST);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/** 분 → "오후 7:00" */
export const minuteLabel = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
};
/** ISO → "오후 7:00" */
export const timeLabel = (iso: string): string => minuteLabel(kstMinutes(iso));
/** 분 → "19:00" (예약판 줄 · 시간 고르기) */
export const minuteClock = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "11월 17일 (월)" */
export const dateLabel = (date: string): string => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${PT_WEEKDAY[weekdayOf(date)]})`;
};
/** "11/17 (월)" — 좁은 칸 */
export const dateShort = (date: string): string => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d} (${PT_WEEKDAY[weekdayOf(date)]})`;
};
/** 오늘 · 내일은 그 말로, 그 밖은 날짜 */
export const dayWord = (date: string, today: string): string => {
  const n = dayDiff(today, date);
  return n === 0 ? "오늘" : n === 1 ? "내일" : n === -1 ? "어제" : dateLabel(date);
};
/** 주인공 한 줄 — "내일 오후 7:00" · "11월 17일 (월) 오후 7:00" */
export const whenLabel = (iso: string, today: string): string => `${dayWord(kstDateOfIso(iso), today)} ${timeLabel(iso)}`;
/** 날짜 옆 칩 — 모레부터 "3일 뒤" (오늘 · 내일은 주인공 글이 이미 말한다) */
export const aheadChip = (date: string, today: string): string | null => {
  const n = dayDiff(today, date);
  return n >= 2 ? `${n}일 뒤` : null;
};

const n = (v: number) => v.toLocaleString("ko-KR");
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const int = (v: unknown, fb = 0): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : fb;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ───────────────────────── 회원 — 홈 PT 카드 ─────────────────────────
export type PtBookingStatus = "booked" | "done" | "canceled" | "late_canceled" | "noshow" | "coach_canceled" | "moved";
export type PtHistoryKind = "lesson" | "noshow" | "late_cancel" | "coach_cancel" | "canceled" | "moved";

export interface PtHomeBooking {
  id: string;
  start_at: string;
  end_at: string;
  day: string;
  coach: string;
  made_by: "member" | "coach";
  created_at: string;
  /** 팀 PT(같은 시간 여러 회원) */
  team: boolean;
}
export interface PtHistoryItem {
  key: string;
  day: string;
  kind: PtHistoryKind;
  uses: number;
  start_at: string | null;
  mileage: number;
  coach: string;
  by: "member" | "coach" | "system" | null;
  moved_to: string | null;
}
export interface PtTicket {
  name: string | null;
  remaining: number | null;
  endDate: string | null;
  checkedAt: string | null;
}
export interface PtRules {
  slotMinutes: number;
  minLeadHours: number;
  aheadDays: number;
  /** 수업 1회 적립(0 = 이 지점은 적립을 켜지 않음) */
  mileage: number;
  graceMinutes: number;
}
export interface PtHome {
  /** 이 지점이 앱 PT 예약을 켰고, 내가 그 지점 일반 회원인가 */
  on: boolean;
  /** PT 수업권이 살아 있나 */
  pt: boolean;
  branch: string | null;
  today: string;
  ticket: PtTicket;
  coach: { id: string; name: string } | null;
  rules: PtRules;
  /** 더 잡을 수 있는 수(남은 횟수 − 앞으로의 예약) */
  room: number;
  canBook: boolean;
  bookings: PtHomeBooking[];
  history: PtHistoryItem[];
  mileageTotal: number;
}

export const PT_HOME_OFF: PtHome = {
  on: false,
  pt: false,
  branch: null,
  today: "",
  ticket: { name: null, remaining: null, endDate: null, checkedAt: null },
  coach: null,
  rules: { slotMinutes: 50, minLeadHours: 4, aheadDays: 14, mileage: 0, graceMinutes: 10 },
  room: 0,
  canBook: false,
  bookings: [],
  history: [],
  mileageTotal: 0,
};

const HISTORY_KINDS: PtHistoryKind[] = ["lesson", "noshow", "late_cancel", "coach_cancel", "canceled", "moved"];

/** 서버 JSON → 화면 값 (모르는 값은 버리고, 빠진 칸은 기본값) */
export function normalizePtHome(raw: unknown, now: number = Date.now()): PtHome {
  const r = obj(raw);
  if (r.on !== true) return PT_HOME_OFF;
  const t = obj(r.ticket);
  const ru = obj(r.rules);
  const c = obj(r.coach);
  const rem = t.remaining == null ? null : int(t.remaining, -1);
  return {
    on: true,
    pt: r.pt === true,
    branch: str(r.branch),
    today: str(r.today)?.slice(0, 10) ?? kstDateOf(now),
    ticket: {
      name: str(t.name),
      remaining: rem != null && rem >= 0 ? rem : null,
      endDate: str(t.end_date)?.slice(0, 10) ?? null,
      checkedAt: str(t.checked_at),
    },
    coach: str(c.id) && str(c.name) ? { id: String(c.id), name: String(c.name) } : null,
    rules: {
      slotMinutes: int(ru.slot_minutes, 50) || 50,
      minLeadHours: int(ru.min_lead_hours, 4),
      aheadDays: int(ru.ahead_days, 14) || 14,
      mileage: Math.max(0, int(ru.mileage, 0)),
      graceMinutes: int(ru.grace_minutes, 10),
    },
    room: Math.max(0, int(r.room, 0)),
    canBook: r.can_book === true,
    bookings: arr(r.bookings)
      .map((x) => obj(x))
      .filter((b) => str(b.id) && str(b.start_at) && str(b.end_at))
      .map((b) => ({
        id: String(b.id),
        start_at: String(b.start_at),
        end_at: String(b.end_at),
        day: str(b.day)?.slice(0, 10) ?? kstDateOfIso(String(b.start_at)),
        coach: str(b.coach) ?? "코치",
        made_by: b.made_by === "member" ? ("member" as const) : ("coach" as const),
        created_at: str(b.created_at) ?? String(b.start_at),
        team: b.team === true,
      }))
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    history: arr(r.history)
      .map((x) => obj(x))
      .filter((h) => str(h.key) && str(h.day) && HISTORY_KINDS.includes(h.kind as PtHistoryKind))
      .map((h) => ({
        key: String(h.key),
        day: String(h.day).slice(0, 10),
        kind: h.kind as PtHistoryKind,
        uses: Math.max(1, int(h.uses, 1)),
        start_at: str(h.start_at),
        mileage: Math.max(0, int(h.mileage, 0)),
        coach: str(h.coach) ?? "코치",
        by: (h.by === "member" || h.by === "coach" || h.by === "system" ? h.by : null) as PtHistoryItem["by"],
        moved_to: str(h.moved_to),
      })),
    mileageTotal: Math.max(0, int(r.mileage_total, 0)),
  };
}

/** 홈에 카드를 그릴까 — PT 회원이거나, 수업권이 끝났어도 살아 있는 예약이 있으면 */
export const showPtCard = (h: PtHome): boolean => h.on && (h.pt || h.bookings.length > 0);

export interface PtBookingSplit {
  /** 수업 시간이 된 예약 — 「수업 받았어요」 대상 (늦은 것부터) */
  confirm: PtHomeBooking[];
  /** 앞으로의 예약 (이른 것부터) */
  upcoming: PtHomeBooking[];
}
export const splitBookings = (h: PtHome, now: number = Date.now()): PtBookingSplit => {
  const confirm: PtHomeBooking[] = [];
  const upcoming: PtHomeBooking[] = [];
  for (const b of h.bookings) (Date.parse(b.start_at) <= now ? confirm : upcoming).push(b);
  confirm.sort((a, b) => b.start_at.localeCompare(a.start_at));
  return { confirm, upcoming };
};

export type PtCancelMode =
  /** 전날까지 — 차감 없음 */
  | "free"
  /** 방금(10분 안) 직접 잡은 당일 예약 — 차감 없음 */
  | "grace"
  /** 수업 당일 — 1회 차감 */
  | "late"
  /** 수업 시간이 지남 — 회원은 취소할 수 없다 */
  | "started";

/** 이 예약을 지금 취소하면 — 서버(pt_cancel)와 같은 판정 */
export function cancelMode(b: PtHomeBooking, today: string, now: number = Date.now(), graceMinutes = 10): PtCancelMode {
  if (Date.parse(b.start_at) <= now) return "started";
  if (b.day > today) return "free";
  if (b.made_by === "member" && now - Date.parse(b.created_at) < graceMinutes * 60_000) return "grace";
  return "late";
}
/** 시간 바꾸기 — 전날까지(또는 방금 잡은 예약)만 회원이 직접 */
export const canMove = (b: PtHomeBooking, today: string, now: number = Date.now(), graceMinutes = 10): boolean => {
  const m = cancelMode(b, today, now, graceMinutes);
  return m === "free" || m === "grace";
};

export const CANCEL_COPY: Record<Exclude<PtCancelMode, "started">, { title: string; body: string; ok: string; danger: boolean }> = {
  free: { title: "차감 없이 취소돼요", body: "수업 전날까지는 언제든 바꾸거나 취소할 수 있어요", ok: "예약 취소", danger: false },
  grace: { title: "차감 없이 취소돼요", body: "방금 잡은 예약이라 지금은 차감 없이 취소할 수 있어요", ok: "예약 취소", danger: false },
  late: { title: "오늘 수업은 취소하면 1회 차감돼요", body: "시간을 옮기고 싶다면 코치님께 먼저 말씀해 주세요", ok: "1회 차감하고 취소", danger: true },
};

/** 규칙 한 줄(카드 · 시트) */
export const PT_RULE_LINE = "전날까지 무료 변경 · 당일 취소는 1회 차감";

export interface PtHistoryView {
  label: string;
  /** 오른쪽 작은 글 — 차감 · 적립 */
  sub: string | null;
  tone: "good" | "plain" | "warn";
}
/** 지난 수업 한 줄 — 잘한 것은 민트, 차감은 주황, 나머지는 회색 */
export function historyView(h: PtHistoryItem, today: string): PtHistoryView {
  switch (h.kind) {
    case "lesson":
      return {
        label: h.uses > 1 ? `수업 완료 · ${h.uses}회` : "수업 완료",
        sub: h.mileage > 0 ? `+${n(h.mileage)}` : null,
        tone: "good",
      };
    case "noshow":
      return { label: "미참석", sub: `${h.uses}회 차감`, tone: "warn" };
    case "late_cancel":
      return { label: "당일 취소", sub: `${h.uses}회 차감`, tone: "warn" };
    case "coach_cancel":
      return { label: h.by === "system" ? "취소" : "코치님 사정", sub: "차감 없음", tone: "plain" };
    case "canceled":
      return { label: "취소", sub: "차감 없음", tone: "plain" };
    case "moved":
      return { label: "시간 변경", sub: h.moved_to ? `→ ${whenLabel(h.moved_to, today)}` : null, tone: "plain" };
  }
}

/** 그 달(YYYY-MM) 수업한 횟수와 적립 */
export const monthLessons = (h: PtHome, ym: string): { lessons: number; mileage: number } => {
  let lessons = 0;
  let mileage = 0;
  for (const x of h.history) {
    if (x.kind !== "lesson" || !x.day.startsWith(ym)) continue;
    lessons += x.uses;
    mileage += x.mileage;
  }
  return { lessons, mileage };
};

/** 수업권 총 횟수 — "퍼스널 트레이닝 20회권" → 20 (모르면 null) */
export const ticketTotal = (name: string | null): number | null => {
  const v = Number((name ?? "").match(/(\d+)\s*회/)?.[1] ?? NaN);
  return Number.isFinite(v) && v > 0 && v <= 200 ? v : null;
};

// ───────────────────────── 회원 — 예약할 수 있는 칸 ─────────────────────────
export interface PtSlot {
  at: string;
  free: boolean;
}
export interface PtSlotDay {
  date: string;
  /** 그날 내 예약(또는 차감된 결과)이 이미 있다 */
  mine: boolean;
  slots: PtSlot[];
}
export interface PtOpenSlots {
  on: boolean;
  coach: { id: string; name: string } | null;
  slotMinutes: number;
  room: number;
  days: PtSlotDay[];
}
export const PT_SLOTS_OFF: PtOpenSlots = { on: false, coach: null, slotMinutes: 50, room: 0, days: [] };

export function normalizePtSlots(raw: unknown): PtOpenSlots {
  const r = obj(raw);
  if (r.on !== true) return PT_SLOTS_OFF;
  const c = obj(r.coach);
  return {
    on: true,
    coach: str(c.id) && str(c.name) ? { id: String(c.id), name: String(c.name) } : null,
    slotMinutes: int(r.slot_minutes, 50) || 50,
    room: Math.max(0, int(r.room, 0)),
    days: arr(r.days)
      .map((x) => obj(x))
      .filter((d) => str(d.date))
      .map((d) => ({
        date: String(d.date).slice(0, 10),
        mine: d.mine === true,
        slots: arr(d.slots)
          .map((s) => obj(s))
          .filter((s) => str(s.at))
          .map((s) => ({ at: String(s.at), free: s.free === true }))
          .sort((a, b) => a.at.localeCompare(b.at)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** 그날 잡을 수 있는 칸 수(내 예약이 있는 날은 0) — moveFrom 은 옮기는 예약의 날(그날은 내 예약이 비켜 준다) */
export const freeCount = (d: PtSlotDay, moveDay: string | null = null): number =>
  d.mine && d.date !== moveDay ? 0 : d.slots.filter((s) => s.free).length;

export type PtDayPart = "am" | "pm" | "eve";
export const DAY_PART_LABEL: Record<PtDayPart, string> = { am: "오전", pm: "오후", eve: "저녁" };
export const dayPartOf = (iso: string): PtDayPart => {
  const m = kstMinutes(iso);
  return m < 12 * 60 ? "am" : m < 18 * 60 ? "pm" : "eve";
};
/** 빈 칸만 오전 · 오후 · 저녁으로 묶는다(빈 묶음은 뺀다) */
export const freeSlotGroups = (d: PtSlotDay): { part: PtDayPart; slots: PtSlot[] }[] =>
  (["am", "pm", "eve"] as const)
    .map((part) => ({ part, slots: d.slots.filter((s) => s.free && dayPartOf(s.at) === part) }))
    .filter((g) => g.slots.length > 0);

// ───────────────────────── 코치 · 지점장 · 대표님 — 예약판 ─────────────────────────
export interface PtBoardBooking {
  id: string;
  coach_staff_id: string;
  member_user_id: string;
  member_name: string;
  start_at: string;
  end_at: string;
  day: string;
  status: PtBookingStatus;
  made_by: "member" | "coach";
  team_id: string | null;
  series_id: string | null;
  moved_from: string | null;
  session_id: string | null;
  confirmed_at: string | null;
  closed_role: "member" | "coach" | "system" | null;
  close_note: string | null;
  created_at: string;
}
export interface PtBoardMember {
  user_id: string;
  name: string;
  label: string | null;
  tail: string;
  ticket: string | null;
  remaining: number | null;
  end_date: string | null;
  checked_at: string | null;
  /** 앞으로의 예약 수 */
  booked: number;
}
export interface PtBoardSlot {
  id?: string;
  coach_staff_id: string;
  weekday: number;
  start_min: number;
  end_min: number;
}
export interface PtBoardSettings {
  booking_on: boolean;
  mileage_on: boolean;
  lesson_mileage: number;
  started_on: string;
  slot_minutes: number;
  min_lead_hours: number;
  ahead_days: number;
}
export interface PtBoard {
  branch: string;
  on: boolean;
  /** 지점 전체를 본다(대표님 · 지점 관리자) */
  manage: boolean;
  /** 내 근무자 카드(PT 코치일 때) */
  me_staff: string | null;
  /** 켜기 · 금액(대표님만) */
  can_set: boolean;
  /** PT 기록을 켠 지점인가(예약은 그 지점에서만 켠다) */
  record_on: boolean;
  today: string;
  settings: PtBoardSettings | null;
  coaches: { id: string; name: string }[];
  members: PtBoardMember[];
  bookings: PtBoardBooking[];
  slots: PtBoardSlot[];
  attendance: { user_id: string; date: string; at: string }[];
}

const STATUSES: PtBookingStatus[] = ["booked", "done", "canceled", "late_canceled", "noshow", "coach_canceled", "moved"];

export function normalizePtBoard(raw: unknown, branch: string, now: number = Date.now()): PtBoard {
  const r = obj(raw);
  const s = r.settings == null ? null : obj(r.settings);
  return {
    branch: str(r.branch) ?? branch,
    on: r.on === true,
    manage: r.manage === true,
    me_staff: str(r.me_staff),
    can_set: r.can_set === true,
    record_on: r.record_on === true,
    today: str(r.today)?.slice(0, 10) ?? kstDateOf(now),
    settings: s
      ? {
          booking_on: s.booking_on === true,
          mileage_on: s.mileage_on === true,
          lesson_mileage: Math.max(0, int(s.lesson_mileage, 1000)),
          started_on: str(s.started_on)?.slice(0, 10) ?? "",
          slot_minutes: int(s.slot_minutes, 50) || 50,
          min_lead_hours: int(s.min_lead_hours, 4),
          ahead_days: int(s.ahead_days, 14) || 14,
        }
      : null,
    coaches: arr(r.coaches)
      .map((x) => obj(x))
      .filter((c) => str(c.id))
      .map((c) => ({ id: String(c.id), name: str(c.name) ?? "코치" })),
    members: arr(r.members)
      .map((x) => obj(x))
      .filter((m) => str(m.user_id))
      .map((m) => {
        const rem = m.remaining == null ? null : int(m.remaining, -1);
        return {
          user_id: String(m.user_id),
          name: str(m.name) ?? "회원",
          label: str(m.label),
          tail: str(m.tail) ?? "",
          ticket: str(m.ticket),
          remaining: rem != null && rem >= 0 ? rem : null,
          end_date: str(m.end_date)?.slice(0, 10) ?? null,
          checked_at: str(m.checked_at),
          booked: Math.max(0, int(m.booked, 0)),
        };
      }),
    bookings: arr(r.bookings)
      .map((x) => obj(x))
      .filter((b) => str(b.id) && str(b.start_at) && str(b.end_at) && STATUSES.includes(b.status as PtBookingStatus))
      .map((b) => ({
        id: String(b.id),
        coach_staff_id: str(b.coach_staff_id) ?? "",
        member_user_id: str(b.member_user_id) ?? "",
        member_name: str(b.member_name) ?? "회원",
        start_at: String(b.start_at),
        end_at: String(b.end_at),
        day: str(b.day)?.slice(0, 10) ?? kstDateOfIso(String(b.start_at)),
        status: b.status as PtBookingStatus,
        made_by: b.made_by === "member" ? ("member" as const) : ("coach" as const),
        team_id: str(b.team_id),
        series_id: str(b.series_id),
        moved_from: str(b.moved_from),
        session_id: str(b.session_id),
        confirmed_at: str(b.confirmed_at),
        closed_role: (b.closed_role === "member" || b.closed_role === "coach" || b.closed_role === "system" ? b.closed_role : null) as PtBoardBooking["closed_role"],
        close_note: str(b.close_note),
        created_at: str(b.created_at) ?? String(b.start_at),
      }))
      .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.member_name.localeCompare(b.member_name, "ko")),
    slots: arr(r.slots)
      .map((x) => obj(x))
      .filter((x) => str(x.coach_staff_id))
      .map((x) => ({
        id: str(x.id) ?? undefined,
        coach_staff_id: String(x.coach_staff_id),
        weekday: int(x.weekday, 0),
        start_min: int(x.start_min, 0),
        end_min: int(x.end_min, 0),
      })),
    attendance: arr(r.attendance)
      .map((x) => obj(x))
      .filter((a) => str(a.user_id) && str(a.date))
      .map((a) => ({ user_id: String(a.user_id), date: String(a.date).slice(0, 10), at: str(a.at) ?? "" })),
  };
}

/** 회원 이름 — 이름표(코치가 붙인 이름)를 먼저 */
export const memberLabel = (m: Pick<PtBoardMember, "name" | "label">): string => m.label || m.name;

export const BOOKING_STATUS_META: Record<PtBookingStatus, { label: string; tone: "live" | "good" | "plain" | "warn" }> = {
  booked: { label: "예약", tone: "live" },
  done: { label: "수업함", tone: "good" },
  canceled: { label: "취소", tone: "plain" },
  late_canceled: { label: "당일 취소 · 차감", tone: "warn" },
  noshow: { label: "미참석 · 차감", tone: "warn" },
  coach_canceled: { label: "코치 사정", tone: "plain" },
  moved: { label: "시간 바꿈", tone: "plain" },
};

/** 결과가 필요한 예약 — 수업이 끝났는데 아직 '예약' 그대로 */
export const needsResult = (b: PtBoardBooking, now: number = Date.now()): boolean =>
  b.status === "booked" && Date.parse(b.end_at) <= now;

/** 예약판 한 줄 — 같은 팀(같은 시간)은 한 줄로 묶는다 */
export interface PtBoardRow {
  key: string;
  start_at: string;
  end_at: string;
  day: string;
  coach_staff_id: string;
  bookings: PtBoardBooking[];
}
export function boardRows(list: PtBoardBooking[]): PtBoardRow[] {
  const rows = new Map<string, PtBoardRow>();
  for (const b of list) {
    const key = b.team_id ? `t:${b.team_id}:${b.start_at}` : `b:${b.id}`;
    const row = rows.get(key);
    if (row) row.bookings.push(b);
    else rows.set(key, { key, start_at: b.start_at, end_at: b.end_at, day: b.day, coach_staff_id: b.coach_staff_id, bookings: [b] });
  }
  return [...rows.values()].sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** 살아 있는 줄만(예약 · 수업함 · 차감된 결과) — 취소 · 옮긴 줄은 판에서 뺀다 */
export const isLiveStatus = (s: PtBookingStatus): boolean => s === "booked" || s === "done" || s === "late_canceled" || s === "noshow";

export interface PtBoardView {
  /** 결과를 골라야 하는 지난 예약 (오래된 것부터) */
  pending: PtBoardRow[];
  /** 날짜 → 그날 줄 (살아 있는 줄만) */
  byDay: Map<string, PtBoardRow[]>;
  /** 그날 살아 있는 예약 수 (요일 칩의 숫자) */
  countByDay: Map<string, number>;
}
export function boardView(board: PtBoard, coach: string | null, now: number = Date.now()): PtBoardView {
  const list = board.bookings.filter((b) => !coach || b.coach_staff_id === coach);
  const pending = boardRows(list.filter((b) => needsResult(b, now)));
  const live = list.filter((b) => isLiveStatus(b.status));
  const byDay = new Map<string, PtBoardRow[]>();
  const countByDay = new Map<string, number>();
  for (const row of boardRows(live)) {
    byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
    countByDay.set(row.day, (countByDay.get(row.day) ?? 0) + row.bookings.length);
  }
  return { pending, byDay, countByDay };
}

/** 그날 그 회원이 입장했나(예약 줄의 '입장' 표시) */
export const enteredOn = (board: PtBoard, userId: string, date: string): boolean =>
  board.attendance.some((a) => a.user_id === userId && a.date === date);

export interface PtMemberRow extends PtBoardMember {
  /** 다음 예약 시각 */
  next: string | null;
  /** 남은 횟수가 있는데 앞으로 예약이 없다 */
  noNext: boolean;
  /** 남은 2회 이하 — 재등록 이야기를 꺼낼 때 */
  low: boolean;
}
/** 회원 줄 — 예약 없는 회원 먼저, 그다음 다음 수업이 가까운 순 */
export function memberRows(board: PtBoard, coach: string | null, now: number = Date.now()): PtMemberRow[] {
  const next = new Map<string, string>();
  for (const b of board.bookings) {
    if (b.status !== "booked" || Date.parse(b.start_at) <= now) continue;
    if (coach && b.coach_staff_id !== coach) continue;
    const cur = next.get(b.member_user_id);
    if (!cur || b.start_at < cur) next.set(b.member_user_id, b.start_at);
  }
  return board.members
    .filter((m) => m.ticket != null)
    .map((m) => {
      const nx = next.get(m.user_id) ?? null;
      const has = (m.remaining ?? 1) > 0;
      return { ...m, next: nx, noNext: has && !nx && m.booked === 0, low: m.remaining != null && m.remaining <= 2 };
    })
    .sort(
      (a, b) =>
        Number(b.noNext) - Number(a.noNext) ||
        (a.next ?? "9").localeCompare(b.next ?? "9") ||
        memberLabel(a).localeCompare(memberLabel(b), "ko"),
    );
}

export type PtCloseKind = "cancel" | "coach_cancel" | "late_cancel" | "noshow" | "lesson";
export interface PtCloseOption {
  kind: PtCloseKind;
  label: string;
  /** 무슨 일이 생기는지 한 줄 */
  note: string;
  tone: "primary" | "plain" | "danger";
}
/** 이 예약에 지금 누를 수 있는 처리 — 서버(ops_pt_booking_close)와 같은 판정 */
export function closeOptions(b: Pick<PtBoardBooking, "status" | "day" | "start_at">, today: string, now: number = Date.now()): PtCloseOption[] {
  if (b.status !== "booked") return [];
  const started = Date.parse(b.start_at) <= now;
  const out: PtCloseOption[] = [];
  if (started) {
    out.push({ kind: "lesson", label: "수업함", note: "수업 기록이 남고 회원에게 마일리지가 쌓여요", tone: "primary" });
    out.push({ kind: "noshow", label: "미참석", note: "1회 차감 · 회원에게 알림이 가요", tone: "danger" });
  }
  if (b.day <= today) out.push({ kind: "late_cancel", label: "당일 취소", note: "회원이 당일에 취소 — 1회 차감", tone: "danger" });
  else out.push({ kind: "cancel", label: "예약 취소", note: "전날까지라 차감이 없어요", tone: "plain" });
  out.push({ kind: "coach_cancel", label: "코치 사정", note: "차감 없이 취소돼요", tone: "plain" });
  return out;
}

// ── 예약 넣기 ──
export interface PtBookDraft {
  members: string[];
  date: string;
  /** 자정부터 분 */
  minute: number | null;
  /** 1 = 이번만 · n = 매주 n번 */
  weeks: number;
  coach: string | null;
}
export const PT_WEEK_CHOICES = [1, 4, 8, 12] as const;
export const weeksLabel = (w: number): string => (w <= 1 ? "이번만" : `매주 ${w}번`);
export const PT_MAX_TEAM = 6;

/** 넣기 전 검사 — 서버와 같은 말 */
export function bookDraftError(d: PtBookDraft, board: PtBoard, now: number = Date.now()): string | null {
  if (d.members.length === 0) return "회원을 골라 주세요";
  if (d.members.length > PT_MAX_TEAM) return `한 번에 ${PT_MAX_TEAM}명까지 넣을 수 있어요`;
  if (!d.date || d.minute == null) return "날짜와 시간을 골라 주세요";
  const at = Date.parse(kstIso(d.date, d.minute));
  if (at < now - 10 * 60_000) return "지난 시간에는 예약을 넣을 수 없어요";
  if (at > now + 120 * DAY) return "날짜가 너무 멀어요";
  if (board.manage && !d.coach && board.coaches.length > 1) return "담당 코치를 골라 주세요";
  return null;
}
export const bookPayload = (d: PtBookDraft, branch: string, opts: { force?: boolean; join?: boolean } = {}) => ({
  branch,
  ...(d.coach ? { coach_staff_id: d.coach } : {}),
  members: d.members,
  start_at: kstIso(d.date, d.minute ?? 0),
  weeks: d.weeks,
  ...(opts.force ? { force: true } : {}),
  ...(opts.join ? { join: true } : {}),
});

export interface PtSaveResult {
  made: number;
  ids: string[];
  skipped: { day: string; reason: "busy" | "limit" | "same_day"; member: string | null }[];
}
export function normalizeSaveResult(raw: unknown): PtSaveResult {
  const r = obj(raw);
  return {
    made: Math.max(0, int(r.made, 0)),
    ids: arr(r.ids).map(String),
    skipped: arr(r.skipped)
      .map((x) => obj(x))
      .filter((x) => x.reason === "busy" || x.reason === "limit" || x.reason === "same_day")
      .map((x) => ({ day: str(x.day)?.slice(0, 10) ?? "", reason: x.reason as "busy" | "limit" | "same_day", member: str(x.member) })),
  };
}
/** 저장 뒤 한 줄 — "4건 넣었어요 · 1건은 그 시간에 다른 예약이 있어 건너뛰었어요" */
export function saveSummary(r: PtSaveResult): { text: string; limit: number; busy: number; sameDay: number } {
  const limit = r.skipped.filter((s) => s.reason === "limit").length;
  const busy = r.skipped.filter((s) => s.reason === "busy").length;
  const sameDay = r.skipped.filter((s) => s.reason === "same_day").length;
  const parts: string[] = [];
  if (r.made > 0) parts.push(`${r.made}건 넣었어요`);
  if (busy > 0) parts.push(`${busy}건은 그 시간에 다른 예약이 있어요`);
  if (sameDay > 0) parts.push(`${sameDay}건은 그날 이미 예약이 있어요`);
  if (limit > 0) parts.push(`${limit}건은 남은 횟수를 넘어요`);
  return { text: parts.length ? parts.join(" · ") : "넣은 예약이 없어요", limit, busy, sameDay };
}

/** 그 날짜 · 그 코치의 살아 있는 예약과 겹치는 시작 분(수업 길이만큼) — 시간 고르기에서 흐리게 */
export function busyMinutes(board: PtBoard, coach: string | null, date: string, slotMinutes: number, ignoreIds: string[] = []): Set<number> {
  const out = new Set<number>();
  const from = Date.parse(kstIso(date, 0));
  for (const b of board.bookings) {
    if (b.status !== "booked" || ignoreIds.includes(b.id)) continue;
    if (coach && b.coach_staff_id !== coach) continue;
    const s = Date.parse(b.start_at);
    const e = Date.parse(b.end_at);
    if (e <= from || s >= from + DAY) continue;
    for (let m = 0; m < 24 * 60; m += 30) {
      const t = from + m * 60_000;
      if (t < e && t + slotMinutes * 60_000 > s) out.add(m);
    }
  }
  return out;
}

/** 시간 고르기 칸 — 아침 6시 ~ 밤 11시, 30분마다 */
export const TIME_CHOICES: number[] = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);

// ── 예약 가능 시간(매주) ──
/** 월요일부터 */
export const SLOT_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export interface SlotRange {
  start_min: number;
  end_min: number;
}
export const slotsOfCoach = (slots: PtBoardSlot[], coach: string): Map<number, SlotRange[]> => {
  const m = new Map<number, SlotRange[]>();
  for (const s of slots) {
    if (s.coach_staff_id !== coach) continue;
    m.set(s.weekday, [...(m.get(s.weekday) ?? []), { start_min: s.start_min, end_min: s.end_min }].sort((a, b) => a.start_min - b.start_min));
  }
  return m;
};
/** 한 줄 요약 — "월~금 18:00~22:00" · "월·수·금 18:00~21:00 외" · 요일마다 다르면 "월~토 · 요일마다 달라요" */
export function slotSummary(week: Map<number, SlotRange[]>): string {
  const days = SLOT_WEEK_ORDER.filter((d) => (week.get(d) ?? []).length > 0);
  if (days.length === 0) return "열어 둔 시간이 없어요";
  const text = (r: SlotRange) => `${minuteClock(r.start_min)}~${r.end_min === 1440 ? "24:00" : minuteClock(r.end_min)}`;
  const sig = (d: number) => (week.get(d) ?? []).map(text).join(" · ");
  // 이어진 요일 셋 이상은 "월~금"
  const order = days.map((d) => SLOT_WEEK_ORDER.indexOf(d as (typeof SLOT_WEEK_ORDER)[number]));
  const run = days.length >= 3 && order.every((v, i) => i === 0 || v === order[i - 1] + 1);
  const names = run ? `${PT_WEEKDAY[days[0]]}~${PT_WEEKDAY[days[days.length - 1]]}` : days.map((d) => PT_WEEKDAY[d]).join("·");
  const first = sig(days[0]);
  if (!days.every((d) => sig(d) === first)) return `${names} · 요일마다 달라요`;
  const ranges = week.get(days[0]) ?? [];
  return ranges.length <= 1 ? `${names} ${first}` : `${names} ${text(ranges[0])} 외`;
}
export function slotsError(week: Map<number, SlotRange[]>): string | null {
  let count = 0;
  for (const [, ranges] of week) {
    let prevEnd = -1;
    for (const r of ranges) {
      count += 1;
      if (r.start_min % 30 !== 0 || r.end_min % 30 !== 0 || r.end_min <= r.start_min || r.start_min < 0 || r.end_min > 1440) return "시간대를 다시 확인해 주세요";
      if (r.start_min < prevEnd) return "같은 요일의 시간대가 겹쳐요";
      prevEnd = r.end_min;
    }
  }
  return count > 28 ? "시간대는 28칸까지 넣을 수 있어요" : null;
}
export const slotsPayload = (week: Map<number, SlotRange[]>): { weekday: number; start_min: number; end_min: number }[] =>
  [...week.entries()].flatMap(([weekday, ranges]) => ranges.map((r) => ({ weekday, start_min: r.start_min, end_min: r.end_min })));
