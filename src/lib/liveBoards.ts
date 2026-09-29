/**
 * 라이브보드 번호 ↔ TV 주소 (2026-09-29) — 관리자 '라이브보드 고르기'·'미리보기'가 같은 규칙을 쓴다.
 *
 *   1 지금 운동 중 · 2 런칭 이벤트 · 3 회원 안내 카드뉴스 → 주소 끝에 번호 (/tv/{지점}/{번호})
 *   4 전체 한 화면 → 번호 없는 원래 주소 (/tv/{지점})
 */
export type LiveBoardNo = 1 | 2 | 3 | 4;

export const LIVE_BOARD_NOS: readonly LiveBoardNo[] = [1, 2, 3, 4];

export const isLiveBoardNo = (n: unknown): n is LiveBoardNo => n === 1 || n === 2 || n === 3 || n === 4;

/** branch 는 지점 코드(sunreung) 또는 한 글자 별칭(s) — TV 주소 규칙은 같다 */
export const tvBoardPath = (branch: string, no: LiveBoardNo): string =>
  no === 4 ? `/tv/${branch}` : `/tv/${branch}/${no}`;

export const LIVE_BOARD_PICKER_PATH = "/manager/live-board";
export const LIVE_BOARD_PREVIEW_PATH = "/manager/live-board/view";

export const liveBoardPreviewPath = (code: string, no: LiveBoardNo): string =>
  `${LIVE_BOARD_PREVIEW_PATH}?b=${encodeURIComponent(code)}&n=${no}`;
