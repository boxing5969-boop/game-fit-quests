/**
 * 🌱 오늘의 1분 성장 교육 — 홈 카드 (2026-10-27 대표님: "내가 공유한 정보를 복싱에 대입해서
 *   오늘의 1분 성장 교육이라고 하고 방향에 대해 알려주자")
 *
 *   대표님이 공유한 글(육아 · 공부 습관 등)에서 '생각'만 가져와 복싱 · 운동 습관으로 옮겨 쓴다.
 *   원문 문장이나 남의 이름은 옮기지 않는다 — 우리 말로 새로 쓴다.
 *
 *   새 교육은 배열 맨 앞에 하나 더 넣는다. from = 보이기 시작하는 날(KST).
 *   가장 최근 교육이 7일 동안 '오늘의 교육'이고, 그 뒤로 새 교육이 없으면 날마다 돌아가며 보인다(todayLesson).
 */

export interface GrowthDirection {
  title: string;
  body: string;
}

export interface GrowthLesson {
  id: string;
  /** 보이기 시작하는 날 (KST, YYYY-MM-DD) */
  from: string;
  /** 주제 — 카드 작은 글 */
  theme: string;
  /** 큰 제목 */
  title: string;
  /** 카드 한 줄 */
  hook: string;
  /** 1분 이야기 (문단) */
  story: string[];
  /** 오늘의 방향 — 오늘 해 볼 것 */
  directions: GrowthDirection[];
  /** 마무리 한 줄 */
  pledge: string;
}

export const GROWTH_LESSONS: readonly GrowthLesson[] = [
  {
    id: "show-first",
    from: "2026-10-27",
    theme: "말보다 먼저 보여 주기",
    title: "말보다 먼저, 내가 한 라운드",
    hook: "“운동해” 백 번보다, 내가 먼저 뛰는 모습 한 번",
    story: [
      "아이에게 공부하라고 말하는 대신, 같은 문제집을 한 권 더 사서 엄마가 먼저 풀었다는 이야기가 있어요. 아이는 엄마의 말이 아니라 엄마의 모습을 보고 따라 했어요.",
      "복싱도 같아요. 사람은 말보다 행동을 보고 배워요. 가족에게, 친구에게, 그리고 어제의 나에게 ‘해야지’라고 말하는 것보다 오늘 내가 먼저 글러브를 끼는 모습이 훨씬 큰 힘을 가져요.",
      "누군가를 바꾸고 싶다면 내 작은 습관 하나부터. 그게 성장의 방향이에요.",
    ],
    directions: [
      {
        title: "먼저 보여 주기",
        body: "가족에게 “운동 좀 해” 하기 전에 거실에서 줄넘기 1라운드(3분)를 먼저 해 보세요. 보고 있던 아이도 같이 뛰고 싶어져요.",
      },
      {
        title: "배운 걸 말로 설명해 보기",
        body: "오늘 코치님께 배운 동작 하나를 가족 · 친구에게 설명해 보세요. 설명할 수 있어야 진짜 내 기술이 돼요.",
      },
      {
        title: "바쁜 날에도 10분",
        body: "체육관에 못 오는 날은 쉐도우 복싱 10분. 쉬지 않는 작은 습관이 실력을 지켜 줘요.",
      },
      {
        title: "어려운 건 짧게 쪼개기",
        body: "긴 콤비네이션도 원 · 투부터. 한 동작씩 익히면 어느새 자연스럽게 이어져요.",
      },
    ],
    pledge: "내가 먼저 움직이면, 함께하는 사람도 움직여요.",
  },
];

/** 가장 최근 교육이 '오늘의 교육'인 기간 (일) */
export const NEWEST_LESSON_DAYS = 7;

const dayNumber = (ymd: string): number => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);

/**
 * 오늘(KST) 보여 줄 교육 — 아직 시작 안 한 교육(from > today)은 빼고,
 * 가장 최근 교육이 NEWEST_LESSON_DAYS 안이면 그것, 지났으면 날마다 돌아가며.
 */
export function todayLesson(today: string, lessons: readonly GrowthLesson[] = GROWTH_LESSONS): GrowthLesson | null {
  const live = lessons.filter((l) => l.from <= today).sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0));
  if (live.length === 0) return null;
  const newest = live[0];
  const age = dayNumber(today) - dayNumber(newest.from);
  if (age < NEWEST_LESSON_DAYS || live.length === 1) return newest;
  return live[((age % live.length) + live.length) % live.length];
}
