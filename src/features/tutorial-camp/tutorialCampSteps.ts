/**
 * 7일 스타터 캠프 — 정적 step 데이터.
 *
 * 65-F: 커리큘럼 전면 재구성 — 각 Day 가 하나의 메뉴를 상세 안내.
 *   Day 1 153 챌린지 / Day 2 훈련 탭(핵심·23단계) / Day 3 단증혜택 /
 *   Day 4 153마인드셋 / Day 5 랭크업 / Day 6 153다이어트 / Day 7 가이드 + 가치 전달.
 *   각 step 은 회원에게 노출되는 안내 한 단위. 혼합형 — 핵심 카드는 직접 탭,
 *   개념·가치는 읽기 카드(targetSelector "").
 *
 * 보호 규칙:
 *   · 장소 표현 "153복싱짐" 만 사용
 *   · 금지어 0: 링 / 체육관 / 복싱장 / gym / RPG / 몬스터 / 전투 / 보스 / 판타지
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

// 65-F: Day 1 전면 재구성 — 153 챌린지 메뉴(/myboxer/quest)의 모든 기능을
//   상세히 안내. 혼합형: 핵심 카드는 직접 탭, 개념·가치는 읽기 카드.
const DAY_1_STEPS: TutorialCampStep[] = [
  // ── 0. 153 챌린지가 뭐예요? (읽기 — 진입) ──
  {
    day: 1,
    step: 0,
    route: "/myboxer/quest",
    targetKey: "day1.intro",
    targetSelector: "",
    title: "153 챌린지에 오신 걸 환영해요",
    body: "153 챌린지는 공식 훈련과 별개로,\n회원끼리 도전 점수로 가볍게 겨루는 자리예요.\n오늘은 이 메뉴를 천천히 둘러볼게요.",
    osamiMessage: "안녕하세요. 같이 시작해볼게요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "하단 전체 메뉴 → 153 챌린지에서 이 화면을 볼 수 있어요.",
    completionText: "153 챌린지, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "좋아요. 첫 번째 카드를 볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 회원 간 도전 점수 랭킹 ──
  {
    day: 1,
    step: 1,
    route: "/myboxer/quest",
    targetKey: "day1.leaderboard",
    targetSelector: '[data-tour="challenge153-leaderboard"]',
    title: "회원 간 도전 점수",
    body: "여기는 153 회원들이 모은 도전 점수 랭킹이에요.\n주간·월간·전체로 볼 수 있어요. 한 번 눌러볼까요?",
    osamiMessage: "내 점수가 어디쯤인지 보여요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "153 챌린지 화면 위쪽에 회원 간 랭킹 카드가 있어요.",
    completionText: "도전 점수 랭킹을 봤어요.",
    helperMessage: "여기 랭킹 카드를 눌러보세요.",
    successMessage: "좋아요. 다음으로 가볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 2. 랭킹의 의미 (읽기) ──
  {
    day: 1,
    step: 2,
    route: "/myboxer/quest",
    targetKey: "day1.leaderboard_meaning",
    targetSelector: "",
    title: "공식 기록과는 별개예요",
    body: "153 챌린지 점수는 공식 1~40 단계나\n명예의 전당과는 무관해요.\n부담 없이 즐기는 별도의 재미라고 보면 돼요.",
    osamiMessage: "가볍게 즐기는 자리예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "153 챌린지는 공식 훈련 기록과 분리된 별도 랭킹이에요.",
    completionText: "공식 기록과 별개 — 부담 없이 즐겨요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "이제 오삼 코치 브리핑을 볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 3. 오삼 코치 오늘의 브리핑 ──
  {
    day: 1,
    step: 3,
    route: "/myboxer/quest",
    targetKey: "day1.osami_briefing",
    targetSelector: '[data-tour="osami-briefing-card"]',
    title: "오삼 코치의 오늘 브리핑",
    body: "매일 오삼 코치가 짧게 오늘의 한마디를 남겨요.\n여기를 눌러 오늘의 브리핑을 확인해보세요.",
    osamiMessage: "매일 짧게 곁에 있을게요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "153 챌린지 화면에 오삼 코치 브리핑 카드가 있어요.",
    completionText: "오늘의 브리핑을 확인했어요.",
    helperMessage: "여기 브리핑 카드를 눌러보세요.",
    successMessage: "좋아요. 보조 퀘스트로 가볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 4. 오늘의 라운드 보조 퀘스트 영역 ──
  {
    day: 1,
    step: 4,
    route: "/myboxer/quest",
    targetKey: "day1.quest_mini_panel",
    targetSelector: '[data-tour="quest-mini-panel"]',
    title: "오늘의 보조 퀘스트",
    body: "여기가 오늘 할 수 있는 가벼운 보조 퀘스트 모음이에요.\n복싱 IQ · 챌린지 아레나가 매일 새로 열려요.",
    osamiMessage: "오늘의 작은 미션들이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "153 챌린지 화면 아래쪽 '오늘의 라운드' 영역이에요.",
    completionText: "오늘의 보조 퀘스트 영역이에요.",
    helperMessage: "여기 보조 퀘스트 영역을 눌러보세요.",
    successMessage: "좋아요. 복싱 IQ 부터 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 5. 복싱 IQ 카드 ──
  {
    day: 1,
    step: 5,
    route: "/myboxer/quest",
    targetKey: "day1.quest_mini_academy",
    targetSelector: '[data-tour="quest-mini-academy"]',
    title: "복싱 IQ — 오늘의 퀴즈",
    body: "하루 한 문제, 복싱 상식을 가볍게 푸는 퀴즈예요.\n여기를 눌러 한 번 열어볼까요?",
    osamiMessage: "머리로 한 번, 몸으로 한 번.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "보조 퀘스트 영역에서 '복싱 IQ' 카드를 누르세요.",
    completionText: "복싱 IQ 가 열렸어요.",
    helperMessage: "여기 복싱 IQ 카드를 눌러보세요.",
    successMessage: "둘러보고 닫으면 다음으로 가요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 6. 챌린지 아레나 카드 ──
  {
    day: 1,
    step: 6,
    route: "/myboxer/quest",
    targetKey: "day1.quest_mini_challenge",
    targetSelector: '[data-tour="quest-mini-challenge"]',
    title: "챌린지 아레나",
    body: "번개 잽 / 원투 / 스쿼트 같은\n짧은 도전 라운드가 모인 곳이에요.\n여기를 눌러 한 번 들어가볼까요?",
    osamiMessage: "짧게 한 라운드, 가볍게요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "보조 퀘스트 영역에서 '챌린지 아레나' 카드를 누르세요.",
    completionText: "챌린지 아레나를 열었어요.",
    helperMessage: "여기 챌린지 아레나 카드를 눌러보세요.",
    successMessage: "좋아요. 거의 다 봤어요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 7. 보조 퀘스트의 의미 (읽기) ──
  {
    day: 1,
    step: 7,
    route: "/myboxer/quest",
    targetKey: "day1.quest_meaning",
    targetSelector: "",
    title: "보조 퀘스트는 재미와 습관",
    body: "보조 퀘스트는 공식 훈련을 대신하는 게 아니에요.\n오늘 짐에 오는 작은 이유, 가벼운 습관을 만드는 자리예요.",
    osamiMessage: "작은 한 번이 매일을 만들어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "보조 퀘스트는 공식 1~40 단계와 무관한 가벼운 미션이에요.",
    completionText: "재미와 습관 — 그게 153 챌린지예요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 1 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 8. Day 1 완료 ──
  {
    day: 1,
    step: 8,
    route: "/myboxer/quest",
    targetKey: "day1.complete",
    targetSelector: "",
    title: "Day 1 완료",
    body: "첫 날 잘하셨어요.\n153 챌린지의 랭킹 · 브리핑 · 보조 퀘스트를 모두 둘러봤어요.\n내일은 가장 중요한 훈련 탭을 만나요.",
    osamiMessage: "오늘도 잘 와줘서 고마워요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 1 완료 화면입니다.",
    completionText: "내일 Day 2에서 훈련 탭을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 2 — 마스터로드 / 공식 훈련
// ─────────────────────────────────────────────────────────────

// 65-F: Day 2 전면 재구성 — 훈련 탭(/missions)은 마이복서153의 핵심.
//   화이트 리그 → Lv.1 상세 → 배우기/수업실행/심사 3탭까지 23단계로 상세 안내.
//   혼합형: 탭·카드 진입은 직접 탭, 카드 내용 설명은 스포트라이트 읽기.
const DAY_2_STEPS: TutorialCampStep[] = [
  // ── 0. 훈련 탭 소개 (읽기 — 진입) ──
  {
    day: 2,
    step: 0,
    route: "/missions",
    targetKey: "day2.intro",
    targetSelector: "",
    title: "훈련 탭 — 마이복서153의 심장",
    body: "오늘은 가장 중요한 훈련 탭이에요.\n공식 1~40 단계가 모두 여기에 있어요.\n천천히, 빠짐없이 같이 둘러볼게요.",
    osamiMessage: "여기가 매일 돌아오는 자리예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "하단 메뉴의 훈련 아이콘으로 들어올 수 있어요.",
    completionText: "훈련 탭을 같이 익혀봐요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "좋아요. 훈련 화면을 볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 훈련 화면 전체 ──
  {
    day: 2,
    step: 1,
    route: "/missions",
    targetKey: "day2.training_screen",
    targetSelector: '[data-tour="missions-official-training"]',
    title: "훈련 메인 화면",
    body: "여기가 공식 훈련을 모아둔 메인 화면이에요.\n반짝이는 영역을 한 번 눌러볼까요?",
    osamiMessage: "이 화면이 매일의 출발점이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "하단 메뉴의 훈련 아이콘으로 들어올 수 있어요.",
    completionText: "훈련 화면은 매일의 출발점이에요.",
    helperMessage: "반짝이는 영역을 눌러보세요.",
    successMessage: "좋아요. 위쪽 토글을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 2. 올리그 / 레벨 미션 영상 토글 ──
  {
    day: 2,
    step: 2,
    route: "/missions",
    targetKey: "day2.tab_control",
    targetSelector: '[data-tour="missions-tab-control"]',
    title: "올리그 / 레벨 미션 영상 토글",
    body: "훈련 화면은 두 가지 보기로 나뉘어요.\n'올리그'는 단계별 수업, '레벨 미션 영상'은 레벨별 훈련 영상이에요.\n여기를 한 번 눌러볼까요?",
    osamiMessage: "두 가지 보기가 있어요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "훈련 화면 위쪽에 올리그/레벨 미션 영상 토글이 있어요.",
    completionText: "두 가지 보기 토글이에요.",
    helperMessage: "여기 토글을 눌러보세요.",
    successMessage: "좋아요. 올리그 구조를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 올리그 구조 설명 (읽기) ──
  {
    day: 2,
    step: 3,
    route: "/missions",
    targetKey: "day2.league_structure",
    targetSelector: "",
    title: "화이트 → 블루 → 레드 → 블랙",
    body: "올리그는 4개 리그, 각 10단계로 총 40단계예요.\n화이트부터 차근차근 — 습관 → 기본기 → 실전 → 코칭으로 이어져요.",
    osamiMessage: "한 단계씩, 천천히 가면 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "올리그는 화이트·블루·레드·블랙 4개 리그로 구성돼요.",
    completionText: "40단계, 한 줄로 이어진 길이에요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "이제 화이트 리그를 펼쳐볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 4. 화이트 리그 펼치기 ──
  {
    day: 2,
    step: 4,
    route: "/missions",
    targetKey: "day2.white_accordion",
    targetSelector: '[data-tour="white-league-accordion"]',
    title: "화이트 리그 펼치기",
    body: "첫 리그, 화이트예요.\n여기를 눌러 안의 10단계를 펼쳐볼게요.",
    osamiMessage: "여기서 모두 시작해요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "올리그 보기에서 '화이트 리그' 카드를 누르면 펼쳐져요.",
    completionText: "화이트 리그가 펼쳐졌어요.",
    helperMessage: "여기 화이트 리그를 눌러보세요.",
    successMessage: "좋아요. Lv.1 로 들어가볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 5. Lv.1 카드 진입 ──
  {
    day: 2,
    step: 5,
    route: "/missions",
    targetKey: "day2.white_level_1",
    targetSelector: '[data-tour="white-level-1-card"]',
    title: "화이트 Lv.1 들어가기",
    body: "스탠스 · 가드 · 잽 — 첫 단계 Lv.1 이에요.\n카드를 눌러 상세 화면으로 들어가볼게요.",
    osamiMessage: "첫 단계, 같이 들어가봐요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "화이트 리그를 펼치면 맨 위에 Lv.1 카드가 있어요.",
    completionText: "Lv.1 상세 화면이 열렸어요.",
    helperMessage: "여기 Lv.1 카드를 눌러보세요.",
    successMessage: "좋아요. 상세 화면을 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 6. 레벨 카드 (내 캐릭터 + 단계) ──
  {
    day: 2,
    step: 6,
    route: "/missions",
    targetKey: "day2.detail_hero",
    targetSelector: '[data-tour="white-detail-hero"]',
    title: "내 캐릭터와 단계",
    body: "상세 화면 맨 위에는 내 캐릭터와 현재 단계가 보여요.\n단계가 오를수록 캐릭터도 함께 자라요.",
    osamiMessage: "내 모습이 같이 자라는 게 보여요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "Lv.1 상세 화면 맨 위에 캐릭터 카드가 있어요.",
    completionText: "캐릭터와 단계가 한눈에 보여요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 소요 시간과 보상이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 7. 소요 시간 / 보상 ──
  {
    day: 2,
    step: 7,
    route: "/missions",
    targetKey: "day2.detail_stats",
    targetSelector: '[data-tour="white-detail-stats"]',
    title: "소요 시간과 보상",
    body: "이 단계가 몇 분 걸리는지, 얼마의 XP를 주는지\n여기서 한눈에 볼 수 있어요.",
    osamiMessage: "오늘 얼마나 걸릴지 미리 알 수 있어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "상세 화면에 소요 시간·보상 카드가 나란히 있어요.",
    completionText: "시간과 보상을 미리 확인했어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "이제 3개 탭을 차례로 볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 8. 3탭 구조 안내 ──
  {
    day: 2,
    step: 8,
    route: "/missions",
    targetKey: "day2.tabs_overview",
    targetSelector: '[data-tour="white-league-tabs"]',
    title: "배우기 · 수업실행 · 심사",
    body: "각 단계는 3개의 탭으로 되어 있어요.\n배우기(머리로 익히기) → 수업실행(몸으로 하기) → 심사(다음 단계 조건).\n하나씩 같이 볼게요.",
    osamiMessage: "세 탭이 한 단계의 전부예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "상세 화면에 배우기/수업실행/심사 탭 줄이 있어요.",
    completionText: "한 단계 = 배우기 + 수업실행 + 심사.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "먼저 배우기 탭이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 9. 배우기 탭 ──
  {
    day: 2,
    step: 9,
    route: "/missions",
    targetKey: "day2.tab_learn",
    targetSelector: '[data-tour="white-league-tab-learn"]',
    title: "배우기 탭",
    body: "먼저 '배우기' 탭이에요.\n오늘 배울 자세를 머리로 먼저 잡는 곳이에요.\n탭을 한 번 눌러볼까요?",
    osamiMessage: "머리로 먼저, 그 다음 몸으로요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '📖 배우기' 를 눌러주세요.",
    completionText: "배우기 탭이 열렸어요.",
    helperMessage: "여기 '배우기' 탭을 눌러보세요.",
    successMessage: "좋아요. 안의 카드들을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 10. 학습 모듈 ──
  {
    day: 2,
    step: 10,
    route: "/missions",
    targetKey: "day2.learn_modules",
    targetSelector: '[data-tour="white-learn-modules"]',
    title: "학습 모듈",
    body: "오늘 익힐 자세를 작은 단위로 나눠둔 카드예요.\n핵심 포인트가 한 줄씩 정리돼 있어요.",
    osamiMessage: "한 번에 다 외우지 않아도 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "배우기 탭 안에 '학습 모듈' 카드가 있어요.",
    completionText: "자세를 작은 단위로 익혀요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 오늘의 목적이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 11. 오늘의 목적 ──
  {
    day: 2,
    step: 11,
    route: "/missions",
    targetKey: "day2.learn_purpose",
    targetSelector: '[data-tour="white-learn-purpose"]',
    title: "오늘의 목적",
    body: "이 단계를 왜 하는지 — 오늘의 목적이 적혀 있어요.\n방향을 알면 동작이 더 또렷해져요.",
    osamiMessage: "왜 하는지를 알면 흔들리지 않아요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "배우기 탭 안에 '오늘의 목적' 카드가 있어요.",
    completionText: "목적을 알면 동작이 또렷해져요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 오늘 얻는 가치예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 12. 오늘 얻는 가치 ──
  {
    day: 2,
    step: 12,
    route: "/missions",
    targetKey: "day2.learn_value",
    targetSelector: '[data-tour="white-learn-value"]',
    title: "오늘 얻는 가치",
    body: "이 단계를 마치면 무엇이 좋아지는지 알려주는 카드예요.\n작은 한 단계도 분명한 가치를 남겨요.",
    osamiMessage: "오늘 한 번이 분명히 남아요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "배우기 탭 안에 '오늘 얻는 가치' 카드가 있어요.",
    completionText: "작은 한 단계도 가치를 남겨요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 코치 포인트예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 13. 코치 포인트 ──
  {
    day: 2,
    step: 13,
    route: "/missions",
    targetKey: "day2.learn_coach",
    targetSelector: '[data-tour="white-learn-coach"]',
    title: "코치 포인트",
    body: "코치가 특히 봐주는 포인트가 정리돼 있어요.\n혼자 할 때도 이 부분만 신경 쓰면 자세가 좋아져요.",
    osamiMessage: "이 부분만 봐도 자세가 달라져요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "배우기 탭 안에 '코치 포인트' 카드가 있어요.",
    completionText: "코치가 봐주는 포인트예요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "이제 수업실행 탭으로 가볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 14. 수업실행 탭 ──
  {
    day: 2,
    step: 14,
    route: "/missions",
    targetKey: "day2.tab_session",
    targetSelector: '[data-tour="white-league-tab-session"]',
    title: "수업실행 탭",
    body: "이제 '수업실행' 탭이에요.\n실제 50분 수업을 어떻게 하는지 풀어둔 곳이에요.\n탭을 한 번 눌러볼까요?",
    osamiMessage: "이제 몸으로 할 차례예요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '🥊 수업실행' 을 눌러주세요.",
    completionText: "수업실행 탭이 열렸어요.",
    helperMessage: "여기 '수업실행' 탭을 눌러보세요.",
    successMessage: "좋아요. 수업 구성을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 15. 50분 수업 구성 ──
  {
    day: 2,
    step: 15,
    route: "/missions",
    targetKey: "day2.session_blocks",
    targetSelector: '[data-tour="white-session-blocks"]',
    title: "50분 수업 구성",
    body: "워밍업 · 기본기 · 본운동 · 마무리가\n시간대별 블록으로 나뉘어 있어요.\n각 블록을 누르면 세부 동작도 볼 수 있어요.",
    osamiMessage: "한 블록씩 따라가면 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "수업실행 탭 안에 '50분 수업 구성' 카드가 있어요.",
    completionText: "수업이 어떻게 흐르는지 보셨어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 '수업 시작' 버튼이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 16. 수업 시작 버튼 안내 (가운데 읽기 카드) ──
  //   65-H: 실제 '수업 시작' 버튼을 spotlight 하면 회원이 눌러 SessionRunner 가
  //   열리고, 다음 step (XP 규칙) 의 target 이 detail view 와 함께 사라진다.
  //   spotlight 제거하고 본문으로 위치만 안내. 회원이 직접 '다음으로'.
  {
    day: 2,
    step: 16,
    route: "/missions",
    targetKey: "day2.session_start",
    targetSelector: "",
    title: "수업 시작 버튼",
    body: "수업실행 탭 위쪽에 '🥊 수업 시작' 초록 버튼이 있어요.\n누르면 블록을 하나씩 따라가는 진행 화면이 열려요.\n지금은 위치만 알아두고, 실제 운동할 때 눌러보세요.",
    osamiMessage: "오늘은 위치만 알아둬도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "수업실행 탭 안에 '수업 시작' 버튼이 있어요.",
    completionText: "수업 시작 버튼의 위치를 알았어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "다음은 XP 규칙이에요.",
    completionRule: "manual_confirm",
  },
  // ── 17. XP 규칙 ──
  {
    day: 2,
    step: 17,
    route: "/missions",
    targetKey: "day2.session_xp",
    targetSelector: '[data-tour="white-session-xp"]',
    title: "XP 규칙",
    body: "어떤 활동이 얼마의 XP를 주는지 여기에 정리돼 있어요.\n오늘 도전하면 보너스 XP도 함께 와요.",
    osamiMessage: "오늘 한 만큼 정직하게 쌓여요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "수업실행 탭 안에 'XP 규칙' 카드가 있어요.",
    completionText: "XP가 어떻게 쌓이는지 알았어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "마지막은 심사 탭이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 18. 심사 탭 ──
  {
    day: 2,
    step: 18,
    route: "/missions",
    targetKey: "day2.tab_check",
    targetSelector: '[data-tour="white-league-tab-check"]',
    title: "심사 탭",
    body: "마지막은 '심사' 탭이에요.\n다음 단계로 가기 위한 조건이 여기 있어요.\n탭을 한 번 눌러볼까요?",
    osamiMessage: "조건을 알면 길이 보여요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '✅ 심사' 를 눌러주세요.",
    completionText: "심사 탭이 열렸어요.",
    helperMessage: "여기 '심사' 탭을 눌러보세요.",
    successMessage: "좋아요. 조건을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 19. 단계 조건 ──
  {
    day: 2,
    step: 19,
    route: "/missions",
    targetKey: "day2.check_conditions",
    targetSelector: '[data-tour="white-check-conditions"]',
    title: "다음 단계 조건",
    body: "XP · 인정 세션 · 출석일 · 훈련 시간 —\n다음 단계로 가려면 채워야 할 항목이 정리돼 있어요.\n부담이 아니라 방향 표시예요.",
    osamiMessage: "조건은 길을 알려주는 표지판이에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "심사 탭 안에 단계 조건 카드가 있어요.",
    completionText: "다음 단계로 가는 길을 봤어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 체크테스트예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 20. 체크테스트 ──
  {
    day: 2,
    step: 20,
    route: "/missions",
    targetKey: "day2.check_checklist",
    targetSelector: '[data-tour="white-check-checklist"]',
    title: "체크테스트",
    body: "단계 마무리에는 간단한 체크테스트가 있어요.\n배운 걸 스스로 점검하는 짧은 확인 과정이에요.",
    osamiMessage: "스스로 한 번 확인하는 거예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "심사 탭 안에 '체크테스트' 카드가 있어요.",
    completionText: "체크테스트로 스스로 점검해요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "거의 다 왔어요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 21. 코치 승인 / 오늘 도전 (읽기) ──
  {
    day: 2,
    step: 21,
    route: "/missions",
    targetKey: "day2.coach_approval",
    targetSelector: "",
    title: "오늘 도전과 코치 승인",
    body: "단계는 두 가지 길로 올라가요.\n직접 '오늘 도전'을 하면 보너스가, 못 한 날은 코치가 확인해 백업해줘요.\n어느 쪽이든 빠짐없이 함께 가요.",
    osamiMessage: "혼자 두지 않아요. 코치가 함께 봐요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "단계 진행은 오늘 도전 또는 코치 승인으로 기록돼요.",
    completionText: "오늘 도전, 안 되면 코치 백업.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 2 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 22. Day 2 완료식 ──
  {
    day: 2,
    step: 22,
    route: "/missions",
    targetKey: "day2.complete",
    targetSelector: "",
    title: "Day 2 완료",
    body: "훈련 탭의 큰 그림 — 리그 → 단계 → 배우기/수업실행/심사까지\n전부 둘러봤어요. 오늘이 가장 중요한 날이었어요.\n내일은 단증혜택을 만나요.",
    osamiMessage: "여기까지 정말 잘 따라오셨어요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 2 완료 화면입니다.",
    completionText: "내일 Day 3에서 단증혜택을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 3 — 153 QUEST 둘러보기 (IQ 는 Day 1 에서 이미 진행 — 중복 제거)
// ─────────────────────────────────────────────────────────────
// 64-R: 사용자 피드백 "복싱 IQ 는 1일차에서 이미 진행하므로 다른 일차에는 X".
//   Day 1/2 와 같은 cascade 패턴 — autoNavigate + click 강조 + autoAdvance.
// 65-F: Day 3 — 단증혜택(/cert-benefits). 단증이 열어주는 미래를 학습.
const DAY_3_STEPS: TutorialCampStep[] = [
  // ── 0. 단증혜택 진입 (읽기) ──
  {
    day: 3,
    step: 0,
    route: "/cert-benefits",
    targetKey: "day3.intro",
    targetSelector: "",
    title: "오늘은 단증혜택이에요",
    body: "153 단증은 그냥 종이 한 장이 아니에요.\n공신력, 진로, 취업, 지도자 신뢰까지 이어져요.\n어떤 혜택이 있는지 같이 둘러볼게요.",
    osamiMessage: "단증이 열어주는 미래를 볼게요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "하단 메뉴 → 단증혜택에서 이 화면을 볼 수 있어요.",
    completionText: "단증혜택, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "좋아요. 첫 화면부터 볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 단증이 열어주는 미래 ──
  {
    day: 3,
    step: 1,
    route: "/cert-benefits",
    targetKey: "day3.hero",
    targetSelector: '[data-tour="cert-hero"]',
    title: "단증이 열어주는 미래",
    body: "복싱단증은 실력의 증명에서 끝나지 않아요.\n공신력 · 진로 · 취업 · 지도자 신뢰까지 연결돼요.",
    osamiMessage: "종이 한 장이 길을 열어줘요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "단증혜택 화면 맨 위에 소개 영역이 있어요.",
    completionText: "단증은 실력의 증명, 그 이상이에요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 단증 종류별 카드예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 2. 단증 종류별 카드 ──
  {
    day: 3,
    step: 2,
    route: "/cert-benefits",
    targetKey: "day3.carousel",
    targetSelector: '[data-tour="cert-carousel"]',
    title: "단증 종류별 카드",
    body: "단증이 실제로 어디에 쓰이는지\n카드로 하나씩 정리돼 있어요.\n좌우로 넘기면 더 많은 카드를 볼 수 있어요.",
    osamiMessage: "좌우로 한 번 넘겨보세요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "단증혜택 화면에 좌우로 넘기는 카드 영역이 있어요.",
    completionText: "단증의 쓰임을 카드로 봤어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 단증 로드맵이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 3. 단증 로드맵 ──
  {
    day: 3,
    step: 3,
    route: "/cert-benefits",
    targetKey: "day3.roadmap",
    targetSelector: '[data-tour="cert-roadmap"]',
    title: "마이복서153 → 단증 로드맵",
    body: "각 리그 단계를 마치면\n그 단수 심사에 도전할 실력이 완성돼요.\n훈련과 단증이 한 줄로 이어져요.",
    osamiMessage: "오늘의 훈련이 단증으로 이어져요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "단증혜택 화면에 '단증 로드맵' 영역이 있어요.",
    completionText: "훈련과 단증은 한 줄로 이어져요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 마스터 달성 혜택이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 4. 블랙 마스터 달성 혜택 ──
  {
    day: 3,
    step: 4,
    route: "/cert-benefits",
    targetKey: "day3.master_reward",
    targetSelector: '[data-tour="cert-master-reward"]',
    title: "블랙 마스터 달성 시",
    body: "153 전 과정을 완주하면 받는 특별한 혜택이에요.\n멀어 보여도, 한 단계씩 가면 닿는 자리예요.",
    osamiMessage: "끝까지 간 사람에게 주는 자리예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "단증혜택 화면에 블랙 마스터 혜택 영역이 있어요.",
    completionText: "끝까지 가면 닿는 자리예요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 실제 가점 상세 정보예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 5. 실제 가점 상세 정보 ──
  {
    day: 3,
    step: 5,
    route: "/cert-benefits",
    targetKey: "day3.detail",
    targetSelector: '[data-tour="cert-detail-accordions"]',
    title: "실제 가점 상세 정보",
    body: "단증이 실제 어떤 전형에서 가점이 되는지\n항목별로 펼쳐볼 수 있어요.\n궁금한 항목을 눌러 열어보세요.",
    osamiMessage: "궁금한 항목을 눌러보세요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "단증혜택 화면에 '실제 가점 상세 정보' 영역이 있어요.",
    completionText: "가점 상세 정보를 봤어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 자주 묻는 질문이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 6. 자주 묻는 질문 ──
  {
    day: 3,
    step: 6,
    route: "/cert-benefits",
    targetKey: "day3.faq",
    targetSelector: '[data-tour="cert-faq"]',
    title: "자주 묻는 질문",
    body: "단증에 대해 가장 많이 묻는 질문을 모았어요.\n궁금한 게 생기면 언제든 여기로 돌아오면 돼요.",
    osamiMessage: "궁금하면 언제든 여기로 와요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "단증혜택 화면 아래쪽에 'FAQ' 영역이 있어요.",
    completionText: "궁금한 건 FAQ 에서 찾을 수 있어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "Day 3 마무리할게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 7. 단증은 결과가 아니라 길 (읽기) ──
  {
    day: 3,
    step: 7,
    route: "/cert-benefits",
    targetKey: "day3.meaning",
    targetSelector: "",
    title: "단증은 길이에요",
    body: "한 번에 다 외울 필요 없어요.\n단계가 오를 때마다, 그 단계의 단증 안내가 다시 나와요.\n지금은 '이런 게 있구나' 만 알아도 충분해요.",
    osamiMessage: "지금은 위치만 알아도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "단계가 오를 때마다 해당 단증 안내가 다시 표시돼요.",
    completionText: "단증의 흐름을 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 3 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 8. Day 3 완료 ──
  {
    day: 3,
    step: 8,
    route: "/cert-benefits",
    targetKey: "day3.complete",
    targetSelector: "",
    title: "Day 3 완료",
    body: "단증이 열어주는 미래 — 혜택 · 로드맵 · 가점까지\n모두 둘러봤어요.\n내일은 153마인드셋을 만나요.",
    osamiMessage: "방향이 있는 사람은 흔들리지 않아요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 3 완료 화면입니다.",
    completionText: "내일 Day 4에서 153마인드셋을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 4 — 랭킹 + 단증혜택
// ─────────────────────────────────────────────────────────────

// 65-F: Day 4 — 153마인드셋(/myboxer/visualization). 운동 전 1분 시각화 훈련.
const DAY_4_STEPS: TutorialCampStep[] = [
  // ── 0. 153마인드셋 진입 (읽기) ──
  {
    day: 4,
    step: 0,
    route: "/myboxer/visualization",
    targetKey: "day4.intro",
    targetSelector: "",
    title: "오늘은 153마인드셋이에요",
    body: "복싱은 강해지는 시간이기도 하지만,\n나를 다시 좋아하게 되는 시간이기도 해요.\n153마인드셋은 그 마음을 데우는 짧은 시각화 훈련이에요.",
    osamiMessage: "몸보다 마음을 먼저 데워요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "전체 메뉴 → 153마인드셋에서 이 화면을 볼 수 있어요.",
    completionText: "153마인드셋, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "좋아요. 화면을 둘러볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 마인드셋 소개 영역 ──
  {
    day: 4,
    step: 1,
    route: "/myboxer/visualization",
    targetKey: "day4.intro_box",
    targetSelector: '[data-tour="mindset-intro"]',
    title: "왜 마음을 먼저 데우나요",
    body: "운동 전 마음이 정리되면\n그날의 동작이 더 또렷하고 정확해져요.\n이 한 줄이 153마인드셋의 시작이에요.",
    osamiMessage: "마음이 깨어 있어야 몸도 따라와요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "153마인드셋 화면 위쪽에 소개 영역이 있어요.",
    completionText: "마음을 먼저 데우는 이유예요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 두 가지 세션이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 2. 두 가지 세션 ──
  {
    day: 4,
    step: 2,
    route: "/myboxer/visualization",
    targetKey: "day4.session_list",
    targetSelector: '[data-tour="mindset-session-list"]',
    title: "두 가지 세션",
    body: "'오늘 한 라운드'는 오늘의 마음을 다시 세우고,\n'장기 시각화'는 1년 뒤의 나를 미리 만나요.\n둘 다 짧은 1라운드 안에 끝나요.",
    osamiMessage: "오늘의 나, 그리고 1년 뒤의 나.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "153마인드셋 화면에 두 가지 세션 카드가 있어요.",
    completionText: "두 가지 세션이 있어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "첫 세션을 한 번 열어볼까요?",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 3. 첫 세션 열기 ──
  {
    day: 4,
    step: 3,
    route: "/myboxer/visualization",
    targetKey: "day4.session_card",
    targetSelector: '[data-tour="mindset-session-card"]',
    title: "'오늘 한 라운드' 열기",
    body: "첫 번째 세션을 한 번 눌러볼까요?\n안에 어떤 흐름인지 같이 볼게요.",
    osamiMessage: "가볍게 한 번 들어가봐요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "153마인드셋 화면에서 첫 번째 세션 카드를 누르세요.",
    completionText: "세션 화면이 열렸어요.",
    helperMessage: "여기 첫 세션 카드를 눌러보세요.",
    successMessage: "좋아요. 시작 버튼을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 4. 시작 버튼 안내 (읽기 — 실제 진행은 회원이 원할 때) ──
  {
    day: 4,
    step: 4,
    route: "/myboxer/visualization",
    targetKey: "day4.start_button",
    targetSelector: '[data-tour="mindset-start-button"]',
    title: "세션 시작 버튼",
    body: "이 버튼을 누르면 1분 안팎의 짧은 시각화가 시작돼요.\n오늘은 위치만 알아두고, 운동 전에 직접 해보세요.",
    osamiMessage: "오늘은 위치만 알아둬도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "세션 화면 안에 '시작' 버튼이 있어요.",
    completionText: "시작 버튼의 위치를 알았어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "마인드셋의 효과를 정리해볼게요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 5. 마인드셋의 효과 (읽기) ──
  {
    day: 4,
    step: 5,
    route: "/myboxer/visualization",
    targetKey: "day4.effect",
    targetSelector: "",
    title: "머리부터 단단해지기",
    body: "1분의 시각화는 그날의 운동을 더 정확하게 만들어줘요.\n매일 똑같이 안 해도 괜찮아요. 필요한 날만이라도요.\n진행 기록은 단말기에만 저장돼요.",
    osamiMessage: "머리가 깨어 있어야 몸도 따라와요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "153마인드셋 세션은 1분 안에 끝나는 짧은 시각화예요.",
    completionText: "마인드셋의 효과를 알게 됐어요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 4 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 6. Day 4 완료 ──
  {
    day: 4,
    step: 6,
    route: "/myboxer/visualization",
    targetKey: "day4.complete",
    targetSelector: "",
    title: "Day 4 완료",
    body: "153마인드셋 — 운동 전 마음을 데우는 자리를 알게 됐어요.\n내일은 랭크업을 만나요.",
    osamiMessage: "머리가 단단한 사람이 결국 단단한 사람이에요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 4 완료 화면입니다.",
    completionText: "내일 Day 5에서 랭크업을 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 5 — 153 커뮤니티 (세컨드 응원 / 코너맨)
// ─────────────────────────────────────────────────────────────

// 65-F: Day 5 — 랭크업(/rank-up). 40단계 로드맵과 가치맵으로 전체 길을 봄.
const DAY_5_STEPS: TutorialCampStep[] = [
  // ── 0. 랭크업 진입 (현재 진행) ──
  {
    day: 5,
    step: 0,
    route: "/rank-up",
    targetKey: "day5.intro",
    targetSelector: "",
    title: "오늘은 랭크업이에요",
    body: "랭크업은 내가 지금 어디쯤 와 있는지,\n앞으로 어디로 가는지 한눈에 보는 곳이에요.\n전체 길을 같이 볼게요.",
    osamiMessage: "내 위치와 내 길을 같이 봐요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "하단 메뉴의 랭크업에서 이 화면을 볼 수 있어요.",
    completionText: "랭크업, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "좋아요. 현재 진행부터 볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
    autoNavigate: true,
  },
  // ── 1. 현재 진행 ──
  {
    day: 5,
    step: 1,
    route: "/rank-up",
    targetKey: "day5.progress",
    targetSelector: '[data-tour="rankup-progress"]',
    title: "현재 진행",
    body: "지금 내가 40단계 중 몇 단계인지\n한눈에 보여주는 카드예요.\n오늘의 한 걸음이 여기 바로 반영돼요.",
    osamiMessage: "지금 내 자리예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "랭크업 화면 위쪽에 '현재 진행' 카드가 있어요.",
    completionText: "지금 내 자리를 봤어요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 두 가지 보기 탭이에요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 2. 로드맵 / 가치맵 탭 ──
  {
    day: 5,
    step: 2,
    route: "/rank-up",
    targetKey: "day5.tabs",
    targetSelector: '[data-tour="rankup-tabs"]',
    title: "로드맵 · 가치맵",
    body: "랭크업은 두 가지 보기로 나뉘어요.\n'로드맵'은 40단계 지도, '가치맵'은 각 단계가 주는 가치예요.\n여기를 한 번 눌러볼까요?",
    osamiMessage: "두 가지 보기가 있어요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "랭크업 화면 위쪽에 로드맵/가치맵 탭이 있어요.",
    completionText: "두 가지 보기 탭이에요.",
    helperMessage: "여기 탭을 눌러보세요.",
    successMessage: "좋아요. 로드맵을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 40단계 로드맵 ──
  {
    day: 5,
    step: 3,
    route: "/rank-up",
    targetKey: "day5.levelmap",
    targetSelector: '[data-tour="rankup-levelmap"]',
    title: "40단계 로드맵",
    body: "화이트부터 블랙까지 40개 단계가\n지도처럼 펼쳐져 있어요.\n지금 내 위치와 앞으로 갈 길이 한눈에 보여요.",
    osamiMessage: "한 칸씩, 천천히 가면 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "로드맵 보기에서 40단계 지도를 볼 수 있어요.",
    completionText: "전체 길이 한눈에 보여요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 마스터 리그예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 4. 마스터 리그 ──
  {
    day: 5,
    step: 4,
    route: "/rank-up",
    targetKey: "day5.master_league",
    targetSelector: '[data-tour="rankup-master-league"]',
    title: "마스터 리그",
    body: "40단계를 모두 지나면 마스터 리그가 열려요.\n끝까지 간 사람을 위한 특별한 자리예요.\n멀어 보여도, 매일의 한 걸음이 닿게 해줘요.",
    osamiMessage: "끝은 한 걸음씩의 합이에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "로드맵 아래쪽에 마스터 리그 영역이 있어요.",
    completionText: "끝까지 가면 닿는 자리예요.",
    helperMessage: "잠깐 보고 있어요. 곧 다음으로 가요.",
    successMessage: "다음은 가치맵 이야기예요.",
    completionRule: "quiz_question_read",
    autoAdvance: true,
  },
  // ── 5. 가치맵의 의미 (읽기) ──
  {
    day: 5,
    step: 5,
    route: "/rank-up",
    targetKey: "day5.valuemap_meaning",
    targetSelector: "",
    title: "가치맵 — 각 단계가 남기는 것",
    body: "위쪽 탭의 '가치맵'을 누르면\n각 단계를 마칠 때 무엇이 좋아지는지 볼 수 있어요.\n숫자가 아니라, 내가 얻는 변화의 지도예요.",
    osamiMessage: "숫자보다 변화를 봐요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "랭크업 화면의 '가치맵' 탭에서 단계별 가치를 볼 수 있어요.",
    completionText: "가치맵은 변화의 지도예요.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "랭크업의 의미를 정리해볼게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 6. 랭크업의 의미 (읽기) ──
  {
    day: 5,
    step: 6,
    route: "/rank-up",
    targetKey: "day5.meaning",
    targetSelector: "",
    title: "어제의 나보다 한 칸",
    body: "랭크업은 남보다 앞서라는 곳이 아니에요.\n어제의 나보다 한 칸 — 그게 진짜 랭크업이에요.\n오늘의 작은 한 번이 결국 위로 올라가요.",
    osamiMessage: "내 속도로, 한 칸씩이면 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "랭크업의 진행은 매일의 활동으로 자동 누적돼요.",
    completionText: "어제의 나보다 한 칸 — 그게 랭크업.",
    helperMessage: "잠깐 읽어보세요. 곧 다음으로 가요.",
    successMessage: "Day 5 마무리할게요.",
    completionRule: "manual_confirm",
    autoAdvance: true,
  },
  // ── 7. Day 5 완료 ──
  {
    day: 5,
    step: 7,
    route: "/rank-up",
    targetKey: "day5.complete",
    targetSelector: "",
    title: "Day 5 완료",
    body: "랭크업 — 내 위치와 앞으로 갈 길을 모두 봤어요.\n내일은 153다이어트를 만나요.",
    osamiMessage: "방향이 있는 사람은 흔들리지 않아요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 5 완료 화면입니다.",
    completionText: "내일 Day 6에서 153다이어트를 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 6 — 캐릭터 + 153마인드셋
// ─────────────────────────────────────────────────────────────

// 65-M: Day 6 — 153다이어트(/diet) 상세 안내 (24 step).
//   건강 프로그램인 만큼 9개 하위 메뉴 중 핵심 5개를 직접 클릭해
//   둘러보는 cascade. 회원이 "클릭하세요" 액션으로 사이를 오가며 학습.
//   65-E 로 다이어트 기능 전체 회원 ON.
const DAY_6_STEPS: TutorialCampStep[] = [
  // ── 0. 153다이어트 진입 (가운데 인트로) ──
  {
    day: 6,
    step: 0,
    route: "/diet",
    targetKey: "day6.intro",
    targetSelector: "",
    title: "오늘은 153다이어트예요",
    body: "건강을 위한 21일 습관 리셋 프로그램이에요.\n체중 숫자가 아니라 식사 리듬 · 출석 · 회복 습관에 집중해요.\n오늘은 9개 화면을 직접 한 번씩 눌러볼게요.",
    osamiMessage: "숫자가 아니라 습관을 바꿔요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "전체 메뉴 → 153다이어트에서 이 화면을 볼 수 있어요.",
    completionText: "153다이어트, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "좋아요. 화면을 둘러볼게요.",
    completionRule: "manual_confirm",
    autoNavigate: true,
  },
  // ── 1. 하위 메뉴 spotlight (개요) ──
  {
    day: 6,
    step: 1,
    route: "/diet",
    targetKey: "day6.subnav",
    targetSelector: '[data-tour="diet-subnav"]',
    title: "9가지 다이어트 화면",
    body: "위쪽 메뉴 줄에 9가지 화면이 모여 있어요.\n과학·원리 · 21일 식단 · 진행 현황 · 음식 가이드 · 습관 랭킹 등.\n지금부터 핵심 5가지를 직접 한 번씩 눌러볼게요.",
    osamiMessage: "여기서 다이어트 화면을 오가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "153다이어트 화면 위쪽에 하위 메뉴 줄이 있어요.",
    completionText: "여러 화면으로 이어지는 메뉴예요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "먼저 '과학·원리' 부터 눌러봐요.",
    completionRule: "quiz_question_read",
  },
  // ── 2. 과학·원리 탭 클릭 ──
  {
    day: 6,
    step: 2,
    route: "/diet",
    targetKey: "day6.click_value",
    targetSelector: '[data-tour="diet-nav-value"]',
    title: "👆 '과학·원리' 를 눌러보세요",
    body: "왜 우리가 다이어트가 어려운지 — 그 과학적 이유를 정리한 화면이에요.\n위쪽 메뉴의 🧠 과학·원리 를 눌러보세요.",
    osamiMessage: "근거가 있어야 흔들리지 않아요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🧠 '과학·원리' 를 눌러주세요.",
    completionText: "과학·원리 화면이 열렸어요.",
    helperMessage: "여기 '과학·원리' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 화면을 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 과학·원리 페이지 spotlight ──
  {
    day: 6,
    step: 3,
    route: "/diet/value",
    targetKey: "day6.page_value",
    targetSelector: '[data-tour="diet-page-value"]',
    title: "왜 153다이어트인가",
    body: "안 먹어도 찌는 몸을 안 찌는 체질로 — 이 변화의 과학적 근거가\n챕터별로 정리돼 있어요. 한 번 훑어보면 흔들릴 때 돌아올 수 있어요.",
    osamiMessage: "왜 하는지를 알면 멀리 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "과학·원리 화면이 열렸어요. 챕터별 근거를 잠깐 둘러보세요.",
    completionText: "근거가 있는 다이어트예요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 21일 식단이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 4. 21일 식단 탭 클릭 (홈으로 자동 복귀 후) ──
  {
    day: 6,
    step: 4,
    route: "/diet",
    targetKey: "day6.click_meal_plan",
    targetSelector: '[data-tour="diet-nav-meal-plan"]',
    title: "👆 '21일 식단' 을 눌러보세요",
    body: "21일 동안의 권장 식단이 정리돼 있어요.\n위쪽 메뉴의 🥗 21일 식단 을 눌러보세요.",
    osamiMessage: "오늘 뭐 먹지? 가 사라져요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🥗 '21일 식단' 을 눌러주세요.",
    completionText: "21일 식단 화면이 열렸어요.",
    helperMessage: "여기 '21일 식단' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 식단을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 5. 21일 식단 페이지 spotlight ──
  {
    day: 6,
    step: 5,
    route: "/diet/meal-plan",
    targetKey: "day6.page_meal_plan",
    targetSelector: '[data-tour="diet-page-meal-plan"]',
    title: "21일 권장 식단",
    body: "매일의 권장 식단과 영양 정보가 정리돼 있어요.\n그대로 따르지 않아도 돼요 — 큰 그림을 잡는 참고서예요.",
    osamiMessage: "참고만 해도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "21일 식단 화면이 열렸어요. 권장 식단을 잠깐 둘러보세요.",
    completionText: "오늘 뭐 먹을지 보였어요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 음식 가이드예요.",
    completionRule: "quiz_question_read",
  },
  // ── 6. 음식 가이드 탭 클릭 ──
  {
    day: 6,
    step: 6,
    route: "/diet",
    targetKey: "day6.click_food",
    targetSelector: '[data-tour="diet-nav-food"]',
    title: "👆 '음식 가이드' 를 눌러보세요",
    body: "음식별 기준 — 어떤 음식이 OK / 주의 / 피하기 인지 정리한 가이드예요.\n위쪽 메뉴의 🍽️ 음식 가이드 를 눌러보세요.",
    osamiMessage: "헷갈릴 땐 여기로 와요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🍽️ '음식 가이드' 를 눌러주세요.",
    completionText: "음식 가이드가 열렸어요.",
    helperMessage: "여기 '음식 가이드' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 가이드를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 7. 음식 가이드 페이지 spotlight ──
  {
    day: 6,
    step: 7,
    route: "/diet/food",
    targetKey: "day6.page_food",
    targetSelector: '[data-tour="diet-page-food"]',
    title: "음식별 OK / 주의 / 피하기",
    body: "외식·간식·음료까지 — 어떤 음식이 어떤 기준에 속하는지 카드별로 볼 수 있어요.\n장보기 전, 메뉴 고르기 전 잠깐 확인하면 좋아요.",
    osamiMessage: "기준이 있으면 선택이 쉬워요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "음식 가이드 화면이 열렸어요. 카드를 잠깐 둘러보세요.",
    completionText: "음식 기준을 알게 됐어요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 진행 현황이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 8. 진행 현황 탭 클릭 ──
  {
    day: 6,
    step: 8,
    route: "/diet",
    targetKey: "day6.click_progress",
    targetSelector: '[data-tour="diet-nav-progress"]',
    title: "👆 '진행 현황' 을 눌러보세요",
    body: "내 21일이 어떻게 흘러가고 있는지 한눈에 보는 화면이에요.\n위쪽 메뉴의 📈 진행 현황 을 눌러보세요.",
    osamiMessage: "내 흐름이 그래프로 보여요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 📈 '진행 현황' 을 눌러주세요.",
    completionText: "진행 현황이 열렸어요.",
    helperMessage: "여기 '진행 현황' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 내 그래프를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 9. 진행 현황 페이지 spotlight ──
  {
    day: 6,
    step: 9,
    route: "/diet/progress",
    targetKey: "day6.page_progress",
    targetSelector: '[data-tour="diet-page-progress"]',
    title: "내 21일 그래프",
    body: "Day 별 습관 점수 · 출석 · 연속 일수가 그래프와 카드로 정리돼요.\n며칠 쉬어도 다시 올라가는 내 모습을 한눈에 볼 수 있어요.",
    osamiMessage: "꾸준한 사람이 결국 위로 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "진행 현황 화면이 열렸어요. 그래프와 카드를 잠깐 살펴보세요.",
    completionText: "내 21일 흐름이 보여요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 습관 랭킹이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 10. 습관 랭킹 탭 클릭 ──
  {
    day: 6,
    step: 10,
    route: "/diet",
    targetKey: "day6.click_ranking",
    targetSelector: '[data-tour="diet-nav-ranking"]',
    title: "👆 '습관 랭킹' 을 눌러보세요",
    body: "같은 지점 회원들이 어떻게 습관을 채워가는지 볼 수 있는 자리예요.\n위쪽 메뉴의 🏆 습관 랭킹 을 눌러보세요.",
    osamiMessage: "혼자가 아니에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🏆 '습관 랭킹' 을 눌러주세요.",
    completionText: "습관 랭킹이 열렸어요.",
    helperMessage: "여기 '습관 랭킹' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 같이 가는 사람들을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 11. 습관 랭킹 페이지 spotlight ──
  {
    day: 6,
    step: 11,
    route: "/diet/ranking",
    targetKey: "day6.page_ranking",
    targetSelector: '[data-tour="diet-page-ranking"]',
    title: "지점 회원과 함께",
    body: "비교가 아니라 동행이에요.\n같은 지점 회원들이 매일 어떻게 채우는지 보면 나도 따라가게 돼요.",
    osamiMessage: "같이 가는 사람이 결국 멀리 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "습관 랭킹 화면이 열렸어요. 회원들의 흐름을 잠깐 보세요.",
    completionText: "함께 가는 자리예요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "이제 다이어트 홈으로 돌아갈게요.",
    completionRule: "quiz_question_read",
  },
  // ── 12. 다이어트 홈 복귀 (autoNavigate /diet) ──
  {
    day: 6,
    step: 12,
    route: "/diet",
    targetKey: "day6.back_to_hub",
    targetSelector: "",
    title: "다시 다이어트 홈",
    body: "9개 화면 중 핵심 5개를 모두 봤어요.\n이제 다이어트 홈으로 돌아와서 매일 만나는 카드들을 볼게요.",
    osamiMessage: "이제 매일 보는 자리로 돌아가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "다이어트 홈으로 자동으로 돌아갈게요.",
    completionText: "다이어트 홈으로 왔어요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "다음은 프로그램 중심 카드예요.",
    completionRule: "manual_confirm",
  },
  // ── 13. 프로그램 카드 spotlight (활성/온보딩 두 상태 모두) ──
  {
    day: 6,
    step: 13,
    route: "/diet",
    targetKey: "day6.program_card",
    targetSelector:
      '[data-tour="diet-hero"], [data-tour="diet-onboarding-cta"]',
    title: "21일 프로그램 카드",
    body: "이미 시작한 회원은 'Day N / 21' 진행 카드가,\n아직 시작 전이면 '21일 습관 리셋' 소개 카드가 보여요.\n오늘 어디쯤 와 있는지 / 어떻게 시작하는지가 여기 있어요.",
    osamiMessage: "프로그램의 중심 카드예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "153다이어트 화면 가운데에 프로그램 카드(Day N/21 또는 '21일 습관 리셋')가 있어요.",
    completionText: "오늘 위치 / 시작점이 여기 있어요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 습관 점수 카드예요.",
    completionRule: "quiz_question_read",
  },
  // ── 14. 습관 점수 카드 spotlight (활성 회원만 노출 — 온보딩은 fallback) ──
  {
    day: 6,
    step: 14,
    route: "/diet",
    targetKey: "day6.habit_score",
    targetSelector: '[data-tour="diet-habit-score"]',
    title: "오늘의 습관 점수",
    body: "단백질 우선 · 채소 자연식 · 가당 음료 피하기 · 야식 피하기 · 짐 출석 — \n5가지 습관 체크로 오늘 점수가 매겨져요.\n0~100점 사이로 한 줄에 보여요.",
    osamiMessage: "5가지 작은 습관이에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "프로그램을 시작하면 오늘의 습관 점수 카드가 나타나요.",
    completionText: "5가지 작은 습관 점수예요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 마일스톤이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 15. 마일스톤 spotlight ──
  {
    day: 6,
    step: 15,
    route: "/diet",
    targetKey: "day6.milestones",
    targetSelector: '[data-tour="diet-milestones"]',
    title: "7일 · 14일 · 21일 마일스톤",
    body: "21일은 한 번에 가는 길이 아니에요.\n7일 · 14일 · 21일마다 작은 배지와 보상이 와요.\n중간 목표가 있어서 덜 지쳐요.",
    osamiMessage: "한 번에 21일이 아니에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "프로그램을 시작하면 7/14/21일 마일스톤 카드가 나타나요.",
    completionText: "중간 목표가 있어요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 오늘 시작 위치예요.",
    completionRule: "quiz_question_read",
  },
  // ── 16. 오늘 시작 spotlight (활성/온보딩) ──
  {
    day: 6,
    step: 16,
    route: "/diet",
    targetKey: "day6.today_start",
    targetSelector:
      '[data-tour="diet-today-mission"], [data-tour="diet-onboarding-start"]',
    title: "오늘 시작은 여기서",
    body: "이미 시작한 회원은 '오늘의 미션' 카드가,\n아직 시작 전이면 '3분 온보딩 시작' 빨간 버튼이 보여요.\n오늘 다이어트의 첫걸음은 여기서 시작돼요.",
    osamiMessage: "오늘은 위치만 알아둬도 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText:
      "153다이어트 화면에 '오늘의 미션' 또는 '3분 온보딩 시작하기' 버튼이 있어요.",
    completionText: "오늘 시작 위치, 알게 됐어요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "이제 5가지 습관을 하나씩 볼게요.",
    completionRule: "quiz_question_read",
  },
  // 65-N: 17단계 이후 click cascade 추가 — 나머지 3개 sub-nav(자동 식단/
  //   내 사진/21일 이후)도 직접 클릭으로 둘러보게. 5가지 습관 5개 카드는
  //   1장으로 압축해 단조로움 줄임.
  // ── 17. 자동 식단 탭 클릭 ──
  {
    day: 6,
    step: 17,
    route: "/diet",
    targetKey: "day6.click_auto_meals",
    targetSelector: '[data-tour="diet-nav-auto-meals"]',
    title: "👆 '자동 식단' 을 눌러보세요",
    body: "오늘 뭐 먹지? 를 대신 정해주는 자동 식단이에요.\n위쪽 메뉴의 👨‍🍳 자동 식단 을 눌러보세요.",
    osamiMessage: "결정 피로를 덜어줘요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 👨‍🍳 '자동 식단' 을 눌러주세요.",
    completionText: "자동 식단이 열렸어요.",
    helperMessage: "여기 '자동 식단' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 자동 식단을 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 18. 자동 식단 페이지 spotlight ──
  {
    day: 6,
    step: 18,
    route: "/diet/auto-meals",
    targetKey: "day6.page_auto_meals",
    targetSelector: '[data-tour="diet-page-auto-meals"]',
    title: "자동으로 짜주는 식단",
    body: "조건만 알려주면 오늘 식단을 자동으로 추천해줘요.\n매일 메뉴 고민할 시간이 줄어 다이어트가 더 가벼워져요.",
    osamiMessage: "고민 시간이 줄어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "자동 식단 화면이 열렸어요. 어떤 추천이 가능한지 잠깐 둘러보세요.",
    completionText: "식단 고민이 줄어요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 내 사진이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 19. 내 사진 탭 클릭 ──
  {
    day: 6,
    step: 19,
    route: "/diet",
    targetKey: "day6.click_photos",
    targetSelector: '[data-tour="diet-nav-photos"]',
    title: "👆 '내 사진' 을 눌러보세요",
    body: "매일의 식단·체형 사진이 모이는 자리예요.\n21일 후 사진을 모아 보면 변화가 또렷이 보여요.\n위쪽 메뉴의 🖼️ 내 사진 을 눌러보세요.",
    osamiMessage: "기록은 거짓말을 안 해요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🖼️ '내 사진' 을 눌러주세요.",
    completionText: "내 사진이 열렸어요.",
    helperMessage: "여기 '내 사진' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 사진 갤러리를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 20. 내 사진 페이지 spotlight ──
  {
    day: 6,
    step: 20,
    route: "/diet/photos",
    targetKey: "day6.page_photos",
    targetSelector: '[data-tour="diet-page-photos"]',
    title: "내 사진 갤러리",
    body: "매일 남긴 식단 사진과 체형 사진이 한 자리에 모여요.\n21일 후 처음 사진과 마지막 사진을 비교하면\n눈에 안 보이던 변화가 또렷이 보여요.",
    osamiMessage: "사진이 거울보다 정직해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "내 사진 화면이 열렸어요. 사진 모음을 잠깐 둘러보세요.",
    completionText: "사진은 정직한 기록이에요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "다음은 21일 이후예요.",
    completionRule: "quiz_question_read",
  },
  // ── 21. 21일 이후 탭 클릭 ──
  {
    day: 6,
    step: 21,
    route: "/diet",
    targetKey: "day6.click_after_21",
    targetSelector: '[data-tour="diet-nav-after-21"]',
    title: "👆 '21일 이후' 를 눌러보세요",
    body: "21일이 끝났을 때 어떻게 이어갈지 미리 그려둔 안내예요.\n위쪽 메뉴의 🚩 21일 이후 를 눌러보세요.",
    osamiMessage: "끝이 아니라 출발선이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "위쪽 메뉴에서 🚩 '21일 이후' 를 눌러주세요.",
    completionText: "21일 이후가 열렸어요.",
    helperMessage: "여기 '21일 이후' 메뉴를 눌러보세요.",
    successMessage: "좋아요. 다음 단계를 미리 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 22. 21일 이후 페이지 spotlight ──
  {
    day: 6,
    step: 22,
    route: "/diet/after-21",
    targetKey: "day6.page_after_21",
    targetSelector: '[data-tour="diet-page-after-21"]',
    title: "21일이 끝났을 때",
    body: "유지 모드로 갈지, 더 강한 리셋으로 갈지 — 21일 후의 두 갈래 길이 정리돼 있어요.\n끝나기 전부터 미리 봐두면 끝나는 날 흔들리지 않아요.",
    osamiMessage: "이어가는 사람이 결국 멀리 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "21일 이후 화면이 열렸어요. 다음 단계 안내를 잠깐 보세요.",
    completionText: "끝이 아닌 출발이에요.",
    helperMessage: "잠깐 둘러보고 다음으로 가요.",
    successMessage: "이제 5가지 습관을 한 번에 정리해요.",
    completionRule: "quiz_question_read",
  },
  // ── 23. 5가지 습관 한 장 정리 (center — 압축) ──
  {
    day: 6,
    step: 23,
    route: "/diet",
    targetKey: "day6.five_habits",
    targetSelector: "",
    title: "매일 체크하는 5가지 습관",
    body: "체중 측정 대신, 매일 작은 5가지를 체크해요.\n🥩 단백질 먼저  ·  🥬 채소는 자연식으로  ·  🥤 가당 음료 피하기\n🌙 야식 피하기  ·  🥊 153복싱짐 출석.\n큰 결심 대신 작은 다섯 번이에요.",
    osamiMessage: "작은 다섯 번이 21일을 만들어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "다이어트는 5가지 습관 체크로 매일 채워가요.",
    completionText: "다섯 가지 작은 습관이에요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "마지막은 다이어트 마음가짐이에요.",
    completionRule: "manual_confirm",
  },
  // ── 24. 다이어트 마음가짐 (center — 가치) ──
  {
    day: 6,
    step: 24,
    route: "/diet",
    targetKey: "day6.mindset",
    targetSelector: "",
    title: "다시 시작해도 괜찮아요",
    body: "하루 망쳐도 괜찮아요. 다음 한 끼부터 다시 시작하면 돼요.\n완벽한 21일이 아니라, 다시 돌아오는 21일이 진짜예요.\n건강은 결심이 아니라, 다시 돌아오는 횟수로 만들어져요.",
    osamiMessage: "다시 시작하는 사람이 결국 바뀌어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "다이어트는 완벽함이 아니라 꾸준함으로 가는 프로그램이에요.",
    completionText: "다시 돌아오는 21일이 진짜예요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "Day 6 마무리할게요.",
    completionRule: "manual_confirm",
  },
  // ── 25. Day 6 완료 ──
  {
    day: 6,
    step: 25,
    route: "/diet",
    targetKey: "day6.complete",
    targetSelector: "",
    title: "Day 6 완료",
    body: "153다이어트의 8개 화면을 직접 한 번씩 눌러봤어요.\n매일 만나는 5가지 습관까지 — 건강은 매일의 작은 한 번이에요.\n내일은 마지막 날, 가이드를 만나요.",
    osamiMessage: "습관을 바꾸는 사람이 결국 멀리 가요.",
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

// 65-P: Day 7 상세화 (25 step) — 가이드(/guide) 6개 탭 직접 click cascade +
//   온보딩 재시청 안내 + 마이복서153 가치 전달 (7일 회고 + 5가지 약속) + 완료식.
//   Day 6 와 동일한 클릭 액션 중심 흐름.
const DAY_7_STEPS: TutorialCampStep[] = [
  // ── 0. 가이드 인트로 (center) ──
  {
    day: 7,
    step: 0,
    route: "/guide",
    targetKey: "day7.intro",
    targetSelector: "",
    title: "마지막 날, 가이드예요",
    body: "가이드는 마이복서153 전체를 더 깊이 이해하는 자료실이에요.\n6개 탭을 직접 한 번씩 눌러보며 어떤 내용이 있는지 둘러볼게요.",
    osamiMessage: "마지막 하루, 천천히 같이 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "전체 메뉴 → 가이드에서 이 화면을 볼 수 있어요.",
    completionText: "가이드, 같이 둘러봐요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "먼저 탭 줄을 볼게요.",
    completionRule: "manual_confirm",
    autoNavigate: true,
  },
  // ── 1. 탭 줄 overview spotlight ──
  {
    day: 7,
    step: 1,
    route: "/guide",
    targetKey: "day7.tab_switcher",
    targetSelector: '[data-tour="guide-tab-switcher"]',
    title: "6개의 가이드 탭",
    body: "프로그램 · 화이트 FAQ · 과학설계 · 가치맵 · 왜 하나요 · 안전.\n이 줄 안에 마이복서153 의 모든 설명이 들어 있어요.",
    osamiMessage: "여기가 자료실 입구예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "가이드 화면 위쪽에 6개 탭 줄이 있어요.",
    completionText: "6개 탭이 모인 자리예요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "먼저 '프로그램' 탭부터 눌러봐요.",
    completionRule: "quiz_question_read",
  },
  // ── 2. 프로그램 탭 클릭 ──
  {
    day: 7,
    step: 2,
    route: "/guide",
    targetKey: "day7.click_program",
    targetSelector: '[data-tour="guide-tab-program"]',
    title: "👆 '프로그램' 탭을 눌러보세요",
    body: "마이복서153 의 전체 구조와 4개 리그 요약이 정리된 탭이에요.\n위쪽 첫 번째 탭을 눌러보세요.",
    osamiMessage: "큰 그림부터 봐요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '📖 프로그램' 을 눌러주세요.",
    completionText: "프로그램 탭이 열렸어요.",
    helperMessage: "여기 '프로그램' 탭을 눌러보세요.",
    successMessage: "좋아요. 큰 그림 카드를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 3. 마이복서153 큰 그림 spotlight ──
  {
    day: 7,
    step: 3,
    route: "/guide",
    targetKey: "day7.program_card",
    targetSelector: '[data-tutorial-target="guide-first-card"]',
    title: "마이복서153 큰 그림",
    body: "1~40단계 · 4개 리그 (화이트 → 블루 → 레드 → 블랙).\n습관 → 기본기 → 실전 → 코칭 역량까지 한 줄로 이어진 성장 시스템이에요.",
    osamiMessage: "한 줄로 이어진 길이에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "프로그램 탭 첫 카드에 마이복서153 소개가 있어요.",
    completionText: "큰 그림을 알게 됐어요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 화이트 FAQ 예요.",
    completionRule: "quiz_question_read",
  },
  // ── 4. 화이트 FAQ 탭 클릭 ──
  {
    day: 7,
    step: 4,
    route: "/guide",
    targetKey: "day7.click_whitefaq",
    targetSelector: '[data-tour="guide-tab-whitefaq"]',
    title: "👆 '화이트 FAQ' 를 눌러보세요",
    body: "처음 시작하는 분들이 가장 많이 묻는 질문이 모인 탭이에요.\n탭을 한 번 눌러보세요.",
    osamiMessage: "처음 궁금한 건 거의 여기 있어요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '❓ 화이트 FAQ' 를 눌러주세요.",
    completionText: "화이트 FAQ 가 열렸어요.",
    helperMessage: "여기 '화이트 FAQ' 탭을 눌러보세요.",
    successMessage: "좋아요. 화면을 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 5. 화이트 FAQ 의미 (center) ──
  {
    day: 7,
    step: 5,
    route: "/guide",
    targetKey: "day7.whitefaq_meaning",
    targetSelector: "",
    title: "초보의 첫 질문들",
    body: "오늘 도전이 뭔지 · 코치 백업은 어떻게 되는지 · 1~40 전체 경로는 어떻게 흐르는지.\n시작할 때 헷갈리는 11가지 질문이 답과 함께 정리돼 있어요.",
    osamiMessage: "헷갈리면 여기로 와요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "화이트 FAQ 에 11가지 질문과 답이 있어요.",
    completionText: "초보의 첫 질문은 여기 있어요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "다음은 과학설계 탭이에요.",
    completionRule: "manual_confirm",
  },
  // ── 6. 과학설계 탭 클릭 ──
  {
    day: 7,
    step: 6,
    route: "/guide",
    targetKey: "day7.click_science",
    targetSelector: '[data-tour="guide-tab-science"]',
    title: "👆 '과학설계' 를 눌러보세요",
    body: "이 프로그램이 WHO · CDC · ACSM 권고를 어떻게 참고했는지 정리한 탭이에요.\n탭을 눌러보세요.",
    osamiMessage: "근거가 있는 운동이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '🧪 과학설계' 를 눌러주세요.",
    completionText: "과학설계가 열렸어요.",
    helperMessage: "여기 '과학설계' 탭을 눌러보세요.",
    successMessage: "좋아요. 근거를 잠깐 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 7. 과학설계 의미 (center) ──
  {
    day: 7,
    step: 7,
    route: "/guide",
    targetKey: "day7.science_meaning",
    targetSelector: "",
    title: "근거 있는 설계",
    body: "주간 활동량 (150~300분) · 근력 (주 2회+) · 강도 (RPE 3~7) · 점진적 증가 — \n국제 권고 4가지를 토대로 단계가 짜였어요.\n무리하지 않으면서 효과가 큰 균형점이에요.",
    osamiMessage: "막 짠 게 아니에요. 근거가 있어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "과학설계 탭에 4가지 권고 기준이 정리돼 있어요.",
    completionText: "근거 있는 설계예요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "다음은 가치맵 탭이에요.",
    completionRule: "manual_confirm",
  },
  // ── 8. 가치맵 탭 클릭 ──
  {
    day: 7,
    step: 8,
    route: "/guide",
    targetKey: "day7.click_valuemap",
    targetSelector: '[data-tour="guide-tab-valuemap"]',
    title: "👆 '가치맵' 을 눌러보세요",
    body: "각 단계를 마칠 때 무엇이 좋아지는지 리그별로 정리한 탭이에요.\n탭을 눌러보세요.",
    osamiMessage: "단계마다 얻는 게 분명히 있어요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '🗺️ 가치맵' 을 눌러주세요.",
    completionText: "가치맵이 열렸어요.",
    helperMessage: "여기 '가치맵' 탭을 눌러보세요.",
    successMessage: "좋아요. 단계별 가치를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 9. 가치맵 의미 (center) ──
  {
    day: 7,
    step: 9,
    route: "/guide",
    targetKey: "day7.valuemap_meaning",
    targetSelector: "",
    title: "단계마다 남기는 것",
    body: "숫자만 오르는 게 아니에요.\n각 단계가 끝나면 분명히 얻는 변화가 있어요 — 자세 · 체력 · 자신감 · 코칭 역량.\n랭크업 메뉴의 가치맵 탭과 이어져 있어요.",
    osamiMessage: "숫자보다 변화를 봐요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "가치맵 탭에 리그별 단계 가치가 정리돼 있어요.",
    completionText: "단계마다 분명한 가치가 있어요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "다음은 '왜 하나요' 탭이에요.",
    completionRule: "manual_confirm",
  },
  // ── 10. 왜 하나요 탭 클릭 ──
  {
    day: 7,
    step: 10,
    route: "/guide",
    targetKey: "day7.click_exercise",
    targetSelector: '[data-tour="guide-tab-exercise"]',
    title: "👆 '왜 하나요' 를 눌러보세요",
    body: "사다리 스텝 · 잽 · 스쿼트 같은 동작들이 왜 필요한지 — \n그 의미가 운동별로 정리된 탭이에요. 탭을 눌러보세요.",
    osamiMessage: "왜 하는지를 알면 흔들리지 않아요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '💪 왜 하나요' 를 눌러주세요.",
    completionText: "왜 하나요 탭이 열렸어요.",
    helperMessage: "여기 '왜 하나요' 탭을 눌러보세요.",
    successMessage: "좋아요. 동작의 의미를 볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 11. 왜 하나요 의미 (center) ──
  {
    day: 7,
    step: 11,
    route: "/guide",
    targetKey: "day7.exercise_meaning",
    targetSelector: "",
    title: "동작 하나하나의 이유",
    body: "오늘 한 사다리 스텝은 발놀림과 협응을 키워요.\n오늘 한 잽은 거리감과 정확도를 만들어요.\n매 동작이 길게 봤을 때 의미가 있어요.",
    osamiMessage: "오늘 한 번이 길게 남아요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "왜 하나요 탭에 동작별 의미가 카드로 정리돼 있어요.",
    completionText: "동작 하나하나의 이유가 있어요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "마지막 탭은 '안전' 이에요.",
    completionRule: "manual_confirm",
  },
  // ── 12. 안전 탭 클릭 ──
  {
    day: 7,
    step: 12,
    route: "/guide",
    targetKey: "day7.click_safety",
    targetSelector: '[data-tour="guide-tab-safety"]',
    title: "👆 '안전' 을 눌러보세요",
    body: "안전하게 시작하고 오래 운동하기 위한 가이드예요.\n마지막 탭을 눌러보세요.",
    osamiMessage: "다치지 않는 게 제일 빠른 길이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "탭 줄에서 '🛡️ 안전' 을 눌러주세요.",
    completionText: "안전 탭이 열렸어요.",
    helperMessage: "여기 '안전' 탭을 눌러보세요.",
    successMessage: "좋아요. 거의 다 왔어요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 13. 안전 의미 (center) ──
  {
    day: 7,
    step: 13,
    route: "/guide",
    targetKey: "day7.safety_meaning",
    targetSelector: "",
    title: "오래 가는 사람의 비밀",
    body: "워밍업 · 점진적 증가 · 충분한 회복 — 안전은 약함이 아니라 지혜예요.\n다치지 않는 사람이 결국 가장 멀리 가요.",
    osamiMessage: "오래 가는 게 진짜 잘 가는 거예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "안전 탭에 안전한 운동을 위한 가이드가 정리돼 있어요.",
    completionText: "안전이 곧 멀리 가는 길이에요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "이제 가이드의 의미를 정리해볼게요.",
    completionRule: "manual_confirm",
  },
  // 65-R: Day 7 후반부 재구성 — 가운데 카드 연속 단조로움 해결.
  //   BottomNav 5탭 회고 cascade 추가 (홈/훈련/단증혜택/랭킹/랭크업).
  //   마이복서153 약속 5가지는 한 카드로 압축. 회원이 7일간 둘러본
  //   페이지들을 직접 다시 한 번씩 클릭해 회상하는 마무리 흐름.
  // ── 14. 7일 회고 인트로 (center) ──
  {
    day: 7,
    step: 14,
    route: "/guide",
    targetKey: "day7.recap_intro",
    targetSelector: "",
    title: "함께 걸어온 7일을 다시 한 번",
    body: "마이복서153 의 핵심 메뉴들을 직접 다시 한 번 눌러보며 7일을 마무리할게요.\n홈 → 훈련 → 단증혜택 → 랭킹 → 랭크업, 다섯 자리를 가볍게 둘러봐요.",
    osamiMessage: "한 번씩 다시 인사하고 가요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "이제 하단 메뉴의 5개 탭을 차례로 한 번씩 눌러볼게요.",
    completionText: "한 자리씩 다시 가봐요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "첫 번째는 홈이에요.",
    completionRule: "manual_confirm",
  },
  // ── 15. 👆 홈 탭 클릭 (BottomNav) ──
  {
    day: 7,
    step: 15,
    route: "/guide",
    targetKey: "day7.nav_home",
    targetSelector: '[data-tour="bottomnav-home"]',
    title: "👆 하단 '홈' 을 눌러보세요",
    body: "매일 처음 만나는 자리예요.\n하단 메뉴 가장 왼쪽 🏠 홈 을 눌러보세요.",
    osamiMessage: "매일 돌아오는 자리예요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "하단 메뉴에서 '홈' 을 눌러주세요.",
    completionText: "홈 화면이 열렸어요.",
    helperMessage: "여기 '홈' 탭을 눌러보세요.",
    successMessage: "좋아요. 홈을 잠깐 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 16. 홈 spotlight ──
  {
    day: 7,
    step: 16,
    route: "/home",
    targetKey: "day7.home_spotlight",
    targetSelector: '[data-tour="home-today-focus"]',
    title: "홈 — 매일의 출발점",
    body: "오늘의 포커스, 오삼 코치 한마디, 짧은 추천이 한 자리에 있어요.\n하루 한 번 들어오면 오늘 할 일이 보여요.",
    osamiMessage: "여기서 하루가 시작돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "홈 화면에서 오늘의 포커스 카드를 확인할 수 있어요.",
    completionText: "홈은 매일의 출발점이에요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 훈련이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 17. 👆 훈련 탭 클릭 ──
  {
    day: 7,
    step: 17,
    route: "/home",
    targetKey: "day7.nav_missions",
    targetSelector: '[data-tour="bottomnav-missions"]',
    title: "👆 하단 '훈련' 을 눌러보세요",
    body: "Day 2 에 둘러본 마이복서153의 심장이에요.\n하단 메뉴의 🥊 훈련 을 눌러보세요.",
    osamiMessage: "여기가 핵심이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "하단 메뉴에서 '훈련' 을 눌러주세요.",
    completionText: "훈련 화면이 열렸어요.",
    helperMessage: "여기 '훈련' 탭을 눌러보세요.",
    successMessage: "좋아요. 훈련을 잠깐 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 18. 훈련 spotlight ──
  {
    day: 7,
    step: 18,
    route: "/missions",
    targetKey: "day7.missions_spotlight",
    targetSelector: '[data-tour="missions-official-training"]',
    title: "훈련 — 마이복서153의 심장",
    body: "리그와 단계, 영상과 체크리스트 — 매일의 운동이 흐르는 자리예요.\n공식 1~40 단계가 모두 여기에 있어요.",
    osamiMessage: "오늘도 한 단계, 천천히.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "훈련 화면에 1~40 단계가 모두 있어요.",
    completionText: "훈련은 매일의 한 단계예요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 단증혜택이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 19. 👆 단증혜택 탭 클릭 ──
  {
    day: 7,
    step: 19,
    route: "/missions",
    targetKey: "day7.nav_cert",
    targetSelector: '[data-tour="bottomnav-cert-benefits"]',
    title: "👆 하단 '단증혜택' 을 눌러보세요",
    body: "Day 3 에 봤던 단증혜택 화면이에요.\n하단 메뉴의 🏅 단증혜택 을 눌러보세요.",
    osamiMessage: "단증이 열어주는 미래.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "하단 메뉴에서 '단증혜택' 을 눌러주세요.",
    completionText: "단증혜택이 열렸어요.",
    helperMessage: "여기 '단증혜택' 탭을 눌러보세요.",
    successMessage: "좋아요. 단증혜택을 잠깐 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 20. 단증혜택 spotlight ──
  {
    day: 7,
    step: 20,
    route: "/cert-benefits",
    targetKey: "day7.cert_spotlight",
    targetSelector: '[data-tour="cert-benefits-page"]',
    title: "단증 — 길의 끝, 길의 시작",
    body: "각 리그 마스터에 닿으면 그 단수의 단증에 도전할 수 있어요.\n오늘의 한 단계가, 결국 종이 한 장이 아니라 길로 이어져요.",
    osamiMessage: "오늘이 단증으로 이어져요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "단증혜택 화면에 단증 로드맵이 정리돼 있어요.",
    completionText: "오늘이 단증으로 이어져요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "다음은 랭킹이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 21. 👆 랭킹 탭 클릭 ──
  {
    day: 7,
    step: 21,
    route: "/cert-benefits",
    targetKey: "day7.nav_ranking",
    targetSelector: '[data-tour="bottomnav-halloffame"]',
    title: "👆 하단 '랭킹' 을 눌러보세요",
    body: "같이 가는 사람들의 자리예요.\n하단 메뉴의 🏆 랭킹 을 눌러보세요.",
    osamiMessage: "비교가 아니라 동행이에요.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "하단 메뉴에서 '랭킹' 을 눌러주세요.",
    completionText: "랭킹 화면이 열렸어요.",
    helperMessage: "여기 '랭킹' 탭을 눌러보세요.",
    successMessage: "좋아요. 랭킹을 잠깐 둘러볼게요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 22. 랭킹 spotlight ──
  {
    day: 7,
    step: 22,
    route: "/halloffame",
    targetKey: "day7.ranking_spotlight",
    targetSelector: '[data-tour="halloffame-leaderboard"]',
    title: "랭킹 — 함께 가는 사람들",
    body: "옆 사람 속도가 아니라 같이 가는 흐름을 보는 곳이에요.\n언젠가 당신의 이름도 여기에 새겨질 거예요.",
    osamiMessage: "혼자가 아니에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "랭킹 화면에서 명예의 전당을 볼 수 있어요.",
    completionText: "혼자가 아니에요.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "마지막 회고 — 랭크업이에요.",
    completionRule: "quiz_question_read",
  },
  // ── 23. 👆 랭크업 탭 클릭 ──
  {
    day: 7,
    step: 23,
    route: "/halloffame",
    targetKey: "day7.nav_rankup",
    targetSelector: '[data-tour="bottomnav-rank-up"]',
    title: "👆 하단 '랭크업' 을 눌러보세요",
    body: "Day 5 에 봤던 40단계 로드맵이에요.\n하단 메뉴 가장 오른쪽 📈 랭크업 을 눌러보세요.",
    osamiMessage: "내 위치와 갈 길이 한눈에.",
    actionType: "click",
    requireTargetClick: true,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "하단 메뉴에서 '랭크업' 을 눌러주세요.",
    completionText: "랭크업 화면이 열렸어요.",
    helperMessage: "여기 '랭크업' 탭을 눌러보세요.",
    successMessage: "좋아요. 마지막 회고예요.",
    blockNextUntilComplete: true,
    completionRule: "target_clicked",
    autoAdvance: true,
  },
  // ── 24. 랭크업 spotlight ──
  {
    day: 7,
    step: 24,
    route: "/rank-up",
    targetKey: "day7.rankup_spotlight",
    targetSelector: '[data-tour="rankup-progress"]',
    title: "랭크업 — 내 위치와 갈 길",
    body: "지금 어디쯤이고, 앞으로 어디로 가는지 — 길이 한눈에 보여요.\n어제의 나보다 한 칸 — 그게 진짜 랭크업이에요.",
    osamiMessage: "내 속도로 한 칸씩.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "랭크업 화면에 현재 진행 카드와 40단계 로드맵이 있어요.",
    completionText: "내 속도로, 한 칸씩.",
    helperMessage: "잠깐 보고 다음으로 가요.",
    successMessage: "이제 마이복서153 의 약속을 정리해요.",
    completionRule: "quiz_question_read",
  },
  // ── 25. 마이복서153 약속 5가지 (center 압축) ──
  {
    day: 7,
    step: 25,
    route: "/guide",
    targetKey: "day7.promises",
    targetSelector: "",
    title: "마이복서153 의 다섯 가지 약속",
    body: "① 자기 페이스로 — 옆이 아니라 어제의 나와.\n② 비교가 아니라 동행 — 보낸 응원이 돌아와요.\n③ 다시 돌아오는 횟수 — 완벽함보다 꾸준함.\n④ 작은 한 번이 결국 당신 — 오늘 한 번이면 충분.\n⑤ 나를 다시 좋아하는 시간 — 복싱은 그 시간이에요.",
    osamiMessage: "이 다섯 가지를 잊지 말아요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "마이복서153 의 5가지 핵심 약속이에요.",
    completionText: "다섯 약속 — 마음에 새겨요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "다음은 153복싱짐의 인사예요.",
    completionRule: "manual_confirm",
    autoNavigate: true,
  },
  // ── 26. 153복싱짐의 인사 (center) ──
  {
    day: 7,
    step: 26,
    route: "/guide",
    targetKey: "day7.gym_message",
    targetSelector: "",
    title: "153복싱짐의 한마디",
    body: "와줘서 고맙습니다.\n오늘 처음 온 사람도, 오래 다닌 사람도 — 153복싱짐의 모든 자리는 같은 마음으로 열려 있어요.\n오늘도, 내일도, 그 다음 날도 다시 만나요.",
    osamiMessage: "153복싱짐은 늘 같은 자리에 있을게요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "153복싱짐이 당신을 기다리고 있어요.",
    completionText: "같은 자리에서 다시 만나요.",
    helperMessage: "잠깐 읽어보세요.",
    successMessage: "7일 완료식이에요.",
    completionRule: "manual_confirm",
  },
  // ── 27. 7일 완료식 (celebration) ──
  {
    day: 7,
    step: 27,
    route: "/guide",
    targetKey: "day7.celebration",
    targetSelector: "",
    title: "🎉 7일 완료식",
    body: "7일 동안 정말 잘 와주셨어요.\n153챌린지 · 훈련 · 단증 · 마인드셋 · 랭크업 · 다이어트 · 가이드까지\n마이복서153 의 모든 자리를 둘러봤어요.\n오늘부터는 '복싱인이 되어가는 사람' 이에요.",
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
  // ── 28. 앞으로의 사용법 (complete) ──
  {
    day: 7,
    step: 28,
    route: "/guide",
    targetKey: "day7.next_steps",
    targetSelector: "",
    title: "앞으로의 사용법",
    body: "오늘부터는 정해진 길이 아니라,\n자기 페이스로 153복싱짐의 하루를 시작하세요.\n오삼이는 매일 짧게 곁에 있을게요.\n오늘도, 내일도 — 다시 만나요.",
    osamiMessage: "오늘도 와줘서 고마워요.",
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
// 65-F: 새 커리큘럼은 모든 step 이 실제 존재하는 anchor 를 직접 사용 —
//   remap 불필요. 향후 anchor 없는 selector 보정이 필요하면 여기에 추가.
const SELECTOR_REMAP: Record<string, { selector: string; route: string }> = {};

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

  // 65-G: 모든 step 을 자기 route 로 self-heal — autoNavigate 강제 ON.
  //   회원이 어떤 이유로든 (로그인 직후 /home 등) 엉뚱한 페이지에 있어도
  //   현재 step 이 올바른 페이지로 데려간다. 같은 route 면 no-op.
  let base: TutorialCampStep = { ...step, autoNavigate: true };

  // 65-G/I: 읽기 류 step (manual_confirm + quiz_question_read) 는 autoAdvance
  //   강제 OFF — 회원이 충분히 보고 직접 '다음으로' 누르도록.
  //   · manual_confirm: conditionMet 즉시 true 라 autoAdvance 가 250ms 만에
  //     카드를 넘겨버려 읽을 시간이 없음.
  //   · quiz_question_read: 읽기 타이머 자동 진행은 더 보고 싶은 회원에게
  //     답답할 수 있음 — 회원 페이스 우선.
  //   target_clicked(탭/카드 클릭 후 250ms cascade) 와 scrolled_to_bottom
  //   (스크롤 완료 후 cascade) 의 autoAdvance 는 유지 — 액션 직후 자연스러운 진행.
  if (
    base.completionRule === "manual_confirm" ||
    base.completionRule === "quiz_question_read"
  ) {
    base = { ...base, autoAdvance: false };
  }

  // 65-H: quiz_question_read 는 spotlight + 읽기 타이머 자동 advance step.
  //   클릭 강제하면 spotlight 한 버튼(예: '수업 시작')을 실제로 누르게 되어
  //   페이지 상태가 바뀌고(SessionRunner 진입 등) 다음 step 의 target 이
  //   사라지는 사고가 난다. quiz_question_read 는 클릭 강제에서 제외.
  // 직접 클릭 강제 — Day 완료 모달 + quiz_question_read 제외 모든 target 있는 step
  const shouldForceClick =
    selector !== "" &&
    step.actionType !== "complete" &&
    step.completionRule !== "quiz_question_read";

  if (shouldForceClick) {
    return {
      ...base,
      targetSelector: selector,
      route,
      actionType: "click",
      requireTargetClick: true,
      allowNextWithoutClick: false,
    };
  }
  return base;
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
