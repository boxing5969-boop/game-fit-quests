/**
 * 153 다이어트 — 코치 메시지 템플릿 카탈로그 (자체 작성 문구).
 *
 * 톤 규칙
 *   • 복귀/격려 위주 — "한 번 놓쳐도 다음 끼니부터" 기본 방향.
 *   • "주의 필요" 수준의 운영 플래그는 가능, 질병 진단 문구 금지.
 *   • 모든 카피는 앱 컨텍스트에 맞춰 재구성 — 외부 자료 복붙 없음.
 */

import type { DietCoachNoteTemplate } from "@/lib/dietTrack";

export interface CoachTemplateItem {
  id: string;
  type: DietCoachNoteTemplate;
  label: string;
  body: string;
}

export const DIET_COACH_TEMPLATES: readonly CoachTemplateItem[] = Object.freeze([
  {
    id: "return",
    type: "general",
    label: "다시 시작 독려",
    body: "오늘 못 지켜도 다음 끼니부터 다시 시작해요. 꾸준함이 완벽함을 이깁니다.",
  },
  {
    id: "focus-sugar",
    type: "correction",
    label: "당 음료만 집중",
    body: "이번 주는 당 음료 하나만 잡아도 충분해요. 다른 건 그 다음에.",
  },
  {
    id: "focus-sleep",
    type: "correction",
    label: "수면 챙기기",
    body: "운동은 잘하고 있어요. 수면만 조금 더 챙겨 보면 회복이 빨라질 거예요.",
  },
  {
    id: "celebrate-week",
    type: "celebration",
    label: "한 주 잘했어요",
    body: "이번 주 기록 꾸준히 올려주셨네요. 리듬이 잡혀가고 있어요.",
  },
  {
    id: "warn-rest",
    type: "warning",
    label: "휴식 권장 (강한 훈련 주의)",
    body: "최근 체감 피로가 높아 보여요. 오늘은 강한 훈련보단 가벼운 회복 위주로 권해요.",
  },
  {
    id: "weekly-review",
    type: "weekly",
    label: "주간 리뷰 안내",
    body: "7일 차입니다. 한 주를 짧게 돌아보고 다음 주 한 가지만 집중할 항목을 정해볼까요?",
  },
] as const);
