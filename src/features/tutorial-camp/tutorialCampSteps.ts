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
  | "complete";

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
}

// ─────────────────────────────────────────────────────────────
// Day 1 — 홈 / 오늘의 라운드 / 오삼이 소개
// ─────────────────────────────────────────────────────────────

const DAY_1_STEPS: TutorialCampStep[] = [
  {
    day: 1,
    step: 0,
    route: "/home",
    targetKey: "day1.osami_greeting",
    targetSelector: '[data-tour="home-osami-briefing"]',
    title: "오삼이의 첫 인사",
    body: "오삼이가 매일 짧은 메시지를 드려요.\n잠깐만 봐주세요.",
    osamiMessage: "안녕하세요. 오늘도 잘 오셨어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText:
      "홈 화면 위쪽의 오삼이 카드에서 매일 새로운 메시지를 받을 수 있어요.",
    completionText: "잘했어요. 다음으로 가요.",
  },
  {
    day: 1,
    step: 1,
    route: "/home",
    targetKey: "day1.today_round",
    targetSelector: '[data-tour="home-today-round"]',
    title: "오늘의 라운드",
    body: "오늘 한 번만 해도 충분해요.\n이 카드가 오늘의 한 라운드를 알려줘요.",
    osamiMessage: "오늘은 무엇을 할지, 같이 봐요.",
    actionType: "click",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "홈 화면 가운데에 오늘의 라운드 카드가 있어요.",
    completionText: "오늘의 한 라운드, 기억해두세요.",
  },
  {
    day: 1,
    step: 2,
    route: "/home",
    targetKey: "day1.official_training_card",
    targetSelector: '[data-tour="home-official-training"]',
    title: "공식 훈련",
    body: "공식 훈련은 마스터로드를 따라\n단계별로 진행되는 정식 훈련 코스예요.",
    osamiMessage: "이건 매일 한 단계씩 쌓는 길이에요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "홈에서 공식 훈련 카드를 찾을 수 있어요. 보이지 않으면 훈련 메뉴로 들어가도 돼요.",
    completionText: "공식 훈련은 천천히 쌓는 것이에요.",
  },
  {
    day: 1,
    step: 3,
    route: "/home",
    targetKey: "day1.quest_recommend",
    targetSelector: '[data-tour="home-quest-recommendation"]',
    title: "오늘의 153 QUEST",
    body: "공식 훈련과 별도로,\n짧고 가벼운 153 QUEST가 매일 추천돼요.",
    osamiMessage: "부담 없이 한 번만 눌러보세요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "홈 화면을 내리면 153 QUEST 추천 카드가 보여요.",
    completionText: "QUEST는 그날의 작은 한 걸음이에요.",
  },
  {
    day: 1,
    step: 4,
    route: "/home",
    targetKey: "day1.complete",
    targetSelector: "",
    title: "Day 1 완료",
    body: "첫 날 잘하셨어요.\n내일 Day 2에서 다시 만나요.",
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
  {
    day: 2,
    step: 0,
    route: "/missions",
    targetKey: "day2.training_screen",
    targetSelector: '[data-tour="missions-official-training"]',
    title: "훈련 화면",
    body: "여기가 마이복서153의 훈련 메인 화면이에요.\n오늘 진행할 단계가 위쪽에 있어요.",
    osamiMessage: "이 화면이 매일 오는 자리예요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "하단 메뉴의 훈련 아이콘으로 들어올 수 있어요.",
    completionText: "훈련 화면은 매일의 출발점이에요.",
  },
  {
    day: 2,
    step: 1,
    route: "/master-track",
    targetKey: "day2.master_track",
    targetSelector: '[data-tour="missions-master-road"]',
    title: "마스터로드",
    body: "마스터로드는 1단부터 차례로 올라가는\n정식 훈련의 길이에요.\n한 번에 한 단씩, 천천히 쌓아갑니다.",
    osamiMessage: "처음엔 어려워 보여도, 단계별이라 부담 없어요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText:
      "훈련 화면 안에서 마스터로드 카드를 누르면 들어올 수 있어요.",
    completionText: "마스터로드는 나의 길이에요.",
  },
  {
    day: 2,
    step: 2,
    route: "/missions",
    targetKey: "day2.mission_submit",
    targetSelector: '[data-tour="missions-submit-note"]',
    title: "공식 미션 제출",
    body: "각 단계의 미션은 시범 영상을 보고\n자신의 훈련 영상을 올리는 방식이에요.",
    osamiMessage: "처음엔 천천히, 자세를 먼저 봐주세요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText:
      "마스터로드 안의 단계 카드를 누르면 미션 제출 화면이 열려요.",
    completionText: "제출은 부담 없이, 자세 위주로 시작해요.",
  },
  {
    day: 2,
    step: 3,
    route: "/missions",
    targetKey: "day2.coach_approval",
    targetSelector: '[data-tour="missions-coach-approval-note"]',
    title: "코치 승인",
    body: "제출한 영상은 153복싱짐 코치가\n직접 보고 승인 또는 피드백을 드려요.",
    osamiMessage: "혼자 하는 게 아니에요. 같이 봐드려요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "제출 후 알림으로 코치의 승인 결과가 전해져요.",
    completionText: "153복싱짐의 모든 단계는 코치가 같이 봐드려요.",
  },
  {
    day: 2,
    step: 4,
    route: "/home",
    targetKey: "day2.complete",
    targetSelector: "",
    title: "Day 2 완료",
    body: "공식 훈련의 큰 그림이 보이셨다면 충분해요.",
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
// Day 3 — 153 QUEST / 복싱 IQ
// ─────────────────────────────────────────────────────────────

const DAY_3_STEPS: TutorialCampStep[] = [
  {
    day: 3,
    step: 0,
    route: "/home",
    targetKey: "day3.quest_intro",
    targetSelector: '[data-tour="home-quest-recommendation"]',
    title: "153 QUEST",
    body: "153 QUEST는 매일 짧게 즐기는\n복싱 한 줄과 작은 행동이에요.",
    osamiMessage: "공부보다 가벼워요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "홈 화면에서 QUEST 카드를 누르면 들어올 수 있어요.",
    completionText: "오늘의 QUEST 한 줄, 챙겼어요.",
  },
  {
    day: 3,
    step: 1,
    route: "/home",
    targetKey: "day3.boxing_iq",
    targetSelector: '[data-tour="boxing-iq-card"]',
    title: "복싱 IQ",
    body: "복싱 IQ는 자세, 거리, 호흡, 회복 같은\n복싱의 작은 원리를 묻는 짧은 퀴즈예요.",
    osamiMessage: "정답이 아니어도 괜찮아요.",
    actionType: "click",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "홈 화면을 내리면 복싱 IQ 카드가 보여요.",
    completionText: "복싱 IQ는 알수록 자세가 자연스러워져요.",
  },
  {
    day: 3,
    step: 2,
    route: "/home",
    targetKey: "day3.feedback",
    targetSelector: "",
    title: "정답과 오답",
    body: "정답이면 짧은 격려를,\n오답이면 부드러운 설명이 따라와요.",
    osamiMessage: "틀려야 배우는 거예요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "복싱 IQ 퀴즈를 한 번 풀어보면 바로 보여요.",
    completionText: "오답은 다음의 단서예요.",
  },
  {
    day: 3,
    step: 3,
    route: "/home",
    targetKey: "day3.quest_xp",
    targetSelector: "",
    title: "QUEST XP와 파이트 머니",
    body: "QUEST 한 번에 작은 QUEST XP가 쌓이고,\n특정 행동에는 파이트 머니가 함께 와요.\n둘 다 부담 없이 모이는 작은 보상이에요.",
    osamiMessage: "큰 욕심 없이, 매일 한 번이면 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "QUEST를 한 번 진행하면 자동으로 작은 보상이 누적돼요.",
    completionText: "보상은 결과가 아니라, 따라오는 거예요.",
  },
  {
    day: 3,
    step: 4,
    route: "/home",
    targetKey: "day3.complete",
    targetSelector: "",
    title: "Day 3 완료",
    body: "공부보다 가볍게,\n오늘도 한 줄을 챙기셨어요.",
    osamiMessage: "오늘도 잘하셨어요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 3 완료 화면입니다.",
    completionText: "내일 Day 4에서는 챌린지를 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 4 — 챌린지 / 안전 체크
// ─────────────────────────────────────────────────────────────

const DAY_4_STEPS: TutorialCampStep[] = [
  {
    day: 4,
    step: 0,
    route: "/challenges",
    targetKey: "day4.challenge_card",
    targetSelector: '[data-tour="challenge-arena-card"]',
    title: "챌린지",
    body: "챌린지는 정해진 자세나 행동을\n오늘 한 번만 해보는 작은 도전이에요.",
    osamiMessage: "한 번만 해보면 돼요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "전체 메뉴 또는 홈 카드에서 챌린지로 들어올 수 있어요.",
    completionText: "오늘의 한 번이 내일을 만들어요.",
  },
  {
    day: 4,
    step: 1,
    route: "/challenges",
    targetKey: "day4.difficulty",
    targetSelector: '[data-tour="challenge-difficulty"]',
    title: "난이도 선택",
    body: "오늘 컨디션에 맞춰 난이도를 직접 고르세요.\n무리하지 않는 쪽이 옳아요.",
    osamiMessage: "오늘은 쉬운 쪽이 정답일 수도 있어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "챌린지 카드 안에서 난이도를 선택할 수 있어요.",
    completionText: "내 컨디션이 기준이에요.",
  },
  {
    day: 4,
    step: 2,
    route: "/challenges",
    targetKey: "day4.pain_check",
    targetSelector: '[data-tour="challenge-safety-check"]',
    title: "통증 체크",
    body: "시작 전에 통증이 없는지 한 번 확인해요.\n조금이라도 불편하면 오늘은 쉬는 게 맞아요.",
    osamiMessage: "몸이 먼저예요.",
    actionType: "click",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "챌린지 시작 전에 통증 체크 항목이 나와요.",
    completionText: "내 몸이 가장 정확해요.",
  },
  {
    day: 4,
    step: 3,
    route: "/challenges",
    targetKey: "day4.submit",
    targetSelector: '[data-tour="challenge-submit"]',
    title: "제출",
    body: "다 했으면 제출 버튼을 누르면 끝이에요.",
    osamiMessage: "오늘 챌린지, 잘하셨어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "챌린지 화면 아래에 제출 버튼이 있어요.",
    completionText: "오늘의 한 번이 끝났어요.",
  },
  {
    day: 4,
    step: 4,
    route: "/home",
    targetKey: "day4.complete",
    targetSelector: "",
    title: "Day 4 완료",
    body: "안전하게 한 번만 했어도 충분해요.",
    osamiMessage: "다치지 않은 오늘이 가장 좋은 오늘이에요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 4 완료 화면입니다.",
    completionText: "내일 Day 5에서는 챔피언 일기를 써요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 5 — 챔피언 일기
// ─────────────────────────────────────────────────────────────

const DAY_5_STEPS: TutorialCampStep[] = [
  {
    day: 5,
    step: 0,
    route: "/home",
    targetKey: "day5.journal_card",
    targetSelector: '[data-tour="champion-journal-card"]',
    title: "챔피언 일기",
    body: "하루에 한 줄씩 남기는 작은 일기예요.\n나만 볼 수 있어요.",
    osamiMessage: "한 줄이면 돼요.",
    actionType: "click",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "홈 화면에서 챔피언 일기 카드를 찾을 수 있어요.",
    completionText: "오늘의 한 줄, 잘 적어두세요.",
  },
  {
    day: 5,
    step: 1,
    route: "/home",
    targetKey: "day5.daily_question",
    targetSelector: '[data-tour="journal-question"]',
    title: "오늘의 질문",
    body: "매일 작은 질문이 하나 떠올라요.\n그 질문에 한 문장이면 충분해요.",
    osamiMessage: "큰 답이 아니어도 괜찮아요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "일기 화면 위쪽에 오늘의 질문이 있어요.",
    completionText: "질문은 매일 작게 바뀌어요.",
  },
  {
    day: 5,
    step: 2,
    route: "/home",
    targetKey: "day5.save_journal",
    targetSelector: '[data-tour="journal-save"]',
    title: "기록 저장",
    body: "다 적었으면 저장을 누르면 끝이에요.\n한 문장이어도 충분합니다.",
    osamiMessage: "쉼표 하나면 돼요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "top",
    fallbackText: "일기 작성 화면 하단에 저장 버튼이 있어요.",
    completionText: "오늘의 한 문장, 저장했어요.",
  },
  {
    day: 5,
    step: 3,
    route: "/mypage",
    targetKey: "day5.growth_record",
    targetSelector: '[data-tour="growth-report-card"]',
    title: "성장 기록으로 쌓이는 방식",
    body: "매일의 한 줄이 모이면\n나의 성장 리포트가 돼요.\n나중에 돌아보면 큰 힘이 됩니다.",
    osamiMessage: "지금은 보이지 않아도, 한 달 뒤엔 보여요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "마이페이지 안에서 성장 리포트를 볼 수 있어요.",
    completionText: "한 줄이 한 달이 되면 길이 보여요.",
  },
  {
    day: 5,
    step: 4,
    route: "/home",
    targetKey: "day5.complete",
    targetSelector: "",
    title: "Day 5 완료",
    body: "오늘의 한 문장을 남기셨다면,\n오늘의 캠프는 끝이에요.",
    osamiMessage: "기록은 큰 사람의 작은 습관이에요.",
    actionType: "complete",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "confetti",
    placement: "center",
    fallbackText: "Day 5 완료 화면입니다.",
    completionText: "내일 Day 6에서 동료를 만나요.",
  },
];

// ─────────────────────────────────────────────────────────────
// Day 6 — 세컨드 응원 / 동료
// ─────────────────────────────────────────────────────────────

const DAY_6_STEPS: TutorialCampStep[] = [
  {
    day: 6,
    step: 0,
    route: "/home",
    targetKey: "day6.second_cheer",
    targetSelector: '[data-tour="second-cheer-card"]',
    title: "세컨드 응원",
    body: "혼자 하는 운동이지만,\n같이 하는 사람이 있어요.\n세컨드 응원으로 동료에게 한 마디 보낼 수 있어요.",
    osamiMessage: "응원은 받는 사람만큼 보내는 사람도 따뜻해져요.",
    actionType: "click",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "홈에서 세컨드 응원 카드를 찾을 수 있어요.",
    completionText: "혼자가 아니에요.",
  },
  {
    day: 6,
    step: 1,
    route: "/home",
    targetKey: "day6.partner_pick",
    targetSelector: '[data-tour="second-cheer-list"]',
    title: "동료 선택",
    body: "오늘 응원할 동료를 한 명 골라보세요.\n오늘 운동한 사람이 추천돼요.",
    osamiMessage: "한 사람이면 충분해요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "bottom",
    fallbackText: "세컨드 응원 카드를 누르면 동료 목록이 보여요.",
    completionText: "오늘의 한 사람, 마음에 두셨어요.",
  },
  {
    day: 6,
    step: 2,
    route: "/home",
    targetKey: "day6.sticker",
    targetSelector: '[data-tour="cheer-sticker"]',
    title: "응원 스티커",
    body: "글이 어색하면\n스티커 한 장으로도 충분해요.",
    osamiMessage: "스티커가 더 진심일 때도 있어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "pulse",
    placement: "top",
    fallbackText: "응원 화면에서 스티커 모음이 나와요.",
    completionText: "한 장, 보내봤어요.",
  },
  {
    day: 6,
    step: 3,
    route: "/home",
    targetKey: "day6.rp",
    targetSelector: "",
    title: "RP",
    body: "응원을 보내고 받으면\n작은 RP(응원 포인트)가 쌓여요.\n동료들과 함께 만든 점수예요.",
    osamiMessage: "RP는 혼자선 만들 수 없어요.",
    actionType: "read",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "center",
    fallbackText: "응원을 한 번 보내거나 받으면 RP가 자동으로 누적돼요.",
    completionText: "함께 쌓는 점수가 진짜 점수예요.",
  },
  {
    day: 6,
    step: 4,
    route: "/home",
    targetKey: "day6.complete",
    targetSelector: "",
    title: "Day 6 완료",
    body: "오늘의 응원 한 번,\n세상에 한 사람을 더 따뜻하게 했어요.",
    osamiMessage: "보낸 마음이 결국 돌아와요.",
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
    osamiMessage: "오늘은 여기서 시작해요.",
    actionType: "navigate",
    requireTargetClick: false,
    allowNextWithoutClick: true,
    animation: "spotlight",
    placement: "bottom",
    fallbackText: "전체 메뉴에서 내정보로 들어오면 마이페이지예요.",
    completionText: "그동안의 시간이 여기 있어요.",
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
// 합본 + 헬퍼
// ─────────────────────────────────────────────────────────────

/** 모든 day 의 step 을 펼쳐 둔 평면 배열 (35개) */
export const TUTORIAL_CAMP_STEPS: TutorialCampStep[] = [
  ...DAY_1_STEPS,
  ...DAY_2_STEPS,
  ...DAY_3_STEPS,
  ...DAY_4_STEPS,
  ...DAY_5_STEPS,
  ...DAY_6_STEPS,
  ...DAY_7_STEPS,
];

/** 특정 day 의 step 배열 — step 인덱스 순 */
export function getStepsByDay(day: number): TutorialCampStep[] {
  return TUTORIAL_CAMP_STEPS.filter((s) => s.day === day);
}

/** 특정 day × step 의 단일 step. 없으면 null. */
export function getStep(day: number, step: number): TutorialCampStep | null {
  return (
    TUTORIAL_CAMP_STEPS.find((s) => s.day === day && s.step === step) ?? null
  );
}

/** day 의 step 수 */
export function getStepsCountByDay(day: number): number {
  return TUTORIAL_CAMP_STEPS.filter((s) => s.day === day).length;
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
