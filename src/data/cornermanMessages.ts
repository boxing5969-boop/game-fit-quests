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
  cardHeadline: "운동 짝꿍",
  cardSub: "혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다.",
  emptyHint: "같은 지점 회원에게 짝꿍 요청을 보내보세요.",
  pendingReceivedHint: "짝꿍 요청이 왔어요. 수락하거나 거절해 주세요.",
  pendingSentHint: "보낸 요청이 응답을 기다리고 있습니다. 7일 후 자동 만료됩니다.",
  activeHeadline: "오늘도 함께 링에 오릅니다",
  bothCompletedHint:
    "둘 다 오늘 운동을 마쳤어요. 짝꿍 보너스가 열렸어요.",
  oneCompletedHint:
    "짝꿍도 곧 운동하러 와요. 응원 한마디 보내볼까요?",
  noneCompletedHint:
    "오늘은 아직 둘 다 운동 전이에요. 가볍게 시작해 봐요.",
  bonusClaimedHint:
    "오늘 짝꿍 보너스는 이미 받았어요. 내일 또 같이 해요.",
};

export const CORNERMAN_DISCLAIMER =
  "운동 짝꿍은 커뮤니티 기능이라 공식 레벨업과 무관해요.";

export const CORNERMAN_OSAMI_LINES: readonly string[] = [
  "혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다.",
  "오늘 짝꿍도 운동했어요.",
  "둘 다 오늘 운동하면 짝꿍 보너스가 열려요.",
  "짧게라도 같이 하는 게 의미 있어요.",
  "짝꿍의 오늘이 나의 내일을 만들어요.",
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
