/**
 * 7일 스타터 캠프 — 모션 상수 + reduced motion 헬퍼 (단계 44).
 *
 * 새 npm 패키지 0 — framer-motion / 기본 CSS 만 활용.
 */

/** 스포트라이트 padding (px) — target 영역 외부 여백 */
export const SPOTLIGHT_PADDING = 8;

/** 스포트라이트 모서리 둥글기 (px) */
export const SPOTLIGHT_RADIUS = 12;

/** Pulse ring 한 사이클 길이 (ms) */
export const PULSE_DURATION_MS = 1600;

/** Hand pointer bounce 길이 (ms) */
export const POINTER_BOUNCE_MS = 1000;

/** Step 전환 페이드 길이 (ms) */
export const STEP_FADE_MS = 250;

/** Dim 배경 색 / 투명도 */
export const DIM_COLOR = "rgba(10, 16, 36, 0.78)";

/** 색 토큰 (153마인드셋 톤 통일) */
export const COLOR_AMBER = "#fdb85c";
export const COLOR_AMBER_SOFT = "rgba(253, 184, 92, 0.45)";
export const COLOR_ROSE = "#a40e1a";

/**
 * prefers-reduced-motion 감지.
 * SSR 안전 + matchMedia 미지원 환경 false 반환.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
