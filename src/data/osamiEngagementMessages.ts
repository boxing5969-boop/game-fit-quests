/**
 * 153 QUEST — 오삼이 정적 메시지 사전.
 *
 * 본 파일은 정적 텍스트만 둔다. 새 AI 챗봇/스트리밍 채널을 만들지 않는다.
 * 기존 ChatAssistant 단일 경로는 그대로 유지된다.
 *
 * 자체 제작 콘텐츠만 사용 — 실존 인물/명언/저작물 미사용.
 */

export type OsamiMessageType =
  | "app_open"
  | "daily_briefing"
  | "quiz_correct"
  | "quiz_wrong"
  | "fun_challenge_start"
  | "fun_challenge_complete"
  | "journal_prompt"
  | "cheer_received"
  | "comeback_after_absence";

export type OsamiPersona = "white" | "blue" | "red" | "black";

export interface OsamiMessage {
  type: OsamiMessageType;
  text: string;
}

const WHITE: Record<OsamiMessageType, string[]> = {
  app_open: [
    "오늘도 링이 열렸습니다. 천천히 와도 괜찮습니다. 오늘의 라운드를 클리어해볼까요?",
    "처음 글러브를 끼면 누구나 어색합니다. 오늘은 한 가지만 해도 충분해요.",
  ],
  daily_briefing: [
    "공식 훈련은 코치님 기준으로, 보조 퀘스트는 습관과 재미를 위해 준비했어요.",
    "오늘은 잽 한 번이라도 정직하게 — 그게 신인의 첫 자세입니다.",
  ],
  quiz_correct: [
    "정답! 알고 치는 펀치는 더 강합니다.",
    "잘했어요. 머리로 한 번, 몸으로 한 번 — 두 번 들어가는 셈입니다.",
  ],
  quiz_wrong: [
    "아쉽지만 괜찮아요. 복싱은 틀리면서 몸에 들어오는 운동입니다.",
    "한 번 더 가볍게 봅시다. 정답을 안 다음 다시 풀면 진짜 내 것이 돼요.",
  ],
  fun_challenge_start: [
    "오늘의 라운드 시작. 자세부터, 속도는 그다음입니다.",
    "준비됐죠? 무리하지 않는 선에서 끝까지 가봅시다.",
  ],
  fun_challenge_complete: [
    "한 라운드 클리어! 신인답게 정직했어요.",
    "오늘 한 번이 내일의 기본기를 만듭니다.",
  ],
  journal_prompt: [
    "오늘 가장 마음에 든 한 가지 동작은 무엇이었나요? 한 줄이면 충분해요.",
    "오늘 몸의 상태를 한 줄로 적어두면, 일주일 뒤의 내가 고마워합니다.",
  ],
  cheer_received: [
    "응원이 도착했습니다. 링 위에서 혼자가 아닙니다.",
    "함께 운동하는 사람의 박수는 진짜 힘이 됩니다.",
  ],
  comeback_after_absence: [
    "돌아온 것 자체가 오늘의 승리입니다.",
    "쉬었어도 폼은 사라지지 않아요. 가볍게 다시 시작합시다.",
  ],
};

const BLUE: Record<OsamiMessageType, string[]> = {
  app_open: [
    "복귀 환영. 오늘은 어제보다 한 줄 정확하게 갑니다.",
    "기본기에 딱 한 번 더 붙어보죠. 가드부터 잡습니다.",
  ],
  daily_briefing: [
    "오늘은 잽–가드 회수 한 사이클을 몸에 정확히 박는 날입니다.",
    "공식 훈련 외에도 오삼 챌린지로 디테일을 잡아둡시다.",
  ],
  quiz_correct: ["좋습니다. 답을 알고 치는 사람은 거리도 다릅니다.", "정답. 다음 문제로 갑시다."],
  quiz_wrong: [
    "한 번 틀렸으니 한 번 정확해질 차례입니다. 다시 풀어보죠.",
    "괜찮습니다. 재도전 정답이 더 오래 갑니다.",
  ],
  fun_challenge_start: [
    "자세 무너지면 카운트 멈춰요. 정확함이 우선입니다.",
    "회수까지 한 동작입니다. 처음부터 끝까지.",
  ],
  fun_challenge_complete: [
    "클리어. 다음엔 한 단계 위로 올려봅시다.",
    "라운드 마감. 호흡 정리하고 가드부터 다시.",
  ],
  journal_prompt: [
    "오늘 가장 잘 된 한 가지와 가장 흔들린 한 가지를 적어두세요.",
    "내일 고칠 한 가지를 한 줄로 — 그게 트레이닝입니다.",
  ],
  cheer_received: [
    "응원은 받되, 자세는 그대로. 잘하고 있습니다.",
    "박수 한 번에 한 라운드 더. 시동 거세요.",
  ],
  comeback_after_absence: [
    "복귀했으면 무리하지 말고 가벼운 라운드부터.",
    "쉬었으면 다시 잡으면 됩니다. 가드, 자세, 호흡 순서로.",
  ],
};

const RED: Record<OsamiMessageType, string[]> = {
  app_open: [
    "코너로 돌아왔다. 오늘 한 라운드도 너의 기록이다.",
    "어제의 너랑 붙는 거다. 가볍게 풀자.",
  ],
  daily_briefing: [
    "오늘 목표는 어제 멈춘 그 지점 한 칸 위. 그게 도전이다.",
    "기록을 깨는 상대는 남이 아니라 어제의 나입니다.",
  ],
  quiz_correct: [
    "정답. 머리도 같이 단련되고 있다.",
    "맞췄다. 몸으로 들어간 다음 카드로 넘어가자.",
  ],
  quiz_wrong: [
    "정답을 봤으니, 다음엔 안 틀린다. 그게 도전자다.",
    "오답도 한 라운드다. 회복하고 다시.",
  ],
  fun_challenge_start: [
    "기록 깨러 가자. 페이스부터 잡고 후반에 끌어올린다.",
    "고강도다. 무리되면 단계 내린다 — 부상보다 무서운 건 없다.",
  ],
  fun_challenge_complete: [
    "기록 갱신. 어제의 너를 이긴 거다.",
    "한 라운드 끝. 회복도 훈련이다.",
  ],
  journal_prompt: [
    "오늘 너의 한 줄 — 도전자의 메모로 남긴다.",
    "이긴 한 가지, 진 한 가지, 내일 다시 붙을 한 가지.",
  ],
  cheer_received: [
    "코너에서 박수가 들린다. 그 힘으로 한 라운드 더.",
    "응원 받았으면 한 라운드 갚는다.",
  ],
  comeback_after_absence: [
    "공백은 패배가 아니다. 다시 링 위로 올라온 게 승리다.",
    "쉬었으면 가볍게 — 다음 라운드부터 본격적으로.",
  ],
};

const BLACK: Record<OsamiMessageType, string[]> = {
  app_open: [
    "챔피언, 오늘도 링에 섰군. 후배들이 보고 있다.",
    "네 페이스로 와도 좋다. 다만 오늘 한 줄은 남기자.",
  ],
  daily_briefing: [
    "공식 훈련은 너의 루틴이고, 오삼 퀘스트는 후배에게 보여주는 길이다.",
    "오늘 너의 한 라운드가, 누군가의 첫 라운드 모범이다.",
  ],
  quiz_correct: ["정답. 알고 치는 챔피언이다.", "예상대로다. 다음 카드로."],
  quiz_wrong: [
    "챔피언도 가끔 틀린다. 후배에게 보여줄 좋은 복기 자료다.",
    "오답을 정직하게 다시 — 그게 챔피언의 격이다.",
  ],
  fun_challenge_start: [
    "가볍게 워밍, 정확하게 마감. 보여주는 라운드다.",
    "오늘 챌린지는 후배에게 한 동작 가르치는 마음으로.",
  ],
  fun_challenge_complete: [
    "한 라운드 클리어. 후배의 기준선이 한 칸 올라갔다.",
    "기록보다 정확함. 챔피언다웠다.",
  ],
  journal_prompt: [
    "오늘 너의 한 줄, 후배들이 읽을 챔피언의 기록이다.",
    "남기는 한 줄이 누군가의 시작이 된다.",
  ],
  cheer_received: [
    "챔피언에게도 응원은 힘이다. 받고, 갚자.",
    "후배의 박수는 가장 깨끗한 힘이다.",
  ],
  comeback_after_absence: [
    "돌아왔다는 사실 자체가 챔피언의 자세다.",
    "공백 후의 첫 라운드 — 후배들이 가장 많이 배우는 장면이다.",
  ],
};

const PERSONA_TABLE: Record<OsamiPersona, Record<OsamiMessageType, string[]>> = {
  white: WHITE,
  blue: BLUE,
  red: RED,
  black: BLACK,
};

/** 페르소나 + 메시지 타입에 해당하는 모든 후보 메시지. */
export function getOsamiMessages(
  persona: OsamiPersona,
  type: OsamiMessageType,
): string[] {
  return PERSONA_TABLE[persona][type];
}

/** 후보 중 하나를 deterministic 하지 않게 랜덤 선택 (하루에 한 번만 호출하길 권장). */
export function pickOsamiMessage(
  persona: OsamiPersona,
  type: OsamiMessageType,
): string {
  const list = getOsamiMessages(persona, type);
  if (list.length === 0) return "";
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

/** seed (예: 일자) 로 안정적으로 하루치 메시지를 고정하고 싶을 때. */
export function pickOsamiMessageBySeed(
  persona: OsamiPersona,
  type: OsamiMessageType,
  seed: string,
): string {
  const list = getOsamiMessages(persona, type);
  if (list.length === 0) return "";
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return list[h % list.length];
}
