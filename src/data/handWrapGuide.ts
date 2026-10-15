/**
 * 🥊 붕대 감기 가이드 — 153 표준 13단계 · 흔한 실수 · 영상 포인트.
 *
 *   2026-10-13: 처음 만듦 (그림 8단계).
 *   2026-10-15 대표님: "손 모양이 너무 AI 티가 나" → 그린 손 대신 실제 사진 + 감는 방향 화살표.
 *     153 표준 = 손목은 처음 2바퀴 → 그다음 손목을 지날 때마다 1바퀴 → 마지막은 손목에서 찍찍이(벨크로) 마무리.
 *     '엄지 잡아 주기' · '정권 한 번 더' 는 뺐다 (대표님 확정). 손목 합계 = 2 + 1 × 5 = 7바퀴.
 *     사진 = 대표님이 올린 단계 사진(12컷 + 완성)을 잘라 쓴 것 (src/assets/handwrap). 153 코치님 사진으로 바꾸면 화살표 좌표도 맞춘다.
 *   2026-10-15 대표님: "사진 화질이 안 좋아 — 애니메이션화해서 화질 좋게" → 같은 사진을 보고 다시 그린 고화질 그림(1080px)으로 교체,
 *     화살표 좌표도 새 그림에 맞춤. 완성 화면 = 주먹(step14) + 다 감은 손(step13).
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 이 화면을 보며 직접 감는다.
 *   그다음 '집에서 혼자 감아 보기' 미션 — 목표 일수·보상 숫자는 DB 함수가 정본이다
 *   (handwrap_practice_goal · handwrap_practice_reward → get_my_handwrap_practice 가 돌려준다). 여기에 숫자를 적지 않는다.
 *
 *   영상 = 훈련 라이브러리 '준비' 칸의 '복싱 붕대 감기' 항목 영상 URL (코치·관장이 수정 → 영상 URL, 유튜브 주소도 된다).
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
import step11 from "@/assets/handwrap/step11.webp";
import step12 from "@/assets/handwrap/step12.webp";
import step13 from "@/assets/handwrap/step13.webp";
import step14 from "@/assets/handwrap/step14.webp";

/** 훈련 라이브러리에서 영상을 찾는 이름 — DB 마이그레이션(handwrap_home_practice)이 이 이름으로 넣는다. 바꾸면 둘 다 */
export const HANDWRAP_EXERCISE_NAME = "복싱 붕대 감기";

/**
 * 사진 위 화살표 — 좌표계는 viewBox 0 0 120 98 (사진 가로:세로 = 120:98, 가운데 맞춤으로 덮는다).
 * d = 감는 길(끝에 화살촉), (sx, sy) = 시작점, (tx, ty, tr) = 붕대가 들어갈 곳(손가락 사이 등, 없으면 tr 0).
 */
export interface WrapArrow {
  d: string;
  sx: number;
  sy: number;
  tx?: number;
  ty?: number;
  tr?: number;
}

export interface HandWrapStep {
  title: string;
  body: string;
  /** 사진 아래 칩 (예: 손목 2바퀴 · 처음만) */
  chip?: string;
  photo: string;
  arrow: WrapArrow;
}

export const HANDWRAP_STEPS: readonly HandWrapStep[] = [
  {
    title: "엄지에 고리 걸기",
    body: "고리를 엄지에 걸고, 붕대를 손등 쪽으로 넘겨요. 붕대에 ‘THIS SIDE DOWN’ 표시가 있으면 그 면이 피부에 닿게 해요.",
    photo: step01,
    arrow: { d: "M60 53 Q86 56 106 70", sx: 60, sy: 53 },
  },
  {
    title: "손목 2바퀴",
    body: "손등을 지나 손목을 두 바퀴 감아 손목뼈를 덮어요. 단단하게, 손이 저리지 않게. 그다음부터 손목은 지날 때마다 1바퀴씩만 감아요.",
    chip: "손목 2바퀴 · 처음만",
    photo: step02,
    arrow: { d: "M68 80 Q96 92 114 78 Q118 62 106 52", sx: 68, sy: 80 },
  },
  {
    title: "손등 지나 정권으로",
    body: "손등 위를 비스듬히 올라가 주먹 마디(정권)로 가요.",
    photo: step03,
    arrow: { d: "M42 62 Q62 52 84 42", sx: 42, sy: 62 },
  },
  {
    title: "정권 3바퀴",
    body: "손가락을 쫙 편 채로 정권을 세 바퀴 감아요. 주먹을 쥐고 감으면 나중에 손이 조여요.",
    chip: "정권 3바퀴",
    photo: step04,
    arrow: { d: "M44 37 Q76 32 106 38", sx: 44, sy: 37 },
  },
  {
    title: "다시 손목으로",
    body: "손등을 반대 방향으로 비스듬히 내려와 손목으로 가요. 손등에 X자가 생겨요.",
    photo: step05,
    arrow: { d: "M68 34 Q60 54 48 76", sx: 68, sy: 34 },
  },
  {
    title: "손목 1바퀴",
    body: "손목을 한 바퀴만 감아요.",
    chip: "손목 1바퀴",
    photo: step06,
    arrow: { d: "M28 74 Q46 86 64 76 Q70 66 60 60", sx: 28, sy: 74 },
  },
  {
    title: "새끼–약지 사이 통과",
    body: "손목에서 손등을 지나 새끼손가락과 약지 사이로 넣어요.",
    photo: step07,
    arrow: { d: "M54 84 Q58 62 63 44", sx: 54, sy: 84, tx: 63, ty: 38, tr: 5 },
  },
  {
    title: "손바닥으로 넘기기",
    body: "통과한 붕대를 손바닥 쪽으로 넘겨요.",
    photo: step08,
    arrow: { d: "M56 38 Q76 40 96 44", sx: 56, sy: 38 },
  },
  {
    title: "넘어와 손목 1바퀴",
    body: "손바닥을 지나 손목으로 돌아와 한 바퀴 감아요.",
    chip: "손목 1바퀴",
    photo: step09,
    arrow: { d: "M24 72 Q40 82 58 72 Q62 64 56 58", sx: 24, sy: 72 },
  },
  {
    title: "약지–중지 사이 통과",
    body: "같은 방법으로 약지와 중지 사이로 넣어요.",
    photo: step10,
    arrow: { d: "M50 80 Q51 62 53 46", sx: 50, sy: 80, tx: 53, ty: 40, tr: 5 },
  },
  {
    title: "손바닥 지나 손목 1바퀴",
    body: "8·9단계와 같아요. 손바닥을 지나 손목을 한 바퀴 감아요.",
    chip: "손목 1바퀴",
    photo: step11,
    arrow: { d: "M36 82 Q50 90 64 80 Q70 70 62 64", sx: 36, sy: 82 },
  },
  {
    title: "중지–검지 사이 → 손목 1바퀴",
    body: "마지막 사이(중지–검지)를 지나 손바닥으로 넘기고, 손목을 한 바퀴 감아요.",
    chip: "손목 1바퀴",
    photo: step12,
    arrow: { d: "M64 84 Q60 62 57 46", sx: 64, sy: 84, tx: 56, ty: 40, tr: 5 },
  },
  {
    title: "손목에서 찍찍이 마무리",
    body: "남은 붕대로 손목을 한 바퀴 감고, 찍찍이를 손목 바깥쪽(손등 쪽)에 꾹 눌러 붙여요.",
    chip: "손목 1바퀴 + 찍찍이",
    photo: step13,
    arrow: { d: "M64 86 Q82 92 92 80", sx: 64, sy: 86, tx: 96, ty: 74, tr: 7 },
  },
];

/** 손목 합계 — 처음 2바퀴 + 지날 때마다 1바퀴 × 5 (6·9·11·12·13단계) */
export const HANDWRAP_WRIST_TOTAL = "손목 합계 2 + 1 × 5 = 7바퀴";

/** 다 감은 뒤(완성 화면) */
export const HANDWRAP_DONE = {
  title: "완성!",
  body: "주먹을 꽉 쥐었다 펴 보세요. 마디가 푹신하고 손목이 단단하면 잘 감긴 거예요. 손끝이 저리거나 하얘지면 풀고 조금 느슨하게 다시 감아요.",
  photos: [step14, step13] as const,
} as const;

export interface HandWrapMistake {
  wrong: string;
  fix: string;
}

export const HANDWRAP_MISTAKES: readonly HandWrapMistake[] = [
  { wrong: "주먹을 쥔 채로 정권을 감아요", fix: "손가락을 쫙 편 채로 감아야 주먹을 쥐었을 때 피가 잘 통해요." },
  { wrong: "있는 힘껏 세게 감아요", fix: "손끝이 저리거나 하얘지면 바로 풀고 다시 — 단단하게, 하지만 아프지 않게." },
  { wrong: "손목을 지날 때마다 여러 바퀴 감아요", fix: "손목은 처음에만 2바퀴, 그다음부터는 지날 때마다 1바퀴씩이면 충분해요." },
  { wrong: "찍찍이를 손목 안쪽(손바닥 쪽)에 붙여요", fix: "찍찍이는 손목 바깥쪽(손등 쪽)에 붙여야 장갑 안에서 쓸리지 않아요." },
  { wrong: "붕대가 꼬이거나 주름진 채로 감아요", fix: "붕대를 평평하게 펴면서 감아야 쓸리지 않아요." },
];

/** 영상 플레이어 아래 '핵심 포인트' */
export const HANDWRAP_KEY_POINTS: readonly string[] = [
  "엄지 고리 → 손목 2바퀴(처음만) → 정권 3바퀴",
  "손가락 사이 3곳을 지나며 손목은 매번 1바퀴",
  "마지막은 손목 1바퀴 + 찍찍이를 손목 바깥쪽에",
  "손가락을 편 채로 감고, 저리면 풀고 다시",
];
