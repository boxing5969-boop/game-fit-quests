/**
 * 153 스토리 RPG 정적 카피 (단계 35).
 *
 * 모든 카피는 마이복서153 자체 세계관. 환세취호전 / 실존 선수 / 영화 / 만화 / 명언 사용 금지.
 * 오삼이 fallback 대사는 dialogue 테이블이 비어 있을 때 graceful 표시용.
 */

export const STORY_RPG_MENU_LABEL = "153 스토리 RPG";
export const STORY_RPG_PAGE_TITLE = "복서의 길";
export const STORY_RPG_PAGE_SUBTITLE =
  "회원에서 지도자, 프로복서, 챔피언까지 이어지는 나만의 복싱 RPG";

export const STORY_RPG_PROTECTION_NOTICE =
  "공식 훈련은 마스터로드에서 그대로 진행됩니다. 153 스토리 RPG는 QUEST 보조 게임 모드입니다.";

export const STORY_RPG_INTRO_FALLBACK =
  "오늘도 링이 열렸습니다. 처음부터 강한 복서는 없습니다. 하지만 오늘의 라운드를 피하지 않는 사람은 이미 복서의 길 위에 있습니다.";

export const STORY_ROUTE_NOT_SELECTED = "아직 선택하지 않음";
export const STORY_ROUTE_SELECT_HINT = "마음에 드는 길을 선택해 시작하세요.";

export const STORY_REWARD_TOAST_TITLE = "챕터 클리어!";
export const STORY_REWARD_TOAST_BODY = "내 복서의 이야기가 다음 장으로 넘어갑니다.";
export const STORY_ALREADY_CLAIMED_BODY = "이미 보상을 수령한 챕터입니다.";
export const STORY_NOT_COMPLETE_BODY = "아직 조건을 모두 채우지 못했습니다.";

export const STORY_OBSTACLE_LABEL: Record<string, string> = {
  lazy_slime: "게으름 슬라임",
  guard_breaker: "가드 브레이커",
  breath_holder: "숨참기 유령",
  wrist_break: "손목꺾임 괴물",
  quit_demon: "포기 악마",
  excuse_goblin: "핑계 도깨비",
  tense_wolf: "긴장 늑대",
  compare_monster: "비교 괴물",
  overtrain_golem: "과훈련 골렘",
};

export const STORY_OBSTACLE_DESC: Record<string, string> = {
  lazy_slime: "시작을 미루는 마음. 가장 작게 보이지만 가장 자주 만나는 적입니다.",
  guard_breaker: "자세가 무너지는 습관. 펀치보다 자세를 먼저 챙기세요.",
  breath_holder: "긴장하면 숨을 멈추는 버릇. 호흡이 살아있어야 라운드도 살아있습니다.",
  wrist_break: "잘못된 펀치 자세. 손목과 어깨를 보호하세요.",
  quit_demon: "라운드 중간에 포기하고 싶어지는 마음. 한 발만 더 내보세요.",
  excuse_goblin: "오늘은 안 가도 된다는 핑계. 가장 약한 적이지만 가장 끈질긴 적입니다.",
  tense_wolf: "처음 스파링 앞의 공포. 도망가도 괜찮습니다. 그리고 다시 돌아오세요.",
  compare_monster: "다른 사람과 나를 비교하는 마음. 오늘의 상대는 어제의 나입니다.",
  overtrain_golem: "쉬어야 할 때 멈추지 못하는 습관. 휴식도 훈련의 일부입니다.",
};

// 노드/루트 설명은 DB seed 와 동일 텍스트로 fallback (DB 가 비어있을 때 표시).
export const STORY_NODE_FALLBACK: Record<string, { title: string; description: string }> = {
  gym_entrance: { title: "체육관 입구", description: "오늘도 링이 열립니다. 모든 복서의 길은 이 문을 여는 것에서 시작합니다." },
  mirror_zone: { title: "거울 앞", description: "나의 자세, 나의 호흡, 나의 표정을 마주하는 자리입니다." },
  rope_zone: { title: "줄넘기 존", description: "리듬은 발에서 시작합니다. 가장 단순한 도구가 가장 정직합니다." },
  sandbag_zone: { title: "샌드백 존", description: "맞지 않는 상대 앞에서 가장 정직한 펀치를 배웁니다." },
  ring: { title: "링", description: "실제로 움직이는 사람과 마주하는 자리. 합의된 규칙 안에서 성장합니다." },
  corner: { title: "코너", description: "회복과 호흡과 작전을 다듬는 자리. 코너는 패배가 아니라 전략입니다." },
  boxing_hall: { title: "복싱 전당", description: "오늘의 한 라운드가 누군가에게 영감이 되는 곳." },
  master_room: { title: "마스터룸", description: "나만 잘하는 사람이 아니라 다른 사람을 안전하게 이끄는 사람의 자리." },
  fight_camp: { title: "파이트 캠프", description: "다음 시즌을 위해 자기 자신을 다듬는 집중 훈련 공간." },
  rival_arena: { title: "라이벌 아레나", description: "어제의 나와, 그리고 비슷한 길을 걷는 동료와 마주하는 자리." },
};

// 챕터 진행 조건의 사용자 친화적 라벨
export const STORY_CONDITION_LABEL: Record<string, string> = {
  quiz_correct_total: "복싱 IQ 정답",
  challenge_clear_total: "챌린지 클리어",
  journal_total: "챔피언 일기",
  cheer_sent_total: "세컨드 응원 보내기",
  engagement_quest_xp: "QUEST XP 누적",
};
