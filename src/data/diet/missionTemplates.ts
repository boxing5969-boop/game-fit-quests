/**
 * 153 다이어트 — 트랙별 21일 미션 템플릿.
 *
 * ──────────────────────────────────────────────────────────────────
 * 설계 원칙
 * ──────────────────────────────────────────────────────────────────
 *   • 복사 금지: 외부 자료·책 문구를 그대로 가져오지 않고, 원리만
 *     벤치마킹해 앱 체크리스트용 짧은 한국어로 재작성.
 *   • 기본값은 "실행 가능한 21일 습관 리셋" — 극단적 단식/제한 없음.
 *   • 데이터 모양: 각 트랙마다 stage 단위 baseline(매일 공통) +
 *     day-specific focus(해당 날만). 이렇게 저장하면 20~30행으로
 *     21일을 표현할 수 있고 하루 조회는 O(1).
 *   • 청소년(youth_habit_153) 세트는 단식·식사 거르기·극단 제한
 *     표현을 사용하지 않는다. "늘리기·유지" 언어만 사용.
 *   • adult_advanced_153_hidden 은 구조만 열어두며, 미션 수가 많지
 *     않고 일반 사용자에게 기본적으로 노출되지 않는다 (ruleEngine
 *     `canActivateAdvanced` 로 별도 검증).
 * ──────────────────────────────────────────────────────────────────
 */

import type { DietStage, DietTrack } from "@/lib/dietTrack";

export type DietMissionCategory =
  | "hydration"   // 물/음료
  | "nutrition"   // 식단 구성
  | "timing"      // 식사 시간·순서
  | "movement"    // 활동/운동
  | "recovery"    // 수면·회복
  | "mindset"     // 인지·복귀
  | "social";     // 외식·모임 대응

export type DietMissionSeverity = "core" | "optional";

export interface DietMissionTemplate {
  /** 트랙 내 유니크 id */
  id: string;
  /** 짧은 라벨 (≤14자 권장) */
  label: string;
  /** 1줄 힌트 */
  hint: string;
  category: DietMissionCategory;
  severity: DietMissionSeverity;
  /**
   * 이 미션이 연결된 DB 컬럼(선택). 있으면 UI 체크박스가 해당 컬럼에
   * 직접 매핑되고, 없으면 free-form 체크(참고용)로 취급.
   */
  linkedHabitColumn?:
    | "protein_first"
    | "veggies_natural"
    | "sugary_drink_avoided"
    | "late_night_snack_avoided"
    | "gym_attended";
}

export interface DietTrackStageSet {
  track: DietTrack;
  stage: DietStage;
  /** 해당 stage 동안 매일 표시되는 baseline 미션 */
  daily: readonly DietMissionTemplate[];
  /** 특정 day(1~21)에만 표시되는 focus 미션 */
  focusByDay: Readonly<Record<number, readonly DietMissionTemplate[]>>;
}

// ──────────────────────────────────────────────────────────────────
// adult_standard — 기본 성인 트랙 (안전 21일)
// ──────────────────────────────────────────────────────────────────

const ADULT_STD_RESET_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "as-r-d1",
    label: "단백질 먼저 한 입",
    hint: "식사 시작을 단백질로 열어 혈당 급등 방지",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "protein_first",
  },
  {
    id: "as-r-d2",
    label: "당 음료 0",
    hint: "탄산·가당 음료 대신 물 또는 무가당 차",
    category: "hydration",
    severity: "core",
    linkedHabitColumn: "sugary_drink_avoided",
  },
  {
    id: "as-r-d3",
    label: "물 1.5L",
    hint: "텀블러/컵 단위로 나눠 마시기",
    category: "hydration",
    severity: "core",
  },
  {
    id: "as-r-d4",
    label: "야식 멈춤",
    hint: "취침 3시간 전 간식 끊기",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "late_night_snack_avoided",
  },
  {
    id: "as-r-d5",
    label: "식후 10분 걷기",
    hint: "혈당 완만하게 내리기 위한 가벼운 움직임",
    category: "movement",
    severity: "optional",
  },
];

const ADULT_STD_RESET_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  1: [
    {
      id: "as-r-f1",
      label: "식사 시간 고정",
      hint: "아침·점심·저녁 시간대 한 줄로 정리",
      category: "timing",
      severity: "core",
    },
  ],
  2: [
    {
      id: "as-r-f2",
      label: "술 대신 무알콜",
      hint: "술자리라면 무알콜 또는 양 조절",
      category: "social",
      severity: "core",
    },
  ],
  3: [
    {
      id: "as-r-f3",
      label: "식단 사진 인증",
      hint: "하루 한 끼라도 사진으로 기록",
      category: "mindset",
      severity: "core",
    },
  ],
  4: [
    {
      id: "as-r-f4",
      label: "체육관 출석 계획",
      hint: "이번 주 출석 요일을 1~2일 정해 두기",
      category: "movement",
      severity: "optional",
      linkedHabitColumn: "gym_attended",
    },
  ],
  5: [
    {
      id: "as-r-f5",
      label: "저녁 과식 신호 알아차리기",
      hint: "배고픔보다 감정일 때가 있다 — 한 번 멈춰서 확인",
      category: "mindset",
      severity: "optional",
    },
  ],
  6: [
    {
      id: "as-r-f6",
      label: "짠맛 줄이기",
      hint: "국·찌개 국물은 절반만",
      category: "nutrition",
      severity: "optional",
    },
  ],
  7: [
    {
      id: "as-r-f7",
      label: "1주차 돌아보기",
      hint: "가장 잘한 습관 하나 선정 + 다음 주 다짐 한 줄",
      category: "mindset",
      severity: "core",
    },
  ],
};

const ADULT_STD_BURNING_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "as-b-d1",
    label: "단백질 + 채소 한 끼",
    hint: "하루 한 끼는 단백질과 채소 중심으로",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "veggies_natural",
  },
  {
    id: "as-b-d2",
    label: "탄수 점심/운동전후",
    hint: "탄수화물은 활동량 많은 시간대에 배치",
    category: "timing",
    severity: "core",
  },
  {
    id: "as-b-d3",
    label: "8,000보",
    hint: "계단·산책으로 쌓기",
    category: "movement",
    severity: "core",
  },
  {
    id: "as-b-d4",
    label: "수면 7시간",
    hint: "회복이 곧 감량 효율",
    category: "recovery",
    severity: "core",
  },
  {
    id: "as-b-d5",
    label: "야식 멈춤 유지",
    hint: "1주차 규칙 그대로",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "late_night_snack_avoided",
  },
];

const ADULT_STD_BURNING_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  8: [
    {
      id: "as-b-f8",
      label: "근력 세션 1회",
      hint: "복싱 전·후 15분 근력 또는 짐 수업",
      category: "movement",
      severity: "core",
    },
  ],
  9: [
    {
      id: "as-b-f9",
      label: "복싱·유산소 1회",
      hint: "스파링·샌드백·러닝 중 택 1",
      category: "movement",
      severity: "core",
      linkedHabitColumn: "gym_attended",
    },
  ],
  10: [
    {
      id: "as-b-f10",
      label: "채소 색 3가지",
      hint: "초록·빨강·노랑 등 색을 다양하게",
      category: "nutrition",
      severity: "optional",
    },
  ],
  11: [
    {
      id: "as-b-f11",
      label: "스파이크 음식 피하기",
      hint: "가공 탄수·단 디저트 줄이기",
      category: "nutrition",
      severity: "core",
    },
  ],
  12: [
    {
      id: "as-b-f12",
      label: "가공식품 줄이기",
      hint: "라면·과자·튀김은 이번 주만 잠시 멀리",
      category: "nutrition",
      severity: "core",
    },
  ],
  13: [
    {
      id: "as-b-f13",
      label: "간식 대신 견과 소량",
      hint: "한 줌 이하, 무염 선호",
      category: "nutrition",
      severity: "optional",
    },
  ],
  14: [
    {
      id: "as-b-f14",
      label: "2주차 돌아보기",
      hint: "허리·사진 측정은 선택 — 체감 중심 회고",
      category: "mindset",
      severity: "core",
    },
  ],
};

const ADULT_STD_LIFESTYLE_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "as-l-d1",
    label: "이전 습관 유지",
    hint: "물·단백질·활동 기본 유지",
    category: "mindset",
    severity: "core",
  },
  {
    id: "as-l-d2",
    label: "다음 끼니 복귀",
    hint: "한 끼 무너졌어도 다음 한 끼는 제자리로",
    category: "mindset",
    severity: "core",
  },
  {
    id: "as-l-d3",
    label: "수분·수면 유지",
    hint: "물 1.5L·수면 7시간",
    category: "recovery",
    severity: "core",
  },
];

const ADULT_STD_LIFESTYLE_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  15: [
    {
      id: "as-l-f15",
      label: "외식 전략 연습",
      hint: "메뉴 먼저 보고 단백질·채소 중심 주문 시뮬레이션",
      category: "social",
      severity: "core",
    },
  ],
  16: [
    {
      id: "as-l-f16",
      label: "빠른 복귀 연습",
      hint: "어제 과식했다면 오늘은 평소대로 — 죄책감 금지",
      category: "mindset",
      severity: "core",
    },
  ],
  17: [
    {
      id: "as-l-f17",
      label: "주말 계획 미리",
      hint: "약속·식단·운동 시간 미리 배치",
      category: "social",
      severity: "optional",
    },
  ],
  18: [
    {
      id: "as-l-f18",
      label: "유지 플랜 살펴보기",
      hint: "아침형/저녁형/외식형/주말형 중 하나 고르기",
      category: "mindset",
      severity: "core",
    },
  ],
  19: [
    {
      id: "as-l-f19",
      label: "수분·수면 재점검",
      hint: "최근 3일 평균 기록 확인",
      category: "recovery",
      severity: "optional",
    },
  ],
  20: [
    {
      id: "as-l-f20",
      label: "체력/기분 기록",
      hint: "시작 때와 비교해 한 줄 느낌",
      category: "mindset",
      severity: "optional",
    },
  ],
  21: [
    {
      id: "as-l-f21",
      label: "21일 졸업 + 유지 플랜 확정",
      hint: "다음 7일 실천 계획 1개만 정하기",
      category: "mindset",
      severity: "core",
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// youth_habit — 청소년 트랙 (단식/제한 언어 금지, "늘리기/유지"만)
// ──────────────────────────────────────────────────────────────────

const YOUTH_RESET_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "yh-r-d1",
    label: "아침 꼭 먹기",
    hint: "거르지 말고 간단하게라도",
    category: "timing",
    severity: "core",
  },
  {
    id: "yh-r-d2",
    label: "물 1L",
    hint: "생수·무가당 음료로 채우기",
    category: "hydration",
    severity: "core",
  },
  {
    id: "yh-r-d3",
    label: "당 음료 줄이기",
    hint: "주스·탄산 대신 물",
    category: "hydration",
    severity: "core",
    linkedHabitColumn: "sugary_drink_avoided",
  },
  {
    id: "yh-r-d4",
    label: "수면 8시간",
    hint: "취침 시간 고정하기",
    category: "recovery",
    severity: "core",
  },
  {
    id: "yh-r-d5",
    label: "야외 활동 30분",
    hint: "걷기·산책·공놀이 등",
    category: "movement",
    severity: "optional",
  },
];

const YOUTH_RESET_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  1: [
    { id: "yh-r-f1", label: "식사 시간 정하기", hint: "가족과 함께 정해 두면 좋다", category: "timing", severity: "core" },
  ],
  3: [
    { id: "yh-r-f3", label: "아침 메뉴 고르기", hint: "계란·두유·과일 중 1가지", category: "nutrition", severity: "core" },
  ],
  5: [
    { id: "yh-r-f5", label: "화면 시간 줄이기", hint: "잠들기 1시간 전 화면 끄기", category: "recovery", severity: "optional" },
  ],
  7: [
    { id: "yh-r-f7", label: "1주차 소감", hint: "잘 지킨 것 하나만 적기", category: "mindset", severity: "core" },
  ],
};

const YOUTH_BURNING_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "yh-b-d1",
    label: "채소 한 입 늘리기",
    hint: "색깔 있는 채소 한 가지 추가",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "veggies_natural",
  },
  {
    id: "yh-b-d2",
    label: "단백질 챙기기",
    hint: "계란·두부·생선·닭가슴살 중 하나",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "protein_first",
  },
  {
    id: "yh-b-d3",
    label: "움직임 30분",
    hint: "운동·체육·놀이 모두 포함",
    category: "movement",
    severity: "core",
    linkedHabitColumn: "gym_attended",
  },
  {
    id: "yh-b-d4",
    label: "수면 8시간 유지",
    hint: "성장·회복에 가장 중요",
    category: "recovery",
    severity: "core",
  },
];

const YOUTH_BURNING_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  10: [
    { id: "yh-b-f10", label: "과자 줄이기", hint: "한 봉지 전체보다 절반만", category: "nutrition", severity: "optional" },
  ],
  12: [
    { id: "yh-b-f12", label: "운동 한 번 더", hint: "이번 주 운동 횟수 1회 추가", category: "movement", severity: "optional" },
  ],
  14: [
    { id: "yh-b-f14", label: "2주차 소감", hint: "몸이 가벼워졌다/잠을 잘 잔다 등 체감", category: "mindset", severity: "core" },
  ],
};

const YOUTH_LIFESTYLE_DAILY: readonly DietMissionTemplate[] = [
  {
    id: "yh-l-d1",
    label: "익힌 습관 유지",
    hint: "물·아침·수면·활동",
    category: "mindset",
    severity: "core",
  },
  {
    id: "yh-l-d2",
    label: "가족과 한 끼",
    hint: "같이 먹으면 더 규칙적이 된다",
    category: "social",
    severity: "optional",
  },
];

const YOUTH_LIFESTYLE_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  17: [
    { id: "yh-l-f17", label: "주말 계획 세우기", hint: "운동 시간·외식 메뉴 미리", category: "social", severity: "optional" },
  ],
  21: [
    { id: "yh-l-f21", label: "21일 졸업 소감", hint: "가장 달라진 습관 하나 적기", category: "mindset", severity: "core" },
  ],
};

// ──────────────────────────────────────────────────────────────────
// adult_advanced_hidden — 구조만 준비 (기본 비노출)
//   • 기본 세트는 adult_standard 와 동일.
//   • advanced-only 미션은 "심화 옵션" 수준으로만 열어두며, 극단적
//     단식·식사 거르기 지시는 포함하지 않는다. 실제 활성화는
//     ruleEngine.canActivateAdvanced() 로만 가능.
// ──────────────────────────────────────────────────────────────────

const ADV_ONLY_BURNING_FOCUS: Record<number, readonly DietMissionTemplate[]> = {
  10: [
    {
      id: "aa-b-f10",
      label: "식사 간격 조절 (심화)",
      hint: "아침·저녁 간격을 평소보다 1시간 앞/뒤로 이동 — 단, 식사 생략 아님",
      category: "timing",
      severity: "optional",
    },
  ],
  13: [
    {
      id: "aa-b-f13",
      label: "운동 강도 +1단계 (심화)",
      hint: "코치가 권장한 경우에만 적용",
      category: "movement",
      severity: "optional",
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// Public catalog — 트랙별 stage set lookup
// ──────────────────────────────────────────────────────────────────

export const DIET_MISSION_SETS: Readonly<
  Record<DietTrack, Readonly<Record<DietStage, DietTrackStageSet>>>
> = Object.freeze({
  adult_standard: {
    reset: {
      track: "adult_standard",
      stage: "reset",
      daily: ADULT_STD_RESET_DAILY,
      focusByDay: ADULT_STD_RESET_FOCUS,
    },
    burning: {
      track: "adult_standard",
      stage: "burning",
      daily: ADULT_STD_BURNING_DAILY,
      focusByDay: ADULT_STD_BURNING_FOCUS,
    },
    lifestyle: {
      track: "adult_standard",
      stage: "lifestyle",
      daily: ADULT_STD_LIFESTYLE_DAILY,
      focusByDay: ADULT_STD_LIFESTYLE_FOCUS,
    },
  },
  adult_advanced_hidden: {
    reset: {
      track: "adult_advanced_hidden",
      stage: "reset",
      daily: ADULT_STD_RESET_DAILY,
      focusByDay: ADULT_STD_RESET_FOCUS,
    },
    burning: {
      track: "adult_advanced_hidden",
      stage: "burning",
      daily: ADULT_STD_BURNING_DAILY,
      // standard focus + advanced-only focus 병합
      focusByDay: mergeFocus(ADULT_STD_BURNING_FOCUS, ADV_ONLY_BURNING_FOCUS),
    },
    lifestyle: {
      track: "adult_advanced_hidden",
      stage: "lifestyle",
      daily: ADULT_STD_LIFESTYLE_DAILY,
      focusByDay: ADULT_STD_LIFESTYLE_FOCUS,
    },
  },
  youth_habit: {
    reset: {
      track: "youth_habit",
      stage: "reset",
      daily: YOUTH_RESET_DAILY,
      focusByDay: YOUTH_RESET_FOCUS,
    },
    burning: {
      track: "youth_habit",
      stage: "burning",
      daily: YOUTH_BURNING_DAILY,
      focusByDay: YOUTH_BURNING_FOCUS,
    },
    lifestyle: {
      track: "youth_habit",
      stage: "lifestyle",
      daily: YOUTH_LIFESTYLE_DAILY,
      focusByDay: YOUTH_LIFESTYLE_FOCUS,
    },
  },
});

function mergeFocus(
  base: Record<number, readonly DietMissionTemplate[]>,
  extra: Record<number, readonly DietMissionTemplate[]>,
): Record<number, readonly DietMissionTemplate[]> {
  const merged: Record<number, readonly DietMissionTemplate[]> = { ...base };
  for (const k of Object.keys(extra)) {
    const dayNum = Number(k);
    merged[dayNum] = [...(base[dayNum] ?? []), ...(extra[dayNum] ?? [])];
  }
  return merged;
}
