/**
 * 건강리셋 연장 프로그램 · 패턴별 · 주차별 미션 플레이북.
 *
 * 구조:
 *   PLAYBOOK[pattern_tag][week_index] = PostMission[]
 *
 * 규칙:
 *   - 1주차: "리듬 재정렬" — 복구·기초 루틴 중심, 제한 강도 낮음
 *   - 2주차: "감량 지속 / 정체기 대응" — 한 단계 정교하게
 *   - 미션 5~7개. 극단 제한 금지. "더 안정적으로" 톤.
 *
 * 조합 규칙(extendMissionEngine):
 *   - 태그 여러 개일 때 상위 2개 플레이북을 병합 후 중복 제거 상위 6개 선택
 *   - 기본 공통 미션(COMMON)이 항상 1~2개 포함
 */

import type { PostMission } from "./postProgramMissions";
import type { ExtendPatternTag } from "@/lib/diet/extendPatternEngine";

type WeekIndex = 1 | 2;

type Playbook = Record<ExtendPatternTag, Record<WeekIndex, PostMission[]>>;

// 공통 미션 — 패턴 무관. 플레이북 병합 후 상위에 강제 포함.
export const COMMON_MISSIONS: Record<WeekIndex, PostMission[]> = {
  1: [
    {
      code: "common_protein_first_w1",
      label: "식사 첫 입은 단백질",
      hint: "1주차 기본 리셋. 혈당·포만감 안정으로 하루가 가벼워집니다.",
    },
    {
      code: "common_hydrate_w1",
      label: "아침 물 300ml + 하루 1.5L",
      hint: "포만감 과대평가 방지. 커피는 물 외 별도로.",
    },
  ],
  2: [
    {
      code: "common_protein_plus_w2",
      label: "끼니마다 단백질 한 뼘",
      hint: "2주차 감량 지속. 정체기엔 제한보다 단백질·수면이 먼저.",
    },
    {
      code: "common_checkin_rate_w2",
      label: "식단 인증률 85% 이상",
      hint: "완벽 아님. 빠진 끼니는 기록만 남기고 다음 끼니로 복귀.",
    },
  ],
};

export const EXTEND_PLAYBOOK: Playbook = {
  // ─── 야식형 ────────────────────────────────────────────────
  late_binge: {
    1: [
      {
        code: "late_kitchen_close",
        label: "21시 주방 마감",
        hint: "먹어도 되는 시간·안 먹는 시간 경계선을 하나만 정해요.",
      },
      {
        code: "late_evening_protein",
        label: "저녁 단백질 손바닥 2개분",
        hint: "저녁 부족이 야식의 주원인. 저녁에 먼저 채우기.",
      },
      {
        code: "late_tea_swap",
        label: "야식 충동 시 따뜻한 차 한 잔",
        hint: "허기·피곤·심심함 구분 — 차 1잔 마신 후에도 배고프면 그때 기록.",
      },
      {
        code: "late_bedtime_23",
        label: "취침 23:00 목표",
        hint: "늦은 폭식의 가장 빠른 차단은 잠입니다.",
      },
    ],
    2: [
      {
        code: "late_log_after_9",
        label: "21시 이후 섭취 반드시 기록",
        hint: "금지보다 기록. 패턴 인식이 더 중요합니다.",
      },
      {
        code: "late_recover_next",
        label: "야식 다음 끼니 바로 복귀",
        hint: "다음 아침은 평소 리듬 그대로. 죄책감 금지.",
      },
      {
        code: "late_evening_walk",
        label: "저녁 식후 10분 걷기",
        hint: "소화 + 야식 충동 전환. 실외 10분이면 충분.",
      },
    ],
  },

  // ─── 외식형 ────────────────────────────────────────────────
  eating_out: {
    1: [
      {
        code: "out_pre_protein",
        label: "외식 30분 전 단백질 스낵",
        hint: "삶은 계란 1개, 플레인 요거트 한 컵 — 공복 폭주 방지.",
      },
      {
        code: "out_half_carb",
        label: "탄수화물 반 덜어 먹기",
        hint: "밥·면·빵 중 하나만 선택해 반 양으로 시작.",
      },
      {
        code: "out_sauce_side",
        label: "소스는 따로 찍어 먹기",
        hint: "기름·설탕 소스의 총량이 반으로 줄어요.",
      },
      {
        code: "out_water_first",
        label: "음료는 물 · 무가당 차",
        hint: "주스·탄산음료 1잔 = 각설탕 8~12개.",
      },
    ],
    2: [
      {
        code: "out_plan_week",
        label: "외식 일정 주초에 미리 체크",
        hint: "어떤 끼니가 외식인지 알면 다른 끼니 계획이 쉬워집니다.",
      },
      {
        code: "out_next_meal_recover",
        label: "외식 다음 끼니는 기본 리듬",
        hint: "연속 외식 2회 = 감량 정체. 다음 끼니는 단백질+채소 중심.",
      },
      {
        code: "out_veg_first",
        label: "외식 시 채소부터",
        hint: "나물·쌈·샐러드 → 단백질 → 탄수화물 순서로.",
      },
    ],
  },

  // ─── 주말붕괴형 ───────────────────────────────────────────
  weekend_crash: {
    1: [
      {
        code: "we_fri_prep",
        label: "금요일 저녁 주말 계획 1줄",
        hint: "외식 몇 끼, 운동 며칠 — 대략만 정해도 붕괴 확률이 뚝 떨어집니다.",
      },
      {
        code: "we_wake_fixed",
        label: "주말도 기상 시간 ±1시간",
        hint: "늦잠이 식사 리듬 붕괴의 출발점. 기상만 잡으면 나머지는 따라와요.",
      },
      {
        code: "we_move_20min",
        label: "주말 중 하루 20분 운동",
        hint: "복싱 섀도우, 산책, 간단 유산소 OK. 강도 무관.",
      },
      {
        code: "we_checkin_sun",
        label: "일요일 저녁 체크인 필수",
        hint: "주말 마지막 한 번의 기록이 다음 한 주를 만듭니다.",
      },
    ],
    2: [
      {
        code: "we_out_max_2",
        label: "주말 외식 2회 이하",
        hint: "하루 1끼는 집밥/간단식으로 흐름 유지.",
      },
      {
        code: "we_alcohol_cap",
        label: "주말 음주 1회 · 2잔 이하",
        hint: "음주 자체보다 음주 후 야식이 더 큰 리스크.",
      },
      {
        code: "we_sunday_reset",
        label: "일요일 저녁 가볍게",
        hint: "월요일 리듬 복귀 속도 = 주말 회복력.",
      },
    ],
  },

  // ─── 운동 잘하지만 식단 약함 ─────────────────────────────
  workout_strong_diet_weak: {
    1: [
      {
        code: "wsdw_first_bite",
        label: "매 끼 첫 입은 단백질",
        hint: "운동은 지키는 분이니 식사 순서 하나만 바꿔도 바로 반응합니다.",
      },
      {
        code: "wsdw_veg_palm",
        label: "채소 손바닥 2개 분량",
        hint: "섬유질·비타민·포만감 — 정체기의 진짜 열쇠.",
      },
      {
        code: "wsdw_no_sugary",
        label: "무가당 기본값",
        hint: "운동 후 스포츠 음료 대신 물·전해질 무가당.",
      },
    ],
    2: [
      {
        code: "wsdw_post_workout",
        label: "운동 후 단백질 20~30g 이내 섭취",
        hint: "근손실 방지 + 과식 방지. 프로틴 쉐이크 1스쿱 또는 계란 2개.",
      },
      {
        code: "wsdw_carb_timing",
        label: "탄수화물은 운동 전후 집중",
        hint: "저녁 늦은 탄수화물 줄이는 게 가장 빠른 감량 스위치.",
      },
      {
        code: "wsdw_log_macros",
        label: "주 3회 식사 사진 기록",
        hint: "완벽한 칼로리 계산 X. 사진만으로도 패턴이 보입니다.",
      },
    ],
  },

  // ─── 식단은 되지만 출석 약함 ─────────────────────────────
  diet_strong_attendance_weak: {
    1: [
      {
        code: "dsaw_walk_7k",
        label: "하루 7,000보",
        hint: "운동 출석이 어려운 주는 걸음 수로 기본 활동량 보충.",
      },
      {
        code: "dsaw_home_10min",
        label: "집에서 10분 몸풀기",
        hint: "못 가는 날에도 10분 스쿼트·플랭크·섀도우 3라운드.",
      },
      {
        code: "dsaw_schedule_gym",
        label: "이번 주 복싱 일정 미리 예약",
        hint: "캘린더에 시간만 박아도 출석률이 크게 오릅니다.",
      },
    ],
    2: [
      {
        code: "dsaw_gym_2plus",
        label: "주 2회 이상 복싱 출석",
        hint: "강도보다 빈도. 20~30분이어도 꾸준함이 먼저.",
      },
      {
        code: "dsaw_cardio_1",
        label: "주 1회 유산소 20~30분",
        hint: "복싱 외 가벼운 유산소 1회만 추가해도 정체기가 풀립니다.",
      },
      {
        code: "dsaw_steps_9k",
        label: "활동 일수 걸음 9,000보 이상",
        hint: "운동 없는 날일수록 걷기로 활동량 균형 유지.",
      },
    ],
  },

  // ─── 수면 부족형 ─────────────────────────────────────────
  sleep_short: {
    1: [
      {
        code: "sleep_lights_off",
        label: "23시 이전 조명 낮추기",
        hint: "취침 90분 전 조명 조절이 수면 질의 거의 전부.",
      },
      {
        code: "sleep_no_caffeine_pm",
        label: "15시 이후 카페인 차단",
        hint: "수면 부족 → 식욕 호르몬 교란 → 야식 증가의 원인 고리.",
      },
      {
        code: "sleep_phone_cut",
        label: "취침 30분 전 화면 끄기",
        hint: "스크린 타임이 수면 질의 가장 큰 파괴자.",
      },
    ],
    2: [
      {
        code: "sleep_7h_target",
        label: "수면 7시간 목표",
        hint: "주중 평균 7시간 확보 시 정체기 해소가 눈에 띕니다.",
      },
      {
        code: "sleep_wake_fixed",
        label: "기상 시간 ±30분 고정",
        hint: "취침보다 기상 시간 고정이 리듬 회복에 더 효과적.",
      },
      {
        code: "sleep_evening_protein",
        label: "저녁에 단백질 충분히",
        hint: "저녁 부족 → 야식 → 수면 질 하락의 악순환 차단.",
      },
    ],
  },
};

/** 연장 결과 선택지 한글 라벨. */
export const EXTEND_RESULT_LABEL: Record<string, string> = {
  maintenance_transition: "유지 모드로 전환",
  extend_again: "한 번 더 연장하기",
  coach_consult: "코치와 개별 상담",
};
