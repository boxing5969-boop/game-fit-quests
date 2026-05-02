/**
 * 153 QUEST v2 20단계 — 그림자 복서 정적 메시지.
 *
 * 톤 원칙:
 *   · 남과 비교 금지 — 어제의 나와만
 *   · 부담 0 — 초보도 첫 30일 후 첫 보상
 *   · 공식 승급 무관 명시
 */

export const SHADOW_BOXER_DISCLAIMER =
  "그림자 복서는 공식 승급 조건이 아닙니다. 어제의 나와 비교하는 보조 성장 지표입니다.";

export const SHADOW_BOXER_OSAMI_LINES_IMPROVED: readonly string[] = [
  "30일 전의 당신을 이겼습니다. 오늘의 당신이 더 강해졌어요.",
  "어제의 나를 이긴 기록은 오래 남습니다.",
  "남을 이긴 기록보다 오래 남는 것은 어제의 나를 이긴 기록입니다.",
];

export const SHADOW_BOXER_OSAMI_LINES_NOT_IMPROVED: readonly string[] = [
  "이번 라운드는 실패가 아니라 다음 승부를 위한 데이터입니다.",
  "꾸준함도 강함입니다. 같은 강도를 유지하고 있습니다.",
  "그림자 복서는 매달 다시 도전할 수 있습니다.",
];

export const SHADOW_BOXER_OSAMI_LINES_NOT_READY: readonly string[] = [
  "아직 그림자 복서가 도착하지 않았습니다.",
  "30일이 지나면 과거의 당신과 마주합니다.",
  "지금은 가벼운 라운드부터 쌓아가세요.",
];

export function pickShadowBoxerOsamiLine(
  state: "improved" | "not_improved" | "not_ready",
  seed: string | number,
): string {
  const numSeed =
    typeof seed === "number"
      ? seed
      : Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0);

  let arr: readonly string[];
  if (state === "improved") arr = SHADOW_BOXER_OSAMI_LINES_IMPROVED;
  else if (state === "not_improved")
    arr = SHADOW_BOXER_OSAMI_LINES_NOT_IMPROVED;
  else arr = SHADOW_BOXER_OSAMI_LINES_NOT_READY;

  return arr[Math.abs(numSeed) % arr.length];
}

/** 지표 라벨에 어울리는 이모지 */
export const SHADOW_METRIC_EMOJI: Record<string, string> = {
  quiz: "🧠",
  challenge: "🥊",
  journal: "📖",
  cheer: "👏",
  return_round: "🔁",
  hidden_mission: "🏆",
};

export function getShadowMetricEmoji(key: string): string {
  return SHADOW_METRIC_EMOJI[key] ?? "📊";
}
