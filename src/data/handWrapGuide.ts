/**
 * 🥊 붕대 감기 가이드 — 12단계 사진 설명서(사진 위 방향 표시 + 사진마다 밑에 설명) · 흔한 실수 · 핵심 포인트.
 *
 *   지난 길: 2026-10-13 그림 8단계 → 10-15~16 사진 · 그림 13단계 → 10-17 대표님 "2가지 방식 모두 지워줘" →
 *     10-20 대표님 영상(옆에서 · 앞에서) + 단계 사진 → 10-27 실제로 감는 장면 9단계 설명서(끝 장면 위에 방향 좌표를 그림).
 *
 *   2026-10-30 대표님: 체육관에 붙어 있는 코팅 설명서(12단계 + 완성된 모습) 사진을 보내며
 *     "이사진이랑 동일하게 붕대 감기 탭에 고화질 애니메이션으로 제작해서 넣어줘" → 12단계 그림 애니메이션을 만들었더니
 *     "일러스트 애니메이션 그림이 좀 별로야 · 사진 고화질로 만들고 방향 알려주는 버전 · 밑에 설명까지 · 각 그림마다 설명"
 *     → 사진 설명서로: 사진마다 시작(초록) → 붕대 길(노랑 · 흰 점선 = 손바닥 쪽) → 끝(주황)이 그려지고(HandWrapGuideDraw),
 *       사진 밑에 설명서 글 · 시작 → 끝 · 자세한 설명 · 팁이 모두 보인다(줄이지 않음). 그림 애니메이션 파일은 지웠다.
 *     → 사진: 대표님이 체육관에서 12단계를 새로 찍어 주시기로(10-30). 그동안은 코팅 설명서 사진을 가볍게 정리해
 *       임시로 쓴다(8번은 AI 복원 시험본). 새 사진이 오면 public/handwrap/photos/pNN.webp 를 바꾸고
 *       guide 좌표를 새 사진을 보고 다시 잡고 STEP_MEDIA_VERSION 을 올린다.
 *     → 위 큰 영상(대표님 10-20 영상 '영상으로 보기')은 화면에서 내렸다. 파일(public/handwrap/front · side)은 되살리기 쉽게 남겨 둠.
 *
 *   설명서 속 방법(오른손 손등을 내려다보면 엄지가 왼쪽): 엄지에 걸기 → 손목 감기 → 손등을 ↗ 대각선으로 지나 정권(주먹 마디) →
 *     정권 감기 → ↘ 대각선으로 다시 손목(손등 X자) → 손목 한 바퀴 → 새끼 쪽 손가락 사이로 넣어 손바닥을 건너 엄지·검지 사이로 →
 *     넘어와 손목 감기 → 다음 손가락 사이로 같은 방법(한 칸마다 손목 한 바퀴) → 마지막 칸 → 남은 붕대는 손목에 → 완성.
 *     손등에서는 처음부터 끝까지 엄지 쪽 → 새끼 쪽으로 지나간다.
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 설명서를 보며 직접 감는다.
 *   그다음 '집에서 혼자 감아 보기' 미션 — 목표 일수·보상 숫자는 DB 함수가 정본이다
 *   (handwrap_practice_goal · handwrap_practice_reward → get_my_handwrap_practice 가 돌려준다). 여기에 숫자를 적지 않는다.
 *
 *   훈련 라이브러리 '준비' 칸의 '복싱 붕대 감기' 항목에 코치·관장이 영상 주소를 넣으면 '코치 영상 보기' 단추가 붙는다.
 */
/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

/** 어느 손을 감을 때 보나 — 왼손은 사진을 거울로 뒤집어 보여 준다 (사진 속에 글자가 없어서 괜찮다) */
export type HandSide = "left" | "right";

/** 처음 보는 사람은 오른손부터 (설명서 사진이 오른손) */
export const HANDWRAP_DEFAULT_HAND: HandSide = "right";

// ── 사진 위 방향 표시 ─────────────────────────────

/** 사진 위 자리 — [가로 %, 세로 %] (오른손 사진 기준 · 왼손은 가로를 뒤집는다) */
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

/** 방향 표시 — 사진 위에 시작(초록) → 길(노랑 · 점선은 손바닥 쪽) → 끝(주황) */
export interface HandWrapGuideDraw {
  segs: readonly GuideSeg[];
  /** 앞 단계에서 이미 지나간 길 — 흐리게 (예: 손등 X 의 다른 한 줄) */
  ghost?: readonly GuideSeg[];
  start?: GuidePin;
  end?: GuidePin;
  marks?: readonly GuideMark[];
}

export interface HandWrapStep {
  /** 번호 대신 '완성'으로 보이는 마지막 칸 (코팅 설명서의 '완성된 모습') */
  final?: boolean;
  title: string;
  /** 코팅 설명서 사진 밑 글 그대로 */
  sheet: string;
  /** 짧은 설명 한 줄 (사진 아래 맨 위) */
  short: string;
  /** 어디서 시작해서 → 어디로 (사진의 초록 점 → 주황 점과 같은 말) */
  from: string;
  to: string;
  /** 자세한 설명 — 차례대로 한 줄씩 */
  how: readonly string[];
  /** 놓치기 쉬운 것 한 줄 (없으면 생략) */
  tip?: string;
  /** 감는 방향 한 줄 */
  dir: string;
  /** 사진(4:3, 오른손) — public/handwrap/photos/pNN.webp */
  image: string;
  /** 사진 위 방향 표시 */
  guide: HandWrapGuideDraw;
  /** 더 보여 줄 사진 (완성 — 주먹 · 손가락 편 모습) */
  extras?: ReadonlyArray<{ image: string; label: string }>;
}

/** 사진 고친 판 — 사진을 바꾸면 올린다. 폰이 예전 파일을 그대로 쓰지 않게 (2026-10-30 설명서 사진 임시판) */
export const STEP_MEDIA_VERSION = "20261030-p1";

/** 사진 주소 (public/handwrap/photos/pNN.webp) */
const photo = (n: number): string => `/handwrap/photos/p${String(n).padStart(2, "0")}.webp?v=${STEP_MEDIA_VERSION}`;

/** 사진을 보는 방향 */
export const HANDWRAP_VIEW_NOTE: Record<HandSide, string> = {
  right: "내 오른손을 내려다본 모습이에요 (엄지가 왼쪽)",
  left: "왼손은 사진을 거울로 뒤집어 보여 줘요 (엄지가 오른쪽)",
};

/** 글 속 대각선 화살표는 오른손 기준 — 왼손이면 좌우를 바꾼다 (↗ ↔ ↖ · ↘ ↔ ↙) */
export const mirrorArrows = (text: string): string =>
  text.replace(/[↗↖↘↙]/g, (c) => ({ "↗": "↖", "↖": "↗", "↘": "↙", "↙": "↘" })[c] ?? c);

// ── 사진마다 방향 좌표 (사진 위 %, 오른손) — 사진을 바꾸면 새 사진을 보고 다시 잡는다 ─────────────
// 2026-10-30 임시판: 코팅 설명서 사진(가로 4:3 칸에 맞춰 양옆을 채움) 위에 잡았다.
// 사진 위 왼쪽 위 = 번호 · 오른쪽 위 = '크게' 자리 — 위쪽 글(note · count)은 가로 30~65% 에 두어 왼손(거울)에서도 겹치지 않게.

const G1: HandWrapGuideDraw = {
  segs: [{ pts: [[31, 72], [50, 76], [70, 82], [90, 88]] }],
  start: { at: [30, 71], label: "엄지 고리", side: "t" },
  end: { at: [88, 87], label: "손목 새끼 쪽", side: "l" },
};
const G2: HandWrapGuideDraw = {
  segs: [
    { pts: [[67, 60], [79, 55], [92, 59]] },
    { back: true, pts: [[92, 59], [88, 75], [76, 80], [66, 70]] },
  ],
  start: { at: [67, 60], label: "엄지 쪽에서", side: "l" },
  marks: [{ at: [80, 93], label: "3바퀴", kind: "count" }],
};
const G3: HandWrapGuideDraw = {
  segs: [{ pts: [[60, 88], [65, 64], [68, 40], [66, 16]] }],
  start: { at: [60, 88], label: "손목 엄지 쪽", side: "l" },
  end: { at: [66, 16], label: "새끼 쪽 정권", side: "l" },
};
const G4: HandWrapGuideDraw = {
  segs: [
    { back: true, pts: [[72, 33], [66, 50], [50, 62], [33, 62]] },
    { pts: [[33, 57], [52, 46], [72, 34]] },
  ],
  start: { at: [72, 33], label: "새끼 쪽 정권", side: "b" },
  marks: [
    { at: [60, 20], label: "3바퀴", kind: "count" },
    { at: [34, 8], label: "손가락 쫙", kind: "note" },
  ],
};
const G5: HandWrapGuideDraw = {
  ghost: [{ pts: [[42, 95], [52, 62], [60, 32]] }],
  segs: [
    { back: true, pts: [[50, 30], [38, 44], [27, 40]] },
    { pts: [[27, 40], [45, 50], [63, 58], [80, 64]] },
  ],
  start: { at: [50, 30], label: "정권에서", side: "t" },
  end: { at: [80, 64], label: "손목 새끼 쪽", side: "b" },
  marks: [{ at: [52, 53], label: "X", kind: "x" }],
};
const G6: HandWrapGuideDraw = {
  segs: [
    { pts: [[57, 73], [72, 70], [88, 74]] },
    { back: true, pts: [[88, 74], [84, 86], [70, 89], [57, 82]] },
  ],
  start: { at: [57, 73], label: "손목", side: "l" },
  marks: [{ at: [40, 10], label: "손목 한 바퀴", kind: "count" }],
};
const G7: HandWrapGuideDraw = {
  segs: [{ pts: [[50, 86], [56, 64], [63, 42]] }],
  start: { at: [50, 86], label: "손목 엄지 쪽", side: "l" },
  end: { at: [63, 42], label: "새끼·약지 사이", side: "r" },
};
const G8: HandWrapGuideDraw = {
  segs: [{ pts: [[27, 57], [45, 55], [62, 49], [78, 43]] }],
  start: { at: [27, 57], label: "새끼·약지 사이", side: "b" },
  end: { at: [78, 43], label: "엄지·검지 사이", side: "t" },
  marks: [{ at: [40, 8], label: "손바닥 쪽", kind: "note" }],
};
const G9: HandWrapGuideDraw = {
  segs: [{ pts: [[28, 47], [42, 60], [60, 70], [82, 66]] }],
  start: { at: [28, 47], label: "엄지·검지 사이", side: "t" },
  end: { at: [82, 66], label: "손목 새끼 쪽", side: "t" },
  marks: [{ at: [62, 92], label: "손목 한 바퀴", kind: "count" }],
};
const G10: HandWrapGuideDraw = {
  segs: [
    { pts: [[60, 88], [63, 62], [66, 38]] },
    { back: true, pts: [[66, 38], [58, 44], [51, 50]] },
  ],
  start: { at: [60, 88], label: "손목 엄지 쪽", side: "r" },
  end: { at: [51, 50], label: "엄지·검지 사이", side: "l" },
  marks: [{ at: [42, 8], label: "약지·중지 사이로", kind: "note" }],
};
const G11: HandWrapGuideDraw = {
  segs: [{ pts: [[24, 42], [42, 56], [62, 70], [84, 82]] }],
  start: { at: [24, 42], label: "엄지·검지 사이", side: "t" },
  end: { at: [84, 82], label: "손목 새끼 쪽", side: "t" },
  marks: [{ at: [26, 90], label: "손목 한 바퀴", kind: "count" }],
};
const G12: HandWrapGuideDraw = {
  segs: [{ pts: [[47, 33], [45, 56], [43, 80]] }],
  start: { at: [47, 33], label: "중지·검지 사이", side: "r" },
  end: { at: [43, 82], label: "남은 붕대 손목에", side: "r" },
  marks: [{ at: [78, 92], label: "벨크로는 바깥쪽", kind: "note" }],
};
const G13: HandWrapGuideDraw = {
  segs: [],
  marks: [
    { at: [38, 38], label: "정권 두툼", kind: "check", lab: [22, 18] },
    { at: [48, 55], label: "손등 X자", kind: "check", lab: [80, 42] },
    { at: [58, 76], label: "손목 단단", kind: "check", lab: [82, 70] },
  ],
};

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "엄지에 걸기",
    sheet: "엄지손가락에 걸어주세요",
    short: "붕대 끝 고리를 엄지에 걸고 손등 쪽으로 손목을 가로질러요",
    from: "엄지 (붕대 끝 고리)",
    to: "손목 새끼손가락 쪽",
    how: [
      "손가락을 쫙 펴고 손등이 위로 오게 해요.",
      "붕대 끝 고리를 엄지에 걸어요.",
      "붕대를 손등 쪽으로 넘겨 손목을 가로질러요 (엄지 쪽 → 새끼 쪽).",
    ],
    tip: "고리를 엄지에 걸어야 감는 동안 붕대가 빠지지 않아요.",
    dir: "엄지 고리 → 손등 쪽으로 손목을 가로질러 새끼 쪽",
    image: photo(1),
    guide: G1,
  },
  {
    title: "손목 감기",
    sheet: "손목을 지나 손등 위 바퀴",
    short: "손목을 3바퀴 — 손등에서는 엄지 → 새끼 쪽으로",
    from: "손목 새끼손가락 쪽",
    to: "손목 3바퀴",
    how: [
      "손바닥 쪽으로 돌려 손목을 감아요.",
      "손등에서는 늘 엄지 쪽 → 새끼 쪽으로 지나가요.",
      "3바퀴, 손목이 단단해질 만큼 감아요.",
    ],
    tip: "처음부터 끝까지 같은 방향으로 감아요 — 손등에서 엄지 → 새끼 쪽.",
    dir: "손등에서 엄지 → 새끼 쪽으로 손목 3바퀴",
    image: photo(2),
    guide: G2,
  },
  {
    title: "손등 지나 정권으로",
    sheet: "손등을 지나 정권부위로",
    short: "손목 엄지 쪽에서 손등을 ↗ 대각선으로 새끼 쪽 정권까지",
    from: "손목 엄지 쪽",
    to: "새끼 쪽 정권 (주먹 마디)",
    how: [
      "손목 아래(손바닥 쪽)로 돌아 엄지 쪽으로 나와요.",
      "손등을 대각선으로 올라가(↗) 새끼손가락 쪽 정권(주먹 마디)까지 가요.",
    ],
    tip: "이 대각선이 5단계에서 손등 X자의 한 줄이 돼요.",
    dir: "손목 엄지 쪽에서 ↗ 대각선으로 새끼 쪽 정권까지",
    image: photo(3),
    guide: G3,
  },
  {
    title: "정권 감기",
    sheet: "정권부위 위 바퀴",
    short: "손가락을 쫙 펴고 정권(주먹 마디)을 3바퀴",
    from: "새끼 쪽 정권",
    to: "정권 3바퀴",
    how: [
      "새끼 쪽 정권에서 손바닥 쪽으로 넘어가 마디를 감아요.",
      "손등에서는 엄지 쪽 → 새끼 쪽으로 지나가요.",
      "손가락을 쫙 편 채로 3바퀴 감아 마디를 두툼하게 덮어요.",
    ],
    tip: "손가락을 오므리고 감으면 주먹을 쥘 때 너무 조여요.",
    dir: "손가락 쫙 — 정권을 엄지 → 새끼 쪽으로 3바퀴",
    image: photo(4),
    guide: G4,
  },
  {
    title: "다시 손목으로",
    sheet: "다시 손목으로",
    short: "검지 쪽 정권에서 ↘ 대각선으로 손목 새끼 쪽 — 손등에 X자",
    from: "검지 쪽 정권",
    to: "손목 새끼손가락 쪽",
    how: [
      "정권을 다 감았으면 손바닥 쪽으로 돌아 검지 쪽 정권으로 나와요.",
      "손등을 대각선으로 내려와(↘) 손목 새끼 쪽으로 가요.",
      "3단계에서 올라간 대각선과 겹쳐 손등에 X자가 생겨요.",
    ],
    tip: "주먹을 한 번 쥐어 마디가 두툼하게 다 덮였는지 봐요.",
    dir: "검지 쪽 정권에서 ↘ 대각선으로 손목 새끼 쪽 (손등에 X자)",
    image: photo(5),
    guide: G5,
  },
  {
    title: "손목 한 바퀴",
    sheet: "한바퀴 감고",
    short: "손목을 한 바퀴 감아 X자를 고정해요",
    from: "손목 새끼손가락 쪽",
    to: "손목 한 바퀴",
    how: ["손목을 한 바퀴 더 감아 손등 X자를 고정해요.", "손등에서는 그대로 엄지 쪽 → 새끼 쪽이에요."],
    dir: "손목 한 바퀴 (손등에서 엄지 → 새끼 쪽)",
    image: photo(6),
    guide: G6,
  },
  {
    title: "새끼 쪽 손가락 사이로",
    sheet: "새끼와 엄지 사이 통과",
    short: "손등을 따라 올라가 새끼·약지 사이로 붕대를 넣어요",
    from: "손목 엄지 쪽",
    to: "새끼·약지 사이",
    how: [
      "손목 아래(손바닥 쪽)로 돌아 엄지 쪽으로 나와요.",
      "손등을 따라 올라가 새끼손가락과 약지 사이로 붕대를 넣어요.",
      "넣은 붕대는 손바닥 쪽으로 넘어가요 — 다음 단계에서 엄지 쪽으로 빼요.",
    ],
    tip: "붕대가 꼬이지 않게 평평하게 펴서 넣어요.",
    dir: "손목 엄지 쪽 → 손등을 따라 새끼·약지 사이로",
    image: photo(7),
    guide: G7,
  },
  {
    title: "손바닥 건너 엄지 사이로",
    sheet: "통과한 붕대를 손가락 사이로",
    short: "손바닥 쪽으로 넘어간 붕대를 엄지·검지 사이로 빼요",
    from: "새끼·약지 사이",
    to: "엄지·검지 사이",
    how: [
      "손을 뒤집어 보면 새끼·약지 사이로 넘어온 붕대가 손바닥을 건너요.",
      "엄지와 검지 사이로 붕대를 빼서 손등 쪽으로 나와요.",
      "이 사진은 손을 뒤집어 손바닥 쪽에서 본 모습이에요.",
    ],
    tip: "손바닥을 건널 때 붕대를 펴서 지나가면 주먹 쥘 때 걸리지 않아요.",
    dir: "새끼·약지 사이 → 손바닥을 건너 → 엄지·검지 사이",
    image: photo(8),
    guide: G8,
  },
  {
    title: "넘어와 손목 감기",
    sheet: "넘어와 손목 감고",
    short: "엄지·검지 사이에서 ↘ 대각선으로 내려와 손목 한 바퀴",
    from: "엄지·검지 사이",
    to: "손목 한 바퀴",
    how: [
      "엄지·검지 사이로 나온 붕대를 손등으로 넘겨요.",
      "손등을 대각선으로 내려와(↘) 손목 새끼 쪽으로 가요.",
      "손목을 한 바퀴 감아 고정해요.",
    ],
    tip: "손가락 사이를 하나 지날 때마다 손목을 한 바퀴 감아야 붕대가 밀리지 않아요.",
    dir: "엄지·검지 사이 → ↘ 대각선으로 손목 → 한 바퀴",
    image: photo(9),
    guide: G9,
  },
  {
    title: "다음 손가락 사이로",
    sheet: "새끼와 엄지 통과",
    short: "약지·중지 사이로 넣어 손바닥을 건너 엄지·검지 사이로",
    from: "손목 엄지 쪽",
    to: "엄지·검지 사이",
    how: [
      "손목 아래로 돌아 엄지 쪽으로 나와 손등을 따라 올라가요.",
      "이번에는 약지와 중지 사이로 붕대를 넣어요.",
      "손바닥을 건너 엄지·검지 사이로 빼요 (사진의 흰 점선 = 손바닥 쪽으로 지나가는 길).",
    ],
    dir: "손등을 따라 약지·중지 사이로 → 손바닥을 건너 엄지·검지 사이",
    image: photo(10),
    guide: G10,
  },
  {
    title: "한 번 더 — 손목",
    sheet: "한번 더 동일",
    short: "9단계처럼 ↘ 대각선으로 내려와 손목 한 바퀴",
    from: "엄지·검지 사이",
    to: "손목 한 바퀴",
    how: ["엄지·검지 사이로 나온 붕대를 손등으로 넘겨요.", "손등을 대각선으로 내려와(↘) 손목을 한 바퀴 감아요."],
    dir: "엄지·검지 사이 → ↘ 대각선으로 손목 → 한 바퀴",
    image: photo(11),
    guide: G11,
  },
  {
    title: "마지막 사이 · 남은 붕대는 손목에",
    sheet: "새끼와 엄지 통과",
    short: "중지·검지 사이까지 지나고 남은 붕대는 손목에 다 감아요",
    from: "손목 엄지 쪽",
    to: "손목 (남은 붕대)",
    how: [
      "손등을 따라 올라가 마지막으로 중지와 검지 사이로 넣어요.",
      "손바닥을 건너 엄지·검지 사이로 빼고, ↘ 대각선으로 손목까지 내려와요.",
      "남은 붕대는 손목에 다 감고, 벨크로(찍찍이)는 손목 바깥쪽(손등 쪽)에 붙여요.",
    ],
    tip: "벨크로가 손바닥 쪽에 있으면 장갑 안에서 쓸려요.",
    dir: "중지·검지 사이 → 손바닥을 건너 엄지 사이 → ↘ 손목에 남은 붕대 다",
    image: photo(12),
    guide: G12,
  },
  {
    final: true,
    title: "완성된 모습",
    sheet: "완성된 모습",
    short: "손등 X자 · 손가락 사이 세 줄 · 정권 두툼 — 뒤집어 손바닥도 확인",
    from: "손등",
    to: "손바닥 (뒤집어 확인)",
    how: [
      "손등: 정권이 두툼하게 덮이고, X자와 손가락 사이로 지나간 줄 세 개가 보여요.",
      "손바닥: 손가락 사이에서 엄지·검지 사이로 건너간 붕대가 보여요.",
      "주먹을 쥐었다 폈다 — 손끝이 저리거나 하얘지면 풀고 다시 감아요.",
    ],
    tip: "너무 느슨하지도, 너무 꽉 조이지도 않게 — 여러 번 감아 보면 금방 늘어요.",
    dir: "손등 X자 · 손가락 사이 세 줄 · 정권 두툼 · 손목 단단",
    image: photo(13),
    guide: G13,
    extras: [
      { image: photo(14), label: "주먹 쥔 모습" },
      { image: photo(15), label: "손가락 편 모습" },
    ],
  },
];

/** 번호 칸 이름 — 완성은 번호 대신 '완성' */
export const handWrapStepLabel = (i: number): string => (HANDWRAP_STEPS[i]?.final ? "완성" : `${i + 1}단계`);

/** 번호가 붙는 단계 수 (완성 빼고) */
export const HANDWRAP_NUMBERED_STEPS = HANDWRAP_STEPS.filter((s) => !s.final).length;

// ── 흔한 실수 · 핵심 포인트 ─────────────────────────────

export interface HandWrapMistake {
  wrong: string;
  fix: string;
}

export const HANDWRAP_MISTAKES: readonly HandWrapMistake[] = [
  { wrong: "고리를 엄지에 안 걸고 시작해요", fix: "고리를 엄지에 걸어야 감는 동안 붕대가 빠지지 않고 처음 자리가 잡혀요." },
  { wrong: "손가락을 오므리고 정권을 감아요", fix: "손가락을 쫙 펴고 감아야 주먹을 쥐었을 때 너무 조이지 않아요." },
  { wrong: "손가락 사이를 지나고 손목을 안 감아요", fix: "손가락 사이를 하나 지날 때마다 손목을 한 바퀴 감아야 붕대가 밀리지 않아요." },
  { wrong: "있는 힘껏 세게 감아요", fix: "손끝이 저리거나 하얘지면 바로 풀고 다시 — 너무 느슨하지도, 너무 꽉 조이지도 않게." },
  { wrong: "벨크로를 손목 안쪽(손바닥 쪽)에 붙여요", fix: "벨크로는 손목 바깥쪽(손등 쪽)에 붙여야 장갑 안에서 쓸리지 않아요." },
  { wrong: "붕대가 꼬이거나 주름진 채로 감아요", fix: "붕대를 평평하게 펴면서 감고, 손가락 사이로 넣을 때도 펴서 넣어요." },
];

/** 코치 영상 플레이어 아래 '핵심 포인트' — 12단계 설명서와 같은 순서 */
export const HANDWRAP_KEY_POINTS: readonly string[] = [
  "엄지에 걸기 → 손목 3바퀴 (손등에서 엄지 → 새끼 쪽, 끝까지 같은 방향)",
  "손등을 대각선으로 올라가 정권(주먹 마디) → 손가락 쫙 펴고 정권 3바퀴 → 대각선으로 내려와 손목 (손등에 X자) → 손목 한 바퀴",
  "새끼 쪽부터 손가락 사이로 넣어 손바닥을 건너 엄지·검지 사이로 — 한 칸 지날 때마다 손목 한 바퀴",
  "남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 주먹 쥐어 확인",
];

/** 상세 주소 — /handwrap?step=N (1부터, 마지막 = 완성) */
export const handWrapStepParam = (raw: string | null): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= HANDWRAP_STEPS.length ? n - 1 : null;
};
