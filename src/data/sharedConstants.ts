import { Award, Shield } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

export const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
export const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
export const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

export const SECRET_MISSIONS = [
  {
    id: "secret-1",
    icon: Award,
    emoji: "🏅",
    title: "한국복싱협회 단증 심사관",
    subtitle: "심사관이 되어 후배를 이끄세요",
    description: "한국복싱협회 공인 단증 심사관 자격을 취득하세요. 승단 신청서를 작성하고 도전하세요!",
    cta: "🥊 도전하기!",
    linkTo: "https://korea-boxing.lovable.app",
    isExternal: true,
  },
  {
    id: "secret-2",
    icon: Shield,
    emoji: "🛡️",
    title: "인증 복싱코치 자격증",
    subtitle: "공식 코치로 인정받으세요",
    description: "한국 코치협회 인증 복싱코치 자격증을 획득하세요. 승단 신청서를 작성하고 도전하세요!",
    cta: "🥊 도전하기!",
    linkTo: "https://korea-boxing.lovable.app",
    isExternal: true,
  },
];

export const DAN_CHALLENGES = [
  { rank: "white", dan: "1단", message: "화이트 10레벨 달성! 🥊\n1단 단증에 도전하세요!", emoji: "🥇" },
  { rank: "blue", dan: "2단", message: "블루 10레벨 달성! 🥊\n2단 단증에 도전하세요!", emoji: "🥈" },
  { rank: "red", dan: "3단", message: "레드 10레벨 달성! 🥊\n3단 단증에 도전하세요!", emoji: "🥉" },
  { rank: "black", dan: "4단", message: "블랙 10레벨 달성! 🥊\n4단 단증에 도전하세요!", emoji: "🏆" },
];

export const FINAL_REWARDS = [
  { emoji: "💰", label: "153복싱짐 50% 영구 할인" },
  { emoji: "🏆", label: "명예의 전당 입성" },
  { emoji: "🔐", label: "명예의 전당 전용 락카" },
  { emoji: "👕", label: "운동복 평생 무료 제공" },
  { emoji: "🌐", label: "153복싱짐 홈페이지 명예의 전당" },
];
