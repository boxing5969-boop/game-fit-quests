/**
 * 👀 회원으로 보기 — 대표님(전체관리자 · 관리자) 계정이 앱 전체를 일반 회원 화면으로 본다 (2026-10-21 대표님: "내 계정은 모든 기능에 회원으로 보기 기능을 넣어 줘")
 *
 *   켜면 AuthContext 의 role 이 'member' 로 바뀐다 → role 을 읽는 모든 화면(메뉴 · 하단 탭 · 홈 · 관리자 버튼 · 관리자 전용 주소)이
 *   회원과 똑같이 보인다. 진짜 역할은 realRole 로 남는다 — '회원으로 보기' 스위치 · 아래 띠 · 자동 편지 끄기에만 쓴다.
 *   서버 권한은 그대로다(로그인은 대표님 계정). 서버가 관리자에게 더 주는 목록 중 커뮤니티 피드는 회원 피드(그 지점)로 바꿔 읽는다.
 *   켜짐 여부는 이 기기 · 이 계정에만 저장한다 (localStorage) — 다른 폰에서는 꺼진 채로 열린다.
 */

/** 회원으로 보기를 쓸 수 있는 계정 — 본사(전체관리자 · 관리자) */
export const canViewAsMember = (realRole: string | null | undefined): boolean =>
  realRole === "super_admin" || realRole === "admin";

/** 화면이 쓰는 역할 — 회원으로 보기 중이면 'member' */
export function effectiveRole<R extends string>(realRole: R | null, on: boolean): R | "member" | null {
  if (!realRole) return realRole;
  return on && canViewAsMember(realRole) ? "member" : realRole;
}

/** 이 기기에 저장하는 키 (계정마다) */
export const viewAsMemberKey = (uid: string) => `153view:as-member:${uid}`;

export function readViewAsMember(uid: string | null | undefined): boolean {
  if (!uid) return false;
  try {
    return window.localStorage.getItem(viewAsMemberKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function writeViewAsMember(uid: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(viewAsMemberKey(uid), "1");
    else window.localStorage.removeItem(viewAsMemberKey(uid));
  } catch {
    /* 저장이 막힌 브라우저 — 이번 접속에만 적용 */
  }
}

/** '153복싱짐 선릉역점' → '선릉역점' */
export const viewBranchLabel = (branch: string | null | undefined): string =>
  (branch || "").replace(/^153복싱짐\s*/, "").trim() || "지점 미지정";
