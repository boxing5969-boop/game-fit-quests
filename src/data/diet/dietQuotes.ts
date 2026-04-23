/**
 * 153 다이어트 · 로딩 오버레이용 명언·유머 풀.
 *
 * 사용처: /diet 진입 시 DietLoadingOverlay 에서 rotating 표기.
 * 톤: 명언은 동기 + 복귀 자가 격려, 유머는 가벼운 공감 · 과장된 현실 묘사.
 */

export type DietLine = { line: string; by: string; tone: "quote" | "humor" };

export const DIET_LINES: readonly DietLine[] = Object.freeze([
  // ─── 다이어트 명언 (quote) ─────────────────────────────────────
  { tone: "quote", line: "오늘의 체중이 아니라 오늘의 습관이 내일을 만든다.", by: "153 코치의 한마디" },
  { tone: "quote", line: "작은 변화가 오래가는 변화를 만든다.", by: "James Clear, Atomic Habits" },
  { tone: "quote", line: "굶지 말고 잘 먹어라 — 그게 이기는 길이다.", by: "Sports Nutrition Wisdom" },
  { tone: "quote", line: "다이어트는 이벤트가 아니라 라이프스타일이다.", by: "Dr. Mark Hyman" },
  { tone: "quote", line: "식단은 짧고, 결과는 길다.", by: "Coach's Corner" },
  { tone: "quote", line: "계획은 구원이고 즉흥은 대체로 실수다.", by: "Old Gym Wisdom" },
  { tone: "quote", line: "근육은 거짓말하지 않는다. 거울보다 정확하다.", by: "Dr. Layne Norton" },
  { tone: "quote", line: "체중은 매일 변하지만 습관은 한 방향으로 쌓인다.", by: "153 Coach" },
  { tone: "quote", line: "오늘 맛있는 것보다 내일 가벼운 몸이 진짜 행복이다.", by: "Koren Diet Proverb" },
  { tone: "quote", line: "완벽한 7일보다 불완전한 21일이 체지방을 더 줄인다.", by: "153 Coach" },
  { tone: "quote", line: "식사 첫 입을 단백질로 바꾸면 모든 게 바뀐다.", by: "Leidy 2015, JAMA" },
  { tone: "quote", line: "정체기는 몸이 바뀌고 있다는 신호다.", by: "Dr. Spencer Nadolsky" },

  // ─── 다이어트 유머 (humor) ────────────────────────────────────
  { tone: "humor", line: "다이어트의 최대 적은 냉장고 조명이다. 켜지면 배고파진다.", by: "익명의 다이어터" },
  { tone: "humor", line: "'오늘부터'는 항상 내일 시작된다. 오늘부터 진짜 시작해요.", by: "매일의 결심" },
  { tone: "humor", line: "살찌는 속도는 빛의 속도, 빠지는 속도는 지질시대 단위.", by: "상대성이론" },
  { tone: "humor", line: "치킨은 과학적으로 밤 10시에 가장 맛있다. 과학이다.", by: "야식 물리학" },
  { tone: "humor", line: "친구가 '한 조각만!' 하면 의심하세요. 전쟁 선포입니다.", by: "다이어트 경제학" },
  { tone: "humor", line: "체중계는 감정의 바로미터. 월요일엔 거짓말쟁이가 된다.", by: "월요병 연구소" },
  { tone: "humor", line: "야식 요정이 오늘도 찾아왔다. 정중히 돌려보내세요.", by: "심야의 식단 관리" },
  { tone: "humor", line: "포장 뜯기 전엔 무조건 '1인분 = 1개'로 읽힌다.", by: "시각적 착각" },
  { tone: "humor", line: "'이거 먹고 내일부터 시작'의 이거가 한 달째다.", by: "다이어트 시간론" },
  { tone: "humor", line: "식단 관리의 최대 적은 주말이다. 주말엔 월요일이 없다.", by: "주말 공허 이론" },
  { tone: "humor", line: "배고픔은 감정이고, 식욕은 습관이다. 둘 다 물 한잔이면 30%는 해결.", by: "기본 생리학" },
  { tone: "humor", line: "'이번 한 번만'이 누적되면 인생이 된다.", by: "누적 적분 이론" },
]);

/** 진입 시점에 시드를 고정해 오버레이 노출 동안 같은 순서로 순환. */
export function pickStartIndex(pool: readonly DietLine[] = DIET_LINES): number {
  return Math.floor(Math.random() * pool.length);
}
