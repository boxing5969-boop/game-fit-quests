/**
 * 라이브보드 TV 열쇠 (2026-09-22 QR 출석 → 2026-10-19 회원 정보 잠그기에도 같이 쓴다)
 *
 *   TV 를 /tv/<지점>?k=<열쇠> 로 한 번 열면 이 기기에 지점별로 남는다(localStorage).
 *   서버(_board_branch_ok)는 지점에 열쇠가 걸려 있으면 열쇠가 맞는 TV 와 로그인한 그 지점 운영진에게만
 *   QR 토큰·오늘 출석·회원 카드 정보를 준다. 열쇠가 걸리기 전에는 열쇠 없이도 열린다
 *   (대기 열쇠로 처음 연 순간 잠긴다 — 관리자 앱 › 라이브보드에서 열쇠 주소를 본다: get_board_tv_key).
 */

const storeKey = (branchName: string) => `153_board_key:${branchName}`;

/** 주소의 ?k= 를 먼저, 없으면 이 기기에 남은 열쇠 */
export function readBoardKey(branchName: string): string | null {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get("k");
  } catch {
    /* noop */
  }
  if (fromUrl) {
    try {
      localStorage.setItem(storeKey(branchName), fromUrl);
    } catch {
      /* 저장소가 막혀도 주소의 열쇠는 그대로 쓴다 */
    }
    return fromUrl;
  }
  try {
    return localStorage.getItem(storeKey(branchName));
  } catch {
    return null;
  }
}

/** 서버가 '열쇠가 필요한 TV'라고 거절했는지 */
export const isBoardKeyError = (e: unknown): boolean =>
  String((e as { message?: string } | null)?.message ?? "").includes("board_key_required");

/** TV 시작 페이지에 넣을 열쇠 주소 — 예: myboxer153.com/tv/s/1?k=abcd1234 */
export const boardKeyUrl = (domain: string, path: string, key: string): string =>
  `${domain}${path}?k=${encodeURIComponent(key)}`;
