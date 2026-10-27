/**
 * 🥊 지금까지 이룬 것 · 운동 시간 — 내정보 · 내 출석 기록 · 관리자 회원 상세 '내정보' (2026-10-21~22 대표님)
 *   "주평균 빼 주고 지금까지 이룬 것들을 보여 줘" → "스쿼트는 빼고 줄넘기 2분 3라운드 + 1시간 복싱 기준, 펀치 수와 스텝 활동량으로"
 *   → "횟수 말고 총 몇 시간 운동했는지로 체크하자 · 운동 끝나고 3시간 안에 한 번 더 찍으면 그만큼 인정"
 *
 *   운동 시간(분)은 서버 한 곳 — workout_minutes(첫 출석, 운동 끝): 두 번째 체크(입구 얼굴 인식) · '운동 종료' 버튼으로
 *   잰 시간(최대 180분), 없으면 기본 66분(복싱 60분 + 줄넘기 2분 × 3라운드). 승급 진행도 · XP · 운동시간 랭킹과 같은 숫자.
 *   이 파일은 그 분을 받아 펀치 · 스텝 · 줄넘기 · 칼로리를 추정한다 (앱이 펀치를 직접 세지 않는다 — 화면에 '추정').
 *     · 한 번 운동 = 줄넘기 6분(600회, 1분 100회) + 나머지는 복싱 — 복싱 60분에 잽 200 · 스트레이트 150 · 스텝 300
 *       (2026-10-21 대표님 확정 — 일부러 적게 잡은 값). 기준 숫자는 여기 한 곳.
 *   칼로리 = MET × 몸무게(kg) × 시간 — 2024 Adult Compendium: 복싱 5.8(15110) · 줄넘기 8.3(15552), 둘 다 낮은 쪽 값.
 *     몸무게는 회원이 넣은 값, 없으면 65kg 기준이라고 밝힌다.
 *   권장 운동량 = 주 500 MET·분 — 미국 신체활동 지침의 '건강에 의미 있는 운동량' 하한 (중강도 주 150분과 같은 범위).
 *     기본 66분 하루 = 397.8 MET·분 → 한 주에 2번 오면 채운다.
 *   회원 화면은 잘한 것만 — 몸무게는 처음보다 줄었을 때만 변화를 보여 준다. 진단 · 의료 표현은 쓰지 않는다.
 */

/** 복싱 MET — 2024 Adult Compendium 15110 boxing, punching bag */
export const BOXING_MET = 5.8;
/** 줄넘기 MET — 2024 Adult Compendium 15552 rope jumping, slow pace */
export const ROPE_MET = 8.3;
/** 줄넘기 2분 × 3라운드 */
export const ROPE_ROUNDS = 3;
export const ROPE_ROUND_MINUTES = 2;
export const ROPE_MINUTES = ROPE_ROUNDS * ROPE_ROUND_MINUTES;
/** 줄넘기 1분에 100회 (천천히) */
export const ROPE_PER_MINUTE = 100;

/** 기준 복싱 시간 — 60분 (펀치 · 스텝 숫자가 60분 기준) */
export const BASIS_MINUTES = 60;
/** 두 번째 체크가 없는 날 — 서버 workout_default_minutes() 와 같아야 한다 (66 = 복싱 60 + 줄넘기 6) */
export const DEFAULT_SESSION_MINUTES = BASIS_MINUTES + ROPE_MINUTES;
/** 두 번째 체크로 인정하는 창 · 하루 상한 (서버 attendance_checkout_scan · workout_minutes) */
export const CHECKOUT_WINDOW_HOURS = 3;
export const MAX_CREDIT_MINUTES = 180;

/** 권장 운동량 — 주 500 MET·분 */
export const RECOMMENDED_WEEKLY_MET_MINUTES = 500;
/** 하루 운동(분)의 MET·분 = 복싱 5.8 × (분 - 6) + 줄넘기 8.3 × 6 (기본 66분이면 397.8) */
export const dayMetMinutes = (minutes: number): number => {
  const m = Math.max(0, Number.isFinite(minutes) ? minutes : 0);
  const rope = Math.min(ROPE_MINUTES, m);
  return Math.round((BOXING_MET * (m - rope) + ROPE_MET * rope) * 10) / 10;
};
/** 기본 하루로 권장 운동량을 채우는 한 주 횟수 — 2 */
export const classesForRecommended = (): number => Math.ceil(RECOMMENDED_WEEKLY_MET_MINUTES / dayMetMinutes(DEFAULT_SESSION_MINUTES));

/** 몸무게를 안 넣었을 때 칼로리 기준 */
export const DEFAULT_WEIGHT_KG = 65;

export type MoveKey = "jab" | "straight" | "step" | "rope";

export interface MoveBasis {
  key: MoveKey;
  label: string;
  /** 복싱 60분에 (scales: true) · 한 번 운동에 고정 (줄넘기 3라운드) */
  per: number;
  scales: boolean;
  unit: string;
  emoji: string;
}

/** 기준 (2026-10-21 대표님 확정) — 여기만 바꾸면 된다 */
export const CLASS_BASIS: readonly MoveBasis[] = [
  { key: "jab", label: "잽", per: 200, scales: true, unit: "번", emoji: "👊" },
  { key: "straight", label: "스트레이트", per: 150, scales: true, unit: "번", emoji: "🥊" },
  { key: "step", label: "스텝", per: 300, scales: true, unit: "걸음", emoji: "👟" },
  { key: "rope", label: "줄넘기", per: ROPE_MINUTES * ROPE_PER_MINUTE, scales: false, unit: "회", emoji: "🪢" },
];

const safeCount = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
const safeMinutes = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

/** 추정치 내림 — 1,000 미만은 10 단위, 10만 미만은 100 단위, 그 위는 1,000 단위 (적게 잡는 쪽으로) */
export function roundApprox(v: number): number {
  const x = Math.max(0, Number.isFinite(v) ? v : 0);
  const unit = x < 1000 ? 10 : x < 100_000 ? 100 : 1000;
  return Math.floor(x / unit) * unit;
}

/** 복싱한 시간(분) = 운동 시간 - 줄넘기 6분 × 출석 수 */
export const boxingMinutes = (classes: number, totalMinutes: number): number =>
  Math.max(0, safeMinutes(totalMinutes) - ROPE_MINUTES * safeCount(classes));

export interface MoveTotal extends MoveBasis {
  /** 한 번에 평균 (반올림) */
  perSession: number;
  /** 지금까지 (반올림 전) */
  total: number;
}

/** 지금까지 뻗은 잽 · 스트레이트 · 스텝(복싱한 시간에 맞춰) · 줄넘기(출석마다 3라운드) */
export const moveTotals = (classes: number, totalMinutes: number): MoveTotal[] => {
  const c = safeCount(classes);
  const box = boxingMinutes(c, totalMinutes);
  return CLASS_BASIS.map((b) => {
    const total = b.scales ? (box * b.per) / BASIS_MINUTES : c * b.per;
    return { ...b, total, perSession: c > 0 ? Math.round(total / c) : b.per };
  });
};

const isPunch = (m: MoveBasis) => m.key === "jab" || m.key === "straight";

/** 뻗은 펀치 = 화면에 보이는 잽 + 스트레이트 (각각 내림한 값의 합 — 큰 숫자와 칸 숫자가 늘 맞게) */
export const punchTotal = (classes: number, totalMinutes: number): number =>
  moveTotals(classes, totalMinutes)
    .filter(isPunch)
    .reduce((a, m) => a + roundApprox(m.total), 0);

/** 한 번에 평균 뻗는 펀치 (잽 + 스트레이트) */
export const punchPerSession = (classes: number, totalMinutes: number): number =>
  moveTotals(classes, totalMinutes)
    .filter(isPunch)
    .reduce((a, m) => a + m.perSession, 0);

/** 쓸 수 있는 몸무게인가 (25~250kg) */
export const validWeight = (kg: number | null | undefined): kg is number =>
  typeof kg === "number" && Number.isFinite(kg) && kg >= 25 && kg <= 250;

const weightOr65 = (kg: number | null | undefined) => (validWeight(kg) ? kg : DEFAULT_WEIGHT_KG);

/** 지금까지 쓴 칼로리 (kcal) = (복싱 5.8 × 복싱한 분 + 줄넘기 8.3 × 6분 × 출석) × 몸무게 / 60 */
export const kcalTotal = (classes: number, totalMinutes: number, weightKg: number | null | undefined): number => {
  const c = safeCount(classes);
  const ropeMin = Math.min(ROPE_MINUTES * c, safeMinutes(totalMinutes));
  const metMin = BOXING_MET * boxingMinutes(c, totalMinutes) + ROPE_MET * ropeMin;
  return (metMin * weightOr65(weightKg)) / 60;
};

/** 1시간 평균 칼로리 (kcal) — 운동 기록이 없으면 기본 하루(66분) 기준 */
export const kcalPerHour = (classes: number, totalMinutes: number, weightKg: number | null | undefined): number => {
  const c = safeCount(classes);
  const t = safeMinutes(totalMinutes);
  if (c <= 0 || t <= 0) return (dayMetMinutes(DEFAULT_SESSION_MINUTES) / DEFAULT_SESSION_MINUTES) * weightOr65(weightKg);
  return kcalTotal(c, t, weightKg) / (t / 60);
};

/** 분 → 시간 표시 — 4.4 · 37 · 1,234.5 (소수 한 자리까지) */
export const formatHours = (h: number): string =>
  (Math.round((Number.isFinite(h) ? Math.max(0, h) : 0) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/** 분 → '40.7' (시간, 소수 한 자리) */
export const minutesToHours = (minutes: number): string => formatHours(safeMinutes(minutes) / 60);

/** 'YYYY-MM-DD' → 그 주 월요일 'YYYY-MM-DD' (KST 날짜 그대로 계산) */
export function weekMonday(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dow = new Date(t).getUTCDay(); // 0 = 일
  const back = (dow + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

/** 권장 운동량(주 500 MET·분 — 기본 66분이면 2번)을 채운 주 수 — 날마다 운동 시간(분)으로 */
export function recommendedWeeks(days: readonly { day: string; minutes: number }[]): number {
  const perWeek = new Map<string, Map<string, number>>();
  for (const d of days) {
    const wk = weekMonday(d.day);
    if (!wk) continue;
    if (!perWeek.has(wk)) perWeek.set(wk, new Map());
    const w = perWeek.get(wk)!;
    w.set(d.day, Math.max(w.get(d.day) ?? 0, safeMinutes(d.minutes)));
  }
  let n = 0;
  for (const w of perWeek.values()) {
    let met = 0;
    for (const m of w.values()) met += dayMetMinutes(m);
    if (met >= RECOMMENDED_WEEKLY_MET_MINUTES) n += 1;
  }
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
  /**
   * 하루 평균 운동 시간(분, 회원이 직접) — member_workout_settings.session_minutes (20~240).
   *   2026-10-22 '한 번 복싱 시간' 칸을 없앴다가(실제 시간은 두 번째 체크로 잰다), 2026-10-27 대표님 "하루에 평균 몇 시간 정도
   *   운동하는지 본인이 넣을 수 있게" → 같은 칸을 '하루 평균 운동 시간'으로 다시 쓴다. 칼로리 · 펀치 계산에는 쓰지 않는다.
   */
  sessionMinutes: number | null;
  /** 신체 정보 비공개 (2026-10-28 대표님) — 참이면 본인 말고 아무도 못 본다. 관리자가 볼 때 참이면 값 없이 온다 */
  isPrivate: boolean;
}

/** 하루 평균 운동 시간 고르기 (분) — 서버 범위 20~240 안 */
export const DAILY_WORKOUT_CHOICES: readonly number[] = [30, 60, 90, 120, 150, 180, 240];

/** 90 → "1시간 30분" · 60 → "1시간" · 30 → "30분" */
export function dailyWorkoutText(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? (r > 0 ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
}

/** 신체 정보를 아직 하나도 안 넣었나 (키 · 몸무게 둘 다 없음) — 넣기 권유를 눈에 띄게 (2026-10-27) */
export const bodyInfoEmpty = (b: BodyInfo | null | undefined): boolean => !b || (b.heightCm == null && b.weightKg == null);

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
    sessionMinutes: num(r.session_minutes),
    isPrivate: r.private === true,
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

/** 입력 확인 — 문제 없으면 null, 있으면 회원에게 보여 줄 한 줄 */
export function bodyInputError(height: number | null, weight: number | null, dailyMinutes: number | null = null): string | null {
  if (height == null && weight == null && dailyMinutes == null) return "키나 몸무게 중 하나는 넣어 주세요";
  if (height != null && (Number.isNaN(height) || height < 100 || height > 230)) return "키는 100~230cm 사이 숫자로 넣어 주세요 (소수 한 자리까지)";
  if (weight != null && (Number.isNaN(weight) || weight < 25 || weight > 250)) return "몸무게는 25~250kg 사이 숫자로 넣어 주세요 (소수 한 자리까지)";
  return null;
}

/** 서버 오류 → 한 줄 */
export function bodyErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  if (msg.includes("body_height_range")) return "키는 100~230cm 사이로 넣어 주세요";
  if (msg.includes("body_weight_range")) return "몸무게는 25~250kg 사이로 넣어 주세요";
  if (msg.includes("body_info_empty")) return "키나 몸무게 중 하나는 넣어 주세요";
  if (msg.includes("session_minutes_range")) return "하루 평균 운동 시간은 20분~4시간 사이로 골라 주세요";
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
  /** 첫 완주 기록(ms) — 빨라진 비율 계산용 (2026-10-22) */
  firstMs: number;
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
    return { division: div, bestMs, improvedMs: improved, firstMs: first, finishedCount: rows.length };
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
