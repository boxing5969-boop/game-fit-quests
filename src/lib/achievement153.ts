/**
 * 🥊 지금까지 이룬 것 — 내정보 · 내 출석 기록 (2026-10-21 대표님)
 *   "주평균 빼 주고 지금까지 이룬 것들을 보여 줘 — 1시간당 평균 소비한 칼로리, 운동을 통해 얻은 건강 수치,
 *    긍정적인 신호들, 평균적으로 뻗은 잽의 수, 스트레이트, 스텝, 스쿼트 등등"
 *
 *   앱은 펀치 · 스텝 수를 직접 세지 않는다(펀치 센서 없음) → 출석 1번 = '한 번 운동 시간'만큼 운동한 것으로 보고
 *   '60분 기준' 숫자를 시간에 맞춰 곱한 추정이다. 화면에는 늘 '추정'을 같이 쓴다.
 *   기준 숫자는 여기 한 곳(CLASS_BASIS) — 바꾸면 모든 화면이 같이 바뀐다.
 *   (2026-10-21 대표님 확정: 잽 200 · 스트레이트 150 · 스텝 300 · 스쿼트 40 · 줄넘기 400 — 일부러 적게 잡은 값)
 *   한 번 운동 시간 = 회원이 넣은 평균(20~240분), 없으면 60분 (2026-10-21 대표님: "더 많이 하는 회원도 있으니까 기준은 60분").
 *
 *   칼로리 = MET × 몸무게(kg) × 시간. MET 는 2024 Adult Compendium of Physical Activities 값으로
 *     153 수업 8블록을 가중 평균한 값(CLASS_BLOCKS · 5.91). 몸무게는 회원이 넣은 값, 없으면 65kg 기준이라고 밝힌다.
 *   권장 운동량 = 주 500 MET·분 — 미국 신체활동 지침의 '건강에 의미 있는 운동량' 하한
 *     (중강도 주 150분과 같은 범위). 60분이면 1번 ≈ 355 MET·분 → 한 주에 2번 오면 채운다 (시간이 짧으면 더 필요).
 *   회원 화면은 잘한 것만 — 몸무게는 처음보다 줄었을 때만 변화를 보여 준다. 진단 · 의료 표현은 쓰지 않는다.
 */

export interface ClassBlock {
  name: string;
  min: number;
  met: number;
  /** 2024 Adult Compendium 코드 — 근거 추적용 */
  code: string;
}

/** 153 수업 50분 = 8블록 (153 커리큘럼 기본 뼈대) · MET 는 2024 Adult Compendium */
export const CLASS_BLOCKS: readonly ClassBlock[] = [
  { name: "워밍업", min: 5, met: 2.8, code: "02024 calisthenics, light effort" },
  { name: "줄넘기", min: 5, met: 8.3, code: "15552 rope jumping, slow pace" },
  { name: "리듬 · 발놀림", min: 8, met: 5.8, code: "15110 boxing, punching bag" },
  { name: "거울 앞 기술", min: 8, met: 5.8, code: "15110 boxing, punching bag" },
  { name: "새 기술", min: 8, met: 5.8, code: "15110 boxing, punching bag" },
  { name: "기술 반복", min: 8, met: 7.0, code: "15113 boxing, punching bag, 60 b/min" },
  { name: "하체 · 코어 서킷", min: 7, met: 6.0, code: "02032 circuit training, body weight exercises" },
  { name: "마무리", min: 1, met: 2.8, code: "02024 calisthenics, light effort" },
];

/** 수업 블록 합(분) — MET 평균을 낼 때만 쓴다 (50) */
const BLOCK_MINUTES = CLASS_BLOCKS.reduce((a, b) => a + b.min, 0);
/** 153 수업 평균 MET — 5.91 (블록 가중 평균) */
export const CLASS_MET = Math.round((CLASS_BLOCKS.reduce((a, b) => a + b.min * b.met, 0) / BLOCK_MINUTES) * 100) / 100;

/** 기준 운동 시간 — 60분 (CLASS_BASIS 숫자가 60분 기준) */
export const BASIS_MINUTES = 60;
/** 회원이 넣을 수 있는 한 번 운동 시간 */
export const SESSION_MIN = 20;
export const SESSION_MAX = 240;

/** 쓸 수 있는 운동 시간인가 (20~240분, 정수) */
export const validSessionMinutes = (m: number | null | undefined): m is number =>
  typeof m === "number" && Number.isInteger(m) && m >= SESSION_MIN && m <= SESSION_MAX;
/** 회원 값이 없거나 이상하면 60분 */
export const sessionMinutesOr60 = (m: number | null | undefined): number => (validSessionMinutes(m) ? m : BASIS_MINUTES);

/** 권장 운동량 — 주 500 MET·분 */
export const RECOMMENDED_WEEKLY_MET_MINUTES = 500;
/** 한 번 운동의 MET·분 (60분이면 354.6) */
export const sessionMetMinutes = (minutes?: number | null): number => Math.round(CLASS_MET * sessionMinutesOr60(minutes) * 10) / 10;
/** 권장 운동량을 채우는 한 주 운동 횟수 (60분 2번 · 40분 3번) */
export const classesForRecommended = (minutes?: number | null): number =>
  Math.ceil(RECOMMENDED_WEEKLY_MET_MINUTES / sessionMetMinutes(minutes));

/** 몸무게를 안 넣었을 때 칼로리 기준 */
export const DEFAULT_WEIGHT_KG = 65;

export type MoveKey = "jab" | "straight" | "step" | "squat" | "rope";

export interface MoveBasis {
  key: MoveKey;
  label: string;
  /** 60분 운동 1번에 */
  per: number;
  unit: string;
  emoji: string;
}

/** 60분 운동 1번 기준 (2026-10-21 대표님 확정) — 여기만 바꾸면 된다 */
export const CLASS_BASIS: readonly MoveBasis[] = [
  { key: "jab", label: "잽", per: 200, unit: "번", emoji: "👊" },
  { key: "straight", label: "스트레이트", per: 150, unit: "번", emoji: "🥊" },
  { key: "step", label: "스텝", per: 300, unit: "걸음", emoji: "👟" },
  { key: "squat", label: "스쿼트", per: 40, unit: "개", emoji: "🦵" },
  { key: "rope", label: "줄넘기", per: 400, unit: "회", emoji: "🪢" },
];

const safeCount = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

/** 추정치 내림 — 1,000 미만은 10 단위, 10만 미만은 100 단위, 그 위는 1,000 단위 (적게 잡는 쪽으로) */
export function roundApprox(v: number): number {
  const x = Math.max(0, Number.isFinite(v) ? v : 0);
  const unit = x < 1000 ? 10 : x < 100_000 ? 100 : 1000;
  return Math.floor(x / unit) * unit;
}

export interface MoveTotal extends MoveBasis {
  /** 내 운동 시간 1번에 (반올림) */
  perSession: number;
  /** 지금까지 (반올림 전) */
  total: number;
}

/** 지금까지 뻗은 잽 · 스트레이트 · 스텝 · 스쿼트 · 줄넘기 — 출석 수 × 기준 × (내 운동 시간 / 60분) */
export const moveTotals = (classes: number, minutes?: number | null): MoveTotal[] => {
  const ratio = sessionMinutesOr60(minutes) / BASIS_MINUTES;
  return CLASS_BASIS.map((b) => ({ ...b, perSession: Math.round(b.per * ratio), total: safeCount(classes) * b.per * ratio }));
};

const isPunch = (m: MoveBasis) => m.key === "jab" || m.key === "straight";

/** 뻗은 펀치 = 화면에 보이는 잽 + 스트레이트 (각각 내림한 값의 합 — 큰 숫자와 칸 숫자가 늘 맞게) */
export const punchTotal = (classes: number, minutes?: number | null): number =>
  moveTotals(classes, minutes)
    .filter(isPunch)
    .reduce((a, m) => a + roundApprox(m.total), 0);

/** 내 운동 시간 1번에 뻗는 펀치 (잽 + 스트레이트) */
export const punchPerSession = (minutes?: number | null): number =>
  moveTotals(1, minutes)
    .filter(isPunch)
    .reduce((a, m) => a + m.perSession, 0);

/** 쓸 수 있는 몸무게인가 (25~250kg) */
export const validWeight = (kg: number | null | undefined): kg is number =>
  typeof kg === "number" && Number.isFinite(kg) && kg >= 25 && kg <= 250;

/** 1시간 평균 칼로리 (kcal) — MET × 몸무게 */
export const kcalPerHour = (weightKg: number | null | undefined): number =>
  CLASS_MET * (validWeight(weightKg) ? weightKg : DEFAULT_WEIGHT_KG);

/** 지금까지 쓴 칼로리 (kcal) */
export const kcalTotal = (classes: number, weightKg: number | null | undefined, minutes?: number | null): number =>
  kcalPerHour(weightKg) * ((safeCount(classes) * sessionMinutesOr60(minutes)) / 60);

/** 운동한 시간 (시간, 소수 한 자리) */
export const exerciseHours = (classes: number, minutes?: number | null): number =>
  Math.round(((safeCount(classes) * sessionMinutesOr60(minutes)) / 60) * 10) / 10;

/** 'YYYY-MM-DD' → 그 주 월요일 'YYYY-MM-DD' (KST 날짜 그대로 계산) */
export function weekMonday(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dow = new Date(t).getUTCDay(); // 0 = 일
  const back = (dow + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

/** 권장 운동량(주 500 MET·분 — 60분이면 2번)을 채운 주 수 — 출석한 날 목록(KST 'YYYY-MM-DD', 하루 1번)으로 */
export function recommendedWeeks(days: readonly string[], minutes?: number | null): number {
  const need = classesForRecommended(minutes);
  const perWeek = new Map<string, Set<string>>();
  for (const d of days) {
    const wk = weekMonday(d);
    if (!wk) continue;
    if (!perWeek.has(wk)) perWeek.set(wk, new Set());
    perWeek.get(wk)!.add(d);
  }
  let n = 0;
  for (const s of perWeek.values()) if (s.size >= need) n += 1;
  return n;
}

/** 이번 주(오늘이 속한 주)에 온 날 수 */
export function daysThisWeek(days: readonly string[], today: string): number {
  const wk = weekMonday(today);
  if (!wk) return 0;
  return new Set(days.filter((d) => weekMonday(d) === wk)).size;
}

/* ───────────── 신체 정보 (키 · 몸무게) ───────────── */

export interface BodyInfo {
  heightCm: number | null;
  heightOn: string | null;
  weightKg: number | null;
  weightOn: string | null;
  firstWeightKg: number | null;
  firstWeightOn: string | null;
  count: number;
  /** 한 번 운동 시간(분) — 안 넣었으면 null (화면은 60분) */
  sessionMinutes: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** 서버 get_my_body_info → 화면용 (모르는 값은 null) */
export function normalizeBodyInfo(raw: unknown): BodyInfo {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    heightCm: num(r.height_cm),
    heightOn: ymd(r.height_on),
    weightKg: num(r.weight_kg),
    weightOn: ymd(r.weight_on),
    firstWeightKg: num(r.first_weight_kg),
    firstWeightOn: ymd(r.first_weight_on),
    count: Math.max(0, Math.trunc(num(r.count) ?? 0)),
    sessionMinutes: validSessionMinutes(num(r.session_minutes)) ? (num(r.session_minutes) as number) : null,
  };
}

/** 처음 넣은 몸무게보다 줄었을 때만 — 줄어든 kg (소수 한 자리). 늘었거나 같거나 기록이 하나면 null */
export function weightLost(b: BodyInfo | null | undefined): number | null {
  if (!b || b.firstWeightKg == null || b.weightKg == null) return null;
  if (!b.firstWeightOn || !b.weightOn || b.firstWeightOn === b.weightOn) return null;
  const d = Math.round((b.firstWeightKg - b.weightKg) * 10) / 10;
  return d >= 0.1 ? d : null;
}

/** 입력 칸 글자 → 숫자 (빈칸 = null, 숫자 아니면 NaN) */
export function parseBodyNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  return /^\d{1,3}(\.\d)?$/.test(t) ? Number(t) : NaN;
}

/** 운동 시간 칸 글자 → 분 (빈칸 = null, 정수 아니면 NaN) */
export function parseMinutes(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  return /^\d{1,3}$/.test(t) ? Number(t) : NaN;
}

/** 입력 확인 — 문제 없으면 null, 있으면 회원에게 보여 줄 한 줄 */
export function bodyInputError(height: number | null, weight: number | null, minutes: number | null = null): string | null {
  if (height == null && weight == null && minutes == null) return "키 · 몸무게 · 운동 시간 중 하나는 넣어 주세요";
  if (minutes != null && !validSessionMinutes(minutes)) return `운동 시간은 ${SESSION_MIN}~${SESSION_MAX}분 사이로 넣어 주세요`;
  if (height != null && (Number.isNaN(height) || height < 100 || height > 230)) return "키는 100~230cm 사이 숫자로 넣어 주세요 (소수 한 자리까지)";
  if (weight != null && (Number.isNaN(weight) || weight < 25 || weight > 250)) return "몸무게는 25~250kg 사이 숫자로 넣어 주세요 (소수 한 자리까지)";
  return null;
}

/** 서버 오류 → 한 줄 */
export function bodyErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  if (msg.includes("body_height_range")) return "키는 100~230cm 사이로 넣어 주세요";
  if (msg.includes("body_weight_range")) return "몸무게는 25~250kg 사이로 넣어 주세요";
  if (msg.includes("session_minutes_range")) return `운동 시간은 ${SESSION_MIN}~${SESSION_MAX}분 사이로 넣어 주세요`;
  if (msg.includes("body_info_empty")) return "키 · 몸무게 · 운동 시간 중 하나는 넣어 주세요";
  if (msg.includes("not_authenticated")) return "로그인이 필요해요";
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요";
}

/* ───────────── 153 PB (체력) ───────────── */

export interface PbRecordLike {
  division: string;
  score_ms: number;
  finished: boolean;
  measured_at: string;
}

export interface PbView {
  division: string;
  bestMs: number;
  /** 첫 완주 기록보다 줄어든 시간(ms) — 완주 기록이 2개 이상이고 줄었을 때만 */
  improvedMs: number | null;
  finishedCount: number;
}

/** 완주한 기록만 본다 — 오픈 완주가 있으면 오픈, 없으면 스타터. 완주 기록이 없으면 null */
export function pbView(records: readonly PbRecordLike[] | null | undefined): PbView | null {
  const done = (records ?? []).filter((r) => r && r.finished && Number.isFinite(r.score_ms) && r.score_ms > 0);
  const pick = (div: string): PbView | null => {
    const rows = done.filter((r) => r.division === div).sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    if (!rows.length) return null;
    const bestMs = Math.min(...rows.map((r) => r.score_ms));
    const first = rows[0].score_ms;
    const improved = rows.length >= 2 && first - bestMs >= 1000 ? first - bestMs : null;
    return { division: div, bestMs, improvedMs: improved, finishedCount: rows.length };
  };
  return pick("open") ?? pick("starter");
}

/** 63_200 → '1분 3초' (줄어든 시간 표시) */
export function spokenDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m && r) return `${m}분 ${r}초`;
  return m ? `${m}분` : `${r}초`;
}
