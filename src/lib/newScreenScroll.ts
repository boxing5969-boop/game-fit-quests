/**
 * 새 화면은 맨 위부터 — 그대로 두기 표시 (components/NewScreenScrollTop · 2026-11-19)
 *   새 화면이 앞 화면의 스크롤 자리를 지켜야 할 때만: navigate(to, { state: KEEP_SCROLL_STATE })
 */
export const KEEP_SCROLL_STATE = { keepScroll: true } as const;

/** 주소 state 에 그대로 두기 표시가 있나 */
export const keepsScroll = (state: unknown): boolean =>
  !!state && typeof state === "object" && (state as { keepScroll?: unknown }).keepScroll === true;
