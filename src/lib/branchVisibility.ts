/**
 * 지점 표시 켜기/끄기 (2026-10-15 대표님: "선릉점을 제외한 지점은 테스트하지 않아 데이터 낭비 —
 * 마이복서153에서 보이지 않게, 153본사도 없애고 선릉역점만. 설정에서 온오프").
 *
 * branches.is_visible (DB 20261015143000_branch_visibility.sql). 꺼진 지점은 지점 선택 목록 · 관리자 지점 칩 ·
 * 지점 비교에서 빠지고, 서버의 '전 지점' 랭킹 · 명예의 전당 · 153 챌린지 전체에서도 빠진다.
 * 지점을 지우는 게 아니다 — 회원 · 출석 · 얼굴 인식 · TV 는 그대로, 켜면 바로 돌아온다.
 */
export const isVisibleBranch = (b: { is_visible?: boolean | null } | null | undefined): boolean =>
  !!b && b.is_visible !== false;
