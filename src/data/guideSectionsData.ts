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
    a: "각 레벨의 미션을 완료하고 코치의 승인을 받으면 다음 레벨로 올라갑니다. 레벨 10마다 리그가 변경됩니다.",
  },
];
