/**
 * 유지 모드 / 건강리셋 연장 프로그램 미션 사전.
 *
 * 톤:
 *   - 유지: "유연하게 먹으면서도 무너지지 않는 유지 전략"
 *   - 연장: "극단적 제한이 아니라 안정적인 감량 루틴"
 *
 * 미션 코드는 서버에 기록하지 않고 클라이언트에서만 사용 (주간 체크인은
 * 카운트 기반으로 집계). 필요 시 서버 테이블로 확장 가능.
 */

export interface PostMission {
  code: string;
  label: string;
  hint: string;
}

export const MAINTENANCE_MISSIONS: PostMission[] = [
  {
    code: "protein_first",
    label: "단백질 먼저 먹기",
    hint: "식사 시작을 단백질로. 포만감과 혈당 안정이 쉬워집니다.",
  },
  {
    code: "weekly_movement",
    label: "주 3회 운동 유지",
    hint: "복싱 2회 + 유산소 1회도 충분. 완전한 휴식일 ≥ 2일.",
  },
  {
    code: "avoid_sugary_drink",
    label: "당 음료 피하기",
    hint: "기본 음료는 물 · 탄산수 · 무가당 차. 주말 자유식은 기록만.",
  },
  {
    code: "recover_next_meal",
    label: "자유식 후 다음 끼니 복귀",
    hint: "회식·외식이 있어도 다음 한 끼는 기본 리듬으로 돌아옵니다.",
  },
  {
    code: "weekly_check",
    label: "주 1회 체중 또는 허리 확인",
    hint: "숫자에 매달리지 않되 범위만 인지. 평일 아침 공복 추천.",
  },
  {
    code: "no_late_binge",
    label: "늦은 폭식 0회 도전",
    hint: "밤 10시 이후 큰 끼니는 기록. 2회 이상이면 복귀 미션 자동 제안.",
  },
];

export const EXTEND_MISSIONS: PostMission[] = [
  {
    code: "lunch_carb_control",
    label: "점심 탄수화물 양 조절",
    hint: "한 그릇 기준 1/2~2/3. 채소·국물로 부피 보충.",
  },
  {
    code: "dinner_protein_veg",
    label: "저녁 단백질 + 채소 중심",
    hint: "탄수화물은 소량. 기름·설탕 소스는 따로 찍어 먹기.",
  },
  {
    code: "daily_steps",
    label: "하루 8,000~10,000보",
    hint: "복싱하는 날은 6,000보 이상도 OK. 앉아있는 시간을 분산.",
  },
  {
    code: "weekly_workout_4",
    label: "주 4회 운동",
    hint: "복싱 3 + 근력/유산소 1. 강도보다 빈도 안정화.",
  },
  {
    code: "checkin_target",
    label: "주간 식단 인증률 85% 이상",
    hint: "완벽보다 지속. 빠진 끼니는 기록만 남기고 넘어갑니다.",
  },
  {
    code: "recover_next_meal",
    label: "외식 후 다음 끼니 바로 복귀",
    hint: "죄책감 대신 복귀 속도로 리듬 유지.",
  },
  {
    code: "sleep_stabilize",
    label: "수면 리듬 안정화",
    hint: "취침 시간 ±30분, 기상 시간 고정. 정체기 대응의 기본.",
  },
];

/** 복귀 미션 — 3일 단기 재정렬. 자동 제안 조건은 서버에서 트리거. */
export const RECOVERY_MISSIONS: PostMission[] = [
  {
    code: "hydrate_first",
    label: "아침 물 한 잔",
    hint: "기상 직후 물 300ml. 식욕·컨디션 조정의 시작.",
  },
  {
    code: "light_dinner_3d",
    label: "3일간 저녁 가볍게",
    hint: "탄수화물 줄이고 단백질·채소 중심. 과식 리셋용.",
  },
  {
    code: "move_20min_3d",
    label: "3일 연속 20분 유산소",
    hint: "걷기·가벼운 조깅·복싱 섀도우 중 하나.",
  },
  {
    code: "sleep_early",
    label: "23시 이전 취침 목표",
    hint: "늦은 야식을 끊는 가장 간단한 신호.",
  },
];
