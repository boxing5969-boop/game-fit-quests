/**
 * ✅ 운동 달력 2-1단계 — 오늘의 체크 · 나만의 체크 · 그날 스티커 · 금색 별 (2026-11-12 대표님 「추천대로」)
 *   「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b — 선릉역점 봄 회원님 11/11 제안의 남은 것:
 *   앱 활동을 하면 저절로 체크(퀘스트 깨는 기분) · 내가 고르는 체크리스트(잽 몇 번) · 오늘 운동 간단히 기록.
 *   · 그날의 체크 = 저절로 3개(체육관 · 응원 · 한 줄) + 그날의 나만의 체크(3개까지). 다 채운 날 = 금색 별(보상 없음 · 별만).
 *   · 감정 설계(CLAUDE.md 「회원 감정 설계 기준」): 채운 것과 다음 한 걸음만 말한다 — 못한 것 · 빠진 날은 어디에도 없다.
 *   · 서버 값 읽기 · 계산 · 글은 여기 한 곳(시험 calendarChecks.test.ts). DB 20261112211833_calendar_checks_stage21.sql,
 *     자료는 services/calendarCheckService.ts, 화면은 components/attendance/CalendarChecks.tsx · CheckItemsSheet.tsx.
 *   · (2-3 · 2026-11-13) get_my_calendar 의 acts · notes · anniv · ddays 도 여기서 읽는다(글 · 계산은 lib/calendarMarks.ts).
 *   · (2-4 · 2026-11-13) get_my_calendar 의 recap(일요일 주간 돌아보기 알림) · partner(운동 짝꿍 — 약속 요일 · 쌍도장)도
 *     여기서 읽는다(글 · 계산은 lib/calendarTogether.ts).
 *   · (3-4 · 2026-11-14) 나만의 체크 '주 n번'(week_goal — 아무 날이나 · 금색 별에 세지 않음 = flex) · get_my_calendar 'todos'
 *     (보이는 날짜가 마감인 할 일) 도 여기서 읽는다(습관 · 할 일 글 · 계산은 lib/memberHabits.ts).
 *   · (3-5 · 2026-11-14) get_my_calendar 'mine'(내 일정 · 기념일) · 'birthday'(내 생일 MM-DD) · 'league'(리그) · 'view'(켜고 끄기 ·
 *     리그 테마) · 한 줄 'photos'(다이어리 사진 3장)도 여기서 읽는다(글 · 계산은 lib/memberEvents.ts) · 기분 스티커 8 → 20.
 */
import { weekdayOfYmd } from "@/lib/promise153";
import { normalizeCalls, normalizeEvents, type CalCall, type CalEvent } from "@/lib/calendarEvents";
import {
  normalizeActs,
  normalizeAnnivs,
  normalizeDdays,
  normalizeNotes,
  type CalAct,
  type CalAnniv,
  type CalDday,
  type CalNote,
} from "@/lib/calendarMarks";
import { RECAP_PREF_OFF, normalizePartner, normalizeRecapPref, type CalPartner, type CalRecapPref } from "@/lib/calendarTogether";
import { WEEK_GOAL_MAX, normalizeCalTodos, type CalTodo } from "@/lib/memberHabits";
import { CAL_VIEW_DEFAULT, normalizeCalView, normalizeMyEvents, type CalView, type MyEvent } from "@/lib/memberEvents";
import { normalizeWeather, type DayWeather } from "@/lib/calendarWeather";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: number) => v.toLocaleString("ko-KR");

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const CHECK_ITEM_MAX = 3;
export const CHECK_LABEL_MAX = 20;
export const CHECK_TARGET_MAX = 9999;
/** 고칠 수 있는 날 = 오늘부터 이만큼 전까지 (기억해서 적는 기록) */
export const CHECK_EDIT_DAYS = 6;
export const CHECK_UNITS = ["번", "분", "라운드", "세트", "km", "개"] as const;
export type CheckUnit = (typeof CHECK_UNITS)[number];

export type StickerKey =
  | "strong"
  | "fire"
  | "proud"
  | "mitt"
  | "sweat"
  | "tired"
  | "hurt"
  | "rest"
  | "best"
  | "party"
  | "energy"
  | "champ"
  | "focus"
  | "clap"
  | "laugh"
  | "stretch"
  | "rope"
  | "together"
  | "perfect"
  | "thanks";
/** 그날 기분 스티커 — 글자 속 이모지는 그릴 때 153 입체 아이콘이 된다(lib/emoji3d · 표에 있는 이모지만 고른다)
 *  (3-5) 8 → 20 · 서버 set_my_day_sticker · 제약 member_check_days_sticker_chk 와 같은 목록 · 처음 8개가 늘 보이는 줄 */
export const STICKERS: readonly { key: StickerKey; emoji: string; label: string }[] = [
  { key: "strong", emoji: "💪", label: "좋음" },
  { key: "fire", emoji: "🔥", label: "불태움" },
  { key: "proud", emoji: "😊", label: "뿌듯" },
  { key: "mitt", emoji: "🥊", label: "미트" },
  { key: "sweat", emoji: "💦", label: "땀 흠뻑" },
  { key: "tired", emoji: "😮‍💨", label: "피곤" },
  { key: "hurt", emoji: "🤕", label: "통증" },
  { key: "rest", emoji: "😴", label: "쉬는 날" },
  { key: "best", emoji: "👍", label: "최고" },
  { key: "party", emoji: "🎉", label: "신남" },
  { key: "energy", emoji: "⚡", label: "에너지" },
  { key: "champ", emoji: "🏆", label: "챔피언" },
  { key: "focus", emoji: "🎯", label: "집중" },
  { key: "clap", emoji: "👏", label: "박수" },
  { key: "laugh", emoji: "😂", label: "즐거움" },
  { key: "stretch", emoji: "🧘", label: "스트레칭" },
  { key: "rope", emoji: "🪢", label: "줄넘기" },
  { key: "together", emoji: "🤝", label: "함께" },
  { key: "perfect", emoji: "💯", label: "완벽" },
  { key: "thanks", emoji: "🙏", label: "감사" },
];
/** 늘 보이는 첫 줄 (나머지는 '스티커 더 보기') */
export const STICKER_FIRST_ROW = 8;
const STICKER_MAP = new Map(STICKERS.map((s) => [s.key, s]));
export const stickerOf = (key: string | null | undefined) => (key ? STICKER_MAP.get(key as StickerKey) ?? null : null);

/** 나만의 체크 예시 — 눌러서 채움 */
export const CHECK_EXAMPLES: readonly { label: string; target: number | null; unit: CheckUnit | null }[] = [
  { label: "잽", target: 100, unit: "번" },
  { label: "줄넘기", target: 10, unit: "분" },
  { label: "섀도복싱", target: 3, unit: "라운드" },
  { label: "스트레칭", target: 5, unit: "분" },
];

// ───────────────────────── 서버 값 ─────────────────────────
export interface CheckItem {
  id: string;
  label: string;
  target: number | null;
  unit: string | null;
  /** null = 매일 · [1,3,5] = 월 · 수 · 금 (0 = 일) */
  weekdays: number[] | null;
  /** (3-4) 주 n번(1 ~ 6) — 아무 날이나 · 금색 별에 세지 않음. null = 요일 또는 매일 */
  weekGoal: number | null;
  createdOn: string;
  archivedOn: string | null;
}

export type JournalVisibility = "branch" | "partners" | "private";
export interface JournalLine {
  id: string;
  content: string;
  mood: string | null;
  photoUrl: string | null;
  /** (3-5) 다이어리 사진 — 3장까지 (첫 장 = photoUrl · 없으면 photoUrl 한 장으로 본다) */
  photos?: string[];
  visibility: JournalVisibility;
  at: string;
}

export interface CalDay {
  day: string;
  /** 동료에게 응원을 보냈나 */
  cheer: boolean;
  /** 커뮤니티에서 153 을 눌렀나 */
  give153: boolean;
  journal: JournalLine | null;
  done: string[];
  sticker: StickerKey | null;
}

export interface CalState {
  on: boolean;
  today: string | null;
  items: CheckItem[];
  days: Map<string, CalDay>;
  /** (2-2) 내 지점 153 일정 — 보이는 날짜에 걸친 것 */
  events: CalEvent[];
  /** (2-2) 내가 올렸거나 저요 한 운동 모집 */
  calls: CalCall[];
  /** (2-2) 저녁 독려 — 켠 회원만 저녁 8시 한 번 */
  nudge: { on: boolean; at: string };
  /** (2-3) 그날 한 일 — PT 수업 · 153 PB · 타이틀매치 · 레벨업 (보이는 날짜) */
  acts: CalAct[];
  /** (2-3) 코치 한마디 도장 (보이는 날짜) */
  notes: CalNote[];
  /** (2-3) 153 기념일 (보이는 날짜) */
  anniv: CalAnniv[];
  /** (2-3) 153 D-day — 보이는 날짜와 상관없이 다가오는 것 */
  ddays: CalDday[];
  /** (2-4) 일요일 주간 돌아보기 알림 — 켬/끔 · 시각 · 이 회원에게 가는지 */
  recap: CalRecapPref;
  /** (2-4) 운동 짝꿍 — 약속 요일 · 보이는 날짜 중 둘 다 온 날(쌍도장). 짝꿍이 없으면 null */
  partner: CalPartner | null;
  /** (3-4) 보이는 날짜가 마감인 할 일 */
  todos: CalTodo[];
  /** (3-5) 보이는 날짜에 걸친 내 일정 · 기념일 (반복 · 음력은 lib/memberEvents 가 날마다 펼친다) */
  mine: MyEvent[];
  /** (3-5) 내 생일 'MM-DD' (모르면 null) */
  birthday: string | null;
  /** (3-5) 내 리그 white · blue · red · black (리그 테마 도장 색) */
  league: string | null;
  /** (3-5) 캘린더 켜고 끄기 · 리그 테마 (계정마다) */
  view: CalView;
  /** (3-5 날씨) 내 지점 날씨 — 보이는 날짜 (lib/calendarWeather · 출석한 날이 비 · 눈 · 폭염 · 한파면 도장) */
  weather: Map<string, DayWeather>;
}

export const CAL_OFF: CalState = {
  on: false,
  today: null,
  items: [],
  days: new Map(),
  events: [],
  calls: [],
  nudge: { on: false, at: "20:00" },
  acts: [],
  notes: [],
  anniv: [],
  ddays: [],
  recap: RECAP_PREF_OFF,
  partner: null,
  todos: [],
  mine: [],
  birthday: null,
  league: null,
  view: CAL_VIEW_DEFAULT,
  weather: new Map(),
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ymd = (v: unknown): string | null => {
  const s = str(v);
  return s && YMD.test(s.slice(0, 10)) ? s.slice(0, 10) : null;
};
const int = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? Math.trunc(x) : null;
};

function normalizeItem(raw: unknown): CheckItem | null {
  const r = obj(raw);
  const id = str(r?.id);
  const label = str(r?.label);
  const createdOn = ymd(r?.created_on);
  if (!r || !id || !label || !createdOn) return null;
  const target = int(r.target);
  const wg = int(r.week_goal);
  const days = Array.isArray(r.weekdays)
    ? [...new Set(r.weekdays.map(int).filter((d): d is number => d != null && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : null;
  return {
    id,
    label,
    target: target != null && target >= 1 ? target : null,
    unit: target != null ? str(r.unit) : null,
    weekdays: days && days.length > 0 && days.length < 7 ? days : null,
    weekGoal: wg != null && wg >= 1 && wg <= WEEK_GOAL_MAX ? wg : null,
    createdOn,
    archivedOn: ymd(r.archived_on),
  };
}

function normalizeJournal(raw: unknown): JournalLine | null {
  const r = obj(raw);
  const id = str(r?.id);
  const content = str(r?.content);
  if (!r || !id || !content) return null;
  const vis = str(r.visibility);
  const photoUrl = str(r.photo_url);
  const photos = Array.isArray(r.photos) ? [...new Set(r.photos.map(str).filter((x): x is string => !!x))].slice(0, 3) : [];
  return {
    id,
    content,
    mood: str(r.mood),
    photoUrl: photoUrl ?? photos[0] ?? null,
    photos: photos.length ? photos : photoUrl ? [photoUrl] : [],
    visibility: vis === "partners" || vis === "private" ? vis : "branch",
    at: str(r.at) ?? "",
  };
}

export function normalizeCalendar(raw: unknown): CalState {
  const r = obj(raw);
  if (!r || r.on !== true) return CAL_OFF;
  const items = (Array.isArray(r.items) ? r.items : []).map(normalizeItem).filter((x): x is CheckItem => !!x);
  const days = new Map<string, CalDay>();
  for (const e of Array.isArray(r.days) ? r.days : []) {
    const d = obj(e);
    const day = ymd(d?.day);
    if (!d || !day) continue;
    const st = stickerOf(str(d.sticker));
    days.set(day, {
      day,
      cheer: d.cheer === true,
      give153: d.give153 === true,
      journal: normalizeJournal(d.journal),
      done: Array.isArray(d.done) ? d.done.map(str).filter((x): x is string => !!x) : [],
      sticker: st ? st.key : null,
    });
  }
  const nudge = obj(r.nudge);
  const at = str(nudge?.at);
  return {
    on: true,
    today: ymd(r.today),
    items,
    days,
    events: normalizeEvents(r.events),
    calls: normalizeCalls(r.calls),
    nudge: { on: nudge?.on === true, at: at && /^\d{2}:\d{2}$/.test(at) ? at : "20:00" },
    acts: normalizeActs(r.acts),
    notes: normalizeNotes(r.notes),
    anniv: normalizeAnnivs(r.anniv),
    ddays: normalizeDdays(r.ddays),
    recap: normalizeRecapPref(r.recap),
    partner: normalizePartner(r.partner),
    todos: normalizeCalTodos(r.todos),
    mine: normalizeMyEvents(r.mine),
    birthday: typeof r.birthday === "string" && /^\d{2}-\d{2}$/.test(r.birthday) ? r.birthday : null,
    league: str(r.league),
    view: normalizeCalView(r.view),
    weather: normalizeWeather(r.weather),
  };
}

// ───────────────────────── 날짜 ─────────────────────────
const addDays = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** 고칠 수 있는 날인가 — 오늘부터 6일 전까지 */
export const canEditDay = (day: string, today: string): boolean =>
  YMD.test(day) && YMD.test(today) && day <= today && day >= addDays(today, -CHECK_EDIT_DAYS);

/** 보이는 날짜들 → 서버에 물을 범위 */
export function calendarRange(days: readonly string[]): { from: string; to: string } | null {
  const ok = days.filter((d) => YMD.test(d)).sort();
  return ok.length ? { from: ok[0], to: ok[ok.length - 1] } : null;
}

// ───────────────────────── 그날의 체크 ─────────────────────────
/** '잽 100번' · '줄넘기 10분' · '스트레칭' */
export const itemLabel = (i: Pick<CheckItem, "label" | "target" | "unit">): string =>
  i.target != null ? `${i.label} ${n(i.target)}${i.unit ?? ""}` : i.label;

/** 그날의 나만의 체크 — 그날 있던 항목(만든 날부터 · 뺀 날 전까지) 중 그 요일 것 */
export function itemsForDay(items: readonly CheckItem[], day: string): CheckItem[] {
  if (!YMD.test(day)) return [];
  const wd = weekdayOfYmd(day);
  return items.filter(
    (i) => i.createdOn <= day && (i.archivedOn == null || i.archivedOn > day) && (i.weekdays == null || i.weekdays.includes(wd)),
  );
}

export type CheckKind = "gym" | "cheer" | "line" | "custom";
export interface DayCheck {
  key: string;
  kind: CheckKind;
  label: string;
  done: boolean;
  /** 나만의 체크 항목 id */
  itemId?: string;
  /** (3-4) 주 n번 체크 — 그날 해도 되고 안 해도 되는 칸 · 금색 별 · 한 줄에 세지 않는다 */
  flex?: boolean;
}

/** 그날의 체크 — 저절로 3개(체육관 · 응원 · 한 줄) + 그날의 나만의 체크
 *  (2-2) 휴관일(closed)에 안 왔으면 체육관은 빼고 센다 — 쉬는 날도 금색 별을 받을 수 있게 (서버 _cal_check_count 와 같은 식) */
export function dayChecks(
  day: string,
  attended: boolean,
  cal: CalDay | undefined,
  items: readonly CheckItem[],
  closed = false,
): DayCheck[] {
  const done = new Set(cal?.done ?? []);
  return [
    ...(closed && !attended ? [] : [{ key: "gym", kind: "gym" as const, label: "체육관", done: attended }]),
    { key: "cheer", kind: "cheer", label: "응원", done: !!cal && (cal.cheer || cal.give153) },
    { key: "line", kind: "line", label: "한 줄", done: !!cal?.journal },
    ...itemsForDay(items, day).map(
      (i): DayCheck => ({
        key: `item:${i.id}`,
        kind: "custom",
        label: itemLabel(i),
        done: done.has(i.id),
        itemId: i.id,
        ...(i.weekGoal ? { flex: true } : {}),
      }),
    ),
  ];
}

/** 금색 별 — 그날의 체크를 다 채운 날 · (3-4) 주 n번 체크는 세지 않는다(서버 _cal_check_count 와 같은 식) */
export const isStarDay = (checks: readonly DayCheck[]): boolean => {
  const must = checks.filter((c) => !c.flex);
  return must.length > 0 && must.every((c) => c.done);
};

/** 한 줄 — 채운 것과 다음 한 걸음만 (지난 날 0개는 아무 말도 안 한다) · 주 n번 체크는 세지 않는다 */
export function checkProgress(checks: readonly DayCheck[], isToday: boolean): string | null {
  const must = checks.filter((c) => !c.flex);
  const total = must.length;
  const done = must.filter((c) => c.done).length;
  if (total === 0) return null;
  if (done === total) return isToday ? "오늘 금색 별을 받았어요" : "금색 별을 받은 날이에요";
  if (done === 0) return isToday ? "하나씩 채우면 금색 별이 돼요" : null;
  return isToday ? `${done}개 채웠어요 · ${total - done}개 더 채우면 금색 별` : `이날 ${done}개 채웠어요`;
}

/** 할 때마다 바로 보이게 — 서버 답을 기다리지 않고 캐시를 고친다 */
export function applyDone(state: CalState, day: string, itemId: string, done: boolean): CalState {
  const prev = state.days.get(day);
  const set = new Set(prev?.done ?? []);
  if (done) set.add(itemId);
  else set.delete(itemId);
  const next = new Map(state.days);
  next.set(day, { day, cheer: false, give153: false, journal: null, sticker: null, ...prev, done: [...set] });
  return { ...state, days: next };
}

export function applySticker(state: CalState, day: string, sticker: StickerKey | null): CalState {
  const prev = state.days.get(day);
  const next = new Map(state.days);
  next.set(day, { day, cheer: false, give153: false, journal: null, done: [], ...prev, sticker });
  return { ...state, days: next };
}

// ───────────────────────── 나만의 체크 만들기 ─────────────────────────
/** (3-4) 언제 체크하나 — 매일 · 요일 · 주 n번(아무 날이나) */
export type CheckSchedule = "daily" | "days" | "goal";

export interface CheckItemDraft {
  label: string;
  /** 비우면 숫자 없이 (예: 스트레칭) */
  target: string;
  unit: CheckUnit | null;
  /** 요일(schedule 'days') — 예전 화면처럼 비우면 매일 */
  weekdays: number[];
  /** (3-4) 없으면 예전처럼 — 요일을 골랐으면 'days', 아니면 'daily' */
  schedule?: CheckSchedule;
  /** (3-4) 주 n번 (schedule 'goal') */
  goal?: number;
}

export const emptyCheckDraft = (): CheckItemDraft => ({ label: "", target: "", unit: "번", weekdays: [], schedule: "daily", goal: 3 });

export const draftFromItem = (i: CheckItem): CheckItemDraft => ({
  label: i.label,
  target: i.target != null ? String(i.target) : "",
  unit: (CHECK_UNITS as readonly string[]).includes(i.unit ?? "") ? (i.unit as CheckUnit) : "번",
  weekdays: i.weekdays ?? [],
  schedule: i.weekGoal ? "goal" : i.weekdays ? "days" : "daily",
  goal: i.weekGoal ?? 3,
});

/** 고른 방식 (예전 초안은 요일이 있으면 'days') */
export const scheduleOf = (d: CheckItemDraft): CheckSchedule => d.schedule ?? (d.weekdays.length > 0 && d.weekdays.length < 7 ? "days" : "daily");

const tidyLabel = (s: string) => s.replace(/\s+/g, " ").trim();

/** 서버(set_my_check_item)와 같은 검사 — 통과하면 null */
export function checkItemError(d: CheckItemDraft): string | null {
  const label = tidyLabel(d.label);
  if (!label) return "체크 이름을 적어 주세요";
  if ([...label].length > CHECK_LABEL_MAX) return "체크 이름은 20자 안으로 적어 주세요";
  const t = d.target.trim();
  if (t) {
    const v = Number(t.replace(/,/g, ""));
    if (!Number.isInteger(v) || v < 1 || v > CHECK_TARGET_MAX) return "목표 숫자는 1부터 9,999까지 적어 주세요";
    if (d.unit && !(CHECK_UNITS as readonly string[]).includes(d.unit)) return "단위를 다시 골라 주세요";
  }
  if (d.weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) return "요일을 다시 골라 주세요";
  const sc = scheduleOf(d);
  if (sc === "days" && d.schedule === "days" && d.weekdays.length === 0) return "요일을 하나 이상 골라 주세요";
  if (sc === "goal" && !(Number.isInteger(d.goal) && (d.goal as number) >= 1 && (d.goal as number) <= WEEK_GOAL_MAX)) return "주 1번부터 6번까지 골라 주세요";
  return null;
}

export function checkItemPayload(d: CheckItemDraft, id?: string | null) {
  const t = d.target.trim();
  const target = t ? Number(t.replace(/,/g, "")) : null;
  const days = scheduleOf(d) === "days" ? [...new Set(d.weekdays)].sort((a, b) => a - b) : [];
  return {
    p_id: id ?? null,
    p_label: tidyLabel(d.label),
    p_target: target,
    p_unit: target != null ? d.unit : null,
    p_weekdays: days.length === 0 || days.length === 7 ? null : days,
  };
}

/** (3-4) 저장 뒤 주 n번 — 'goal' 이면 그 수, 'daily' · 'days' 면 비우기(null). 예전 항목에 원래 없었으면 부르지 않아도 된다 */
export const checkGoalOf = (d: CheckItemDraft): number | null => (scheduleOf(d) === "goal" ? (d.goal ?? null) : null);

/** (3-5) 한 줄의 사진들 — photos 가 없으면(예전 자료) photoUrl 한 장 */
export const journalPhotos = (j: Pick<JournalLine, "photoUrl" | "photos">): string[] => (j.photos?.length ? j.photos : j.photoUrl ? [j.photoUrl] : []);
