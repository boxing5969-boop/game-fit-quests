/**
 * 🥊 붕대 감기 가이드 — 대표님 영상(각도 2개) · 사진 10장 · 흔한 실수 · 영상 핵심 포인트.
 *
 *   2026-10-13: 처음 만듦 (그림 8단계). 2026-10-15~16: 사진 → 고화질 그림 → 주먹 패드 방법 13단계.
 *   2026-10-17 대표님: "2가지 방식 모두 지워줘. 내가 직접 영상 찍어서 올려야 할 것 같아" → 그림 단계를 지웠다.
 *   2026-10-20 대표님: "구글 드라이브에 오늘 날짜로 붕대 감는 동영상 올렸거든 — 앱에 적용해 주고 다양한 각도로
 *     회원님들이 쉽게 보고 배울 수 있도록. 그리고 한 장 한 장 사진과 설명으로, 영상이 어려운 분들은 그림을 보고 배울 수 있게"
 *     → 대표님이 찍은 영상 2개(DJI 2026-10-20 20:04 · 20:05)를 각도 2개로: '옆에서'(손등이 잘 보임) · '앞에서'(손가락 사이가 잘 보임).
 *       영상 파일은 public/handwrap/ (720p · 소리 그대로 · 마지막 카메라 끄는 장면만 잘라 냄),
 *       사진 10장은 같은 영상에서 뽑아 손 쪽으로 잘라 낸 것 (src/assets/handwrap/stepNN.webp).
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
import step01 from "@/assets/handwrap/step01.webp";
import step02 from "@/assets/handwrap/step02.webp";
import step03 from "@/assets/handwrap/step03.webp";
import step04 from "@/assets/handwrap/step04.webp";
import step05 from "@/assets/handwrap/step05.webp";
import step06 from "@/assets/handwrap/step06.webp";
import step07 from "@/assets/handwrap/step07.webp";
import step08 from "@/assets/handwrap/step08.webp";
import step09 from "@/assets/handwrap/step09.webp";
import step10 from "@/assets/handwrap/step10.webp";

/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

// ── 영상 — 같은 감기를 두 각도에서 ─────────────────────────────

export type HandWrapAngleKey = "side" | "front";

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
}

export const HANDWRAP_ANGLES: readonly HandWrapAngle[] = [
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
  /** 한두 문장 — 사진에서 보이는 것 그대로 */
  desc: string;
  /** 놓치기 쉬운 것 한 줄 (없으면 생략) */
  tip?: string;
  image: string;
  /** '이 장면 영상으로 보기' — 어느 각도 영상의 몇 초 */
  video: { angle: HandWrapAngleKey; at: number };
}

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "엄지에 고리 걸기",
    desc: "붕대 끝 고리를 엄지에 걸고, 붕대를 손등 쪽으로 넘겨 손목으로 가져가요.",
    image: step01,
    video: { angle: "side", at: 0 },
  },
  {
    title: "손목 감기",
    desc: "손목을 단단히 2~3바퀴 감아요. 손목이 꺾이지 않게 받쳐 주는 첫 기둥이에요.",
    image: step02,
    video: { angle: "side", at: 1.5 },
  },
  {
    title: "손등을 건너 주먹 마디로",
    desc: "손목에서 손등을 비스듬히 건너 주먹 마디 쪽으로 올라가요.",
    image: step03,
    video: { angle: "side", at: 4.5 },
  },
  {
    title: "손가락 펴고 마디 감기",
    desc: "손가락을 쫙 편 채로 주먹 마디를 감아요. 손등에 X자가 생겨요.",
    tip: "손가락을 오므리고 감으면 주먹을 쥘 때 너무 조여요.",
    image: step04,
    video: { angle: "side", at: 7.5 },
  },
  {
    title: "주먹 쥐어 마디 확인",
    desc: "주먹을 쥐어 마디가 두툼하게 다 덮였는지 봐요.",
    image: step05,
    video: { angle: "side", at: 10.5 },
  },
  {
    title: "손가락 사이사이로",
    desc: "손가락 사이로 붕대를 넣었다 빼요. 한 칸씩 차례로 지나가요.",
    image: step06,
    video: { angle: "front", at: 18.5 },
  },
  {
    title: "한 칸 지날 때마다 손목 한 바퀴",
    desc: "손가락 사이를 하나 지날 때마다 손목을 한 바퀴 감아 고정해요.",
    image: step07,
    video: { angle: "side", at: 23.5 },
  },
  {
    title: "다 감은 모양",
    desc: "손가락 사이에 붕대 줄이 보이고, 마디 위가 두툼하고, 손등에 X자가 있으면 잘 감은 거예요.",
    image: step08,
    video: { angle: "side", at: 33 },
  },
  {
    title: "남은 붕대는 손목에 · 벨크로",
    desc: "남은 붕대는 손목에 전부 감고, 벨크로는 손목 바깥쪽(손등 쪽)에 붙여요.",
    tip: "벨크로가 손바닥 쪽에 있으면 장갑 안에서 쓸려요.",
    image: step09,
    video: { angle: "side", at: 36.5 },
  },
  {
    title: "주먹 쥐어 확인",
    desc: "주먹을 쥐었다 폈다 해 봐요. 손끝이 저리거나 하얘지면 풀고 다시 감아요.",
    image: step10,
    video: { angle: "front", at: 42.5 },
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
  "엄지에 고리 → 손목 2~3바퀴",
  "손등을 건너 주먹 마디로 → 손가락 쫙 펴고 마디 감기 (손등에 X자)",
  "손가락 사이사이로 넣기 — 한 칸 지날 때마다 손목 한 바퀴",
  "남은 붕대는 손목에 → 벨크로는 손목 바깥쪽 → 주먹 쥐어 확인",
];
