/**
 * 📋 레벨별 일차 수업 매뉴얼 — 화면에서 쓰는 순수 함수 (2026-09-30 대표님).
 *
 * 화이트 리그는 출석 3번 = 한 레벨 = 수업 3일. 레벨 1 = 1~3일차, 레벨 2 = 4~6일차 …
 * 내용은 DB(level_lesson_days)에 대표님 원문 그대로 있고, 여기서는 모양만 다듬는다.
 * "2일차 = 1일차 반복" 같은 날은 repeat_of_day 로 앞날 내용을 빌려 온다.
 */
import { RANK_LABELS } from "@/data/sharedConstants";

export type LessonStepKind = "warmup" | "step" | "punch" | "sandbag" | "strength";

export interface LessonStep {
  kind: LessonStepKind;
  name: string;
  /** 라운드·세트 — 대표님 표현 그대로 (예: "2라운드 (최대 3라운드)") */
  amount: string;
  /** 이 날 새로 배우는 동작 */
  isNew: boolean;
  how: string[];
  watch: string[];
  tip: string | null;
  /** 153 영상(missions.id) — 없으면 영상 버튼을 안 띄운다 */
  videoMissionId: string | null;
}

export interface LessonDay {
  id: string;
  /** 전역 레벨 1~40 (화이트 1~10, 블루 11~20 …) */
  level: number;
  dayInLevel: number;
  /** 전체 일차 (1일차, 2일차 …) */
  dayNo: number;
  title: string;
  goal: string;
  /** 이 날은 N일차 반복 */
  repeatOfDay: number | null;
  steps: LessonStep[];
  note: string;
}

/** get_lesson_today — 서버가 출석으로 계산한 오늘(또는 다음) 수업 */
export interface LessonToday {
  currentLevel: number;
  /** 수업이 저장된 레벨이 아니면 null (예: 레벨 3 이상은 아직 준비 중) */
  level: number | null;
  dayInLevel: number | null;
  dayNo: number | null;
  attendedToday: boolean;
  /** 오늘 체크인으로 방금 승급 — 오늘 수업은 지난 레벨의 마지막 날 */
  promotedToday: boolean;
  daysInLevel: number;
}

const KINDS: readonly LessonStepKind[] = ["warmup", "step", "punch", "sandbag", "strength"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s) => s.length > 0) : [];
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** DB jsonb 한 칸 → 화면용 단계. 이름·분량이 없으면 버린다(깨진 칸이 화면을 죽이지 않게). */
export function normalizeStep(raw: unknown): LessonStep | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = str(o.name);
  const amount = str(o.amount);
  if (!name) return null;
  const kind = KINDS.includes(o.kind as LessonStepKind) ? (o.kind as LessonStepKind) : "punch";
  const video = str(o.video_mission_id);
  return {
    kind,
    name,
    amount,
    isNew: o.is_new === true,
    how: strList(o.how),
    watch: strList(o.watch),
    tip: str(o.tip) || null,
    videoMissionId: video || null,
  };
}

/** DB 행 → 화면용 하루. 필수 숫자가 깨졌으면 null. */
export function normalizeDay(row: unknown): LessonDay | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const level = int(o.level);
  const dayInLevel = int(o.day_in_level);
  const dayNo = int(o.day_no);
  if (!level || !dayInLevel || !dayNo) return null;
  const steps = Array.isArray(o.steps)
    ? (o.steps.map(normalizeStep).filter(Boolean) as LessonStep[])
    : [];
  return {
    id: str(o.id) || `day-${dayNo}`,
    level,
    dayInLevel,
    dayNo,
    title: str(o.title) || `${dayNo}일차`,
    goal: str(o.goal),
    repeatOfDay: int(o.repeat_of_day),
    steps,
    note: str(o.note),
  };
}

export function normalizeToday(raw: unknown): LessonToday | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    currentLevel: int(o.current_level) ?? 1,
    level: int(o.level),
    dayInLevel: int(o.day_in_level),
    dayNo: int(o.day_no),
    attendedToday: o.attended_today === true,
    promotedToday: o.promoted_today === true,
    daysInLevel: int(o.days_in_level) ?? 0,
  };
}

/**
 * 그날 실제로 할 단계 — 반복하는 날이면 앞날 내용을 빌린다 (반복의 반복도 5번까지 따라간다).
 * repeatOf = 내용을 빌려 온 날 (반복이 아니면 null).
 */
export function resolveDay(
  day: LessonDay,
  byDayNo: ReadonlyMap<number, LessonDay>,
): { steps: LessonStep[]; repeatOf: LessonDay | null } {
  if (day.steps.length > 0 || day.repeatOfDay == null) return { steps: day.steps, repeatOf: null };
  let src: LessonDay | undefined = day;
  for (let hop = 0; hop < 5 && src && src.steps.length === 0 && src.repeatOfDay != null; hop++) {
    src = byDayNo.get(src.repeatOfDay);
  }
  if (!src || src.steps.length === 0) return { steps: [], repeatOf: null };
  return { steps: src.steps, repeatOf: byDayNo.get(day.repeatOfDay) ?? src };
}

export const indexByDayNo = (days: readonly LessonDay[]): Map<number, LessonDay> =>
  new Map(days.map((d) => [d.dayNo, d]));

/** 레벨별로 묶기 — 레벨 순, 레벨 안에서는 일차 순 */
export function groupByLevel(days: readonly LessonDay[]): { level: number; days: LessonDay[] }[] {
  const map = new Map<number, LessonDay[]>();
  for (const d of days) {
    const list = map.get(d.level) ?? [];
    list.push(d);
    map.set(d.level, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, list]) => ({ level, days: [...list].sort((a, b) => a.dayNo - b.dayNo) }));
}

const LEAGUES = ["white", "blue", "red", "black"] as const;

/** 전역 레벨 → 리그·리그 안 레벨 (11 → 블루 1) */
export function leagueOf(level: number): { league: (typeof LEAGUES)[number]; n: number } {
  const g = Math.min(Math.max(Math.trunc(level) || 1, 1), 40);
  return { league: LEAGUES[Math.floor((g - 1) / 10)], n: ((g - 1) % 10) + 1 };
}

/** "화이트 리그 · 레벨 1" */
export function levelLong(level: number): string {
  const { league, n } = leagueOf(level);
  return `${RANK_LABELS[league] ?? league} 리그 · 레벨 ${n}`;
}

/** "화이트 L1" */
export function levelShort(level: number): string {
  const { league, n } = leagueOf(level);
  return `${RANK_LABELS[league] ?? league} L${n}`;
}

/** 오늘 카드 머리말 — 오늘 출석했으면 '오늘 수업', 아직이면 '다음 수업' (1일차 제목이 이미 '첫 수업'이라 겹치지 않게) */
export function todayHeadline(t: LessonToday): string {
  return t.attendedToday ? "오늘 수업" : "다음 수업";
}

export type LessonDayStatus = "done" | "current" | "upcoming" | "none";

/** 목록에서 그날의 표시 — 오늘(다음) 수업 앞날은 '지난 수업' */
export function dayStatus(day: LessonDay, t: LessonToday | null | undefined): LessonDayStatus {
  if (!t) return "none";
  if (t.dayNo != null) {
    if (day.dayNo < t.dayNo) return "done";
    if (day.dayNo === t.dayNo) return "current";
    return "upcoming";
  }
  // 내 레벨 수업이 아직 없으면(레벨 3 이상) 저장된 앞 레벨은 모두 지난 수업
  return day.level < t.currentLevel ? "done" : "upcoming";
}

/** 단계 칩에 쓰는 짧은 분량 — "2분 × 3라운드" → "2분×3R", "보통 2라운드 (최대 3라운드)" → "2R" */
export function shortAmount(amount: string): string {
  const s = amount
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/^보통\s*/, "")
    .replace(/\s*정도$/, "")
    .trim();
  return s
    .replace(/\s*×\s*/g, "×")
    .replace(/라운드/g, "R")
    .replace(/(\d+)개×(\d+)세트/, "$1×$2");
}
