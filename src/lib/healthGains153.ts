/**
 * 💚 운동이 내게 준 것 — 건강 수명 · 심폐지구력 · 근력 · 행복도 (2026-10-22 대표님)
 *   "운동하길 잘했다고 느껴질 수 있고 지속하는 힘이 될 수 있도록 — 건강 수명이 얼마나 올랐고,
 *    근력이 얼마나 늘었고, 심폐지구력이 얼마나 좋아졌고, 행복도가 얼마나 올라갔는지"
 *   → "네 가지 모두 숫자로 하되, 개인 상태에 따라 다를 수 있다고 하자" (대표님 확정)
 *
 *   앱이 몸을 직접 재지 않으므로 전부 '연구 평균으로 추정'이다. 화면에도 늘 그렇게 쓴다.
 *   숫자는 이 파일 한 곳 — 홈 카드 · 오삼이 설명이 같은 값을 쓴다. 진단 · 처방 · 의료 표현은 쓰지 않는다.
 *
 *   ① 건강 수명(기대 수명) — 운동 1시간 ≈ 7시간 (최대 약 3.2년)
 *      Lee DC 외, Progress in Cardiovascular Diseases 2017 — 달리기 4,000시간 ≈ 기대 수명 3.2년(약 28,000시간).
 *      Wen CP 외, Lancet 2011 — 하루 15분 중강도 운동만으로 기대 수명 약 3년 (같은 범위).
 *   ② 심폐지구력(최대산소섭취량) — 꾸준히 한 주가 쌓일수록 최대 +15%까지 (8주에 약 63%, 16주에 약 86%)
 *      Milanović Z 외, Sports Medicine 2015 — 지속 · 인터벌 유산소 훈련으로 평균 +4.9 mL/kg/min (보통 10~15%).
 *      '꾸준히 한 주' = 권장 운동량(주 500 MET·분 — achievement153 recommendedWeeks)을 채운 주.
 *   ③ 근력(맨몸 근지구력) — 주 2번 이상 온 주가 쌓일수록 최대 +10%까지
 *      킥복싱 선수 맨몸 근력 운동 8주(주 3회) 연구 — 팔굽혀펴기 +6% · 윗몸일으키기 +8% (PMC12781521).
 *      153 수업의 하체 · 코어 서킷을 근거로 보수적으로 잡았다. WHO 권고: 근력 운동 주 2회 이상.
 *   ④ 행복도 — 꾸준히 운동한 달마다 '마음이 힘든 날' 1.5일 줄어든 셈
 *      Chekroud SR 외, Lancet Psychiatry 2018 (미국 120만 명) — 운동하는 사람은 마음이 힘든 날이
 *      한 달에 1.49일(43%) 적었다. 가장 좋았던 건 한 번 45분 · 주 3~5회.
 *      '꾸준히 운동한 달' = 한 달에 4번 이상(주 1번 꼴) 온 달.
 *   ⑤ 153 PB(실측) — 첫 완주 기록보다 빨라진 비율. 추정이 아니라 실제로 잰 값이라 따로 보여 준다.
 */
import { pbView, recommendedWeeks, weekMonday, type PbRecordLike } from "@/lib/achievement153";

/** 운동 1시간 → 기대 수명 몇 시간 (Lee 2017) */
export const LIFE_HOURS_PER_EXERCISE_HOUR = 7;
/** 기대 수명이 느는 상한 — 약 3.2년 (Lee 2017) */
export const LIFE_GAIN_CAP_DAYS = Math.round(3.2 * 365);
/** 꾸준히 운동한 달마다 줄어드는 '마음이 힘든 날' (Chekroud 2018 — 1.49일) */
export const MOOD_DAYS_PER_ACTIVE_MONTH = 1.5;
/** '꾸준히 운동한 달' — 한 달에 이만큼 이상 온 달 */
export const ACTIVE_MONTH_MIN_DAYS = 4;
/** 심폐지구력이 좋아지는 상한(%) · 근력 상한(%) */
export const CARDIO_MAX_PCT = 15;
export const STRENGTH_MAX_PCT = 10;
/** 좋아지는 속도 — 이 주 수만큼 쌓이면 상한의 약 63% */
export const GAIN_TAU_WEEKS = 8;
/** 근력 — 한 주에 이만큼 이상 온 주를 센다 (WHO: 근력 운동 주 2회) */
export const STRENGTH_WEEK_MIN_DAYS = 2;

/** 화면 맨 아래 한 줄 (대표님: "개인 상태에 따라 다를 수 있다고 하자") */
export const HEALTH_GAIN_NOTE = "연구 평균으로 추정한 값이에요 · 개인 상태에 따라 다를 수 있어요";

export interface HealthDay {
  /** 'YYYY-MM-DD' (KST) */
  day: string;
  /** 그날 운동 시간(분) — 서버 workout_minutes */
  minutes: number;
}

const safe = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

/** 늘어난 기대 수명(시간) = 운동 시간 × 7, 최대 약 3.2년 */
export const lifeGainHours = (totalMinutes: number): number =>
  Math.min(LIFE_GAIN_CAP_DAYS * 24, (safe(totalMinutes) / 60) * LIFE_HOURS_PER_EXERCISE_HOUR);

/** 시간 → '7시간' · '35일' · '1.2년' (적게 잡는 쪽으로 내림) */
export function formatLifeGain(hours: number): string {
  const h = safe(hours);
  if (h < 24) return `${Math.floor(h)}시간`;
  const days = Math.floor(h / 24);
  if (days < 365) return `${days.toLocaleString("ko-KR")}일`;
  return `${(Math.floor((days / 365) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}년`;
}

/** 서로 다른 날만 — 같은 날이 두 번 들어와도 한 번 (긴 쪽) */
function uniqueDays(days: readonly HealthDay[]): HealthDay[] {
  const by = new Map<string, number>();
  for (const d of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) continue;
    by.set(d.day, Math.max(by.get(d.day) ?? 0, safe(d.minutes)));
  }
  return [...by.entries()].map(([day, minutes]) => ({ day, minutes }));
}

/** 꾸준히 운동한 달 — 한 달에 4번 이상 온 달 수 */
export function activeMonths(days: readonly HealthDay[]): number {
  const per = new Map<string, number>();
  for (const d of uniqueDays(days)) per.set(d.day.slice(0, 7), (per.get(d.day.slice(0, 7)) ?? 0) + 1);
  return [...per.values()].filter((n) => n >= ACTIVE_MONTH_MIN_DAYS).length;
}

/** 근력 — 한 주(월~일)에 2번 이상 온 주 수 */
export function strengthWeeks(days: readonly HealthDay[]): number {
  const per = new Map<string, number>();
  for (const d of uniqueDays(days)) {
    const wk = weekMonday(d.day);
    if (wk) per.set(wk, (per.get(wk) ?? 0) + 1);
  }
  return [...per.values()].filter((n) => n >= STRENGTH_WEEK_MIN_DAYS).length;
}

/** 쌓인 주에 따라 상한까지 천천히 오르는 값 (처음엔 빨리, 갈수록 천천히) */
export const saturatingPct = (maxPct: number, weeks: number): number =>
  maxPct * (1 - Math.exp(-safe(weeks) / GAIN_TAU_WEEKS));

/** 13.2 → '13' · 1.76 → '1.7' (10% 아래는 소수 한 자리, 내림) */
export function formatPct(p: number): string {
  const v = safe(p);
  return v >= 10 ? String(Math.floor(v)) : (Math.floor(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

export interface HealthGains {
  /** 늘어난 기대 수명(시간) · 표시 글자 */
  lifeHours: number;
  lifeLabel: string;
  /** 꾸준히 한 주(권장 운동량) · 심폐지구력 +% */
  cardioWeeks: number;
  cardioPct: number;
  /** 주 2번 이상 온 주 · 근력 +% */
  strengthWeeks: number;
  strengthPct: number;
  /** 꾸준히 운동한 달 · 줄어든 '마음이 힘든 날' */
  activeMonths: number;
  moodDays: number;
  /** 153 PB 실측 — 첫 완주보다 빨라진 비율(%) · 기록이 2개 미만이거나 안 빨라졌으면 null */
  pbFasterPct: number | null;
}

/** 운동 기록(날마다) + 총 운동 시간 + 153 PB 기록 → 네 가지 추정 + PB 실측 */
export function healthGains(
  days: readonly HealthDay[],
  totalMinutes: number,
  pbRecords?: readonly PbRecordLike[] | null,
): HealthGains {
  const list = uniqueDays(days);
  const lifeHours = lifeGainHours(totalMinutes);
  const cardioWeeks = recommendedWeeks(list);
  const sWeeks = strengthWeeks(list);
  const months = activeMonths(list);
  const pb = pbView(pbRecords);
  const pbFasterPct = pb && pb.improvedMs != null && pb.firstMs > 0 ? (pb.improvedMs / pb.firstMs) * 100 : null;
  return {
    lifeHours,
    lifeLabel: formatLifeGain(lifeHours),
    cardioWeeks,
    cardioPct: saturatingPct(CARDIO_MAX_PCT, cardioWeeks),
    strengthWeeks: sWeeks,
    strengthPct: saturatingPct(STRENGTH_MAX_PCT, sWeeks),
    activeMonths: months,
    moodDays: Math.round(months * MOOD_DAYS_PER_ACTIVE_MONTH),
    pbFasterPct,
  };
}
