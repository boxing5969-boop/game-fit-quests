/**
 * ✉️ 첫 로그인 편지(회원 웰컴 · 코치) — 몇 번 보여 줄까 (2026-10-21 대표님: "최초 로그인하면 편지 보내 주잖아.
 *   편지 로그인 3회까지는 보이게 해 줘. 로그인 때는 앱 확인 차원에서 거의 대부분 건너뛰기를 해서")
 *
 *   · 앱에 들어올 때(접속 한 번 = 세션 한 번)마다 한 번씩, 처음 3번까지 보여 준다. 같은 접속 안에서는 다시 안 뜬다.
 *   · 닫는 방법(X · 바깥 · 아래 버튼)과 상관없이 '보여 준 횟수'로 센다 — 보여 주는 순간 1 늘린다.
 *   · 예전 방식(1번 보고 끝)으로 이미 본 계정은 1번 본 것으로 이어서 센다 → 남은 2번 더 뜬다.
 *   승급 편지(블루 · 레드 · 블랙)는 그대로 한 번.
 */
export const FIRST_LETTER_MAX_SHOWS = 3;

export interface FirstLetterState {
  /** 지금까지 보여 준 횟수 (저장된 값 — 없으면 null) */
  storedCount: number | null;
  /** 예전 방식으로 본 적이 있다 (옛 '봤음' 표시) */
  legacySeen: boolean;
  /** 이번 접속에서 이미 보여 줬다 */
  shownThisSession: boolean;
}

/** 지금까지 보여 준 횟수 — 저장값이 없으면 옛 표시로 추정 (봤으면 1, 아니면 0) */
export const firstLetterShownCount = (s: Pick<FirstLetterState, "storedCount" | "legacySeen">): number =>
  s.storedCount !== null && Number.isFinite(s.storedCount) && s.storedCount >= 0 ? Math.floor(s.storedCount) : s.legacySeen ? 1 : 0;

/** 이번 접속에 첫 로그인 편지를 띄울까 */
export const firstLetterDue = (s: FirstLetterState): boolean =>
  !s.shownThisSession && firstLetterShownCount(s) < FIRST_LETTER_MAX_SHOWS;

/** 저장된 문자열 → 횟수 (숫자가 아니면 null) */
export const parseShownCount = (raw: string | null): number | null => {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
