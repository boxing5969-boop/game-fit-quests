export interface ExerciseReason {
  id: string;
  name: string;
  emoji: string;
  purposeSummary: string;
  purposeTags: string[];
}

export const EXERCISE_REASONS: ExerciseReason[] = [
  {
    id: "jump-rope",
    name: "줄넘기",
    emoji: "🪢",
    purposeSummary: "심폐지구력을 높이고 발목 탄성과 리듬감을 만들어 라운드에 적응하는 기초 훈련입니다.",
    purposeTags: ["심폐지구력", "리듬감", "발목 탄성", "라운드 적응력"],
  },
  {
    id: "ladder",
    name: "사다리",
    emoji: "🪜",
    purposeSummary: "발의 정확성과 협응성을 높이고 빠른 방향 전환 리듬을 만드는 훈련입니다.",
    purposeTags: ["발 정확성", "협응성", "방향 전환 리듬"],
  },
  {
    id: "mirror-step",
    name: "거울 앞 제자리 스텝",
    emoji: "🪞",
    purposeSummary: "자세와 가드를 유지하면서 중심 흔들림을 줄이는 기초 스텝 훈련입니다.",
    purposeTags: ["자세 유지", "가드 유지", "중심 안정"],
  },
  {
    id: "side-step",
    name: "사이드 스텝",
    emoji: "↔️",
    purposeSummary: "좌우 이동 능력을 키워 거리 조절과 각도 변화의 기초를 만드는 훈련입니다.",
    purposeTags: ["좌우 이동", "거리 조절", "각도 변화"],
  },
  {
    id: "lower-circuit",
    name: "하체 서킷",
    emoji: "🦵",
    purposeSummary: "하체 지구력과 균형 능력을 향상시켜 안정적인 스텝과 펀치 파워의 기반을 만듭니다.",
    purposeTags: ["하체 지구력", "균형", "펀치 파워 기반"],
  },
];

/** Map exercise ID to reason - for integration with mission cards */
export const EXERCISE_REASON_MAP: Record<string, ExerciseReason> = Object.fromEntries(
  EXERCISE_REASONS.map(r => [r.id, r])
);
