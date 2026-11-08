/**
 * 라이브보드 번호 ↔ TV 주소 (2026-09-29) — 관리자 '라이브보드 고르기'·'미리보기'가 같은 규칙을 쓴다.
 *
 *   1 지금 운동 중 · 2 런칭 이벤트 · 3 회원 안내 카드뉴스 → 주소 끝에 번호 (/tv/{지점}/{번호})
 *   4 전체 한 화면 → 번호 없는 원래 주소 (/tv/{지점})
 *   pb1 153 PB 코스 · pb2 153 PB 기록 (2026-11-08) → /tv/{지점}/pb1 · pb2
 *   TV 번호마다 화면을 바꾸는 'TV 화면 바꾸기'는 lib/tvRemote (같은 번호 · 같은 주소 규칙).
 */
export type LiveBoardNo = 1 | 2 | 3 | 4;
/** 미리보기로 볼 수 있는 화면 — 번호 넷 + 153 PB 둘 */
export type LiveBoardId = LiveBoardNo | "pb1" | "pb2";

export const LIVE_BOARD_NOS: readonly LiveBoardNo[] = [1, 2, 3, 4];
export const LIVE_BOARD_IDS: readonly LiveBoardId[] = [1, 2, 3, 4, "pb1", "pb2"];

export const isLiveBoardNo = (n: unknown): n is LiveBoardNo => n === 1 || n === 2 || n === 3 || n === 4;
export const isLiveBoardId = (v: unknown): v is LiveBoardId => isLiveBoardNo(v) || v === "pb1" || v === "pb2";

/** 주소의 n= → 화면 ('pb1' · 'pb2' 또는 숫자) */
export const parseLiveBoardId = (raw: string | null): LiveBoardId | null => {
  if (raw === "pb1" || raw === "pb2") return raw;
  const n = Number(raw);
  return isLiveBoardNo(n) ? n : null;
};

/** '라이브보드 2' · '153 PB 코스' */
export const liveBoardTitle = (no: LiveBoardId): string =>
  no === "pb1" ? "153 PB 코스" : no === "pb2" ? "153 PB 기록" : `라이브보드 ${no}`;

/** 미리보기 고르기 단추 글자 (동그라미 안) */
export const liveBoardChip = (no: LiveBoardId): string => (no === "pb1" ? "P1" : no === "pb2" ? "P2" : String(no));

/** branch 는 지점 코드(sunreung) 또는 한 글자 별칭(s) — TV 주소 규칙은 같다 */
export const tvBoardPath = (branch: string, no: LiveBoardId): string =>
  no === 4 ? `/tv/${branch}` : `/tv/${branch}/${no}`;

export const LIVE_BOARD_PICKER_PATH = "/manager/live-board";
export const LIVE_BOARD_PREVIEW_PATH = "/manager/live-board/view";

export const liveBoardPreviewPath = (code: string, no: LiveBoardId): string =>
  `${LIVE_BOARD_PREVIEW_PATH}?b=${encodeURIComponent(code)}&n=${no}`;
