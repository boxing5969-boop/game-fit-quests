/**
 * 🤝 153 운동 약속 · 코치 「오늘 만날 회원」 — 서버 JSON 읽기 · 화면 글 한 곳
 *   (2026-11-12 대표님 「추천하는대로 진행할게」 — CLAUDE.md 「회원 감정 설계 기준」 · DB 20261112192617_promise_stage1.sql)
 *   감정 설계:
 *     · 약속한 날 = 달력에 점선 테두리(오늘 · 앞으로만) → 출석하면 그대로 민트 도장. 놓친 약속은 어디에도 표시하지 않는다.
 *     · 줄 글은 잘한 것과 다음 한 걸음만 — '오늘 약속 지켰어요' · '오늘이 약속한 날이에요' · '이번 주 약속 n번 지켰어요 · 다음 약속 목요일'.
 *     · 지킴 = 약속한 날 출석(시간대 무관) — 회원이 직접 체크하지 않는다.
 *   요일 번호는 서버와 같다: 0 = 일요일 … 6 = 토요일 (화면 칸은 월요일부터).
 *   (2-2 · 2026-11-13) 알림 시각 고르기(remind — 전날 저녁 · 아침 7시 · 8시 30분 · 낮 12시 · 오후 5시) ·
 *   153 휴관일은 약속한 날로 치지 않는다(skip — 운동 달력이 보이는 범위의 휴관일을 넘긴다).
 *   (2-3 · 2026-11-13) 「오늘 만날 회원」에 '오늘 n주년'(153 등록일 · 모르면 첫 도장) · '출석 n번째'(그날 채운 출석 축하) 칩 ·
 *   줄마다 코치 한마디(notes) · 오늘 온 다른 회원(others — 접힌 줄, 누구에게나 한마디). DB 20261113012729_calendar_stage23.sql.
 *   시험 promise153.test.ts
 */
import { hmLabel } from "@/lib/calendarEvents";

export type TimeSlot = "dawn" | "morning" | "noon" | "afternoon" | "evening" | "night";

/** 고르는 순서 · 이름 (내 운동 기록 시간대와 같은 말) */
export const TIME_SLOTS: readonly { key: TimeSlot; label: string; range: string }[] = [
  { key: "dawn", label: "새벽", range: "0–6시" },
  { key: "morning", label: "아침", range: "6–11시" },
  { key: "noon", label: "점심", range: "11–14시" },
  { key: "afternoon", label: "오후", range: "14–18시" },
  { key: "evening", label: "저녁", range: "18–21시" },
  { key: "night", label: "밤", range: "21–24시" },
];
const SLOT_LABEL = new Map(TIME_SLOTS.map((s) => [s.key, s.label]));
export const slotLabel = (slot: TimeSlot | null | undefined): string | null => (slot ? SLOT_LABEL.get(slot) ?? null : null);

/** 월요일부터 고르는 칸 — 값은 서버 요일 번호 */
export const PROMISE_WEEK: readonly { day: number; label: string }[] = [
  { day: 1, label: "월" },
  { day: 2, label: "화" },
  { day: 3, label: "수" },
  { day: 4, label: "목" },
  { day: 5, label: "금" },
  { day: 6, label: "토" },
  { day: 0, label: "일" },
];
const DAY_NAME = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DAY_FULL = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

/** 대비책 예시 — 눌러서 채움 (11/08 계획 「대비책 1줄(예시 버튼 3개)」) */
export const PLAN_B_EXAMPLES: readonly string[] = [
  "늦게 끝나면 30분만 하고 와요",
  "피곤한 날엔 줄넘기만 하고 와요",
  "못 간 날은 다음 날 바로 가요",
];
export const PLAN_B_MAX = 60;
/** 처음 고를 때 권하는 횟수 — 첫 4주 8번(주 2회)과 같은 숫자 */
export const SUGGESTED_DAYS = 2;

/** 약속 알림 시각 — eve = 전날 저녁(서버 calendar_notice.promise_eve) · 그 밖 = 그날 그 시각 (서버와 같은 값) */
export type RemindKey = "eve" | "07:00" | "08:30" | "12:00" | "17:00";
export const REMIND_KEYS: readonly RemindKey[] = ["eve", "07:00", "08:30", "12:00", "17:00"];
export const DEFAULT_REMIND: RemindKey = "08:30";
const isRemind = (v: unknown): v is RemindKey => typeof v === "string" && (REMIND_KEYS as readonly string[]).includes(v);

/** '전날 저녁 8시' · '아침 7시' · '아침 8시 30분' · '낮 12시' · '오후 5시' */
export const remindLabel = (k: RemindKey | null | undefined, eveAt = "20:00"): string =>
  (k ?? DEFAULT_REMIND) === "eve" ? `전날 ${hmLabel(eveAt)}` : hmLabel(k ?? DEFAULT_REMIND);

export interface Promise153 {
  weekdays: number[];
  timeSlot: TimeSlot | null;
  planB: string | null;
  notify: boolean;
  /** 알림 시각 (null = 기본 8시 30분) */
  remind: RemindKey | null;
  startedOn: string;
}

export interface PromiseState {
  on: boolean;
  branch: string | null;
  today: string | null;
  returnBonus: number;
  remindAt: string;
  /** '전날 저녁' 알림 시각 */
  eveAt: string;
  promise: Promise153 | null;
}

export const PROMISE_OFF: PromiseState = {
  on: false,
  branch: null,
  today: null,
  returnBonus: 0,
  remindAt: "08:30",
  eveAt: "20:00",
  promise: null,
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const isSlot = (v: unknown): v is TimeSlot => typeof v === "string" && SLOT_LABEL.has(v as TimeSlot);

export function normalizePromise(raw: unknown): Promise153 | null {
  const p = obj(raw);
  const days = Array.isArray(p.weekdays)
    ? [...new Set(p.weekdays.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const startedOn = str(p.started_on);
  if (days.length === 0 || !startedOn || !YMD.test(startedOn)) return null;
  return {
    weekdays: days,
    timeSlot: isSlot(p.time_slot) ? p.time_slot : null,
    planB: str(p.plan_b),
    notify: p.notify !== false,
    remind: isRemind(p.remind) ? p.remind : null,
    startedOn,
  };
}

export function normalizePromiseState(raw: unknown): PromiseState {
  const r = obj(raw);
  if (r.on !== true) return PROMISE_OFF;
  const today = str(r.today);
  return {
    on: true,
    branch: str(r.branch),
    today: today && YMD.test(today) ? today : null,
    returnBonus: int(r.return_bonus),
    remindAt: str(r.remind_at) ?? "08:30",
    eveAt: /^\d{2}:\d{2}$/.test(str(r.eve_at) ?? "") ? (str(r.eve_at) as string) : "20:00",
    promise: normalizePromise(r.promise),
  };
}

// ───────────────────────── 날짜 ─────────────────────────
/** 'YYYY-MM-DD' → 0(일) … 6(토) — 기기 시간대와 상관없이 */
export const weekdayOfYmd = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const addDays = (ymd: string, n: number): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** 그날이 약속한 날인가 — 약속을 건 날부터 */
export const isPromisedDay = (p: Pick<Promise153, "weekdays" | "startedOn"> | null | undefined, day: string): boolean =>
  !!p && YMD.test(day) && day >= p.startedOn && p.weekdays.includes(weekdayOfYmd(day));

/** 오늘 다음의 약속한 날 (오늘은 빼고 · skip = 휴관일) — 없으면 null */
export function nextPromisedDay(
  p: Pick<Promise153, "weekdays" | "startedOn"> | null | undefined,
  today: string,
  skip?: ReadonlySet<string>,
): string | null {
  if (!p || p.weekdays.length === 0 || !YMD.test(today)) return null;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    if (isPromisedDay(p, d) && !skip?.has(d)) return d;
  }
  return null;
}

/** 이번 주(월~오늘) 약속한 날 중 온 날 수 (휴관일에 온 날도 센다 — 온 것은 잘한 것) */
export function weekKept(p: Pick<Promise153, "weekdays" | "startedOn"> | null | undefined, today: string, attended: ReadonlySet<string>): number {
  if (!p || !YMD.test(today)) return 0;
  const back = (weekdayOfYmd(today) + 6) % 7; // 월요일까지 며칠
  let n = 0;
  for (let i = 0; i <= back; i++) {
    const d = addDays(today, -i);
    if (isPromisedDay(p, d) && attended.has(d)) n += 1;
  }
  return n;
}

/** '화 · 목' · '평일' · '매일' */
export function weekdaysLabel(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "매일";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "평일";
  return PROMISE_WEEK.filter((w) => set.has(w.day)).map((w) => w.label).join(" · ");
}

/** 약속 문장 — '매주 화 · 목 저녁, 선릉역점에서 운동해요' (해요체) */
export function promiseSentence(p: Pick<Promise153, "weekdays" | "timeSlot">, branchShort?: string | null): string {
  const days = weekdaysLabel(p.weekdays);
  const when = days === "매일" || days === "평일" ? days : `매주 ${days}`;
  const slot = slotLabel(p.timeSlot);
  const place = branchShort ? `, ${branchShort}에서` : "";
  return `${when}${slot ? ` ${slot}` : ""}${place} 운동해요`;
}

export type PromiseTone = "done" | "today" | "next";

/** 달력 카드 안 한 줄 — 잘한 것과 다음 한 걸음만 (놓친 약속 · 0번은 말하지 않는다 · skip = 휴관일은 약속한 날로 치지 않는다) */
export function promiseStatus(
  p: Promise153 | null | undefined,
  today: string,
  attended: ReadonlySet<string>,
  skip?: ReadonlySet<string>,
): { text: string; tone: PromiseTone } | null {
  if (!p || !YMD.test(today)) return null;
  const slot = slotLabel(p.timeSlot);
  const next = nextPromisedDay(p, today, skip);
  const nextText = next ? `다음 약속 ${DAY_FULL[weekdayOfYmd(next)]}${slot ? ` ${slot}` : ""}` : null;
  if (isPromisedDay(p, today) && (!skip?.has(today) || attended.has(today))) {
    if (attended.has(today)) return { text: nextText ? `오늘 약속 지켰어요 · ${nextText}` : "오늘 약속 지켰어요", tone: "done" };
    return { text: slot ? `오늘이 약속한 날이에요 · ${slot}에 만나요` : "오늘이 약속한 날이에요 · 체육관에서 만나요", tone: "today" };
  }
  const kept = weekKept(p, today, attended);
  if (kept > 0) return { text: nextText ? `이번 주 약속 ${kept}번 지켰어요 · ${nextText}` : `이번 주 약속 ${kept}번 지켰어요`, tone: "done" };
  return nextText ? { text: nextText, tone: "next" } : null;
}

// ───────────────────────── 걸기 · 고치기 ─────────────────────────
export interface PromiseDraft {
  weekdays: number[];
  timeSlot: TimeSlot | null;
  planB: string;
  notify: boolean;
  remind: RemindKey;
}

export const draftFromPromise = (p: Promise153 | null): PromiseDraft =>
  p
    ? { weekdays: [...p.weekdays], timeSlot: p.timeSlot, planB: p.planB ?? "", notify: p.notify, remind: p.remind ?? DEFAULT_REMIND }
    : { weekdays: [], timeSlot: null, planB: "", notify: true, remind: DEFAULT_REMIND };

/** 고친 것이 있나 (저장한 약속과 같으면 휴대폰 캘린더 단추를 보인다) */
export const draftChanged = (d: PromiseDraft, p: Promise153 | null): boolean => {
  const a = draftFromPromise(p);
  return (
    [...d.weekdays].sort().join() !== [...a.weekdays].sort().join() ||
    d.timeSlot !== a.timeSlot ||
    d.planB.replace(/\s+/g, " ").trim() !== a.planB ||
    d.notify !== a.notify ||
    d.remind !== a.remind
  );
};

/** 서버(set_my_promise)와 같은 검사 — 통과하면 null */
export function promiseDraftError(d: PromiseDraft): string | null {
  if (d.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) return "요일을 다시 골라 주세요";
  if (d.weekdays.length === 0) return "약속할 요일을 하나 이상 골라 주세요";
  if (d.planB.replace(/\s+/g, " ").trim().length > PLAN_B_MAX) return `대비책은 ${PLAN_B_MAX}자 안으로 적어 주세요`;
  return null;
}

export const promisePayload = (d: PromiseDraft) => ({
  p_weekdays: [...new Set(d.weekdays)].sort((a, b) => a - b),
  p_time_slot: d.timeSlot,
  p_plan_b: d.planB.replace(/\s+/g, " ").trim() || null,
  p_notify: d.notify,
  p_remind: d.remind,
});

/** 요일 고르기 — 누르면 넣고 빼기 */
export const toggleDay = (days: readonly number[], day: number): number[] =>
  days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);

/** 고른 횟수 안내 — 1번이면 한 번 더 권하고, 주 2번이면 칭찬 (못한다는 말 없이) */
export function draftHint(days: number): string {
  if (days <= 0) return `주 ${SUGGESTED_DAYS}번부터 시작해 보세요`;
  if (days === 1) return "한 번이라도 좋아요 · 주 2번이면 몸이 더 빨리 기억해요";
  if (days === 2) return "주 2번 · 첫 4주 8번과 같은 속도예요";
  return `주 ${days}번 · 지킬 수 있는 만큼이 가장 좋아요`;
}

// ───────────────────────── 코치 「오늘 만날 회원」 ─────────────────────────
/** (2-3) 그 회원 오늘 칸의 코치 한마디 — mine = 내가 남긴 것 */
export interface MeetNote {
  id: string;
  who: string;
  title: string;
  body: string;
  mine: boolean;
}

export interface MeetRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  cameAt: string | null;
  promised: boolean;
  timeSlot: TimeSlot | null;
  starterDay: number | null;
  starterCount: number | null;
  gapDays: number | null;
  daysLeft: number | null;
  partnerCall: boolean;
  /** (2-3) 오늘 n주년 — reg = 153 등록일 · stamp = 첫 도장 */
  annivYears: number | null;
  annivBasis: "reg" | "stamp" | null;
  /** (2-3) 오늘 채운 출석 축하 (50 · 100 · 150 …) */
  milestone: number | null;
  notes: MeetNote[];
}

/** (2-3) 오늘 온 다른 회원 — 특별한 까닭은 없지만 코치 한마디를 남길 수 있게 (접힌 줄) */
export interface MeetOther {
  userId: string;
  name: string;
  cameAt: string | null;
  notes: MeetNote[];
}

export interface MeetToday {
  on: boolean;
  branch: string | null;
  today: string | null;
  rows: MeetRow[];
  others: MeetOther[];
  /** (2-3) 코치 한마디를 남길 수 있나 (서버에 함수가 있을 때) */
  canNote: boolean;
}

export const MEET_OFF: MeetToday = { on: false, branch: null, today: null, rows: [], others: [], canNote: false };

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

function normalizeMeetNotes(raw: unknown): MeetNote[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x): MeetNote | null => {
      const o = obj(x);
      const id = str(o.id);
      const body = str(o.body);
      if (!id || !body) return null;
      return { id, who: str(o.who) ?? "코치", title: str(o.title) ?? "코치", body, mine: o.mine === true };
    })
    .filter((x): x is MeetNote => !!x);
}

export function normalizeMeet(raw: unknown): MeetToday {
  const r = obj(raw);
  if (r.on !== true) return { ...MEET_OFF, branch: str(r.branch) };
  const rows = (Array.isArray(r.rows) ? r.rows : [])
    .map((x): MeetRow | null => {
      const o = obj(x);
      const userId = str(o.user_id);
      if (!userId) return null;
      const years = numOrNull(o.anniv_years);
      const milestone = numOrNull(o.milestone);
      return {
        userId,
        name: str(o.name) ?? "회원",
        avatarUrl: str(o.avatar_url),
        cameAt: str(o.came_at),
        promised: o.promised === true,
        timeSlot: isSlot(o.time_slot) ? o.time_slot : null,
        starterDay: numOrNull(o.starter_day),
        starterCount: numOrNull(o.starter_count),
        gapDays: numOrNull(o.gap_days),
        daysLeft: numOrNull(o.days_left),
        partnerCall: o.partner_call === true,
        annivYears: years != null && years >= 1 ? years : null,
        annivBasis: years != null && years >= 1 ? (o.anniv_basis === "reg" ? "reg" : "stamp") : null,
        milestone: milestone != null && milestone > 0 ? milestone : null,
        notes: normalizeMeetNotes(o.notes),
      };
    })
    .filter((x): x is MeetRow => !!x);
  const others = (Array.isArray(r.others) ? r.others : [])
    .map((x): MeetOther | null => {
      const o = obj(x);
      const userId = str(o.user_id);
      if (!userId) return null;
      return { userId, name: str(o.name) ?? "회원", cameAt: str(o.came_at), notes: normalizeMeetNotes(o.notes) };
    })
    .filter((x): x is MeetOther => !!x);
  return { on: true, branch: str(r.branch), today: str(r.today), rows, others, canNote: r.can_note === true };
}

export type MeetKey = "starter" | "anniv" | "milestone" | "back" | "promise" | "expiring" | "partner";

export interface MeetReason {
  key: MeetKey;
  /** 칩 — '첫 출석' · '첫 4주 3번째' · '23일 만에' · '약속한 날' · '수강권 5일' · '운동 모집' */
  label: string;
  /** 코치님이 할 한 가지 — 153 기준 다섯 가지와 같은 결 */
  say: string;
}

/** 그 회원을 왜 오늘 만나나 — 중요한 순서(첫 출석 · 첫 4주 > 기념일 · 출석 축하 > 다시 온 > 약속 > 수강권 > 모집) */
export function meetReasons(r: MeetRow): MeetReason[] {
  const out: MeetReason[] = [];
  if (r.starterCount != null && r.starterDay != null) {
    if (r.starterCount <= 1 && r.cameAt) out.push({ key: "starter", label: "첫 출석", say: "이름을 불러 주고 먼저 인사해 주세요" });
    else out.push({ key: "starter", label: `첫 4주 ${r.starterCount}번째`, say: "이름을 부르고 오늘 잘한 것 하나를 말해 주세요" });
  }
  // (2-3) 153 기념일 · 출석 축하 — 오늘이 그 회원의 날
  if (r.annivYears != null) {
    out.push(
      r.annivBasis === "reg"
        ? { key: "anniv", label: `오늘 ${r.annivYears}주년`, say: `'153과 함께한 ${r.annivYears}년 고마워요' 하고 축하해 주세요` }
        : { key: "anniv", label: `첫 도장 ${r.annivYears}주년`, say: `'첫 도장 찍은 지 ${r.annivYears}년이에요' 하고 축하해 주세요` },
    );
  }
  if (r.milestone != null) {
    out.push({ key: "milestone", label: `출석 ${r.milestone}번째`, say: `'오늘 ${r.milestone}번째 출석이에요' 하고 축하해 주세요` });
  }
  if (r.gapDays != null) out.push({ key: "back", label: `${r.gapDays}일 만에`, say: "'다시 와서 반가워요' 한마디면 충분해요" });
  if (r.promised) {
    const slot = slotLabel(r.timeSlot);
    out.push({
      key: "promise",
      label: slot ? `약속한 날 · ${slot}` : "약속한 날",
      say: r.cameAt ? "'약속 지키러 오셨네요' 하고 반겨 주세요" : "오면 '약속 지키러 오셨네요' 하고 반겨 주세요",
    });
  }
  if (r.daysLeft != null) out.push({ key: "expiring", label: `수강권 ${r.daysLeft}일`, say: "지금까지 늘어난 것과 다음 목표 하나를 이야기해 주세요" });
  if (r.partnerCall) out.push({ key: "partner", label: "운동 모집", say: "오늘 모집에 먼저 '저요' 해 주세요" });
  return out;
}

/** 온 회원 먼저(늦게 온 순 — 지금 체육관에 있을 확률이 높다) · 아직 안 온 약속 회원은 시간대 순 */
export function sortMeetRows(rows: readonly MeetRow[]): MeetRow[] {
  const slotIdx = (s: TimeSlot | null) => (s ? TIME_SLOTS.findIndex((x) => x.key === s) : TIME_SLOTS.length);
  return [...rows].sort((a, b) => {
    if (!!a.cameAt !== !!b.cameAt) return a.cameAt ? -1 : 1;
    if (a.cameAt && b.cameAt) return b.cameAt.localeCompare(a.cameAt);
    const s = slotIdx(a.timeSlot) - slotIdx(b.timeSlot);
    return s !== 0 ? s : a.name.localeCompare(b.name, "ko");
  });
}

/** 카드 머리 한 줄 — '온 회원 4명 · 약속한 회원 2명' (0명 칸은 빼고) */
export function meetSummary(rows: readonly MeetRow[]): string {
  const came = rows.filter((r) => r.cameAt).length;
  const waiting = rows.filter((r) => !r.cameAt && r.promised).length;
  return [came ? `온 회원 ${came}명` : "", waiting ? `아직 안 온 약속 ${waiting}명` : ""].filter(Boolean).join(" · ");
}

/** 들어온 시각 'HH:MM' (KST) */
export function kstHm(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + 9 * 3600_000).toISOString().slice(11, 16);
}

export const dayName = (ymd: string): string => DAY_NAME[weekdayOfYmd(ymd)];
