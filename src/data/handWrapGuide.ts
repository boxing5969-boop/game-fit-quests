/**
 * 🥊 붕대 감기 가이드 — 그림 8단계 · 흔한 실수 · 영상 포인트 (2026-10-13 대표님).
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 이 화면을 보며 직접 감는다.
 *   그다음 '집에서 혼자 감아 보기' 미션 — 목표 일수·보상 숫자는 DB 함수가 정본이다
 *   (handwrap_practice_goal · handwrap_practice_reward → get_my_handwrap_practice 가 돌려준다). 여기에 숫자를 적지 않는다.
 *
 *   영상 = 훈련 라이브러리 '준비' 칸의 '복싱 붕대 감기' 항목 영상 URL (코치·관장이 수정 → 영상 URL, 유튜브 주소도 된다).
 *   그림 = components/handwrap/HandWrapIllustration (왼손 손등 · 지금 단계는 민트, 앞 단계는 흰 붕대).
 */

/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

/** 그림의 붕대 층 — HandWrapIllustration 이 층마다 모양을 그린다 */
export type WrapLayer =
  | "loop"
  | "wrist"
  | "diagUp"
  | "knuckle"
  | "diagDown"
  | "gaps"
  | "thumbLock"
  | "knuckle2"
  | "finish";

export interface HandWrapStep {
  title: string;
  body: string;
  /** 이 단계에서 새로 감는 층 — 그림에서 민트로 보인다 (앞 단계 층은 흰 붕대로 쌓인다) */
  layers: readonly WrapLayer[];
  /** 그림 옆 꼬리표 (예: 3바퀴) */
  badge?: string;
}

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "엄지에 고리 걸기",
    body: "고리를 엄지에 걸고 붕대를 손등 쪽으로 넘겨 감기 시작해요. 붕대에 ‘THIS SIDE DOWN’ 표시가 있으면 그 면이 피부에 닿게 해요.",
    layers: ["loop"],
  },
  {
    title: "손목 3바퀴",
    body: "손목을 3바퀴 감아 손목뼈를 덮어요. 단단하게, 하지만 손이 저릴 만큼 조이지는 않게요.",
    layers: ["wrist"],
    badge: "3바퀴",
  },
  {
    title: "주먹 마디 3바퀴",
    body: "손등을 비스듬히 올라가 주먹 마디(너클)를 3바퀴 감아요. 손가락을 쫙 편 채로 감아야 주먹을 쥐었을 때 조이지 않아요.",
    layers: ["diagUp", "knuckle"],
    badge: "3바퀴",
  },
  {
    title: "손목으로 내려오기",
    body: "손등을 반대 방향으로 비스듬히 내려와 손목을 한 바퀴 감아요. 손등에 X자가 생겨요.",
    layers: ["diagDown"],
  },
  {
    title: "손가락 사이 감기",
    body: "손목에서 손등을 지나 새끼–약지 사이로 넣고, 손바닥 쪽으로 내려와 손목을 한 바퀴. 약지–중지, 중지–검지 사이도 똑같이 해요.",
    layers: ["gaps"],
    badge: "3곳",
  },
  {
    title: "엄지 잡아 주기",
    body: "손목에서 엄지 뿌리를 한 바퀴 감아 엄지를 고정하고 다시 손목으로 와요. 엄지가 덜렁거리지 않으면 잘 감긴 거예요.",
    layers: ["thumbLock"],
  },
  {
    title: "주먹 마디 한 번 더",
    body: "손등을 지나 주먹 마디를 1~2바퀴 더 감아 쿠션을 두껍게 해요.",
    layers: ["knuckle2"],
    badge: "1~2바퀴",
  },
  {
    title: "손목에서 마무리",
    body: "남은 붕대는 손목에 감고 벨크로로 붙여요. 주먹을 쥐었다 펴 보고, 손끝이 저리거나 하얘지면 풀고 조금 느슨하게 다시 감아요.",
    layers: ["finish"],
  },
];

/** 다 감은 뒤(완성 화면) 문구 */
export const HANDWRAP_DONE = {
  title: "완성!",
  body: "주먹을 꽉 쥐었다 펴 보세요. 마디가 푹신하고 손목이 단단하면 잘 감긴 거예요. 손끝이 저리면 풀고 조금 느슨하게 다시 감아요.",
} as const;

export interface HandWrapMistake {
  wrong: string;
  fix: string;
}

export const HANDWRAP_MISTAKES: readonly HandWrapMistake[] = [
  { wrong: "주먹을 쥔 채로 마디를 감아요", fix: "손가락을 쫙 편 채로 감아야 주먹을 쥐었을 때 피가 잘 통해요." },
  { wrong: "있는 힘껏 세게 감아요", fix: "손끝이 저리거나 하얘지면 바로 풀고 다시 — 단단하게, 하지만 아프지 않게." },
  { wrong: "손목을 한두 바퀴만 감아요", fix: "손목은 3바퀴 이상 감아 단단하게 받쳐 줘요." },
  { wrong: "붕대가 꼬이거나 주름진 채로 감아요", fix: "붕대를 평평하게 펴면서 감아야 쓸리지 않아요." },
];

/** 영상 플레이어 아래 '핵심 포인트' */
export const HANDWRAP_KEY_POINTS: readonly string[] = [
  "엄지 고리 → 손목 3바퀴 → 주먹 마디 3바퀴",
  "손가락 사이 3곳을 지나며 손목으로 돌아오기",
  "엄지 한 바퀴 고정 → 마디 한 번 더 → 손목에서 마무리",
  "손가락을 편 채로 감고, 저리면 풀고 다시",
];
