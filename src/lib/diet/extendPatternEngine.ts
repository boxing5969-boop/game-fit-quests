/**
 * 153 다이어트 · 건강리셋 연장 — 패턴 분류 엔진.
 *
 * 서버(`submit_extend_reassessment`)가 자동 태깅하지만, 클라이언트도 같은 규칙을
 * 보유해야 Wizard 에서 "예상 패턴" 미리보기와 선택 override 가 가능하다.
 * 규칙은 마이그레이션 20260501000000 의 PL/pgSQL 로직과 1:1 미러.
 */

export type ExtendPatternTag =
  | "late_binge"
  | "eating_out"
  | "weekend_crash"
  | "workout_strong_diet_weak"
  | "diet_strong_attendance_weak"
  | "sleep_short";

export interface ExtendReassessment {
  recent_21d_adherence: number;        // 0~100
  weakest_habit: string;               // 기존 diet habit code
  weekly_workouts: number;             // 최근 1주 출석/운동 횟수
  sleep_hours: number;                 // 평균 수면
  eating_out_weekly: number;           // 외식 횟수/주
  late_binge_weekly: number;           // 늦은 폭식 횟수/주
  biggest_obstacle:
    | "late_binge"
    | "eating_out"
    | "weekend_crash"
    | "sleep_short"
    | "stress"
    | "other";
}

export const PATTERN_LABEL_KO: Record<ExtendPatternTag, string> = {
  late_binge: "야식형",
  eating_out: "외식형",
  weekend_crash: "주말붕괴형",
  workout_strong_diet_weak: "운동 잘하지만 식단 약함",
  diet_strong_attendance_weak: "식단은 되지만 출석 약함",
  sleep_short: "수면 부족형",
};

export const PATTERN_HINT_KO: Record<ExtendPatternTag, string> = {
  late_binge: "저녁 9시 이후 식사 리듬이 반복적으로 흔들립니다.",
  eating_out: "외식·회식 빈도가 주 4회 이상으로 리듬 재정렬이 필요합니다.",
  weekend_crash: "평일 루틴은 되지만 주말 2일에 흐름이 끊기는 패턴입니다.",
  workout_strong_diet_weak:
    "운동은 꾸준한데 식사 순서·내용에서 체지방 감량이 막힙니다.",
  diet_strong_attendance_weak:
    "식단은 유지되지만 출석/활동량이 주 2회 미만으로 정체 요인입니다.",
  sleep_short:
    "수면 6시간 미만은 식욕 호르몬과 정체기 해소에 가장 큰 걸림돌입니다.",
};

/** 서버 규칙과 동일한 자동 태깅. 사용자 override 는 별도 합집합. */
export function classifyPatterns(r: ExtendReassessment): ExtendPatternTag[] {
  const tags: ExtendPatternTag[] = [];

  if (r.late_binge_weekly >= 3) tags.push("late_binge");
  if (r.eating_out_weekly >= 4) tags.push("eating_out");
  if (r.biggest_obstacle === "weekend_crash") tags.push("weekend_crash");

  const weakInDiet = ["protein_first", "veggies_natural", "sugary_drink_avoided"].includes(
    r.weakest_habit,
  );
  if (r.weekly_workouts >= 3 && weakInDiet) tags.push("workout_strong_diet_weak");

  const weakNotInDiet = !["protein_first", "veggies_natural"].includes(r.weakest_habit);
  if (r.weekly_workouts < 2 && weakNotInDiet) tags.push("diet_strong_attendance_weak");

  if (r.sleep_hours > 0 && r.sleep_hours < 6) tags.push("sleep_short");

  return tags;
}

/** 추천 상위 1개 패턴 — Wizard 프리뷰 및 Home 강조 표시용. */
export function primaryPattern(tags: ExtendPatternTag[]): ExtendPatternTag | null {
  // 우선순위: 가장 뚜렷한 신호 → 다음 순
  const order: ExtendPatternTag[] = [
    "late_binge",
    "weekend_crash",
    "eating_out",
    "sleep_short",
    "workout_strong_diet_weak",
    "diet_strong_attendance_weak",
  ];
  for (const t of order) {
    if (tags.includes(t)) return t;
  }
  return null;
}

/** 코치가 보여주는 "연장 추천 이유" 한 줄. */
export function extendReasonLine(r: ExtendReassessment, tags: ExtendPatternTag[]): string {
  const prim = primaryPattern(tags);
  if (!prim) {
    return `최근 21일 수행률 ${r.recent_21d_adherence}% — 리듬을 더 다지는 연장이 도움됩니다.`;
  }
  return `${PATTERN_LABEL_KO[prim]} 신호 — ${PATTERN_HINT_KO[prim]}`;
}
