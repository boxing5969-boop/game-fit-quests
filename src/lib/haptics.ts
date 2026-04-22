/**
 * Tiny haptic feedback utility.
 *
 * `navigator.vibrate` 는 Android Chrome / Samsung Internet 등에서 지원,
 * iOS Safari 에서는 미지원 (silently noop). SSR / 데스크탑에서도 안전.
 * 실패/미지원 시 throw 하지 않도록 전부 try-catch 로 감싼다.
 */

const canVibrate = (): boolean =>
  typeof navigator !== "undefined" && "vibrate" in navigator;

const safeVibrate = (pattern: number | number[]): void => {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 일부 브라우저는 vibrate 권한 오류 throw — UX 용이므로 무시. */
  }
};

/** 짧은 탭 (버튼 클릭 등). */
export const lightHaptic = () => safeVibrate(20);

/** 성공/완료 (3-pulse 시퀀스). */
export const successHaptic = () => safeVibrate([30, 40, 30, 40, 70]);

/** 축하/대박 — 입단식 완료 등 큰 이벤트용. */
export const celebrationHaptic = () => safeVibrate([40, 50, 40, 50, 40, 50, 120]);
