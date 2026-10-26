/**
 * 🥊 붕대 감기 가이드 — 대표님 영상(각도 2개) · 사진 10장 · 흔한 실수 · 영상 핵심 포인트.
 *
 *   2026-10-13: 처음 만듦 (그림 8단계). 2026-10-15~16: 사진 → 고화질 그림 → 주먹 패드 방법 13단계.
 *   2026-10-17 대표님: "2가지 방식 모두 지워줘. 내가 직접 영상 찍어서 올려야 할 것 같아" → 그림 단계를 지웠다.
 *   2026-10-20 대표님: "구글 드라이브에 오늘 날짜로 붕대 감는 동영상 올렸거든 — 앱에 적용해 주고 다양한 각도로
 *     회원님들이 쉽게 보고 배울 수 있도록. 그리고 한 장 한 장 사진과 설명으로, 영상이 어려운 분들은 그림을 보고 배울 수 있게"
 *     → 대표님이 찍은 영상 2개(DJI 2026-10-20 20:04 · 20:05)를 각도 2개로: '옆에서'(손등이 잘 보임) · '앞에서'(손가락 사이가 잘 보임).
 *       영상 파일은 public/handwrap/ (720p · 소리 그대로 · 마지막 카메라 끄는 장면만 잘라 냄),
 *       사진 10장은 같은 영상에서 뽑아 손 쪽으로 잘라 낸 것 (→ 아래 2026-10-20 두 번째 요청으로 배경 지운 단계 영상으로 바뀜).
 *   2026-10-20 대표님: "직전에 만들었던 거 애니메이션화 시키고, 뒤에 배경이 별로라서 배경 없애 줘.
 *     감는 방향이나 올라가는 대각선 방향, 내려가는 방향 등등 상세하게"
 *     → 단계마다 대표님 영상에서 1초 안팎을 잘라 배경을 지우고(손 · 붕대만), 마지막 장면에서 멈춰
 *       감는 방향 화살표(민트 · 점선 = 손바닥 쪽)와 짧은 글이 차례로 그려지는 4~5초 반복 영상 (public/handwrap/steps/stepNN.mp4).
 *       포스터(stepNN.webp)는 화살표까지 다 그려진 마지막 장면 — 움직임 줄이기 설정이면 이 그림만 보여 준다.
 *       2~4 · 6~10단계는 앞에서 찍은 영상을 180도 돌린 것 = 내가 내 왼손을 내려다보는 방향(엄지가 오른쪽). 1 · 5단계는 옆에서.
 *
 *   2026-10-27 대표님: "복싱붕대도 아직 화질도 많이 깨지고 … 영상도 편집을 통해서 방향이랑 속도 조절 등을 통해 좀 더 회원님들이
 *     잘 따라 할 수 있게 · 사진 한 장씩 볼 수도 있지만 한눈에 처음부터 끝까지 설명서 보듯 그림과 글로"
 *     → 단계 영상 10개를 다시: 배경 지운 멈춘 손(움직임 없음 · 87kbps) 대신 원본에서 그 단계를 실제로 감는 장면을 잘라
 *       내 손을 내려다보는 방향(앞에서 찍은 영상 180도)으로 · 손 쪽으로 잘라 줄여서 선명하게 · 끝에서 가장 선명한 장면에 멈춤.
 *       속도는 앱에서 고른다(아주 천천히 0.4 · 천천히 0.6 기본 · 원래 1) · 왼손/오른손(오른손은 거울로 뒤집어 보기).
 *       화살표는 글로 옮겼다(dir — 감는 방향 한 줄). 큰 영상에 '내 눈으로'(앞에서 찍은 영상 180도) 각도를 더했다.
 *       설명서 보기(HandWrapManual) = 10단계를 위에서 아래로 그림 + 글.
 *
 *   영상 속 방법(왼손): 엄지에 고리 → 손목 → 손등을 건너 주먹 마디 → 손가락 펴고 마디 감기(손등에 X자) →
 *     손가락 사이사이로 넣기(한 칸 지날 때마다 손목 한 바퀴) → 남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 주먹 쥐어 확인.
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 영상을 보며 직접 감는다.
 *   그다음 '집에서 혼자 감아 보기' 미션 — 목표 일수·보상 숫자는 DB 함수가 정본이다
 *   (handwrap_practice_goal · handwrap_practice_reward → get_my_handwrap_practice 가 돌려준다). 여기에 숫자를 적지 않는다.
 *
 *   훈련 라이브러리 '준비' 칸의 '복싱 붕대 감기' 항목에 코치·관장이 영상 주소를 넣으면 '코치 영상' 칸으로 하나 더 붙는다.
 */
/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

// ── 영상 — 같은 감기를 두 각도에서 ─────────────────────────────

export type HandWrapAngleKey = "mine" | "side" | "front";

export interface HandWrapAngle {
  key: HandWrapAngleKey;
  /** 플레이어 칸 이름 */
  label: string;
  /** 카드 한 줄 */
  hint: string;
  videoUrl: string;
  posterUrl: string;
  /** 초 — 화면 표시용 */
  seconds: number;
  /** 180도 돌려 보여 준다 — 앞에서 찍은 영상을 내 손을 내려다보는 방향으로 (2026-10-27) */
  rotate180?: boolean;
}

export const HANDWRAP_ANGLES: readonly HandWrapAngle[] = [
  {
    key: "mine",
    label: "내 눈으로",
    hint: "내 왼손을 내려다보는 방향 · 따라 하기 가장 쉬워요",
    videoUrl: "/handwrap/front.mp4",
    posterUrl: "/handwrap/front.webp",
    seconds: 44,
    rotate180: true,
  },
  {
    key: "side",
    label: "옆에서",
    hint: "손등 · 손목이 잘 보여요",
    videoUrl: "/handwrap/side.mp4",
    posterUrl: "/handwrap/side.webp",
    seconds: 40,
  },
  {
    key: "front",
    label: "앞에서",
    hint: "손가락 사이가 잘 보여요",
    videoUrl: "/handwrap/front.mp4",
    posterUrl: "/handwrap/front.webp",
    seconds: 44,
  },
];

export const handWrapAngleIndex = (key: HandWrapAngleKey): number =>
  Math.max(
    0,
    HANDWRAP_ANGLES.findIndex((a) => a.key === key),
  );

// ── 사진 10장 — 영상이 어려운 분은 사진으로 ─────────────────────

export interface HandWrapStep {
  title: string;
  /** 한두 문장 — 화면에서 보이는 것 그대로 · 감는 방향까지 */
  desc: string;
  /** 놓치기 쉬운 것 한 줄 (없으면 생략) */
  tip?: string;
  /** 감는 방향 한 줄 — 단계 영상 아래 · 설명서 (2026-10-27 화살표 대신) */
  dir: string;
  /** 그 단계를 실제로 감는 짧은 반복 영상 (원본에서 잘라 냄, 소리 없음) */
  clip: string;
  /** 단계가 끝난 장면(가장 선명한 곳) — 영상 포스터 · 작은 그림 줄 · 설명서 · 움직임 줄이기 */
  image: string;
  /** 영상을 보는 방향 — mine: 내 왼손을 내려다보는 방향 · side: 옆에서 */
  view: "mine" | "side";
  /** '이 장면 영상으로 보기' — 어느 각도 영상의 몇 초 */
  video: { angle: HandWrapAngleKey; at: number };
}

/** 단계 영상 · 포스터 고친 판 — 영상을 다시 만들면 올린다. 폰이 4시간 동안 예전 파일을 그대로 쓰지 않게 (2026-10-27 실제 감는 장면으로 다시) */
const STEP_MEDIA_VERSION = "20261027";

/** 단계 영상 · 포스터 주소 (public/handwrap/steps/stepNN.mp4 · .webp) */
const stepMedia = (n: number, view: HandWrapStep["view"] = "mine"): Pick<HandWrapStep, "clip" | "image" | "view"> => {
  const id = `step${String(n).padStart(2, "0")}`;
  const v = `?v=${STEP_MEDIA_VERSION}`;
  return { clip: `/handwrap/steps/${id}.mp4${v}`, image: `/handwrap/steps/${id}.webp${v}`, view };
};

/** 어느 손을 감을 때 보나 — 오른손은 영상을 거울로 뒤집어 보여 준다 (2026-10-27 대표님 "방향 조절") */
export type HandSide = "left" | "right";

/** 단계 영상을 보는 방향 */
export const HANDWRAP_VIEW_NOTE: Record<HandWrapStep["view"], Record<HandSide, string>> = {
  mine: { left: "내 왼손을 내려다보는 방향 (엄지가 오른쪽)", right: "내 오른손을 내려다보는 방향 (엄지가 왼쪽) · 거울로 뒤집었어요" },
  side: { left: "옆에서 본 모습", right: "옆에서 본 모습 · 거울로 뒤집었어요" },
};

/** 오른손(거울)일 때 글 속 대각선 화살표도 좌우를 바꾼다 — ↗ ↔ ↖ · ↘ ↔ ↙ */
export const mirrorArrows = (text: string): string =>
  text.replace(/[↗↖↘↙]/g, (c) => ({ "↗": "↖", "↖": "↗", "↘": "↙", "↙": "↘" })[c] ?? c);

/** 단계 영상 속도 — 영상은 원래 속도로 만들고 앱이 느리게 튼다 */
export const HANDWRAP_STEP_SPEEDS: ReadonlyArray<{ rate: number; label: string }> = [
  { rate: 0.4, label: "아주 천천히" },
  { rate: 0.6, label: "천천히" },
  { rate: 1, label: "원래 속도" },
];
export const HANDWRAP_DEFAULT_STEP_RATE = 0.6;

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "엄지에 고리 걸기",
    desc: "붕대 끝 고리를 엄지에 걸고, 붕대를 손등 쪽으로 넘겨 손목으로 가져가요.",
    dir: "고리는 엄지에 → 붕대는 손등 쪽으로 넘겨 손목으로",
    ...stepMedia(1),
    video: { angle: "mine", at: 0 },
  },
  {
    title: "손목 감기",
    desc: "손목을 단단히 2~3바퀴 감아요. 손등 쪽에서는 새끼손가락 쪽 → 엄지 쪽으로 지나가요.",
    tip: "손목도 마디도 끝까지 같은 방향(손등에서 새끼 → 엄지 쪽)으로 감아요.",
    dir: "손등에서 새끼 → 엄지 쪽으로 2~3바퀴",
    ...stepMedia(2),
    video: { angle: "mine", at: 2.9 },
  },
  {
    title: "손등을 건너 주먹 마디로",
    desc: "손목의 새끼손가락 쪽에서 손등을 대각선으로 올라가(↗) 검지 쪽 주먹 마디로 가요.",
    dir: "손목 새끼 쪽에서 ↗ 대각선으로 검지 마디까지",
    ...stepMedia(3),
    video: { angle: "mine", at: 5.8 },
  },
  {
    title: "손가락 펴고 마디 감기",
    desc: "손가락을 쫙 편 채로 주먹 마디를 감아요(손등에서 새끼 → 엄지 쪽). 다 감으면 손등을 대각선으로 내려와(↘) 손목 엄지 쪽으로 — 올라간 대각선과 겹쳐 손등에 X자가 생겨요.",
    tip: "손가락을 오므리고 감으면 주먹을 쥘 때 너무 조여요.",
    dir: "마디를 새끼 → 엄지 쪽으로 감고 ↘ 대각선으로 손목 엄지 쪽 (손등에 X자)",
    ...stepMedia(4),
    video: { angle: "mine", at: 9.2 },
  },
  {
    title: "주먹 쥐어 마디 확인",
    desc: "주먹을 쥐어 마디가 두툼하게 다 덮였는지 봐요.",
    dir: "주먹을 쥐고 마디 위가 두툼한지 보기",
    ...stepMedia(5, "side"),
    video: { angle: "side", at: 10.3 },
  },
  {
    title: "손가락 사이사이로",
    desc: "손등에서 손가락 사이로 붕대를 넣어(↑) 손바닥 쪽으로 넘기고, 손바닥 쪽으로 내려와 손목으로 가요. 한 칸씩 차례로 지나가요.",
    dir: "손등에서 손가락 사이로 넣어 손바닥 쪽으로 → 손목으로",
    ...stepMedia(6),
    video: { angle: "mine", at: 15.9 },
  },
  {
    title: "한 칸 지날 때마다 손목 한 바퀴",
    desc: "손가락 사이를 하나 지날 때마다 손목을 한 바퀴 감아 고정해요. 손목은 이번에도 손등에서 새끼 → 엄지 쪽으로.",
    dir: "손가락 사이 한 칸 → 손목 한 바퀴 (새끼 → 엄지 쪽)",
    ...stepMedia(7),
    video: { angle: "mine", at: 21 },
  },
  {
    title: "다 감은 모양",
    desc: "손가락 사이에 붕대 줄이 보이고, 마디 위가 두툼하고, 손등에 X자가 있으면 잘 감은 거예요.",
    dir: "손가락 사이 줄 · 두툼한 마디 · 손등 X자",
    ...stepMedia(8),
    video: { angle: "mine", at: 31 },
  },
  {
    title: "남은 붕대는 손목에 · 벨크로",
    desc: "남은 붕대는 손목에 전부 감고, 벨크로는 손목 바깥쪽(손등 쪽)에 붙여요.",
    tip: "벨크로가 손바닥 쪽에 있으면 장갑 안에서 쓸려요.",
    dir: "남은 붕대는 손목에 다 감고 · 벨크로는 손목 바깥쪽(손등 쪽)",
    ...stepMedia(9),
    video: { angle: "mine", at: 37.4 },
  },
  {
    title: "주먹 쥐어 확인",
    desc: "주먹을 쥐었다 폈다 해 봐요. 손끝이 저리거나 하얘지면 풀고 다시 감아요.",
    dir: "쥐었다 폈다 — 저리거나 하얘지면 풀고 다시",
    ...stepMedia(10),
    video: { angle: "mine", at: 41.6 },
  },
];

// ── 흔한 실수 · 영상 핵심 포인트 ─────────────────────────────

export interface HandWrapMistake {
  wrong: string;
  fix: string;
}

export const HANDWRAP_MISTAKES: readonly HandWrapMistake[] = [
  { wrong: "고리를 엄지에 안 걸고 시작해요", fix: "고리를 엄지에 걸어야 감는 동안 붕대가 빠지지 않고 처음 자리가 잡혀요." },
  { wrong: "손가락을 오므리고 마디를 감아요", fix: "손가락을 쫙 펴고 감아야 주먹을 쥐었을 때 너무 조이지 않아요." },
  { wrong: "있는 힘껏 세게 감아요", fix: "손끝이 저리거나 하얘지면 바로 풀고 다시 — 너무 느슨하지도, 너무 꽉 조이지도 않게." },
  { wrong: "벨크로를 손목 안쪽(손바닥 쪽)에 붙여요", fix: "벨크로는 손목 바깥쪽(손등 쪽)에 붙여야 장갑 안에서 쓸리지 않아요." },
  { wrong: "붕대가 꼬이거나 주름진 채로 감아요", fix: "붕대를 평평하게 펴면서 감고, 마지막에 손바닥 쪽도 펴서 정리해요." },
];

/** 영상 플레이어 아래 '핵심 포인트' */
export const HANDWRAP_KEY_POINTS: readonly string[] = [
  "엄지에 고리 → 손목 2~3바퀴 (손등에서 새끼 → 엄지 쪽, 끝까지 같은 방향)",
  "손등을 대각선으로 올라가(↗) 주먹 마디로 → 손가락 쫙 펴고 마디 감기 → 대각선으로 내려와(↘) 손목으로 (손등에 X자)",
  "손가락 사이사이로 넣기 — 한 칸 지날 때마다 손목 한 바퀴",
  "남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 주먹 쥐어 확인",
];
