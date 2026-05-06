/**
 * 7일 스타터 캠프 — 타입 정의 (단계 42).
 *
 * 본 파일은 타입만. 실행 코드 0.
 * Storage / Events / Utils 모두 본 타입을 import 해 사용.
 */

import type { TUTORIAL_VERSION } from "./tutorialCampConstants";

// ─────────────────────────────────────────────────────────────
// 캠프 상태
// ─────────────────────────────────────────────────────────────

export type TutorialCampStatus =
  | "not_started"
  | "active"
  | "completed"
  | "skipped"
  | "paused";

export interface TutorialCampState {
  /** 스키마 버전 — 마이그레이션 분기 지점 */
  tutorialVersion: typeof TUTORIAL_VERSION;
  status: TutorialCampStatus;
  /** 1..7 (clamp 적용) */
  currentDay: number;
  /** 0 이상 */
  currentStep: number;
  /** 완료한 day 번호 — 중복 없음, 정렬 보장 */
  completedDays: number[];
  /** 스킵한 day 번호 — 중복 없음, 정렬 보장 */
  skippedDays: number[];
  /** ISO. 캠프 첫 시작 시점 */
  startedAt: string | null;
  /** ISO. Day 7 완료식 통과 시점 */
  completedAt: string | null;
  /** ISO. 마지막 day skip / 전체 skip 시점 */
  skippedAt: string | null;
  /** ISO. 마지막 진입 시각 */
  lastSeenAt: string | null;
  /** completed 회원이 다시 보기 모드로 진입했을 때 true */
  replayMode: boolean;
  /** 개발자 preview 모드 — 회원 UI 안 노출 */
  devPreviewMode: boolean;
  /** 향후 확장용 자유 필드 */
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// 이벤트 로그
// ─────────────────────────────────────────────────────────────

export type TutorialCampEventType =
  | "shown"
  | "target_clicked"
  | "step_completed"
  | "day_completed"
  | "skipped"
  | "resumed"
  | "reset"
  | "completed_all"
  | "dev_set_state";

export interface TutorialCampEvent {
  id: string;
  tutorialVersion: typeof TUTORIAL_VERSION;
  day: number | null;
  step: number | null;
  eventType: TutorialCampEventType;
  /** 이벤트 발생 시 라우트 (window.location.pathname). 모를 때 null */
  routePath: string | null;
  /** step 의 영구 식별자 — 예: "day1.home_osami_briefing" */
  targetKey: string | null;
  /** step 데이터의 actionType 사본 — "read" / "click" / "navigate" 등 */
  actionType: string | null;
  /** 자유 필드 (이유 / target selector / fallback 사유 등) */
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** appendTutorialCampEvent 호출 시 입력 형태 — id / createdAt 자동 생성. */
export interface AppendEventInput {
  day?: number | null;
  step?: number | null;
  eventType: TutorialCampEventType;
  routePath?: string | null;
  targetKey?: string | null;
  actionType?: string | null;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Dev preview
// ─────────────────────────────────────────────────────────────

export interface TutorialCampDevPreview {
  day: number;
  step: number;
  enabledAt: string;
}
