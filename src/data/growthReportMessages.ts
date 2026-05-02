/**
 * 153 QUEST v1.5 17단계 — 성장 리포트 정적 메시지/오삼 코멘트.
 *
 * 정적 사전 — AI 호출 0건. 학부모/코치용 한 줄도 정적 매핑.
 */

export interface GrowthReportContext {
  questXp: number;
  questCorrect: number;
  challengeClear: number;
  journalCount: number;
  cheerSent: number;
  hiddenMissionClaimedCount: number;
  hasReturnRound: boolean;
  conditionLogCount: number;
}

/**
 * 활동 패턴 기반 오삼 코멘트 (1~2 줄).
 * 결정성: 같은 input 이면 항상 같은 결과 반환.
 */
export function pickGrowthReportOsamiComment(
  ctx: GrowthReportContext,
): string {
  if (ctx.hasReturnRound) {
    return "돌아온 것 자체가 오늘의 승리였습니다.";
  }
  if (ctx.questCorrect >= 30) {
    return "알고 치는 펀치가 강합니다. 머리로 먼저 이기는 복서.";
  }
  if (ctx.challengeClear >= 5) {
    return "도전 기록이 늘고 있습니다. 흔들리지 않는 발.";
  }
  if (ctx.cheerSent >= 10) {
    return "응원도 실력입니다. 코너에서 동료를 일으켜 세우는 사람.";
  }
  if (ctx.journalCount >= 5) {
    return "느낀 것을 기록하는 복서는 오래 갑니다.";
  }
  if (ctx.conditionLogCount >= 3) {
    return "몸을 읽는 복서가 멀리 갑니다.";
  }
  return "오늘도 한 걸음. 꾸준함이 결국 챔피언을 만듭니다.";
}

/**
 * 학부모/코치용 한 줄 요약.
 */
export function pickParentCoachOneLiner(ctx: GrowthReportContext): string {
  if (ctx.cheerSent >= 10) {
    return "응원 활동이 많아 팀 분위기에 긍정적으로 기여했습니다.";
  }
  if (ctx.questCorrect >= 30 && ctx.challengeClear >= 3) {
    return "복싱 지식과 도전 참여가 함께 늘고 있습니다.";
  }
  if (ctx.challengeClear >= 5) {
    return "이번 기간 도전 라운드 참여가 두드러집니다.";
  }
  if (ctx.questCorrect >= 30) {
    return "복싱 학습 누적이 우수합니다.";
  }
  if (ctx.journalCount >= 5) {
    return "느낀 점을 꾸준히 기록하는 점이 인상적입니다.";
  }
  if (ctx.hasReturnRound) {
    return "공백 후 다시 복귀해 활동을 이어가고 있습니다.";
  }
  return "이번 기간 가장 눈에 띄는 성장은 꾸준함입니다.";
}

/**
 * 면책 문구 (3 줄) — 성장 리포트 카드/시트에 노출.
 */
export const GROWTH_REPORT_DISCLAIMERS: readonly string[] = [
  "이 리포트는 공식 승급 심사가 아니라 성장 요약입니다.",
  "공식 레벨업은 기존 훈련 미션과 코치 승인 기준으로 진행됩니다.",
  "QUEST 기록은 습관과 몰입을 보여주는 보조 성장 지표입니다.",
];
