/**
 * 💓 체력 나이 · 심폐 체력(추정) — 「같은 나이와 비교」 넓히기 (2026-11-13 대표님 「심폐지구력 근력 건강나이등등도 모두 같은나이 평균과
 *   비교해서 우리목적은 회원님들의 동기부여와 153복싱짐의 가치전달이야 그걸 통해 회원님들이 153복싱짐은 가치있다를 느껴야해」)
 *
 *   운동 검사 없이 어림한다 — 같은 나이 · 성별 국민체력100 가운데 값(data/nfaNorms 표 7)에서 시작해,
 *   나와 '그 나이 보통 사람'의 차이만큼 더하고 뺀다. 차이의 크기 = 이인환 · 한권석 · 송문구 · 강현식(2022)
 *   「우리나라 대학생의 비운동성 심폐체력 추정식 개발 및 타당도 검증」 대한스포츠의학회지 40(1):39–48 — 한국 대학생 1,162명을
 *   러닝머신 최대 검사(가스 분석)로 잰 체지방률 식(R² 0.514 · 오차 5.48):
 *     · 권장 운동량을 채움(주 600 MET·분 넘게 3개월) +3.513 · 체지방률 1%p 마다 −0.411 · 안정시 심박 1회 마다 −0.048 · 나이 1살 마다 −0.308
 *   '보통 사람' = 같은 나이 · 성별 한국인 중 권장 운동량을 채우는 비율(data/knhanesActivity — 국민건강영양조사 2025) ·
 *     체지방률은 국민체력100 가운데 값(표 2) · 안정시 심박 70(국민건강영양조사 2015~2018 가운데 68~71회).
 *   권장 운동량을 채움 = 지난 4주(이번 주 포함) 중 3주 이상 주 500 MET·분(앱의 권장 운동량 — 153 기본 수업 2번)을 153 출석으로 채움.
 *     (연구 기준은 주 600 MET·분 · 국민건강영양조사는 중강도 주 150분 — 같은 지침을 재는 숫자라 앱의 권장 운동량 하나로 맞췄다.
 *      153 밖에서 한 운동은 모른다 → 적게 잡는 쪽)
 *   체력 나이 = 나이 − (내 추정 − 가운데 값) ÷ 0.308 · 20세 아래로는 말하지 않는다 · 젊은 만큼은 내림(넉넉하게 말하지 않게).
 *   심폐 체력 상위 %는 추정이라 5% 단위로 올림.
 *   문구 원칙 — '153과 함께하며' · 「같은 나이와 비교」와 같다: 잘한 것만(나이 든 쪽은 숫자로 말하지 않고 다음 목표로) · 진단 표현 없음.
 *   DB 를 바꾸지 않는다 — 출석 기록 · 성별 · 출생 연도 · 체지방률 · 안정시 심박은 이미 읽는 함수 그대로, 계산은 화면에서.
 */
import { NFA_BODY_FAT, NFA_VO2MAX, type NormBand, type NormSex } from "@/data/nfaNorms";
import { KNHANES_AEROBIC_PCT, knhanesBand, knhanesBandLabel } from "@/data/knhanesActivity";
import { DEFAULT_SESSION_MINUTES, RECOMMENDED_WEEKLY_MET_MINUTES, dayMetMinutes, weekMonday } from "@/lib/achievement153";
import {
  LEAN_FLOOR_PCT,
  PEER_METRIC_ORDER,
  ageBand,
  ageOn,
  buildPeerCompare,
  percentileBelow,
  sexLabel,
  type PeerCompare,
  type PeerCompareInput,
  type PeerMetricResult,
} from "@/lib/peerCompare153";

/** 이인환 외(2022) 체지방률 식의 계수 — mL/kg/분 */
export const LEE2022 = { activity: 3.513, bodyFat: 0.411, restHr: 0.048, age: 0.308 } as const;
/** '보통 사람' 안정시 심박 — 국민건강영양조사 2015~2018 가운데(5분위 중간 68~71회) */
export const REF_REST_HR = 70;
/** 지난 몇 주를 보나 · 그중 몇 주를 채워야 '권장 운동량을 채움' */
export const ACTIVITY_WEEKS = 4;
export const ACTIVE_WEEKS_NEEDED = 3;
/** 체력 나이는 이 나이 아래로 말하지 않는다 (기준표 · 연구 모두 성인부터) */
export const FITNESS_AGE_MIN = 20;
/** 심폐 기준표(표 7)는 64세까지 */
export const CARDIO_MAX_AGE = 64;
/** '처음보다'는 첫 출석 뒤 8주가 지나야 (처음 4주와 지금 4주가 겹치지 않게) */
export const FIRST_COMPARE_MIN_DAYS = 56;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 'YYYY-MM-DD' + n일 (달력 날짜만 — 시간대 없이) */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/** 두 날짜 사이 날 수 (b − a) */
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((tb - ta) / 86_400_000);
}

/* ───────────── 권장 운동량 — 지난 4주 ───────────── */

export interface ActivityWeek {
  /** 그 주 월요일 */
  monday: string;
  /** 그 주 MET·분 (153 출석) */
  met: number;
  /** 권장 운동량(주 500 MET·분)을 채움 */
  done: boolean;
}

export interface ActivityStatus {
  /** 오래된 주 → 이번 주 (4칸) */
  weeks: ActivityWeek[];
  /** 4주 중 채운 주 */
  weeksMet: number;
  /** 4주 중 3주 이상 — 권장 운동량을 채우는 사람 */
  active: boolean;
  thisWeekDone: boolean;
  /** 이번 주 권장 운동량까지 남은 기본 수업(66분) 횟수 — 채웠으면 0 */
  thisWeekVisitsLeft: number;
}

/** 기준 날(오늘)이 든 주와 앞 3주 — 날마다 운동 시간(분)으로 (같은 날 여러 줄이면 가장 긴 것) */
export function activityStatus(days: readonly { day: string; minutes: number }[], refDay: string): ActivityStatus {
  const thisMonday = weekMonday(refDay) ?? refDay;
  const mondays = Array.from({ length: ACTIVITY_WEEKS }, (_, i) => addDays(thisMonday, -7 * (ACTIVITY_WEEKS - 1 - i)));
  const first = mondays[0];
  const perDay = new Map<string, number>();
  for (const d of days) {
    if (!isYmd(d.day) || d.day < first || d.day > refDay) continue;
    const m = Number.isFinite(d.minutes) ? Math.max(0, d.minutes) : 0;
    perDay.set(d.day, Math.max(perDay.get(d.day) ?? 0, m));
  }
  const metByWeek = new Map<string, number>(mondays.map((m) => [m, 0]));
  for (const [day, minutes] of perDay) {
    const mon = weekMonday(day);
    if (mon && metByWeek.has(mon)) metByWeek.set(mon, (metByWeek.get(mon) ?? 0) + dayMetMinutes(minutes));
  }
  const weeks = mondays.map((monday) => {
    const met = Math.round((metByWeek.get(monday) ?? 0) * 10) / 10;
    return { monday, met, done: met >= RECOMMENDED_WEEKLY_MET_MINUTES };
  });
  const weeksMet = weeks.filter((w) => w.done).length;
  const thisWeek = weeks[weeks.length - 1];
  const perVisit = dayMetMinutes(DEFAULT_SESSION_MINUTES);
  return {
    weeks,
    weeksMet,
    active: weeksMet >= ACTIVE_WEEKS_NEEDED,
    thisWeekDone: thisWeek.done,
    thisWeekVisitsLeft: thisWeek.done ? 0 : Math.max(1, Math.ceil((RECOMMENDED_WEEKLY_MET_MINUTES - thisWeek.met) / perVisit)),
  };
}

/** 같은 나이(· 성별) 한국인 중 권장 운동량을 채우는 비율(%) — 국민건강영양조사. 19세 아래는 null */
export function koreaActivePct(sex: NormSex | null | undefined, age: number): number | null {
  const band = knhanesBand(age);
  if (!band) return null;
  return KNHANES_AEROBIC_PCT[sex === "남" || sex === "여" ? sex : "전체"][band];
}

/** '30대 여성' · '30대'(성별을 모를 때) · '19~29세 남성' */
export function koreaGroupLabel(sex: NormSex | null | undefined, age: number): string | null {
  const band = knhanesBand(age);
  if (!band) return null;
  const b = knhanesBandLabel(band);
  return sex === "남" || sex === "여" ? `${b} ${sexLabel(sex)}` : b;
}

/* ───────────── 심폐 체력 추정 ───────────── */

export interface CardioInput {
  sex: NormSex;
  age: number;
  /** 권장 운동량을 채우는 사람 (activityStatus().active) */
  active: boolean;
  bodyFatPct?: number | null;
  restHr?: number | null;
}

export interface CardioParts {
  /** 권장 운동량 몫 (채웠으면 +, 아니면 −) */
  activity: number;
  /** 체지방률 몫 — 안 넣었으면 null */
  bodyFat: number | null;
  /** 안정시 심박 몫 — 안 넣었으면 null */
  restHr: number | null;
}

export interface CardioEstimate {
  band: NormBand;
  /** 같은 나이 · 성별 가운데 값 (국민체력100 표 7 50번째) */
  median: number;
  /** 내 추정 최대산소섭취량 (mL/kg/분) */
  est: number;
  /** est − median */
  delta: number;
  parts: CardioParts;
  /** '보통 사람'이 권장 운동량을 채우는 비율 (%) */
  activePct: number;
  /** 체지방률 '보통 사람' 값 (국민체력100 표 2 50번째) */
  bodyFatRef: number;
  /** 상위 몇 % — 추정이라 5% 단위로 올림 (5~95) */
  topPct: number;
  topRaw: number;
  /** 가운데 값보다 높거나 같음 */
  atOrAboveAvg: boolean;
  /** 막대 위치 0~100 (오른쪽이 앞) — 나 · 가운데 */
  barMe: number;
  barAvg: number;
}

const validBodyFat = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 3 && v <= 60;
const validRestHr = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 35 && v <= 120;

/** 같은 나이 · 성별 안 심폐 체력 위치(추정) — 19세 아래 · 65세 이상(기준표 없음)은 null */
export function cardioEstimate(i: CardioInput): CardioEstimate | null {
  const band = ageBand(i.age);
  if (!band || i.age > CARDIO_MAX_AGE) return null;
  const row = NFA_VO2MAX[i.sex]?.find((r) => r.band === band);
  const fatRow = NFA_BODY_FAT[i.sex]?.find((r) => r.band === band);
  const activePct = koreaActivePct(i.sex, i.age);
  if (!row || !fatRow || activePct == null) return null;
  const median = row.p[9];
  const bodyFatRef = fatRow.p[9];
  const activity = LEE2022.activity * ((i.active ? 1 : 0) - activePct / 100);
  const bodyFat = validBodyFat(i.bodyFatPct) ? -LEE2022.bodyFat * (Math.max(i.bodyFatPct, LEAN_FLOOR_PCT[i.sex]) - bodyFatRef) : null;
  const restHr = validRestHr(i.restHr) ? -LEE2022.restHr * (i.restHr - REF_REST_HR) : null;
  const delta = activity + (bodyFat ?? 0) + (restHr ?? 0);
  const est = median + delta;
  const below = percentileBelow(est, row.p);
  const topRaw = 100 - below;
  return {
    band,
    median,
    est,
    delta,
    parts: { activity, bodyFat, restHr },
    activePct,
    bodyFatRef,
    topPct: clamp(Math.ceil(topRaw / 5 - 1e-9) * 5, 5, 95),
    topRaw,
    atOrAboveAvg: delta >= 0,
    barMe: below,
    barAvg: 50,
  };
}

/* ───────────── 체력 나이 ───────────── */

export type FitnessPartKey = keyof CardioParts;

export interface FitnessAge {
  age: number;
  /** 보여 줄 체력 나이 (= 나이 − younger) */
  fitnessAge: number;
  /** 몇 살 젊은가 — 내림 · 20세 아래로는 말하지 않음 (0 이하 = 젊지 않음) */
  younger: number;
  /** 젊은 만큼(해) — 내림 전 */
  youngerRaw: number;
  /** 계산이 20세 아래로 나와 20세로 말함 */
  floored: boolean;
  /** 몫마다 젊어진 해 (+ = 젊게, − = 나이 들게) — 넣은 것만 */
  parts: { key: FitnessPartKey; years: number }[];
}

export function fitnessAgeOf(age: number, c: CardioEstimate): FitnessAge {
  const youngerRaw = c.delta / LEE2022.age;
  const raw = age - youngerRaw;
  const floored = raw < FITNESS_AGE_MIN;
  const shown = Math.max(raw, FITNESS_AGE_MIN);
  const younger = Math.floor(age - shown + 1e-9);
  const parts: FitnessAge["parts"] = [{ key: "activity", years: c.parts.activity / LEE2022.age }];
  if (c.parts.bodyFat != null) parts.push({ key: "bodyFat", years: c.parts.bodyFat / LEE2022.age });
  if (c.parts.restHr != null) parts.push({ key: "restHr", years: c.parts.restHr / LEE2022.age });
  return { age, fitnessAge: age - younger, younger, youngerRaw, floored, parts };
}

/* ───────────── 모아서 — 카드 한 장 ───────────── */

export interface BodyCompareInput extends PeerCompareInput {
  /** 출석 기록 — 날짜 · 그날 운동 시간(분) (lib/attendanceHistory list) */
  days: readonly { day: string; minutes: number }[];
  /** 첫 출석 날 — '처음보다' */
  firstDay?: string | null;
  /** 안정시 심박 (회/분) — 내 신체 정보 */
  restHr?: number | null;
}

export type HeroChoice =
  | { kind: "fitnessAge" }
  | { kind: "metric"; metric: PeerMetricResult }
  | { kind: "goal" }
  | null;

export interface BodyCompare {
  peer: PeerCompare;
  activity: ActivityStatus;
  /** 같은 나이(· 성별) 한국인 중 권장 운동량을 채우는 비율 — 나이를 모르면 null */
  activePct: number | null;
  /** '30대 여성' · '30대' */
  activeGroupLabel: string | null;
  cardio: CardioEstimate | null;
  fitness: FitnessAge | null;
  /** 처음보다 체력 나이 — 젊어진 해(내림)가 1 이상일 때만 */
  fitnessFirst: { fitnessAge: number; gain: number } | null;
  /** 아직 권장 운동량을 못 채울 때 — 채우면 몇 살 젊은 체력인지 (1 이상일 때만) */
  goalYears: number | null;
  hero: HeroChoice;
  invite: string | null;
}

/** 첫 출석 뒤 4주(그때 나이 · 첫 체지방률)로 다시 센 체력 나이 — 8주가 안 지났거나 셀 수 없으면 null */
function fitnessThen(input: BodyCompareInput, sex: NormSex, birthYear: number): { fitnessAge: number } | null {
  const first = input.firstDay;
  if (!isYmd(first) || daysBetween(first, input.today) < FIRST_COMPARE_MIN_DAYS) return null;
  const ref = addDays(first, ACTIVITY_WEEKS * 7 - 1);
  const ageThen = ageOn(birthYear, ref, input.today);
  const fat = input.bodyFat;
  const fatThen = fat?.firstPct ?? fat?.pct ?? null;
  const c = cardioEstimate({ sex, age: ageThen, active: activityStatus(input.days, ref).active, bodyFatPct: fatThen, restHr: input.restHr });
  if (!c) return null;
  return { fitnessAge: fitnessAgeOf(ageThen, c).fitnessAge };
}

export function buildBodyCompare(input: BodyCompareInput): BodyCompare {
  const peer = buildPeerCompare(input);
  const activity = activityStatus(input.days, input.today);
  const age = peer.age;
  const sex = peer.sex;
  const activePct = age != null ? koreaActivePct(sex, age) : null;
  const activeGroupLabel = age != null ? koreaGroupLabel(sex, age) : null;

  let cardio: CardioEstimate | null = null;
  let fitness: FitnessAge | null = null;
  let fitnessFirst: BodyCompare["fitnessFirst"] = null;
  let goalYears: number | null = null;
  if (peer.canCompare && sex && age != null && typeof input.birthYear === "number") {
    cardio = cardioEstimate({ sex, age, active: activity.active, bodyFatPct: input.bodyFat?.pct ?? null, restHr: input.restHr });
    if (cardio) {
      fitness = fitnessAgeOf(age, cardio);
      // 처음보다 — 화면에 보이는 두 체력 나이의 차이 그대로 (처음엔 37세 → 지금 30세 = 7살)
      const then = fitnessThen(input, sex, input.birthYear);
      if (then && fitness.younger >= 1) {
        const gain = then.fitnessAge - fitness.fitnessAge;
        if (gain >= 1) fitnessFirst = { fitnessAge: then.fitnessAge, gain };
      }
      if (!activity.active) {
        const y = Math.floor((cardio.delta + LEE2022.activity) / LEE2022.age + 1e-9);
        const shown = Math.min(y, age - FITNESS_AGE_MIN);
        if (shown >= 1) goalYears = shown;
      }
    }
  }

  let hero: HeroChoice = null;
  if (fitness && fitness.younger >= 1) hero = { kind: "fitnessAge" };
  else if (peer.hero) hero = { kind: "metric", metric: peer.hero };
  else if (goalYears != null) hero = { kind: "goal" };

  return { peer, activity, activePct, activeGroupLabel, cardio, fitness, fitnessFirst, goalYears, hero, invite: bodyInviteText(peer) };
}

/* ───────────── 화면 문구 ───────────── */

const one = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const ceil1 = (v: number) => Math.ceil(v * 10 - 1e-9) / 10;

/** 심폐 체력 오른쪽 짧은 글 — '상위 35%' · '상위 5% 안' · 가운데 아래면 '다음 목표' */
export function cardioShort(c: CardioEstimate): string {
  if (!c.atOrAboveAvg) return "다음 목표";
  return c.topPct <= 5 ? "상위 5% 안" : `상위 ${c.topPct}%`;
}

/** 심폐 체력이 가운데 아래일 때 — 할 수 있는 다음 한 걸음 (가운데 위면 null) */
export function cardioNextStep(c: CardioEstimate, active: boolean): string | null {
  if (c.atOrAboveAvg) return null;
  if (!active) {
    return c.delta + LEE2022.activity >= 0 ? "주 2번씩, 4주 중 3주를 채우면 평균을 넘어요" : "주 2번씩, 4주 중 3주를 채우면 평균에 가까워져요";
  }
  if (c.parts.bodyFat != null && c.parts.bodyFat < 0) {
    const drop = ceil1(-c.delta / LEE2022.bodyFat);
    return `체지방률을 ${one(drop)}%p 내리면 평균을 넘어요`;
  }
  return "꾸준히 이어 가면 올라가요";
}

/** 체력 나이 몫 이름표 — '153 운동 −6살' · '체지방률 −2살' (젊게 만든 몫만, 1살 아래는 빼고) */
export function fitnessPartChips(f: FitnessAge): { key: FitnessPartKey; text: string }[] {
  const label: Record<FitnessPartKey, string> = { activity: "153 운동", bodyFat: "체지방률", restHr: "안정시 심박" };
  return f.parts
    .map((p) => ({ key: p.key, years: Math.floor(p.years + 1e-9) }))
    .filter((p) => p.years >= 1)
    .map((p) => ({ key: p.key, text: `${label[p.key]} −${p.years}살` }));
}

/** '100명 중 46명' — 같은 나이 한국인 중 권장 운동량을 채우는 사람 */
export const peopleOf100 = (pct: number): string => `100명 중 ${Math.round(pct)}명`;

/** 4주 중 채운 주 — '4주 중 3주' */
export const weeksMetText = (a: ActivityStatus): string => `${ACTIVITY_WEEKS}주 중 ${a.weeksMet}주`;

/** 다음 목표(주인공) 아래 한 줄 — '지금 4주 중 1주 채웠어요 · 이번 주 1번 더' */
export function goalProgressText(a: ActivityStatus): string {
  const head = a.weeksMet > 0 ? `지금 ${weeksMetText(a)} 채웠어요` : "이번 주부터 시작해요";
  return a.thisWeekDone ? `${head} · 이번 주는 채웠어요` : `${head} · 이번 주 ${a.thisWeekVisitsLeft}번 더`;
}

/**
 * 카드 아래 '넣으면 알려 드려요' 한 줄 — 넣을 것이 없으면 null.
 *   성별 · 출생 연도가 먼저(체력 나이의 바탕) → 체지방률(체력 나이가 더 정확해짐) → 악력(근력 비교).
 *   65세 이상은 심폐 기준표가 없어 예전 글(같은 나이 비교 · 100명 중 몇 번째).
 */
export function bodyInviteText(c: PeerCompare): string | null {
  if (c.tooYoung) return null;
  const cardioAge = c.age == null || c.age <= CARDIO_MAX_AGE;
  if (!c.canCompare) {
    const what = c.missing.includes("gender") && c.missing.includes("age") ? "성별 · 출생 연도를" : c.missing.includes("gender") ? "성별을" : "출생 연도를";
    return cardioAge ? `${what} 넣으면 체력 나이를 알려 드려요` : `${what} 넣으면 같은 나이 한국인과 비교해 드려요`;
  }
  const left = PEER_METRIC_ORDER.filter((k) => c.missing.includes(k));
  if (!left.length) return null;
  if (cardioAge) {
    if (left.includes("bodyFat")) return "체지방률(인바디)을 넣으면 체력 나이가 더 정확해져요";
    return "악력도 재서 넣으면 근력도 같이 비교해 드려요";
  }
  if (!c.metrics.length) return "체지방률(인바디) · 악력을 넣으면 같은 나이 100명 중 몇 번째인지 알려 드려요";
  return left[0] === "grip" ? "악력도 재서 넣으면 같이 비교해 드려요" : "체지방률(인바디)도 넣으면 같이 비교해 드려요";
}
