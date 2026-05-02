/**
 * 153 QUEST v1.5 15단계 — 리턴 라운드 정적 메시지/톤.
 *
 * 톤 원칙:
 *   · "혼내지 않는다"
 *   · "돌아온 것 자체가 오늘의 승리"
 * 금지 문구:
 *   · "운동을 안 하셨네요" / "결석" / "미션을 놓쳤습니다"
 */

import type { ReturnRoundType } from "@/services/boxingEngagementService";

export interface ReturnRoundCopy {
  bannerHeadline: string;
  bannerSub: string;
  ctaLabel: string;
  sheetTitle: string;
  sheetIntro: string;
  rewardLine: string;
  closingMessage: string;
}

export const RETURN_ROUND_COPY: Record<ReturnRoundType, ReturnRoundCopy> = {
  after_3_days: {
    bannerHeadline: "다시 돌아왔습니다",
    bannerSub: "3일 만이군요. 가볍게 시작해요.",
    ctaLabel: "리턴 라운드 시작",
    sheetTitle: "3일 복귀 라운드",
    sheetIntro:
      "쉬었던 3일은 회복이었습니다. 오늘은 가볍게 한 라운드만 들어가요.",
    rewardLine: "QUEST XP +30 · 파이트 머니 +100",
    closingMessage: "돌아온 것부터 오늘의 승리입니다.",
  },
  after_7_days: {
    bannerHeadline: "한 주만에 다시 링으로",
    bannerSub: "잘 돌아왔어요. 무리하지 말고 가볍게.",
    ctaLabel: "리턴 라운드 시작",
    sheetTitle: "7일 복귀 라운드",
    sheetIntro:
      "한 주의 휴식이 있었습니다. 오늘은 강하게보다 가볍게 다시 시작합니다.",
    rewardLine: "QUEST XP +60 · 파이트 머니 +200",
    closingMessage: "쉬었던 시간보다 중요한 건 다시 시작한 오늘입니다.",
  },
  after_14_days: {
    bannerHeadline: "2주 만에 링이 다시 열렸습니다",
    bannerSub: "회복 라운드부터 천천히 시작해봐요.",
    ctaLabel: "리턴 라운드 시작",
    sheetTitle: "14일 복귀 라운드",
    sheetIntro:
      "2주의 공백이 있었습니다. 무리하지 말고 회복 위주로 진행해주세요. 통증이 있으면 코치 상담을 권장합니다.",
    rewardLine: "QUEST XP +80 · 파이트 머니 +300",
    closingMessage: "천천히 회복하면서 갑시다.",
  },
  after_30_days: {
    bannerHeadline: "한 달 만에 다시 돌아왔습니다",
    bannerSub: "오늘은 새로운 챕터의 1라운드입니다.",
    ctaLabel: "리스타트 시작",
    sheetTitle: "30일+ 리스타트 챕터",
    sheetIntro:
      "한 달 이상의 휴식이 있었습니다. 공식 훈련은 코치와 상의 후 진행하시고, 오늘은 보조 퀘스트로 가볍게 다시 출발해요.",
    rewardLine: "QUEST XP +100 · 파이트 머니 +500",
    closingMessage: "링은 언제나 다시 시작할 수 있게 열려 있습니다.",
  },
};

export function getReturnRoundCopy(
  type: ReturnRoundType | null,
): ReturnRoundCopy | null {
  if (!type) return null;
  return RETURN_ROUND_COPY[type] ?? null;
}
