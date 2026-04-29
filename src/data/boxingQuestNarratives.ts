/**
 * 153 QUEST — 계급별 자체 제작 스토리 카드.
 *
 * 실존 복서, 영화, 만화, 실제 명언은 사용하지 않는다.
 * 모든 텍스트는 153 자체 창작.
 */

export type NarrativeRank = "white" | "blue" | "red" | "black";

export interface BoxingQuestNarrative {
  rank: NarrativeRank;
  title: string;
  archetype: string;
  hook: string;
  body: string[];
  closing: string;
}

const WHITE: BoxingQuestNarrative = {
  rank: "white",
  title: "체육관 문을 처음 연 신인",
  archetype: "지금 막 글러브를 처음 낀 사람",
  hook: "처음으로 누른 도어록의 짧은 신호음. 그 한 번이 시작이었다.",
  body: [
    "거울 앞에 선 어색한 자세. 가드 위치도, 발 너비도 어딘가 어긋난 채로 첫 라운드를 끝낸다.",
    "관장님은 잘했다고 하지 않는다. 다만 잽 한 번을 정직하게 친 것에 작은 끄덕임을 보낸다.",
    "오늘 배운 건 단 하나 — 내가 시간을 낼 수 있다는 사실. 그것이 신인의 첫 승리다.",
  ],
  closing: "오늘의 너는 어제까지의 너 중 가장 빨리 시작한 사람이다.",
};

const BLUE: BoxingQuestNarrative = {
  rank: "blue",
  title: "기본기를 몸에 붙이는 선수",
  archetype: "잽이 흔들리지 않기 시작한 사람",
  hook: "거울 속의 가드가 더 이상 낯설지 않다. 발이 먼저 자리를 잡고, 손이 그 다음에 나간다.",
  body: [
    "오늘은 같은 동작을 백 번 반복했다. 백한 번째에 처음으로 어깨가 풀린다.",
    "트레이너의 지적은 짧아졌다. 잘 안되면 다음 라운드에서 다시. 그 한 줄로 충분하다.",
    "기본기는 화려함이 아니다. 정확함이다. 그 정확함이 두 달째 쌓여 있다.",
  ],
  closing: "기본은 지루한 것이 아니라, 오래 가는 무기다.",
};

const RED: BoxingQuestNarrative = {
  rank: "red",
  title: "어제의 나와 싸우는 도전자",
  archetype: "기록을 한 칸씩 올리고 있는 사람",
  hook: "코너에 앉아 어제의 기록을 본다. 한 라운드만 더. 그 한 줄이 오늘의 목표다.",
  body: [
    "공식 라운드를 끝낸 뒤에도 한 라운드를 더 한다. 이건 의무가 아니라 약속이다 — 어제의 나에게.",
    "코너맨은 말이 적다. 호흡, 자세, 시간. 세 단어면 충분하다.",
    "기록을 깨는 상대는 멀리 있지 않다. 어제 같은 시간에 같은 라운드를 친 자기 자신이다.",
  ],
  closing: "도전자는 매일 자신의 어제를 무너뜨리고 그 위에 오늘을 세운다.",
};

const BLACK: BoxingQuestNarrative = {
  rank: "black",
  title: "후배에게 길을 보여주는 챔피언",
  archetype: "이미 한 번 정상을 본 사람",
  hook: "체육관에 들어서면 시선이 따라온다. 챔피언이라는 단어보다 무거운 것은 그 시선이다.",
  body: [
    "오늘 라운드는 더 이상 자신을 위한 것이 아니다. 후배의 첫 자세가 어디로 갈지를 보여주는 한 동작이다.",
    "챔피언의 잽은 더 빠르지 않다. 더 정확하다. 그 차이를 후배는 한 달 뒤에 안다.",
    "후배가 모르는 것을 비웃지 않는다. 자기도 거기서 시작했다는 걸 잊지 않는다.",
  ],
  closing: "챔피언은 자기 기록을 보여주는 사람이 아니라, 다음 사람이 도달할 길을 남기는 사람이다.",
};

const TABLE: Record<NarrativeRank, BoxingQuestNarrative> = {
  white: WHITE,
  blue: BLUE,
  red: RED,
  black: BLACK,
};

export function getBoxingQuestNarrative(rank: NarrativeRank): BoxingQuestNarrative {
  return TABLE[rank];
}

export const BOXING_QUEST_NARRATIVES: BoxingQuestNarrative[] = [
  WHITE,
  BLUE,
  RED,
  BLACK,
];
