/**
 * 🎯 내 성별 · 나이 · 체지방률 + 정확도 (2026-10-22 대표님)
 *   "고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해 · 아무런 정보를 입력 안 한 회원님들은
 *    출석 기록으로만 평균치를 내 줘 · 남자 여자"
 *
 *   서버: get_my_fitness_extra · save_my_fitness_extra (supabase/migrations/20261022103930_member_fitness_extra.sql)
 *     · 성별 · 출생 연도는 회원이 넣은 값이 먼저, 없으면 지점 등록 정보(profiles.gender · birth_date)를 읽기만.
 *   몸무게가 없으면 남녀 평균, 성별도 모르면 성인 평균 65kg 으로 칼로리를 계산한다(achievement153 DEFAULT_WEIGHT_KG).
 *     한국 성인 평균 — 인바디 12개국 체성분 데이터(2026 공개): 남 75.3kg · 체지방률 22.6% / 여 60.0kg · 31.5%.
 *   정확도(%) = 출석 기록 40 + 운동 끝 체크(실제 시간) 최대 10 + 성별 10 + 나이 10 + 키 5 + 몸무게 15 + 체지방률 10.
 *     숫자를 더 정확하게 만드는 정보일수록 점수가 크다(칼로리는 몸무게, 남녀 평균은 성별, 체지방은 실측).
 */
import { DEFAULT_WEIGHT_KG, validWeight } from "@/lib/achievement153";

export type Gender = "남" | "여";
export type InfoSource = "me" | "gym" | null;

export interface FitnessExtra {
  gender: Gender | null;
  /** me = 회원이 넣음 · gym = 지점 등록 정보 */
  genderSource: InfoSource;
  birthYear: number | null;
  birthSource: InfoSource;
  bodyFatPct: number | null;
  bodyFatOn: string | null;
  firstBodyFatPct: number | null;
  firstBodyFatOn: string | null;
  bodyFatCount: number;
}

export const EMPTY_FITNESS_EXTRA: FitnessExtra = {
  gender: null,
  genderSource: null,
  birthYear: null,
  birthSource: null,
  bodyFatPct: null,
  bodyFatOn: null,
  firstBodyFatPct: null,
  firstBodyFatOn: null,
  bodyFatCount: 0,
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const src = (v: unknown): InfoSource => (v === "me" || v === "gym" ? v : null);

/** 서버 get_my_fitness_extra → 화면용 (모르는 값은 null) */
export function normalizeFitnessExtra(raw: unknown): FitnessExtra {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const g = r.gender === "남" || r.gender === "여" ? (r.gender as Gender) : null;
  const by = num(r.birth_year);
  const fat = num(r.body_fat_pct);
  const firstFat = num(r.first_body_fat_pct);
  return {
    gender: g,
    genderSource: g ? src(r.gender_source) : null,
    birthYear: by != null && by >= 1930 && by <= 2020 ? Math.trunc(by) : null,
    birthSource: by != null ? src(r.birth_source) : null,
    bodyFatPct: fat != null && fat >= 3 && fat <= 60 ? fat : null,
    bodyFatOn: ymd(r.body_fat_on),
    firstBodyFatPct: firstFat != null && firstFat >= 3 && firstFat <= 60 ? firstFat : null,
    firstBodyFatOn: ymd(r.first_body_fat_on),
    bodyFatCount: Math.max(0, Math.trunc(num(r.body_fat_count) ?? 0)),
  };
}

/* ───────────── 남녀 평균 ───────────── */

/** 한국 성인 평균 (인바디 12개국 체성분 데이터, 2026 공개 — 남 75.3kg · 22.6% / 여 60.0kg · 31.5%) */
export const KOREAN_AVERAGE: Record<Gender, { weightKg: number; bodyFatPct: number }> = {
  남: { weightKg: 75, bodyFatPct: 22.6 },
  여: { weightKg: 60, bodyFatPct: 31.5 },
};

export interface WeightBasis {
  kg: number;
  /** me = 내 몸무게 · gender = 남녀 평균 · default = 성인 평균 */
  source: "me" | "gender" | "default";
  /** '내 몸무게 68.4kg 기준' · '남성 평균 75kg 기준' · '성인 평균 65kg 기준' */
  label: string;
}

const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

/** 칼로리 · 지방 계산에 쓰는 몸무게 — 내 몸무게 → 남녀 평균 → 성인 평균 65kg */
export function weightBasis(weightKg: number | null | undefined, gender: Gender | null | undefined): WeightBasis {
  if (validWeight(weightKg)) return { kg: weightKg, source: "me", label: `내 몸무게 ${oneDecimal(weightKg)}kg 기준` };
  if (gender === "남" || gender === "여") {
    const kg = KOREAN_AVERAGE[gender].weightKg;
    return { kg, source: "gender", label: `${gender === "남" ? "남성" : "여성"} 평균 ${kg}kg 기준` };
  }
  return { kg: DEFAULT_WEIGHT_KG, source: "default", label: `성인 평균 ${DEFAULT_WEIGHT_KG}kg 기준` };
}

/** 처음 잰 체지방률보다 내려갔을 때만 — 내려간 %p (소수 한 자리). 기록이 하나거나 같거나 올랐으면 null */
export function bodyFatDrop(x: FitnessExtra | null | undefined): number | null {
  if (!x || x.firstBodyFatPct == null || x.bodyFatPct == null) return null;
  if (!x.firstBodyFatOn || !x.bodyFatOn || x.firstBodyFatOn === x.bodyFatOn) return null;
  const d = Math.round((x.firstBodyFatPct - x.bodyFatPct) * 10) / 10;
  return d >= 0.1 ? d : null;
}

/* ───────────── 정확도 ───────────── */

export type AccuracyKey = "attendance" | "endTime" | "gender" | "age" | "height" | "weight" | "bodyFat";

export interface AccuracyItem {
  key: AccuracyKey;
  label: string;
  /** 지금 받은 점수 · 최대 점수 */
  points: number;
  max: number;
  done: boolean;
  /** 아직이면 어떻게 올리나 */
  hint: string;
}

/** 정확도 점수표 — 여기만 바꾸면 된다 (합 100) */
export const ACCURACY_POINTS: Record<AccuracyKey, number> = {
  attendance: 40,
  endTime: 10,
  gender: 10,
  age: 10,
  height: 5,
  weight: 15,
  bodyFat: 10,
};

/** 운동 끝 체크 비율을 볼 최근 출석 수 */
export const END_TIME_RECENT = 20;

export interface AccuracyInput {
  /** 최근 순 출석 — endSource 가 있으면 실제 시간을 잰 날 */
  days: readonly { endSource: string | null }[];
  gender: Gender | null | undefined;
  birthYear: number | null | undefined;
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  bodyFatPct: number | null | undefined;
}

export interface Accuracy {
  pct: number;
  items: AccuracyItem[];
  /** 넣으면 가장 많이 오르는 정보 (다 넣었으면 null) */
  next: AccuracyItem | null;
  /** 아직 안 넣은 정보 (점수 큰 순) */
  missing: AccuracyItem[];
}

export function reportAccuracy(a: AccuracyInput): Accuracy {
  const recent = a.days.slice(0, END_TIME_RECENT);
  const measured = recent.filter((d) => !!d.endSource).length;
  const endPts = recent.length ? Math.round((ACCURACY_POINTS.endTime * measured) / recent.length) : 0;
  const has = {
    gender: a.gender === "남" || a.gender === "여",
    age: typeof a.birthYear === "number" && Number.isFinite(a.birthYear),
    height: typeof a.heightCm === "number" && Number.isFinite(a.heightCm),
    weight: validWeight(a.weightKg),
    bodyFat: typeof a.bodyFatPct === "number" && Number.isFinite(a.bodyFatPct),
  };
  const item = (key: AccuracyKey, label: string, done: boolean, hint: string, points?: number): AccuracyItem => ({
    key,
    label,
    max: ACCURACY_POINTS[key],
    points: points ?? (done ? ACCURACY_POINTS[key] : 0),
    done,
    hint,
  });
  const items: AccuracyItem[] = [
    item("attendance", "출석 기록", true, "출석할 때마다 자동으로 쌓여요"),
    item("endTime", "실제 운동 시간", endPts >= ACCURACY_POINTS.endTime, "운동 끝나고 얼굴 인식을 한 번 더 하면 실제 시간으로 계산해요", endPts),
    item("weight", "몸무게", has.weight, "칼로리 · 지방을 내 몸 기준으로 바꿔요"),
    item("gender", "성별", has.gender, "남녀 평균으로 더 가깝게 계산해요"),
    item("age", "나이", has.age, "나이에 맞게 비교해 드려요"),
    item("bodyFat", "체지방률", has.bodyFat, "인바디 같은 실측값이면 변화를 그대로 보여 드려요"),
    item("height", "키", has.height, "몸무게와 함께 체형을 더 정확히 봐요"),
  ];
  const pct = Math.min(100, items.reduce((s, i) => s + i.points, 0));
  const missing = items.filter((i) => !i.done && i.key !== "attendance" && i.key !== "endTime").sort((x, y) => y.max - x.max);
  return { pct, items, next: missing[0] ?? null, missing };
}

/* ───────────── 입력 확인 ───────────── */

/** 출생 연도 입력 — 빈칸 null · 숫자 4자리가 아니면 NaN */
export function parseBirthYear(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  return /^\d{4}$/.test(t) ? Number(t) : NaN;
}

/** 체지방률 입력 — 빈칸 null · '24.5' 꼴이 아니면 NaN */
export function parseBodyFat(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  return /^\d{1,2}(\.\d)?$/.test(t) ? Number(t) : NaN;
}

/** 문제 없으면 null, 있으면 회원에게 보여 줄 한 줄 */
export function fitnessExtraInputError(birthYear: number | null, bodyFat: number | null, thisYear: number): string | null {
  if (birthYear != null && (Number.isNaN(birthYear) || birthYear < 1930 || birthYear > Math.min(2020, thisYear - 5))) {
    return "출생 연도는 4자리 숫자로 넣어 주세요 (예: 1990)";
  }
  if (bodyFat != null && (Number.isNaN(bodyFat) || bodyFat < 3 || bodyFat > 60)) return "체지방률은 3~60% 사이 숫자로 넣어 주세요 (소수 한 자리까지)";
  return null;
}

/** 서버 오류 → 한 줄 */
export function fitnessExtraErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  if (msg.includes("fitness_birth_year_range")) return "출생 연도를 다시 확인해 주세요";
  if (msg.includes("body_fat_range")) return "체지방률은 3~60% 사이로 넣어 주세요";
  if (msg.includes("fitness_gender_value")) return "성별을 다시 골라 주세요";
  if (msg.includes("not_authenticated")) return "로그인이 필요해요";
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요";
}
