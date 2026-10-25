/**
 * 🏃 153 체력 프로필 — 153 PB 공식 기록을 영역 5개 · 향상 · 다음 측정으로 (2026-10-25 대표님,
 *   「153 PB 체력 프로필 · 몰입 기능 설계 보고서」 1단계 '내 체력 보기')
 *
 *   서버: get_my_fitness_profile · save_fitness_measure · test153_areas
 *     (supabase/migrations/20261025130557_fitness_profile_153.sql)
 *   숫자는 서버가 계산한 값을 그대로 쓴다 — 여기서는 모양 맞추기 · 비교 · 화면 문구만.
 *
 *   영역 5개 (16구간을 묶음, 순서는 lib/test153 buildSegments)
 *     심폐지구력        셀트런 100m × 8번 — 평균 시간(낮을수록 좋음) · 마지막까지 속도 유지율
 *     하체 근지구력      스쿼트 + 런지 — 1분에 몇 개(높을수록 좋음)
 *     상체 · 코어 근지구력 푸시업 + 복서 싯업 — 1분에 몇 개
 *     복싱 순발력 · 민첩성 복서 버피 + 원·투·쓰리 스텝 + 복서 스텝 콤비 — 시간 합(낮을수록 좋음)
 *     리듬 · 협응        줄넘기 — 1분에 몇 회
 *
 *   문구 원칙: 진단 · 처방 · 의료 표현 없음 · 코치가 잰 기록은 '실측', 출석으로 계산한 값은 '추정' · 잘한 것만
 *   (줄어든 것은 숫자로 말하지 않는다 — 홈 '153과 함께하며'와 같은 원칙).
 *   백분위 · 체력 나이는 2단계 — 서버 키만 있고 지금은 늘 null 이라 여기서 다루지 않는다.
 */
import { spokenDuration } from "@/lib/achievement153";
import { fmtMs, type Test153Division } from "@/lib/test153";

export type AreaKey = "cardio" | "legs" | "upper" | "boxing" | "rhythm";

export interface RateArea {
  reps: number;
  ms: number;
  /** 1분에 몇 개 (서버가 소수 한 자리로 계산) */
  perMin: number | null;
}

export interface Test153Areas {
  cardio: { runAvgMs: number; paceKeepPct: number | null; runsMs: number[] } | null;
  legs: RateArea | null;
  upper: RateArea | null;
  boxing: { ms: number } | null;
  rhythm: RateArea | null;
  /** 끝낸 구간 수 (완주면 16) */
  doneSegments: number;
}

export interface ProfileRecord {
  id: string;
  measuredAt: string;
  scoreMs: number;
  totalMs: number;
  finished: boolean;
  remainingReps: number;
  areas: Test153Areas | null;
  /** 가장 최근 기록에만 — 잰 코치 이름 */
  coachName: string | null;
}

export interface DivisionProfile {
  division: Test153Division;
  count: number;
  first: ProfileRecord;
  pb: ProfileRecord;
  latest: ProfileRecord;
  /** 가장 최근 바로 앞 기록 (기록이 하나면 null) */
  prev: ProfileRecord | null;
  /** 첫 기록 → PB 줄어든 시간 · 비율 (둘 다 완주이고 줄었을 때만) */
  improvedMs: number | null;
  improvedPct: number | null;
}

export type MeasureSource = "coach" | "me";

export interface FitnessProfile {
  hasRecords: boolean;
  /** 가장 최근에 잰 부문 */
  primary: Test153Division | null;
  divisions: Partial<Record<Test153Division, DivisionProfile>>;
  lastMeasuredAt: string | null;
  /** 'YYYY-MM-DD' — 마지막 측정 + 42일(6주 시즌) */
  nextTestOn: string | null;
  grip: {
    kg: number;
    on: string | null;
    source: MeasureSource | null;
    weightKg: number | null;
    /** 몸무게 대비 % (상대악력) — 몸무게가 있을 때만 */
    relPct: number | null;
    firstKg: number | null;
    firstOn: string | null;
  } | null;
  waist: { cm: number; on: string | null } | null;
  restHr: { bpm: number; on: string | null } | null;
  /** 내 측정값 줄 수 (악력 · 허리둘레 · 안정시 심박) */
  measureCount: number;
}

export const EMPTY_FITNESS_PROFILE: FitnessProfile = {
  hasRecords: false,
  primary: null,
  divisions: {},
  lastMeasuredAt: null,
  nextTestOn: null,
  grip: null,
  waist: null,
  restHr: null,
  measureCount: 0,
};

/** 다음 측정까지 — 6주 시즌 (서버 next_test_on 과 같은 수) */
export const NEXT_TEST_DAYS = 42;
/** 처음보다 이만큼(%) 좋아지면 막대가 가득 찬다 */
export const AREA_BAR_FULL_PCT = 20;

/* ───────────── 서버 JSON → 화면용 ───────────── */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const isDivision = (v: unknown): v is Test153Division => v === "open" || v === "starter";

function rateArea(v: unknown): RateArea | null {
  const o = obj(v);
  if (!o) return null;
  const reps = num(o.reps);
  const ms = num(o.ms);
  if (reps == null || ms == null || ms <= 0) return null;
  const perMin = num(o.per_min);
  return { reps, ms, perMin: perMin != null && perMin > 0 ? perMin : null };
}

export function normalizeAreas(raw: unknown): Test153Areas | null {
  const o = obj(raw);
  if (!o) return null;
  const c = obj(o.cardio);
  const runAvg = c ? num(c.run_avg_ms) : null;
  const runs = c && Array.isArray(c.runs_ms) ? c.runs_ms.map(num).filter((n): n is number => n != null) : [];
  const b = obj(o.boxing);
  const bms = b ? num(b.ms) : null;
  return {
    cardio: runAvg != null && runAvg > 0 ? { runAvgMs: runAvg, paceKeepPct: c ? num(c.pace_keep_pct) : null, runsMs: runs } : null,
    legs: rateArea(o.legs),
    upper: rateArea(o.upper),
    boxing: bms != null && bms > 0 ? { ms: bms } : null,
    rhythm: rateArea(o.rhythm),
    doneSegments: Math.max(0, Math.trunc(num(o.done_segments) ?? 0)),
  };
}

function profileRecord(raw: unknown): ProfileRecord | null {
  const o = obj(raw);
  if (!o) return null;
  const id = str(o.id);
  const measuredAt = str(o.measured_at);
  const scoreMs = num(o.score_ms);
  if (!id || !measuredAt || scoreMs == null) return null;
  return {
    id,
    measuredAt,
    scoreMs,
    totalMs: num(o.total_ms) ?? scoreMs,
    finished: o.finished === true,
    remainingReps: Math.max(0, Math.trunc(num(o.remaining_reps) ?? 0)),
    areas: normalizeAreas(o.areas),
    coachName: str(o.coach_name),
  };
}

function divisionProfile(division: Test153Division, raw: unknown): DivisionProfile | null {
  const o = obj(raw);
  if (!o) return null;
  const first = profileRecord(o.first);
  const pb = profileRecord(o.pb);
  const latest = profileRecord(o.latest);
  if (!first || !pb || !latest) return null;
  const improvedMs = num(o.improved_ms);
  const improvedPct = num(o.improved_pct);
  return {
    division,
    count: Math.max(1, Math.trunc(num(o.count) ?? 1)),
    first,
    pb,
    latest,
    prev: profileRecord(o.prev),
    improvedMs: improvedMs != null && improvedMs > 0 ? improvedMs : null,
    improvedPct: improvedMs != null && improvedMs > 0 && improvedPct != null ? improvedPct : null,
  };
}

/** 서버 get_my_fitness_profile → 화면용 (모르는 값은 null, 모양이 틀린 부문은 뺀다) */
export function normalizeFitnessProfile(raw: unknown): FitnessProfile {
  const r = obj(raw);
  if (!r) return EMPTY_FITNESS_PROFILE;
  const divs: Partial<Record<Test153Division, DivisionProfile>> = {};
  const d = obj(r.divisions);
  for (const key of ["open", "starter"] as const) {
    const p = d ? divisionProfile(key, d[key]) : null;
    if (p) divs[key] = p;
  }
  const primaryRaw = isDivision(r.primary) ? r.primary : null;
  const primary = primaryRaw && divs[primaryRaw] ? primaryRaw : divs.open ? "open" : divs.starter ? "starter" : null;

  const g = obj(r.grip);
  const gkg = g ? num(g.kg) : null;
  const w = obj(r.waist);
  const wcm = w ? num(w.cm) : null;
  const h = obj(r.rest_hr);
  const bpm = h ? num(h.bpm) : null;
  return {
    hasRecords: primary != null,
    primary,
    divisions: divs,
    lastMeasuredAt: str(r.last_measured_at),
    nextTestOn: ymd(r.next_test_on),
    grip:
      g && gkg != null && gkg > 0
        ? {
            kg: gkg,
            on: ymd(g.on),
            source: g.source === "coach" || g.source === "me" ? g.source : null,
            weightKg: num(g.weight_kg),
            relPct: num(g.rel_pct),
            firstKg: num(g.first_kg),
            firstOn: ymd(g.first_on),
          }
        : null,
    waist: wcm != null && wcm > 0 ? { cm: wcm, on: ymd(w?.on) } : null,
    restHr: bpm != null && bpm > 0 ? { bpm, on: ymd(h?.on) } : null,
    measureCount: Math.max(0, Math.trunc(num(r.measure_count) ?? 0)),
  };
}

/** 보여 줄 부문 — 가장 최근에 잰 부문 (없으면 null) */
export const shownDivision = (p: FitnessProfile | null | undefined): DivisionProfile | null =>
  p?.primary ? p.divisions[p.primary] ?? null : null;

/* ───────────── 영역 ───────────── */

export interface AreaDef {
  key: AreaKey;
  label: string;
  /** 어떤 구간을 묶었나 (한 줄 설명) */
  from: string;
  better: "lower" | "higher";
}

export const AREA_DEFS: readonly AreaDef[] = [
  { key: "cardio", label: "심폐지구력", from: "셀트런 8번", better: "lower" },
  { key: "legs", label: "하체 근지구력", from: "스쿼트 · 런지", better: "higher" },
  { key: "upper", label: "상체 · 코어 근지구력", from: "푸시업 · 복서 싯업", better: "higher" },
  { key: "boxing", label: "복싱 순발력 · 민첩성", from: "복서 버피 · 원투쓰리 스텝 · 스텝 콤비", better: "lower" },
  { key: "rhythm", label: "리듬 · 협응", from: "줄넘기", better: "higher" },
];

/** 비교에 쓰는 한 숫자 — 심폐 = 셀트런 평균(ms) · 복싱 = 시간 합(ms) · 나머지 = 1분에 몇 개 */
export function areaMetric(areas: Test153Areas | null | undefined, key: AreaKey): number | null {
  if (!areas) return null;
  switch (key) {
    case "cardio":
      return areas.cardio?.runAvgMs ?? null;
    case "boxing":
      return areas.boxing?.ms ?? null;
    case "legs":
      return areas.legs?.perMin ?? null;
    case "upper":
      return areas.upper?.perMin ?? null;
    case "rhythm":
      return areas.rhythm?.perMin ?? null;
  }
}

const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const floorOne = (v: number) => (Math.floor(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

/**
 * 좋아진 비율(%) — 좋아졌으면 양수 (시간은 줄수록, 개수는 늘수록). 소수 한 자리 · 둘 중 하나라도 없으면 null.
 */
export function areaChangePct(before: Test153Areas | null | undefined, after: Test153Areas | null | undefined, key: AreaKey): number | null {
  const a = areaMetric(before, key);
  const b = areaMetric(after, key);
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  const def = AREA_DEFS.find((d) => d.key === key);
  const pct = def?.better === "lower" ? ((a - b) / a) * 100 : ((b - a) / a) * 100;
  return Math.round(pct * 10) / 10;
}

/** 영역 값 한 줄 — '평균 28.9초 · 끝까지 속도 94% 유지'(셀트런) · '1분에 43.9개' · '세 구간 3:23.0' */
export function areaValueText(areas: Test153Areas | null | undefined, key: AreaKey): string | null {
  if (!areas) return null;
  switch (key) {
    case "cardio": {
      const c = areas.cardio;
      if (!c) return null;
      const keep = c.paceKeepPct != null ? ` · 끝까지 속도 ${Math.min(100, Math.round(c.paceKeepPct))}% 유지` : "";
      return `평균 ${oneDecimal(c.runAvgMs / 1000)}초${keep}`;
    }
    case "boxing":
      return areas.boxing ? `세 구간 ${fmtMs(areas.boxing.ms)}` : null;
    case "rhythm":
      return areas.rhythm?.perMin != null ? `1분에 ${Math.round(areas.rhythm.perMin).toLocaleString("ko-KR")}회` : null;
    case "legs":
    case "upper": {
      const r = key === "legs" ? areas.legs : areas.upper;
      return r?.perMin != null ? `1분에 ${floorOne(r.perMin)}개` : null;
    }
  }
}

export interface AreaRow {
  key: AreaKey;
  label: string;
  from: string;
  /** 이번(가장 최근) 값 — 끝내지 못한 영역이면 null */
  value: string | null;
  /** 처음보다 좋아진 % — 좋아졌을 때만 (기록이 하나거나 같거나 줄었으면 null) */
  gainPct: number | null;
  /** 막대 채움 0~1 (gainPct ÷ AREA_BAR_FULL_PCT) */
  ratio: number;
}

/** 내 체력 카드의 영역 5줄 — 이번 값 + 처음보다 좋아진 정도 */
export function areaRows(div: DivisionProfile | null | undefined): AreaRow[] {
  return AREA_DEFS.map((def) => {
    const latest = div?.latest.areas ?? null;
    const sameAsFirst = !div || div.first.id === div.latest.id;
    const raw = sameAsFirst ? null : areaChangePct(div?.first.areas, latest, def.key);
    const gainPct = raw != null && raw >= 0.1 ? raw : null;
    return {
      key: def.key,
      label: def.label,
      from: def.from,
      value: areaValueText(latest, def.key),
      gainPct,
      ratio: gainPct != null ? Math.min(1, gainPct / AREA_BAR_FULL_PCT) : 0,
    };
  });
}

/** 가장 좋아진 영역 — before → after (좋아진 영역이 없으면 null) */
export function bestImprovedArea(
  before: Test153Areas | null | undefined,
  after: Test153Areas | null | undefined,
): { key: AreaKey; label: string; pct: number } | null {
  let best: { key: AreaKey; label: string; pct: number } | null = null;
  for (const def of AREA_DEFS) {
    const pct = areaChangePct(before, after, def.key);
    if (pct != null && pct >= 0.1 && (!best || pct > best.pct)) best = { key: def.key, label: def.label, pct };
  }
  return best;
}

/* ───────────── 기록 · 문구 ───────────── */

const KST_MS = 9 * 3600_000;

/** '2026-10-24T10:00:00+00:00' 또는 '2026-10-24' → '10월 24일' (한국 날짜) */
export function kstMonthDay(v: string | null | undefined): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${Number(v.slice(5, 7))}월 ${Number(v.slice(8, 10))}일`;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + KST_MS);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

/** 기록 시간 — 완주면 '13:56.5', 타임캡이면 '25:00 + 남은 N개' */
export const recordTimeText = (r: Pick<ProfileRecord, "finished" | "scoreMs" | "remainingReps">): string =>
  r.finished ? fmtMs(r.scoreMs) : `25:00 + 남은 ${r.remainingReps.toLocaleString("ko-KR")}개`;

/** PB 아래 한 줄 — 잘한 것 먼저 */
export function pbLine(div: DivisionProfile): string {
  if (div.count <= 1) return "첫 공식 기록이에요 — 다음 측정부터 얼마나 좋아졌는지 보여 드려요";
  if (div.improvedMs != null) {
    const pct = div.improvedPct != null ? ` (${floorOne(div.improvedPct)}%)` : "";
    return `첫 기록보다 ${spokenDuration(div.improvedMs)} 빨라졌어요${pct}`;
  }
  if (!div.first.finished && div.pb.finished) return "처음엔 25분 안에 다 못 했는데, 이제 완주해요";
  return "다음 목표는 PB보다 1초 빠르게";
}

/** 'YYYY-MM-DD' 두 날짜 사이 날 수 (b - a) */
function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((tb - ta) / 86_400_000);
}

/** 다음 측정 — '12월 5일 · D-41' · 오늘이면 '오늘이에요' · 지났으면 '다시 잴 때예요' */
export function nextTestText(nextOn: string | null | undefined, todayKst: string): string | null {
  if (!nextOn || !/^\d{4}-\d{2}-\d{2}$/.test(nextOn) || !/^\d{4}-\d{2}-\d{2}$/.test(todayKst)) return null;
  const left = daysBetween(todayKst, nextOn);
  if (left > 0) return `${kstMonthDay(nextOn)} · D-${left}`;
  if (left === 0) return "오늘이에요";
  return "다시 잴 때예요 — 코치님께 말씀해 주세요";
}

/** 악력 한 줄 — '악력 42.3kg · 몸무게의 56%' */
export function gripText(grip: FitnessProfile["grip"]): string | null {
  if (!grip) return null;
  const rel = grip.relPct != null && grip.relPct > 0 ? ` · 몸무게의 ${Math.round(grip.relPct)}%` : "";
  return `악력 ${oneDecimal(grip.kg)}kg${rel}`;
}

/**
 * 몸무게 대비 악력(%) — 상대악력 (국민체력100 근력 항목과 같은 식: 악력 ÷ 몸무게 × 100), 정수.
 * 서버 get_my_fitness_profile rel_pct 와 같은 계산 — 내 신체 정보 악력 칸 옆에 바로 보여 준다 (2026-10-25).
 * 둘 중 하나라도 없거나 넣을 수 있는 범위 밖이면 null.
 */
export function relGripPct(gripKg: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (gripKg == null || weightKg == null || !Number.isFinite(gripKg) || !Number.isFinite(weightKg)) return null;
  const g = MEASURE_RANGE.grip_kg;
  if (gripKg < g.min || gripKg > g.max || weightKg < 25 || weightKg > 250) return null;
  return Math.round((gripKg / weightKg) * 100);
}

/** 측정 직후 '이번 결과 한 장' — 이번 vs 지난번 · 가장 좋아진 영역 */
export interface ResultSummary {
  thisText: string;
  prevText: string | null;
  /** 지난번보다 줄어든 시간(ms) — 둘 다 완주이고 줄었을 때만 */
  fasterMs: number | null;
  isPb: boolean;
  best: { key: AreaKey; label: string; pct: number } | null;
  /** 영역마다 지난번 대비 (좋아졌을 때만 pct) */
  changes: { key: AreaKey; label: string; value: string | null; pct: number | null }[];
}

export function resultSummary(div: DivisionProfile): ResultSummary {
  const cur = div.latest;
  const prev = div.prev;
  const faster = prev && prev.finished && cur.finished && prev.scoreMs - cur.scoreMs >= 100 ? prev.scoreMs - cur.scoreMs : null;
  return {
    thisText: recordTimeText(cur),
    prevText: prev ? recordTimeText(prev) : null,
    fasterMs: faster,
    isPb: div.pb.id === cur.id,
    best: prev ? bestImprovedArea(prev.areas, cur.areas) : null,
    changes: AREA_DEFS.map((def) => {
      const pct = prev ? areaChangePct(prev.areas, cur.areas, def.key) : null;
      return { key: def.key, label: def.label, value: areaValueText(cur.areas, def.key), pct: pct != null && pct >= 0.1 ? pct : null };
    }),
  };
}

/* ───────────── 입력 확인 ───────────── */

export type MeasureKind = "grip_kg" | "waist_cm" | "rest_hr";

export const MEASURE_RANGE: Record<MeasureKind, { min: number; max: number; label: string; topic: string; unit: string }> = {
  grip_kg: { min: 5, max: 90, label: "악력", topic: "악력은", unit: "kg" },
  waist_cm: { min: 50, max: 150, label: "허리둘레", topic: "허리둘레는", unit: "cm" },
  rest_hr: { min: 35, max: 120, label: "안정시 심박", topic: "안정시 심박은", unit: "회/분" },
};

/** 측정값 입력 — 빈칸 null · '42.5' 꼴이 아니면 NaN (안정시 심박은 정수만) */
export function parseMeasure(kind: MeasureKind, text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const ok = kind === "rest_hr" ? /^\d{2,3}$/.test(t) : /^\d{1,3}(\.\d)?$/.test(t);
  return ok ? Number(t) : NaN;
}

/** 문제 없으면 null, 있으면 한 줄 */
export function measureInputError(kind: MeasureKind, value: number | null): string | null {
  if (value == null) return null;
  const r = MEASURE_RANGE[kind];
  if (Number.isNaN(value) || value < r.min || value > r.max) {
    const step = kind === "rest_hr" ? "정수로" : "소수 한 자리까지";
    return `${r.topic} ${r.min}~${r.max}${r.unit} 사이 숫자로 넣어 주세요 (${step})`;
  }
  return null;
}

/** 서버 오류 → 한 줄 */
export function measureErrorText(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err ?? "");
  if (msg.includes("fitness_measure_range")) return "넣을 수 있는 범위를 벗어났어요. 숫자를 다시 확인해 주세요";
  if (msg.includes("fitness_measure_forbidden")) return "같은 지점 코치님만 넣을 수 있어요";
  if (msg.includes("not_authenticated")) return "로그인이 필요해요";
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요";
}
