import { BookOpen, FlaskConical, Map, Dumbbell, ShieldCheck, HelpCircle } from "lucide-react";

export interface GuideSection {
  id: string;
  label: string;
  icon: typeof BookOpen;
  path: string;
  description: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  { id: "program", label: "프로그램 소개", icon: BookOpen, path: "/guide/program", description: "153랭크업 철학과 리그 구조" },
  { id: "science", label: "과학적 설계", icon: FlaskConical, path: "/guide/science", description: "WHO·CDC·ACSM 기반 운동 설계" },
  { id: "value-map", label: "1~40 가치맵", icon: Map, path: "/guide/value-map", description: "레벨별 성장 가치와 해금 보상" },
  { id: "exercise-purpose", label: "왜 이 운동을 하나요?", icon: Dumbbell, path: "/guide/exercise-purpose", description: "훈련별 과학적 이유" },
  { id: "safety", label: "안전 가이드", icon: ShieldCheck, path: "/guide/safety", description: "안전한 시작을 위한 안내" },
  { id: "faq", label: "자주 묻는 질문", icon: HelpCircle, path: "/guide/faq", description: "궁금한 점을 확인하세요" },
];

export const FAQ_ITEMS = [
  {
    q: "작은 운동도 카운트되나요?",
    a: "네, 짧은 활동도 누적됩니다. WHO 권고안에 따르면 어떤 양의 신체 활동이든 건강에 이로우며, 조금이라도 움직이는 것이 전혀 안 하는 것보다 낫습니다.",
  },
  {
    q: "왜 주 2회 근력운동이 중요한가요?",
    a: "근력운동은 근육량 유지, 골밀도 보호, 대사 건강에 도움이 됩니다. ACSM은 주요 근육군을 포함한 근력운동을 주 2회 이상 권고합니다.",
  },
  {
    q: "중강도와 고강도는 어떻게 구분하나요?",
    a: "중강도(RPE 3~4)는 대화가 가능하지만 노래는 어려운 정도, 고강도(RPE 5~7)는 몇 마디 말한 뒤 숨을 고르는 정도입니다.",
  },
  {
    q: "가이드는 어디서 다시 보나요?",
    a: "하단 메뉴의 [가이드] 탭에서 언제든 프로그램 소개, 과학적 설계, 1~40 가치맵을 다시 확인할 수 있습니다.",
  },
  {
    q: "언제 레벨업하나요?",
    a: "각 레벨의 인정 세션 3회, 출석일 3일, 훈련 시간 150분을 달성하고 체크테스트를 통과하면 다음 레벨로 올라갑니다. 레벨 10마다 리그가 변경됩니다.",
  },
  {
    q: "왜 이 프로그램은 필수인가요?",
    a: "153복싱짐의 핵심 전략 프로그램입니다. 모든 회원이 체계적으로 성장할 수 있도록 설계되어 있으며, 수동 기록보다 훨씬 편리하고 공정합니다.",
  },
  {
    q: "왜 오늘 도전이 더 좋은 보상을 받나요?",
    a: "오늘 도전은 회원의 적극적인 참여를 장려합니다. 레벨업 진행은 동일하지만, 오늘 도전 시 보너스 +20XP와 연속 기록 등 추가 보상을 제공합니다.",
  },
  {
    q: "왜 코치 백업 모드가 있나요?",
    a: "모든 회원이 프로그램에 빠짐없이 참여하도록 보장합니다. 오늘 도전을 하지 않은 회원도 코치가 빠르게 확인하여 진행도를 기록합니다.",
  },
  {
    q: "왜 화이트 1~10은 반복적이면서도 단계적인가요?",
    a: "초기 단계는 운동 습관 형성이 가장 중요합니다. 쉽지만 반복을 통해 기초체력과 자세를 자연스럽게 몸에 익히는 구간입니다.",
  },
  {
    q: "왜 레벨업은 공정하게 같고, 보너스는 다를 수 있나요?",
    a: "레벨업 조건(XP, 세션, 출석)은 자가 도전이든 코치 백업이든 동일합니다. 하지만 적극적으로 참여하는 회원에게 추가 보너스를 제공하여 자발적 참여 문화를 만듭니다.",
  },
  {
    q: "왜 1~40 전체가 연결된 성장 경로인가요?",
    a: "화이트부터 블랙까지 40레벨은 기초체력 → 기본기 → 실전 → 코칭 역량으로 이어지는 하나의 완전한 성장 경로입니다. 각 레벨은 이전 레벨의 기반 위에 쌓입니다.",
  },
  {
    q: "리스타트 루틴은 무엇인가요?",
    a: "리스타트 루틴은 5일 이상 쉬었다가 다시 시작하는 회원을 위한 가벼운 복귀 전용 루틴입니다. 일반 미션과 분리되며, 레벨업 진행에는 포함되지 않지만 복귀 보너스 XP를 받을 수 있습니다. 완료 후 일반 훈련으로 자연스럽게 연결됩니다.",
  },
];
