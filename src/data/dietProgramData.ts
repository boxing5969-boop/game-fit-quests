/**
 * 153 다이어트 프로그램 — 정적 UI 상수.
 *
 * DB 스키마/서버 RPC 와 동기화되는 단일 진실 공급원.
 * 문서: `docs/153-diet-implementation-plan.md`
 * 마이그레이션: `supabase/migrations/20260424000000_diet_program_foundation.sql`
 *
 * 타입은 Supabase 자동 생성 타입(`types.ts`) 을 그대로 재사용.
 * 이 파일은 UI 라벨·힌트·카탈로그 메타데이터만 정의.
 */

import type {
  DietTrack,
  DietStage,
  DietLogStatus,
  DietCoachNoteTemplate,
  DietMealSlot,
} from "@/lib/dietTrack";

// ──────────────────────────────────────────────────────────────────
// 트랙 라벨 / 힌트
// ──────────────────────────────────────────────────────────────────
export const DIET_TRACK_LABEL: Record<DietTrack, string> = {
  adult_standard: "성인 표준 트랙",
  adult_advanced_hidden: "성인 심화 트랙 (제한 해제형)",
  youth_habit: "청소년 습관 트랙",
};

export const DIET_TRACK_HINT: Record<DietTrack, string> = {
  adult_standard: "지속 가능한 식습관 리셋 중심. 칼로리 집계·체중 입력 없음.",
  adult_advanced_hidden:
    "성인 + 코치 승인 + 위험요인 없음 조건에서만 열리는 심화 옵션.",
  youth_habit: "성장기 보호 모드. 단식·식사 거르기 규칙 비활성화.",
};

// ──────────────────────────────────────────────────────────────────
// 21일 × 3 스테이지 구조
// ──────────────────────────────────────────────────────────────────
export interface DietStageDef {
  id: DietStage;
  order: 1 | 2 | 3;
  label: string;
  tagline: string;
  dayRange: [number, number];
}

export const DIET_STAGES: readonly DietStageDef[] = Object.freeze([
  {
    id: "reset",
    order: 1,
    label: "리셋",
    tagline: "흐트러진 식사 리듬 정상화",
    dayRange: [1, 7],
  },
  {
    id: "burning",
    order: 2,
    label: "연소",
    tagline: "체지방 감량 효율 + 근육 보존",
    dayRange: [8, 14],
  },
  {
    id: "lifestyle",
    order: 3,
    label: "라이프스타일",
    tagline: "유지 가능한 생활 습관 정착",
    dayRange: [15, 21],
  },
] as const);

export const DIET_TOTAL_DAYS = 21;

// ──────────────────────────────────────────────────────────────────
// 일일 5 핵심 습관 (체크박스) — 칼로리 수기 입력 없음
// DB 컬럼명과 1:1 매칭
// ──────────────────────────────────────────────────────────────────
export type DietHabitKey =
  | "protein_first"
  | "veggies_natural"
  | "sugary_drink_avoided"
  | "late_night_snack_avoided"
  | "gym_attended";

export interface DietHabitDef {
  key: DietHabitKey;
  order: 1 | 2 | 3 | 4 | 5;
  label: string;
  prompt: string;
}

export const DIET_HABITS: readonly DietHabitDef[] = Object.freeze([
  {
    key: "protein_first",
    order: 1,
    label: "단백질 먼저",
    prompt: "식사 시작 시 단백질부터 한 입",
  },
  {
    key: "veggies_natural",
    order: 2,
    label: "채소·자연식",
    prompt: "가공식품보다 자연에 가까운 한 끼",
  },
  {
    key: "sugary_drink_avoided",
    order: 3,
    label: "당 음료 절제",
    prompt: "당 음료·주스 대신 물/차",
  },
  {
    key: "late_night_snack_avoided",
    order: 4,
    label: "야식 절제",
    prompt: "밤 9시 이후 간식 피하기",
  },
  {
    key: "gym_attended",
    order: 5,
    label: "활동량",
    prompt: "체육관 출석·30분 이상 걷기",
  },
] as const);

// ──────────────────────────────────────────────────────────────────
// 상태 라벨
// ──────────────────────────────────────────────────────────────────
export const DIET_STATUS_LABEL: Record<DietLogStatus, string> = {
  pending: "코치 확인 대기",
  approved: "승인 완료",
  rejected: "반려",
  revision_requested: "수정 요청",
};

export const DIET_MEAL_SLOT_LABEL: Record<DietMealSlot, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

export const DIET_NOTE_TEMPLATE_LABEL: Record<DietCoachNoteTemplate, string> = {
  general: "일반 피드백",
  warning: "주의 안내",
  celebration: "격려 · 축하",
  correction: "수정 요청",
  weekly: "주간 리뷰",
};

// ──────────────────────────────────────────────────────────────────
// 보상 정책 (서버 RPC reason 문자열과 반드시 일치)
// ──────────────────────────────────────────────────────────────────
export const DIET_REWARDS = Object.freeze({
  perApprovedCheckin: 3,
  programComplete: 50,
} as const);

export const DIET_REWARD_REASON = Object.freeze({
  perApprovedCheckin: "diet_checkin_approved",
  programComplete: "diet_21_complete",
} as const);

// ──────────────────────────────────────────────────────────────────
// 배지 카탈로그 (마이그레이션 seed 와 동기)
// ──────────────────────────────────────────────────────────────────
export interface DietBadgeDef {
  code: string;
  name: string;
  description: string;
}

export const DIET_BADGES: readonly DietBadgeDef[] = Object.freeze([
  { code: "diet_starter", name: "첫 걸음", description: "첫 체크인 코치 승인" },
  { code: "diet_week_7", name: "7일 리셋", description: "누적 승인 7일 달성" },
  {
    code: "diet_week_14",
    name: "14일 연소",
    description: "누적 승인 14일 달성",
  },
  {
    code: "diet_21_complete",
    name: "21일 완주",
    description: "21일 완주 달성",
  },
  {
    code: "diet_coach_favorite",
    name: "코치 추천",
    description: "코치가 지정한 모범 식습관 기록",
  },
] as const);

// ──────────────────────────────────────────────────────────────────
// 동의서
// ──────────────────────────────────────────────────────────────────
export const DIET_CONSENT_VERSION = 1;

export const DIET_HEALTH_DISCLAIMER = [
  "본 프로그램은 의료·진단 서비스가 아닙니다.",
  "임신·수유 중이거나 만성질환·섭식장애 이력이 있다면 전문의 상담 후 시작해주세요.",
  "청소년은 성장·건강 보호를 위해 단식·식사 거르기 기능이 제공되지 않습니다.",
  "극단적 체중 감량이 아닌 지속 가능한 식습관 형성을 목표로 합니다.",
] as const;

// ──────────────────────────────────────────────────────────────────
// Feature flag
// ──────────────────────────────────────────────────────────────────
export const DIET_FEATURE_FLAG_COLUMN = "diet_program_enabled" as const;
