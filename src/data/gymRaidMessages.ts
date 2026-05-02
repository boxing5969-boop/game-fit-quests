/**
 * 153 QUEST v2 21단계 — 짐 레이드 정적 메시지.
 *
 * 톤 원칙:
 *   · "혼자보다 함께"
 *   · 공식 승급과 무관 — 지점 커뮤니티 목표 명시
 */

import type { GymRaidType } from "@/services/boxingEngagementService";

export const GYM_RAID_DISCLAIMER =
  "이 레이드는 공식 승급 조건이 아닌 지점 커뮤니티 목표입니다.";

export const GYM_RAID_OSAMI_LINES: readonly string[] = [
  "오늘의 기록이 우리 지점 레이드에 더해졌습니다.",
  "혼자 100개보다 함께 10,000개가 더 오래 남습니다.",
  "내 한 라운드가 지점 목표를 만듭니다.",
];

export const RAID_TYPE_LABEL: Record<GymRaidType, string> = {
  quiz_correct: "복싱 IQ 정답",
  challenge_clear: "챌린지 클리어",
  cheer_sent: "세컨드 응원 보내기",
  journal_write: "챔피언 일기 작성",
  quest_xp: "QUEST XP 누적",
  respect_points: "RP 누적",
};

export const RAID_TYPE_EMOJI: Record<GymRaidType, string> = {
  quiz_correct: "🧠",
  challenge_clear: "🥊",
  cheer_sent: "👏",
  journal_write: "📖",
  quest_xp: "⭐",
  respect_points: "🎖",
};

export function getRaidTypeLabel(type: GymRaidType): string {
  return RAID_TYPE_LABEL[type] ?? type;
}

export function getRaidTypeEmoji(type: GymRaidType): string {
  return RAID_TYPE_EMOJI[type] ?? "🎯";
}

export function pickGymRaidOsamiLine(seed: string | number): string {
  const numSeed =
    typeof seed === "number"
      ? seed
      : Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0);
  return GYM_RAID_OSAMI_LINES[
    Math.abs(numSeed) % GYM_RAID_OSAMI_LINES.length
  ];
}
