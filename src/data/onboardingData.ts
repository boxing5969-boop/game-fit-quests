export interface OnboardingSlide {
  id: number;
  icon: string;
  title: string;
  body: string;
  subBody?: string;
  keywords: string[];
  trustNote?: string;
  cta?: string;
  ctaSub?: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 1,
    icon: "🥊",
    title: "153 랭크업 시스템은\n단순 운동 앱이 아닙니다",
    body: "복싱을 통해 체력, 기술, 태도, 꾸준함을 함께 성장시키는\n4리그 40레벨 성장 시스템입니다.",
    keywords: ["성장", "구조", "꾸준함"],
  },
  {
    id: 2,
    icon: "💥",
    title: "왜 복싱인가",
    body: "복싱은 전신을 쓰는 운동입니다.\n체력, 집중력, 리듬, 민첩성, 자기통제를\n함께 키우는 데 도움이 되는 스포츠입니다.",
    keywords: ["전신운동", "집중력", "자기통제"],
  },
  {
    id: 3,
    icon: "🧱",
    title: "꾸준함은 감이 아니라\n구조에서 나옵니다",
    body: "153 랭크업 시스템은 출석, 세션, 미션, 리그, 심사를 분리해\n단계적으로 성장하도록 설계되었습니다.",
    keywords: ["출석", "미션", "심사"],
  },
  {
    id: 4,
    icon: "📊",
    title: "과학적 원리를 참고한 설계",
    body: "이 프로그램은 WHO·CDC 등 공공 가이드라인이 강조하는\n규칙적 신체활동, 점진적 증가, 지속성의 원칙을\n참고해 설계되었습니다.",
    subBody: "성장기에는 매일의 활동 습관이,\n성인에게는 주간 누적 활동과 근력 활동이 중요합니다.",
    keywords: ["규칙성", "점진성", "지속성"],
    trustNote: "WHO·CDC 등 공공 가이드라인이 강조하는 신체활동 원칙 참고",
  },
  {
    id: 5,
    icon: "🏅",
    title: "이 앱의 핵심은\n리그와 레벨입니다",
    body: "화이트부터 블랙까지, 4개 리그와 40개 레벨을 거치며\n오늘의 작은 도전이 눈에 보이는 성장으로 연결됩니다.",
    keywords: ["리그", "레벨", "도전"],
  },
  {
    id: 6,
    icon: "🤝",
    title: "왜 코치 승인 시스템이\n있나요",
    body: "153 랭크업은 혼자 기록만 쌓는 앱이 아닙니다.\n관장님과 코치의 확인과 심사를 통해\n성장의 기준을 더 공정하고 신뢰 있게 만듭니다.",
    keywords: ["공정성", "신뢰", "승인"],
  },
  {
    id: 7,
    icon: "🏆",
    title: "끝은 완료가 아니라\n증명입니다",
    body: "이 여정의 끝은 단순한 운동 완료가 아니라,\n과정을 완주하고 스스로의 성장과 수준을\n증명하는 데 있습니다.",
    keywords: ["완주", "증명", "성장"],
    trustNote: "규칙적 신체활동, 점진적 증가, 지속성을 반영한 구조",
  },
  {
    id: 8,
    icon: "🔥",
    title: "오늘의 작은 시작이\n내일의 리그를 바꿉니다",
    body: "체육관 체크인부터 오늘 도전 시작, 그리고 오늘의 미션까지.\n지금의 한 걸음이 다음 레벨의 기반이 됩니다.",
    keywords: [],
    cta: "🥊 시작하기",
    ctaSub: "온보딩 다시 보기",
  },
];
