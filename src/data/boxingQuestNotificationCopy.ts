/**
 * 153 QUEST v1.5 17단계 — 푸시 알림 문구 카탈로그.
 *
 * ⚠ 본 파일은 data 카탈로그만 — 실제 push 발송 시스템은 v2 이후로 미룬다.
 * OS 권한 / 토큰 관리 / Edge 스케줄러 인프라 신규 구축 금지.
 *
 * 사용 시점:
 *   v2 푸시 인프라 작업 시 카테고리별로 가져다 쓰는 라이브러리 역할.
 */

export type NotificationCategory =
  | "app_open"
  | "quiz_available"
  | "challenge_available"
  | "return_round"
  | "journal_reminder"
  | "cheer_received"
  | "hidden_mission_claimed"
  | "weekly_report_ready";

export const BOXING_QUEST_NOTIFICATION_COPY: Record<
  NotificationCategory,
  readonly string[]
> = {
  app_open: [
    "오늘의 라운드가 열렸습니다. 오삼이가 기다리고 있어요.",
    "링은 언제나 열려 있습니다. 한 라운드만 들어가볼까요?",
    "오늘은 어떤 펀치를 던질까요?",
  ],
  quiz_available: [
    "복싱 IQ 1문제가 준비됐습니다. 알고 치는 펀치는 더 강합니다.",
    "오늘의 복싱 퀴즈가 도착했습니다.",
    "머리로 먼저 링에 올라보세요.",
  ],
  challenge_available: [
    "오늘의 챌린지 라운드가 열렸습니다.",
    "잽 30회 / 원투 10세트 — 짧아도 괜찮습니다.",
    "5분이면 충분한 도전 라운드, 들어가볼까요?",
  ],
  return_round: [
    "돌아온 것을 환영합니다. 오늘은 가볍게 다시 시작해요.",
    "쉬었던 시간보다 중요한 건 다시 시작한 오늘입니다.",
    "리턴 라운드가 열렸습니다. 무리하지 말고 천천히.",
  ],
  journal_reminder: [
    "오늘의 한 줄을 남겨보세요.",
    "느낀 것을 기록하는 복서는 오래 갑니다.",
    "한 줄이면 충분합니다.",
  ],
  cheer_received: [
    "응원이 도착했습니다. 링 위에서 혼자가 아닙니다.",
    "동료가 박수를 보냈습니다.",
    "세컨드의 응원 — 코너에서 일으켜 세워주는 한 마디.",
  ],
  hidden_mission_claimed: [
    "숨겨진 미션 발견! 예상하지 못한 좋은 행동도 성장입니다.",
    "오늘의 숨은 보상이 도착했습니다.",
  ],
  weekly_report_ready: [
    "이번 주 성장 리포트가 준비됐습니다.",
    "한 주의 라운드를 정리해드렸습니다.",
  ],
};

/**
 * 결정적 선택 — 하루 안에서 동일 카테고리는 같은 문구.
 * v2 push 작업 시 user_id + KST_date + category 시드로 안정화.
 */
export function pickNotificationCopy(
  category: NotificationCategory,
  seed: string | number,
): string {
  const arr = BOXING_QUEST_NOTIFICATION_COPY[category];
  if (!arr || arr.length === 0) return "";
  const numSeed =
    typeof seed === "number"
      ? seed
      : Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0);
  return arr[Math.abs(numSeed) % arr.length];
}
