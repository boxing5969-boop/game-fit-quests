// 내 레벨 연습하기 — "오늘 연습 완료" 기록 (2026-09-28, 훈련 탭 오늘의 코스 3번).
//
// 연습 화면(MyLevelPractice)에서 "오늘 연습 완료"를 누르면 기기에 KST 날짜를 남기고,
// 오늘의 코스(CoachTodayCard) 3번이 그 값으로 완료 표시를 한다.
// 서버 스키마를 늘리지 않는다 — 영상 "따라했어요"(153_video_watched)와 같은 기기 저장 방식.
// 한 기기에서 여러 계정을 쓸 수 있어(체험용 계정 등) 회원별 키로 나눈다.
const KEY_PREFIX = "153_practice_day:";

/** 저장이 막힌 환경(사파리 시크릿 등)에서도 이번 실행 동안은 완료가 유지되도록 메모리에도 둔다 */
const memoryDay = new Map<string, string>();

const keyFor = (userId?: string | null) => `${KEY_PREFIX}${userId || "guest"}`;

/** KST 기준 오늘 날짜 "YYYY-MM-DD" — 기기 타임존과 무관 (해외 폰에서도 체육관 날짜와 같게) */
export const kstToday = (now: number = Date.now()): string =>
  new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const hasPracticedToday = (userId?: string | null): boolean => {
  const today = kstToday();
  const key = keyFor(userId);
  if (memoryDay.get(key) === today) return true;
  try {
    return localStorage.getItem(key) === today;
  } catch {
    return false;
  }
};

export const markPracticedToday = (userId?: string | null): void => {
  const key = keyFor(userId);
  const today = kstToday();
  memoryDay.set(key, today);
  try {
    localStorage.setItem(key, today);
  } catch {
    /* 저장 실패는 무시 — 메모리 값으로 이번 실행 동안은 완료 유지 */
  }
};
