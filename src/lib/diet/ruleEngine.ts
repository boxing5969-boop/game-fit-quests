/**
 * 153 다이어트 — 규칙 엔진.
 *
 * ──────────────────────────────────────────────────────────────────
 * 책임
 * ──────────────────────────────────────────────────────────────────
 *   1. day index(1~21) → stage + 해당 트랙의 오늘 미션 세트 계산
 *   2. 연령·위험요인 기반 트랙 선택 정합성 강제 (sanitize)
 *   3. advanced_hidden 트랙 활성 가능 여부 판정
 *   4. 체크박스/응답 기반 하루 habit score 계산 (0~100)
 *
 * 순수 함수만 노출 — React/Supabase 의존 없음. 테스트 용이.
 * 서버 RPC(`resolve_diet_track`, `enroll_diet_program`) 와 동일 로직을
 * 클라이언트에서 미리 평가해 UI 분기에 사용하지만, **최종 쓰기는 반드시
 * 서버 RPC 경유**. 이 모듈은 '사전 검증기' 성격.
 *
 * ──────────────────────────────────────────────────────────────────
 * 절대 규칙 대응
 * ──────────────────────────────────────────────────────────────────
 *   • 청소년이 성인 트랙 강제 선택 → sanitizeTrackSelection 가 youth_habit 반환
 *   • 위험요인(임신·당뇨·섭식장애) 중 하나라도 있으면 → advanced 자동 비활성
 *   • advanced_hidden 은 성인 + 코치 승인 + no-risk 모두 성립해야만 true
 *   • 기본 트랙은 adult_standard — 명시 전환이 없으면 advanced 로 올라가지 않음
 * ──────────────────────────────────────────────────────────────────
 */

import type { DietStage, DietTrack } from "@/lib/dietTrack";
import { stageForDay, weekIndexForDay } from "@/lib/dietTrack";
import {
  DIET_MISSION_SETS,
  type DietMissionTemplate,
  type DietTrackStageSet,
} from "@/data/diet/missionTemplates";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

/** day→plan 반환 타입 */
export interface DietDailyPlan {
  track: DietTrack;
  day: number;              // 1~21
  stage: DietStage;
  weekIndex: 1 | 2 | 3;
  missions: readonly DietMissionTemplate[]; // daily baseline + day focus (dedup)
}

/** 위험요인 플래그 (safety_screenings 컬럼과 1:1 매칭) */
export interface DietRiskFlags {
  pregnancyBreastfeeding: boolean;
  diabetesMedication: boolean;
  eatingDisorderRisk: boolean;
  otherConditions?: string | null;
}

export interface DietEligibilityContext {
  isYouth: boolean;                     // 18세 미만
  risk: DietRiskFlags;
  coachApproved: boolean;               // 코치가 심화 옵션을 승인했는지
  consentAccepted: boolean;
}

export interface DietHabitResponses {
  protein_first?: boolean | null;
  veggies_natural?: boolean | null;
  sugary_drink_avoided?: boolean | null;
  late_night_snack_avoided?: boolean | null;
  gym_attended?: boolean | null;
}

// ──────────────────────────────────────────────────────────────────
// day → plan
// ──────────────────────────────────────────────────────────────────

/**
 * 주어진 트랙/day 로 오늘의 stage 와 미션 목록을 계산.
 * day 는 1~21 범위 밖일 경우 clamp 해서 가장 가까운 값으로 교정.
 */
export function getDailyPlan(
  track: DietTrack,
  day: number,
): DietDailyPlan {
  const clamped = clampDay(day);
  const stage = stageForDay(clamped);
  if (!stage) {
    // 방어: clampDay 가 1~21 을 보장하므로 실제로는 도달 불가.
    throw new Error(`invalid day after clamp: ${clamped}`);
  }
  const week = weekIndexForDay(clamped);
  if (!week) {
    throw new Error(`invalid week after clamp: ${clamped}`);
  }

  const set: DietTrackStageSet = DIET_MISSION_SETS[track][stage];
  const focus = set.focusByDay[clamped] ?? [];

  // daily baseline + focus, id 중복 제거 (안전장치)
  const seen = new Set<string>();
  const missions: DietMissionTemplate[] = [];
  for (const m of [...set.daily, ...focus]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      missions.push(m);
    }
  }

  return {
    track,
    day: clamped,
    stage,
    weekIndex: week,
    missions,
  };
}

function clampDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  if (day < 1) return 1;
  if (day > 21) return 21;
  return Math.trunc(day);
}

// ──────────────────────────────────────────────────────────────────
// 트랙 선택 정합성
// ──────────────────────────────────────────────────────────────────

/**
 * 사용자 입력을 서버 기대 값으로 정규화.
 *   • 청소년이면 무조건 youth_habit 강제
 *   • 성인이 advanced 를 요청했는데 활성 조건 미충족이면 adult_standard 로 하향
 *   • 입력이 null 이면 성인은 adult_standard, 청소년은 youth_habit 기본값
 */
export function sanitizeTrackSelection(
  requested: DietTrack | null,
  ctx: DietEligibilityContext,
): DietTrack {
  if (ctx.isYouth) return "youth_habit";
  if (!requested) return "adult_standard";

  if (requested === "youth_habit") {
    // 성인이 youth 를 명시적으로 고르는 건 허용하지 않음 — adult_standard 로 교체
    return "adult_standard";
  }

  if (requested === "adult_advanced_hidden") {
    return canActivateAdvanced(ctx) ? "adult_advanced_hidden" : "adult_standard";
  }

  // adult_standard
  return "adult_standard";
}

/**
 * adult_advanced_hidden 트랙 활성 가능 여부.
 * 성인 + 코치 승인 + 모든 위험요인 false + 동의 수락 모두 만족해야 true.
 */
export function canActivateAdvanced(ctx: DietEligibilityContext): boolean {
  if (ctx.isYouth) return false;
  if (!ctx.consentAccepted) return false;
  if (!ctx.coachApproved) return false;
  if (hasAnyRisk(ctx.risk)) return false;
  return true;
}

/** 위험요인 중 하나라도 true 인지. `otherConditions` 는 공백이 아닌 문자열일 때 true. */
export function hasAnyRisk(r: DietRiskFlags): boolean {
  if (r.pregnancyBreastfeeding) return true;
  if (r.diabetesMedication) return true;
  if (r.eatingDisorderRisk) return true;
  if (typeof r.otherConditions === "string" && r.otherConditions.trim() !== "") return true;
  return false;
}

// ──────────────────────────────────────────────────────────────────
// Habit score (0~100)
//   5 핵심 습관 응답을 토대로 간단 점수화. null/미응답은 0 으로 간주.
// ──────────────────────────────────────────────────────────────────

export function computeHabitScore(resp: DietHabitResponses): number {
  const fields: Array<keyof DietHabitResponses> = [
    "protein_first",
    "veggies_natural",
    "sugary_drink_avoided",
    "late_night_snack_avoided",
    "gym_attended",
  ];
  const hits = fields.reduce((acc, k) => acc + (resp[k] === true ? 1 : 0), 0);
  return Math.round((hits / fields.length) * 100);
}

// ──────────────────────────────────────────────────────────────────
// 편의: 오늘 날짜 기준 day index
// ──────────────────────────────────────────────────────────────────

/**
 * enrollment.start_date 와 '오늘' 을 받아 day index(1~21) 를 계산.
 * start_date > today 이면 1, 21 초과이면 21 로 clamp.
 */
export function computeDayIndex(
  startDate: string | Date,
  today: Date = new Date(),
): number {
  const sd = startDate instanceof Date ? startDate : new Date(startDate);
  if (Number.isNaN(sd.getTime())) return 1;
  const msPerDay = 24 * 60 * 60 * 1000;
  // 시간 제거 (로컬 날짜 기준)
  const sdMid = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
  const tdMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((tdMid.getTime() - sdMid.getTime()) / msPerDay);
  return clampDay(diff + 1);
}
