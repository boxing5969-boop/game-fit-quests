/**
 * 153 QUEST v1.5 14단계 — 컨디션별 오삼이 메시지 / 보조 퀘스트 추천.
 *
 * 정적 사전 — AI/스트리밍 호출 0건. ChatAssistant 미참조.
 * 공식 미션은 변경하지 않고, 보조 퀘스트 추천 우선순위와 문구만 컨디션별로
 * 분기한다.
 */

import type { BoxingConditionType } from "@/services/boxingEngagementService";

export interface ConditionGaugeOption {
  type: BoxingConditionType;
  emoji: string;
  label: string;
  shortLabel: string;
  desc: string;
}

export const CONDITION_OPTIONS: ConditionGaugeOption[] = [
  {
    type: "great",
    emoji: "💪",
    label: "컨디션 좋음",
    shortLabel: "좋음",
    desc: "오늘 한 라운드 더 들어갈 수 있는 날",
  },
  {
    type: "normal",
    emoji: "🙂",
    label: "보통",
    shortLabel: "보통",
    desc: "기본 루틴이 어울리는 날",
  },
  {
    type: "tired",
    emoji: "😮‍💨",
    label: "피곤함",
    shortLabel: "피곤",
    desc: "회복 위주로 가볍게",
  },
  {
    type: "pain",
    emoji: "🤕",
    label: "통증 있음",
    shortLabel: "통증",
    desc: "운동보다 회복·코치 상담이 먼저",
  },
  {
    type: "short_time",
    emoji: "⏱",
    label: "시간이 없음",
    shortLabel: "5분",
    desc: "5분이면 오늘의 라운드는 열립니다",
  },
];

export interface ConditionRecommendation {
  /** 오삼이 한줄 메시지 — 카드 헤더에 노출 */
  osamiMessage: string;
  /** 추천 카드 우선순위 (TodayQuestMiniPanel 정렬에 사용) */
  recommendation: Array<"academy" | "challenge" | "journal">;
  /** 보조 안내 한 줄 */
  hint: string;
  /** 고강도 챌린지 경고 표시 여부 (FunChallengeArenaSheet 에서 가시 안내용) */
  warnHighIntensity: boolean;
  /** 5 분 미니 퀘스트 강조 여부 */
  emphasizeShortQuest: boolean;
}

export const CONDITION_RECOMMENDATIONS: Record<
  BoxingConditionType,
  ConditionRecommendation
> = {
  great: {
    osamiMessage: "오늘은 도전형 라운드가 어울립니다.",
    recommendation: ["challenge", "academy", "journal"],
    hint: "컨디션이 좋습니다. 평소보다 한 라운드 더 들어가도 좋아요.",
    warnHighIntensity: false,
    emphasizeShortQuest: false,
  },
  normal: {
    osamiMessage: "기본 루틴으로 한 라운드만 클리어해봅시다.",
    recommendation: ["academy", "challenge", "journal"],
    hint: "퀴즈와 챌린지의 균형 잡힌 하루.",
    warnHighIntensity: false,
    emphasizeShortQuest: false,
  },
  tired: {
    osamiMessage: "오늘은 이기는 날보다 회복하는 날일 수 있어요.",
    recommendation: ["academy", "journal", "challenge"],
    hint: "복싱 IQ + 챔피언 일기로 머리를 먼저 깨우세요.",
    warnHighIntensity: true,
    emphasizeShortQuest: false,
  },
  pain: {
    osamiMessage: "통증이 있으면 운동보다 회복과 코치 상담이 우선입니다.",
    recommendation: ["academy", "journal"],
    hint: "고강도 챌린지는 비추천. 코치와 상담해보세요.",
    warnHighIntensity: true,
    emphasizeShortQuest: false,
  },
  short_time: {
    osamiMessage: "짧아도 괜찮습니다. 5분이면 오늘의 라운드는 열립니다.",
    recommendation: ["academy", "journal", "challenge"],
    hint: "복싱 IQ 1문제 + 일기 1줄이면 5분 안.",
    warnHighIntensity: false,
    emphasizeShortQuest: true,
  },
};

export function getConditionRecommendation(
  type: BoxingConditionType | null,
): ConditionRecommendation | null {
  if (!type) return null;
  return CONDITION_RECOMMENDATIONS[type] ?? null;
}

export function getConditionOption(
  type: BoxingConditionType | null,
): ConditionGaugeOption | null {
  if (!type) return null;
  return CONDITION_OPTIONS.find((o) => o.type === type) ?? null;
}

/** 통증 부위 칩 후보 (선택 입력) */
export const PAIN_AREA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "wrist", label: "손목" },
  { value: "shoulder", label: "어깨" },
  { value: "elbow", label: "팔꿈치" },
  { value: "back", label: "허리" },
  { value: "knee", label: "무릎" },
  { value: "ankle", label: "발목" },
  { value: "neck", label: "목" },
  { value: "other", label: "기타" },
];
