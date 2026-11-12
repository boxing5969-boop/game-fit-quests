/**
 * ✅ 운동 달력 2-1단계 — 오늘의 체크 · 나만의 체크 · 그날 스티커 · 금색 별 (2026-11-12 대표님 「추천대로」)
 *   「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b — 선릉역점 봄 회원님 11/11 제안의 남은 것:
 *   앱 활동을 하면 저절로 체크(퀘스트 깨는 기분) · 내가 고르는 체크리스트(잽 몇 번) · 오늘 운동 간단히 기록.
 *   · 그날의 체크 = 저절로 3개(체육관 · 응원 · 한 줄) + 그날의 나만의 체크(3개까지). 다 채운 날 = 금색 별(보상 없음 · 별만).
 *   · 감정 설계(CLAUDE.md 「회원 감정 설계 기준」): 채운 것과 다음 한 걸음만 말한다 — 못한 것 · 빠진 날은 어디에도 없다.
 *   · 서버 값 읽기 · 계산 · 글은 여기 한 곳(시험 calendarChecks.test.ts). DB 20261112211833_calendar_checks_stage21.sql,
 *     자료는 services/calendarCheckService.ts, 화면은 components/attendance/CalendarChecks.tsx · CheckItemsSheet.tsx.
 */
import { weekdayOfYmd } from "@/lib/promise153";

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

export type StickerKey = "strong" | "fire" | "proud" | "mitt" | "sweat" | "tired" | "hurt" | "rest";
/** 그날 기분 스티커 — 글자 속 이모지는 그릴 때 153 입체 아이콘이 된다(lib/emoji3d) */
export const STICKERS: readonly { key: StickerKey; emoji: string; label: string }[] = [
  { key: "strong", emoji: "💪", label: "좋음" },
  { key: "fire", emoji: "🔥", label: "불태움" },
  { key: "proud", emoji: "😊", label: "뿌듯" },
  { key: "mitt", emoji: "🥊", label: "미트" },
  { key: "sweat", emoji: "💦", label: "땀 흠뻑" },
  { key: "tired", emoji: "😮‍💨", label: "피곤" },
  { key: "hurt", emoji: "🤕", label: "통증" },
  { key: "rest", emoji: "😴", label: "쉬는 날" },
];
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
  createdOn: string;
  archivedOn: string | null;
}

export type JournalVisibility = "branch" | "partners" | "private";
export interface JournalLine {
  id: string;
  content: string;
  mood: string | null;
  photoUrl: string | null;
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
}

export const CAL_OFF: CalState = { on: false, today: null, items: [], days: new Map() };

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
  const days = Array.isArray(r.weekdays)
    ? [...new Set(r.weekdays.map(int).filter((d): d is number => d != null && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : null;
  return {
    id,
    label,
    target: target != null && target >= 1 ? target : null,
    unit: target != null ? str(r.unit) : null,
    weekdays: days && days.length > 0 && days.length < 7 ? days : null,
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
  return {
    id,
    content,
    mood: str(r.mood),
    photoUrl: str(r.photo_url),
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
  return { on: true, today: ymd(r.today), items, days };
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
}

/** 그날의 체크 — 저절로 3개(체육관 · 응원 · 한 줄) + 그날의 나만의 체크 */
export function dayChecks(day: string, attended: boolean, cal: CalDay | undefined, items: readonly CheckItem[]): DayCheck[] {
  const done = new Set(cal?.done ?? []);
  return [
    { key: "gym", kind: "gym", label: "체육관", done: attended },
    { key: "cheer", kind: "cheer", label: "응원", done: !!cal && (cal.cheer || cal.give153) },
    { key: "line", kind: "line", label: "한 줄", done: !!cal?.journal },
    ...itemsForDay(items, day).map(
      (i): DayCheck => ({ key: `item:${i.id}`, kind: "custom", label: itemLabel(i), done: done.has(i.id), itemId: i.id }),
    ),
  ];
}

/** 금색 별 — 그날의 체크를 다 채운 날 */
export const isStarDay = (checks: readonly DayCheck[]): boolean => checks.length > 0 && checks.every((c) => c.done);

/** 한 줄 — 채운 것과 다음 한 걸음만 (지난 날 0개는 아무 말도 안 한다) */
export function checkProgress(checks: readonly DayCheck[], isToday: boolean): string | null {
  const total = checks.length;
  const done = checks.filter((c) => c.done).length;
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
export interface CheckItemDraft {
  label: string;
  /** 비우면 숫자 없이 (예: 스트레칭) */
  target: string;
  unit: CheckUnit | null;
  /** 비우면 매일 */
  weekdays: number[];
}

export const emptyCheckDraft = (): CheckItemDraft => ({ label: "", target: "", unit: "번", weekdays: [] });

export const draftFromItem = (i: CheckItem): CheckItemDraft => ({
  label: i.label,
  target: i.target != null ? String(i.target) : "",
  unit: (CHECK_UNITS as readonly string[]).includes(i.unit ?? "") ? (i.unit as CheckUnit) : "번",
  weekdays: i.weekdays ?? [],
});

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
  return null;
}

export function checkItemPayload(d: CheckItemDraft, id?: string | null) {
  const t = d.target.trim();
  const target = t ? Number(t.replace(/,/g, "")) : null;
  const days = [...new Set(d.weekdays)].sort((a, b) => a - b);
  return {
    p_id: id ?? null,
    p_label: tidyLabel(d.label),
    p_target: target,
    p_unit: target != null ? d.unit : null,
    p_weekdays: days.length === 0 || days.length === 7 ? null : days,
  };
}
