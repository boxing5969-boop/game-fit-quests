/**
 * 153 다이어트 · 실패 복귀(Comeback) 미션 풀.
 *
 * 철학: 실패는 벌이 아니라 데이터.
 *   · 한 번 무너졌을 때 얼마나 빨리 돌아오느냐가 핵심
 *   · 오늘 1개만 완료해도 "복구 성공"
 *   · 죄책감 자극 금지 · 다그치지 않기
 *
 * 하나만 체크해도 오늘은 이긴 날. 4개 전부 하면 bonus.
 */

export interface ComebackMission {
  code: string;
  emoji: string;
  label: string;
  hint: string;
}

export const COMEBACK_MISSIONS: readonly ComebackMission[] = Object.freeze([
  {
    code: "next_meal_light",
    emoji: "🥗",
    label: "다음 끼니 가볍게",
    hint: "단백질 + 채소 위주. 탄수는 평소의 반만. 양치처럼 해두는 기본 리셋.",
  },
  {
    code: "water_500",
    emoji: "💧",
    label: "물 500mL",
    hint: "작은 생수 1병. 허기·포만감 혼동이 제일 먼저 사라집니다.",
  },
  {
    code: "walk_15",
    emoji: "🚶",
    label: "15분 걷기",
    hint: "밖이든 안이든 OK. 심박 살짝 올리는 것만으로 호르몬 리듬이 잡혀요.",
  },
  {
    code: "one_mission_today",
    emoji: "✅",
    label: "오늘은 미션 1개만",
    hint: "포기하지 않으면 됩니다. 단백질 먼저 · 물 1.5L · 복싱 중 뭐든 1개.",
  },
  {
    code: "breathe_3min",
    emoji: "🌬️",
    label: "3분 심호흡",
    hint: "4초 들이쉬고 6초 내쉬기. 야식·폭식 충동은 이 3분으로 꺾입니다.",
  },
  {
    code: "sleep_by_23",
    emoji: "🌙",
    label: "23시 이전 취침",
    hint: "하루를 다시 태울 수 없다면 가장 빠른 리셋은 잠입니다.",
  },
]);

/** 오삼 코치의 복귀 메시지 풀 — 랜덤 1개. */
export const COMEBACK_WARM_LINES: readonly string[] = Object.freeze([
  "괜찮아요. 누구나 그래요. 지금부터 복구하면 됩니다.",
  "오늘이 끝난 게 아니에요. 여기 미션 1개만 해도 오늘은 이긴 날.",
  "무너진 건 데이터예요. 다음 끼니만 잡으면 됩니다.",
  "완벽보다 복귀 속도. 그게 진짜 챔피언의 습관이에요.",
  "한 번 멈춘 건 끝이 아니라 쉼표. 이제 다시 시작해요.",
  "과거는 수정할 수 없지만, 다음 30분은 당신 손에 있어요.",
]);

export function pickComebackLine(date: Date = new Date()): string {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() + date.getHours();
  return COMEBACK_WARM_LINES[Math.abs(seed) % COMEBACK_WARM_LINES.length];
}
