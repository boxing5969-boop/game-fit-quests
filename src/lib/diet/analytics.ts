/**
 * 153 다이어트 — 분석 이벤트 상수.
 *
 * 실제 기록은 `log_diet_event` RPC (서비스 래퍼 `logDietEvent`).
 * 여기서는 이벤트 타입 문자열과 공용 payload 타입만 정의.
 *
 * 모든 이벤트는 best-effort — 실패해도 UX 차단하지 않는다.
 */

export const DIET_EVENT_TYPES = Object.freeze({
  ENROLLMENT_STARTED: "enrollment_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  DAILY_CHECKIN_COMPLETED: "daily_checkin_completed",
  MEAL_PHOTO_UPLOADED: "meal_photo_uploaded",
  HABIT_SCORE_UPDATED: "habit_score_updated",
  BADGE_EARNED: "badge_earned",
  COACH_NOTE_SENT: "coach_note_sent",
  PROGRAM_COMPLETED: "program_completed",
  DROP_OFF_MARKED: "drop_off_marked",
} as const);

export type DietEventType =
  (typeof DIET_EVENT_TYPES)[keyof typeof DIET_EVENT_TYPES];

/** 드롭오프 로컬 스토리지 키 — 동일 세션 중복 기록 방지용. */
export const DIET_DROP_OFF_FLAG_KEY = "diet_drop_off_flag_v1";
