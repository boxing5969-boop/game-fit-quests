export interface SafetyBlock {
  id: string;
  emoji: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "danger";
}

export const SAFETY_BLOCKS: SafetyBlock[] = [
  {
    id: "no-overdo",
    emoji: "🟢",
    title: "무리하지 않기",
    description: "처음에는 가볍게 시작하세요. 몸이 적응할 시간을 주는 것이 가장 효과적인 방법입니다.",
    severity: "info",
  },
  {
    id: "pain-adjust",
    emoji: "🟡",
    title: "통증이 있으면 강도 조절",
    description: "관절이나 근육에 통증이 느껴지면 강도를 낮추거나 해당 동작을 건너뛰세요.",
    severity: "warning",
  },
  {
    id: "stop-symptoms",
    emoji: "🔴",
    title: "어지러움, 흉통, 호흡 곤란 시 중단",
    description: "이런 증상이 나타나면 즉시 운동을 멈추고 코치에게 알려주세요. 안전이 가장 중요합니다.",
    severity: "danger",
  },
  {
    id: "start-easy",
    emoji: "🟢",
    title: "초보자는 쉬운 강도부터 시작",
    description: "처음부터 높은 강도로 할 필요가 없습니다. 스타터 모드에서 천천히 시작해도 충분합니다.",
    severity: "info",
  },
  {
    id: "intensity-guide",
    emoji: "📊",
    title: "중간 강도와 고강도 구분법",
    description: "중간 강도(RPE 3~4): 대화 가능, 노래 어려움. 고강도(RPE 5~7): 몇 마디 후 숨 고르기. 자신에게 맞는 강도를 선택하세요.",
    severity: "info",
  },
  {
    id: "disclaimer",
    emoji: "⚕️",
    title: "의학적 진단이나 치료가 아닙니다",
    description: "이 프로그램은 운동 가이드이며, 의학적 진단이나 치료를 제공하지 않습니다. 건강 상태가 걱정되면 운동 시작 전에 전문가와 상담하세요.",
    severity: "warning",
  },
];
