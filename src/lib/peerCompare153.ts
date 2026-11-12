/**
 * 🏁 같은 나이와 비교 — 체지방률 · 악력을 국민체력100 같은 나이 · 성별 백분위에 대어 「상위 몇 %」 (2026-11-12 대표님)
 *   "마이복서 153 운동기록에 비교할 수 있는 대상 — 내 나이 평균 신체와 내 신체 정보, 나는 이만큼 좋아졌고
 *    나는 평균에서 어느 정도, 상위 몇 %"
 *
 *   기준표: data/nfaNorms (국민체력100 2017~2019 측정 559,430명 · Park 외 2022) — 체지방률(인바디) · 악력(좌우 2번씩 중 최고 kg)
 *   내 값: 회원이 넣은 체지방률(get_my_fitness_extra 처음 · 마지막) · 악력(get_my_fitness_profile 처음 · 마지막, 코치 측정 포함)
 *   나이: 출생 연도만 알아서 '그해 − 출생 연도' (만 나이와 1살 다를 수 있다) · 만 19세부터 비교 (기준표가 성인부터)
 *
 *   문구 원칙 — '153과 함께하며'와 같다: 잘한 것만 · 진단 · 의료 표현 없음
 *     · 평균(그 나이 측정 평균)보다 좋거나 같으면 「상위 N%」 · 「100명 중 N번째」
 *     · 평균보다 못하면 순위 대신 「평균까지 2.7%p」 — 다음 목표로 말한다
 *     · 처음보다 순위가 오르고 값도 좋아졌을 때만 「N계단 올라왔어요」 (처음 순위는 처음 잰 날의 나이로)
 *     · 체지방률이 국민체력100 권장 범위 아래 끝(남 7% · 여 16%) 이하면 순위를 말하지 않는다 — 「아주 낮은 편」
 *   DB 를 바꾸지 않는다 — 내 값은 이미 읽는 함수 그대로, 계산은 화면에서.
 */
import { NFA_BODY_FAT, NFA_GRIP_KG, NORM_PERCENTILES, type NormBand, type NormRow, type NormSex } from "@/data/nfaNorms";

export type PeerMetricKey = "bodyFat" | "grip";

export interface PeerMetricDef {
  key: PeerMetricKey;
  label: string;
  unit: string;
  /** 평균까지 남은 차이의 단위 — 체지방률은 %p */
  gapUnit: string;
  better: "lower" | "higher";
  table: Record<NormSex, readonly NormRow[]>;
}

export const PEER_METRICS: Record<PeerMetricKey, PeerMetricDef> = {
  bodyFat: { key: "bodyFat", label: "체지방률", unit: "%", gapUnit: "%p", better: "lower", table: NFA_BODY_FAT },
  // 2026-11-13 대표님 「심폐지구력 근력 …」 — 근력을 재는 값이라는 것이 보이게 이름표에 (근력)
  grip: { key: "grip", label: "악력(근력)", unit: "kg", gapUnit: "kg", better: "higher", table: NFA_GRIP_KG },
};

/** 보여 주는 순서 — 주인공이 아닌 줄도 이 순서 */
export const PEER_METRIC_ORDER: readonly PeerMetricKey[] = ["bodyFat", "grip"];

/** 국민체력100 체성분 권장 범위의 아래 끝 (3등급 기준 '남 7% 초과 · 여 16% 초과') — 이 값 이하면 순위 대신 '아주 낮은 편' */
export const LEAN_FLOOR_PCT: Record<NormSex, number> = { 남: 7, 여: 16 };

/** 기준표가 성인(만 19세)부터 */
export const MIN_COMPARE_AGE = 19;

const BAND_LABEL: Record<NormBand, string> = {
  "19-24": "19~24세",
  "25-29": "20대 후반",
  "30-34": "30대 초반",
  "35-39": "30대 후반",
  "40-44": "40대 초반",
  "45-49": "40대 후반",
  "50-54": "50대 초반",
  "55-59": "50대 후반",
  "60-64": "60대 초반",
  "65-69": "60대 후반",
  "70-74": "70대 초반",
  "75-79": "70대 후반",
  "80-84": "80대 초반",
  "85+": "85세 이상",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 소수 한 자리 올림 — '평균까지'는 넉넉하게 (0.04 → 0.1) */
const ceil1 = (v: number) => Math.ceil(v * 10 - 1e-9) / 10;

/* ───────────── 나이 · 기준 무리 ───────────── */

/** 나이 → 기준표 나이대 (만 19세 아래는 null) */
export function ageBand(age: number): NormBand | null {
  if (!Number.isFinite(age) || age < MIN_COMPARE_AGE) return null;
  if (age <= 24) return "19-24";
  if (age >= 85) return "85+";
  const lo = Math.floor(age / 5) * 5;
  return `${lo}-${lo + 4}` as NormBand;
}

/** '30대 초반' · '19~24세' · '85세 이상' */
export const bandLabel = (band: NormBand): string => BAND_LABEL[band];
export const sexLabel = (sex: NormSex): string => (sex === "남" ? "남성" : "여성");

/** 그날(없으면 오늘) 나이 — 출생 연도만 알아서 '그해 − 출생 연도' */
export function ageOn(birthYear: number, ymd: string | null | undefined, today: string): number {
  const day = ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? ymd : today;
  return Number(day.slice(0, 4)) - birthYear;
}

/* ───────────── 백분위 ───────────── */

/**
 * 그 값보다 작은 사람의 비율(0~100) — 5 · 10 · … · 95 번째 백분위 사이는 직선으로 잇고,
 * 5 아래 · 95 위는 끝 칸의 기울기로 늘인 뒤 0.5~99.5 로 자른다 (끝에서 지나친 숫자를 말하지 않게).
 */
export function percentileBelow(value: number, p: readonly number[]): number {
  const P = NORM_PERCENTILES;
  const last = p.length - 1;
  if (value <= p[0]) {
    const slope = p[1] - p[0];
    return clamp(slope > 0 ? P[0] - ((p[0] - value) / slope) * (P[1] - P[0]) : P[0], 0.5, 99.5);
  }
  if (value >= p[last]) {
    const slope = p[last] - p[last - 1];
    return clamp(slope > 0 ? P[last] + ((value - p[last]) / slope) * (P[last] - P[last - 1]) : P[last], 0.5, 99.5);
  }
  for (let i = 0; i < last; i++) {
    if (value <= p[i + 1]) {
      const span = p[i + 1] - p[i];
      const t = span > 0 ? (value - p[i]) / span : 0.5;
      return P[i] + t * (P[i + 1] - P[i]);
    }
  }
  return 50;
}

export interface PeerStanding {
  band: NormBand;
  /** 그 나이 · 성별 측정 평균 */
  mean: number;
  /** 상위 몇 % (1~99, 올림) = 같은 나이 · 성별 100명 중 몇 번째 */
  topPct: number;
  /** 올림 전 값 */
  topRaw: number;
  /** 평균보다 좋거나 같음 (체지방률은 낮거나 같음 · 악력은 높거나 같음) */
  atOrAboveAvg: boolean;
  /** 평균까지 남은 차이 — 평균보다 못할 때만 (소수 한 자리 올림) */
  gapToAvg: number | null;
  /** 체지방률이 권장 범위 아래 끝 이하 — 순위를 말하지 않는다 */
  veryLean: boolean;
  /** 막대 위치 0~100 (오른쪽이 앞) — 나 · 평균 */
  barMe: number;
  barAvg: number;
}

/** 한 지표의 같은 나이 · 성별 안 위치 — 나이가 19 아래거나 값이 이상하면 null */
export function peerStanding(metric: PeerMetricKey, value: number, sex: NormSex, age: number): PeerStanding | null {
  const band = ageBand(age);
  if (!band || !Number.isFinite(value) || value <= 0) return null;
  const def = PEER_METRICS[metric];
  const row = def.table[sex]?.find((r) => r.band === band);
  if (!row) return null;
  const lower = def.better === "lower";
  const below = percentileBelow(value, row.p);
  const topRaw = lower ? below : 100 - below;
  const avgBelow = percentileBelow(row.mean, row.p);
  const avgTop = lower ? avgBelow : 100 - avgBelow;
  const atOrAboveAvg = lower ? value <= row.mean : value >= row.mean;
  return {
    band,
    mean: row.mean,
    topPct: clamp(Math.ceil(topRaw - 1e-9), 1, 99),
    topRaw,
    atOrAboveAvg,
    gapToAvg: atOrAboveAvg ? null : ceil1(Math.abs(value - row.mean)),
    veryLean: metric === "bodyFat" && value <= LEAN_FLOOR_PCT[sex],
    barMe: 100 - topRaw,
    barAvg: 100 - avgTop,
  };
}

/** 그 나이 · 성별 측정 평균 — 내 값을 넣기 전에도 '같은 나이 평균'을 보여 준다 */
export function groupMean(metric: PeerMetricKey, sex: NormSex, band: NormBand): number | null {
  return PEER_METRICS[metric].table[sex]?.find((r) => r.band === band)?.mean ?? null;
}

/* ───────────── 내 기록 → 비교 ───────────── */

export interface PeerMetricResult {
  key: PeerMetricKey;
  label: string;
  unit: string;
  gapUnit: string;
  value: number;
  on: string | null;
  now: PeerStanding;
  /** 처음 잰 값 · 그날 나이 기준 위치 — 처음과 마지막 날짜가 다를 때만 */
  first: { value: number; on: string; standing: PeerStanding } | null;
  /** 처음보다 오른 계단(= 상위 %가 줄어든 만큼) — 값도 좋아지고 순위도 1 이상 올랐을 때만, 아니면 null */
  rankGain: number | null;
}

export type PeerMissing = "gender" | "age" | PeerMetricKey;

export interface PeerCompareInput {
  gender: NormSex | null | undefined;
  birthYear: number | null | undefined;
  bodyFat?: { pct: number | null; on: string | null; firstPct: number | null; firstOn: string | null } | null;
  grip?: { kg: number | null; on: string | null; firstKg: number | null; firstOn: string | null } | null;
  /** 'YYYY-MM-DD' (KST) */
  today: string;
}

export interface PeerCompare {
  /** 성별 · 출생 연도가 있고 만 19세 이상 */
  canCompare: boolean;
  /** 만 19세 아래 — 카드를 그리지 않는다 */
  tooYoung: boolean;
  sex: NormSex | null;
  age: number | null;
  band: NormBand | null;
  /** '30대 초반 남성' */
  groupLabel: string | null;
  /** 값이 있는 지표 (PEER_METRIC_ORDER 순) */
  metrics: PeerMetricResult[];
  /** 주인공 — 가장 앞선 지표 (아주 낮은 체지방률은 다른 지표가 있으면 뒤로) */
  hero: PeerMetricResult | null;
  /** 넣으면 비교가 되는 것 (성별 · 나이 · 지표) */
  missing: PeerMissing[];
}

function metricResult(
  key: PeerMetricKey,
  value: number | null,
  on: string | null,
  firstValue: number | null,
  firstOn: string | null,
  sex: NormSex,
  birthYear: number,
  today: string,
): PeerMetricResult | null {
  if (value == null || !Number.isFinite(value)) return null;
  const def = PEER_METRICS[key];
  const now = peerStanding(key, value, sex, ageOn(birthYear, on, today));
  if (!now) return null;
  let first: PeerMetricResult["first"] = null;
  if (firstValue != null && Number.isFinite(firstValue) && firstOn && on && firstOn < on) {
    const fs = peerStanding(key, firstValue, sex, ageOn(birthYear, firstOn, today));
    if (fs) first = { value: firstValue, on: firstOn, standing: fs };
  }
  let rankGain: number | null = null;
  if (first && !now.veryLean) {
    const valueBetter = def.better === "lower" ? value < first.value - 0.05 : value > first.value + 0.05;
    const gain = first.standing.topPct - now.topPct;
    if (valueBetter && gain >= 1) rankGain = gain;
  }
  return { key, label: def.label, unit: def.unit, gapUnit: def.gapUnit, value, on, now, first, rankGain };
}

export function buildPeerCompare(input: PeerCompareInput): PeerCompare {
  const sex = input.gender === "남" || input.gender === "여" ? input.gender : null;
  const by = typeof input.birthYear === "number" && Number.isFinite(input.birthYear) ? input.birthYear : null;
  const age = by != null ? ageOn(by, null, input.today) : null;
  const tooYoung = age != null && age < MIN_COMPARE_AGE;
  const band = age != null ? ageBand(age) : null;
  const canCompare = !!sex && band != null;

  const missing: PeerMissing[] = [];
  if (!sex) missing.push("gender");
  if (by == null) missing.push("age");

  const metrics: PeerMetricResult[] = [];
  if (canCompare && sex && by != null) {
    const fat = input.bodyFat;
    const grip = input.grip;
    const rows: Record<PeerMetricKey, PeerMetricResult | null> = {
      bodyFat: fat ? metricResult("bodyFat", fat.pct, fat.on, fat.firstPct, fat.firstOn, sex, by, input.today) : null,
      grip: grip ? metricResult("grip", grip.kg, grip.on, grip.firstKg, grip.firstOn, sex, by, input.today) : null,
    };
    for (const k of PEER_METRIC_ORDER) {
      const r = rows[k];
      if (r) metrics.push(r);
      else missing.push(k);
    }
  } else {
    if (input.bodyFat?.pct == null) missing.push("bodyFat");
    if (input.grip?.kg == null) missing.push("grip");
  }

  // 주인공 — 상위 %가 가장 작은 지표. 아주 낮은 체지방률(순위를 말하지 않음)은 다른 지표가 있으면 뒤로.
  const ranked = [...metrics].sort((a, b) => Number(a.now.veryLean) - Number(b.now.veryLean) || a.now.topRaw - b.now.topRaw);

  return {
    canCompare,
    tooYoung,
    sex,
    age,
    band,
    groupLabel: canCompare && sex && band ? `${bandLabel(band)} ${sexLabel(sex)}` : null,
    metrics,
    hero: ranked[0] ?? null,
    missing,
  };
}

/* ───────────── 화면 문구 ───────────── */

const one = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

/** '상위 23%' · 5% 안이면 '상위 5% 안' */
export const topText = (s: PeerStanding): string => (s.topPct <= 5 ? "상위 5% 안" : `상위 ${s.topPct}%`);
/** '100명 중 23번째' · '100명 중 5번째 안' */
export const rankText = (s: PeerStanding): string => (s.topPct <= 5 ? "100명 중 5번째 안" : `100명 중 ${s.topPct}번째`);
/** '21.3%' · '42kg' */
export const valueText = (m: Pick<PeerMetricResult, "value" | "unit">): string => `${one(m.value)}${m.unit}`;
/** 지표 값 글 — '22.6%' · '42kg' (내 값이 없을 때 평균에) */
export const metricValueText = (metric: PeerMetricKey, v: number): string => `${one(v)}${PEER_METRICS[metric].unit}`;
/** '평균 22.6%' */
export const avgText = (m: Pick<PeerMetricResult, "now" | "unit">): string => `평균 ${one(m.now.mean)}${m.unit}`;
/** '2.7%p' — 평균까지 남은 차이 (평균보다 좋으면 빈 글) */
export const gapText = (m: Pick<PeerMetricResult, "now" | "gapUnit">): string =>
  m.now.gapToAvg != null ? `${one(m.now.gapToAvg)}${m.gapUnit}` : "";

/** 오른쪽 짧은 글 — 순위 · 평균까지 · 아주 낮은 편 */
export function standingShort(m: PeerMetricResult): string {
  if (m.now.veryLean) return "아주 낮은 편";
  return m.now.atOrAboveAvg ? topText(m.now) : `평균까지 ${gapText(m)}`;
}

/** 처음보다 — { main: '처음보다 18계단 올라왔어요', sub: '처음엔 상위 41%' } (오르지 않았으면 null) */
export function gainParts(m: PeerMetricResult): { main: string; sub: string } | null {
  if (m.rankGain == null || !m.first) return null;
  return { main: `처음보다 ${m.rankGain}계단 올라왔어요`, sub: `처음엔 상위 ${m.first.standing.topPct}%` };
}

/** 처음보다 한 줄 — '처음보다 18계단 올라왔어요 · 처음엔 상위 41%' (오르지 않았으면 null) */
export function gainText(m: PeerMetricResult): string | null {
  const g = gainParts(m);
  return g ? `${g.main} · ${g.sub}` : null;
}

/**
 * 비교 카드 아래 '넣으면 비교해요' 한 줄 — 넣을 것이 없으면 null.
 *   2026-11-13 부터 카드는 lib/fitnessAge153 bodyInviteText(체력 나이를 먼저 권함)를 쓴다 — 이 글은 65세 이상 글과 같아 그대로 둔다.
 */
export function inviteText(c: PeerCompare): string | null {
  if (c.tooYoung) return null;
  if (!c.canCompare) {
    const what = c.missing.includes("gender") && c.missing.includes("age") ? "성별 · 출생 연도를" : c.missing.includes("gender") ? "성별을" : "출생 연도를";
    return `${what} 넣으면 같은 나이 한국인과 비교해 드려요`;
  }
  const left = PEER_METRIC_ORDER.filter((k) => c.missing.includes(k));
  if (!left.length) return null;
  if (!c.metrics.length) return "체지방률(인바디) · 악력을 넣으면 같은 나이 100명 중 몇 번째인지 알려 드려요";
  return left[0] === "grip" ? "악력도 재서 넣으면 같이 비교해 드려요" : "체지방률(인바디)도 넣으면 같이 비교해 드려요";
}
