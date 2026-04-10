export interface ExerciseReason {
  id: string;
  name: string;
  emoji: string;
  whyDoIt: string;
  whatImproves: string[];
  beginnerCheckpoint: string;
}

export const EXERCISE_REASONS: ExerciseReason[] = [
  {
    id: "jump-rope",
    name: "줄넘기",
    emoji: "🪢",
    whyDoIt: "심폐지구력을 높이고 발목 탄성과 리듬감을 만들어 복싱 라운드에 적응하는 기초 훈련입니다.",
    whatImproves: ["심폐지구력", "리듬감", "발목 탄성"],
    beginnerCheckpoint: "2분 동안 멈추지 않고 뛸 수 있으면 기초 완료",
  },
  {
    id: "ladder",
    name: "사다리 훈련",
    emoji: "🪜",
    whyDoIt: "발의 정확한 위치와 협응성을 높이고 빠른 방향 전환 리듬을 만드는 훈련입니다.",
    whatImproves: ["발 정확성", "협응성", "방향 전환 리듬"],
    beginnerCheckpoint: "전진 패턴을 실수 없이 2세트 통과하면 기초 완료",
  },
  {
    id: "mirror-step",
    name: "제자리 복싱 스텝",
    emoji: "🪞",
    whyDoIt: "자세와 가드를 유지하면서 중심 안정을 만드는 기초 스텝 훈련입니다.",
    whatImproves: ["자세 유지", "가드 유지", "중심 안정"],
    beginnerCheckpoint: "2분 동안 가드를 내리지 않고 스텝을 밟을 수 있으면 기초 완료",
  },
  {
    id: "side-step",
    name: "사이드 스텝",
    emoji: "↔️",
    whyDoIt: "좌우 이동 능력을 키워 밸런스와 회피 준비 자세를 만드는 훈련입니다.",
    whatImproves: ["좌우 이동 능력", "밸런스", "회피 준비"],
    beginnerCheckpoint: "좌우 이동 시 자세가 무너지지 않으면 기초 완료",
  },
  {
    id: "lower-circuit",
    name: "하체 서킷",
    emoji: "🦵",
    whyDoIt: "하체 지구력과 버티는 힘, 균형 능력을 키워 안정적인 스텝의 기반을 만듭니다.",
    whatImproves: ["하체 지구력", "버티는 힘", "균형"],
    beginnerCheckpoint: "스쿼트 15회 × 2세트를 완료할 수 있으면 기초 완료",
  },
  {
    id: "guard",
    name: "가드 유지",
    emoji: "🛡️",
    whyDoIt: "안전한 훈련의 기본이며, 방어 습관과 기본자세를 유지하는 핵심 훈련입니다.",
    whatImproves: ["안전", "기본자세", "방어 습관"],
    beginnerCheckpoint: "60초 동안 가드를 유지할 수 있으면 기초 완료",
  },
  {
    id: "cooldown",
    name: "쿨다운",
    emoji: "🧊",
    whyDoIt: "훈련 후 회복을 돕고 다음 훈련을 위해 몸을 준비시키는 마무리 과정입니다.",
    whatImproves: ["회복", "마무리", "다음 훈련 준비"],
    beginnerCheckpoint: "운동 후 3~5분 스트레칭을 빠짐없이 하면 습관 완료",
  },
];
