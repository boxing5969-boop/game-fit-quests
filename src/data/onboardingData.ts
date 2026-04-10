export interface OnboardingSlide {
  id: number;
  icon: string;
  title: string;
  body: string;
  accent?: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 1,
    icon: "🥊",
    title: "당신의 1~40레벨 성장 여정이 시작됩니다",
    body: "153랭크업은 1레벨에서 40레벨까지, 몸과 기술을 단계적으로 성장시키는 복싱 성장 앱입니다.",
    accent: "1 → 40",
  },
  {
    id: 2,
    icon: "📊",
    title: "과학적 기준을 이해하기 쉽게 번역했습니다",
    body: "이 프로그램은 WHO·CDC·ACSM 권고안을 참고해 활동량, 근력, 강도, 회복을 균형 있게 쌓도록 설계했습니다.",
    accent: "WHO·CDC·ACSM",
  },
  {
    id: 3,
    icon: "🌱",
    title: "조금씩 시작해도 괜찮습니다",
    body: "작은 활동도 누적됩니다. 꾸준함이 가장 큰 변화를 만듭니다.",
    accent: "꾸준함",
  },
  {
    id: 4,
    icon: "💪",
    title: "1회의 운동도 가치가 있습니다",
    body: "오늘의 운동은 수면, 기분, 불안감, 혈압 관리에 바로 도움을 줄 수 있습니다.",
    accent: "오늘 바로",
  },
  {
    id: 5,
    icon: "🏅",
    title: "레벨은 단순 출석이 아니라 성장입니다",
    body: "화이트는 습관과 체력, 블루는 기본기, 레드는 적용, 블랙은 전문가와 코칭 역량을 만듭니다.",
    accent: "4리그 × 10레벨",
  },
  {
    id: 6,
    icon: "📖",
    title: "이 설명은 언제든 다시 볼 수 있습니다",
    body: "프로그램 소개, 과학적 설계, 1~40 가치맵은 [가이드]에서 항상 다시 확인할 수 있습니다.",
    accent: "가이드",
  },
];

export const INTENSITY_INFO = [
  { label: "중강도", description: "대화 가능, 노래 어려움", rpe: "RPE 3~4" },
  { label: "고강도", description: "몇 마디 말하고 숨 고르기", rpe: "RPE 5~7" },
];
