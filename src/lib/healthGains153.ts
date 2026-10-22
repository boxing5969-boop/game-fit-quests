/**
 * 💚 153과 함께하며 (처음 이름 '운동이 내게 준 것') — 건강 수명 · 심폐지구력 · 근지구력 · 근력 · 체력 · 체지방률 · 행복도
 *   2026-10-22 대표님 ①: "운동하길 잘했다고 느껴질 수 있고 지속하는 힘이 될 수 있도록 — 건강 수명이 얼마나 올랐고,
 *    근력이 얼마나 늘었고, 심폐지구력이 얼마나 좋아졌고, 행복도가 얼마나 올라갔는지"
 *   → "네 가지 모두 숫자로 하되, 개인 상태에 따라 다를 수 있다고 하자" (대표님 확정)
 *   2026-10-22 대표님 ②: "주 2회 1회 나온 분들도 내가 이렇게 많은 가치를 얻었구나를 느끼고 지속할 수 있도록 —
 *    직관적인 그래프와 % · 손을 뻗은 숫자 · 칼로리 · 심폐 지구력 · 근지구력 · 근력 · 체력 · 체지방률 상세히 + 피드백"
 *   → 주 1번만 와도 쌓이게 '꽉 찬 주'만 세던 것을 '운동한 만큼' 세는 방식(용량 주)으로 바꿨다.
 *
 *   앱이 몸을 직접 재지 않으므로 전부 '연구 평균으로 추정'이다. 화면에도 늘 그렇게 쓴다.
 *   숫자는 이 파일 한 곳 — 홈 카드 · 오삼이 설명이 같은 값을 쓴다. 진단 · 처방 · 의료 표현은 쓰지 않는다.
 *
 *   용량 주(週) — 한 주에 운동한 만큼만 1주로 센다 (최대 1주):
 *     · 심폐 용량 주 = 그 주 MET·분 ÷ 권장량 500 (기본 66분 1번 = 0.8주 · 2번 = 1주) — 체지방률도 이걸로
 *     · 근육 용량 주 = 그 주 온 날 ÷ 2 (1번 = 0.5주 · 2번 이상 = 1주, WHO 근력 운동 주 2회)
 *   좋아지는 정도 = 상한 × (1 - e^(-용량 주 / 8)) — 처음엔 빨리, 갈수록 천천히 (8주에 상한의 약 63%, 16주 86%).
 *
 *   ① 건강 수명(기대 수명) — 운동 1시간 ≈ 7시간 (최대 약 3.2년)
 *      Lee DC 외, Progress in Cardiovascular Diseases 2017 — 달리기 4,000시간 ≈ 기대 수명 3.2년(약 28,000시간).
 *      Wen CP 외, Lancet 2011 — 하루 15분 중강도 운동만으로 기대 수명 약 3년 (같은 범위).
 *   ② 심폐지구력(최대산소섭취량) — 최대 +15%
 *      Milanović Z 외, Sports Medicine 2015 — 지속 · 인터벌 유산소 훈련으로 평균 +4.9 mL/kg/min (보통 10~15%).
 *   ③ 근지구력(팔굽혀펴기 · 윗몸일으키기) — 최대 +10%
 *      Kahraman S 외, BMC Sports Sci Med Rehabil 2025 (PMC12781521) — 킥복싱 + 맨몸 운동 8주(주 3회)
 *      30초 팔굽혀펴기 +6% · 윗몸일으키기 +7.7%.
 *   ④ 근력(악력 · 최대 근력) — 최대 +8%
 *      같은 연구 — 악력 +4% · 벤치프레스 1RM +3.9% · 스쿼트 1RM +3.5% (이미 훈련하던 선수 기준).
 *      처음 시작하는 사람은 보통 더 크게 늘어 상한을 8%로 잡았다 (ACSM 근력 운동 권고 2009 — 초보자 향상이 가장 큼).
 *   ⑤ 체력(종합) — 심폐지구력 · 근지구력 · 근력의 평균
 *   ⑥ 체지방률 — 최대 -2%p (식단 조절 없이 운동만)
 *      Hsu KJ 외 메타분석(15개 연구, 8~24주) — 운동으로 체지방률 -2.31%p · 체지방 -2.99kg.
 *      O'Donoghue G 외 네트워크 메타분석(45개 연구) — 고강도 유산소 + 근력 -2.82%p. 보수적으로 2%p.
 *      태운 지방 = 지금까지 칼로리 ÷ 7,700kcal(지방 1kg 에너지) — '지방 에너지로 환산'이라고 쓴다.
 *      인바디 같은 실측 체지방률이 처음보다 내려갔으면 그 값을 먼저 보여 준다(fitnessProfile153 bodyFatDrop).
 *   ⑦ 행복도 — 꾸준히 운동한 달마다 '마음이 힘든 날' 1.5일 줄어든 셈
 *      Chekroud SR 외, Lancet Psychiatry 2018 (미국 120만 명) — 운동하는 사람은 마음이 힘든 날이
 *      한 달에 1.49일(43%) 적었다. '꾸준히 운동한 달' = 한 달에 4번 이상(주 1번 꼴) 온 달.
 *   ⑧ 153 PB(실측) — 첫 완주 기록보다 빨라진 비율. 추정이 아니라 실제로 잰 값이라 따로 보여 준다.
 */
import {
  DEFAULT_SESSION_MINUTES,
  RECOMMENDED_WEEKLY_MET_MINUTES,
  dayMetMinutes,
  kcalTotal,
  minutesToHours,
  moveTotals,
  pbView,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  weekMonday,
  type PbRecordLike,
} from "@/lib/achievement153";

/** 운동 1시간 → 기대 수명 몇 시간 (Lee 2017) */
export const LIFE_HOURS_PER_EXERCISE_HOUR = 7;
/** 기대 수명이 느는 상한 — 약 3.2년 (Lee 2017) */
export const LIFE_GAIN_CAP_DAYS = Math.round(3.2 * 365);
/** 꾸준히 운동한 달마다 줄어드는 '마음이 힘든 날' (Chekroud 2018 — 1.49일) */
export const MOOD_DAYS_PER_ACTIVE_MONTH = 1.5;
/** '꾸준히 운동한 달' — 한 달에 이만큼 이상 온 달 */
export const ACTIVE_MONTH_MIN_DAYS = 4;
/** 좋아지는 상한 — 심폐지구력(%) · 근지구력(%) · 근력(%) · 체지방률(%p) */
export const CARDIO_MAX_PCT = 15;
export const ENDURANCE_MAX_PCT = 10;
export const STRENGTH_MAX_PCT = 8;
export const BODY_FAT_MAX_PP = 2;
/** 좋아지는 속도 — 이 주 수만큼 쌓이면 상한의 약 63% */
export const GAIN_TAU_WEEKS = 8;
/** 근육 — 한 주에 이만큼 오면 1주 (WHO: 근력 운동 주 2회) */
export const STRENGTH_WEEK_MIN_DAYS = 2;
/** 지방 1kg 에너지 (kcal) */
export const KCAL_PER_FAT_KG = 7700;

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

/** 주(월요일)마다 그 주에 온 날들 */
function byWeek(days: readonly HealthDay[]): Map<string, HealthDay[]> {
  const per = new Map<string, HealthDay[]>();
  for (const d of uniqueDays(days)) {
    const wk = weekMonday(d.day);
    if (!wk) continue;
    if (!per.has(wk)) per.set(wk, []);
    per.get(wk)!.push(d);
  }
  return per;
}

/** 꾸준히 운동한 달 — 한 달에 4번 이상 온 달 수 */
export function activeMonths(days: readonly HealthDay[]): number {
  const per = new Map<string, number>();
  for (const d of uniqueDays(days)) per.set(d.day.slice(0, 7), (per.get(d.day.slice(0, 7)) ?? 0) + 1);
  return [...per.values()].filter((n) => n >= ACTIVE_MONTH_MIN_DAYS).length;
}

/** 한 주(월~일)에 2번 이상 온 주 수 */
export function strengthWeeks(days: readonly HealthDay[]): number {
  return [...byWeek(days).values()].filter((w) => w.length >= STRENGTH_WEEK_MIN_DAYS).length;
}

/** 심폐 용량 주 — 주마다 min(1, 그 주 MET·분 ÷ 500) 의 합 (66분 1번 = 0.8주) */
export function cardioDoseWeeks(days: readonly HealthDay[]): number {
  let s = 0;
  for (const w of byWeek(days).values()) {
    const met = w.reduce((a, d) => a + dayMetMinutes(d.minutes), 0);
    s += Math.min(1, met / RECOMMENDED_WEEKLY_MET_MINUTES);
  }
  return s;
}

/** 근육 용량 주 — 주마다 min(1, 그 주 온 날 ÷ 2) 의 합 (1번 = 0.5주) */
export function muscleDoseWeeks(days: readonly HealthDay[]): number {
  let s = 0;
  for (const w of byWeek(days).values()) s += Math.min(1, w.length / STRENGTH_WEEK_MIN_DAYS);
  return s;
}

/** 쌓인 주에 따라 상한까지 천천히 오르는 값 (처음엔 빨리, 갈수록 천천히) */
export const saturatingPct = (maxPct: number, weeks: number): number =>
  maxPct * (1 - Math.exp(-safe(weeks) / GAIN_TAU_WEEKS));

/** 13.2 → '13' · 1.76 → '1.7' (10 아래는 소수 한 자리, 내림) */
export function formatPct(p: number): string {
  const v = safe(p);
  return v >= 10 ? String(Math.floor(v)) : (Math.floor(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

/** 0.84 → '0.8' (용량 주 표시 — 내림, 소수 한 자리) */
export const formatWeeks = (w: number): string =>
  (Math.floor(safe(w) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

export interface HealthGains {
  /** 늘어난 기대 수명(시간) · 표시 글자 */
  lifeHours: number;
  lifeLabel: string;
  /** 권장 운동량을 꽉 채운 주 (표시용) · 심폐 용량 주 · 심폐지구력 +% */
  cardioWeeks: number;
  cardioDose: number;
  cardioPct: number;
  /** 주 2번 이상 온 주 (표시용) · 근육 용량 주 */
  strengthWeeks: number;
  muscleDose: number;
  /** 근지구력 +% · 근력 +% · 체력(종합) +% */
  endurancePct: number;
  strengthPct: number;
  fitnessPct: number;
  /** 체지방률 추정 -%p (양수로 담는다 — 1.2 = 1.2%p 내려간 셈) */
  bodyFatPp: number;
  /** 꾸준히 운동한 달 · 줄어든 '마음이 힘든 날' */
  activeMonths: number;
  moodDays: number;
  /** 153 PB 실측 — 첫 완주보다 빨라진 비율(%) · 기록이 2개 미만이거나 안 빨라졌으면 null */
  pbFasterPct: number | null;
}

/** 운동 기록(날마다) + 총 운동 시간 + 153 PB 기록 → 추정 + PB 실측 */
export function healthGains(
  days: readonly HealthDay[],
  totalMinutes: number,
  pbRecords?: readonly PbRecordLike[] | null,
): HealthGains {
  const list = uniqueDays(days);
  const lifeHours = lifeGainHours(totalMinutes);
  const cardioDose = cardioDoseWeeks(list);
  const muscleDose = muscleDoseWeeks(list);
  const cardioPct = saturatingPct(CARDIO_MAX_PCT, cardioDose);
  const endurancePct = saturatingPct(ENDURANCE_MAX_PCT, muscleDose);
  const strengthPct = saturatingPct(STRENGTH_MAX_PCT, muscleDose);
  const months = activeMonths(list);
  const pb = pbView(pbRecords);
  const pbFasterPct = pb && pb.improvedMs != null && pb.firstMs > 0 ? (pb.improvedMs / pb.firstMs) * 100 : null;
  return {
    lifeHours,
    lifeLabel: formatLifeGain(lifeHours),
    cardioWeeks: recommendedWeeks(list),
    cardioDose,
    cardioPct,
    strengthWeeks: strengthWeeks(list),
    muscleDose,
    endurancePct,
    strengthPct,
    fitnessPct: (cardioPct + endurancePct + strengthPct) / 3,
    bodyFatPp: saturatingPct(BODY_FAT_MAX_PP, cardioDose),
    activeMonths: months,
    moodDays: Math.round(months * MOOD_DAYS_PER_ACTIVE_MONTH),
    pbFasterPct,
  };
}

/** 첫 운동 전 미리 보기 — 주 N번씩 W주 하면 (기본 66분) · 화면에 '하면 이만큼'으로만 쓴다 */
export const PREVIEW_WEEKS = 8;
export const PREVIEW_PER_WEEK = 2;
export function previewGains(weeks = PREVIEW_WEEKS, perWeek = PREVIEW_PER_WEEK): HealthGains {
  const days: HealthDay[] = [];
  const start = Date.UTC(2026, 0, 5); // 월요일
  for (let w = 0; w < weeks; w++) {
    for (let k = 0; k < perWeek; k++) {
      days.push({ day: new Date(start + (w * 7 + k * 2) * 86_400_000).toISOString().slice(0, 10), minutes: DEFAULT_SESSION_MINUTES });
    }
  }
  return healthGains(days, days.length * DEFAULT_SESSION_MINUTES);
}

/* ───────────── 지금까지 얻은 것 · 한 번 올 때마다 ───────────── */

export interface ValueTotals {
  /** 뻗은 펀치(잽 + 스트레이트, 칸마다 내림한 합) · 칼로리(내림) · 태운 지방 kg(에너지 환산, 소수 한 자리 내림) */
  punches: number;
  kcal: number;
  fatKg: number;
}

/** 출석 수 · 운동 시간(분) · 계산 몸무게 → 펀치 · 칼로리 · 지방 (지금까지 · 이번 달 같은 식) */
export function valueTotals(classes: number, minutes: number, weightKg: number): ValueTotals {
  const kcal = kcalTotal(classes, minutes, weightKg);
  return {
    punches: punchTotal(classes, minutes),
    kcal: roundApprox(kcal),
    fatKg: Math.floor((kcal / KCAL_PER_FAT_KG) * 10) / 10,
  };
}

export interface PerVisit {
  /** 한 번에 평균 운동 시간(분) · 펀치 · 칼로리 · 늘어난 건강 수명(시간, 소수 한 자리) */
  minutes: number;
  punches: number;
  kcal: number;
  lifeHours: number;
}

/** 한 번 올 때마다 — 내 평균 운동 시간 기준 (기록이 없으면 기본 66분) */
export function perVisit(classes: number, totalMinutes: number, weightKg: number): PerVisit {
  const c = Math.max(0, Math.trunc(Number.isFinite(classes) ? classes : 0));
  const avg = c > 0 && totalMinutes > 0 ? totalMinutes / c : DEFAULT_SESSION_MINUTES;
  const punches = moveTotals(1, avg)
    .filter((m) => m.key === "jab" || m.key === "straight")
    .reduce((a, m) => a + Math.round(m.total), 0);
  return {
    minutes: Math.round(avg),
    punches: Math.floor(punches / 10) * 10,
    kcal: Math.floor(kcalTotal(1, avg, weightKg) / 10) * 10,
    lifeHours: Math.floor((avg / 60) * LIFE_HOURS_PER_EXERCISE_HOUR * 10) / 10,
  };
}

/* ───────────── 오삼코치 피드백 (잘한 것 + 다음 한 걸음) ───────────── */

export interface Feedback {
  emoji: string;
  text: string;
}

export interface FeedbackInput {
  /** 날마다 운동 시간 (최근 순이든 아니든 상관없다) */
  days: readonly HealthDay[];
  /** 'YYYY-MM-DD' (KST 오늘) */
  today: string;
  total: number;
  totalMinutes: number;
  monthMinutes: number;
  lastMonthMinutes: number;
  /** 한 번 올 때마다 (perVisit) */
  per: PerVisit;
  /** 지금까지 뻗은 펀치 */
  punches: number;
}

const n = (v: number) => v.toLocaleString("ko-KR");
const DAY = 86_400_000;
const ymdToUtc = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** 다음 펀치 목표 — 1만 번 아래는 1천 단위 · 10만 아래는 1만 단위 · 그 위는 5만 단위 */
export function nextPunchGoal(punches: number): number {
  const p = Math.max(0, Math.floor(safe(punches)));
  const unit = p < 10_000 ? 1000 : p < 100_000 ? 10_000 : 50_000;
  return (Math.floor(p / unit) + 1) * unit;
}

/** 최근 28일(오늘 포함) 온 날 수 */
export function visitsLast28(days: readonly HealthDay[], today: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return 0;
  const end = ymdToUtc(today);
  return uniqueDays(days).filter((d) => {
    const t = ymdToUtc(d.day);
    return t <= end && end - t < 28 * DAY;
  }).length;
}

/**
 * 피드백 — 잘한 것 먼저, 다음 한 걸음 하나. 줄어든 것 · 손해 · 탓하는 말은 쓰지 않는다.
 *   ① 최근 4주 페이스 ② 이번 주 권장량 ③ 이번 달 (늘었으면 + · 아니면 몇 번이면 지난달을 넘는지) ④ 다음 펀치 목표 — 최대 3줄
 */
export function valueFeedback(f: FeedbackInput): Feedback[] {
  const out: Feedback[] = [];
  if (f.total <= 0) {
    return [
      { emoji: "🥊", text: `첫 운동 한 번에 펀치 약 ${n(f.per.punches)}번 · 약 ${n(f.per.kcal)}kcal가 쌓여요` },
      { emoji: "💪", text: "주 1번만 와도 심폐지구력 · 근력이 쌓이기 시작해요" },
    ];
  }
  const v28 = visitsLast28(f.days, f.today);
  if (v28 >= 12) out.push({ emoji: "🔥", text: `최근 4주 주 3번 페이스 — 연구에서 효과가 가장 컸던 횟수(주 3~5번)예요` });
  else if (v28 >= 8) out.push({ emoji: "💪", text: `최근 4주 주 2번 페이스 — 건강에 필요한 운동량을 꽉 채우고 있어요` });
  else if (v28 >= 4) out.push({ emoji: "👍", text: `주 1번도 헛되지 않아요 — 한 번에 권장 운동량의 80%를 채워요. 한 번만 더 오면 100%예요` });
  else if (v28 >= 1) out.push({ emoji: "👊", text: `최근 4주 ${n(v28)}번 — 올 때마다 펀치 약 ${n(f.per.punches)}번 · 약 ${n(f.per.kcal)}kcal가 쌓였어요` });
  else out.push({ emoji: "🌱", text: `그동안 쌓은 ${minutesToHours(f.totalMinutes)}시간은 그대로예요 — 이번 주 한 번이면 다시 이어져요` });

  // 이번 주 권장 운동량 (주 500 MET·분)
  const wk = weekMonday(f.today);
  if (wk) {
    const thisWeek = uniqueDays(f.days).filter((d) => weekMonday(d.day) === wk);
    const met = thisWeek.reduce((a, d) => a + dayMetMinutes(d.minutes), 0);
    if (met >= RECOMMENDED_WEEKLY_MET_MINUTES) out.push({ emoji: "✅", text: "이번 주 권장 운동량 달성 — 몸이 좋아지는 주로 쌓였어요" });
    else if (thisWeek.length >= 1) out.push({ emoji: "🎯", text: "이번 주 한 번만 더 오면 권장 운동량을 꽉 채워요" });
  }

  // 이번 달 — 늘었으면 + · 아니면 몇 번이면 지난달을 넘는지 (4번 이내일 때만)
  if (f.lastMonthMinutes > 0) {
    const gap = f.lastMonthMinutes - f.monthMinutes;
    if (gap < 0 && -gap >= 6) out.push({ emoji: "📈", text: `이번 달 벌써 지난달보다 ${minutesToHours(-gap)}시간 더 운동했어요` });
    else if (gap >= 0) {
      const visits = Math.max(1, Math.ceil((gap + 1) / Math.max(1, f.per.minutes)));
      if (visits <= 4) out.push({ emoji: "📅", text: `이번 달 ${n(visits)}번만 더 오면 지난달 기록(${minutesToHours(f.lastMonthMinutes)}시간)을 넘어요` });
    }
  }

  // 다음 펀치 목표
  if (out.length < 3 && f.per.punches > 0) {
    const goal = nextPunchGoal(f.punches);
    const visits = Math.max(1, Math.ceil((goal - f.punches) / f.per.punches));
    out.push({ emoji: "🏁", text: `펀치 ${n(goal)}번까지 약 ${n(visits)}번 남았어요` });
  }
  return out.slice(0, 3);
}
