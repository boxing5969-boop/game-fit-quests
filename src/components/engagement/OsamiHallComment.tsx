/**
 * 153 QUEST — 나만의 복싱 전당: 오삼이 정적 코멘트.
 *
 * summary 값에 따라 미리 정의된 메시지 1개를 정적으로 선택한다.
 * AI/스트리밍/RPC 호출 0건. ChatAssistant 미참조.
 */

export interface OsamiHallCommentInput {
  questXp: number;
  questCorrect: number;
  challengeClear: number;
  respect: number;
  journalCount: number;
}

export interface OsamiHallCommentProps {
  summary: OsamiHallCommentInput;
}

function pickComment({
  questXp,
  questCorrect,
  challengeClear,
  respect,
  journalCount,
}: OsamiHallCommentInput): string {
  if (questXp === 0) {
    return "오늘의 보조 퀘스트를 하나만 클리어해보세요. 작은 기록이 습관을 만듭니다.";
  }
  // 강조 우선순위: 일기 → 응원 → 챌린지 → 퀴즈
  if (journalCount >= 7) {
    return "챔피언은 훈련만 기록하지 않습니다. 느낀 것도 기록합니다.";
  }
  if (respect >= 50) {
    return "응원도 실력입니다. 당신은 링의 분위기를 만드는 복서입니다.";
  }
  if (challengeClear >= 10) {
    return "도전 기록이 늘고 있습니다. 어제의 나와 계속 싸우고 있네요.";
  }
  if (questCorrect >= 10) {
    return "알고 치는 펀치가 강합니다. 복싱 IQ가 쌓이고 있어요.";
  }
  return "오늘의 한 줄, 한 라운드, 한 박수 — 작게 자주 쌓아가세요.";
}

const OsamiHallComment = ({ summary }: OsamiHallCommentProps) => {
  const message = pickComment(summary);

  return (
    <div className="rounded-card border border-border bg-card px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="text-base">🥊</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오삼 코치
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OsamiHallComment;
