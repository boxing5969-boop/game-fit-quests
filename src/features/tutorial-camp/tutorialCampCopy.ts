/**
 * 7일 스타터 캠프 — 공통 문구 (단계 43).
 *
 * 화면 전체에서 공유하는 라벨 / Day 제목 / 폴백 문구.
 * 보호 규칙:
 *   · 장소 표현 "153복싱짐" 만 사용
 *   · 금지어 0: 링 / 체육관 / 복싱장 / gym / RPG / 몬스터 / 전투 / 보스 / 판타지 / 레벨업
 *   · 오삼이 말투는 짧고 따뜻하게
 */

/** 회원에게 보이는 캠프 이름 */
export const CAMP_DISPLAY_NAME = "오삼이와 함께하는 7일 입문 캠프";

/** 내부 시스템명 (코드 / 디버깅용) */
export const CAMP_INTERNAL_NAME = "MyBoxer Tutorial Camp";

export type DayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_TITLES: Record<DayNumber, string> = {
  1: "홈에서 오늘을 시작하기",
  2: "공식 훈련과 마스터로드",
  3: "153 QUEST와 복싱 IQ",
  4: "챌린지와 안전 체크",
  5: "챔피언 일기",
  6: "세컨드 응원과 동료",
  7: "마이페이지와 7일 완료식",
};

export const DAY_SUBTITLES: Record<DayNumber, string> = {
  1: "홈 화면에서 오늘 무엇을 하면 되는지 익혀봐요.",
  2: "공식 훈련과 코치 승인 구조를 천천히 봐요.",
  3: "복싱 IQ로 가볍게 한 줄, 매일 챙겨요.",
  4: "오늘 컨디션에 맞는 챌린지를 안전하게 해봐요.",
  5: "한 줄 일기로 오늘의 나를 남겨요.",
  6: "동료에게 응원 한 번 보내봐요.",
  7: "그동안의 나를 보고, 7일 캠프를 마무리해요.",
};

export const DAY_COMPLETE_MESSAGES: Record<DayNumber, string> = {
  1: "Day 1, 잘 따라오셨어요. 내일 또 만나요.",
  2: "Day 2, 큰 그림이 보였다면 충분해요.",
  3: "Day 3, 한 줄이면 충분한 하루였어요.",
  4: "Day 4, 다치지 않은 오늘이 가장 좋은 오늘이에요.",
  5: "Day 5, 오늘의 한 문장이 길이 돼요.",
  6: "Day 6, 보낸 마음이 결국 돌아와요.",
  7: "Day 7, 7일 동안 와줘서 고마워요.",
};

export const DAY_OSAMI_CLOSING: Record<DayNumber, string> = {
  1: "오늘도 와줘서 고마워요.",
  2: "혼자 하는 게 아니에요.",
  3: "공부보다 가벼웠죠.",
  4: "내 컨디션이 가장 정확해요.",
  5: "한 줄도 충분해요.",
  6: "한 사람을 따뜻하게 한 하루였어요.",
  7: "이제부터는 자기 페이스로요.",
};

/** 캠프 진입 / 마무리 핵심 문구 */
export const CAMP_INTRO_BODY =
  "신규 회원이 첫 7일 동안\n153복싱짐 앱의 핵심 사용법을\n매일 한 영역씩 익히는 입문 캠프예요.";

export const CAMP_FINAL_DECLARATION =
  "나는 오늘도 153복싱짐으로 돌아왔다.\n나는 복싱인이 되어가는 중이다.";

/** UI 공용 라벨 — 모든 화면에서 동일 톤 유지 */
export const COMMON_LABELS = {
  next: "다음으로",
  back: "이전",
  skip: "건너뛰기",
  later: "다음에 다시",
  retry: "다시 보기",
  pause: "잠시 멈추기",
  resume: "이어서 하기",
  startCamp: "캠프 시작하기",
  finishDay: "오늘 캠프 마치기",
  finishCamp: "7일 캠프 마치기",
  goToTarget: "여기로 이동",
} as const;

/** 폴백 — step.fallbackText 가 비었을 때 사용하는 일반 문구 */
export const FALLBACK_GENERIC =
  "이 안내 영역은 다음 화면 업데이트에서 자연스럽게 보일 거예요. 오늘은 가볍게 다음으로 넘어가도 좋아요.";

/** 30초 마무리 연출 (47단계 사용) */
export const AFTER_TRAINING_GREETING =
  "오늘도 153복싱짐에 와줘서 고맙습니다.";

/** 7일 완료식 칭호 — cosmetic 표시용 */
export const STARTER_TITLE_TEXT = "복싱인이 되어가는 사람";
