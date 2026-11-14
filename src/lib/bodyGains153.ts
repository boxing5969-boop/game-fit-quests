/**
 * 📏 내 몸이 좋아진 정도 — 줄마다 몇 % · 숫자로 몇 · 얼마나 · 무슨 기준
 *   2026-11-14 대표님 「기존에 운동을 향한 신체적 향상도 몇% 좋아졌는지도 있고 숫자로 몇인지 또 얼마나 향상 되었는지
 *   알수있게 해줘 이것도 과학적인 신뢰성이 중요해 사람들이 어떤 기준인지 의심해」
 *
 *   '153과 함께하며' 카드(HealthGainsCard)의 줄 다섯(+ 몸무게): 심폐지구력 · 근지구력 · 근력 · 체력 · 체지방률 (· 몸무게)
 *   줄마다 '실측'(153 PB · 악력계 · 인바디 · 체중계로 두 번 넘게 잰 내 기록)이 있으면 그것, 없으면 '추정'(내 운동량 × 연구 평균 —
 *   lib/healthGains153). 실측과 추정은 늘 이름표로 나눠 보여 준다.
 *     · 심폐지구력 — 실측: 153 PB 셀트런 8번 평균(첫 기록 → 최근) / 추정: 최대산소섭취량 %
 *       추정의 '지금' 숫자는 '같은 나이와 비교' 카드의 심폐 체력 추정(fitnessAge153 cardioEstimate)과 같은 숫자 —
 *       한 화면에 최대산소섭취량이 두 개 나오지 않게. '처음' = 지금 ÷ (1 + 좋아진 %).
 *     · 근지구력 — 실측: 153 PB 푸시업 · 복서 싯업(없으면 스쿼트 · 런지) 1분에 몇 개 / 추정: 팔굽혀펴기 · 윗몸일으키기 횟수 기준 %
 *     · 근력 — 실측: 악력 처음 → 최근 / 추정: 악력 기준 % (잰 값이 하나면 그 값을 기준으로, 없으면 같은 나이 평균으로 kg 을 보여 준다)
 *     · 체력 — 실측: 153 PB 총 시간(첫 완주 → 최고) / 추정: 세 가지 평균
 *     · 체지방률 — 실측: 처음 → 최근 / 추정: %p (잰 값이 하나면 그 값을 기준으로, 없으면 같은 나이 평균으로)
 *     · 몸무게 — 실측만, 줄었을 때만 (늘었으면 근육인지 지방인지 몰라서 말하지 않는다)
 *   정직하게 — 잰 기록이 있는데 좋아지지 않았으면 추정으로 덮지 않는다:
 *     측정 오차 안이면 '유지'(최근 값만), 오차보다 나빠졌으면 그 줄을 그리지 않는다 (잘한 것만 — 못한 것은 말하지 않는다).
 *   '확실한 변화' = 측정 오차보다 큰 변화 — 악력 5kg · 체지방률 2.8%p · 153 PB 11% (아래 상수에 근거).
 *   줄을 누르면 '기준'(basis) — 연구 · 153 계산 · 숫자가 나온 길 · 직접 재는 법. 153이 정한 가정은 '153 가정'이라고 쓴다.
 *   진단 · 처방 · 의료 표현은 쓰지 않는다. 숫자 · 문구는 이 파일 한 곳 (시험 bodyGains153.test.ts).
 */
import type { NormBand, NormSex } from "@/data/nfaNorms";
import { pbView, spokenDuration, type PbRecordLike } from "@/lib/achievement153";
import type { CardioEstimate } from "@/lib/fitnessAge153";
import {
  BODY_FAT_MAX_PP,
  CARDIO_MAX_PCT,
  ENDURANCE_MAX_PCT,
  STRENGTH_MAX_PCT,
  SURE_BODY_FAT_PP,
  SURE_GRIP_KG,
  SURE_PB_PCT,
  cardioDoseWeeks,
  formatPct,
  formatWeeks,
  muscleDoseWeeks,
  saturatingPct,
  type HealthDay,
  type HealthGains,
} from "@/lib/healthGains153";
import { bandLabel, groupMean, sexLabel } from "@/lib/peerCompare153";
import { DIVISION_LABEL, fmtMs, type Test153Division } from "@/lib/test153";
import { AREA_BAR_FULL_PCT, areaMetric, kstMonthDay, type AreaKey, type DivisionProfile } from "@/lib/test153Profile";

/* ───────────── 근거 숫자 (바꾸면 화면 '기준' 글이 같이 바뀐다) ───────────── */

/**
 * 심폐지구력 — Milanović Z · Sporiš G · Weston M, Sports Medicine 2015;45:1469–1481 (doi 10.1007/s40279-015-0365-0)
 *   18~45세 건강한 성인 28개 대조 실험 723명(평균 25세 · 처음 최대산소섭취량 40.8): 지속 유산소 훈련 +4.9 mL/kg/분(±1.4),
 *   인터벌 훈련 +5.5(±1.2) — 운동 안 한 무리와 견줘서. 4.9 ÷ 40.8 ≈ 12%.
 */
export const VO2_STUDY = { gain: 4.9, base: 40.8, studies: 28, people: 723 } as const;
/**
 * 근지구력 · 근력 — Kahraman S 외, BMC Sports Science, Medicine and Rehabilitation 2025 (PMC12781521)
 *   킥복싱 + 맨몸 운동 8주(주 3번, 이미 훈련하던 선수): 30초 팔굽혀펴기 28.5 → 30.2개(+6%) · 윗몸일으키기 27.3 → 29.4개(+7.7%) · 악력 +4%.
 *   처음 운동하는 사람은 근력이 더 크게 는다 — 미국스포츠의학회 근력 운동 권고(ACSM Position Stand 2009, MSSE 41:687).
 */
export const ENDURANCE_STUDY = { weeks: 8, pushFrom: 28.5, pushTo: 30.2, situpFrom: 27.3, situpTo: 29.4, gripPct: 4 } as const;
/**
 * 체지방률 — Jayedi A 외, JAMA Network Open 2024;7(12):e2452185 (doi 10.1001/jamanetworkopen.2024.52185)
 *   과체중 · 비만 성인 116개 무작위 대조 실험(8주 이상): 유산소 운동 주 30분마다 체지방률 −0.37%p, 주 150분이면 약 −2%p.
 */
export const BODY_FAT_STUDY = { perHalfHour: 0.37, trials: 116 } as const;

/** 확실한 변화(측정 오차보다 큰 변화) — 숫자와 근거는 lib/healthGains153 한 곳 (오삼코치 지식도 같은 숫자) */
export { SURE_BODY_FAT_PP, SURE_GRIP_KG, SURE_PB_PCT };

/** 줄 이름 옆 '누르면 기준' · 카드 아래 '계산 방법' 안 두 줄 */
export const GAIN_SECTION_HINT = "누르면 기준";
export const MEASURED_VS_ESTIMATE_NOTE =
  "실측은 153 PB · 악력계 · 인바디 · 체중계로 두 번 넘게 잰 내 기록, 추정은 내 운동량 × 연구 평균이에요. 잰 기록이 있으면 늘 그것을 먼저 보여 드리고, 좋아지지 않았으면 추정으로 덮지 않아요 — 측정 오차 안이면 '유지'로 보여 드려요";
export const SURE_CHANGE_NOTE = `측정 오차보다 큰 변화예요 — 악력 ${SURE_GRIP_KG}kg · 체지방률 ${SURE_BODY_FAT_PP}%p · 153 PB ${SURE_PB_PCT}% 넘게 좋아지면 표시해요 (줄을 누르면 근거)`;

/* ───────────── 모양 ───────────── */

export type GainKey = "cardio" | "endurance" | "strength" | "fitness" | "bodyFat" | "weight";
export type GainSource = "measured" | "estimate";
/** 기준 아래 단추 — 153 PB 화면 · 내 신체 정보 */
export type GainMeasure = "pb" | "body";

export interface GainBasis {
  k: string;
  v: string;
}

export interface GainRow {
  key: GainKey;
  label: string;
  source: GainSource;
  /** 큰 글 — '+11%' · '7.3% 빨라짐' · '-2.4%p' · '-3.1kg' · '유지' */
  value: string;
  /** 숫자 줄 — '최대산소섭취량 35 → 38.9 · +3.9' (없으면 null) */
  numbers: string | null;
  /** 막대 채움 0~1 (null = 막대 없음) */
  ratio: number | null;
  /** 금색 — 실측은 확실한 변화일 때만, 추정은 연구 상한의 80%를 넘을 때 */
  gold: boolean;
  /** 측정 오차보다 큰 변화 (실측만) */
  sure: boolean;
  /** 잰 기록이 좋아지진 않았지만 측정 오차 안 — '유지' */
  steady: boolean;
  /** 누르면 펼치는 '기준' — 위에서부터 차례로 */
  basis: GainBasis[];
  measure: GainMeasure | null;
}

/** 처음 · 최근 잰 값 (날짜 'YYYY-MM-DD') — 처음 값이 없거나 날짜가 같으면 잰 값이 하나인 것 */
export interface MeasuredPair {
  value: number | null | undefined;
  on: string | null | undefined;
  firstValue?: number | null;
  firstOn?: string | null;
}

export interface BodyGainsInput {
  /** healthGains() 결과 (첫 운동 전이면 previewGains()) */
  gains: HealthGains;
  /** 출석 — 잰 날까지의 운동량을 셀 때 */
  days: readonly HealthDay[];
  /** 첫 운동 전 미리 보기 — 추정만, 숫자 줄 없음 */
  preview?: boolean;
  /** '같은 나이와 비교'와 같은 심폐 체력 추정 (성별 · 나이를 모르면 null) */
  cardio?: CardioEstimate | null;
  sex?: NormSex | null;
  band?: NormBand | null;
  /** 153 PB 공식 기록 (test153 summary records) */
  pbRecords?: readonly PbRecordLike[] | null;
  /** 같은 부문의 체력 프로필 (구간 = 셀트런 · 푸시업 · 싯업 …) */
  pbDivision?: DivisionProfile | null;
  grip?: MeasuredPair | null;
  bodyFat?: MeasuredPair | null;
  weight?: MeasuredPair | null;
}

/* ───────────── 숫자 글 ───────────── */

const fin = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
/** 35 · 38.9 — '같은 나이와 비교' 카드와 같은 반올림 (소수 한 자리) */
const one = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/**
 * 추정 % — 1 넘으면 정수(내림), 1 아래는 소수 한 자리(내림). 추정에 소수점까지 붙이면 실제보다 정확해 보여서.
 * 숫자 줄(처음 → 지금)도 이 보이는 값으로 만든다 — 회원이 직접 나눠 봐도 화면 % 와 맞게.
 */
export function estPctValue(p: number): number {
  const v = fin(p) ? Math.max(0, p) : 0;
  return v >= 1 ? Math.floor(v) : Math.floor(v * 10) / 10;
}
export const estPctText = (p: number): string => estPctValue(p).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/** %p — 소수 한 자리 내림 (적게 잡는 쪽) · 숫자 줄도 이 값으로 */
const ppValue = (v: number) => Math.floor(Math.max(0, fin(v) ? v : 0) * 10) / 10;
const ppText = (v: number) => ppValue(v).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const md = (d: string | null | undefined) => kstMonthDay(d ?? null);
const ymd = (d: string | null | undefined) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const clamp01 = (v: number) => Math.max(0, Math.min(1, fin(v) ? v : 0));
/** 그날까지(그날 포함)의 운동 — 잰 날 운동은 잰 '전'으로 친다 (적게 잡는 쪽) */
const until = (days: readonly HealthDay[], on: string) => days.filter((d) => d.day <= on);

/** 처음과 날짜가 다른 두 번째 기록이 있나 */
function pairOf(p: MeasuredPair | null | undefined): { first: number; now: number; firstOn: string; on: string } | null {
  if (!p || !fin(p.value) || !fin(p.firstValue)) return null;
  const on = ymd(p.on);
  const firstOn = ymd(p.firstOn);
  if (!on || !firstOn || on === firstOn) return null;
  return { first: p.firstValue, now: p.value, firstOn, on };
}
/** 잰 값이 하나 (또는 처음과 같은 날) */
function singleOf(p: MeasuredPair | null | undefined): { value: number; on: string } | null {
  if (!p || !fin(p.value)) return null;
  const on = ymd(p.on);
  return on ? { value: p.value, on } : null;
}

/* ───────────── 153 계산 줄 ───────────── */

interface DoseLine {
  dose: number;
  pct: number;
  cap: number;
  /** '주 500 MET·분 = 1주 · 153 수업 2번' */
  unit: string;
  /** 최대 몇 %인 까닭 — '연구 평균 12%에 긴 기간을 더한 153 가정' */
  capWhy: string;
  preview: boolean;
  pp?: boolean;
}
const signed = (o: { pp?: boolean }, v: number) => (o.pp ? `−${ppText(v)}%p` : `+${estPctText(v)}%`);
function doseBasis(o: DoseLine): GainBasis[] {
  const now = signed(o, o.pct);
  const head = o.preview ? `주 2번씩 ${formatWeeks(o.dose)}주면 ${now}` : `운동한 ${formatWeeks(o.dose)}주분 → 지금 ${now}`;
  const cap = o.pp ? `−${o.cap}%p` : `+${o.cap}%`;
  return [
    { k: "153 계산", v: `${head} (${o.unit})` },
    {
      k: "곡선",
      v: `쌓일수록 최대 ${cap}까지(${o.capWhy}) — 8주분 ${signed(o, saturatingPct(o.cap, 8))} · 16주분 ${signed(o, saturatingPct(o.cap, 16))}. 처음엔 빨리, 갈수록 천천히 느는 이 모양은 153이 정한 계산식이에요`,
    },
  ];
}
const CARDIO_UNIT = "주 500 MET·분 = 1주 · 153 수업 2번";
const MUSCLE_UNIT = "주 2번 = 1주 · 1번 = 0.5주";

/* ───────────── 153 PB 구간 (셀트런 · 푸시업 · 싯업 …) ───────────── */

interface AreaPair {
  a: number;
  b: number;
  firstOn: string;
  on: string;
}
function areaPairOf(div: DivisionProfile | null | undefined, key: AreaKey): AreaPair | null {
  if (!div || div.count < 2 || div.first.id === div.latest.id) return null;
  const a = areaMetric(div.first.areas, key);
  const b = areaMetric(div.latest.areas, key);
  if (!fin(a) || !fin(b) || a <= 0 || b <= 0) return null;
  return { a, b, firstOn: div.first.measuredAt, on: div.latest.measuredAt };
}

/** 구간 실측 — 좋아졌으면 %, 날마다 차이 안이면 '유지', 그보다 나빠졌으면 null(그리지 않음) */
function areaRow(o: {
  key: GainKey;
  label: string;
  pair: AreaPair;
  better: "lower" | "higher";
  what: string;
  fmt: (v: number) => string;
  unit: string;
}): GainRow | null | "worse" {
  const { a, b } = o.pair;
  const pct = o.better === "lower" ? ((a - b) / a) * 100 : ((b - a) / a) * 100;
  const rec = { k: "잰 기록", v: `153 PB ${o.what} — ${md(o.pair.firstOn)} ${o.fmt(a)}${o.unit} → ${md(o.pair.on)} ${o.fmt(b)}${o.unit}` };
  if (pct <= -SURE_PB_PCT) return "worse";
  if (pct < 0.1) {
    return {
      key: o.key,
      label: o.label,
      source: "measured",
      value: "유지",
      numbers: `최근 ${o.what} ${o.fmt(b)}${o.unit}`,
      ratio: null,
      gold: false,
      sure: false,
      steady: true,
      basis: [rec, { k: "유지", v: "처음과 차이가 날마다 생기는 차이 안이라 '유지'로 보여 드려요" }],
      measure: "pb",
    };
  }
  const diff = Math.abs(b - a);
  const faster = o.better === "lower";
  return {
    key: o.key,
    label: o.label,
    source: "measured",
    value: faster ? `${formatPct(pct)}% 빨라짐` : `+${formatPct(pct)}%`,
    numbers: faster
      ? `${o.what} ${o.fmt(a)} → ${o.fmt(b)}${o.unit} · ${o.fmt(diff)}${o.unit} 단축`
      : `${o.what} ${o.fmt(a)} → ${o.fmt(b)}${o.unit}`,
    ratio: clamp01(pct / AREA_BAR_FULL_PCT),
    gold: false,
    sure: false,
    steady: false,
    basis: [
      rec,
      {
        k: "계산",
        v: faster
          ? `줄어든 ${o.fmt(diff)}${o.unit} ÷ 처음 ${o.fmt(a)}${o.unit} = ${formatPct(pct)}% 빨라졌어요`
          : `늘어난 ${o.fmt(diff)}${o.unit} ÷ 처음 ${o.fmt(a)}${o.unit} = ${formatPct(pct)}%`,
      },
      { k: "참고", v: "처음 한두 번은 코스에 익숙해져 좋아지는 몫도 있어요" },
    ],
    measure: "pb",
  };
}

/* ───────────── 줄마다 ───────────── */

function cardioRow(i: BodyGainsInput): GainRow | null {
  if (!i.preview) {
    const pair = areaPairOf(i.pbDivision, "cardio");
    if (pair) {
      const r = areaRow({ key: "cardio", label: "심폐지구력", pair, better: "lower", what: "셀트런 평균", fmt: (ms) => one(ms / 1000), unit: "초" });
      if (r === "worse") return null;
      return r;
    }
  }
  const pct = i.gains.cardioPct;
  const basis: GainBasis[] = [
    {
      k: "연구",
      v: `꾸준히 유산소 운동을 한 사람은 운동 안 한 사람보다 최대산소섭취량이 평균 +${VO2_STUDY.gain} 더 늘었어요 — 처음 ${VO2_STUDY.base}에서 약 ${Math.round((VO2_STUDY.gain / VO2_STUDY.base) * 100)}% (Milanović 외 2015, Sports Medicine · 18~45세 ${VO2_STUDY.studies}개 실험 ${VO2_STUDY.people}명). 인터벌 운동은 +5.5였지만 153은 낮은 쪽을 써요`,
    },
    ...doseBasis({ dose: i.gains.cardioDose, pct, cap: CARDIO_MAX_PCT, unit: CARDIO_UNIT, capWhy: "연구 평균 12%에 긴 기간을 더한 153 가정", preview: !!i.preview }),
  ];
  let numbers: string | null = null;
  if (!i.preview && i.cardio && estPctValue(pct) > 0) {
    const now = i.cardio.est;
    const start = now / (1 + estPctValue(pct) / 100);
    numbers = `최대산소섭취량 ${one(start)} → ${one(now)} · +${one(now - start)}`;
    basis.push(
      {
        k: "지금 숫자",
        v: `'같은 나이와 비교'의 심폐 체력 추정과 같은 숫자예요 — 국민체력100 같은 나이 · 성별 가운데 값 ${one(i.cardio.median)}에서 운동 · 체지방률 · 안정시 심박만큼 더하고 뺐어요 (단위 mL/kg/분 — 1분에 몸무게 1kg이 쓰는 산소)`,
      },
      { k: "처음 숫자", v: `153에서 좋아진 ${estPctText(pct)}%를 지금 ${one(now)}에서 덜어 낸 값이에요 (${one(now)} ÷ ${(1 + estPctValue(pct) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 3 })})` },
    );
  } else if (!i.preview) {
    numbers = "최대산소섭취량 기준";
    basis.push(
      i.sex && i.band
        ? { k: "숫자", v: "최대산소섭취량 기준표(국민체력100)가 64세까지라 %로만 보여 드려요" }
        : { k: "숫자", v: "성별 · 출생 연도를 넣으면 최대산소섭취량(mL/kg/분)으로 처음 → 지금을 보여 드려요" },
    );
  }
  basis.push({ k: "직접 재려면", v: "153 PB를 두 번 재면 셀트런 기록(실측)으로 바뀌어요" });
  const ratio = clamp01(pct / CARDIO_MAX_PCT);
  return {
    key: "cardio",
    label: "심폐지구력",
    source: "estimate",
    value: `+${estPctText(pct)}%`,
    numbers,
    ratio,
    gold: ratio >= 0.8,
    sure: false,
    steady: false,
    basis,
    measure: "pb",
  };
}

function enduranceRow(i: BodyGainsInput): GainRow | null {
  if (!i.preview) {
    const upper = areaPairOf(i.pbDivision, "upper");
    const legs = upper ? null : areaPairOf(i.pbDivision, "legs");
    const pair = upper ?? legs;
    if (pair) {
      const r = areaRow({
        key: "endurance",
        label: "근지구력",
        pair,
        better: "higher",
        what: upper ? "푸시업 · 싯업 1분에" : "스쿼트 · 런지 1분에",
        fmt: one,
        unit: "개",
      });
      if (r === "worse") return null;
      return r;
    }
  }
  const pct = i.gains.endurancePct;
  const s = ENDURANCE_STUDY;
  const ratio = clamp01(pct / ENDURANCE_MAX_PCT);
  return {
    key: "endurance",
    label: "근지구력",
    source: "estimate",
    value: `+${estPctText(pct)}%`,
    numbers: i.preview ? null : "팔굽혀펴기 · 윗몸일으키기 횟수 기준",
    ratio,
    gold: ratio >= 0.8,
    sure: false,
    steady: false,
    basis: [
      { k: "무엇", v: "같은 동작을 몇 번 이어서 할 수 있나예요 — 팔굽혀펴기 · 윗몸일으키기 개수로 재요" },
      {
        k: "연구",
        v: `킥복싱 + 맨몸 운동 ${s.weeks}주(주 3번) — 30초 팔굽혀펴기 ${s.pushFrom} → ${s.pushTo}개(+6%) · 윗몸일으키기 ${s.situpFrom} → ${s.situpTo}개(+7.7%) (Kahraman 외 2025, BMC Sports Science, Medicine and Rehabilitation)`,
      },
      ...doseBasis({ dose: i.gains.muscleDose, pct, cap: ENDURANCE_MAX_PCT, unit: MUSCLE_UNIT, capWhy: "연구 8주 결과에 긴 기간을 더한 153 가정", preview: !!i.preview }),
      { k: "직접 재려면", v: "153 PB를 두 번 재면 푸시업 · 싯업 구간 기록(실측)으로 바뀌어요" },
    ],
    measure: "pb",
  };
}

const GRIP_WHAT = { k: "무엇", v: "악력 — 손으로 꽉 쥐는 힘이에요. 온몸 근력을 잘 보여 줘서 국민체력100도 근력 검사로 써요" };

function strengthRow(i: BodyGainsInput): GainRow | null {
  const pair = i.preview ? null : pairOf(i.grip);
  if (pair) {
    const d = pair.now - pair.first;
    const rec = { k: "잰 기록", v: `악력 ${md(pair.firstOn)} ${one(pair.first)}kg → ${md(pair.on)} ${one(pair.now)}kg` };
    const sureLine = {
      k: "확실한 변화",
      v: `악력은 같은 사람이 다시 재도 몇 kg씩 달라져서, ${SURE_GRIP_KG}kg 넘게 늘면 확실한 변화로 봐요 (Bohannon 2019, 악력 연구 모음 — 의미 있는 변화 5.0~6.5kg)`,
    };
    if (d <= -SURE_GRIP_KG) return null;
    if (d < 0.1) {
      return {
        key: "strength",
        label: "근력",
        source: "measured",
        value: "유지",
        numbers: `악력 최근 ${one(pair.now)}kg`,
        ratio: null,
        gold: false,
        sure: false,
        steady: true,
        basis: [rec, { k: "유지", v: `처음과 차이가 ${SURE_GRIP_KG}kg 안이라 '유지'로 보여 드려요` }, sureLine],
        measure: "body",
      };
    }
    const pct = pair.first > 0 ? (d / pair.first) * 100 : 0;
    const sure = d >= SURE_GRIP_KG;
    return {
      key: "strength",
      label: "근력",
      source: "measured",
      value: `+${formatPct(pct)}%`,
      numbers: `악력 ${one(pair.first)} → ${one(pair.now)}kg · +${one(d)}kg`,
      ratio: clamp01(pct / STRENGTH_MAX_PCT),
      gold: sure,
      sure,
      steady: false,
      basis: [rec, { k: "계산", v: `늘어난 ${one(d)}kg ÷ 처음 ${one(pair.first)}kg = ${formatPct(pct)}%` }, sureLine],
      measure: "body",
    };
  }

  const pct = i.gains.strengthPct;
  const s = ENDURANCE_STUDY;
  const basis: GainBasis[] = [
    GRIP_WHAT,
    {
      k: "연구",
      v: `킥복싱 + 맨몸 운동 ${s.weeks}주 — 이미 훈련하던 선수도 악력 +${s.gripPct}% (Kahraman 외 2025). 처음 운동하는 사람은 근력이 더 크게 느는 편이에요 (미국스포츠의학회 근력 운동 권고 2009)`,
    },
    ...doseBasis({ dose: i.gains.muscleDose, pct, cap: STRENGTH_MAX_PCT, unit: MUSCLE_UNIT, capWhy: "보수적으로 잡은 153 가정", preview: !!i.preview }),
  ];
  let numbers: string | null = null;
  const single = i.preview ? null : singleOf(i.grip);
  if (single && estPctValue(pct) > 0) {
    const at = estPctValue(saturatingPct(STRENGTH_MAX_PCT, muscleDoseWeeks(until(i.days, single.on))));
    const start = single.value / (1 + at / 100);
    const now = (single.value * (1 + estPctValue(pct) / 100)) / (1 + at / 100);
    numbers = `악력 ${one(start)} → ${one(now)}kg · +${one(now - start)}kg`;
    basis.push({
      k: "기준 값",
      v: `${md(single.on)}에 잰 ${one(single.value)}kg에서 그때까지 운동한 만큼(+${estPctText(at)}%)을 빼 처음을, 그 뒤 운동한 만큼을 더해 지금을 어림했어요`,
    });
    basis.push({ k: "직접 재려면", v: "4주쯤 지나 한 번 더 재면 실측으로 바뀌어요 — 악력계로 좌우 2번씩 재서 가장 높은 값" });
  } else {
    const mean = !i.preview && i.sex && i.band ? groupMean("grip", i.sex, i.band) : null;
    if (mean != null && estPctValue(pct) > 0) {
      numbers = `같은 나이 평균 ${one(mean)}kg이라면 +${one((mean * estPctValue(pct)) / 100)}kg`;
      basis.push({ k: "평균이라면", v: `국민체력100 ${bandLabel(i.band!)} ${sexLabel(i.sex!)} 평균 악력 ${one(mean)}kg을 기준으로 바꾼 숫자예요 — 내 악력을 재면 내 숫자로 바뀌어요` });
    } else if (!i.preview) {
      numbers = "악력(쥐는 힘) 기준";
    }
    basis.push({ k: "직접 재려면", v: "악력계로 좌우 2번씩 재서 가장 높은 값을 넣고, 4주쯤 지나 한 번 더 재면 실측으로 바뀌어요" });
  }
  const ratio = clamp01(pct / STRENGTH_MAX_PCT);
  return { key: "strength", label: "근력", source: "estimate", value: `+${estPctText(pct)}%`, numbers, ratio, gold: ratio >= 0.8, sure: false, steady: false, basis, measure: "body" };
}

/** 153 PB 총 시간 — 같은 부문 완주 기록의 첫 날 · 최고 날 */
function pbDates(records: readonly PbRecordLike[] | null | undefined, division: string): { firstAt: string | null; bestAt: string | null } {
  const rows = (records ?? [])
    .filter((r) => r && r.finished && r.division === division && fin(r.score_ms) && r.score_ms > 0)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  if (!rows.length) return { firstAt: null, bestAt: null };
  let best = rows[0];
  for (const r of rows) if (r.score_ms < best.score_ms) best = r;
  return { firstAt: rows[0].measured_at, bestAt: best.measured_at };
}

function fitnessRow(i: BodyGainsInput): GainRow {
  const pb = i.preview ? null : pbView(i.pbRecords);
  if (pb && pb.finishedCount >= 2) {
    const { firstAt, bestAt } = pbDates(i.pbRecords, pb.division);
    const div = DIVISION_LABEL[pb.division as Test153Division] ?? pb.division;
    const rec = {
      k: "잰 기록",
      v: `153 PB(${div}) 첫 완주 ${md(firstAt)} ${fmtMs(pb.firstMs)} → 최고 ${md(bestAt)} ${fmtMs(pb.bestMs)} · 완주 ${pb.finishedCount}번`,
    };
    const sureLine = {
      k: "확실한 변화",
      v: `비슷한 서킷 운동 기록은 같은 사람이 다른 날 해도 4~7%씩 달라져요 (Engel 외 2019, Frontiers in Physiology). 그래서 ${SURE_PB_PCT}% 넘게 빨라지면 확실한 변화로 봐요`,
    };
    if (pb.improvedMs == null) {
      return {
        key: "fitness",
        label: "체력",
        source: "measured",
        value: "유지",
        numbers: `153 PB 완주 ${pb.finishedCount}번 · 첫 기록과 비슷해요`,
        ratio: null,
        gold: false,
        sure: false,
        steady: true,
        basis: [rec, { k: "유지", v: "첫 기록과 거의 같아 '유지'로 보여 드려요" }, sureLine],
        measure: "pb",
      };
    }
    const pct = pb.firstMs > 0 ? (pb.improvedMs / pb.firstMs) * 100 : 0;
    const sure = pct >= SURE_PB_PCT;
    return {
      key: "fitness",
      label: "체력",
      source: "measured",
      value: `${formatPct(pct)}% 빨라짐`,
      // 최고 기록은 아래 '지금까지 이룬 것'이 보여 줘서 여기서는 첫 기록과 줄어든 시간만 (같은 숫자는 한 번)
      numbers: `153 PB 첫 완주 ${fmtMs(pb.firstMs)}보다 ${spokenDuration(pb.improvedMs)} 단축`,
      ratio: clamp01(pct / AREA_BAR_FULL_PCT),
      gold: sure,
      sure,
      steady: false,
      basis: [
        rec,
        { k: "계산", v: `줄어든 ${spokenDuration(pb.improvedMs)} ÷ 첫 기록 ${fmtMs(pb.firstMs)} = ${formatPct(pct)}% 빨라졌어요` },
        sureLine,
        { k: "참고", v: "처음 한두 번은 코스에 익숙해져 빨라지는 몫도 있어요" },
      ],
      measure: "pb",
    };
  }
  const g = i.gains;
  const avgCap = (CARDIO_MAX_PCT + ENDURANCE_MAX_PCT + STRENGTH_MAX_PCT) / 3;
  const ratio = clamp01(g.fitnessPct / avgCap);
  return {
    key: "fitness",
    label: "체력",
    source: "estimate",
    value: `+${estPctText(g.fitnessPct)}%`,
    numbers: i.preview ? null : "심폐 · 근지구력 · 근력 세 가지 평균",
    ratio,
    gold: ratio >= 0.8,
    sure: false,
    steady: false,
    basis: [
      { k: "무엇", v: "심폐지구력 · 근지구력 · 근력 세 가지 추정의 평균이에요" },
      { k: "직접 재려면", v: "153 PB(16구간 서킷)를 두 번 재면 실제로 빨라진 기록(실측)으로 바뀌어요" },
    ],
    measure: "pb",
  };
}

const PP_LINE = (from: number, to: number) => ({ k: "%p", v: `퍼센트끼리의 차이예요 — ${one(from)}%에서 ${one(to)}%가 되면 ${one(Math.abs(from - to))}%p` });

function bodyFatRow(i: BodyGainsInput): GainRow | null {
  const pair = i.preview ? null : pairOf(i.bodyFat);
  if (pair) {
    const d = pair.first - pair.now; // + = 내려감
    const rec = { k: "잰 기록", v: `${md(pair.firstOn)} ${one(pair.first)}% → ${md(pair.on)} ${one(pair.now)}%` };
    const sureLine = {
      k: "확실한 변화",
      v: `체지방률(인바디)은 다른 날 다시 재면 1%p 안팎 달라져요. ${SURE_BODY_FAT_PP}%p 넘게 내려가면 확실한 변화로 봐요 (Siedler 외 2021 — InBody 770 날마다 오차)`,
    };
    const tip = { k: "참고", v: "같은 기계로, 같은 시간(아침 공복)에 재면 더 정확해요" };
    if (d <= -SURE_BODY_FAT_PP) return null;
    if (d < 0.1) {
      return {
        key: "bodyFat",
        label: "체지방률",
        source: "measured",
        value: "유지",
        numbers: `체지방률 최근 ${one(pair.now)}%`,
        ratio: null,
        gold: false,
        sure: false,
        steady: true,
        basis: [rec, { k: "유지", v: `처음과 차이가 ${SURE_BODY_FAT_PP}%p 안이라 '유지'로 보여 드려요` }, sureLine, tip],
        measure: "body",
      };
    }
    const sure = d >= SURE_BODY_FAT_PP;
    return {
      key: "bodyFat",
      label: "체지방률",
      source: "measured",
      value: `-${one(d)}%p`,
      numbers: `체지방률 ${one(pair.first)}% → ${one(pair.now)}%`,
      ratio: clamp01(d / BODY_FAT_MAX_PP),
      gold: sure,
      sure,
      steady: false,
      basis: [rec, PP_LINE(pair.first, pair.now), sureLine, tip],
      measure: "body",
    };
  }

  const pp = i.gains.bodyFatPp;
  const basis: GainBasis[] = [
    {
      k: "연구",
      v: `과체중 성인 ${BODY_FAT_STUDY.trials}개 실험 모음 — 유산소 운동 주 30분마다 체지방률 −${BODY_FAT_STUDY.perHalfHour}%p, 주 150분이면 약 −2%p (Jayedi 외 2024, JAMA Network Open)`,
    },
    ...doseBasis({ dose: i.gains.cardioDose, pct: pp, cap: BODY_FAT_MAX_PP, unit: CARDIO_UNIT, capWhy: "주 150분 연구 결과 · 식단 조절 없이 운동만", preview: !!i.preview, pp: true }),
  ];
  let numbers: string | null = null;
  const single = i.preview ? null : singleOf(i.bodyFat);
  if (single && ppValue(pp) > 0) {
    const at = ppValue(saturatingPct(BODY_FAT_MAX_PP, cardioDoseWeeks(until(i.days, single.on))));
    const start = single.value + at;
    const now = single.value - (ppValue(pp) - at);
    numbers = `체지방률 ${one(start)}% → ${one(now)}%`;
    basis.push({
      k: "기준 값",
      v: `${md(single.on)}에 잰 ${one(single.value)}%에 그때까지 운동한 만큼(−${ppText(at)}%p)을 더해 처음을, 그 뒤 운동한 만큼을 빼 지금을 어림했어요`,
    });
    basis.push(PP_LINE(start, now));
    basis.push({ k: "직접 재려면", v: "4주쯤 지나 인바디로 한 번 더 재서 넣으면 실측으로 바뀌어요" });
  } else {
    const mean = !i.preview && i.sex && i.band ? groupMean("bodyFat", i.sex, i.band) : null;
    if (mean != null && ppValue(pp) > 0) {
      numbers = `같은 나이 평균 ${one(mean)}%라면 → ${one(mean - ppValue(pp))}%`;
      basis.push({ k: "평균이라면", v: `국민체력100 ${bandLabel(i.band!)} ${sexLabel(i.sex!)} 평균 체지방률 ${one(mean)}%를 기준으로 바꾼 숫자예요 — 인바디로 재면 내 숫자로 바뀌어요` });
      basis.push(PP_LINE(mean, mean - ppValue(pp)));
    } else if (!i.preview) {
      numbers = "인바디 체지방률 기준";
    }
    basis.push({ k: "직접 재려면", v: "인바디 체지방률을 내 신체 정보에 넣으면 실측으로 바뀌어요 (두 번째부터 처음 → 지금)" });
  }
  const ratio = clamp01(pp / BODY_FAT_MAX_PP);
  return {
    key: "bodyFat",
    label: "체지방률",
    source: "estimate",
    value: ppValue(pp) > 0 ? `-${ppText(pp)}%p` : "0%p",
    numbers,
    ratio,
    gold: ratio >= 0.8,
    sure: false,
    steady: false,
    basis,
    measure: "body",
  };
}

/** 몸무게 — 잰 값이 줄었을 때만 (처음 → 최근, 0.1kg 넘게) */
function weightRow(i: BodyGainsInput): GainRow | null {
  const pair = i.preview ? null : pairOf(i.weight);
  if (!pair) return null;
  const d = Math.round((pair.first - pair.now) * 10) / 10;
  if (d < 0.1) return null;
  return {
    key: "weight",
    label: "몸무게",
    source: "measured",
    value: `-${one(d)}kg`,
    numbers: `몸무게 ${one(pair.first)} → ${one(pair.now)}kg`,
    ratio: null,
    gold: false,
    sure: false,
    steady: false,
    basis: [
      { k: "잰 기록", v: `${md(pair.firstOn)} ${one(pair.first)}kg → ${md(pair.on)} ${one(pair.now)}kg` },
      { k: "참고", v: "몸무게는 하루에도 물 · 음식에 따라 달라져요 — 같은 시간(아침 공복)에 재면 더 정확해요" },
    ],
    measure: "body",
  };
}

/** 줄 목록 — 심폐지구력 · 근지구력 · 근력 · 체력 · 체지방률 · 몸무게 (그리지 않는 줄은 빠진다) */
export function bodyGainRows(i: BodyGainsInput): GainRow[] {
  return [cardioRow(i), enduranceRow(i), strengthRow(i), fitnessRow(i), bodyFatRow(i), weightRow(i)].filter((r): r is GainRow => r != null);
}
