/**
 * 🥊 붕대 감기 가이드 — 대표님 영상(각도 2개) · 9단계 설명서 · 흔한 실수 · 영상 핵심 포인트.
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
 *   2026-10-27 10:01 대표님: "한눈에 1번 단계부터 9단계까지 사진 총 9장을 한 번에 볼 수 있고, 각 단계마다 이미지와 설명이 밑에 …
 *     클릭하면 상세페이지처럼 나오고 사진 밑에 설명 자세히, 사진에 방향과 어디에서 시작해서 어디로 오는지 — 사진보다 움직이는 사진으로.
 *     한 단계씩 보고 따라 할 수 있는"
 *     → 9단계로 다시 묶음: '주먹 쥐어 마디 확인'은 5단계 팁으로, '다 감은 모양'은 9단계 확인으로, 마디 감기와 내려오는 대각선은 둘로 나눔.
 *     → 단계 영상 = 그 동작이 처음부터 끝까지 담긴 구간(720x540, 원본 화소 그대로) · 끝 장면 = 포스터 = 방향 표시를 그리는 그림.
 *       guide = 끝 장면 위 좌표(%) — 붕대가 지나가는 길(점선 = 손바닥 쪽) · 시작(초록) · 끝(주황) · 표시(바퀴 수 · 확인할 곳).
 *       좌표는 끝 장면을 보고 잡았다 (scratchpad hw9/guides.py — 타원은 점으로 펼쳐 넣음). 영상을 다시 자르면 좌표도 다시 본다.
 *     → 화면: 한눈에 9칸(작은 사진 + 방향 + 짧은 글) → 누르면 상세(?step=N, 움직이는 사진 → 끝 장면에 방향이 그려짐 → 반복)
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

// ── 9단계 설명서 — 한눈에 9칸 · 누르면 상세(움직이는 사진 + 방향) ─────────────

/** 끝 장면 위 자리 — [가로 %, 세로 %] (왼손 기준 · 오른손은 가로를 뒤집는다) */
export type GuidePt = readonly [number, number];

/** 붕대가 지나가는 길 한 토막 — 점들을 매끈한 곡선으로 잇는다 */
export interface GuideSeg {
  pts: readonly GuidePt[];
  /** 손바닥 쪽(안 보이는 쪽)으로 지나가는 길 — 점선 */
  back?: boolean;
}

/** 점 + 글 — side: 글을 점의 오른쪽(r) · 왼쪽(l) · 위(t) · 아래(b)에. lab 이 있으면 글을 그 자리에 두고 선으로 잇는다 */
export interface GuidePin {
  at: GuidePt;
  label: string;
  side?: "r" | "l" | "t" | "b";
  lab?: GuidePt;
}

export interface GuideMark extends GuidePin {
  /** count: 바퀴 수 · note: 짧은 말 · x: 손등 X 자리 · check: 확인할 곳 (초록 점) */
  kind: "count" | "note" | "x" | "check";
}

/** 방향 표시 — 끝 장면 위에 시작(초록) → 길(노랑 · 점선은 손바닥 쪽) → 끝(주황) */
export interface HandWrapGuideDraw {
  segs: readonly GuideSeg[];
  /** 앞 단계에서 이미 지나간 길 — 흐리게 (예: 손등 X 의 다른 한 줄) */
  ghost?: readonly GuideSeg[];
  start?: GuidePin;
  end?: GuidePin;
  marks?: readonly GuideMark[];
}

export interface HandWrapStep {
  title: string;
  /** 한눈에 9칸 — 사진 밑 짧은 설명 */
  short: string;
  /** 어디서 시작해서 → 어디로 (상세 화면 · 방향 표시의 시작 · 끝과 같은 말) */
  from: string;
  to: string;
  /** 자세한 설명 — 차례대로 한 줄씩 */
  how: readonly string[];
  /** 놓치기 쉬운 것 한 줄 (없으면 생략) */
  tip?: string;
  /** 감는 방향 한 줄 */
  dir: string;
  /** 그 단계를 처음부터 끝까지 실제로 감는 짧은 영상 (원본에서 잘라 냄, 소리 없음) — 끝나면 끝 장면에 방향을 그린다 */
  clip: string;
  /** 끝 장면(영상의 마지막 그림과 같음) — 포스터 · 방향 표시 바탕 · 움직임 줄이기 */
  image: string;
  /** 끝 장면 작은 사진 (360px) — 한눈에 9칸 */
  thumb: string;
  /** 영상을 보는 방향 — mine: 내 왼손을 내려다보는 방향 · side: 옆에서 */
  view: "mine" | "side";
  /** '이 장면 큰 영상으로 보기' — 어느 각도 영상의 몇 초 */
  video: { angle: HandWrapAngleKey; at: number };
  /** 끝 장면 위 방향 표시 */
  guide: HandWrapGuideDraw;
}

/** 단계 영상 · 사진 고친 판 — 영상을 다시 만들면 올린다. 폰이 4시간 동안 예전 파일을 그대로 쓰지 않게 (2026-10-27 9단계로 다시) */
const STEP_MEDIA_VERSION = "20261027-9";

/** 단계 영상 · 사진 주소 (public/handwrap/steps/stepNN.mp4 · .webp · _s.webp) */
const stepMedia = (n: number, view: HandWrapStep["view"] = "mine"): Pick<HandWrapStep, "clip" | "image" | "thumb" | "view"> => {
  const id = `step${String(n).padStart(2, "0")}`;
  const v = `?v=${STEP_MEDIA_VERSION}`;
  return { clip: `/handwrap/steps/${id}.mp4${v}`, image: `/handwrap/steps/${id}.webp${v}`, thumb: `/handwrap/steps/${id}_s.webp${v}`, view };
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
    short: "고리를 엄지에 걸고 손등 쪽으로 넘겨 손목으로",
    from: "엄지 (붕대 끝 고리)",
    to: "손목",
    how: ["붕대 끝 고리를 엄지에 걸어요.", "붕대를 손등 쪽으로 넘겨 손목까지 내려요.", "손가락은 쫙 편 채로 시작해요."],
    tip: "고리를 엄지에 걸어야 감는 동안 붕대가 빠지지 않아요.",
    dir: "엄지 고리 → 손등 쪽으로 넘겨 손목으로",
    ...stepMedia(1),
    video: { angle: "mine", at: 0 },
    guide: {
      segs: [{ pts: [[63, 46.5], [62.2, 55], [60.2, 64], [56.5, 72.5]] }],
      start: { at: [63, 45], label: "엄지에 고리", side: "r" },
      end: { at: [56, 73.5], label: "손목으로", side: "r" },
    },
  },
  {
    title: "손목 2~3바퀴",
    short: "손목을 단단히 2~3바퀴 — 손등에선 새끼 → 엄지 쪽",
    from: "손목 엄지 쪽",
    to: "한 바퀴 돌아 다시 엄지 쪽",
    how: [
      "손목 엄지 쪽에서 손바닥 쪽으로 돌려 감아요.",
      "손등 쪽에서는 새끼손가락 쪽 → 엄지 쪽으로 지나가요.",
      "2~3바퀴, 손목이 단단해질 만큼 감아요.",
    ],
    tip: "손목도 마디도 끝까지 같은 방향(손등에서 새끼 → 엄지 쪽)으로 감아요.",
    dir: "손등에서 새끼 → 엄지 쪽으로 2~3바퀴",
    ...stepMedia(2),
    video: { angle: "mine", at: 2.75 },
    guide: {
      segs: [
        { back: true, pts: [[63.2, 73.4], [62, 70.9], [58.1, 68.4], [52.5, 66.6], [46.8, 66], [42.5, 66.7], [40.8, 68.6]] },
        { pts: [[40.8, 68.6], [41.9, 71], [45.7, 73.5], [51, 75.3], [56.6, 76], [61, 75.5], [63.2, 73.8]] },
      ],
      start: { at: [63.2, 73.4], label: "엄지 쪽에서", side: "r" },
      marks: [{ at: [52, 86], label: "2~3바퀴", kind: "count" }],
    },
  },
  {
    title: "손등 대각선으로 마디까지",
    short: "손목 새끼 쪽에서 손등을 ↗ 대각선으로 검지 마디까지",
    from: "손목 새끼손가락 쪽",
    to: "검지 쪽 주먹 마디",
    how: ["손목의 새끼손가락 쪽에서 출발해요.", "손등을 대각선으로 올라가(↗) 검지 쪽 주먹 마디까지 가요."],
    tip: "이 대각선이 5단계에서 손등 X자의 한 줄이 돼요.",
    dir: "손목 새끼 쪽에서 ↗ 대각선으로 검지 마디까지",
    ...stepMedia(3),
    video: { angle: "mine", at: 5.75 },
    guide: {
      segs: [{ pts: [[37, 66.5], [44, 62.5], [51, 58.5], [57.5, 55]] }],
      start: { at: [36.5, 67], label: "손목 새끼 쪽", side: "l" },
      end: { at: [58, 54.5], label: "검지 마디", side: "t" },
    },
  },
  {
    title: "손가락 펴고 마디 3~4바퀴",
    short: "손가락을 쫙 펴고 주먹 마디를 3~4바퀴",
    from: "검지 마디",
    to: "마디를 한 바퀴씩 3~4바퀴",
    how: [
      "손가락을 쫙 편 채로 주먹 마디(손가락 뿌리 관절)를 감아요.",
      "손바닥 쪽으로 돌아 손등 쪽에서는 새끼 → 엄지 쪽으로 지나가요.",
      "3~4바퀴 감아 마디를 두툼하게 덮어요.",
    ],
    tip: "손가락을 오므리고 감으면 주먹을 쥘 때 너무 조여요.",
    dir: "손가락 쫙 — 마디를 새끼 → 엄지 쪽으로 3~4바퀴",
    ...stepMedia(4),
    video: { angle: "mine", at: 7.05 },
    guide: {
      segs: [
        { back: true, pts: [[72.8, 73.5], [72.3, 70.1], [68.9, 65.1], [63.5, 59.8], [57.6, 55.6], [52.8, 53.6], [50.2, 54.5]] },
        { pts: [[50.2, 54.5], [50.7, 57.7], [53.9, 62.6], [59, 67.8], [64.8, 72.1], [69.7, 74.3], [72.6, 73.8]] },
      ],
      start: { at: [72.8, 73.5], label: "검지 마디에서", side: "b" },
      marks: [
        { at: [37, 46], label: "3~4바퀴", kind: "count" },
        { at: [80, 40], label: "손가락 쫙", kind: "note" },
      ],
    },
  },
  {
    title: "대각선으로 손목까지 · 손등 X",
    short: "마디 새끼 쪽에서 ↘ 대각선으로 손목 엄지 쪽 — 손등에 X자",
    from: "마디 새끼손가락 쪽",
    to: "손목 엄지 쪽",
    how: [
      "마디를 다 감았으면 새끼손가락 쪽 마디에서 출발해요.",
      "손등을 대각선으로 내려와(↘) 손목 엄지 쪽으로 가요.",
      "3단계에서 올라간 대각선과 겹쳐 손등에 X자가 생겨요.",
    ],
    tip: "주먹을 한 번 쥐어 마디가 두툼하게 다 덮였는지 봐요.",
    dir: "마디 새끼 쪽에서 ↘ 대각선으로 손목 엄지 쪽 (손등에 X자)",
    ...stepMedia(5),
    video: { angle: "mine", at: 12.9 },
    guide: {
      ghost: [{ pts: [[47, 84], [57.5, 70.5], [68, 57]] }],
      segs: [{ pts: [[42, 57], [49.5, 66], [57, 75], [63.8, 82.8]] }],
      start: { at: [41.5, 56.5], label: "마디 새끼 쪽", side: "l" },
      end: { at: [64, 83.5], label: "손목 엄지 쪽", side: "r" },
      marks: [{ at: [55.6, 73], label: "X", kind: "x" }],
    },
  },
  {
    title: "손가락 사이로 넣기",
    short: "손등을 따라 올라가 손가락 사이로 넣고 엄지·검지 사이로 빼기",
    from: "손목 (손등 쪽)",
    to: "엄지와 검지 사이",
    how: [
      "손목에서 손등을 따라 올라가 새끼손가락 쪽 손가락 사이로 붕대를 넣어요.",
      "손바닥 쪽으로 넘어간 붕대는 손바닥을 돌아 엄지와 검지 사이로 빼요.",
      "그림의 점선은 손바닥 쪽(안 보이는 쪽)으로 지나가는 길이에요.",
    ],
    tip: "붕대가 꼬이지 않게 평평하게 펴서 넣어요.",
    dir: "손등에서 손가락 사이로 넣어 손바닥을 돌아 엄지·검지 사이로",
    ...stepMedia(6),
    video: { angle: "mine", at: 15.55 },
    guide: {
      segs: [
        { pts: [[48, 82], [47, 68], [45.5, 52], [44.6, 40]] },
        { back: true, pts: [[44.6, 40], [50, 47], [56, 53], [61, 57.5]] },
      ],
      start: { at: [48, 83], label: "손목에서", side: "l" },
      end: { at: [61.5, 58], label: "엄지·검지 사이", side: "r" },
    },
  },
  {
    title: "손목 한 바퀴 → 다음 칸",
    short: "칸을 지날 때마다 손목 한 바퀴, 그리고 다음 손가락 사이로",
    from: "엄지와 검지 사이",
    to: "다음 손가락 사이",
    how: [
      "엄지와 검지 사이로 나온 붕대로 손목을 한 바퀴 감아 고정해요 (손등에서 새끼 → 엄지 쪽).",
      "다시 손등을 따라 올라가 옆 칸(다음 손가락 사이)으로 넣어요.",
      "손가락 사이를 모두 지날 때까지 6 → 7단계를 되풀이해요.",
    ],
    tip: "칸을 하나 지날 때마다 손목을 한 바퀴 감아야 붕대가 밀리지 않아요.",
    dir: "손가락 사이 한 칸 → 손목 한 바퀴 → 다음 칸",
    ...stepMedia(7),
    video: { angle: "mine", at: 16.9 },
    guide: {
      segs: [
        { pts: [[61, 63], [60.5, 71], [59, 81.4]] },
        { back: true, pts: [[59, 81.4], [57.7, 79.5], [54.2, 77.8], [49.2, 76.8], [44.2, 76.8], [40.5, 77.8], [39, 79.6]] },
        { pts: [[39, 79.6], [40.3, 81.5], [43.8, 83.2], [48.8, 84.2], [53.8, 84.2], [57.5, 83.2], [59, 81.4]] },
        { pts: [[59, 81.4], [55, 69], [51.5, 52], [50, 34]] },
      ],
      start: { at: [61.5, 62], label: "엄지·검지 사이", side: "r" },
      end: { at: [50, 32], label: "다음 칸으로", side: "l" },
      marks: [{ at: [23, 70], label: "손목 한 바퀴", kind: "count" }],
    },
  },
  {
    title: "남은 붕대는 손목 · 벨크로",
    short: "남은 붕대는 손목에 다 감고, 벨크로는 손목 바깥쪽",
    from: "남은 붕대",
    to: "손목 바깥쪽 벨크로",
    how: ["남은 붕대는 손목에 전부 감아요.", "벨크로(찍찍이)는 손목 바깥쪽(손등 쪽)에 꾹 눌러 붙여요."],
    tip: "벨크로가 손바닥 쪽에 있으면 장갑 안에서 쓸려요.",
    dir: "남은 붕대는 손목에 다 감고 · 벨크로는 손목 바깥쪽(손등 쪽)",
    ...stepMedia(8, "side"),
    video: { angle: "side", at: 37.1 },
    guide: {
      segs: [
        { back: true, pts: [[63.2, 86], [66.4, 83.6], [70.7, 74.9], [74.9, 62.2], [78, 48.9], [79.1, 38.6], [77.8, 34]] },
        { pts: [[77.8, 34], [74.7, 36.3], [70.5, 44.7], [66.3, 57], [63.2, 70.1], [61.9, 80.6], [62.9, 85.8]] },
      ],
      end: { at: [71, 60], label: "벨크로: 손목 바깥쪽", lab: [50, 91] },
      marks: [{ at: [79, 16], label: "남은 붕대 → 손목", kind: "count" }],
    },
  },
  {
    title: "주먹 쥐어 확인",
    short: "쥐었다 폈다 — 저리거나 하얘지면 풀고 다시",
    from: "편 손",
    to: "주먹",
    how: [
      "주먹을 쥐었다 폈다 해 봐요.",
      "마디 위가 두툼하고, 손등에 X자, 손가락 사이에 붕대 줄이 보이면 잘 감은 거예요.",
      "손끝이 저리거나 하얘지면 풀고 다시 감아요.",
    ],
    tip: "너무 느슨하지도, 너무 꽉 조이지도 않게 — 여러 번 감아 보면 금방 늘어요.",
    dir: "쥐었다 폈다 — 마디 두툼 · 손등 X자 · 손목 단단",
    ...stepMedia(9),
    video: { angle: "mine", at: 41.5 },
    guide: {
      segs: [],
      marks: [
        { at: [51, 57], label: "마디 위 두툼", kind: "check", lab: [80, 46] },
        { at: [47, 70], label: "손등 X자", kind: "check", lab: [80, 62] },
        { at: [42, 87], label: "손목 단단", kind: "check", lab: [77, 82] },
      ],
    },
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
  "손가락 사이사이로 넣어 엄지·검지 사이로 — 한 칸 지날 때마다 손목 한 바퀴",
  "남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 주먹 쥐어 확인",
];

/** 상세 화면 '이 단계 다시 보기' 주소 — /handwrap?step=N (1부터) */
export const handWrapStepParam = (raw: string | null): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= HANDWRAP_STEPS.length ? n - 1 : null;
};
