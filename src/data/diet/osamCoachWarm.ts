/**
 * 153 다이어트 · 오삼 코치의 따뜻한 한마디 풀.
 *
 * 용도: OsamCoachPopup — 지치고 힘든 회원에게 랜덤 위로 메시지 제공.
 * 톤 규칙:
 *   · 부드러운 존댓말, 다그치지 않기
 *   · 운동/복싱에 대한 부정적 비교 금지 ("운동보다 ~이 낫다" 금지)
 *   · 가벼운 행동 제안 포함 (물 한 잔, 심호흡, 섀도우 30초 등)
 *   · 체중 숫자 언급 최소화 — 감정·리듬 중심
 */

export interface WarmLine {
  text: string;
}

export const OSAM_WARM_LINES: readonly WarmLine[] = Object.freeze([
  { text: "오늘 여기까지 온 것만으로도 잘하고 있어요. 제가 옆에서 지켜볼게요." },
  { text: "잠시 어깨에 힘 빼고 숨 크게 세 번. 그리고 물 한 잔. 시작은 늘 작아요." },
  { text: "어제보다 1% 만 나아도 충분합니다. 완벽은 오늘의 목표가 아니에요." },
  { text: "체중계는 감정을 모릅니다. 오늘의 당신을 가장 잘 아는 건 당신 자신이에요." },
  { text: "흔들리는 날도 계획의 일부예요. 다음 끼니로 다시 이어가면 됩니다." },
  { text: "복싱 장갑 한 번 끼우는 순간, 머릿속 잡음이 제일 먼저 녹아요. 링이 기다립니다." },
  { text: "하루 한 라운드만 잡아도 오늘은 이긴 날이에요. 3분이면 충분합니다." },
  { text: "스스로에게 친절해도 돼요. 코치님도 실수하면서 배웠습니다." },
  { text: "지금 잠깐 쉬어가도 감량은 계속됩니다. 리듬은 내일이 맞춰줄 거예요." },
  { text: "오늘 힘들었다면, 내일은 한 걸음만 더. 아주 작은 한 걸음이면 돼요." },
  { text: "당신이 멈추지 않는다는 것 자체가 가장 강력한 자산입니다." },
  { text: "체크인을 못 한 날도 괜찮아요. 중요한 건 다시 돌아오는 속도입니다." },
  { text: "식단이 무너진 날엔 물 500ml · 단백질 한 끼 · 섀도우 1분. 이 세 개면 회복돼요." },
  { text: "감량은 직선이 아니라 물결이에요. 오르락내리락 끝에 아래로 향합니다." },
  { text: "지금 느끼는 피곤은 몸이 변화를 흡수하는 신호예요. 수면 한 시간 더." },
  { text: "복싱은 타이밍의 예술이라 했죠. 당신의 타이밍은 내일도 있습니다." },
  { text: "한 라운드 섀도우 후 거울을 보면, 이미 어제의 당신이 아니에요." },
  { text: "누군가의 기준이 아니라 어제의 나를 이기면 됩니다. 그게 진짜 챔피언." },
  { text: "지금 이 순간, 포기하지 않은 당신이 가장 멋져요. 제가 보증합니다." },
  { text: "3분 섀도우 · 3분 기록 · 3분 정리. 9분이면 오늘을 뒤집을 수 있어요." },
]);

/** 오늘 날짜·사용자 id 조합 시드로 결정적 한 개 픽. */
export function pickWarmLine(userId?: string | null, date: Date = new Date()): WarmLine {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  let seed = y * 10000 + m * 100 + d;
  // user id 의 char code 합을 더해 회원별로 다른 메시지
  if (userId) {
    for (const ch of userId) seed += ch.charCodeAt(0);
  }
  const idx = Math.abs(seed) % OSAM_WARM_LINES.length;
  return OSAM_WARM_LINES[idx];
}
