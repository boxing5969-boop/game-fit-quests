/**
 * 🌱 오늘의 1분 성장 — 글 한 편의 모양 (2026-11-16 1단계: 달마다 파일로 나눔)
 *   글은 달마다 파일(./YYYY-MM.ts) 하나 — 고르기 · 받기는 ../growthLessons.ts 한 곳.
 */

export interface GrowthDirection {
  title: string;
  body: string;
}

export interface GrowthSource {
  /** 출처 이름 — 화면에 그대로 */
  name: string;
  /** 원문 주소 — 있으면 누르면 열린다 */
  url?: string;
}

/** O/X 문제 — 서랍을 열면 먼저 보이고, 하나를 고르면 이야기가 열린다 */
export interface GrowthQuiz {
  /** 문제 문장 ("문제." · "(O / X)" 없이) */
  q: string;
  answer: "O" | "X";
}

export interface GrowthLesson {
  /** 글 이름 — 이 기기 · 서버 읽음 기록의 열쇠라 바꾸지 않는다 (소문자 · 숫자 · 줄표, 40자 안) */
  id: string;
  /** 보이기 시작하는 날 (KST, YYYY-MM-DD) — 날마다 글은 그 글이 보이는 날 */
  from: string;
  /** 주제 — 카드 작은 글 (날마다 글은 요일 코너 이름) */
  theme: string;
  /** 큰 제목 */
  title: string;
  /** 서랍 제목 아래 한 줄 */
  hook: string;
  /** 1분 이야기 (문단) — O/X 글은 "정답은 O예요." / "정답은 X예요." 로 시작한다 */
  story: string[];
  /** 오늘 해 볼 것 (날마다 글은 하나) */
  directions: GrowthDirection[];
  /** 마무리 한 줄 */
  pledge: string;
  /** '오늘의 글'로 보이는 날 수 — 날마다 글은 1 (없으면 NEWEST_LESSON_DAYS) */
  days?: number;
  /** 출처 — 원문을 열어 확인한 것만 */
  sources?: GrowthSource[];
  /** O/X 문제 (화요일 「복싱 상식 O/X」) */
  quiz?: GrowthQuiz;
  /** (2단계) 코치 「오늘의 한마디」 — 코치님이 수업 시작이나 마무리에 말할 한 문장 (40자 안 · O/X 글은 답을 말하지 않게).
   *  없으면 '오늘 하나' 제목으로 대신한다(lib/growthStage2 coachLineOf) */
  coach?: string;
}

/** 요일 코너 이름 — 0 = 일요일 */
export const GROWTH_CORNERS: readonly string[] = [
  "한 주 돌아보기",
  "이번 주 한 가지",
  "복싱 상식 O/X",
  "기술 한 끗",
  "몸이 받는 선물",
  "링 위의 이야기",
  "집에서 1분",
];

/** 요일 — 0 = 일요일 (날짜 글자 그대로, 시간대와 상관없이) */
export const weekdayOf = (ymd: string): number => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** 그날의 요일 코너 이름 */
export const cornerOf = (ymd: string): string => GROWTH_CORNERS[weekdayOf(ymd)];

/** 날마다 글 한 편 — 하루만 보이고, 코너는 그날 요일에서 나온다 (코너와 요일이 어긋날 수 없게) */
export const daily = (l: Omit<GrowthLesson, "days" | "theme">): GrowthLesson => ({ ...l, theme: cornerOf(l.from), days: 1 });
