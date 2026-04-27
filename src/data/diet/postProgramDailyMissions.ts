/**
 * 153 다이어트 — 사후 프로그램(유지/연장) 일일 미션 템플릿.
 *
 * 21일 코어의 missionTemplates.ts(보호 영역) 를 건드리지 않고,
 * 사후 프로그램 전용 일일 체크용 별도 세트를 제공.
 *
 * 톤 규칙:
 *   · 유지(maintenance): "이미 만든 리듬을 가볍게 유지" — core/optional 균형
 *   · 연장(extend): "감량 지속" — 활동·식단 강도 한 단계 위
 */

import type { DietMissionTemplate } from "@/data/diet/missionTemplates";

// ──────────────────────────────────────────────────────────────────
// 유지 컨설팅 모드 — 일일 6개
// ──────────────────────────────────────────────────────────────────
export const POST_PROGRAM_DAILY_MAINTENANCE: readonly DietMissionTemplate[] = [
  {
    id: "pp-m-protein",
    label: "단백질 먼저 한 입",
    hint: "한 끼라도 단백질 우선 — 혈당 급등 방지",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "protein_first",
  },
  {
    id: "pp-m-veggies",
    label: "채소·자연식 한 접시",
    hint: "잎채소·색채소·통곡물 한 가지 이상",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "veggies_natural",
  },
  {
    id: "pp-m-no-sugar",
    label: "당 음료 0",
    hint: "탄산·가당 대신 물·무가당 차",
    category: "hydration",
    severity: "core",
    linkedHabitColumn: "sugary_drink_avoided",
  },
  {
    id: "pp-m-no-late",
    label: "야식 멈춤",
    hint: "취침 3시간 전 간식 끊기",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "late_night_snack_avoided",
  },
  {
    id: "pp-m-water",
    label: "물 1.5L",
    hint: "텀블러로 나눠 마시기 — 1500ml 이상이면 자동 체크",
    category: "hydration",
    severity: "optional",
    waterMlThreshold: 1500,
  },
  {
    id: "pp-m-move",
    label: "활동 30분",
    hint: "걷기·스트레칭·복싱 짧게라도",
    category: "movement",
    severity: "optional",
    linkedHabitColumn: "gym_attended",
  },
];

// ──────────────────────────────────────────────────────────────────
// 건강리셋 연장 — 일일 6개 (감량 톤 강화)
// ──────────────────────────────────────────────────────────────────
export const POST_PROGRAM_DAILY_EXTEND: readonly DietMissionTemplate[] = [
  {
    id: "pp-e-protein-veg",
    label: "단백질 + 채소 한 끼",
    hint: "감량기 핵심 — 이 한 끼가 흐름을 만듦",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "protein_first",
  },
  {
    id: "pp-e-veg-color",
    label: "채소 색 2가지 이상",
    hint: "초록·빨강·노랑 — 식이섬유·비타민 다양화",
    category: "nutrition",
    severity: "core",
    linkedHabitColumn: "veggies_natural",
  },
  {
    id: "pp-e-no-sugar",
    label: "당 음료·디저트 컷",
    hint: "가공 탄수·단 음료 절제",
    category: "hydration",
    severity: "core",
    linkedHabitColumn: "sugary_drink_avoided",
  },
  {
    id: "pp-e-no-late",
    label: "야식 멈춤 유지",
    hint: "감량기는 야식 한 번이 가장 크게 흔듦",
    category: "timing",
    severity: "core",
    linkedHabitColumn: "late_night_snack_avoided",
  },
  {
    id: "pp-e-workout",
    label: "운동 45분 / 8000보",
    hint: "복싱·근력·유산소 중 하나",
    category: "movement",
    severity: "core",
    linkedHabitColumn: "gym_attended",
  },
  {
    id: "pp-e-water",
    label: "물 2L",
    hint: "감량기는 수분 회전이 핵심 — 2000ml 이상이면 자동 체크",
    category: "hydration",
    severity: "optional",
    waterMlThreshold: 2000,
  },
];
