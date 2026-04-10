export interface SafetyQuestion {
  id: string;
  question: string;
  riskFlag: boolean; // true = "예"가 위험 신호
}

export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  {
    id: "recent_exercise",
    question: "최근 3개월 이내에 규칙적으로 운동한 적이 있나요?",
    riskFlag: false, // "아니오"가 위험
  },
  {
    id: "chronic_condition",
    question: "심장 질환, 고혈압, 당뇨 등 기저질환이 있나요?",
    riskFlag: true,
  },
  {
    id: "dizziness",
    question: "운동 중 어지럼증이나 흉통을 경험한 적이 있나요?",
    riskFlag: true,
  },
  {
    id: "age_over_65",
    question: "65세 이상이신가요?",
    riskFlag: true,
  },
  {
    id: "high_intensity_goal",
    question: "처음부터 높은 강도로 운동하고 싶으신가요?",
    riskFlag: true,
  },
];

export const STARTER_MODE_MESSAGE =
  "최근 활동량이 적거나 몸 상태가 걱정된다면 스타터 모드부터 시작하세요. 짧고 안전한 강도로 시작해도 충분히 의미 있습니다.";

export const SAFETY_DISCLAIMER =
  "이 체크리스트는 의료 진단이 아닙니다. 건강 상태가 걱정되면 운동 시작 전에 전문가와 상담하세요.";
