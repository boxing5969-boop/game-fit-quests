/**
 * 📅 운동 달력 2-3단계 — 그날 한 일 · 코치 한마디 도장 · 153 기념일 · 153 D-day · 좌우 밀기 · 길게 누르기
 *   (2026-11-13 대표님 「다음」 — 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b 2-3)
 *   감정 설계(CLAUDE.md 「회원 감정 설계 기준」): 끝났을 때 = 뿌듯함("코치님이 나를 봤다") · 들어올 때 = 환영 · 한 달 = 확신.
 *   · 그날 한 일 = DB 에 이미 있는 기록만(PT 수업 · 153 PB · 타이틀매치 · 레벨업) — 칸 왼쪽 위 아이콘 하나(타이틀 > 레벨업 > 153 PB > PT).
 *     타이틀매치는 통과 = '통과', 그 밖 = '도전했어요'(못한 말 없이).
 *   · 코치 한마디 = 코치님이 「오늘 만날 회원」에서 남긴 한 줄 — 칸 왼쪽 아래 말풍선 도장 · 그날 카드에 '○○ 코치님' + 한 줄.
 *   · 153 기념일 = 153 등록일(모르면 첫 도장) n주년 — 출석한 날이면 금색 도장 · 지난 날 안 온 기념일은 말하지 않는다.
 *   · 153 D-day = 내가 정한 목표일(3개까지) · 153 PB 다시 재는 날(42일) · 기념일(30일 안) · 승급 심사(타이틀 레벨) · 타이틀매치 다시 도전.
 *     가장 가까운 하나가 카드 머리 칩 — 누르면 D-day 시트(목표일 정하기 · 빼기).
 *   서버 값 읽기 · 글 · 검사는 여기 한 곳(시험 calendarMarks.test.ts). DB 20261113012729_calendar_stage23.sql
 *   (get_my_calendar 의 acts · notes · anniv · ddays · set_my_goal_day · remove_my_goal_day · coach_day_note_save · coach_day_note_remove).
 */
import type { DayMoment } from "@/lib/calendarMoments";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const GOAL_MAX = 3;
export const GOAL_TITLE_MAX = 20;
/** 목표일 = 내일부터 이만큼 안 */
export const GOAL_AHEAD_DAYS = 730;
export const NOTE_MAX = 80;
/** 153 PB 다시 재는 날 = 마지막 공식 기록 + 42일 (get_my_fitness_profile next_test_on 과 같은 수) */
export const PB_RETEST_DAYS = 42;
/** 좌우로 밀어 달 넘기기 — 이만큼(px) 넘게 · 세로보다 1.5배 넘게 · 0.8초 안 */
export const SWIPE_MIN_PX = 56;
export const SWIPE_MAX_MS = 800;
/** 길게 누르기 — 0.45초 · 10px 안에서 */
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_PX = 10;
/** 지난 날 바로 넣기 = 오늘부터 이만큼 전까지 (나만의 체크 · 스티커 고칠 수 있는 날과 같다) */
export const QUICK_PAST_DAYS = 6;

/** 목표일 예시 — 눌러서 채움 */
export const GOAL_EXAMPLES: readonly string[] = ["바디프로필", "대회", "153 PB", "다이어트"];
/** 코치 한마디 예시 — 153 기준 ③ 칭찬은 구체적으로 · ⑤ 다음 목표 */
export const NOTE_EXAMPLES: readonly string[] = [
  "오늘 잽 거리가 딱 좋았어요",
  "끝까지 손을 내리지 않은 거 멋졌어요",
  "자세가 지난주보다 훨씬 안정됐어요",
  "다음엔 원투 리듬을 같이 맞춰 봐요",
];

export const RANK_KO: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

/** 달력 칸 점 — D-day(목표일 · 153 PB 다시 재는 날 · 기념일 · 승급 심사 · 다시 도전) = 보라 */
export const DOT_DDAY = "bg-violet-500";
/** 카드 머리 D-day 칩 */
export const DDAY_CHIP = "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200";

// ───────────────────────── 서버 값 ─────────────────────────
export type ActKind = "pt" | "pb" | "title" | "level";
export const ACT_KINDS: readonly ActKind[] = ["title", "level", "pb", "pt"];

export interface CalAct {
  day: string;
  kind: ActKind;
  /** PT 수업 — 담당 코치님 이름 */
  coach: string | null;
  /** 153 PB — 부문 · 첫 기록 · 최고 기록(그때까지) */
  division: "open" | "starter" | null;
  first: boolean;
  best: boolean;
  /** 타이틀매치 — 통과 · 리그 */
  passed: boolean;
  rank: string | null;
  /** 레벨업 — 올라간 레벨(전체 1~40) */
  level: number | null;
}

export interface CalNote {
  id: string;
  day: string;
  /** 코치님 이름 */
  who: string;
  /** 직함 — 코치 · 지점장 · 대표 */
  title: string;
  body: string;
  at: string;
}

export type AnnivBasis = "reg" | "stamp";
export interface CalAnniv {
  day: string;
  years: number;
  /** reg = 153 등록일 · stamp = 첫 도장(등록일을 모를 때) */
  basis: AnnivBasis;
}

export type DdayKind = "goal" | "pb" | "anniv" | "exam" | "retry";
export interface CalDday {
  kind: DdayKind;
  day: string;
  /** 목표일 · 승급 심사 일정 id */
  id: string | null;
  /** 목표 이름 · 승급 심사 한 줄 */
  title: string | null;
  years: number | null;
  basis: AnnivBasis | null;
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
const isAct = (v: unknown): v is ActKind => typeof v === "string" && (ACT_KINDS as readonly string[]).includes(v);
const DDAY_KINDS: readonly DdayKind[] = ["goal", "pb", "anniv", "exam", "retry"];
const isDday = (v: unknown): v is DdayKind => typeof v === "string" && (DDAY_KINDS as readonly string[]).includes(v);
const basisOf = (v: unknown): AnnivBasis | null => (v === "reg" || v === "stamp" ? v : null);

export function normalizeAct(raw: unknown): CalAct | null {
  const r = obj(raw);
  const day = ymd(r?.day);
  if (!r || !day || !isAct(r.kind)) return null;
  const level = int(r.level);
  const division = r.division === "open" || r.division === "starter" ? r.division : null;
  return {
    day,
    kind: r.kind,
    coach: str(r.coach),
    division,
    first: r.first === true,
    best: r.best === true,
    passed: r.passed === true,
    rank: str(r.rank),
    level: level != null && level >= 1 && level <= 40 ? level : null,
  };
}

export function normalizeNote(raw: unknown): CalNote | null {
  const r = obj(raw);
  const id = str(r?.id);
  const day = ymd(r?.day);
  const body = str(r?.body);
  if (!r || !id || !day || !body) return null;
  return { id, day, who: str(r.who) ?? "코치", title: str(r.title) ?? "코치", body, at: str(r.at) ?? "" };
}

export function normalizeAnniv(raw: unknown): CalAnniv | null {
  const r = obj(raw);
  const day = ymd(r?.day);
  const years = int(r?.years);
  const basis = basisOf(r?.basis);
  if (!r || !day || years == null || years < 1 || !basis) return null;
  return { day, years, basis };
}

export function normalizeDday(raw: unknown): CalDday | null {
  const r = obj(raw);
  const day = ymd(r?.day);
  if (!r || !day || !isDday(r.kind)) return null;
  const years = int(r.years);
  if (r.kind === "goal" && (!str(r.id) || !str(r.title))) return null;
  if (r.kind === "anniv" && (years == null || years < 1)) return null;
  return {
    kind: r.kind,
    day,
    id: str(r.id),
    title: str(r.title),
    years: years != null && years >= 1 ? years : null,
    basis: basisOf(r.basis),
  };
}

const list = <T,>(raw: unknown, fn: (x: unknown) => T | null): T[] =>
  (Array.isArray(raw) ? raw : []).map(fn).filter((x): x is T => x != null);
export const normalizeActs = (raw: unknown): CalAct[] => list(raw, normalizeAct);
export const normalizeNotes = (raw: unknown): CalNote[] => list(raw, normalizeNote);
export const normalizeAnnivs = (raw: unknown): CalAnniv[] => list(raw, normalizeAnniv);
export const normalizeDdays = (raw: unknown): CalDday[] => list(raw, normalizeDday);

// ───────────────────────── 날짜 ─────────────────────────
const addDays = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
export const dayDiff = (a: string, b: string): number => {
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

// ───────────────────────── 그날 한 일 ─────────────────────────
const ACT_RANK: Record<ActKind, number> = { title: 0, level: 1, pb: 2, pt: 3 };

/** 그날 한 일 (타이틀 > 레벨업 > 153 PB > PT) */
export const actsOn = (acts: readonly CalAct[], day: string): CalAct[] =>
  acts.filter((a) => a.day === day).sort((a, b) => ACT_RANK[a.kind] - ACT_RANK[b.kind]);

/** 칸 왼쪽 위 아이콘 하나 */
export const topActOn = (acts: readonly CalAct[], day: string): CalAct | null => actsOn(acts, day)[0] ?? null;

/** 금색으로 보이나 — 타이틀매치 통과 · 153 PB 첫 기록 · 최고 기록 */
export const actIsGold = (a: CalAct): boolean => (a.kind === "title" && a.passed) || (a.kind === "pb" && (a.first || a.best));

const divKo = (d: CalAct["division"]) => (d === "starter" ? "스타터" : d === "open" ? "오픈" : null);

/** 그날 카드 한 줄 — 'PT 수업 · 김코치 코치님' · '153 PB 첫 기록 · 오픈' · '화이트 타이틀매치 통과' · '레벨업 · Lv.6' */
export function actText(a: CalAct): string {
  switch (a.kind) {
    case "pt":
      return a.coach ? `PT 수업 · ${a.coach} 코치님` : "PT 수업";
    case "pb": {
      const head = a.first ? "153 PB 첫 기록" : a.best ? "153 PB 최고 기록" : "153 PB를 쟀어요";
      const div = divKo(a.division);
      return div ? `${head} · ${div}` : head;
    }
    case "title": {
      const rk = a.rank ? RANK_KO[a.rank] ?? null : null;
      const head = rk ? `${rk} 타이틀매치` : "타이틀매치";
      return a.passed ? `${head} 통과` : `${head}에 도전했어요`;
    }
    case "level":
      return a.level != null ? `레벨업 · Lv.${a.level}` : "레벨업";
  }
}

/** 칸 이름표(화면 읽기)용 짧은 말 */
export function actShort(a: CalAct): string {
  switch (a.kind) {
    case "pt":
      return "PT 수업";
    case "pb":
      return "153 PB";
    case "title":
      return a.passed ? "타이틀매치 통과" : "타이틀매치 도전";
    case "level":
      return "레벨업";
  }
}

// ───────────────────────── 코치 한마디 ─────────────────────────
export const notesOn = (notes: readonly CalNote[], day: string): CalNote[] => notes.filter((x) => x.day === day);

/** '김코치 코치님' · '이용희 대표님' */
export const noteWho = (n: Pick<CalNote, "who" | "title">): string => `${n.who} ${n.title}님`;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** 서버(coach_day_note_save)와 같은 검사 — 통과하면 null */
export function noteError(body: string): string | null {
  const t = tidy(body);
  if (!t) return "한마디를 적어 주세요";
  if ([...t].length > NOTE_MAX) return `한마디는 ${NOTE_MAX}자 안으로 적어 주세요`;
  return null;
}
export const noteBody = (body: string): string => tidy(body);

// ───────────────────────── 153 기념일 ─────────────────────────
export const annivOn = (anniv: readonly CalAnniv[], day: string): CalAnniv | null => anniv.find((a) => a.day === day) ?? null;

/** '153 1주년' · '첫 도장 1주년' */
export const annivShort = (a: Pick<CalAnniv, "years" | "basis">): string =>
  a.basis === "reg" ? `153 ${a.years}주년` : `첫 도장 ${a.years}주년`;

/** 기념일 그날 한 줄 — 지난 날(출석한 날) · 오늘 */
export function annivText(a: Pick<CalAnniv, "years" | "basis">, isToday = false): string {
  if (isToday) return a.basis === "reg" ? `오늘은 153과 함께한 지 ${a.years}년이에요` : `오늘은 첫 도장을 찍은 지 ${a.years}년이에요`;
  return a.basis === "reg" ? `153과 함께한 지 ${a.years}년이 된 날이에요` : `첫 도장을 찍은 지 ${a.years}년이 된 날이에요`;
}

/** 출석한 기념일 = 금색 도장 (첫 도장 · 출석 축하가 같은 날이면 그쪽이 먼저) */
export function withAnnivMoments(
  moments: ReadonlyMap<string, DayMoment>,
  anniv: readonly CalAnniv[],
  attended: (day: string) => boolean,
): Map<string, DayMoment> {
  const out = new Map(moments);
  for (const a of anniv) {
    if (!attended(a.day)) continue;
    const prev = out.get(a.day);
    if (prev && (prev.kind === "first" || prev.kind === "milestone")) continue;
    out.set(a.day, { kind: "anniv", text: annivText(a), gold: true });
  }
  return out;
}

// ───────────────────────── 153 D-day ─────────────────────────
const DDAY_RANK: Record<DdayKind, number> = { anniv: 0, exam: 1, goal: 2, retry: 3, pb: 4 };

/** 가까운 날 순 — 지난 '153 PB 다시 재는 날'은 오늘로 친다 */
export function sortDdays(ddays: readonly CalDday[], today: string): CalDday[] {
  const eff = (d: CalDday) => (d.day < today ? today : d.day);
  return [...ddays].sort((a, b) => eff(a).localeCompare(eff(b)) || DDAY_RANK[a.kind] - DDAY_RANK[b.kind]);
}

export const nextDday = (ddays: readonly CalDday[], today: string): CalDday | null => sortDdays(ddays, today)[0] ?? null;

/** 'D-12' · '오늘' · (지난 153 PB) '지금' */
export function ddayCount(d: Pick<CalDday, "day">, today: string): string {
  const diff = dayDiff(today, d.day);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return "오늘";
  return "지금";
}

/** D-day 이름 — 시트 · 그날 카드 */
export function ddayText(d: CalDday, today: string): string {
  switch (d.kind) {
    case "goal":
      return d.title ?? "목표일";
    case "pb":
      return d.day < today ? "153 PB 다시 잴 때예요" : "153 PB 다시 재는 날";
    case "anniv":
      return annivShort({ years: d.years ?? 1, basis: d.basis ?? "stamp" });
    case "exam":
      return d.title ? `승급 심사 · ${d.title}` : "승급 심사";
    case "retry":
      return "타이틀매치 다시 도전할 수 있는 날";
  }
}

/** 카드 머리 칩 — 'D-12 · 153 PB' · '오늘 · 153 1주년' · '지금 · 153 PB' */
export function ddayChip(d: CalDday, today: string): string {
  const short =
    d.kind === "goal"
      ? d.title ?? "목표일"
      : d.kind === "pb"
        ? "153 PB"
        : d.kind === "anniv"
          ? annivShort({ years: d.years ?? 1, basis: d.basis ?? "stamp" })
          : d.kind === "exam"
            ? "승급 심사"
            : "다시 도전";
  return `${ddayCount(d, today)} · ${short}`;
}

/** 그날 달력 칸에 찍을 D-day (지난 날짜는 찍지 않는다) */
export const ddaysOn = (ddays: readonly CalDday[], day: string, today: string): CalDday[] =>
  day >= today ? ddays.filter((d) => d.day === day) : [];

export const goalsOf = (ddays: readonly CalDday[]): CalDday[] => ddays.filter((d) => d.kind === "goal");

// ───────────────────────── 목표일 정하기 ─────────────────────────
export interface GoalDraft {
  title: string;
  day: string;
}

export const emptyGoalDraft = (day = ""): GoalDraft => ({ title: "", day });

/** 서버(set_my_goal_day)와 같은 검사 — 통과하면 null */
export function goalDraftError(d: GoalDraft, today: string, count = 0, editing = false): string | null {
  const title = tidy(d.title);
  if (!title) return "목표 이름을 적어 주세요";
  if ([...title].length > GOAL_TITLE_MAX) return `목표 이름은 ${GOAL_TITLE_MAX}자 안으로 적어 주세요`;
  if (!YMD.test(d.day)) return "날짜를 골라 주세요";
  if (d.day <= today) return "목표일은 내일부터 골라 주세요";
  if (dayDiff(today, d.day) > GOAL_AHEAD_DAYS) return "목표일은 2년 안으로 골라 주세요";
  if (!editing && count >= GOAL_MAX) return "목표일은 3개까지 정할 수 있어요 · 하나를 빼면 새로 정할 수 있어요";
  return null;
}

export const goalPayload = (d: GoalDraft, id?: string | null) => ({ p_id: id ?? null, p_day: d.day, p_title: tidy(d.title) });

/** 날짜 고르기 칸 범위 — 내일 ~ 2년 */
export const goalDayBounds = (today: string): { min: string; max: string } => ({
  min: addDays(today, 1),
  max: addDays(today, GOAL_AHEAD_DAYS),
});

// ───────────────────────── 밀기 · 길게 누르기 ─────────────────────────
/** 좌우로 밀기 → 달 넘기기 (왼쪽으로 밀면 다음 달 = +1, 오른쪽 = -1, 아니면 0) */
export function swipeMonthDelta(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || ms > SWIPE_MAX_MS) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export type QuickMode = "today" | "past" | "future";

/** 길게 누른 날 — 오늘 · 6일 전까지 = 한 줄 · 체크 바로 넣기 / 앞날 = 목표일 / 그 앞 = 없음 */
export function quickModeOf(day: string, today: string): QuickMode | null {
  if (!YMD.test(day) || !YMD.test(today)) return null;
  if (day === today) return "today";
  if (day > today) return dayDiff(today, day) <= GOAL_AHEAD_DAYS ? "future" : null;
  return dayDiff(day, today) <= QUICK_PAST_DAYS ? "past" : null;
}

/** 알림 링크 '/home?cal=2026-11-13' 의 날짜 — 첫 기록 달 ~ 오늘 안만
 *  (3-5) aheadDays = 앞날도 받기 — 내 일정 알림 링크는 그 일정 날(내일 · 일주일 뒤 기념일)이라 홈은 1년 앞까지 */
export function focusDayOf(raw: string | null | undefined, today: string, firstDay: string | null, aheadDays = 0): string | null {
  if (!raw || !YMD.test(raw)) return null;
  if (raw > today && (aheadDays <= 0 || dayDiff(today, raw) > aheadDays)) return null;
  if (raw > today) return raw;
  if (firstDay && YMD.test(firstDay) && raw.slice(0, 7) < firstDay.slice(0, 7)) return null;
  return raw;
}
