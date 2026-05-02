/**
 * 153 QUEST v2 19단계 — 코너맨 매칭 정적 메시지.
 *
 * 톤 원칙:
 *   · 강요 금지 — 1:1 약한 압력만
 *   · "함께" 강조
 *   · 공식 승급과 무관한 커뮤니티 기능 명시
 */

export interface CornermanCopy {
  cardHeadline: string;
  cardSub: string;
  emptyHint: string;
  pendingReceivedHint: string;
  pendingSentHint: string;
  activeHeadline: string;
  bothCompletedHint: string;
  oneCompletedHint: string;
  noneCompletedHint: string;
  bonusClaimedHint: string;
}

export const CORNERMAN_COPY: CornermanCopy = {
  cardHeadline: "코너맨",
  cardSub: "혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다.",
  emptyHint: "같은 지점 회원에게 코너맨 요청을 보내보세요.",
  pendingReceivedHint: "코너맨 요청이 도착했습니다. 수락 또는 거절을 선택해주세요.",
  pendingSentHint: "보낸 요청이 응답을 기다리고 있습니다. 7일 후 자동 만료됩니다.",
  activeHeadline: "오늘도 함께 링에 오릅니다",
  bothCompletedHint:
    "둘 다 오늘 라운드를 클리어했습니다. 코너 보너스가 열렸습니다.",
  oneCompletedHint:
    "오늘 코너맨도 곧 링에 오릅니다. 응원의 메시지를 보내볼까요?",
  noneCompletedHint:
    "오늘은 아직 둘 다 라운드를 시작하지 않았습니다. 가벼운 한 라운드부터.",
  bonusClaimedHint:
    "오늘 코너 보너스는 이미 받았습니다. 내일 또 함께 라운드를 클리어해봅시다.",
};

export const CORNERMAN_DISCLAIMER =
  "코너맨은 공식 승급 조건이 아닌 커뮤니티 기능입니다. 공식 레벨업은 기존 훈련 미션과 코치 승인 기준으로 진행됩니다.";

export const CORNERMAN_OSAMI_LINES: readonly string[] = [
  "혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다.",
  "오늘 코너맨도 링에 올랐습니다.",
  "둘 다 오늘의 라운드를 클리어하면 코너 보너스가 열립니다.",
  "쉬운 라운드라도 함께 클리어하는 게 의미 있습니다.",
  "동료의 한 라운드가 내 다음 라운드를 만듭니다.",
];

export function pickCornermanOsamiLine(seed: string | number): string {
  const numSeed =
    typeof seed === "number"
      ? seed
      : Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0);
  return CORNERMAN_OSAMI_LINES[
    Math.abs(numSeed) % CORNERMAN_OSAMI_LINES.length
  ];
}

/** 화면 라벨 */
export const RANK_KOREAN_LABEL: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};
