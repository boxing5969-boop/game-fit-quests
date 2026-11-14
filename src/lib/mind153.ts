/**
 * 🧠 마음 능력치 — 계산 · 판정 · 문구 한 곳 (2026-11-14 대표님 「마이복서 153 정신적인 향상도 넣자 · 운동을 통한 자신감 힘 ·
 *   과학적이고 설득력이 정말 중요해 — 사람들이 이거 신뢰할 수 있는 데이터인가 생각하기 때문에」)
 *
 *   신뢰를 지키는 규칙 (화면 · 오삼코치 안내가 모두 이 파일을 따른다):
 *   ① 지어낸 숫자 없음 — 회원이 직접 답한 검증된 척도 점수만(문항 data/mindScales · 계산 서버 _mind_score_*, 여기 score* 는 같은 식).
 *   ② 출처를 늘 보여 준다 — 검사 이름 · 연구 숫자 · 계산법(MIND_HOW).
 *   ③ '의미 있는 변화'는 10점 이상만 — 활력은 한 사람을 따라갈 때 10점(Bjorner 외 2007), 자신감 10점 = 문항 합 3점 = 53개 나라
 *      표준편차(4.82, Schmitt & Allik 2005)의 0.6배로 흔한 '표준편차 절반' 기준(Norman 외 2003)보다 엄격, 습관도 같은 10점.
 *   ④ 잘한 것만 크게 — 내려간 점수는 화살표 · 숫자로 강조하지 않는다(모든 기록은 '지난 기록'에 그대로). 화면 감정 규칙 ③(2026-11-12).
 *   ⑤ 진단이 아니다 — 자기 보고 설문. 아주 낮은 자신감이면 상담 전화를 조용히 알려 준다(판단하는 말 없이).
 *   ⑥ 나만 본다 — 코치 · 지점장 · 대표도 개별 답을 못 본다. 153 전체 평균은 20명 넘을 때만(서버 _mind_brand).
 */
import { MIND_SCALE, MIND_SCALES, type MindScaleKey } from "@/data/mindScales";

/** 이만큼 오르면 '의미 있는 변화' (0~100 점수) */
export const MEANINGFUL_CHANGE = 10;
/** 다시 재는 때 — 마지막 체크 뒤 4주 */
export const RECHECK_DAYS = 28;
/** 이 안에 다시 하면 서버가 마지막 기록을 고쳐 쓴다 */
export const REPLACE_WITHIN_DAYS = 14;
/** 습관이 자동이 되기까지 가운데 값 (Lally 외 2010) */
export const HABIT_DAYS = 66;
/** 아주 낮은 점수 — 조용한 안내 */
export const LOW_SCORE = 20;
/** 만 나이 */
export const MIN_AGE = 14;

export const MIND_KEYS: readonly MindScaleKey[] = ["conf", "vital", "habit"];

export interface MindCheck {
  id: string;
  takenAt: string;
  /** 'YYYY-MM-DD' (KST) */
  takenOn: string;
  conf: number;
  vital: number;
  habit: number;
}

export interface MindBrand {
  ready: boolean;
  n?: number;
  conf?: number;
  vital?: number;
  habit?: number;
  days?: number;
  up10?: number;
}

export interface MindState {
  /** 승인된 회원(또는 운영진) */
  active: boolean;
  consent: boolean;
  consentAt: string | null;
  remind: boolean;
  /** 서버가 아는 만 나이(모르면 null) */
  age: number | null;
  /** 오래된 것부터 */
  checks: MindCheck[];
  brand: MindBrand;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** 서버 JSON(mind_state · mind_check_save.state) → 화면 모양. 모자란 줄은 버린다 */
export function normalizeMindState(raw: unknown): MindState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const checks: MindCheck[] = [];
  for (const c of Array.isArray(r.checks) ? r.checks : []) {
    const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const conf = num(o.conf);
    const vital = num(o.vital);
    const habit = num(o.habit);
    const takenOn = str(o.taken_on);
    if (conf == null || vital == null || habit == null || !takenOn || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) continue;
    checks.push({ id: str(o.id) ?? takenOn, takenAt: str(o.taken_at) ?? takenOn, takenOn, conf, vital, habit });
  }
  checks.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const b = (r.brand && typeof r.brand === "object" ? r.brand : {}) as Record<string, unknown>;
  const brand: MindBrand = { ready: b.ready === true };
  if (brand.ready) {
    brand.n = num(b.n) ?? 0;
    brand.conf = num(b.conf) ?? 0;
    brand.vital = num(b.vital) ?? 0;
    brand.habit = num(b.habit) ?? 0;
    brand.days = num(b.days) ?? 0;
    brand.up10 = num(b.up10) ?? 0;
  }
  return {
    active: r.active === true,
    consent: r.consent === true,
    consentAt: str(r.consent_at),
    remind: r.remind !== false,
    age: num(r.age),
    checks,
    brand,
  };
}

/* ───────────── 점수 — 서버 _mind_score_* 와 같은 식 (시험 · 미리 보기용) ───────────── */

const round1 = (v: number) => Math.round(v * 10) / 10;
const allIn = (a: readonly number[], len: number, lo: number, hi: number) =>
  a.length === len && a.every((x) => Number.isInteger(x) && x >= lo && x <= hi);

/** 자신감 — RSES 1~4, 힘든 쪽 문장은 5 − 답, 합 10~40 → 0~100 */
export function scoreConf(a: readonly number[]): number | null {
  if (!allIn(a, 10, 1, 4)) return null;
  const sum = MIND_SCALE.conf.items.reduce((s, it, i) => s + (it.reverse ? 5 - a[i] : a[i]), 0);
  return round1(((sum - 10) / 30) * 100);
}

/** 힘(활력) — RAND 번호 1(항상)~6(전혀): 좋은 쪽 (6 − 답) × 20 · 힘든 쪽 (답 − 1) × 20 의 평균 */
export function scoreVital(a: readonly number[]): number | null {
  if (!allIn(a, 4, 1, 6)) return null;
  const sum = MIND_SCALE.vital.items.reduce((s, it, i) => s + (it.reverse ? (a[i] - 1) * 20 : (6 - a[i]) * 20), 0);
  return round1(sum / 4);
}

/** 운동 습관 — SRBAI 1~7, 합 4~28 → 0~100 */
export function scoreHabit(a: readonly number[]): number | null {
  if (!allIn(a, 4, 1, 7)) return null;
  return round1(((a.reduce((s, x) => s + x, 0) - 4) / 24) * 100);
}

export type MindAnswers = Record<MindScaleKey, (number | null)[]>;

export const emptyMindAnswers = (): MindAnswers => ({
  conf: MIND_SCALE.conf.items.map(() => null),
  vital: MIND_SCALE.vital.items.map(() => null),
  habit: MIND_SCALE.habit.items.map(() => null),
});

/** 화면에서 한 줄로 이어 묻는 순서 — [척도, 문항 번호] */
export const MIND_STEPS: readonly { key: MindScaleKey; index: number }[] = MIND_SCALES.flatMap((s) =>
  s.items.map((_, index) => ({ key: s.key, index })),
);

export const answeredAll = (a: MindAnswers): boolean => MIND_KEYS.every((k) => a[k].every((v) => v != null));

/* ───────────── 날짜 ───────────── */

const dayNum = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};
const ymdOf = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number => dayNum(to) - dayNum(from);
export const addDays = (ymd: string, days: number): string => ymdOf(dayNum(ymd) + days);

/** '12월 12일' */
export const dateKo = (ymd: string): string => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}월 ${d}일`;
};

/* ───────────── 화면 한 장 ───────────── */

export interface MindRow {
  key: MindScaleKey;
  label: string;
  test: string;
  now: number;
  /** 처음 잰 값 — 두 번 이상 쟀을 때만 */
  first: number | null;
  /** 오른 만큼 — 올랐을 때만 (내려간 것은 null) */
  change: number | null;
  meaningful: boolean;
}

export type MindHero =
  | { kind: "invite" }
  | { kind: "first"; on: string }
  | { kind: "growth"; key: MindScaleKey; change: number; first: number; now: number; meaningful: boolean; days: number }
  | { kind: "steady"; on: string };

export interface MindView {
  hero: MindHero;
  rows: MindRow[];
  count: number;
  first: MindCheck | null;
  last: MindCheck | null;
  /** 다음 체크 — 마지막 체크 뒤 28일 */
  due: { on: string; daysLeft: number; isDue: boolean } | null;
  /** 지금 다시 하면 마지막 기록을 고쳐 쓰는가 (마지막 체크 뒤 14일 안) */
  replaces: boolean;
  /** 첫 체크 뒤 며칠 · 66일까지 며칠 */
  habitDays: { since: number; toGo: number } | null;
  /** 아주 낮은 자신감 — 상담 전화 안내 */
  lowConf: boolean;
  /** 아주 낮은 활력 — 강도 조절 안내 */
  lowVital: boolean;
}

export function buildMindView(checks: readonly MindCheck[], today: string): MindView {
  const count = checks.length;
  const first = count ? checks[0] : null;
  const last = count ? checks[count - 1] : null;
  if (!first || !last) {
    return { hero: { kind: "invite" }, rows: [], count: 0, first: null, last: null, due: null, replaces: false, habitDays: null, lowConf: false, lowVital: false };
  }
  const rows: MindRow[] = MIND_KEYS.map((key) => {
    const now = last[key];
    const firstVal = count >= 2 ? first[key] : null;
    const delta = firstVal == null ? null : round1(now - firstVal);
    const change = delta != null && delta > 0 ? delta : null;
    return { key, label: MIND_SCALE[key].label, test: MIND_SCALE[key].test, now, first: firstVal, change, meaningful: change != null && change >= MEANINGFUL_CHANGE };
  });

  let hero: MindHero;
  if (count === 1) hero = { kind: "first", on: last.takenOn };
  else {
    const best = rows
      .filter((r) => r.change != null)
      .sort((a, b) => (b.change ?? 0) - (a.change ?? 0) || MIND_KEYS.indexOf(a.key) - MIND_KEYS.indexOf(b.key))[0];
    hero = best
      ? {
          kind: "growth",
          key: best.key,
          change: best.change!,
          first: best.first!,
          now: best.now,
          meaningful: best.meaningful,
          days: daysBetween(first.takenOn, last.takenOn),
        }
      : { kind: "steady", on: last.takenOn };
  }

  const dueOn = addDays(last.takenOn, RECHECK_DAYS);
  const daysLeft = daysBetween(today, dueOn);
  const since = Math.max(0, daysBetween(first.takenOn, today));
  return {
    hero,
    rows,
    count,
    first,
    last,
    due: { on: dueOn, daysLeft, isDue: daysLeft <= 0 },
    replaces: daysBetween(last.takenOn, today) < REPLACE_WITHIN_DAYS,
    habitDays: { since, toGo: Math.max(0, HABIT_DAYS - since) },
    lowConf: last.conf <= LOW_SCORE,
    lowVital: last.vital <= LOW_SCORE,
  };
}

/* ───────────── 문구 ───────────── */

/** 점수는 정수로 (소수 한 자리는 서버에 그대로) — 63.3 → '63' */
export const scoreText = (v: number): string => String(Math.round(v));
/** 오른 만큼 — '+7' */
export const changeText = (v: number): string => `+${Math.max(1, Math.round(v))}`;

/** 결과 화면 · 카드 맨 아래 한 줄 — 다음 걸음 하나 */
export function nextStepText(v: MindView): string {
  if (!v.due) return "4주마다 2분이면 돼요";
  if (v.due.isDue) return "4주가 지났어요 — 다시 재면 변화가 보여요";
  return `다음 체크 ${dateKo(v.due.on)} · ${v.due.daysLeft}일 남았어요`;
}

/** 66일 습관 한 줄 */
export function habitDaysText(v: MindView): string | null {
  if (!v.habitDays) return null;
  if (v.habitDays.toGo === 0) return `첫 체크 뒤 ${v.habitDays.since}일 — 습관 66일을 지났어요`;
  return `첫 체크 뒤 ${v.habitDays.since}일 · 습관 66일까지 ${v.habitDays.toGo}일`;
}

/** 주인공 아래 한 줄 — 카드는 줄마다 숫자가 있어 숫자 없이(같은 숫자는 한 화면에 한 번), 결과 창은 숫자와 함께 */
export function heroLine(h: MindHero, withNumbers = true): string {
  switch (h.kind) {
    case "invite":
      return "검증된 심리 검사 3가지로 내 마음을 재요";
    case "first":
      return "첫 기록이에요 — 4주 뒤 다시 재면 변화가 보여요";
    case "growth": {
      const nums = withNumbers ? `처음 ${scoreText(h.first)} → 지금 ${scoreText(h.now)} · ` : `처음 잰 날보다 `;
      return h.meaningful ? `${nums}의미 있는 변화(10점 이상)예요` : `${nums}조금씩 오르고 있어요`;
    }
    case "steady":
      return "마음 점수는 그날 상황에 따라 흔들려요 — 다음 체크에서 흐름을 같이 봐요";
  }
}

/** 상담 전화 (24시간) — 2024-01-01 자살예방상담 109 로 통합 · 정신건강 위기상담 1577-0199 */
export const MIND_HELP_LINE = "마음이 많이 힘들 땐 혼자 버티지 않아도 돼요 — 정신건강 위기상담 1577-0199 · 자살예방상담 109 (24시간)";
export const MIND_REST_LINE = "요즘 많이 지치셨나 봐요 — 이번 주는 강도를 낮춰도 괜찮아요. 코치님께 말씀해 주세요";

/** 연구로 보면 — 척도마다 한 줄 + 마음 건강 · 복싱 (숫자는 원 논문 그대로) */
export const MIND_RESEARCH: readonly { key: MindScaleKey | "mind" | "boxing"; title: string; body: string; cite: string }[] = [
  {
    key: "conf",
    title: "자신감",
    body: "운동한 사람들의 자존감은 작지만 분명하게 올랐어요. 몸으로 '해냈다'가 쌓일수록 자신감이 자라요",
    cite: "113개 연구 종합 · Spence 외 2005 · Sonstroem & Morgan 1989",
  },
  {
    key: "vital",
    title: "힘(활력)",
    body: "규칙적으로 운동하면 활력이 오르고 피로가 줄었어요",
    cite: "81개 실험 7,050명 · Wender 외 2022",
  },
  {
    key: "habit",
    title: "운동 습관",
    body: "운동이 자동 습관이 되기까지 가운데 값 66일(사람마다 18~254일). 하루 빠져도 습관 만들기엔 큰 영향이 없었어요",
    cite: "Lally 외 2010 · 런던대(UCL)",
  },
  {
    key: "mind",
    title: "마음 건강",
    body: "운동은 우울 · 불안 · 스트레스를 중간 크기로 줄였고, 강도가 높을수록 더 컸어요. 근력 운동만으로도 우울 증상이 줄었어요",
    cite: "1,039개 실험 12만 8천 명 · Singh 외 2023 · Gordon 외 2018",
  },
  {
    key: "boxing",
    title: "복싱 · 무술",
    body: "무술 훈련은 마음 건강을 높이고 불안 · 우울 같은 어려움을 줄였어요. 맞지 않는 복싱 운동 연구들도 같은 쪽이에요(큰 실험은 아직 적어요)",
    cite: "14개 연구 · Moore 외 2020 · 16편 모음 · Bozdarov 외 2023",
  },
];

/** 계산 방법 · 출처 — '계산 방법'을 펼치면 */
export const MIND_HOW: readonly { k: string; v: string }[] = [
  { k: "자신감", v: "로젠버그 자존감 척도 10문항(4점) — 세계에서 가장 많이 쓰는 자존감 검사, 공개 저작물. 한국판 전병재(1974) 문장. 합 10~40을 0~100으로 바꿔요" },
  { k: "힘(활력)", v: "RAND 36문항 건강조사의 활력 4문항(지난 4주 · 6점) — RAND 공개 문항. 0~100은 RAND 채점 그대로예요" },
  { k: "운동 습관", v: "습관 자동성 지수 SRBAI 4문항(7점) — 66일 습관 연구가 잰 '자동성'과 같은 것(Gardner 외 2012). 합 4~28을 0~100으로 바꿔요" },
  {
    k: "의미 있는 변화",
    v: "10점 이상 올랐을 때만 그렇게 불러요. 활력은 한 사람을 따라갈 때 10점을 중요한 차이로 봐요(Bjorner 외 2007). 자신감 10점(문항 합 3점)은 53개 나라 16,998명의 표준편차(4.82)의 0.6배로, 흔히 쓰는 '표준편차 절반' 기준(Norman 외 2003)보다 엄격해요. 습관도 같은 10점으로 봐요",
  },
  { k: "처음 · 지금", v: "처음 잰 날과 마지막 날을 비교해요. 오른 것만 숫자로 크게 보여 드리고, 모든 기록은 '지난 기록'에 그대로 있어요" },
  { k: "다시 재기", v: "4주마다 다시 재면 흐름이 보여요. 2주 안에 다시 하면 그 기록을 고쳐 써요(같은 시기 기록이 두 개가 되지 않게)" },
  { k: "자기 보고", v: "내가 답한 설문이라 그날 기분 · 일에 따라 흔들릴 수 있어요. 진단이 아니에요" },
  { k: "나만 봐요", v: "답과 점수는 나만 봐요 — 코치님 · 지점장님 · 대표님도 못 봐요. 153 전체 평균은 4주 넘게 두 번 잰 회원이 20명 넘을 때만 이름 없는 숫자로 써요" },
  { k: "한국어", v: "자신감은 한국판 문장을, 활력 · 습관은 153이 원문을 옮겼어요. WHO-5 웰빙 지수는 상업적 사용 허락이 따로 필요해 넣지 않았어요" },
];

/** 153 전체 평균 한 줄 (20명 넘을 때만) */
export function brandLine(b: MindBrand): string | null {
  if (!b.ready || !b.n) return null;
  // 전체 평균은 내려간 것도 그대로 적는다(골라 보여 주지 않게) — 개인 화면의 '잘한 것만'과 다르다
  const parts = MIND_KEYS.map((k) => {
    const r = Math.round(b[k] ?? 0);
    return `${MIND_SCALE[k].label} ${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)}`;
  });
  return `4주 넘게 두 번 잰 153 회원 ${b.n}명 — 평균 ${parts.join(" · ")} · ${b.up10 ?? 0}%가 하나 이상 10점 넘게 올랐어요 (비교군 없는 설문 결과)`;
}
