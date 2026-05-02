/**
 * 153 QUEST v1.5 16단계 — 숨겨진 미션 클라이언트 카탈로그/표시 매핑.
 *
 * DB seed 와 1:1 대응. 클라이언트에서 아이콘/그룹/오삼 코멘트 매핑용.
 * 서버 카탈로그가 진실의 원천이고, 본 파일은 UI 표시용 보강만 담당.
 */

export interface HiddenMissionDisplay {
  emoji: string;
  group: "cheer" | "comeback" | "quiz" | "journal" | "challenge" | "growth";
  osamiCelebration: string;
}

export const HIDDEN_MISSION_DISPLAY: Record<string, HiddenMissionDisplay> = {
  first_cheer: {
    emoji: "👏",
    group: "cheer",
    osamiCelebration: "응원도 실력입니다. 첫 박수를 보낸 당신, 이미 코너맨.",
  },
  comeback_record: {
    emoji: "🔁",
    group: "comeback",
    osamiCelebration: "돌아온 것 자체가 오늘의 승리였습니다.",
  },
  quiz_streak_3: {
    emoji: "🧠",
    group: "quiz",
    osamiCelebration: "3연속 정답. 알고 치는 펀치는 더 강합니다.",
  },
  journal_7: {
    emoji: "📖",
    group: "journal",
    osamiCelebration: "느낀 것을 기록하는 복서는 오래 갑니다.",
  },
  challenge_5: {
    emoji: "🥊",
    group: "challenge",
    osamiCelebration: "도전 기록이 늘고 있습니다. 흔들리지 않는 발.",
  },
  respect_30: {
    emoji: "🎖",
    group: "cheer",
    osamiCelebration: "세컨드의 마음이 챔피언을 만듭니다.",
  },
  balanced_boxer: {
    emoji: "⚖️",
    group: "growth",
    osamiCelebration: "균형 잡힌 복서. 머리·몸·마음·동료 — 모두 챙겼습니다.",
  },
  condition_7: {
    emoji: "🩺",
    group: "growth",
    osamiCelebration: "몸을 읽는 복서가 멀리 갑니다.",
  },
};

export function getHiddenMissionDisplay(
  code: string,
): HiddenMissionDisplay {
  return (
    HIDDEN_MISSION_DISPLAY[code] ?? {
      emoji: "🏆",
      group: "growth",
      osamiCelebration: "예상하지 못한 좋은 행동도 성장으로 기록됩니다.",
    }
  );
}

/**
 * IQ 등급 안내 (서버 grade 와 동일하게 분기).
 * 서버 grade 가 진실의 원천이고, 본 매핑은 UI 보조 표시용.
 */
export interface IqGradeDisplay {
  emoji: string;
  shortLabel: string;
  description: string;
}

export const IQ_GRADE_DISPLAY: Record<string, IqGradeDisplay> = {
  "복싱 입문생": {
    emoji: "🥚",
    shortLabel: "입문생",
    description: "0~9 정답 — 막 시작한 단계.",
  },
  "복싱 연구생": {
    emoji: "📘",
    shortLabel: "연구생",
    description: "10~29 정답 — 기본기 학습 중.",
  },
  "복싱 박사 후보": {
    emoji: "🎓",
    shortLabel: "박사 후보",
    description: "30~79 정답 — 깊이 있는 학습 단계.",
  },
  "링 전술가": {
    emoji: "🧠",
    shortLabel: "전술가",
    description: "80~149 정답 — 머리로 치는 복서.",
  },
  "복싱 IQ 마스터": {
    emoji: "🏅",
    shortLabel: "마스터",
    description: "150+ 정답 — 알고 치는 챔피언.",
  },
};

export function getIqGradeDisplay(grade: string): IqGradeDisplay {
  return (
    IQ_GRADE_DISPLAY[grade] ?? {
      emoji: "🥊",
      shortLabel: "복서",
      description: grade,
    }
  );
}
