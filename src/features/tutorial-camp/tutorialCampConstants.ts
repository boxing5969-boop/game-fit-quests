/**
 * 7일 스타터 캠프 — 상수 (단계 42).
 *
 * localStorage 키 / 이벤트 상한 / day 범위 등 모듈 공용 상수.
 *
 * 보호 원칙:
 *   · localStorage 키 변경 금지 (회원 진행 기록 호환성).
 *   · 153마인드셋 키 (myboxer.visualization.records) 와 prefix 분리.
 */

/** 캠프 데이터 스키마 버전. 미래 마이그레이션 분기 지점. */
export const TUTORIAL_VERSION = "v1" as const;

/** localStorage 키 — 변경 금지. */
export const STORAGE_STATE_KEY = "myboxer.tutorialCamp.v1.state";
export const STORAGE_EVENTS_KEY = "myboxer.tutorialCamp.v1.events";
export const STORAGE_DEV_PREVIEW_KEY = "myboxer.tutorialCamp.v1.devPreview";

/** 이벤트 로그 보관 상한 (FIFO — 최신 N 개만 유지). */
export const MAX_EVENTS = 500;

/** Day 범위. */
export const MIN_DAY = 1;
export const MAX_DAY = 7;

/** Step 최솟값. (Day 별 최댓값은 step 데이터(단계 43+) 에서 결정 — 본 모듈은 0 이상만 보장.) */
export const MIN_STEP = 0;
