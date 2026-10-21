/**
 * 🧪 시범 지점 — 새 기능을 먼저 여는 지점 (2026-10-14 대표님: "잠실점 역삼점은 일단 빼줘 — 테스트는 선릉점에서만 하고 역삼 잠실은 나중에")
 *
 * DB public.pilot_branch_names() 와 같은 목록이다 — 지점을 열 때 둘 다 고친다.
 * 이 목록으로 여는 기능:
 *   · 프로필 사진 첫 등록 보상 — 서버가 판정한다 (get_my_avatar_reward 의 open, claim 의 not_open)
 *   · 화이트 타이틀매치 (회원 신청 · 지점장 영상 심사) — 서버 title_match_flow_enabled_for + 화면 isTitleFlowFor
 *   · TV 라이브보드 사진 — 입장 환영 화면 · 얼굴/QR 출석 카드 (LiveBoardPage)
 * 다른 지점은 어제와 같다: 화이트 레벨 10은 담당 코치님이 심사 항목을 확인해 승인 (level_gate_authority_for).
 * 2026-10-21 대표님: "칠금점은 같이 테스트" → 범위 "선릉역점과 똑같이" — 칠금점 추가 (DB 20261021101537_chilgeum_pilot_branch).
 */
export const PILOT_BRANCHES: readonly string[] = ["153복싱짐 선릉역점", "153복싱짐 칠금점"];

/** 지점 이름이 시범 지점인가 (DB 와 같게 정확히 같은 이름만) */
export const isPilotBranch = (branch: string | null | undefined): boolean =>
  !!branch && PILOT_BRANCHES.includes(branch);
