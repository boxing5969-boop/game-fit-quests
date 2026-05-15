/**
 * 7일 스타터 캠프 — 35 step 정적 데이터 (단계 43).
 *
 * Day 1~7 × 각 5 step. 각 step 은 회원에게 노출되는 안내 한 단위.
 *
 * 보호 규칙:
 *   · 장소 표현 "153복싱짐" 만 사용
 *   · 금지어 0: 링 / 체육관 / 복싱장 / gym / RPG / 몬스터 / 전투 / 보스 / 판타지 / 레벨업
 *   · 오삼이 말투는 짧고 따뜻하게
 *   · targetSelector 가 매칭되지 않을 수 있으므로 fallbackText 필수
 *   · DB / RPC 호출 0
 */

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type TutorialCampActionType =
  | "read"
  | "click"
  | "navigate"
  | "open"
  | "complete"
  // 신규 (49/50단계) — 모두 기존 step 에 영향 0 (optional 필드와 함께 사용)
  | "wait_quiz_read"
  | "wait_quiz_answer"
  | "wait_scroll_bottom"
  | "wait_text_input"
  | "wait_select_option"
  | "wait_condition_check"
  | "wait_modal_next";

/**
 * step 완료 조건 룰 — Provider 의 evaluator 가 이 룰로 isStepConditionMet 결정.
 * 미정의 시 기존 requireTargetClick 폴백 사용 (호환).
 */
export type TutorialCampCompletionRule =
  | "target_clicked"
  | "quiz_question_read"
  | "quiz_answer_selected"
  | "quiz_correct_answer_selected"
  | "scrolled_to_bottom"
  | "text_input_min_length"
  | "option_selected"
  | "toggle_selected"
  | "condition_checked"
  | "modal_closed"
  | "manual_confirm";

export type TutorialCampAnimation =
  | "spotlight"
  | "pulse"
  | "hand"
  | "arrow"
  | "bounce"
  | "confetti"
  | "celebration";

export type TutorialCampPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TutorialCampStep {
  /** 1..7 */
  day: number;
  /** 0-based — Day 안 step 인덱스 */
  step: number;
  /** 이 step 이 표시되는 권장 라우트 (다른 라우트면 "여기로 이동" CTA 노출) */
  route: string;
  /** 영구 식별자 — 코드 / 이벤트 로그용. 예: "day1.osami_greeting" */
  targetKey: string;
  /** CSS 셀렉터. 빈 문자열이면 화면 가운데 모달만 표시. */
  targetSelector: string;
  title: string;
  body: string;
  osamiMessage: string;
  actionType: TutorialCampActionType;
  /** true: target 직접 클릭만 통과 / false: "다음" 버튼 통과 가능 */
  requireTargetClick: boolean;
  /** "건너뛰기" 미니 링크 노출 여부 */
  allowNextWithoutClick: boolean;
  animation: TutorialCampAnimation;
  /** 안내 카드(말풍선) 위치 — target 기준 또는 center */
  placement: TutorialCampPlacement;
  /** target 매칭 실패 시 회원에게 노출되는 부드러운 안내 */
  fallbackText: string;
  /** step 통과 직후 1~2초 잠깐 노출 */
  completionText: string;

  // ─────────────────────────────────────────────────────────────
  // 신규 (49/50단계) — 모두 optional, 기존 35 step 데이터 호환
  // ─────────────────────────────────────────────────────────────

  /** 명시적 완료 룰. 없으면 requireTargetClick 폴백 (호환). */
  completionRule?: TutorialCampCompletionRule;
  /** true 면 completionRule 만족 전엔 next 비활성화. 기본 false. */
  blockNextUntilComplete?: boolean;
  /** 조건 충족 시 자동으로 다음 step 진행 (기본 false). */
  autoAdvance?: boolean;
  /**
   * step 진입 시 route 가 다르면 자동 navigate (기본 false).
   * cascade 흐름에서 페이지 자동 이동 안내. 회원이 갑자기 페이지 바뀌어
   * 혼란 줄 수 있으니 명시적 활성화 step 만 적용.
   */
  autoNavigate?: boolean;
  /** wait_text_input — 입력 element 셀렉터 */
  inputSelector?: string;
  /** wait_text_input — 최소 글자 수 (기본 5) */
  minTextLength?: number;
  /** wait_scroll_bottom — 스크롤 컨테이너 셀렉터 (기본 window) */
  scrollContainerSelector?: string;
  /** wait_scroll_bottom — 도달 임계 (0~1, 기본 0.85) */
  scrollThreshold?: number;
  /** wait_select_option — 클릭 가능 옵션들 셀렉터 (복수 매칭 가능) */
  optionSelector?: string;
  /** wait_condition_check — 컨디션 토글 셀렉터 */
  conditionSelector?: string;
  /** wait_quiz_answer — 정답 element 셀렉터 (보안상 클라이언트 노출 주의) */
  expectedAnswerSelector?: string;
  /** wait_quiz_answer — data-tutorial-answer-value 매칭값 */
  expectedAnswerValue?: string;
  /** wait_modal_next — 모달 컨테이너 셀렉터 (제거 감지) */
  modalSelector?: string;
  /** 조건 미충족 시 tooltip 안에 보일 부드러운 재안내. */
  helperMessage?: string;
  /** 조건 충족 시 tooltip 안에 보일 칭찬/안내. */
  successMessage?: string;
  /** 오답 선택 시 부드러운 재안내 (wait_quiz_answer). */
  wrongAnswerMessage?: string;
  /**
   * Day 완료 후 30초 마무리 sheet 노출 억제 (true 시 trigger skip).
   * Day 7 완료식 등에서 시각 충돌 방지용.
   */
  suppressReflectionSheet?: boolean;

  /**
   * 64-AK: "👆 여기를 클릭하세요" chip 표시 여부.
   *   · undefined → requireTargetClick 따라감 (기존 호환)
   *   · true       → 강제 표시 (회원 click 강제 아니어도)
   *   · false      → 명시적으로 chip 숨김
   */
  showTapHereChip?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Day 1 — 보조 퀘스트 cascade (복싱 IQ → 챌린지 아레나 → 챔피언 일기)
//
// 회원이 1일차에 153 QUEST 의 모든 보조 퀘스트를 한 번씩 직접 체험.
// 카드 클릭 → 모달 열림 → 안내 → 닫힘 → 자동으로 다음 카드 cascade.
// ─────────────────────────────────────────────────────────────

const DAY_1_STEPS: TutorialCampStep[] = [
  // ── 0. 오늘의 라운드 보조 퀘스트 — "오늘의 퀴즈 1문제" 카드 클릭 ──
  //   회원이 이 카드 누르면 onOpenAcademy → 복싱 IQ 모달 열림.
  {
    day: 1,
    step: 0,
    route: "/myboxer/quest",
    targetKey: "day1.quest_mini_academy",
    targetSelector: '[data-tour="quest-mini-academy"]',
    title: "오늘의 퀴즈 1문제",
    body: "첫 번째 보조 퀘스트는 복싱 IQ 예요.\n여기를 눌러볼까요?",
    osamiMessage: "안녕하세요. 같이 시작해볼게요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText:
      "153 QUEST 메뉴의 '오늘의 라운드 보조 퀘스트' 영역에서 '오늘의 퀴즈 1문제' 카드를 찾아 누르세요.",
    completionText: "복싱 IQ 가 열렸어요.",
    helperMessage: "여기 '오늘의 퀴즈 1문제' 카드를 눌러보세요.",
    successMessage: "복싱 IQ 가 열렸어요. 둘러보고 닫으면 다음으로 가요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 챌린지 아레나 카드 클릭 (오늘의 라운드 보조 퀘스트 안) ──
  //   ※ 64-A: 복싱 IQ 모달 안 진행 (문제 확인 / 정답 선택) step 제거.
  //     회원이 이미 오늘 IQ 퀴즈 풀었을 수 있어 중복 안내가 부담됨.
  //     step 0 의 카드 클릭 한 번 → modalOpen 감지로 카드 자동 compact →
  //     회원이 모달 안에서 자유롭게 풀거나 닫음 → 모달 자동 감지가 next.
  {
    day: 1,
    step: 1,
    route: "/myboxer/quest",
    targetKey: "day1.quest_mini_challenge",
    targetSelector: '[data-tour="quest-mini-challenge"]',
    title: "다음은 챌린지 아레나",
    body: "이번엔 챌린지 카드를 한 번 눌러볼게요.",
    osamiMessage: "한 번 들어가서 둘러봐요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText:
      "153 QUEST 메뉴 '오늘의 라운드 보조 퀘스트' 영역에서 챌린지 아레나 카드를 누르세요.",
    completionText: "챌린지 화면으로 갑니다.",
    helperMessage: "여기 챌린지 아레나 카드를 눌러보세요.",
    successMessage: "좋아요. 챌린지 화면을 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 2. 챌린지 페이지 스크롤 ──
  {
    day: 1,
    step: 2,
    route: "/challenges",
    targetKey: "day1.challenge_scroll",
    targetSelector: '[data-tour="challenge-arena-scroll"]',
    title: "아래로 천천히 내려볼까요?",
    body: "하나씩 모두 눌러보지 않아도 괜찮아요.\n위에서 아래까지 어떤 챌린지가 있는지만 살펴봐요.",
    osamiMessage: "한 번 훑어보는 것만으로도 충분해요.",
    actionType: "wait_scroll_bottom",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "챌린지 화면이 열렸으면 위에서 아래까지 천천히 살펴봐주세요.",
    completionText: "이제 챌린지 화면을 알게 되었어요.",
    helperMessage: "아래까지 천천히 내려보세요.",
    successMessage: "잘했어요. 다음으로 갈게요.",
    blockNextUntilComplete: true,
    completionRule: "scrolled_to_bottom",
    scrollThreshold: 0.85,
    autoAdvance: true,
  },
  // ── 3. 챔피언 일기 카드 클릭 (153 커뮤니티 자동 이동) ──
  //   65-D: 챔피언 일기는 153 챌린지(/myboxer/quest) → 153 커뮤니티(/myboxer/community)
  //   로 이관됨. route + selector 를 새 위치로 갱신. autoNavigate 가 153 커뮤니티로
  //   자동 이동시킨다. anchor 는 HomeEngagementSection 의 champion-journal-card.
  {
    day: 1,
    step: 3,
    route: "/myboxer/community",
    targetKey: "day1.quest_mini_journal",
    targetSelector: '[data-tour="champion-journal-card"]',
    title: "마지막은 챔피언 일기",
    body: "하루 한 줄 짧은 일기예요.\n153 커뮤니티에서 여기를 눌러볼까요?",
    osamiMessage: "한 줄이면 돼요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "153 커뮤니티 메뉴에서 챔피언 일기 카드를 누르세요.",
    completionText: "일기 화면이 열렸어요.",
    helperMessage: "여기 챔피언 일기 카드를 눌러보세요.",
    successMessage: "일기가 열렸어요. 둘러보고 닫으면 다음으로 가요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ※ 64-B: 일기 모달 안 진행 step (질문 선택 / 한 줄 입력 / 컨디션 / 기록 남기기)
  //   모두 제거. IQ 모달과 동일한 흐름 — 카드 click 한 번 → modalOpen 감지 →
  //   compact mode → 회원이 자유롭게 작성 또는 닫음. 강제 진행 부담 제거.
  // ── 4. Day 1 완료식 ──
  {
    day: 1,
    step: 4,
    route: "/myboxer/quest",
    targetKey: "day1.complete",
    targetSelector: "",
    title: "Day 1 완료",
    body: "첫 날 잘하셨어요.\n복싱 IQ · 챌린지 · 일기 모두 한 번씩 해봤어요.\n내일 Day 2 에서 다시 만나요.",
    osamiMessage: "오늘도 잘 와줘서 고마워요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 1 완료 화면입니다.",
    completionText: "내일 다시 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 2 — 마스터로드 / 공식 훈련
// ─────────────────────────────────────────────────────────────

const DAY_2_STEPS: TutorialCampStep[] = [
  // ※ 64-E: Day 2 흐름 재구성 — 훈련 → 배우기 → 수업실행 → 레벨업 조건 →
  //   전체 미션 → 화이트 리그 → 레벨 1 사다리 스텝 영상.
  //   회원 click 강제 step 은 chip + autoAdvance, read step 은 4초 자동.
  {
    day: 2,
    step: 0,
    route: "/missions",
    targetKey: "day2.training_screen",
    targetSelector: '[data-tour="missions-official-training"]',
    title: "훈련 화면",
    body: "여기가 마이복서153의 훈련 메인 화면이에요.\n공식 훈련을 모아둔 자리예요.",
    osamiMessage: "이 화면이 매일 오는 자리예요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "하단 메뉴의 훈련 아이콘으로 들어올 수 있어요.",
    completionText: "훈련 화면은 매일의 출발점이에요.",
    helperMessage: "훈련 화면이 열렸어요. 잠깐 둘러보세요.",
    successMessage: "잘 보셨어요. 다음으로 갈게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 배우기 탭 안내 (default 활성) ──
  {
    day: 2,
    step: 1,
    route: "/missions",
    targetKey: "day2.tab_learn",
    targetSelector: '[data-tour="white-league-tab-learn"]',
    title: "배우기 탭",
    body: "이 탭은 오늘 배울 자세와 핵심 포인트를\n미리 살펴보는 곳이에요.\n학습 모듈 · 오늘의 목적 · 얻는 가치 순서로 보여요.",
    osamiMessage: "어떤 자세를 익히게 되는지 한 번에 알 수 있어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText:
      "화이트 리그가 선택돼 있으면 바로 위쪽에 '📖 배우기' 탭이 보여요.",
    completionText: "배우기는 자세를 머리로 먼저 잡는 단계예요.",
    helperMessage: "배우기 탭의 학습 모듈을 잠깐 살펴보세요.",
    successMessage: "잘 보셨어요. 이제 수업실행으로 가볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 2. 수업실행 탭 클릭 ──
  {
    day: 2,
    step: 2,
    route: "/missions",
    targetKey: "day2.tab_session",
    targetSelector: '[data-tour="white-league-tab-session"]',
    title: "수업실행 탭으로 이동",
    body: "여기가 실제 50분 수업을 어떻게 진행하는지\n시간대별로 풀어둔 곳이에요.\n탭을 한 번 눌러볼게요.",
    osamiMessage: "실제 수업 흐름이 여기에 있어요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText:
      "탭 줄에서 '🥊 수업실행' 을 직접 눌러주세요.",
    completionText: "수업실행 탭이 열렸어요.",
    helperMessage: "여기 '수업실행' 탭을 눌러보세요.",
    successMessage: "좋아요. 수업 구성이 보여요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 수업 구성 안내 ──
  {
    day: 2,
    step: 3,
    route: "/missions",
    targetKey: "day2.session_overview",
    targetSelector: '[data-tour="white-league-tab-session"]',
    title: "오늘의 50분 수업",
    body: "워밍업 · 기본기 · 본운동 · 마무리 같은\n블록이 시간대별로 나뉘어 있어요.\n각 블록을 누르면 세부 동작도 볼 수 있어요.",
    osamiMessage: "한 번에 다 외우려 하지 않아도 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "수업실행 탭의 50분 수업 구성과 블록을 잠깐 살펴보세요.",
    completionText: "수업이 어떻게 흐르는지 보셨어요.",
    helperMessage: "잠깐 둘러보고 있어요. 곧 다음으로 가요.",
    successMessage: "이제 레벨업 조건을 알아볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 4. 심사 탭 클릭 → 레벨업 조건 ──
  {
    day: 2,
    step: 4,
    route: "/missions",
    targetKey: "day2.tab_check",
    targetSelector: '[data-tour="white-league-tab-check"]',
    title: "레벨업 조건",
    body: "레벨 2 로 가려면 '심사' 탭에 있는\n레벨업 조건을 채우면 돼요.\n탭을 눌러 조건을 살펴볼게요.",
    osamiMessage: "조건을 먼저 알면 길이 보여요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '✅ 심사' 를 눌러주세요.",
    completionText: "심사 탭에 레벨업 조건이 있어요.",
    helperMessage: "여기 '심사' 탭을 눌러보세요.",
    successMessage: "좋아요. 레벨 2 가는 길이 보여요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 5. 심사 안내 (5초) ──
  {
    day: 2,
    step: 5,
    route: "/missions",
    targetKey: "day2.check_overview",
    targetSelector: '[data-tour="white-league-tabs"]',
    title: "Lv.1 → Lv.2",
    body: "심사 탭의 '레벨업 조건' 카드에\n다음 레벨로 가기 위해 채워야 할 항목이 있어요.\n출석/미션 승인 같은 작은 단위들이에요.",
    osamiMessage: "조건은 부담스러운 게 아니라 방향 표시예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "심사 탭 안의 레벨업 조건을 잠깐 읽어보세요.",
    completionText: "조건이 곧 길이에요.",
    helperMessage: "잠깐 읽어보고 있어요. 곧 다음으로 가요.",
    successMessage: "이제 전체 미션을 보러 가볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 6. 전체 미션 토글 클릭 ──
  //   selector 는 inactive button 만 직접 매칭 — 화이트 리그가 default active 라서
  //   wrapper 잡으면 chip 이 첫 button(=white) noop. inactive 버튼 가리키면 정확.
  {
    day: 2,
    step: 6,
    route: "/missions",
    targetKey: "day2.tab_all_missions",
    targetSelector:
      '[data-tour="missions-tab-control"] button[aria-selected="false"]',
    title: "전체 미션 보기",
    body: "위쪽 토글에서 '🥊 전체 미션' 으로 옮겨볼게요.\n리그별 미션 목록을 한눈에 볼 수 있어요.",
    osamiMessage: "전체 그림을 한 번 보면 좋아요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 토글에서 '전체 미션' 을 눌러주세요.",
    completionText: "전체 미션 화면이 열렸어요.",
    helperMessage: "여기 '전체 미션' 토글을 눌러보세요.",
    successMessage: "리그별 미션이 보여요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 7. 화이트 리그 헤더 클릭 → 레벨 1 사다리 스텝 미리보기 ──
  {
    day: 2,
    step: 7,
    route: "/missions",
    targetKey: "day2.league_white",
    targetSelector: '[data-tour="missions-league-header-white"]',
    title: "화이트 리그 — 레벨 1 사다리 스텝",
    body: "화이트 리그를 펼쳐서\n레벨 1 의 '사다리 스텝' 미션을 한 번 눌러보세요.\n시범 영상으로 동작을 미리 익힐 수 있어요.",
    osamiMessage: "영상으로 한 번 보면 몸이 먼저 따라가요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText:
      "전체 미션 화면에서 '화이트 리그' 카드를 눌러 펼치고\n레벨 1 사다리 스텝을 누르면 영상이 열려요.",
    completionText: "영상은 자세를 머리에 새기는 가장 빠른 길이에요.",
    helperMessage: "여기 화이트 리그 카드를 눌러보세요.",
    successMessage: "잘했어요. 영상 한 번 보면 도움이 많이 돼요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 8. Day 2 완료식 ──
  {
    day: 2,
    step: 8,
    route: "/missions",
    targetKey: "day2.complete",
    targetSelector: "",
    title: "Day 2 완료",
    body: "공식 훈련의 큰 그림 — 배우기/수업/심사/미션까지\n흐름이 보이셨다면 충분해요.\n내일은 153 QUEST 를 만나요.",
    osamiMessage: "여기까지 잘 따라오셨어요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 2 완료 화면입니다.",
    completionText: "내일 Day 3에서 153 QUEST를 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 3 — 153 QUEST 둘러보기 (IQ 는 Day 1 에서 이미 진행 — 중복 제거)
// ─────────────────────────────────────────────────────────────
// 64-R: 사용자 피드백 "복싱 IQ 는 1일차에서 이미 진행하므로 다른 일차에는 X".
//   Day 1/2 와 같은 cascade 패턴 — autoNavigate + click 강조 + autoAdvance.
const DAY_3_STEPS: TutorialCampStep[] = [
  // ── 0. 출석 체크인 (홈 QR 체크인 카드) ──
  {
    day: 3,
    step: 0,
    route: "/home",
    targetKey: "day3.attendance_intro",
    targetSelector: '[data-tour="home-qr-checkin"]',
    title: "출석 체크인",
    body: "하루의 시작은 QR 출석부터예요.\n홈에서 QR 체크인 한 번이면 오늘의 모든 활동이 열려요.",
    osamiMessage: "여기를 눌러볼까요?",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "홈 상단에 QR 체크인 카드가 보이면 누르고, 이미 체크인했다면 다음으로 가도 돼요.",
    completionText: "출석으로 오늘이 시작돼요.",
    helperMessage: "반짝이는 곳을 눌러보세요.",
    successMessage: "출석 완료. 오늘이 열렸어요.",
    blockNextUntilComplete: false,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 1. 출석이 만드는 작은 보상 (읽기) ──
  {
    day: 3,
    step: 1,
    route: "/home",
    targetKey: "day3.attendance_reward",
    targetSelector: "",
    title: "매일의 출석이 쌓는 것",
    body: "출석 한 번에 작은 XP가 쌓이고,\n연속 출석은 별도의 흐름으로 기록돼요.\n부담 없이, 매일 한 번이면 충분해요.",
    osamiMessage: "꾸준한 사람이 결국 멀리 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "출석을 한 번 하면 자동으로 작은 보상이 누적돼요.",
    completionText: "오늘의 출석, 기록되었어요.",
    helperMessage: "잠깐 읽어보고 있어요. 곧 다음으로 가요.",
    successMessage: "좋아요. 다음으로 가볼까요?",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 2. 컨디션 게이지 (챔피언 일기 시트 안 컨디션 선택) ──
  //   일기는 153 커뮤니티로 이관됨 → /myboxer/community 에서 일기 진입 후 시트 안 컨디션 선택.
  //   첫 도달 시 시트가 안 열려 있을 수 있어 click → wait_condition_check 흐름.
  {
    day: 3,
    step: 2,
    route: "/myboxer/community",
    targetKey: "day3.condition_gauge",
    targetSelector: '[data-tour="journal-condition-options"]',
    title: "오늘의 컨디션",
    body: "오늘 몸 상태를 한 단어로 기록해보세요.\n컨디션은 챔피언 일기 시트 안에 함께 있어요. 정답은 없어요.",
    osamiMessage: "정직하게 하나만 골라보세요.",
    actionType: "wait_condition_check",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText:
      "153 커뮤니티 → 챔피언 일기 카드를 누르면 시트 안에 컨디션 영역이 나와요.",
    completionText: "오늘의 컨디션, 잘 남기셨어요.",
    helperMessage: "컨디션을 하나 선택하면 다음으로 갈 수 있어요.",
    successMessage: "좋아요. Day 3 마무리할게요.",
    blockNextUntilComplete: false,
    completionRule: "condition_checked",
    conditionSelector: '[data-tutorial-condition="true"]',
    autoAdvance: true,
  },
  // ── 3. Day 3 완료 ──
  {
    day: 3,
    step: 3,
    route: "/home",
    targetKey: "day3.complete",
    targetSelector: "",
    title: "Day 3 완료",
    body: "출석과 컨디션,\n오늘의 두 가지 작은 기록이 쌓였어요.",
    osamiMessage: "내 몸을 읽는 사람이 오래 가요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 3 완료 화면입니다.",
    completionText: "내일 Day 4에서는 랭킹과 단증혜택을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 4 — 랭킹 + 단증혜택
// ─────────────────────────────────────────────────────────────

const DAY_4_STEPS: TutorialCampStep[] = [
  // ── 0. 랭킹 페이지 진입 ──
  {
    day: 4,
    step: 0,
    route: "/halloffame",
    targetKey: "day4.ranking_intro",
    targetSelector: '[data-tour="halloffame-leaderboard"]',
    title: "랭킹",
    body: "같은 153 회원들이 어떻게 오늘을 보내는지\n한 번에 볼 수 있는 곳이에요.\n비교가 아니라, 함께 가는 방향을 보는 곳이에요.",
    osamiMessage: "옆 사람 속도가 아니라, 내 속도로요.",
    actionType: "wait_scroll_bottom",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "전체 메뉴 → 랭킹에서 같은 회원들의 활동을 둘러볼 수 있어요.",
    completionText: "오늘의 랭킹을 확인했어요.",
    helperMessage: "아래까지 천천히 내려보며 둘러보세요.",
    successMessage: "좋아요. 다음으로 가볼까요?",
    blockNextUntilComplete: false,
    completionRule: "scrolled_to_bottom",
    scrollThreshold: 0.6,
    autoAdvance: true,
  },
  // ── 1. 랭킹은 비교가 아니다 (읽기) ──
  {
    day: 4,
    step: 1,
    route: "/halloffame",
    targetKey: "day4.ranking_meaning",
    targetSelector: "",
    title: "랭킹의 의미",
    body: "1등이 되라는 곳이 아니에요.\n어제의 나보다 한 줄 더 — 그게 진짜 랭킹이에요.",
    osamiMessage: "꾸준함이 결국 위로 올라가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "랭킹 화면 안의 점수와 위치는 자동으로 누적돼요.",
    completionText: "오늘의 나, 어제의 나와 비교돼요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "이제 단증혜택을 만나볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 2. 단증혜택 페이지 진입 ──
  {
    day: 4,
    step: 2,
    route: "/cert-benefits",
    targetKey: "day4.cert_intro",
    targetSelector: '[data-tour="cert-benefits-page"]',
    title: "단증혜택",
    body: "153 단증은 그냥 종이가 아니에요.\n레벨이 오를수록 받는 혜택과 자격이 함께 늘어나요.",
    osamiMessage: "여기서 단계별 혜택을 한 번 볼게요.",
    actionType: "wait_scroll_bottom",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "전체 메뉴 → 단증혜택에서 레벨별 혜택을 한 번에 볼 수 있어요.",
    completionText: "단증혜택을 둘러봤어요.",
    helperMessage: "위에서 아래까지 살펴보세요.",
    successMessage: "잘했어요. 다음으로 가볼까요?",
    blockNextUntilComplete: false,
    completionRule: "scrolled_to_bottom",
    scrollThreshold: 0.6,
    autoAdvance: true,
  },
  // ── 3. 단증혜택은 결과가 아닌 길 ──
  {
    day: 4,
    step: 3,
    route: "/cert-benefits",
    targetKey: "day4.cert_meaning",
    targetSelector: "",
    title: "단증은 길이에요",
    body: "한 번에 다 외울 필요 없어요.\n레벨이 오를 때마다, 그 단계의 혜택이 자동으로 안내돼요.",
    osamiMessage: "지금은 위치만 알아도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "레벨업할 때마다 해당 단증의 안내가 다시 표시돼요.",
    completionText: "단증의 흐름을 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 4 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 4. Day 4 완료 ──
  {
    day: 4,
    step: 4,
    route: "/home",
    targetKey: "day4.complete",
    targetSelector: "",
    title: "Day 4 완료",
    body: "랭킹과 단증혜택,\n내 위치와 내 길을 같이 봤어요.",
    osamiMessage: "방향이 있는 사람은 흔들리지 않아요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 4 완료 화면입니다.",
    completionText: "내일 Day 5에서는 153 커뮤니티를 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 5 — 153 커뮤니티 (세컨드 응원 / 코너맨)
// ─────────────────────────────────────────────────────────────

const DAY_5_STEPS: TutorialCampStep[] = [
  // ── 0. 세컨드 응원 카드 ──
  {
    day: 5,
    step: 0,
    route: "/myboxer/community",
    targetKey: "day5.second_cheer",
    targetSelector: '[data-tour="second-cheer-card"]',
    title: "세컨드 응원",
    body: "오늘 링에 오른 동료에게 박수 한 번 보내보세요.\n글이 어려우면 스티커 한 장이면 충분해요.",
    osamiMessage: "여기를 눌러볼까요?",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "153 커뮤니티에서 세컨드 응원 카드를 찾을 수 있어요.",
    completionText: "오늘의 한 마디, 시작했어요.",
    helperMessage: "반짝이는 곳을 눌러보세요.",
    successMessage: "응원하는 마음이 진짜 점수예요.",
    blockNextUntilComplete: false,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 1. 응원의 의미 (읽기) ──
  {
    day: 5,
    step: 1,
    route: "/myboxer/community",
    targetKey: "day5.cheer_meaning",
    targetSelector: "",
    title: "혼자가 아니에요",
    body: "운동은 결국 혼자 하는 거지만,\n응원은 같이 하는 거예요.\n보낸 마음이 결국 돌아와요.",
    osamiMessage: "한 사람만 응원해도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText:
      "응원을 한 번 보내거나 받으면 작은 RP가 자동으로 누적돼요.",
    completionText: "함께 쌓는 점수는 더 단단해요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "이제 코너맨을 만나볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 2. 코너맨 카드 ──
  {
    day: 5,
    step: 2,
    route: "/myboxer/community",
    targetKey: "day5.cornerman",
    targetSelector: '[data-tour="cornerman-card"]',
    title: "코너맨",
    body: "같은 지점 회원과 1:1 페어를 맺어\n매일의 운동을 같이 챙겨주는 친구예요.\n오늘 둘 다 완료하면 작은 보너스가 함께 와요.",
    osamiMessage: "여기를 눌러 카드를 열어보세요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "153 커뮤니티에서 코너맨 카드를 찾을 수 있어요.",
    completionText: "혼자 하지 않는 방법, 알게 됐어요.",
    helperMessage: "반짝이는 곳을 눌러보세요.",
    successMessage: "좋아요. 다음으로 가볼까요?",
    blockNextUntilComplete: false,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 코너맨이 만드는 흐름 (읽기) ──
  {
    day: 5,
    step: 3,
    route: "/myboxer/community",
    targetKey: "day5.cornerman_flow",
    targetSelector: "",
    title: "오늘 둘 다 완료하면",
    body: "코너맨과 같은 날 운동을 마치면,\n자동으로 작은 보너스가 양쪽 모두에게 들어와요.\n혼자보다 한 발 더 멀리 가는 방법이에요.",
    osamiMessage: "함께 가는 사람이 결국 멀리 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText:
      "코너맨 카드에서 페어를 신청하거나 받을 수 있어요.",
    completionText: "코너맨의 흐름을 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 5 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 4. Day 5 완료 ──
  {
    day: 5,
    step: 4,
    route: "/home",
    targetKey: "day5.complete",
    targetSelector: "",
    title: "Day 5 완료",
    body: "세컨드 응원과 코너맨,\n같이 가는 두 가지 방법을 만났어요.",
    osamiMessage: "보낸 마음이 결국 돌아와요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 5 완료 화면입니다.",
    completionText: "내일 Day 6에서 캐릭터와 마인드셋을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 6 — 캐릭터 + 153마인드셋
// ─────────────────────────────────────────────────────────────

const DAY_6_STEPS: TutorialCampStep[] = [
  // ── 0. 캐릭터 스튜디오 진입 ──
  {
    day: 6,
    step: 0,
    route: "/character-studio",
    targetKey: "day6.character_intro",
    targetSelector: '[data-tour="character-studio-page"]',
    title: "캐릭터",
    body: "내 캐릭터는 나의 또 다른 모습이에요.\n레벨이 오를수록 모습이 단단해지고,\n꾸미기 요소도 함께 열려요.",
    osamiMessage: "오늘은 위치만 알아도 충분해요.",
    actionType: "wait_scroll_bottom",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "전체 메뉴 → 캐릭터에서 내 캐릭터를 둘러볼 수 있어요.",
    completionText: "내 캐릭터의 자리, 알게 됐어요.",
    helperMessage: "위에서 아래까지 천천히 둘러보세요.",
    successMessage: "잘했어요. 다음으로 가볼까요?",
    blockNextUntilComplete: false,
    completionRule: "scrolled_to_bottom",
    scrollThreshold: 0.6,
    autoAdvance: true,
  },
  // ── 1. 캐릭터가 자라는 방식 (읽기) ──
  {
    day: 6,
    step: 1,
    route: "/character-studio",
    targetKey: "day6.character_growth",
    targetSelector: "",
    title: "캐릭터가 자라는 방식",
    body: "오늘의 작은 한 번이 캐릭터의 한 단계가 돼요.\n결과가 아니라, 매일의 흐름이 모이는 곳이에요.",
    osamiMessage: "오늘의 나, 캐릭터에도 새겨져요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText:
      "레벨이 오를 때마다 캐릭터의 모습과 꾸미기 요소가 자동으로 열려요.",
    completionText: "캐릭터의 자라는 흐름을 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "이제 153마인드셋을 만나볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 2. 153마인드셋 — 세션 시작 버튼 ──
  {
    day: 6,
    step: 2,
    route: "/myboxer/visualization",
    targetKey: "day6.mindset_intro",
    targetSelector: '[data-tour="mindset-start-button"]',
    title: "153마인드셋",
    body: "운동 전 1분, 머리를 먼저 깨우는 짧은 시각화 훈련이에요.\n몸보다 마음이 먼저 단단해지는 곳이에요.",
    osamiMessage: "오늘은 시작 버튼만 눌러볼까요?",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "전체 메뉴 → 153마인드셋에서 짧은 세션을 시작할 수 있어요.",
    completionText: "마음을 먼저 데우는 한 번이 시작됐어요.",
    helperMessage: "반짝이는 곳을 눌러보세요.",
    successMessage: "좋아요. 마인드셋의 흐름을 알게 됐어요.",
    blockNextUntilComplete: false,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 마인드셋의 효과 (읽기) ──
  {
    day: 6,
    step: 3,
    route: "/myboxer/visualization",
    targetKey: "day6.mindset_effect",
    targetSelector: "",
    title: "머리부터 단단해지기",
    body: "1분의 시각화는 그날의 운동을 더 정확하게 만들어줘요.\n매일 똑같이 안 해도 괜찮아요. 필요한 날만이라도요.",
    osamiMessage: "머리가 깨어 있어야 몸도 따라와요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText:
      "153마인드셋 세션은 1분 안에 끝나는 짧은 시각화예요.",
    completionText: "마인드셋의 효과를 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 6 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 4. Day 6 완료 ──
  {
    day: 6,
    step: 4,
    route: "/home",
    targetKey: "day6.complete",
    targetSelector: "",
    title: "Day 6 완료",
    body: "캐릭터와 마인드셋,\n오늘의 나와 마음이 같이 자라는 두 자리를 알게 됐어요.",
    osamiMessage: "머리가 단단한 사람이 결국 단단한 사람이에요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 6 완료 화면입니다.",
    completionText: "내일 Day 7, 마지막 날이에요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 7 — 마이페이지 / 복싱 전당 / 성장 리포트 / 7일 완료식
// ─────────────────────────────────────────────────────────────

const DAY_7_STEPS: TutorialCampStep[] = [
  {
    day: 7,
    step: 0,
    route: "/mypage",
    targetKey: "day7.mypage",
    targetSelector: '[data-tour="mypage-profile"]',
    title: "마이페이지",
    body: "마이페이지는 그동안의 나를\n한 곳에서 볼 수 있는 자리예요.",
    osamiMessage: "여기로 한 번 들어가볼게요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "전체 메뉴에서 내정보로 들어오면 마이페이지예요.",
    completionText: "그동안의 시간이 여기 있어요.",
    helperMessage: "여기를 눌러 마이페이지로 들어가볼게요.",
  },
  {
    day: 7,
    step: 1,
    route: "/halloffame",
    targetKey: "day7.hall_of_fame",
    targetSelector: '[data-tour="boxing-hall-card"]',
    title: "복싱 전당",
    body: "꾸준히 해온 회원들의 이름이\n모이는 자리예요.\n언젠가 당신의 이름도 여기에 올라가요.",
    osamiMessage: "지금은 비어 있어도 괜찮아요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "하단 메뉴의 랭킹 아이콘에서 복싱 전당으로 들어올 수 있어요.",
    completionText: "오래 가는 사람이 결국 남아요.",
  },
  {
    day: 7,
    step: 2,
    route: "/mypage",
    targetKey: "day7.growth_report",
    targetSelector: '[data-tour="growth-report-card"]',
    title: "성장 리포트",
    body: "내가 해온 훈련, 챌린지, 일기가\n시간 순으로 보이는 리포트예요.\n7일치만 봐도 길이 보일 거예요.",
    osamiMessage: "7일 전의 나와 지금의 나, 비교해봐요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "마이페이지 안에서 성장 리포트 카드를 찾을 수 있어요.",
    completionText: "7일이 모이면 길이 돼요.",
  },
  {
    day: 7,
    step: 3,
    route: "/home",
    targetKey: "day7.celebration",
    targetSelector: "",
    title: "7일 완료식",
    body: "7일 동안 잘 와주셨어요.\n오늘부터는 ‘복싱인이 되어가는 사람’이에요.",
    osamiMessage: "고마워요. 진심으로요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "celebration",
    placement: "center",
    fallbackText: "7일 완료식 화면입니다.",
    completionText: "복싱인이 되어가는 사람.",
    /** Day 7 완료식 confetti 와 PostActionReflectionSheet 시각 충돌 방지. */
    suppressReflectionSheet: true,
  },
  {
    day: 7,
    step: 4,
    route: "/home",
    targetKey: "day7.next_steps",
    targetSelector: "",
    title: "앞으로의 사용법",
    body: "오늘부터는 정해진 길이 아니라\n자기 페이스로 153복싱짐의 하루를 시작하세요.\n오삼이는 매일 짧게 곁에 있어요.",
    osamiMessage: "오늘도 153복싱짐으로 돌아와줘서 고마워요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "캠프 종료 화면입니다.",
    completionText: "이제부터는 매일 자기만의 페이스로.",
  },
];

// ─────────────────────────────────────────────────────────────
// 체험형 강화 — 모든 step 을 "여기로 이동 → spotlight → 직접 클릭" 흐름으로 통일
// ─────────────────────────────────────────────────────────────

/**
 * 매칭 가능한 anchor 가 없는 selector → 같은 Day 의 매칭 가능한 anchor 로 통합.
 * 회원이 모든 step 에서 동일한 spotlight + 직접 클릭 체험.
 *
 * 예: missions-master-road 처럼 anchor 가 화면에 없는 selector 는
 *     missions-official-training (anchor 존재) 으로 매핑.
 *     회원은 같은 영역을 여러 번 클릭하게 되지만 안내 본문은 매번 다름.
 */
const SELECTOR_REMAP: Record<string, { selector: string; route: string }> = {
  // Day 2 — 마스터로드 / 미션 / 코치 승인 안내 → 훈련 화면 단일 spotlight
  '[data-tour="missions-master-road"]': {
    selector: '[data-tour="missions-official-training"]',
    route: "/missions",
  },
  '[data-tour="missions-submit-note"]': {
    selector: '[data-tour="missions-official-training"]',
    route: "/missions",
  },
  '[data-tour="missions-coach-approval-note"]': {
    selector: '[data-tour="missions-official-training"]',
    route: "/missions",
  },
  // Day 3~6 새 커리큘럼은 직접 anchor 사용 — 별도 remap 불필요.
};

/**
 * step 메타를 일괄 변환.
 *   1. SELECTOR_REMAP 적용 — 매칭 가능한 anchor 로 selector / route 정정
 *   2. target 있고 모달(complete) 아니면 → 직접 클릭 강제
 *      · requireTargetClick=true
 *      · allowNextWithoutClick=false
 *      · actionType="click" (read 도 click 으로 — 단조로운 "다음으로" 만 누르는 흐름 제거)
 *   3. Day 완료 모달 (actionType="complete") 은 그대로
 */
function withInteractive(step: TutorialCampStep): TutorialCampStep {
  let selector = step.targetSelector;
  let route = step.route;

  // 매핑 테이블 적용
  if (selector in SELECTOR_REMAP) {
    const remap = SELECTOR_REMAP[selector];
    selector = remap.selector;
    route = remap.route;
  }

  // 직접 클릭 강제 — Day 완료 모달 제외 모든 target 있는 step
  if (selector !== "" && step.actionType !== "complete") {
    return {
      ...step,
      targetSelector: selector,
      route,
      actionType: "click",
      requireTargetClick: true,
      allowNextWithoutClick: false,
    };
  }
  return step;
}

/** 모든 day 의 step 을 펼쳐 둔 평면 배열 (35개) — 체험형 변환 적용 */
export const TUTORIAL_CAMP_STEPS: TutorialCampStep[] = [
  ...DAY_1_STEPS,
  ...DAY_2_STEPS,
  ...DAY_3_STEPS,
  ...DAY_4_STEPS,
  ...DAY_5_STEPS,
  ...DAY_6_STEPS,
  ...DAY_7_STEPS,
].map(withInteractive);

/** 특정 day 의 step 배열 — admin order override 적용. step 번호 reassign.
 *  64-AN: override lookup 도 originalStep (base + custom 통합) 으로.
 */
export function getStepsByDay(day: number): TutorialCampStep[] {
  const allOriginal = [
    ...TUTORIAL_CAMP_STEPS.filter((s) => s.day === day),
    ...getCustomStepsForDay(day),
  ];
  const byTargetKey = new Map(allOriginal.map((s) => [s.targetKey, s.step]));
  return getOrderedStepsByDay(day).map((s) => {
    const baseStep = byTargetKey.get(s.targetKey) ?? s.step;
    const ov = getStepOverride(day, baseStep);
    return ov ? ({ ...s, ...ov } as TutorialCampStep) : s;
  });
}

// ─────────────────────────────────────────────────────────────
// 64-T / 65-A: 튜토리얼 step override 시스템.
//   · local (localStorage): admin 본인 브라우저 미리보기 — write 즉시 적용
//   · global (Supabase tutorial_global_overrides): admin publish → 전체 회원 반영
//
//   read 함수는 global + local merge — local 이 우선 (admin 미리보기 보장).
//   일반 회원은 local 빈 상태 → global 만 반영. publish 안 한 변경은 보이지 않음.
// ─────────────────────────────────────────────────────────────
const STEP_OVERRIDE_KEY = "myboxer.tutorialCamp.dev.stepOverrides";

export type TutorialStepOverridePartial = Partial<
  Pick<
    TutorialCampStep,
    | "targetSelector"
    // 65-D: route 도 override 가능 — 메뉴 이동/통합 시 step 의 페이지를 admin 이
    //   코드 수정 없이 새 라우트로 교체. autoNavigate 가 이 값으로 이동한다.
    | "route"
    | "placement"
    | "autoAdvance"
    | "autoNavigate"
    | "requireTargetClick"
    | "blockNextUntilComplete"
    | "completionRule"
    | "title"
    | "body"
    | "helperMessage"
    | "successMessage"
    | "showTapHereChip"
  >
>;

type OverrideMap = Record<string, TutorialStepOverridePartial>;

// ─── 65-A: 글로벌 캐시 (publish 된 데이터 — App.tsx 에서 fetch 후 setter 호출) ───
let globalOverrides: OverrideMap = {};
let globalStepOrders: Record<number, number[]> = {};
let globalCustomSteps: Record<number, TutorialCampStep[]> = {};

/** App.tsx 부팅 시 1회 호출 — Supabase 에서 fetch 한 글로벌 데이터를 메모리 캐시에 주입. */
export function setGlobalTutorialOverrides(payload: {
  step_overrides?: Record<string, TutorialStepOverridePartial> | null;
  step_order?: Record<string, number[]> | null;
  custom_steps?: Record<string, TutorialCampStep[]> | null;
}): void {
  globalOverrides = (payload.step_overrides ?? {}) as OverrideMap;

  const orderObj: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(payload.step_order ?? {})) {
    const dayNum = Number(k);
    if (Number.isFinite(dayNum) && Array.isArray(v)) {
      orderObj[dayNum] = v;
    }
  }
  globalStepOrders = orderObj;

  const customObj: Record<number, TutorialCampStep[]> = {};
  for (const [k, v] of Object.entries(payload.custom_steps ?? {})) {
    const dayNum = Number(k);
    if (Number.isFinite(dayNum) && Array.isArray(v)) {
      customObj[dayNum] = v as TutorialCampStep[];
    }
  }
  globalCustomSteps = customObj;
}

function readLocalOverrides(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STEP_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverrideMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** override = global + local. local 이 우선 — admin 본인 미리보기 보장. */
function readOverrides(): OverrideMap {
  return { ...globalOverrides, ...readLocalOverrides() };
}

export function getStepOverride(
  day: number,
  step: number,
): TutorialStepOverridePartial | null {
  const map = readOverrides();
  return map[`${day}.${step}`] ?? null;
}

export function setStepOverride(
  day: number,
  step: number,
  patch: TutorialStepOverridePartial,
): void {
  if (typeof window === "undefined") return;
  try {
    const map = readOverrides();
    const key = `${day}.${step}`;
    map[key] = { ...(map[key] ?? {}), ...patch };
    window.localStorage.setItem(STEP_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

export function clearStepOverride(day: number, step: number): void {
  if (typeof window === "undefined") return;
  try {
    const map = readOverrides();
    delete map[`${day}.${step}`];
    window.localStorage.setItem(STEP_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

export function clearAllStepOverrides(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STEP_OVERRIDE_KEY);
  } catch {
    /* noop */
  }
}

function applyOverride(s: TutorialCampStep): TutorialCampStep {
  const ov = getStepOverride(s.day, s.step);
  return ov ? ({ ...s, ...ov } as TutorialCampStep) : s;
}

// ─────────────────────────────────────────────────────────────
// 64-W: step order override — admin 이 day 안의 step 순서 reorder.
//   localStorage `myboxer.tutorialCamp.dev.stepOrder` =
//     Record<day, originalSteps[]>  (회원이 정한 순서, 첫 → 마지막)
//   getStepsByDay / getStep 호출 시 그 순서대로 sort + step 번호 reassign.
// ─────────────────────────────────────────────────────────────
const STEP_ORDER_KEY = "myboxer.tutorialCamp.dev.stepOrder";

function readLocalStepOrders(): Record<number, number[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STEP_ORDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<number, number[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** order = global + local. day 별로 local 이 있으면 local, 없으면 global. */
function readStepOrders(): Record<number, number[]> {
  return { ...globalStepOrders, ...readLocalStepOrders() };
}

export function getStepOrderForDay(day: number): number[] | null {
  const all = readStepOrders();
  return all[day] ?? null;
}

export function setStepOrderForDay(day: number, order: number[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = readStepOrders();
    all[day] = order;
    window.localStorage.setItem(STEP_ORDER_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

export function clearStepOrderForDay(day: number): void {
  if (typeof window === "undefined") return;
  try {
    const all = readStepOrders();
    delete all[day];
    window.localStorage.setItem(STEP_ORDER_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

export function clearAllStepOrders(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STEP_ORDER_KEY);
  } catch {
    /* noop */
  }
}

/** day 안의 base + custom step 들을 admin 정의 순서로 정렬 + step 번호 reassign.
 *  64-X: order 에 명시된 step 만 포함 — 누락(빼기) 된 step 은 hidden.
 *        order 가 빈 배열 또는 미설정이면 base + custom 그대로 (모두 보임).
 *  64-Y: custom step 도 통합 — admin 이 만든 새 step 도 일반 step 처럼 동작.
 */
function getOrderedStepsByDay(day: number): TutorialCampStep[] {
  const all = getAllStepsForDay(day); // base + custom
  const order = getStepOrderForDay(day);
  if (!order) return all;
  const byOriginal = new Map(all.map((s) => [s.step, s]));
  const sorted: TutorialCampStep[] = [];
  for (const orig of order) {
    const s = byOriginal.get(orig);
    if (s) sorted.push(s);
  }
  // step 번호 reassign (0..N-1) — advance / 마지막 step 판정 자연 동작
  return sorted.map((s, idx) => (s.step === idx ? s : { ...s, step: idx }));
}

// ─────────────────────────────────────────────────────────────
// 64-Y: admin 이 새로 만든 step (custom). step 번호 1000+ 으로 base 와 충돌 회피.
// ─────────────────────────────────────────────────────────────
const STEP_CUSTOM_KEY = "myboxer.tutorialCamp.dev.customSteps";
const CUSTOM_STEP_BASE = 1000;

function readLocalCustomStepsAll(): Record<number, TutorialCampStep[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STEP_CUSTOM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<number, TutorialCampStep[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** custom = global + local. day 별로 local 이 있으면 local, 없으면 global. */
function readCustomStepsAll(): Record<number, TutorialCampStep[]> {
  return { ...globalCustomSteps, ...readLocalCustomStepsAll() };
}

export function getCustomStepsForDay(day: number): TutorialCampStep[] {
  return readCustomStepsAll()[day] ?? [];
}

function writeCustomStepsForDay(
  day: number,
  steps: TutorialCampStep[],
): void {
  if (typeof window === "undefined") return;
  try {
    const all = readCustomStepsAll();
    if (steps.length === 0) {
      delete all[day];
    } else {
      all[day] = steps;
    }
    window.localStorage.setItem(STEP_CUSTOM_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

/** 새 custom step 추가. step 번호 자동 (CUSTOM_STEP_BASE + 다음 idx). */
export function addCustomStep(
  day: number,
  partial: Partial<TutorialCampStep> & { title: string },
): TutorialCampStep {
  const existing = getCustomStepsForDay(day);
  const nextStepNo =
    CUSTOM_STEP_BASE +
    (existing.length === 0
      ? 0
      : Math.max(...existing.map((s) => s.step - CUSTOM_STEP_BASE)) + 1);
  const created: TutorialCampStep = {
    day,
    step: nextStepNo,
    route: partial.route ?? "/home",
    targetKey: partial.targetKey ?? `day${day}.custom_${Date.now()}`,
    targetSelector: partial.targetSelector ?? "",
    title: partial.title,
    body: partial.body ?? "",
    osamiMessage: partial.osamiMessage ?? "",
    actionType: (partial.actionType ?? "navigate") as TutorialCampStep["actionType"],
    requireTargetClick: partial.requireTargetClick ?? false,
    allowNextWithoutClick: partial.allowNextWithoutClick ?? true,
    animation: (partial.animation ?? "spotlight") as TutorialCampStep["animation"],
    placement: (partial.placement ?? "bottom") as TutorialCampStep["placement"],
    fallbackText: partial.fallbackText ?? "",
    completionText: partial.completionText ?? "",
    completionRule: partial.completionRule,
    blockNextUntilComplete: partial.blockNextUntilComplete,
    autoAdvance: partial.autoAdvance ?? true,
    autoNavigate: partial.autoNavigate ?? false,
    helperMessage: partial.helperMessage,
    successMessage: partial.successMessage,
  };
  writeCustomStepsForDay(day, [...existing, created]);
  // 새 step 을 order 끝에 자동 추가 (순서 정의되어 있으면)
  const order = getStepOrderForDay(day);
  if (order) {
    setStepOrderForDay(day, [...order, nextStepNo]);
  }
  return created;
}

export function removeCustomStep(day: number, stepNo: number): void {
  const existing = getCustomStepsForDay(day);
  writeCustomStepsForDay(
    day,
    existing.filter((s) => s.step !== stepNo),
  );
  // order 에서도 제거
  const order = getStepOrderForDay(day);
  if (order) {
    setStepOrderForDay(
      day,
      order.filter((n) => n !== stepNo),
    );
  }
}

export function clearCustomStepsForDay(day: number): void {
  writeCustomStepsForDay(day, []);
}

/** custom 포함된 day 의 모든 step (base + custom) — order/override 적용 X. */
function getAllStepsForDay(day: number): TutorialCampStep[] {
  const base = TUTORIAL_CAMP_STEPS.filter((s) => s.day === day);
  const custom = getCustomStepsForDay(day);
  return [...base, ...custom];
}

// ─────────────────────────────────────────────────────────────
// 65-A: publish helpers — admin 이 '전체 회원 반영' 누를 때 보낼 payload.
//   현재 보이는 결과 (global + local merge) 를 publish 한다.
//   → publish 후엔 global 이 같은 값이 되어 일관됨.
// ─────────────────────────────────────────────────────────────
export interface TutorialPublishPayload {
  step_overrides: OverrideMap;
  step_order: Record<string, number[]>;
  custom_steps: Record<string, TutorialCampStep[]>;
}

/** 현재 적용된 (global + local merge) 데이터를 publish payload 로 변환. */
export function buildTutorialPublishPayload(): TutorialPublishPayload {
  const overrides = readOverrides();
  const orders = readStepOrders();
  const customs = readCustomStepsAll();

  const orderStringKeyed: Record<string, number[]> = {};
  for (const [day, arr] of Object.entries(orders)) {
    orderStringKeyed[String(day)] = arr;
  }

  const customStringKeyed: Record<string, TutorialCampStep[]> = {};
  for (const [day, arr] of Object.entries(customs)) {
    customStringKeyed[String(day)] = arr;
  }

  return {
    step_overrides: overrides,
    step_order: orderStringKeyed,
    custom_steps: customStringKeyed,
  };
}

/** 64-X: order 에서 빠진 (hidden) base step 들 — 다시 넣기 UI 용.
 *   custom step 도 포함 (admin 이 만든 것 hidden 상태일 수 있음).
 */
export function getHiddenStepsForDay(day: number): TutorialCampStep[] {
  const order = getStepOrderForDay(day);
  if (!order) return [];
  const all = getAllStepsForDay(day);
  const inOrder = new Set(order);
  return all.filter((s) => !inOrder.has(s.step));
}

/** 64-X: 현재 day 의 base + custom step 모두를 order 에 넣기 (정렬 시작점). */
export function ensureFullOrderForDay(day: number): void {
  const all = getAllStepsForDay(day);
  const existing = getStepOrderForDay(day);
  if (existing) return;
  setStepOrderForDay(
    day,
    all.map((s) => s.step),
  );
}

/** 특정 day × step 의 단일 step. 없으면 null. admin override + order 적용.
 *  64-AN: originalStep 식별은 base + custom 통합 list 에서 targetKey 로.
 *    이전엔 base 만 검사 → custom step 의 reassign step number 가 base step number
 *    와 충돌해 다른 step 의 override 가 적용되는 버그 발생.
 */
export function getStep(day: number, step: number): TutorialCampStep | null {
  const list = getOrderedStepsByDay(day);
  const found = list[step];
  if (!found) return null;
  const allOriginal = [
    ...TUTORIAL_CAMP_STEPS.filter((s) => s.day === day),
    ...getCustomStepsForDay(day),
  ];
  const baseStep =
    allOriginal.find((o) => o.targetKey === found.targetKey)?.step ??
    found.step;
  const ov = getStepOverride(day, baseStep);
  return ov ? ({ ...found, ...ov } as TutorialCampStep) : found;
}

/** day 의 step 수 — base + custom + order(숨김) 반영한 *실제* step 수.
 *  64-AZ 버그 수정: 이전엔 base step 만 세서 admin 이 추가한 custom step 이
 *  마지막 step 판정에서 누락 → custom step 진입 전 Day 가 완료 처리됨.
 *  getStepsByDay(day).length 가 order/custom 모두 반영한 최종 list 길이.
 */
export function getStepsCountByDay(day: number): number {
  return getStepsByDay(day).length;
}

/**
 * 64-BA 버그 수정: dev panel 의 reassigned 0-based step → original step number.
 *
 * getStep / getStepsByDay 는 override 를 *original step number* (custom step 은
 * 1000+) 로 lookup 하는데, dev panel 의 StepEditorSection 은 화면에 보이는
 * reassigned 0-based step 을 그대로 setStepOverride 에 넘겨 키가 어긋났음.
 * → custom step 의 selector/위치 수정이 적용 안 됨.
 *
 * dev panel 의 onSave/onReset 은 이 함수로 original step number 를 구한 뒤
 * setStepOverride / clearStepOverride 를 호출해야 한다.
 */
export function getOriginalStepNumber(
  day: number,
  reassignedStep: number,
): number {
  const list = getOrderedStepsByDay(day);
  const found = list[reassignedStep];
  if (!found) return reassignedStep;
  const allOriginal = [
    ...TUTORIAL_CAMP_STEPS.filter((s) => s.day === day),
    ...getCustomStepsForDay(day),
  ];
  return (
    allOriginal.find((o) => o.targetKey === found.targetKey)?.step ??
    found.step
  );
}

/** 다음 step. 같은 day 안에 다음 step 있으면 그것, 없으면 다음 day step 0. day 7 끝이면 null. */
export function getNextStep(
  day: number,
  step: number,
): TutorialCampStep | null {
  const sameDay = getStep(day, step + 1);
  if (sameDay) return sameDay;
  if (day >= 7) return null;
  return getStep(day + 1, 0);
}

/** 캠프 전체 step 수 (35) */
export const TOTAL_STEP_COUNT = TUTORIAL_CAMP_STEPS.length;
